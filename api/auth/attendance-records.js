import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const result = await pool.query('SELECT * FROM attendance_records');
    res.json({ attendanceRecords: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance records', details: err.message });
  }
} 