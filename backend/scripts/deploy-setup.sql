-- Railway Deployment Setup Script
-- Run this in Railway's PostgreSQL console after deployment

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    unique_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher')),
    student_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    start_time TIME,
    end_time TIME,
    schedule_days TEXT[],
    late_threshold INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject_id)
);

-- Create attendance_sessions table
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    attendance_qr TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    check_in_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL CHECK (status IN ('present', 'late', 'absent', 'pending')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, student_id)
);

-- Create manual_attendance_codes table
CREATE TABLE IF NOT EXISTS manual_attendance_codes (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out')),
    code VARCHAR(20) NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON enrollments(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON attendance_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON attendance_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_records_student ON attendance_records(student_id);

-- Insert sample data for testing
INSERT INTO users (unique_id, name, email, password_hash, role, student_id) VALUES
('TEACHER-001', 'Dr. John Smith', 'dr.smith@university.edu', '$2b$10$example_hash_1', 'teacher', NULL),
('STUDENT-001', 'Alice Johnson', 'alice@student.edu', '$2b$10$example_hash_4', 'student', 'CS2021001'),
('STUDENT-002', 'Bob Wilson', 'bob@student.edu', '$2b$10$example_hash_5', 'student', 'CS2021002')
ON CONFLICT (unique_id) DO NOTHING;

INSERT INTO subjects (name, code, teacher_id, start_time, end_time, schedule_days, late_threshold) VALUES
('Data Structures', 'CS201', 1, '10:00:00', '11:30:00', ARRAY['Monday', 'Wednesday', 'Friday'], 15),
('Database Systems', 'CS301', 1, '14:00:00', '15:30:00', ARRAY['Tuesday', 'Thursday'], 10)
ON CONFLICT (code) DO NOTHING;

-- Insert sample enrollments
INSERT INTO enrollments (student_id, subject_id) VALUES
(2, 1), -- Alice in Math
(3, 1), -- Bob in Math
(2, 2)  -- Alice in CS
ON CONFLICT (student_id, subject_id) DO NOTHING;

-- Verify setup
SELECT 'Database setup completed successfully!' as status;
SELECT COUNT(*) as users_count FROM users;
SELECT COUNT(*) as subjects_count FROM subjects;
SELECT COUNT(*) as enrollments_count FROM enrollments; 