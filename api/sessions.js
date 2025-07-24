import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  const { route, id } = req.query;

  // Stop attendance session
  if (route === 'stop' && req.method === 'PUT' && id) {
    try {
      // Get session details
      const sessionResult = await pool.query(
        'SELECT s.id, s.subject_id, s.session_date, s.session_time FROM attendance_sessions s WHERE s.id = $1',
        [id]
      );
      
      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const session = sessionResult.rows[0];
      
      // Get all enrolled students for this subject
      const enrolledStudents = await pool.query(
        'SELECT e.student_id FROM enrollments e WHERE e.subject_id = $1',
        [session.subject_id]
      );
      
      // First, update all pending records to absent
      await pool.query(
        'UPDATE attendance_records SET status = $1 WHERE session_id = $2 AND status = $3',
        ['absent', id, 'pending']
      );
      
      // Get students who already marked attendance with final status
      const markedStudents = await pool.query(
        'SELECT ar.student_id, ar.status FROM attendance_records ar WHERE ar.session_id = $1',
        [id]
      );
      
      const finalStatusStudentIds = markedStudents.rows
        .filter(row => ['present', 'late', 'absent'].includes(row.status))
        .map(row => row.student_id);
      
      // Find students who didn't mark attendance at all
      const absentStudents = enrolledStudents.rows.filter(
        student => !finalStatusStudentIds.includes(student.student_id)
      );
      
      // Create absent records for students who never scanned in
      for (const student of absentStudents) {
        await pool.query(
          'INSERT INTO attendance_records (session_id, student_id, status) VALUES ($1, $2, $3)',
          [id, student.student_id, 'absent']
        );
      }
      
      // Deactivate the session
      const result = await pool.query(
        'UPDATE attendance_sessions SET is_active = false WHERE id = $1 RETURNING id, session_date, session_time, is_active',
        [id]
      );
      
      return res.json({ 
        session: result.rows[0],
        absentCount: absentStudents.length,
        totalEnrolled: enrolledStudents.rows.length,
        markedCount: markedStudents.rows.length
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to stop session', details: err.message });
    }
  }

  // Default: Not found
  return res.status(404).json({ error: 'Not found' });
} 