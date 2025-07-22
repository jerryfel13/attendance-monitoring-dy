import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  try {
    const result = await pool.query('SELECT * FROM subjects WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json({ subject: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subject', details: err.message });
  }
} 