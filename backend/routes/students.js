const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Get a student's attendance records for a specific subject
router.get('/:id/attendance', async (req, res) => {
  const { id } = req.params;
  const { subjectId } = req.query;
  if (!subjectId) {
    return res.status(400).json({ error: 'Missing subjectId' });
  }
  try {
    const result = await pool.query(`
      SELECT 
        ar.id, ar.status, ar.session_id, ar.created_at as marked_time,
        s.session_date, s.session_time
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      WHERE ar.student_id = $1 AND s.subject_id = $2
      ORDER BY s.session_date DESC, s.session_time DESC
    `, [id, subjectId]);
    res.json({ attendance: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance records', details: err.message });
  }
});

module.exports = router; 