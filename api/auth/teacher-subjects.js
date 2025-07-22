import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const teacherId = req.query.teacherId;
  if (!teacherId) return res.status(400).json({ error: 'Missing teacherId' });
  try {
    const subjectsResult = await pool.query(
      'SELECT id, name, code, start_time, end_time, schedule_days FROM subjects WHERE teacher_id = $1',
      [teacherId]
    );
    const subjects = await Promise.all(subjectsResult.rows.map(async (subject) => {
      const studentsResult = await pool.query(
        'SELECT COUNT(*) FROM enrollments WHERE subject_id = $1',
        [subject.id]
      );
      const students = parseInt(studentsResult.rows[0].count, 10);
      const attendanceStats = await pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'late') AS late,
          COUNT(*) FILTER (WHERE status = 'absent') AS absent,
          COUNT(*) AS total
        FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE s.subject_id = $1`,
        [subject.id]
      );
      const { late, absent, total } = attendanceStats.rows[0];
      let attendanceRate = 100;
      if (total > 0) {
        attendanceRate = Math.round(((total - absent) / total) * 100);
      }
      let schedule = '';
      if (subject.schedule_days && subject.start_time && subject.end_time) {
        schedule = `${subject.schedule_days.join(', ')} ${subject.start_time} - ${subject.end_time}`;
      }
      return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        students,
        schedule,
        attendanceRate,
        lateStudents: parseInt(late, 10) || 0,
        absentStudents: parseInt(absent, 10) || 0,
      };
    }));
    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subjects', details: err.message });
  }
} 