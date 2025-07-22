import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  const { route } = req.query;

  // REGISTER
  if (route === 'register' && req.method === 'POST') {
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
      return res.status(201).json({ user: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Email already exists' });
      } else {
        return res.status(500).json({ error: 'Registration failed', details: err.message });
      }
    }
  }

  // LOGIN
  if (route === 'login' && req.method === 'POST') {
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
      const { password_hash, ...userData } = user;
      return res.json({ user: userData });
    } catch (err) {
      return res.status(500).json({ error: 'Login failed', details: err.message });
    }
  }

  // SCAN
  if (route === 'scan' && req.method === 'POST') {
    const { qrCode, studentId } = req.body;
    if (!qrCode || !studentId) {
      return res.status(400).json({ error: 'Missing QR code or student ID' });
    }
    try {
      if (qrCode.startsWith("SUBJECT:")) {
        const subjectInfo = qrCode.replace("SUBJECT:", "").trim();
        const match = subjectInfo.match(/^(.+?)\s*\(([^)]+)\)/);
        if (!match) {
          return res.status(400).json({ error: 'Invalid subject QR code format' });
        }
        const [, subjectName, subjectCode] = match;
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName.trim(), subjectCode.trim()]
        );
        if (subjectResult.rows.length === 0) {
          return res.status(404).json({ error: 'Subject not found' });
        }
        const subjectId = subjectResult.rows[0].id;
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
        await pool.query(
          'INSERT INTO enrollments (student_id, subject_id) VALUES ($1, $2)',
          [studentId, subjectId]
        );
        return res.json({
          type: 'enrollment',
          message: `Successfully enrolled in ${subjectName} (${subjectCode})!`,
          success: true
        });
      } else if (qrCode.startsWith("ATTENDANCE:")) {
        const attendanceInfo = qrCode.replace("ATTENDANCE:", "").trim();
        const match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)/);
        if (!match) {
          return res.status(400).json({ error: 'Invalid attendance QR code format' });
        }
        const [, subjectName, subjectCode] = match;
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName.trim(), subjectCode.trim()]
        );
        if (subjectResult.rows.length === 0) {
          return res.status(404).json({ error: 'Subject not found' });
        }
        const subjectId = subjectResult.rows[0].id;
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
        const sessionData = await pool.query(
          'SELECT s.session_time, s.session_date, sub.late_threshold FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
          [sessionId]
        );
        if (sessionData.rows.length === 0) {
          return res.status(404).json({ 
            type: 'attendance',
            message: 'Session data not found',
            success: false 
          });
        }
        const session = sessionData.rows[0];
        const lateThreshold = session.late_threshold || 15;
        const sessionTime = new Date(`${session.session_date}T${session.session_time}`);
        const currentTime = new Date();
        const timeDifference = (currentTime.getTime() - sessionTime.getTime()) / (1000 * 60);
        let attendanceStatus = 'present';
        let statusMessage = 'Attendance marked';
        if (timeDifference > lateThreshold) {
          attendanceStatus = 'late';
          statusMessage = `Attendance marked (LATE - ${Math.round(timeDifference)} minutes after start)`;
        }
        await pool.query(
          'INSERT INTO attendance_records (session_id, student_id, status) VALUES ($1, $2, $3)',
          [sessionId, studentId, attendanceStatus]
        );
        return res.json({
          type: 'attendance',
          message: `${statusMessage} for ${subjectName} (${subjectCode}) at ${new Date().toLocaleTimeString()}`,
          success: true
        });
      } else {
        return res.status(400).json({ 
          type: 'error',
          message: 'Invalid QR code. Please scan a valid subject or attendance QR code.',
          success: false 
        });
      }
    } catch (err) {
      return res.status(500).json({ 
        type: 'error',
        message: 'Failed to process QR code',
        success: false 
      });
    }
  }

  // Default: Not found
  return res.status(404).json({ error: 'Not found' });
} 