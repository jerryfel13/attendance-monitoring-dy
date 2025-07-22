import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', 'https://v0-attendance-system-design-eight.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
        // SCAN-IN logic
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
        // Check if already scanned in
        const attendanceCheck = await pool.query(
          'SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2',
          [sessionId, studentId]
        );
        if (attendanceCheck.rows.length > 0) {
          return res.status(409).json({ 
            type: 'attendance',
            message: 'Already scanned in for this session. Please scan out at the end of class.',
            success: false 
          });
        }
        // Insert with status 'pending'
        await pool.query(
          'INSERT INTO attendance_records (session_id, student_id, status, check_in_time) VALUES ($1, $2, $3, NOW())',
          [sessionId, studentId, 'pending']
        );
        return res.json({
          type: 'attendance',
          message: `Scan-in successful. Please scan out at the end of class to confirm your attendance.`,
          success: true
        });
      } else if (qrCode.startsWith("ATTENDANCE-OUT:")) {
        // SCAN-OUT logic
        const attendanceInfo = qrCode.replace("ATTENDANCE-OUT:", "").trim();
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
        const sessionResult = await pool.query(
          'SELECT id FROM attendance_sessions WHERE subject_id = $1 AND is_active = true ORDER BY session_date DESC, session_time DESC LIMIT 1',
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
        // Get scan-in record
        const recordResult = await pool.query(
          'SELECT id, check_in_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
          [sessionId, studentId]
        );
        if (recordResult.rows.length === 0) {
          return res.status(404).json({ 
            type: 'attendance',
            message: 'No scan-in record found. Please scan in first.',
            success: false 
          });
        }
        const record = recordResult.rows[0];
        // Get session info for late threshold
        const sessionData = await pool.query(
          'SELECT s.session_time, s.session_date, sub.late_threshold FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
          [sessionId]
        );
        const session = sessionData.rows[0];
        const lateThreshold = session.late_threshold || 15;
        const sessionTime = new Date(`${session.session_date}T${session.session_time}`);
        const checkInTime = new Date(record.check_in_time);
        const timeDifference = (checkInTime.getTime() - sessionTime.getTime()) / (1000 * 60);
        let attendanceStatus = 'present';
        if (timeDifference > lateThreshold) {
          attendanceStatus = 'late';
        }
        // Update record with check_out_time and final status
        await pool.query(
          'UPDATE attendance_records SET check_out_time = NOW(), status = $1 WHERE id = $2',
          [attendanceStatus, record.id]
        );
        return res.json({
          type: 'attendance',
          message: 'Scan-out successful. Your attendance is confirmed.',
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

  // Generate manual code (teacher)
  if (route === 'generate-manual-code' && req.method === 'POST') {
    const { sessionId, type } = req.body;
    if (!sessionId || !['in', 'out'].includes(type)) {
      return res.status(400).json({ error: 'Missing or invalid sessionId/type' });
    }
    try {
      // Generate a random 6-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
      // Store in DB
      await pool.query(
        'INSERT INTO manual_attendance_codes (session_id, type, code) VALUES ($1, $2, $3)',
        [sessionId, type, code]
      );
      return res.json({ code });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to generate manual code', details: err.message });
    }
  }

  // Student submits manual code
  if (route === 'manual-code' && req.method === 'POST') {
    const { code, studentId } = req.body;
    if (!code || !studentId) {
      return res.status(400).json({ error: 'Missing code or studentId' });
    }
    try {
      // Find unused code
      const result = await pool.query(
        'SELECT id, session_id, type, used FROM manual_attendance_codes WHERE code = $1 AND used = false',
        [code]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invalid or already used code' });
      }
      const manualCode = result.rows[0];
      // Mark code as used
      await pool.query(
        'UPDATE manual_attendance_codes SET used = true WHERE id = $1',
        [manualCode.id]
      );
      // Mark attendance (in or out)
      if (manualCode.type === 'in') {
        // Only allow if not already scanned in
        const attendanceCheck = await pool.query(
          'SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2',
          [manualCode.session_id, studentId]
        );
        if (attendanceCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Already scanned in for this session' });
        }
        await pool.query(
          'INSERT INTO attendance_records (session_id, student_id, status, check_in_time) VALUES ($1, $2, $3, NOW())',
          [manualCode.session_id, studentId, 'pending']
        );
        return res.json({ message: 'Manual scan-in successful. Please scan out or ask for a manual code at the end of class.' });
      } else if (manualCode.type === 'out') {
        // Only allow if already scanned in and not scanned out
        const recordResult = await pool.query(
          'SELECT id, check_in_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
          [manualCode.session_id, studentId]
        );
        if (recordResult.rows.length === 0) {
          return res.status(404).json({ error: 'No scan-in record found. Please scan in first.' });
        }
        const record = recordResult.rows[0];
        // Get session info for late threshold
        const sessionData = await pool.query(
          'SELECT s.session_time, s.session_date, sub.late_threshold FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
          [manualCode.session_id]
        );
        const session = sessionData.rows[0];
        const lateThreshold = session.late_threshold || 15;
        const sessionTime = new Date(`${session.session_date}T${session.session_time}`);
        const checkInTime = new Date(record.check_in_time);
        const timeDifference = (checkInTime.getTime() - sessionTime.getTime()) / (1000 * 60);
        let attendanceStatus = 'present';
        if (timeDifference > lateThreshold) {
          attendanceStatus = 'late';
        }
        // Update record with check_out_time and final status
        await pool.query(
          'UPDATE attendance_records SET check_out_time = NOW(), status = $1 WHERE id = $2',
          [attendanceStatus, record.id]
        );
        return res.json({ message: 'Manual scan-out successful. Your attendance is confirmed.' });
      } else {
        return res.status(400).json({ error: 'Invalid code type' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to process manual code', details: err.message });
    }
  }

  // STOP SESSION: Mark absent if not scanned out
  if (route === 'stop-session' && req.method === 'PUT') {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    try {
      // Set all pending records to absent
      await pool.query(
        `UPDATE attendance_records SET status = 'absent' WHERE session_id = $1 AND status = 'pending'`,
        [sessionId]
      );
      // Deactivate the session
      await pool.query(
        'UPDATE attendance_sessions SET is_active = false WHERE id = $1',
        [sessionId]
      );
      return res.json({ message: 'Session stopped. Absentees marked for students who did not scan out.' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to stop session', details: err.message });
    }
  }

  // Default: Not found
  return res.status(404).json({ error: 'Not found' });
} 