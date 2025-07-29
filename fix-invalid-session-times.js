require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixInvalidSessionTimes() {
  try {
    console.log('🔧 Fixing invalid session times in database...\n');
    
    // Check for sessions with invalid time data
    const invalidSessionsResult = await pool.query(`
      SELECT id, subject_id, session_date, session_time, is_active
      FROM attendance_sessions 
      WHERE session_time IS NULL OR session_time = 'Invalid Date' OR session_time = '' OR session_time NOT SIMILAR TO '%:%:%'
    `);
    
    if (invalidSessionsResult.rows.length === 0) {
      console.log('✅ No invalid session times found');
      return;
    }
    
    console.log(`❌ Found ${invalidSessionsResult.rows.length} sessions with invalid times:`);
    invalidSessionsResult.rows.forEach(session => {
      console.log(`  - Session ID: ${session.id}, Subject ID: ${session.subject_id}, Date: ${session.session_date}, Time: "${session.session_time}"`);
    });
    
    // Get subject start times to use as defaults
    const subjectsResult = await pool.query(`
      SELECT id, name, start_time 
      FROM subjects 
      WHERE start_time IS NOT NULL
    `);
    
    const subjectStartTimes = {};
    subjectsResult.rows.forEach(subject => {
      subjectStartTimes[subject.id] = subject.start_time;
    });
    
    console.log('\n📚 Subject start times found:', subjectStartTimes);
    
    // Fix each invalid session
    for (const session of invalidSessionsResult.rows) {
      let newTime = '09:00:00'; // Default time
      
      // Try to use subject's start time if available
      if (subjectStartTimes[session.subject_id]) {
        newTime = subjectStartTimes[session.subject_id];
        console.log(`Using subject start time for session ${session.id}: ${newTime}`);
      } else {
        console.log(`Using default time for session ${session.id}: ${newTime}`);
      }
      
      // Update the session
      await pool.query(
        'UPDATE attendance_sessions SET session_time = $1 WHERE id = $2',
        [newTime, session.id]
      );
      
      console.log(`✅ Fixed session ${session.id}: "${session.session_time}" → "${newTime}"`);
    }
    
    // Verify the fix
    const verifyResult = await pool.query(`
      SELECT id, subject_id, session_date, session_time, is_active
      FROM attendance_sessions 
      WHERE session_time IS NULL OR session_time = 'Invalid Date' OR session_time = '' OR session_time NOT SIMILAR TO '%:%:%'
    `);
    
    if (verifyResult.rows.length === 0) {
      console.log('\n✅ All session times are now valid!');
    } else {
      console.log('\n❌ Some session times are still invalid:', verifyResult.rows);
    }
    
    // Show summary of all sessions
    console.log('\n📊 All sessions after fix:');
    const allSessionsResult = await pool.query(`
      SELECT s.id, s.subject_id, s.session_date, s.session_time, s.is_active, sub.name as subject_name
      FROM attendance_sessions s
      JOIN subjects sub ON s.subject_id = sub.id
      ORDER BY s.session_date DESC, s.session_time DESC
    `);
    
    allSessionsResult.rows.forEach(session => {
      const status = session.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(`  - ${session.subject_name} (ID: ${session.id}) - ${session.session_date} ${session.session_time} - ${status}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing session times:', error.message);
  } finally {
    await pool.end();
  }
}

fixInvalidSessionTimes(); 