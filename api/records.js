import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  const { route } = req.query;

  // Get all enrollments
  if (route === 'enrollments' && req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM enrollments');
      return res.json({ enrollments: result.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch enrollments', details: err.message });
    }
  }

  // Get all attendance records
  if (route === 'attendance-records' && req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM attendance_records');
      return res.json({ attendanceRecords: result.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch attendance records', details: err.message });
    }
  }

  // Default: Not found
  return res.status(404).json({ error: 'Not found' });
} 