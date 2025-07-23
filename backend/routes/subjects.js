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
  
  if (route === 'teacher-subjects') {
    const teacherId = req.query.teacherId;
    if (!teacherId) {
      return res.status(400).json({ error: 'Missing teacherId' });
    }
    try {
      // Get all subjects for this teacher
      const subjectsResult = await pool.query(
        'SELECT id, name, code, start_time, end_time, schedule_days FROM subjects WHERE teacher_id = $1',
        [teacherId]
      );
      const subjects = await Promise.all(subjectsResult.rows.map(async (subject) => {
        // Get student count
        const studentsResult = await pool.query(
          'SELECT COUNT(*) FROM enrollments WHERE subject_id = $1',
          [subject.id]
        );
        const students = parseInt(studentsResult.rows[0].count, 10);
        // Get attendance stats
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
        // Calculate attendance rate
        let attendanceRate = 100;
        if (total > 0) {
          attendanceRate = Math.round(((total - absent) / total) * 100);
        }
        // Format schedule string
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
  } else if (route === 'get') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing subject id' });
    }
    try {
      const result = await pool.query('SELECT * FROM subjects WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      res.json({ subject: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch subject', details: err.message });
    }
  } else if (route === 'students') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing subject id' });
    }
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
  } else if (route === 'sessions') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing subject id' });
    }
    try {
      const result = await pool.query(`
        SELECT 
          s.id, s.session_date, s.session_time,
          COUNT(ar.id) as total_students,
          COUNT(ar.id) FILTER (WHERE ar.status = 'present') as present_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'late') as late_count,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent_count,
          COALESCE(
            ROUND(
              (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late')) * 100.0 / 
               NULLIF(COUNT(ar.id), 0)
              )::integer
            ), 0
          ) as attendance_rate
        FROM attendance_sessions s
        LEFT JOIN attendance_records ar ON s.id = ar.session_id
        WHERE s.subject_id = $1
        GROUP BY s.id, s.session_date, s.session_time
        ORDER BY s.session_date DESC, s.session_time DESC
      `, [id]);
      res.json({ sessions: result.rows });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch sessions', details: err.message });
    }
  } else if (route === 'active-session') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing subject id' });
    }
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
  } else if (route === 'student-subjects') {
    const studentId = req.query.studentId;
    if (!studentId) {
      return res.status(400).json({ error: 'Missing studentId' });
    }
    try {
      // Get all subjects with enrollment status for this student
      const result = await pool.query(`
        SELECT 
          s.id, s.name, s.code, s.description,
          u.name as teacher_name,
          s.schedule_days, s.start_time, s.end_time,
          CASE WHEN e.student_id IS NOT NULL THEN true ELSE false END as enrolled,
          COALESCE(
            (SELECT 
              ROUND(
                (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late')) * 100.0 / 
                 NULLIF(COUNT(ar.id), 0)
                )::integer
              )
            FROM attendance_records ar
            JOIN attendance_sessions sess ON ar.session_id = sess.id
            WHERE sess.subject_id = s.id AND ar.student_id = $1
            ), 0
          ) as attendance_rate
        FROM subjects s
        LEFT JOIN users u ON s.teacher_id = u.id
        LEFT JOIN enrollments e ON s.id = e.subject_id AND e.student_id = $1
        ORDER BY enrolled DESC, s.name
      `, [studentId]);
      
      const subjects = result.rows.map(subject => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        teacher: subject.teacher_name,
        schedule: subject.schedule_days ? 
          `${subject.schedule_days.join(', ')} ${subject.start_time} - ${subject.end_time}` : 
          'Schedule not set',
        enrolled: subject.enrolled,
        attendanceRate: subject.attendance_rate || 0,
      }));
      
      res.json({ subjects });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch subjects', details: err.message });
    }
  } else {
    res.status(400).json({ error: 'Invalid route' });
  }
});

router.post('/', async (req, res) => {
  const { route } = req.query;
  
  if (route === 'create') {
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
  } else if (route === 'create-session') {
    const { id } = req.query;
    const { session_date, session_time, is_active, attendance_qr } = req.body;
    
    if (!session_date || !session_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
      // First, deactivate any existing active sessions for this subject
      await pool.query(
        'UPDATE attendance_sessions SET is_active = false WHERE subject_id = $1 AND is_active = true',
        [id]
      );
      
      // Create new attendance session
      const result = await pool.query(
        'INSERT INTO attendance_sessions (subject_id, session_date, session_time, is_active, attendance_qr) VALUES ($1, $2, $3, $4, $5) RETURNING id, session_date, session_time, is_active, attendance_qr',
        [id, session_date, session_time, is_active || true, attendance_qr]
      );
      
      res.status(201).json({ session: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create session', details: err.message });
    }
  } else {
    res.status(400).json({ error: 'Invalid route' });
  }
});

// Get subjects for a teacher
router.get('/teacher-subjects', async (req, res) => {
  const teacherId = req.query.teacherId;
  if (!teacherId) {
    return res.status(400).json({ error: 'Missing teacherId' });
  }
  try {
    // Get all subjects for this teacher
    const subjectsResult = await pool.query(
      'SELECT id, name, code, start_time, end_time, schedule_days FROM subjects WHERE teacher_id = $1',
      [teacherId]
    );
    const subjects = await Promise.all(subjectsResult.rows.map(async (subject) => {
      // Get student count
      const studentsResult = await pool.query(
        'SELECT COUNT(*) FROM enrollments WHERE subject_id = $1',
        [subject.id]
      );
      const students = parseInt(studentsResult.rows[0].count, 10);
      // Get attendance stats
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
      // Calculate attendance rate
      let attendanceRate = 100;
      if (total > 0) {
        attendanceRate = Math.round(((total - absent) / total) * 100);
      }
      // Format schedule string
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
});

// Create a new subject
router.post('/create', async (req, res) => {
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
});

// Get a subject by id
router.get('/get', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing subject id' });
  }
  try {
    const result = await pool.query('SELECT * FROM subjects WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json({ subject: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subject', details: err.message });
  }
});

// Get students enrolled in a subject
router.get('/students', async (req, res) => {
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
});

// Get attendance sessions for a subject
router.get('/sessions', async (req, res) => {
  const { id } = req.query;
  try {
    const result = await pool.query(`
      SELECT 
        s.id, s.session_date, s.session_time,
        COUNT(ar.id) as total_students,
        COUNT(ar.id) FILTER (WHERE ar.status = 'present') as present_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'late') as late_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent_count,
        COALESCE(
          ROUND(
            (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late')) * 100.0 / 
             NULLIF(COUNT(ar.id), 0)
            )::integer
          ), 0
        ) as attendance_rate
      FROM attendance_sessions s
      LEFT JOIN attendance_records ar ON s.id = ar.session_id
      WHERE s.subject_id = $1
      GROUP BY s.id, s.session_date, s.session_time
      ORDER BY s.session_date DESC, s.session_time DESC
    `, [id]);
    res.json({ sessions: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions', details: err.message });
  }
});

// Create attendance session for a subject
router.post('/create-session', async (req, res) => {
  const { id } = req.query;
  const { session_date, session_time, is_active, attendance_qr } = req.body;
  
  if (!session_date || !session_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  try {
    // First, deactivate any existing active sessions for this subject
    await pool.query(
      'UPDATE attendance_sessions SET is_active = false WHERE subject_id = $1 AND is_active = true',
      [id]
    );
    
    // Create new attendance session
    const result = await pool.query(
      'INSERT INTO attendance_sessions (subject_id, session_date, session_time, is_active, attendance_qr) VALUES ($1, $2, $3, $4, $5) RETURNING id, session_date, session_time, is_active, attendance_qr',
      [id, session_date, session_time, is_active || true, attendance_qr]
    );
    
    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session', details: err.message });
  }
});

// Get active session for a subject
router.get('/active-session', async (req, res) => {
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
});

// Get subjects for a student (enrolled and available)
router.get('/student-subjects', async (req, res) => {
  const studentId = req.query.studentId;
  if (!studentId) {
    return res.status(400).json({ error: 'Missing studentId' });
  }
  try {
    // Get all subjects with enrollment status for this student
    const result = await pool.query(`
      SELECT 
        s.id, s.name, s.code, s.description,
        u.name as teacher_name,
        s.schedule_days, s.start_time, s.end_time,
        CASE WHEN e.student_id IS NOT NULL THEN true ELSE false END as enrolled,
        COALESCE(
          (SELECT 
            ROUND(
              (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late')) * 100.0 / 
               NULLIF(COUNT(ar.id), 0)
              )::integer
            )
          FROM attendance_records ar
          JOIN attendance_sessions sess ON ar.session_id = sess.id
          WHERE sess.subject_id = s.id AND ar.student_id = $1
          ), 0
        ) as attendance_rate
      FROM subjects s
      LEFT JOIN users u ON s.teacher_id = u.id
      LEFT JOIN enrollments e ON s.id = e.subject_id AND e.student_id = $1
      ORDER BY enrolled DESC, s.name
    `, [studentId]);
    
    const subjects = result.rows.map(subject => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      teacher: subject.teacher_name,
      schedule: subject.schedule_days ? 
        `${subject.schedule_days.join(', ')} ${subject.start_time} - ${subject.end_time}` : 
        'Schedule not set',
      enrolled: subject.enrolled,
      attendanceRate: subject.attendance_rate || 0,
    }));
    
    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subjects', details: err.message });
  }
});

module.exports = router; 