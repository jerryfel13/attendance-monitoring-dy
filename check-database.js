require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabase() {
  try {
    console.log('🔍 Checking database state...\n');
    
    // Check subjects
    console.log('📚 SUBJECTS:');
    const subjectsResult = await pool.query('SELECT id, name, code, teacher_id FROM subjects');
    if (subjectsResult.rows.length === 0) {
      console.log('❌ No subjects found in database');
      console.log('💡 You need to create subjects first using the teacher dashboard');
    } else {
      subjectsResult.rows.forEach(subject => {
        console.log(`  - ${subject.name} (${subject.code}) - Teacher ID: ${subject.teacher_id}`);
      });
    }
    
    console.log('\n👥 STUDENTS:');
    const studentsResult = await pool.query('SELECT id, name, email, student_id FROM users WHERE role = \'student\'');
    if (studentsResult.rows.length === 0) {
      console.log('❌ No students found in database');
      console.log('💡 You need to register students first');
    } else {
      studentsResult.rows.forEach(student => {
        console.log(`  - ${student.name} (${student.email}) - ID: ${student.id}`);
      });
    }
    
    console.log('\n👨‍🏫 TEACHERS:');
    const teachersResult = await pool.query('SELECT id, name, email FROM users WHERE role = \'teacher\'');
    if (teachersResult.rows.length === 0) {
      console.log('❌ No teachers found in database');
      console.log('💡 You need to register teachers first');
    } else {
      teachersResult.rows.forEach(teacher => {
        console.log(`  - ${teacher.name} (${teacher.email}) - ID: ${teacher.id}`);
      });
    }
    
    console.log('\n📊 ENROLLMENTS:');
    const enrollmentsResult = await pool.query(`
      SELECT e.id, u.name as student_name, s.name as subject_name 
      FROM enrollments e 
      JOIN users u ON e.student_id = u.id 
      JOIN subjects s ON e.subject_id = s.id
    `);
    if (enrollmentsResult.rows.length === 0) {
      console.log('❌ No enrollments found in database');
    } else {
      enrollmentsResult.rows.forEach(enrollment => {
        console.log(`  - ${enrollment.student_name} enrolled in ${enrollment.subject_name}`);
      });
    }
    
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase(); 