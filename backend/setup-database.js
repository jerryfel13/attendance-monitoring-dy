const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const setupDatabase = async () => {
  try {
    console.log('🚀 Setting up database...');
    
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        unique_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher')),
        student_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_time TIME,
        end_time TIME,
        schedule_days TEXT[],
        late_threshold INTEGER DEFAULT 15,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Subjects table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, subject_id)
      );
    `);
    console.log('✅ Enrollments table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        session_date DATE NOT NULL,
        session_time TIME NOT NULL,
        is_active BOOLEAN DEFAULT true,
        attendance_qr TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Attendance sessions table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL CHECK (status IN ('present', 'late', 'absent')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, student_id)
      );
    `);
    console.log('✅ Attendance records table created');

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON subjects(teacher_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON enrollments(subject_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_subject ON attendance_sessions(subject_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sessions_active ON attendance_sessions(is_active);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_records_session ON attendance_records(session_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_records_student ON attendance_records(student_id);');
    console.log('✅ Indexes created');

    // Insert sample data
    await pool.query(`
      INSERT INTO users (unique_id, name, email, password_hash, role, student_id) VALUES
      ('TEACHER-001', 'John Smith', 'john.smith@school.com', '$2b$10$rQZ9vYzX8K7L2M1N0O9P8Q7R6S5T4U3V2W1X0Y9Z8A7B6C5D4E3F2G1H0I', 'teacher', NULL),
      ('STUDENT-001', 'Alice Johnson', 'alice.johnson@student.com', '$2b$10$rQZ9vYzX8K7L2M1N0O9P8Q7R6S5T4U3V2W1X0Y9Z8A7B6C5D4E3F2G1H0I', 'student', 'STU001'),
      ('STUDENT-002', 'Bob Wilson', 'bob.wilson@student.com', '$2b$10$rQZ9vYzX8K7L2M1N0O9P8Q7R6S5T4U3V2W1X0Y9Z8A7B6C5D4E3F2G1H0I', 'student', 'STU002')
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log('✅ Sample users inserted');

    await pool.query(`
      INSERT INTO subjects (name, code, teacher_id, start_time, end_time, schedule_days, late_threshold) VALUES
      ('Mathematics 101', 'MATH101', 1, '09:00:00', '10:30:00', ARRAY['Monday', 'Wednesday', 'Friday'], 15),
      ('Computer Science', 'CS101', 1, '11:00:00', '12:30:00', ARRAY['Tuesday', 'Thursday'], 10)
      ON CONFLICT (code) DO NOTHING;
    `);
    console.log('✅ Sample subjects inserted');

    await pool.query(`
      INSERT INTO enrollments (student_id, subject_id) VALUES
      (2, 1), (3, 1), (2, 2)
      ON CONFLICT (student_id, subject_id) DO NOTHING;
    `);
    console.log('✅ Sample enrollments inserted');

    console.log('🎉 Database setup completed successfully!');
    
    // Verify setup
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    const subjectsCount = await pool.query('SELECT COUNT(*) FROM subjects');
    const enrollmentsCount = await pool.query('SELECT COUNT(*) FROM enrollments');
    
    console.log(`📊 Database stats:`);
    console.log(`   Users: ${usersCount.rows[0].count}`);
    console.log(`   Subjects: ${subjectsCount.rows[0].count}`);
    console.log(`   Enrollments: ${enrollmentsCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
  } finally {
    await pool.end();
  }
};

setupDatabase(); 