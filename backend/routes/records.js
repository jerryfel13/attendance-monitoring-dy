const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Handle route-based requests
router.get('/', async (req, res) => {
  const { route } = req.query;
  
  if (route === 'enrollments') {
    try {
      const result = await pool.query(`
        SELECT 
          e.id, e.enrolled_at,
          u.name as student_name, u.email as student_email, u.student_id,
          s.name as subject_name, s.code as subject_code
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN subjects s ON e.subject_id = s.id
        ORDER BY e.enrolled_at DESC
      `);
      res.json({ enrollments: result.rows });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch enrollments', details: err.message });
    }
  } else if (route === 'attendance-records') {
    try {
      const result = await pool.query(`
        SELECT 
          ar.id, ar.status, ar.created_at,
          u.name as student_name, u.email as student_email, u.student_id,
          s.name as subject_name, s.code as subject_code,
          sess.session_date, sess.session_time
        FROM attendance_records ar
        JOIN users u ON ar.student_id = u.id
        JOIN attendance_sessions sess ON ar.session_id = sess.id
        JOIN subjects s ON sess.subject_id = s.id
        ORDER BY ar.created_at DESC
      `);
      res.json({ attendanceRecords: result.rows });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch attendance records', details: err.message });
    }
  } else {
    res.status(400).json({ error: 'Invalid route' });
  }
});

// Get all enrollments
router.get('/enrollments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id, e.enrolled_at,
        u.name as student_name, u.email as student_email, u.student_id,
        s.name as subject_name, s.code as subject_code
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      JOIN subjects s ON e.subject_id = s.id
      ORDER BY e.enrolled_at DESC
    `);
    res.json({ enrollments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch enrollments', details: err.message });
  }
});

// Get all attendance records
router.get('/attendance-records', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ar.id, ar.status, ar.created_at,
        u.name as student_name, u.email as student_email, u.student_id,
        s.name as subject_name, s.code as subject_code,
        sess.session_date, sess.session_time
      FROM attendance_records ar
      JOIN users u ON ar.student_id = u.id
      JOIN attendance_sessions sess ON ar.session_id = sess.id
      JOIN subjects s ON sess.subject_id = s.id
      ORDER BY ar.created_at DESC
    `);
    res.json({ attendanceRecords: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance records', details: err.message });
  }
});

module.exports = router; 