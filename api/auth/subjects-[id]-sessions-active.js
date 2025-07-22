import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  try {
    const result = await pool.query(
      'SELECT id, session_date, session_time, is_active FROM attendance_sessions WHERE subject_id = $1 AND is_active = true ORDER BY session_date DESC, session_time DESC LIMIT 1',
      [id]
    );
    if (result.rows.length > 0) {
      res.json({ session: result.rows[0] });
    } else {
      res.json({ session: null });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active session', details: err.message });
  }
} 