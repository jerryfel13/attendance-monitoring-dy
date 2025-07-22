require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSessions() {
  try {
    console.log('🔍 Checking attendance sessions...\n');
    
    // Check all attendance sessions
    console.log('📊 ALL ATTENDANCE SESSIONS:');
    const sessionsResult = await pool.query(`
      SELECT 
        s.id, s.subject_id, s.session_date, s.session_time, s.is_active,
        sub.name as subject_name, sub.code as subject_code
      FROM attendance_sessions s
      JOIN subjects sub ON s.subject_id = sub.id
      ORDER BY s.session_date DESC, s.session_time DESC
    `);
    
    if (sessionsResult.rows.length === 0) {
      console.log('❌ No attendance sessions found in database');
      console.log('💡 You need to create attendance sessions first');
    } else {
      sessionsResult.rows.forEach(session => {
        const status = session.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        console.log(`  - ${session.subject_name} (${session.subject_code}) - ${session.session_date} ${session.session_time} - ${status}`);
      });
    }
    
    // Check active sessions specifically
    console.log('\n✅ ACTIVE SESSIONS:');
    const activeSessionsResult = await pool.query(`
      SELECT 
        s.id, s.subject_id, s.session_date, s.session_time,
        sub.name as subject_name, sub.code as subject_code
      FROM attendance_sessions s
      JOIN subjects sub ON s.subject_id = sub.id
      WHERE s.is_active = true
      ORDER BY s.session_date DESC, s.session_time DESC
    `);
    
    if (activeSessionsResult.rows.length === 0) {
      console.log('❌ No active attendance sessions found');
    } else {
      activeSessionsResult.rows.forEach(session => {
        console.log(`  - ${session.subject_name} (${session.subject_code}) - ${session.session_date} ${session.session_time}`);
      });
    }
    
    console.log('\n✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    await pool.end();
  }
}

checkSessions(); 