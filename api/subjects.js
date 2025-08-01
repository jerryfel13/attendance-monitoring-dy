import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  const { route, id, teacherId } = req.query;

  // Get subjects for a teacher
  if (route === 'teacher-subjects' && req.method === 'GET') {
    if (!teacherId) return res.status(400).json({ error: 'Missing teacherId' });
    try {
      const subjectsResult = await pool.query(
        'SELECT id, name, code, start_time, end_time, schedule_days FROM subjects WHERE teacher_id = $1',
        [teacherId]
      );
      const subjects = await Promise.all(subjectsResult.rows.map(async (subject) => {
        const studentsResult = await pool.query(
          'SELECT COUNT(*) FROM enrollments WHERE subject_id = $1',
          [subject.id]
        );
        const students = parseInt(studentsResult.rows[0].count, 10);
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
        let attendanceRate = 100;
        if (total > 0) {
          attendanceRate = Math.round(((total - absent) / total) * 100);
        }
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
      return res.json({ subjects });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch subjects', details: err.message });
    }
  }

  // Get subjects for a student
  if (route === 'student-subjects' && req.method === 'GET') {
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'Missing studentId' });
    try {
      const subjectsResult = await pool.query(
        `SELECT s.id, s.name, s.code, s.start_time, s.end_time, s.schedule_days, s.teacher_id, u.name as teacher_name
         FROM subjects s
         JOIN enrollments e ON s.id = e.subject_id
         JOIN users u ON s.teacher_id = u.id
         WHERE e.student_id = $1`,
        [studentId]
      );
      const subjects = subjectsResult.rows.map(subject => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        teacher: subject.teacher_name,
        schedule: subject.schedule_days && subject.start_time && subject.end_time
          ? `${subject.schedule_days.join(', ')} ${subject.start_time} - ${subject.end_time}`
          : '',
        enrolled: true,
      }));
      return res.json({ subjects });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch student subjects', details: err.message });
    }
  }

  // Create a new subject
  if (route === 'create' && req.method === 'POST') {
    const { name, code, description, teacher_id, schedule_days, start_time, end_time, late_threshold } = req.body;
    if (!name || !code || !teacher_id || !schedule_days || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      const result = await pool.query(
        'INSERT INTO subjects (name, code, description, teacher_id, schedule_days, start_time, end_time, late_threshold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, code, description, teacher_id, schedule_days, start_time, end_time, late_threshold',
        [name, code, description || null, teacher_id, schedule_days, start_time, end_time, late_threshold || 15]
      );
      return res.status(201).json({ subject: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Subject code already exists' });
      } else {
        return res.status(500).json({ error: 'Failed to create subject', details: err.message });
      }
    }
  }

  // Get a subject by id
  if (route === 'get' && req.method === 'GET' && id) {
    try {
      const result = await pool.query('SELECT * FROM subjects WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      
      const subject = result.rows[0];
      
      // Get student count for this subject
      const studentsResult = await pool.query(
        'SELECT COUNT(*) FROM enrollments WHERE subject_id = $1',
        [id]
      );
      const students = parseInt(studentsResult.rows[0].count, 10);
      
      // Format schedule string
      let schedule = '';
      if (subject.schedule_days && subject.start_time && subject.end_time) {
        schedule = `${subject.schedule_days.join(', ')} ${subject.start_time} - ${subject.end_time}`;
      } else {
        schedule = 'Schedule not set';
      }
      
      // Add computed properties to subject
      const subjectWithStats = {
        ...subject,
        students,
        schedule
      };
      
      return res.json({ subject: subjectWithStats });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch subject', details: err.message });
    }
  }

  // Get students enrolled in a subject
  if (route === 'students' && req.method === 'GET' && id) {
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
        LEFT JOIN attendance_sessions s ON s.subject_id = $1
        LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = u.id
        WHERE e.subject_id = $1 AND u.role = 'student'
        GROUP BY u.id, u.name, u.email, u.student_id
        ORDER BY u.name
      `, [id]);
      return res.json({ students: result.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch students', details: err.message });
    }
  }

  // Get attendance sessions for a subject
  if (route === 'sessions' && req.method === 'GET' && id) {
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
      return res.json({ sessions: result.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch sessions', details: err.message });
    }
  }

  // Create attendance session for a subject
  if (route === 'create-session' && req.method === 'POST' && id) {
    const { session_date, session_time, is_active, attendance_qr } = req.body;
    if (!session_date || !session_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      await pool.query(
        'UPDATE attendance_sessions SET is_active = false WHERE subject_id = $1 AND is_active = true',
        [id]
      );
      const result = await pool.query(
        'INSERT INTO attendance_sessions (subject_id, session_date, session_time, is_active, attendance_qr) VALUES ($1, $2, $3, $4, $5) RETURNING id, session_date, session_time, is_active, attendance_qr',
        [id, session_date, session_time, is_active || true, attendance_qr]
      );
      return res.status(201).json({ session: result.rows[0] });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create session', details: err.message });
    }
  }

  // Get active session for a subject
  if (route === 'active-session' && req.method === 'GET' && id) {
    try {
      const result = await pool.query(
        'SELECT id, session_date, session_time, is_active FROM attendance_sessions WHERE subject_id = $1 AND is_active = true ORDER BY session_date DESC, session_time DESC LIMIT 1',
        [id]
      );
      if (result.rows.length > 0) {
        return res.json({ session: result.rows[0] });
      } else {
        return res.json({ session: null });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch active session', details: err.message });
    }
  }

  // Get student attendance for a specific subject
  if (route === 'student-attendance' && req.method === 'GET') {
    const { studentId, subjectId } = req.query;
    if (!studentId || !subjectId) {
      return res.status(400).json({ error: 'Missing studentId or subjectId' });
    }
    try {
      const result = await pool.query(`
        SELECT 
          ar.id, ar.status, ar.check_in_time,
          s.id as session_id, s.session_date, s.session_time,
          TO_CHAR(s.session_date, 'Mon DD, YYYY') as formatted_date,
          TO_CHAR(s.session_time, 'HH:MI AM') as formatted_time
        FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE ar.student_id = $1 AND s.subject_id = $2
        ORDER BY s.session_date DESC, s.session_time DESC
      `, [studentId, subjectId]);
      return res.json({ attendance: result.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch attendance', details: err.message });
    }
  }

  // Update a subject
  if (route === 'update' && req.method === 'PUT' && id) {
    const { name, code, description, schedule_days, start_time, end_time, late_threshold } = req.body;
    if (!name || !code || !schedule_days || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      // Check if subject exists
      const subjectCheck = await pool.query(
        'SELECT id, name FROM subjects WHERE id = $1',
        [id]
      );
      
      if (subjectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      // Check if code is already taken by another subject
      const codeCheck = await pool.query(
        'SELECT id FROM subjects WHERE code = $1 AND id != $2',
        [code, id]
      );
      
      if (codeCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Subject code already exists' });
      }

      // Update the subject
      const result = await pool.query(
        `UPDATE subjects 
         SET name = $1, code = $2, description = $3, schedule_days = $4, 
             start_time = $5, end_time = $6, late_threshold = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 
         RETURNING id, name, code, description, schedule_days, start_time, end_time, late_threshold`,
        [name, code, description || null, schedule_days, start_time, end_time, late_threshold || 15, id]
      );
      
      return res.json({ 
        message: 'Subject updated successfully',
        subject: result.rows[0]
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update subject', details: err.message });
    }
  }

  // Delete a subject
  if (route === 'delete' && req.method === 'DELETE' && id) {
    try {
      // Check if subject exists and get teacher_id for verification
      const subjectCheck = await pool.query(
        'SELECT id, name, teacher_id FROM subjects WHERE id = $1',
        [id]
      );
      
      if (subjectCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      const subject = subjectCheck.rows[0];
      
      // Optional: Add teacher verification here if needed
      // const userData = localStorage.getItem("user");
      // const user = JSON.parse(userData);
      // if (subject.teacher_id !== user.id) {
      //   return res.status(403).json({ error: 'Unauthorized to delete this subject' });
      // }

      // Delete related records first (due to foreign key constraints)
      await pool.query('DELETE FROM attendance_records WHERE session_id IN (SELECT id FROM attendance_sessions WHERE subject_id = $1)', [id]);
      await pool.query('DELETE FROM attendance_sessions WHERE subject_id = $1', [id]);
      await pool.query('DELETE FROM manual_attendance_codes WHERE session_id IN (SELECT id FROM attendance_sessions WHERE subject_id = $1)', [id]);
      await pool.query('DELETE FROM enrollments WHERE subject_id = $1', [id]);
      
      // Finally delete the subject
      await pool.query('DELETE FROM subjects WHERE id = $1', [id]);
      
      return res.json({ 
        message: 'Subject deleted successfully',
        deletedSubject: { id: subject.id, name: subject.name }
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete subject', details: err.message });
    }
  }

  // Default: Not found
  return res.status(404).json({ error: 'Not found' });
} 