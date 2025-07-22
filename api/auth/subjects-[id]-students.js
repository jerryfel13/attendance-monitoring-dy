import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.student_id,
        COUNT(ar.id) as total_sessions,
        COUNT(ar.id) FILTER (WHERE ar.status = 'present') as present_sessions,
        COUNT(ar.id) FILTER (WHERE ar.status = 'late') as late_sessions,
        COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent_sessions,
        COALESCE(
          ROUND(
            (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late')) * 100.0 / 
             NULLIF(COUNT(ar.id), 0)
            )::integer
          ), 0
        ) as attendance_rate
      FROM users u
      JOIN enrollments e ON u.id = e.student_id
      LEFT JOIN attendance_records ar ON u.id = ar.student_id
      LEFT JOIN attendance_sessions s ON ar.session_id = s.id AND s.subject_id = $1
      WHERE e.subject_id = $1 AND u.role = 'student'
      GROUP BY u.id, u.name, u.email, u.student_id
      ORDER BY u.name
    `, [id]);
    res.json({ students: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students', details: err.message });
  }
} 