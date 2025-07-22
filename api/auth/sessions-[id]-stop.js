import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  try {
    const sessionResult = await pool.query(
      'SELECT s.id, s.subject_id, s.session_date, s.session_time FROM attendance_sessions s WHERE s.id = $1',
      [id]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionResult.rows[0];
    const enrolledStudents = await pool.query(
      'SELECT e.student_id FROM enrollments e WHERE e.subject_id = $1',
      [session.subject_id]
    );
    const markedStudents = await pool.query(
      'SELECT ar.student_id FROM attendance_records ar WHERE ar.session_id = $1',
      [id]
    );
    const markedStudentIds = markedStudents.rows.map(row => row.student_id);
    const absentStudents = enrolledStudents.rows.filter(
      student => !markedStudentIds.includes(student.student_id)
    );
    for (const student of absentStudents) {
      await pool.query(
        'INSERT INTO attendance_records (session_id, student_id, status) VALUES ($1, $2, $3)',
        [id, student.student_id, 'absent']
      );
    }
    const result = await pool.query(
      'UPDATE attendance_sessions SET is_active = false WHERE id = $1 RETURNING id, session_date, session_time, is_active',
      [id]
    );
    
    res.json({ 
      session: result.rows[0],
      absentCount: absentStudents.length,
      totalEnrolled: enrolledStudents.rows.length,
      markedCount: markedStudents.rows.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop session', details: err.message });
  }
} 