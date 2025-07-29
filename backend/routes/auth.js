const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Registration endpoint
router.post('/register', async (req, res) => {
  const { name, email, password, role, studentId } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const uniqueId = `${role.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const result = await pool.query(
      'INSERT INTO users (unique_id, name, email, password_hash, role, student_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, unique_id, name, email, role, student_id',
      [uniqueId, name, email, hashedPassword, role, studentId || null]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Registration failed', details: err.message });
    }
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  console.log('Login request body:', req.body);
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Exclude password_hash from response
    const { password_hash, ...userData } = user;
    res.json({ user: userData });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// Get subjects for a teacher
router.get('/teacher/subjects', async (req, res) => {
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
      // Get attendance stats - only count as present if check_out_time exists
      const attendanceStats = await pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'late' AND check_out_time IS NOT NULL) AS late,
          COUNT(*) FILTER (WHERE status = 'absent') AS absent,
          COUNT(*) FILTER (WHERE status = 'present' AND check_out_time IS NOT NULL) AS present,
          COUNT(*) AS total
        FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE s.subject_id = $1`,
        [subject.id]
      );
      const { late, absent, present, total } = attendanceStats.rows[0];
      // Calculate attendance rate - only count completed attendance (with check_out_time)
      let attendanceRate = 100;
      if (total > 0) {
        const completedAttendance = parseInt(present, 10) + parseInt(late, 10);
        attendanceRate = Math.round((completedAttendance / total) * 100);
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
router.post('/subjects', async (req, res) => {
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
router.get('/subjects/:id', async (req, res) => {
  const { id } = req.params;
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
router.get('/subjects/:id/students', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.student_id,
        COUNT(ar.id) as total_sessions,
        COUNT(ar.id) FILTER (WHERE ar.status = 'present' AND ar.check_out_time IS NOT NULL) as present_sessions,
        COUNT(ar.id) FILTER (WHERE ar.status = 'late' AND ar.check_out_time IS NOT NULL) as late_sessions,
        COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent_sessions,
        COALESCE(
          ROUND(
            (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late') AND ar.check_out_time IS NOT NULL) * 100.0 / 
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
router.get('/subjects/:id/sessions', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        s.id, s.session_date, s.session_time,
        COUNT(ar.id) as total_students,
        COUNT(ar.id) FILTER (WHERE ar.status = 'present' AND ar.check_out_time IS NOT NULL) as present_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'late' AND ar.check_out_time IS NOT NULL) as late_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent_count,
        COALESCE(
          ROUND(
            (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late') AND ar.check_out_time IS NOT NULL) * 100.0 / 
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
router.post('/subjects/:id/sessions', async (req, res) => {
  const { id } = req.params;
  const { session_date, session_time, is_active, attendance_qr } = req.body;
  
  console.log('Creating session with data:', {
    subject_id: id,
    session_date,
    session_time,
    is_active,
    attendance_qr
  });
  
  if (!session_date || !session_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Validate and format session_time
  let formattedSessionTime = session_time;
  
  // If session_time is not in HH:MM:SS format, try to convert it
  if (typeof session_time === 'string' && !session_time.match(/^\d{2}:\d{2}:\d{2}$/)) {
    console.log('Invalid session_time format received:', session_time);
    
    // Try to parse and format the time
    try {
      const timeMatch = session_time.match(/(\d{1,2}):(\d{2}):(\d{2})/);
      if (timeMatch) {
        const hours = timeMatch[1].padStart(2, '0');
        const minutes = timeMatch[2];
        const seconds = timeMatch[3];
        formattedSessionTime = `${hours}:${minutes}:${seconds}`;
        console.log('Formatted session_time:', formattedSessionTime);
      } else {
        // If no valid time format found, use default
        formattedSessionTime = '09:00:00';
        console.log('Using default session_time:', formattedSessionTime);
      }
    } catch (error) {
      console.log('Error formatting session_time, using default');
      formattedSessionTime = '09:00:00';
    }
  }
  
  try {
    // First, deactivate any existing active sessions for this subject
    await pool.query(
      'UPDATE attendance_sessions SET is_active = false WHERE subject_id = $1 AND is_active = true',
      [id]
    );
    
    console.log('Inserting session with formatted time:', formattedSessionTime);
    
    // Create new attendance session
    const result = await pool.query(
      'INSERT INTO attendance_sessions (subject_id, session_date, session_time, is_active, attendance_qr) VALUES ($1, $2, $3, $4, $5) RETURNING id, session_date, session_time, is_active, attendance_qr',
      [id, session_date, formattedSessionTime, is_active || true, attendance_qr]
    );
    
    console.log('Session created successfully:', result.rows[0]);
    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ error: 'Failed to create session', details: err.message });
  }
});

// Get active session for a subject
router.get('/subjects/:id/sessions/active', async (req, res) => {
  const { id } = req.params;
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

// Stop attendance session
router.put('/sessions/:id/stop', async (req, res) => {
  const { id } = req.params;
  try {
    // Get session details
    const sessionResult = await pool.query(
      'SELECT s.id, s.subject_id, s.session_date, s.session_time FROM attendance_sessions s WHERE s.id = $1',
      [id]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionResult.rows[0];
    
    // Get all enrolled students for this subject
    const enrolledStudents = await pool.query(
      'SELECT e.student_id FROM enrollments e WHERE e.subject_id = $1',
      [session.subject_id]
    );
    
    // First, update all pending records to absent
    await pool.query(
      'UPDATE attendance_records SET status = $1 WHERE session_id = $2 AND status = $3',
      ['absent', id, 'pending']
    );
    
    // Get students who already marked attendance with final status
    const markedStudents = await pool.query(
      'SELECT ar.student_id, ar.status FROM attendance_records ar WHERE ar.session_id = $1',
      [id]
    );
    
    const finalStatusStudentIds = markedStudents.rows
      .filter(row => ['present', 'late', 'absent'].includes(row.status))
      .map(row => row.student_id);
    
    // Find students who didn't mark attendance at all
    const absentStudents = enrolledStudents.rows.filter(
      student => !finalStatusStudentIds.includes(student.student_id)
    );
    
    // Create absent records for students who never scanned in
    for (const student of absentStudents) {
      await pool.query(
        'INSERT INTO attendance_records (session_id, student_id, status) VALUES ($1, $2, $3)',
        [id, student.student_id, 'absent']
      );
    }
    
    // Deactivate the session
    const result = await pool.query(
      'UPDATE attendance_sessions SET is_active = false WHERE id = $1 RETURNING id, session_date, session_time, is_active',
      [id]
    );
    
    res.json({ 
      session: result.rows[0],
      absentCount: absentStudents.length,
      totalEnrolled: enrolledStudents.rows.length,
      markedCount: markedStudents.rows.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop session', details: err.message });
  }
});

// Get late students for a subject
router.get('/subjects/:id/late-students', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.student_id,
        ar.status, ar.created_at as check_in_time,
        s.session_date, s.session_time,
        sub.late_threshold
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      JOIN users u ON ar.student_id = u.id
      JOIN subjects sub ON s.subject_id = sub.id
      WHERE s.subject_id = $1 AND ar.status = 'late'
      ORDER BY s.session_date DESC, s.session_time DESC, ar.created_at DESC
    `, [id]);
    
    res.json({ lateStudents: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch late students', details: err.message });
  }
});

// Get late students for a specific session
router.get('/sessions/:id/late-students', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.student_id,
        ar.status, ar.created_at as check_in_time,
        s.session_date, s.session_time,
        sub.late_threshold
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      JOIN users u ON ar.student_id = u.id
      JOIN subjects sub ON s.subject_id = sub.id
      WHERE s.id = $1 AND ar.status = 'late'
      ORDER BY ar.created_at DESC
    `, [id]);
    
    res.json({ lateStudents: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch late students', details: err.message });
  }
});

// Get absent students for a subject
router.get('/subjects/:id/absent-students', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.student_id,
        ar.status, ar.created_at as marked_time,
        s.session_date, s.session_time
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      JOIN users u ON ar.student_id = u.id
      WHERE s.subject_id = $1 AND ar.status = 'absent'
      ORDER BY s.session_date DESC, s.session_time DESC
    `, [id]);
    
    res.json({ absentStudents: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch absent students', details: err.message });
  }
});

// Get absent students for a specific session
router.get('/sessions/:id/absent-students', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.student_id,
        ar.status, ar.created_at as marked_time,
        s.session_date, s.session_time
      FROM attendance_records ar
      JOIN attendance_sessions s ON ar.session_id = s.id
      JOIN users u ON ar.student_id = u.id
      WHERE s.id = $1 AND ar.status = 'absent'
      ORDER BY ar.created_at DESC
    `, [id]);
    
    res.json({ absentStudents: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch absent students', details: err.message });
  }
});

// Get subjects for a student (enrolled and available)
router.get('/student/subjects', async (req, res) => {
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
              (COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late') AND ar.check_out_time IS NOT NULL) * 100.0 / 
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

// Debug endpoint to see all subjects
router.get('/debug/subjects', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, code, teacher_id FROM subjects');
    res.json({ subjects: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subjects', details: err.message });
  }
});

// Get student details with attendance stats
router.get('/student/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.student_id,
        COUNT(DISTINCT e.subject_id) as enrolled_subjects,
        COUNT(ar.id) as total_sessions,
        COUNT(ar.id) FILTER (WHERE ar.status = 'present' AND ar.check_out_time IS NOT NULL) as present_sessions,
        COUNT(ar.id) FILTER (WHERE ar.status = 'late' AND ar.check_out_time IS NOT NULL) as late_sessions,
        COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent_sessions,
        CASE 
          WHEN COUNT(ar.id) > 0 THEN 
            ROUND((COUNT(ar.id) FILTER (WHERE ar.status IN ('present', 'late') AND ar.check_out_time IS NOT NULL) * 100.0 / COUNT(ar.id))::integer
          ELSE 0 
        END as overall_attendance_rate
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.student_id
      LEFT JOIN attendance_records ar ON u.id = ar.student_id
      WHERE u.id = $1 AND u.role = 'student'
      GROUP BY u.id, u.name, u.email, u.student_id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({ student: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch student', details: err.message });
  }
});

// Handle QR code scanning
router.post('/scan', async (req, res) => {
  const { qrCode, studentId } = req.body;
  if (!qrCode || !studentId) {
    return res.status(400).json({ error: 'Missing QR code or student ID' });
  }

  // Debug: Log the QR code and extracted data
  console.log('QR Code received:', qrCode);
  console.log('Student ID:', studentId);

  try {
    if (qrCode.startsWith("SUBJECT:")) {
      // Handle subject enrollment
      const subjectInfo = qrCode.replace("SUBJECT:", "").trim();
      
      // Extract subject name and code from QR data
      const match = subjectInfo.match(/^(.+?)\s*\(([^)]+)\)/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid subject QR code format' });
      }
      
      const [, subjectName, subjectCode] = match;
      
      // Debug: Log extracted data
      console.log('Extracted subject name:', subjectName.trim());
      console.log('Extracted subject code:', subjectCode.trim());
      
      // Find the subject by name and code (with more flexible matching)
      const subjectResult = await pool.query(
        'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
        [subjectName.trim(), subjectCode.trim()]
      );
      
      if (subjectResult.rows.length === 0) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      
      const subjectId = subjectResult.rows[0].id;
      
      // Check if already enrolled
      const enrollmentCheck = await pool.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND subject_id = $2',
        [studentId, subjectId]
      );
      
      if (enrollmentCheck.rows.length > 0) {
        return res.status(409).json({ 
          type: 'enrollment',
          message: `Already enrolled in ${subjectName} (${subjectCode})`,
          success: false 
        });
      }
      
      // Enroll the student
      await pool.query(
        'INSERT INTO enrollments (student_id, subject_id) VALUES ($1, $2)',
        [studentId, subjectId]
      );
      
      res.json({
        type: 'enrollment',
        message: `Successfully enrolled in ${subjectName} (${subjectCode})!`,
        success: true
      });
      
    } else if (qrCode.startsWith("ATTENDANCE:")) {
      // Handle attendance marking
      const attendanceInfo = qrCode.replace("ATTENDANCE:", "").trim();
      
      // Extract subject name and code from QR data (more flexible parsing)
      const match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid attendance QR code format' });
      }
      
      const [, subjectName, subjectCode] = match;
      
      // Find the subject (with more flexible matching)
      const subjectResult = await pool.query(
        'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
        [subjectName.trim(), subjectCode.trim()]
      );
      
      if (subjectResult.rows.length === 0) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      
      const subjectId = subjectResult.rows[0].id;
      
      // Check if student is enrolled
      const enrollmentCheck = await pool.query(
        'SELECT id FROM enrollments WHERE student_id = $1 AND subject_id = $2',
        [studentId, subjectId]
      );
      
      if (enrollmentCheck.rows.length === 0) {
        return res.status(403).json({ 
          type: 'attendance',
          message: 'You are not enrolled in this subject',
          success: false 
        });
      }
      
      // Find active attendance session for this subject
      const sessionResult = await pool.query(
        'SELECT id, session_date, session_time FROM attendance_sessions WHERE subject_id = $1 AND is_active = true ORDER BY session_date DESC, session_time DESC LIMIT 1',
        [subjectId]
      );
      
      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ 
          type: 'attendance',
          message: 'No active attendance session found for this subject',
          success: false 
        });
      }
      
      const sessionId = sessionResult.rows[0].id;
      
      // Check if already marked attendance
      const attendanceCheck = await pool.query(
        'SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2',
        [sessionId, studentId]
      );
      
      if (attendanceCheck.rows.length > 0) {
        return res.status(409).json({ 
          type: 'attendance',
          message: 'Attendance already marked for this session',
          success: false 
        });
      }
      
      // Mark attendance as pending initially (will be finalized on scan-out)
      await pool.query(
        'INSERT INTO attendance_records (session_id, student_id, status) VALUES ($1, $2, $3)',
        [sessionId, studentId, 'pending']
      );
      
      res.json({
        type: 'attendance',
        message: `Attendance marked for ${subjectName} (${subjectCode}) at ${new Date().toLocaleTimeString()}. Please scan out at the end of class.`,
        success: true
      });
      
    } else {
      res.status(400).json({ 
        type: 'error',
        message: 'Invalid QR code. Please scan a valid subject or attendance QR code.',
        success: false 
      });
    }
  } catch (err) {
    console.error('QR scan error:', err);
    res.status(500).json({ 
      type: 'error',
      message: 'Failed to process QR code',
      success: false 
    });
  }
});

module.exports = router; 