-- Seed data for QR Attendance System

-- Insert sample teachers
INSERT INTO users (unique_id, email, name, role, department, password_hash) VALUES
('TEACHER-001', 'dr.smith@university.edu', 'Dr. John Smith', 'teacher', 'Computer Science', '$2b$10$example_hash_1'),
('TEACHER-002', 'prof.johnson@university.edu', 'Prof. Sarah Johnson', 'teacher', 'Computer Science', '$2b$10$example_hash_2'),
('TEACHER-003', 'dr.brown@university.edu', 'Dr. Michael Brown', 'teacher', 'Computer Science', '$2b$10$example_hash_3');

-- Insert sample students
INSERT INTO users (unique_id, email, name, role, student_id, department, password_hash) VALUES
('STUDENT-001', 'alice@student.edu', 'Alice Johnson', 'student', 'CS2021001', 'Computer Science', '$2b$10$example_hash_4'),
('STUDENT-002', 'bob@student.edu', 'Bob Wilson', 'student', 'CS2021002', 'Computer Science', '$2b$10$example_hash_5'),
('STUDENT-003', 'carol@student.edu', 'Carol Davis', 'student', 'CS2021003', 'Computer Science', '$2b$10$example_hash_6'),
('STUDENT-004', 'david@student.edu', 'David Miller', 'student', 'CS2021004', 'Computer Science', '$2b$10$example_hash_7'),
('STUDENT-005', 'eve@student.edu', 'Eve Anderson', 'student', 'CS2021005', 'Computer Science', '$2b$10$example_hash_8');

-- Insert sample subjects
INSERT INTO subjects (name, code, description, teacher_id, schedule_days, start_time, end_time, late_threshold, enrollment_qr) VALUES
('Data Structures', 'CS201', 'Introduction to data structures and algorithms', 1, ARRAY['Monday', 'Wednesday', 'Friday'], '10:00:00', '11:30:00', 15, 'SUBJECT:Data Structures (CS201)'),
('Database Systems', 'CS301', 'Relational database design and SQL', 2, ARRAY['Tuesday', 'Thursday'], '14:00:00', '15:30:00', 10, 'SUBJECT:Database Systems (CS301)'),
('Web Development', 'CS401', 'Modern web development with React and Node.js', 3, ARRAY['Monday', 'Wednesday'], '15:00:00', '16:30:00', 20, 'SUBJECT:Web Development (CS401)');

-- Insert sample enrollments
INSERT INTO enrollments (student_id, subject_id) VALUES
-- Data Structures enrollments
(4, 1), (5, 1), (6, 1), (7, 1), (8, 1),
-- Database Systems enrollments  
(4, 2), (5, 2), (6, 2),
-- Web Development enrollments
(5, 3), (6, 3), (7, 3), (8, 3);

-- Insert sample attendance sessions
INSERT INTO attendance_sessions (subject_id, session_date, session_time, attendance_qr, is_active) VALUES
-- Data Structures sessions
(1, '2024-01-15', '10:00:00', 'ATTENDANCE:Data Structures (CS201) - 2024-01-15', false),
(1, '2024-01-17', '10:00:00', 'ATTENDANCE:Data Structures (CS201) - 2024-01-17', false),
(1, '2024-01-19', '10:00:00', 'ATTENDANCE:Data Structures (CS201) - 2024-01-19', true),
-- Database Systems sessions
(2, '2024-01-16', '14:00:00', 'ATTENDANCE:Database Systems (CS301) - 2024-01-16', false),
(2, '2024-01-18', '14:00:00', 'ATTENDANCE:Database Systems (CS301) - 2024-01-18', true),
-- Web Development sessions
(3, '2024-01-15', '15:00:00', 'ATTENDANCE:Web Development (CS401) - 2024-01-15', false),
(3, '2024-01-17', '15:00:00', 'ATTENDANCE:Web Development (CS401) - 2024-01-17', true);

-- Insert sample attendance records
INSERT INTO attendance_records (session_id, student_id, check_in_time, status, is_late) VALUES
-- Data Structures - Session 1 (2024-01-15)
(1, 4, '2024-01-15 10:05:00', 'present', false),
(1, 5, '2024-01-15 10:18:00', 'late', true),
(1, 6, '2024-01-15 10:02:00', 'present', false),
(1, 7, '2024-01-15 10:25:00', 'late', true),
-- Data Structures - Session 2 (2024-01-17)
(2, 4, '2024-01-17 10:01:00', 'present', false),
(2, 5, '2024-01-17 10:03:00', 'present', false),
(2, 6, '2024-01-17 10:20:00', 'late', true),
-- Database Systems - Session 1 (2024-01-16)
(4, 4, '2024-01-16 14:05:00', 'present', false),
(4, 5, '2024-01-16 14:15:00', 'late', true),
(4, 6, '2024-01-16 14:02:00', 'present', false);
