import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { name, code, description, teacher_id, schedule_days, start_time, end_time, late_threshold } = req.body;
  if (!name || !code || !teacher_id || !schedule_days || !start_time || !end_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO subjects (name, code, description, teacher_id, schedule_days, start_time, end_time, late_threshold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, code, description, teacher_id, schedule_days, start_time, end_time, late_threshold',
      [name, code, description || null, teacher_id, schedule_days, start_time, end_time, late_threshold || 15]
    );
    res.status(201).json({ subject: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Subject code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create subject', details: err.message });
    }
  }
} 