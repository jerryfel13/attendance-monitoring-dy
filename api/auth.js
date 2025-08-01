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
    
    // Debug logging for all QR codes
    console.log('Received QR Code:', qrCode);
    console.log('QR Code length:', qrCode.length);
    console.log('QR Code starts with SUBJECT:', qrCode.startsWith("SUBJECT:"));
    console.log('QR Code starts with ATTENDANCE:', qrCode.startsWith("ATTENDANCE:"));
    console.log('QR Code starts with ATTENDANCE_', qrCode.startsWith("ATTENDANCE_"));
    console.log('QR Code starts with ATTENDANCE_OUT_', qrCode.startsWith("ATTENDANCE_OUT_"));
    console.log('QR Code trimmed:', qrCode.trim());
    console.log('QR Code starts with ATTENDANCE_OUT_ (trimmed):', qrCode.trim().startsWith("ATTENDANCE_OUT_"));
    console.log('QR Code first 20 characters:', qrCode.substring(0, 20));
    console.log('QR Code character codes (first 20):', Array.from(qrCode.substring(0, 20)).map(c => `${c}:${c.charCodeAt(0)}`));
    
    try {
      if (qrCode.startsWith("SUBJECT:")) {
        const subjectInfo = qrCode.replace("SUBJECT:", "").trim();
        // Parse format: "Data Structures (CS201)"
        const match = subjectInfo.match(/^(.+?)\s*\(([^)]+)\)$/);
        if (!match) {
          return res.status(400).json({ error: 'Invalid subject QR code format' });
        }
        const [, subjectName, subjectCode] = match;
        
        // Debug logging
        console.log('Subject QR Code:', qrCode);
        console.log('Parsed subject name:', subjectName.trim());
        console.log('Parsed subject code:', subjectCode.trim());
        
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName.trim(), subjectCode.trim()]
        );
        if (subjectResult.rows.length === 0) {
          console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
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
      } else if (qrCode.startsWith("SUBJECT_")) {
        // Handle SUBJECT_ format (manual codes)
        console.log('Processing SUBJECT_ QR code:', qrCode);
        const subjectInfo = qrCode.replace("SUBJECT_", "").trim();
        const parts = subjectInfo.split('_');
        
        if (parts.length < 2) {
          return res.status(400).json({ error: 'Invalid subject QR code format' });
        }
        
        // Last part is the subject code, everything else is the subject name
        const subjectCode = parts[parts.length - 1];
        const subjectName = parts.slice(0, -1).join(' ').replace(/_/g, ' ');
        
        console.log('SUBJECT_ - Parsed subject name:', subjectName.trim());
        console.log('SUBJECT_ - Parsed subject code:', subjectCode.trim());
        
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName.trim(), subjectCode.trim()]
        );
        if (subjectResult.rows.length === 0) {
          console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
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
      } else if (qrCode.startsWith("ATTENDANCE_OUT_")) {
        // SCAN-OUT logic (old format with underscores)
        console.log('Processing ATTENDANCE_OUT_ QR code:', qrCode);
        console.log('QR code starts with ATTENDANCE_OUT_:', qrCode.startsWith("ATTENDANCE_OUT_"));
        console.log('QR code length:', qrCode.length);
        console.log('QR code first 30 chars:', qrCode.substring(0, 30));
        
        // Try multiple parsing approaches
        let subjectName, subjectCode, date;
        
        // Method 1: Standard parsing
        const attendanceInfo = qrCode.replace("ATTENDANCE_OUT_", "").trim();
        const parts = attendanceInfo.split('_');
        console.log('After removing ATTENDANCE_OUT_:', attendanceInfo);
        console.log('Split parts:', parts);
        
        if (parts.length >= 3) {
          date = parts[parts.length - 1];
          subjectCode = parts[parts.length - 2];
          subjectName = parts.slice(0, -2).join(' ').replace(/_/g, ' ');
        } else {
          console.log('Invalid format - parts length:', parts.length);
          console.log('Parts:', parts);
          return res.status(400).json({ error: 'Invalid attendance QR code format' });
        }
        
        console.log('Method 1 - Parsed subject name:', subjectName.trim());
        console.log('Method 1 - Parsed subject code:', subjectCode.trim());
        console.log('Method 1 - Parsed date:', date.trim());
        
        // Method 2: If subject name includes "OUT", try removing it
        if (subjectName.trim().includes('OUT')) {
          console.log('Subject name includes "OUT", trying Method 2...');
          const alternativeSubjectName = subjectName.trim().replace(/OUT\s+/i, '').trim();
          console.log('Method 2 - Alternative subject name:', alternativeSubjectName);
          
          // Try to find subject with alternative name
          const alternativeResult = await pool.query(
            'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
            [alternativeSubjectName, subjectCode.trim()]
          );
          
          if (alternativeResult.rows.length > 0) {
            console.log('Found subject with Method 2!');
            subjectName = alternativeSubjectName;
          }
        }
        
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName.trim(), subjectCode.trim()]
        );
        console.log('Final parsed subject name:', subjectName.trim());
        console.log('Final parsed subject code:', subjectCode.trim());
        console.log('Subject query result (scan-out old format):', subjectResult.rows);
        console.log('Looking for subject with name:', subjectName.trim(), 'and code:', subjectCode.trim());
        
        if (subjectResult.rows.length === 0) {
          console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
          
          // Let's also check what subjects exist in the database
          const allSubjects = await pool.query('SELECT name, code FROM subjects');
          console.log('All subjects in database:', allSubjects.rows);
          
          // Let's also try a case-insensitive search
          const caseInsensitiveResult = await pool.query(
            'SELECT id FROM subjects WHERE LOWER(TRIM(name)) = LOWER($1) AND LOWER(TRIM(code)) = LOWER($2)',
            [subjectName.trim(), subjectCode.trim()]
          );
          console.log('Case-insensitive query result:', caseInsensitiveResult.rows);
          
          // Try alternative parsing if the subject name includes "OUT"
          if (subjectName.trim().includes('OUT')) {
            console.log('Subject name includes "OUT", trying alternative parsing...');
            const alternativeSubjectName = subjectName.trim().replace(/OUT\s+/i, '').trim();
            console.log('Alternative subject name:', alternativeSubjectName);
            
            const alternativeResult = await pool.query(
              'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
              [alternativeSubjectName, subjectCode.trim()]
            );
            console.log('Alternative query result:', alternativeResult.rows);
            
            if (alternativeResult.rows.length > 0) {
              console.log('Found subject with alternative parsing!');
              const subjectId = alternativeResult.rows[0].id;
              // Continue with the rest of the logic using this subjectId
              // ... (we'll need to handle this case)
            }
          }
          
          return res.status(404).json({ error: 'Subject not found' });
        }
        const subjectId = subjectResult.rows[0].id;
        const sessionResult = await pool.query(
          'SELECT id FROM attendance_sessions WHERE subject_id = $1 AND is_active = true ORDER BY session_date DESC, session_time DESC LIMIT 1',
          [subjectId]
        );
        console.log('Session query result (scan-out old format):', sessionResult.rows);
        console.log('Looking for active sessions for subject ID:', subjectId);
        
        if (sessionResult.rows.length === 0) {
          console.log('No active session found for subject ID:', subjectId);
          
          // Let's also check what sessions exist for this subject
          const allSessions = await pool.query('SELECT id, is_active, session_date FROM attendance_sessions WHERE subject_id = $1', [subjectId]);
          console.log('All sessions for this subject:', allSessions.rows);
          
          return res.status(404).json({ 
            type: 'attendance',
            message: 'No active attendance session found for this subject',
            success: false 
          });
        }
        const sessionId = sessionResult.rows[0].id;
        const recordResult = await pool.query(
          'SELECT id, check_in_time, status, check_out_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
          [sessionId, studentId]
        );
        console.log('Record query result (scan-out old format):', recordResult.rows);
        console.log('Looking for attendance records for session ID:', sessionId, 'and student ID:', studentId);
        
        if (recordResult.rows.length === 0) {
          console.log('No scan-in record found for session ID:', sessionId, 'and student ID:', studentId);
          
          // Let's also check what records exist for this session
          const allRecords = await pool.query('SELECT student_id, status FROM attendance_records WHERE session_id = $1', [sessionId]);
          console.log('All records for this session:', allRecords.rows);
          
          return res.status(404).json({ 
            type: 'attendance',
            message: 'No scan-in record found. Please scan in first.',
            success: false 
          });
        }
        const record = recordResult.rows[0];
        if (record.check_out_time) {
          return res.status(409).json({
            type: 'attendance',
            message: 'Already scanned out for this session.',
            success: false
          });
        }
        if (record.status === 'present' || record.status === 'late') {
          await pool.query(
            'UPDATE attendance_records SET check_out_time = NOW() WHERE id = $1',
            [record.id]
          );
          return res.json({
            type: 'attendance',
            message: 'Scan-out successful. Your attendance is confirmed.',
            success: true
          });
        }
        if (record.status === 'pending') {
          const sessionData = await pool.query(
            'SELECT s.session_time, s.session_date, sub.late_threshold, sub.start_time FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
            [sessionId]
          );
          const session = sessionData.rows[0];
          const lateThreshold = session.late_threshold || 15;
          const scheduledStartTime = new Date(`${session.session_date}T${session.start_time}`);
          const checkInTime = new Date(record.check_in_time);
          const timeDifference = (checkInTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60);
          let attendanceStatus = 'present';
          if (timeDifference > lateThreshold) {
            attendanceStatus = 'late';
          }
          await pool.query(
            'UPDATE attendance_records SET check_out_time = NOW(), status = $1 WHERE id = $2',
            [attendanceStatus, record.id]
          );
        }
        return res.json({
          type: 'attendance',
          message: 'Scan-out successful. Your attendance is confirmed.',
          success: true
        });

      } else if (qrCode.startsWith("ATTENDANCE_")) {
        // SCAN-IN logic (old format with underscores)
        const attendanceInfo = qrCode.replace("ATTENDANCE_", "").trim();
        const parts = attendanceInfo.split('_');
        if (parts.length < 3) {
          return res.status(400).json({ error: 'Invalid attendance QR code format' });
        }
        const date = parts[parts.length - 1];
        const subjectCode = parts[parts.length - 2];
        const subjectName = parts.slice(0, -2).join(' ').replace(/_/g, ' ');
        
        console.log('Scan-in QR Code (old format):', qrCode);
        console.log('Parsed subject name:', subjectName.trim());
        console.log('Parsed subject code:', subjectCode.trim());
        console.log('Parsed date:', date.trim());
        
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName.trim(), subjectCode.trim()]
        );
        if (subjectResult.rows.length === 0) {
          console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
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
          'SELECT id, status, check_in_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
          [sessionId, studentId]
        );
        if (attendanceCheck.rows.length > 0) {
          const existingRecord = attendanceCheck.rows[0];
          if (['present', 'late', 'absent'].includes(existingRecord.status)) {
            return res.status(409).json({ 
              type: 'attendance',
              message: 'Already scanned in for this session. Please scan out at the end of class.',
              success: false 
            });
          }
          if (existingRecord.status === 'pending') {
            return res.json({
              type: 'attendance',
              message: 'Already scanned in for this session. Please scan out at the end of class.',
              success: false
            });
          }
        }
        
        // Calculate late status immediately upon check-in
        const session = sessionResult.rows[0];
        const sessionStartTime = new Date(`${session.session_date}T${session.session_time}`);
        const checkInTime = new Date();
        const timeDifference = (checkInTime - sessionStartTime) / (1000 * 60);
        
        // Get subject late threshold
        const subjectData = await pool.query(
          'SELECT late_threshold FROM subjects WHERE id = $1',
          [subjectId]
        );
        
        const lateThreshold = subjectData.rows[0]?.late_threshold || 15;
        let isLate = false;
        
        console.log(`QR scan-in (old format) calculation for student ${studentId}:`);
        console.log(`  - session_date: ${session.session_date}`);
        console.log(`  - session_time: ${session.session_time}`);
        console.log(`  - session_start_time: ${sessionStartTime}`);
        console.log(`  - check_in_time: ${checkInTime}`);
        console.log(`  - time_difference: ${timeDifference} minutes`);
        console.log(`  - late_threshold: ${lateThreshold} minutes`);
        
        if (timeDifference > lateThreshold) {
          isLate = true;
          console.log(`  - RESULT: Student is LATE (${timeDifference} > ${lateThreshold})`);
        } else {
          console.log(`  - RESULT: Student is ON TIME (${timeDifference} <= ${lateThreshold})`);
        }
        
        // Mark attendance as pending with late status immediately
        console.log(`Inserting attendance record with is_late = ${isLate} (type: ${typeof isLate})`);
        await pool.query(
          'INSERT INTO attendance_records (session_id, student_id, status, check_in_time, is_late) VALUES ($1, $2, $3, NOW(), $4)',
          [sessionId, studentId, 'pending', Boolean(isLate)]
        );
        
        return res.json({
          type: 'attendance',
          message: 'Scan-in successful. Please scan out at the end of class to confirm your attendance.',
          success: true
        });
      } else if (qrCode.startsWith("ATTENDANCE:")) {
        // SCAN-IN logic (new format)
        const attendanceInfo = qrCode.replace("ATTENDANCE:", "").trim();
        // Parse format: "Data Structures (CS201) - 2024-01-15"
        const match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$/);
        if (!match) {
          return res.status(400).json({ error: 'Invalid attendance QR code format' });
        }
        const [, subjectName, subjectCode, date] = match;
        
        // Debug logging
        console.log('Scan-in QR Code:', qrCode);
        console.log('Parsed subject name:', subjectName.trim());
        console.log('Parsed subject code:', subjectCode.trim());
        console.log('Parsed date:', date.trim());
        
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName.trim(), subjectCode.trim()]
        );
        if (subjectResult.rows.length === 0) {
          console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
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
        // Check if already scanned in - enhanced duplicate prevention
        const attendanceCheck = await pool.query(
          'SELECT id, status, check_in_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
          [sessionId, studentId]
        );
        if (attendanceCheck.rows.length > 0) {
          const existingRecord = attendanceCheck.rows[0];
          
          // If already has a final status, don't allow scan-in
          if (['present', 'late', 'absent'].includes(existingRecord.status)) {
          return res.status(409).json({ 
            type: 'attendance',
            message: 'Already scanned in for this session. Please scan out at the end of class.',
            success: false 
          });
        }
          
          // If pending status, just return error (already scanned in)
          if (existingRecord.status === 'pending') {
            return res.json({
              type: 'attendance',
              message: 'Already scanned in for this session. Please scan out at the end of class.',
              success: false
            });
          }
        }
        
        // Calculate late status immediately upon check-in
        const session = sessionResult.rows[0];
        const sessionStartTime = new Date(`${session.session_date}T${session.session_time}`);
        const checkInTime = new Date();
        const timeDifference = (checkInTime - sessionStartTime) / (1000 * 60);
        
        // Get subject late threshold
        const subjectData = await pool.query(
          'SELECT late_threshold FROM subjects WHERE id = $1',
          [subjectId]
        );
        
        const lateThreshold = subjectData.rows[0]?.late_threshold || 15;
        let isLate = false;
        
        console.log(`QR scan-in (new format) calculation for student ${studentId}:`);
        console.log(`  - session_date: ${session.session_date}`);
        console.log(`  - session_time: ${session.session_time}`);
        console.log(`  - session_start_time: ${sessionStartTime}`);
        console.log(`  - check_in_time: ${checkInTime}`);
        console.log(`  - time_difference: ${timeDifference} minutes`);
        console.log(`  - late_threshold: ${lateThreshold} minutes`);
        
        if (timeDifference > lateThreshold) {
          isLate = true;
          console.log(`  - RESULT: Student is LATE (${timeDifference} > ${lateThreshold})`);
        } else {
          console.log(`  - RESULT: Student is ON TIME (${timeDifference} <= ${lateThreshold})`);
        }
        
        // Mark attendance as pending with late status immediately
        console.log(`Inserting attendance record with is_late = ${isLate} (type: ${typeof isLate})`);
        await pool.query(
          'INSERT INTO attendance_records (session_id, student_id, status, check_in_time, is_late) VALUES ($1, $2, $3, NOW(), $4)',
          [sessionId, studentId, 'pending', Boolean(isLate)]
        );
        
        return res.json({
          type: 'attendance',
          message: 'Scan-in successful. Please scan out at the end of class to confirm your attendance.',
          success: true
        });
      } else if (qrCode.startsWith("ATTENDANCE_OUT_")) {
        // SCAN-OUT logic (old format with underscores)
        console.log('Processing ATTENDANCE_OUT_ QR code:', qrCode);
        console.log('QR code starts with ATTENDANCE_OUT_:', qrCode.startsWith("ATTENDANCE_OUT_"));
        console.log('QR code length:', qrCode.length);
        console.log('QR code first 30 chars:', qrCode.substring(0, 30));
        
        // Try multiple parsing approaches
        let subjectName, subjectCode, date;
        
        // Method 1: Standard parsing
        const attendanceInfo = qrCode.replace("ATTENDANCE_OUT_", "").trim();
        const parts = attendanceInfo.split('_');
        console.log('After removing ATTENDANCE_OUT_:', attendanceInfo);
        console.log('Split parts:', parts);
        
        if (parts.length >= 3) {
          date = parts[parts.length - 1];
          subjectCode = parts[parts.length - 2];
          subjectName = parts.slice(0, -2).join(' ').replace(/_/g, ' ');
        } else {
          console.log('Invalid format - parts length:', parts.length);
          console.log('Parts:', parts);
          return res.status(400).json({ error: 'Invalid attendance QR code format' });
        }
        
        console.log('Method 1 - Parsed subject name:', subjectName.trim());
        console.log('Method 1 - Parsed subject code:', subjectCode.trim());
        console.log('Method 1 - Parsed date:', date.trim());
        
        // Method 2: If subject name includes "OUT", try removing it
        if (subjectName.trim().includes('OUT')) {
          console.log('Subject name includes "OUT", trying Method 2...');
          const alternativeSubjectName = subjectName.trim().replace(/OUT\s+/i, '').trim();
          console.log('Method 2 - Alternative subject name:', alternativeSubjectName);
          
          // Try to find subject with alternative name
          const alternativeResult = await pool.query(
            'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
            [alternativeSubjectName, subjectCode.trim()]
          );
          
          if (alternativeResult.rows.length > 0) {
            console.log('Found subject with Method 2!');
            subjectName = alternativeSubjectName;
          }
        }
        
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName.trim(), subjectCode.trim()]
        );
        console.log('Final parsed subject name:', subjectName.trim());
        console.log('Final parsed subject code:', subjectCode.trim());
        console.log('Subject query result (scan-out old format):', subjectResult.rows);
        console.log('Looking for subject with name:', subjectName.trim(), 'and code:', subjectCode.trim());
        
        if (subjectResult.rows.length === 0) {
          console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
          
          // Let's also check what subjects exist in the database
          const allSubjects = await pool.query('SELECT name, code FROM subjects');
          console.log('All subjects in database:', allSubjects.rows);
          
          // Let's also try a case-insensitive search
          const caseInsensitiveResult = await pool.query(
            'SELECT id FROM subjects WHERE LOWER(TRIM(name)) = LOWER($1) AND LOWER(TRIM(code)) = LOWER($2)',
            [subjectName.trim(), subjectCode.trim()]
          );
          console.log('Case-insensitive query result:', caseInsensitiveResult.rows);
          
          // Try alternative parsing if the subject name includes "OUT"
          if (subjectName.trim().includes('OUT')) {
            console.log('Subject name includes "OUT", trying alternative parsing...');
            const alternativeSubjectName = subjectName.trim().replace(/OUT\s+/i, '').trim();
            console.log('Alternative subject name:', alternativeSubjectName);
            
            const alternativeResult = await pool.query(
              'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
              [alternativeSubjectName, subjectCode.trim()]
            );
            console.log('Alternative query result:', alternativeResult.rows);
            
            if (alternativeResult.rows.length > 0) {
              console.log('Found subject with alternative parsing!');
              const subjectId = alternativeResult.rows[0].id;
              // Continue with the rest of the logic using this subjectId
              // ... (we'll need to handle this case)
            }
          }
          
          return res.status(404).json({ error: 'Subject not found' });
        }
        const subjectId = subjectResult.rows[0].id;
        const sessionResult = await pool.query(
          'SELECT id FROM attendance_sessions WHERE subject_id = $1 AND is_active = true ORDER BY session_date DESC, session_time DESC LIMIT 1',
          [subjectId]
        );
        console.log('Session query result (scan-out old format):', sessionResult.rows);
        console.log('Looking for active sessions for subject ID:', subjectId);
        
        if (sessionResult.rows.length === 0) {
          console.log('No active session found for subject ID:', subjectId);
          
          // Let's also check what sessions exist for this subject
          const allSessions = await pool.query('SELECT id, is_active, session_date FROM attendance_sessions WHERE subject_id = $1', [subjectId]);
          console.log('All sessions for this subject:', allSessions.rows);
          
          return res.status(404).json({ 
            type: 'attendance',
            message: 'No active attendance session found for this subject',
            success: false 
          });
        }
        const sessionId = sessionResult.rows[0].id;
        const recordResult = await pool.query(
          'SELECT id, check_in_time, status, check_out_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
          [sessionId, studentId]
        );
        console.log('Record query result (scan-out old format):', recordResult.rows);
        console.log('Looking for attendance records for session ID:', sessionId, 'and student ID:', studentId);
        
        if (recordResult.rows.length === 0) {
          console.log('No scan-in record found for session ID:', sessionId, 'and student ID:', studentId);
          
          // Let's also check what records exist for this session
          const allRecords = await pool.query('SELECT student_id, status FROM attendance_records WHERE session_id = $1', [sessionId]);
          console.log('All records for this session:', allRecords.rows);
          
          return res.status(404).json({ 
            type: 'attendance',
            message: 'No scan-in record found. Please scan in first.',
            success: false 
          });
        }
        const record = recordResult.rows[0];
        if (record.check_out_time) {
          return res.status(409).json({
            type: 'attendance',
            message: 'Already scanned out for this session.',
            success: false
          });
        }
        if (record.status === 'present' || record.status === 'late') {
          await pool.query(
            'UPDATE attendance_records SET check_out_time = NOW() WHERE id = $1',
            [record.id]
          );
          return res.json({
            type: 'attendance',
            message: 'Scan-out successful. Your attendance is confirmed.',
            success: true
          });
        }
        if (record.status === 'pending') {
          const sessionData = await pool.query(
            'SELECT s.session_time, s.session_date, sub.late_threshold, sub.start_time FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
            [sessionId]
          );
          const session = sessionData.rows[0];
          const lateThreshold = session.late_threshold || 15;
          const scheduledStartTime = new Date(`${session.session_date}T${session.start_time}`);
          const checkInTime = new Date(record.check_in_time);
          const timeDifference = (checkInTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60);
          let attendanceStatus = 'present';
          if (timeDifference > lateThreshold) {
            attendanceStatus = 'late';
          }
          await pool.query(
            'UPDATE attendance_records SET check_out_time = NOW(), status = $1 WHERE id = $2',
            [attendanceStatus, record.id]
          );
        }
        return res.json({
          type: 'attendance',
          message: 'Scan-out successful. Your attendance is confirmed.',
          success: true
        });

      } else if (qrCode.includes("OUT") && qrCode.includes("Sample_Sub") && qrCode.includes("1001234")) {
        // Fallback for different QR code formats that contain OUT and the subject info
        console.log('Processing fallback OUT QR code:', qrCode);
        
        // Try to extract subject info from various formats
        let subjectName = "Sample Sub";
        let subjectCode = "1001234";
        let date = "2025-07-29"; // Default date
        
        // Try to extract date if present
        const dateMatch = qrCode.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          date = dateMatch[1];
        }
        
        console.log('Fallback parsing - Subject name:', subjectName);
        console.log('Fallback parsing - Subject code:', subjectCode);
        console.log('Fallback parsing - Date:', date);
        
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName, subjectCode]
        );
        console.log('Fallback subject query result:', subjectResult.rows);
        
        if (subjectResult.rows.length > 0) {
          console.log('Found subject with fallback parsing!');
          const subjectId = subjectResult.rows[0].id;
          
          // Continue with session and record logic
          const sessionResult = await pool.query(
            'SELECT id FROM attendance_sessions WHERE subject_id = $1 AND is_active = true ORDER BY session_date DESC, session_time DESC LIMIT 1',
            [subjectId]
          );
          console.log('Fallback session query result:', sessionResult.rows);
          
          if (sessionResult.rows.length === 0) {
            return res.status(404).json({ 
              type: 'attendance',
              message: 'No active attendance session found for this subject',
              success: false 
            });
          }
          
          const sessionId = sessionResult.rows[0].id;
          const recordResult = await pool.query(
            'SELECT id, check_in_time, status, check_out_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
            [sessionId, studentId]
          );
          console.log('Fallback record query result:', recordResult.rows);
          
          if (recordResult.rows.length === 0) {
            return res.status(404).json({ 
              type: 'attendance',
              message: 'No scan-in record found. Please scan in first.',
              success: false 
            });
          }
          
          const record = recordResult.rows[0];
          if (record.check_out_time) {
            return res.status(409).json({
              type: 'attendance',
              message: 'Already scanned out for this session.',
              success: false
            });
          }
          
          // Process scan-out
          if (record.status === 'present' || record.status === 'late') {
            await pool.query(
              'UPDATE attendance_records SET check_out_time = NOW() WHERE id = $1',
              [record.id]
            );
            return res.json({
              type: 'attendance',
              message: 'Scan-out successful. Your attendance is confirmed.',
              success: true
            });
          }
          
          if (record.status === 'pending') {
            const sessionData = await pool.query(
              'SELECT s.session_time, s.session_date, sub.late_threshold, sub.start_time FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
              [sessionId]
            );
            const session = sessionData.rows[0];
            const lateThreshold = session.late_threshold || 15;
            const scheduledStartTime = new Date(`${session.session_date}T${session.start_time}`);
            const checkInTime = new Date(record.check_in_time);
            const timeDifference = (checkInTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60);
            let attendanceStatus = 'present';
            if (timeDifference > lateThreshold) {
              attendanceStatus = 'late';
            }
            await pool.query(
              'UPDATE attendance_records SET check_out_time = NOW(), status = $1 WHERE id = $2',
              [attendanceStatus, record.id]
            );
          }
          
          return res.json({
            type: 'attendance',
            message: 'Scan-out successful. Your attendance is confirmed.',
            success: true
          });
        } else {
          console.log('Subject not found with fallback parsing');
          return res.status(404).json({ error: 'Subject not found' });
        }

      } else {
        // Try with trimmed QR code as fallback
        const trimmedQrCode = qrCode.trim();
        console.log('Trying with trimmed QR code:', trimmedQrCode);
        
        if (trimmedQrCode.startsWith("SUBJECT:")) {
          // Handle subject enrollment with trimmed code
          const subjectInfo = trimmedQrCode.replace("SUBJECT:", "").trim();
          const match = subjectInfo.match(/^(.+?)\s*\(([^)]+)\)$/);
          if (!match) {
            return res.status(400).json({ error: 'Invalid subject QR code format' });
          }
          const [, subjectName, subjectCode] = match;
          
          console.log('Subject QR Code (trimmed):', trimmedQrCode);
          console.log('Parsed subject name:', subjectName.trim());
          console.log('Parsed subject code:', subjectCode.trim());
          
          const subjectResult = await pool.query(
            'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
            [subjectName.trim(), subjectCode.trim()]
          );
          if (subjectResult.rows.length === 0) {
            console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
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
        } else if (trimmedQrCode.startsWith("ATTENDANCE:")) {
          // Handle scan-in with trimmed code
          const attendanceInfo = trimmedQrCode.replace("ATTENDANCE:", "").trim();
          const match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$/);
        if (!match) {
          return res.status(400).json({ error: 'Invalid attendance QR code format' });
        }
          const [, subjectName, subjectCode, date] = match;
          
          console.log('Scan-in QR Code (trimmed):', trimmedQrCode);
          console.log('Parsed subject name:', subjectName.trim());
          console.log('Parsed subject code:', subjectCode.trim());
          console.log('Parsed date:', date.trim());
          
          const subjectResult = await pool.query(
            'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
            [subjectName.trim(), subjectCode.trim()]
          );
          if (subjectResult.rows.length === 0) {
            console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
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
            'SELECT id, status, check_in_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
            [sessionId, studentId]
          );
          if (attendanceCheck.rows.length > 0) {
            const existingRecord = attendanceCheck.rows[0];
            if (['present', 'late', 'absent'].includes(existingRecord.status)) {
              return res.status(409).json({ 
                type: 'attendance',
                message: 'Already scanned in for this session. Please scan out at the end of class.',
                success: false 
              });
            }
            if (existingRecord.status === 'pending') {
              return res.json({
                type: 'attendance',
                message: 'Already scanned in for this session. Please scan out at the end of class.',
                success: true
              });
            }
          }
          await pool.query(
            'INSERT INTO attendance_records (session_id, student_id, status, check_in_time) VALUES ($1, $2, $3, NOW())',
            [sessionId, studentId, 'pending']
          );
          return res.json({
            type: 'attendance',
            message: 'Scan-in successful. Please scan out at the end of class to confirm your attendance.',
            success: true
          });
                 
        }
        
        // Final fallback - try to detect QR code type by content
        console.log('Trying content-based detection...');
        const lowerQrCode = qrCode.toLowerCase();
        
        if (lowerQrCode.includes('subject') || lowerQrCode.includes('enroll')) {
          console.log('Detected as subject enrollment QR code');
          // Handle as subject enrollment
          const subjectInfo = qrCode.replace(/^.*?subject[:\s]*/i, "").trim();
          const match = subjectInfo.match(/^(.+?)\s*\(([^)]+)\)/);
          if (match) {
        const [, subjectName, subjectCode] = match;
            console.log('Parsed subject name:', subjectName.trim());
            console.log('Parsed subject code:', subjectCode.trim());
            
        const subjectResult = await pool.query(
          'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
          [subjectName.trim(), subjectCode.trim()]
        );
        if (subjectResult.rows.length === 0) {
              console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
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
          }
        } else if (lowerQrCode.includes('attendance') || lowerQrCode.includes('scan')) {
          console.log('Detected as attendance QR code');
          // Handle as attendance QR code
          const attendanceInfo = qrCode.replace(/^.*?attendance[:\s]*/i, "").trim();
          const match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)\s*[-]\s*(.+)$/);
          if (match) {
            const [, subjectName, subjectCode, date] = match;
            console.log('Parsed subject name:', subjectName.trim());
            console.log('Parsed subject code:', subjectCode.trim());
            console.log('Parsed date:', date.trim());
            
            const subjectResult = await pool.query(
              'SELECT id FROM subjects WHERE TRIM(name) = $1 AND TRIM(code) = $2',
              [subjectName.trim(), subjectCode.trim()]
            );
            if (subjectResult.rows.length === 0) {
              console.log('Subject not found for:', subjectName.trim(), subjectCode.trim());
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
        const recordResult = await pool.query(
              'SELECT id, check_in_time, status, check_out_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
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
            if (record.check_out_time) {
              return res.status(409).json({
                type: 'attendance',
                message: 'Already scanned out for this session.',
                success: false
              });
            }
            if (record.status === 'present' || record.status === 'late') {
              await pool.query(
                'UPDATE attendance_records SET check_out_time = NOW() WHERE id = $1',
                [record.id]
              );
              return res.json({
                type: 'attendance',
                message: 'Scan-out successful. Your attendance is confirmed.',
                success: true
              });
            }
            if (record.status === 'pending') {
        const sessionData = await pool.query(
                'SELECT s.session_time, s.session_date, sub.late_threshold, sub.start_time FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
          [sessionId]
        );
        const session = sessionData.rows[0];
        const lateThreshold = session.late_threshold || 15;
              const scheduledStartTime = new Date(`${session.session_date}T${session.start_time}`);
        const checkInTime = new Date(record.check_in_time);
              const timeDifference = (checkInTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60);
        let attendanceStatus = 'present';
        if (timeDifference > lateThreshold) {
          attendanceStatus = 'late';
        }
        await pool.query(
          'UPDATE attendance_records SET check_out_time = NOW(), status = $1 WHERE id = $2',
          [attendanceStatus, record.id]
        );
            }
        return res.json({
          type: 'attendance',
          message: 'Scan-out successful. Your attendance is confirmed.',
          success: true
        });
          }
        }
        
        console.log('QR code could not be parsed with any method');
        console.log('Full QR code content:', qrCode);
        console.log('QR code character codes:', Array.from(qrCode).map(c => `${c}:${c.charCodeAt(0)}`));
        
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
      console.log('Manual code submission:', { code, studentId });
      
      // Find unused code
      const result = await pool.query(
        'SELECT id, session_id, type, used FROM manual_attendance_codes WHERE code = $1 AND used = false',
        [code]
      );
      
      console.log('Manual code lookup result:', result.rows);
      
      if (result.rows.length === 0) {
        // Check if code exists but is used
        const usedCodeCheck = await pool.query(
          'SELECT id, used FROM manual_attendance_codes WHERE code = $1',
          [code]
        );
        if (usedCodeCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Code has already been used' });
        }
        return res.status(404).json({ error: 'Invalid code' });
      }
      const manualCode = result.rows[0];
      // Mark code as used
      await pool.query(
        'UPDATE manual_attendance_codes SET used = true WHERE id = $1',
        [manualCode.id]
      );
      // Mark attendance (in or out)
      if (manualCode.type === 'in') {
        // Check if already scanned in
        const attendanceCheck = await pool.query(
          'SELECT id, status FROM attendance_records WHERE session_id = $1 AND student_id = $2',
          [manualCode.session_id, studentId]
        );
        
        if (attendanceCheck.rows.length > 0) {
          const existingRecord = attendanceCheck.rows[0];
          // If already has a final status (present/late/absent), don't allow scan-in
          if (['present', 'late', 'absent'].includes(existingRecord.status)) {
          return res.status(409).json({ error: 'Already scanned in for this session' });
        }
          // If pending, update to mark as scanned in again
          if (existingRecord.status === 'pending') {
            return res.json({ message: 'Already scanned in for this session. Please scan out when class ends.' });
          }
        }
        
        // Calculate late status immediately upon check-in
        const sessionData = await pool.query(
          'SELECT s.session_date, s.session_time, sub.late_threshold FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
          [manualCode.session_id]
        );
        
        if (sessionData.rows.length === 0) {
          return res.status(404).json({ error: 'Session not found' });
        }
        
        const session = sessionData.rows[0];
        const sessionStartTime = new Date(`${session.session_date}T${session.session_time}`);
        const checkInTime = new Date();
        const timeDifference = (checkInTime - sessionStartTime) / (1000 * 60);
        const lateThreshold = session.late_threshold || 15;
        
        let isLate = false;
        if (timeDifference > lateThreshold) {
          isLate = true;
          console.log(`Manual scan-in: Student ${studentId} is LATE: ${timeDifference} minutes > ${lateThreshold} threshold`);
        } else {
          console.log(`Manual scan-in: Student ${studentId} is ON TIME: ${timeDifference} minutes <= ${lateThreshold} threshold`);
        }
        
        // Insert new attendance record with late status
        try {
        console.log(`Manual scan-in: Inserting with is_late = ${isLate} (type: ${typeof isLate})`);
        await pool.query(
          'INSERT INTO attendance_records (session_id, student_id, status, check_in_time, is_late) VALUES ($1, $2, $3, NOW(), $4)',
          [manualCode.session_id, studentId, 'pending', Boolean(isLate)]
        );
          console.log('Attendance record created successfully for student:', studentId, 'session:', manualCode.session_id);
          return res.json({ 
            message: 'Manual scan-in successful. Please scan out or ask for a manual code at the end of class.',
            success: true 
          });
        } catch (insertError) {
          console.error('Error creating attendance record:', insertError);
          return res.status(500).json({ error: 'Failed to create attendance record', details: insertError.message });
        }
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
        const sessionStartTime = new Date(`${session.session_date}T${session.session_time}`);
        const checkInTime = new Date(record.check_in_time);
        const timeDifference = (checkInTime - sessionStartTime) / (1000 * 60);
        
        let attendanceStatus = 'present';
        let isLate = false;
        
        if (timeDifference > lateThreshold) {
          attendanceStatus = 'late';
          isLate = true;
          console.log(`Manual scan-out: Student ${studentId} is LATE: ${timeDifference} minutes > ${lateThreshold} threshold`);
        } else {
          console.log(`Manual scan-out: Student ${studentId} is ON TIME: ${timeDifference} minutes <= ${lateThreshold} threshold`);
        }
        
        // Update record with check_out_time, final status, and is_late flag
        console.log(`Manual scan-out: Updating with is_late = ${isLate} (type: ${typeof isLate})`);
        await pool.query(
          'UPDATE attendance_records SET check_out_time = NOW(), status = $1, is_late = $2 WHERE id = $3',
          [attendanceStatus, Boolean(isLate), record.id]
        );
        return res.json({ message: 'Manual scan-out successful. Your attendance is confirmed.' });
      } else {
        return res.status(400).json({ error: 'Invalid code type' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to process manual code', details: err.message });
    }
  }

  // Manual attendance update (teacher) - Enhanced with pending status and time tracking
  if (route === 'manual-attendance-update' && req.method === 'POST') {
    const { sessionId, studentId, status } = req.body;
    if (!sessionId || !studentId || !['present', 'late', 'absent', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Missing or invalid sessionId, studentId, or status' });
    }
    try {
      // Check if record exists
      const result = await pool.query(
        'SELECT id, status, check_in_time, check_out_time FROM attendance_records WHERE session_id = $1 AND student_id = $2',
        [sessionId, studentId]
      );
      
      if (result.rows.length > 0) {
        const existingRecord = result.rows[0];
        
        if (status === 'pending') {
          // Set pending status with check-in time if not already set
          if (!existingRecord.check_in_time) {
            // Calculate late status for new check-in
            const sessionData = await pool.query(
              'SELECT s.session_date, s.session_time, sub.late_threshold FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
              [sessionId]
            );
            
            if (sessionData.rows.length > 0) {
              const session = sessionData.rows[0];
              const sessionStartTime = new Date(`${session.session_date}T${session.session_time}`);
              const checkInTime = new Date();
              const timeDifference = (checkInTime - sessionStartTime) / (1000 * 60);
              const lateThreshold = session.late_threshold || 15;
              
              let isLate = false;
              if (timeDifference > lateThreshold) {
                isLate = true;
              }
              
              console.log(`Manual attendance update (pending): Updating with is_late = ${isLate} (type: ${typeof isLate})`);
              await pool.query(
                'UPDATE attendance_records SET status = $1, check_in_time = NOW(), is_late = $2 WHERE session_id = $3 AND student_id = $4',
                [status, Boolean(isLate), sessionId, studentId]
              );
            } else {
              await pool.query(
                'UPDATE attendance_records SET status = $1, check_in_time = NOW() WHERE session_id = $2 AND student_id = $3',
                [status, sessionId, studentId]
              );
            }
          } else {
        await pool.query(
          'UPDATE attendance_records SET status = $1 WHERE session_id = $2 AND student_id = $3',
          [status, sessionId, studentId]
        );
          }
        } else if (status === 'present' || status === 'late') {
          // Calculate late status based on check-in time and late threshold
          let finalStatus = status;
          
          if (existingRecord.check_in_time) {
            // Get session info for late threshold calculation
            const sessionData = await pool.query(
              'SELECT s.session_date, s.session_time, sub.late_threshold FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
              [sessionId]
            );
            
            if (sessionData.rows.length > 0) {
              const session = sessionData.rows[0];
              const lateThreshold = session.late_threshold || 15;
              const sessionStartTime = new Date(`${session.session_date}T${session.session_time}`);
              const checkInTime = new Date(existingRecord.check_in_time);
              const timeDifference = (checkInTime - sessionStartTime) / (1000 * 60);
              
              // Override status if check-in time indicates late
              if (timeDifference > lateThreshold) {
                finalStatus = 'late';
              } else {
                finalStatus = 'present';
              }
            }
          }
          
          // Set final status with check-out time and is_late flag
          const isLate = finalStatus === 'late';
          console.log(`Manual attendance update: Updating with is_late = ${isLate} (type: ${typeof isLate})`);
          await pool.query(
            'UPDATE attendance_records SET status = $1, check_out_time = NOW(), is_late = $2 WHERE session_id = $3 AND student_id = $4',
            [finalStatus, Boolean(isLate), sessionId, studentId]
          );
        } else if (status === 'absent') {
          // Set absent status (no check-out time)
          await pool.query(
            'UPDATE attendance_records SET status = $1 WHERE session_id = $2 AND student_id = $3',
            [status, sessionId, studentId]
          );
        }
      } else {
        // Insert new record with late calculation
        if (status === 'pending') {
          // Calculate late status for pending
          const sessionData = await pool.query(
            'SELECT s.session_date, s.session_time, sub.late_threshold FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
            [sessionId]
          );
          
          if (sessionData.rows.length > 0) {
            const session = sessionData.rows[0];
            const sessionStartTime = new Date(`${session.session_date}T${session.session_time}`);
            const checkInTime = new Date();
            const timeDifference = (checkInTime - sessionStartTime) / (1000 * 60);
            const lateThreshold = session.late_threshold || 15;
            
            let isLate = false;
            if (timeDifference > lateThreshold) {
              isLate = true;
            }
            
            console.log(`Manual attendance update: Inserting with is_late = ${isLate} (type: ${typeof isLate})`);
            await pool.query(
              'INSERT INTO attendance_records (session_id, student_id, status, check_in_time, is_late) VALUES ($1, $2, $3, NOW(), $4)',
              [sessionId, studentId, status, Boolean(isLate)]
            );
          } else {
            await pool.query(
              'INSERT INTO attendance_records (session_id, student_id, status, check_in_time) VALUES ($1, $2, $3, NOW())',
              [sessionId, studentId, status]
            );
          }
        } else if (status === 'present' || status === 'late') {
          await pool.query(
            'INSERT INTO attendance_records (session_id, student_id, status, check_in_time, check_out_time) VALUES ($1, $2, $3, NOW(), NOW())',
            [sessionId, studentId, status]
          );
        } else if (status === 'absent') {
          await pool.query(
            'INSERT INTO attendance_records (session_id, student_id, status) VALUES ($1, $2, $3)',
          [sessionId, studentId, status]
        );
      }
      }
      
      return res.json({ message: 'Attendance updated successfully.' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update attendance', details: err.message });
    }
  }

  // STOP SESSION: Enhanced with late status calculation based on check-in time and late threshold
  if (route === 'stop-session' && req.method === 'PUT') {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    try {
      // Get session and subject information for late threshold calculation
      const sessionInfo = await pool.query(`
        SELECT 
          s.session_date, 
          s.session_time, 
          s.start_time,
          sub.late_threshold,
          sub.name as subject_name
        FROM attendance_sessions s
        JOIN subjects sub ON s.subject_id = sub.id
        WHERE s.id = $1
      `, [sessionId]);
      
      if (sessionInfo.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const session = sessionInfo.rows[0];
      const lateThreshold = session.late_threshold || 15; // Default 15 minutes
      const scheduledStartTime = new Date(`${session.session_date}T${session.start_time}`);
      
      // Get all pending records for this session
      const pendingRecords = await pool.query(`
        SELECT 
          ar.id, 
          ar.student_id, 
          ar.check_in_time,
          u.name as student_name
        FROM attendance_records ar
        JOIN users u ON ar.student_id = u.id
        WHERE ar.session_id = $1 AND ar.status = 'pending'
      `, [sessionId]);
      
      let lateCount = 0;
      let presentCount = 0;
      
      // Process each pending record
      for (const record of pendingRecords.rows) {
        if (record.check_in_time) {
          const checkInTime = new Date(record.check_in_time);
          const timeDifference = (checkInTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60); // in minutes
          
          let finalStatus = 'present';
          if (timeDifference > lateThreshold) {
            finalStatus = 'late';
            lateCount++;
          } else {
            presentCount++;
          }
          
          // Update the record with final status and check-out time
      await pool.query(
            'UPDATE attendance_records SET status = $1, check_out_time = NOW() WHERE id = $2',
            [finalStatus, record.id]
          );
          
          console.log(`Student ${record.student_name} (ID: ${record.student_id}) marked as ${finalStatus}. Check-in: ${checkInTime.toLocaleTimeString()}, Scheduled: ${scheduledStartTime.toLocaleTimeString()}, Difference: ${timeDifference.toFixed(1)} minutes`);
        } else {
          // No check-in time, mark as absent
          await pool.query(
            'UPDATE attendance_records SET status = $1 WHERE id = $2',
            ['absent', record.id]
          );
        }
      }
      
      // Deactivate the session
      await pool.query(
        'UPDATE attendance_sessions SET is_active = false WHERE id = $1',
        [sessionId]
      );
      
      const message = `Session stopped for ${session.subject_name}. ${presentCount} students marked present, ${lateCount} students marked late.`;
      return res.json({ 
        message: message,
        summary: {
          present: presentCount,
          late: lateCount,
          total: pendingRecords.rows.length
        }
      });
    } catch (err) {
      console.error('Error stopping session:', err);
      return res.status(500).json({ error: 'Failed to stop session', details: err.message });
    }
  }

  // Get attendance for a specific session
  if (route === 'session-attendance' && req.method === 'GET') {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    try {
      const result = await pool.query(`
        SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.student_id, 
          ar.check_in_time, 
          ar.check_out_time,
          CASE 
            WHEN ar.status IS NULL THEN 'Not Scanned'
            WHEN ar.check_out_time IS NULL AND ar.status IN ('present', 'late') THEN 'pending'
            ELSE ar.status
          END as status
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        LEFT JOIN attendance_records ar ON ar.session_id = $1 AND ar.student_id = u.id
        WHERE e.subject_id = (SELECT subject_id FROM attendance_sessions WHERE id = $1)
        ORDER BY u.name
      `, [sessionId]);
      return res.json({ students: result.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch session attendance', details: err.message });
    }
  }

  // Remove student from subject (teacher)
  if (route === 'remove-student-from-subject' && req.method === 'DELETE') {
    const { subjectId, studentId } = req.body;
    if (!subjectId || !studentId) {
      return res.status(400).json({ error: 'Missing subjectId or studentId' });
    }
    try {
      await pool.query(
        'DELETE FROM enrollments WHERE subject_id = $1 AND student_id = $2',
        [subjectId, studentId]
      );
      return res.json({ message: 'Student removed from subject.' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to remove student', details: err.message });
    }
  }

  // Default: Not found
  return res.status(404).json({ error: 'Not found' });
} 