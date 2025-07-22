import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  const { session_date, session_time, is_active, attendance_qr } = req.body;
  if (!session_date || !session_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await pool.query(
      'UPDATE attendance_sessions SET is_active = false WHERE subject_id = $1 AND is_active = true',
      [id]
    );
    const result = await pool.query(
      'INSERT INTO attendance_sessions (subject_id, session_date, session_time, is_active, attendance_qr) VALUES ($1, $2, $3, $4, $5) RETURNING id, session_date, session_time, is_active, attendance_qr',
      [id, session_date, session_time, is_active || true, attendance_qr]
    );
    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session', details: err.message });
  }
} 