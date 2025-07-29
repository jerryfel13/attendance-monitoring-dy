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
    console.log('QR Code starts with ATTENDANCE_OUT:', qrCode.startsWith("ATTENDANCE_OUT:"));
    console.log('QR Code trimmed:', qrCode.trim());
    console.log('QR Code starts with ATTENDANCE_OUT (trimmed):', qrCode.trim().startsWith("ATTENDANCE_OUT:"));
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
      } else if (qrCode.startsWith("ATTENDANCE:")) {
        // SCAN-IN logic
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
          
          // If pending status, just return success (already scanned in)
          if (existingRecord.status === 'pending') {
            return res.json({
              type: 'attendance',
              message: 'Already scanned in for this session. Please scan out at the end of class.',
              success: true
            });
          }
        }
        
        // Mark attendance as pending initially (will be finalized on scan-out)
        await pool.query(
          'INSERT INTO attendance_records (session_id, student_id, status, check_in_time) VALUES ($1, $2, $3, NOW())',
          [sessionId, studentId, 'pending']
        );
        
        return res.json({
          type: 'attendance',
          message: 'Scan-in successful. Please scan out at the end of class to confirm your attendance.',
          success: true
        });
      } else if (qrCode.startsWith("ATTENDANCE_OUT:")) {
        // SCAN-OUT logic
        const attendanceInfo = qrCode.replace("ATTENDANCE_OUT:", "").trim();
        console.log('Attendance info after removing prefix:', attendanceInfo);
        
        // Parse format: "Data Structures (CS201) - 2024-01-15"
        // Try multiple regex patterns for flexibility
        let match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$/);
        console.log('Regex match result (pattern 1):', match);
        
        if (!match) {
          // Try alternative pattern with more flexible spacing
          match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)\s*[-]\s*(.+)$/);
          console.log('Regex match result (pattern 2):', match);
        }
        
        if (!match) {
          // Try pattern without strict spacing
          match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)\s*[-]\s*(.+)$/);
          console.log('Regex match result (pattern 3):', match);
        }
        
        if (!match) {
          console.log('Failed to parse QR code format. Expected: "Subject Name (Code) - Date"');
          console.log('Received:', attendanceInfo);
          console.log('QR code length:', attendanceInfo.length);
          console.log('QR code characters:', Array.from(attendanceInfo).map(c => c.charCodeAt(0)));
          return res.status(400).json({ error: 'Invalid attendance QR code format' });
        }
        const [, subjectName, subjectCode, date] = match;
        
        // Debug logging
        console.log('Scan-out QR Code:', qrCode);
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
        // Get scan-in record - enhanced duplicate prevention
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
        
        // Check if already scanned out
        if (record.check_out_time) {
          return res.status(409).json({
            type: 'attendance',
            message: 'Already scanned out for this session.',
            success: false
          });
        }
        
        // If the record already has a final status (present/late), don't recalculate
        if (record.status === 'present' || record.status === 'late') {
          // Just update check_out_time, keep existing status
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
        
        // Only recalculate status if it was 'pending' (for backward compatibility)
        if (record.status === 'pending') {
          // Get session info for late threshold
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
          // Update record with check_out_time and final status
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
                 } else if (trimmedQrCode.startsWith("ATTENDANCE_OUT:")) {
           // Handle scan-out with trimmed code
           const attendanceInfo = trimmedQrCode.replace("ATTENDANCE_OUT:", "").trim();
           console.log('Attendance info after removing prefix (trimmed):', attendanceInfo);
           
           // Try multiple regex patterns for flexibility
           let match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$/);
           console.log('Regex match result (trimmed, pattern 1):', match);
           
           if (!match) {
             // Try alternative pattern with more flexible spacing
             match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)\s*[-]\s*(.+)$/);
             console.log('Regex match result (trimmed, pattern 2):', match);
           }
           
           if (!match) {
             // Try pattern without strict spacing
             match = attendanceInfo.match(/^(.+?)\s*\(([^)]+)\)\s*[-]\s*(.+)$/);
             console.log('Regex match result (trimmed, pattern 3):', match);
           }
           
           if (!match) {
             console.log('Failed to parse QR code format (trimmed). Expected: "Subject Name (Code) - Date"');
             console.log('Received (trimmed):', attendanceInfo);
             console.log('QR code length (trimmed):', attendanceInfo.length);
             console.log('QR code characters (trimmed):', Array.from(attendanceInfo).map(c => c.charCodeAt(0)));
             return res.status(400).json({ error: 'Invalid attendance QR code format' });
           }
           const [, subjectName, subjectCode, date] = match;
          
          console.log('Scan-out QR Code (trimmed):', trimmedQrCode);
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
        
        // Insert new attendance record
        try {
          await pool.query(
            'INSERT INTO attendance_records (session_id, student_id, status, check_in_time) VALUES ($1, $2, $3, NOW())',
            [manualCode.session_id, studentId, 'pending']
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
          'SELECT s.session_time, s.session_date, sub.late_threshold, sub.start_time FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
          [manualCode.session_id]
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
            await pool.query(
              'UPDATE attendance_records SET status = $1, check_in_time = NOW() WHERE session_id = $2 AND student_id = $3',
              [status, sessionId, studentId]
            );
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
              'SELECT s.session_date, sub.late_threshold, sub.start_time FROM attendance_sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.id = $1',
              [sessionId]
            );
            
            if (sessionData.rows.length > 0) {
              const session = sessionData.rows[0];
              const lateThreshold = session.late_threshold || 15;
              const scheduledStartTime = new Date(`${session.session_date}T${session.start_time}`);
              const checkInTime = new Date(existingRecord.check_in_time);
              const timeDifference = (checkInTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60);
              
              // Override status if check-in time indicates late
              if (timeDifference > lateThreshold) {
                finalStatus = 'late';
              } else {
                finalStatus = 'present';
              }
            }
          }
          
          // Set final status with check-out time
          await pool.query(
            'UPDATE attendance_records SET status = $1, check_out_time = NOW() WHERE session_id = $2 AND student_id = $3',
            [finalStatus, sessionId, studentId]
          );
        } else if (status === 'absent') {
          // Set absent status (no check-out time)
          await pool.query(
            'UPDATE attendance_records SET status = $1 WHERE session_id = $2 AND student_id = $3',
            [status, sessionId, studentId]
          );
        }
      } else {
        // Insert new record
        if (status === 'pending') {
          await pool.query(
            'INSERT INTO attendance_records (session_id, student_id, status, check_in_time) VALUES ($1, $2, $3, NOW())',
            [sessionId, studentId, status]
          );
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