require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixSessionTimes() {
  try {
    console.log('🔧 Fixing invalid session times...\n');
    
    // Check for sessions with invalid time data
    const invalidSessionsResult = await pool.query(`
      SELECT id, session_date, session_time, subject_id
      FROM attendance_sessions 
      WHERE session_time IS NULL OR session_time = 'Invalid Date' OR session_time = ''
    `);
    
    if (invalidSessionsResult.rows.length === 0) {
      console.log('✅ No invalid session times found');
      return;
    }
    
    console.log(`❌ Found ${invalidSessionsResult.rows.length} sessions with invalid times:`);
    invalidSessionsResult.rows.forEach(session => {
      console.log(`  - Session ID: ${session.id}, Date: ${session.session_date}, Time: "${session.session_time}"`);
    });
    
    // Fix invalid session times by setting them to a default time (9:00 AM)
    console.log('\n🔧 Fixing invalid session times...');
    const updateResult = await pool.query(`
      UPDATE attendance_sessions 
      SET session_time = '09:00:00'
      WHERE session_time IS NULL OR session_time = 'Invalid Date' OR session_time = ''
    `);
    
    console.log(`✅ Fixed ${updateResult.rowCount} session times`);
    
    // Verify the fix
    const verifyResult = await pool.query(`
      SELECT id, session_date, session_time, subject_id
      FROM attendance_sessions 
      WHERE session_time IS NULL OR session_time = 'Invalid Date' OR session_time = ''
    `);
    
    if (verifyResult.rows.length === 0) {
      console.log('✅ All session times are now valid');
    } else {
      console.log('❌ Some session times are still invalid:', verifyResult.rows);
    }
    
  } catch (error) {
    console.error('❌ Error fixing session times:', error.message);
  } finally {
    await pool.end();
  }
}

fixSessionTimes(); 