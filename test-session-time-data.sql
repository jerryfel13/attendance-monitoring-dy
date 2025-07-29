-- Test session_time data format and values
-- This will help us understand if the session_time is stored correctly

SELECT 
  id,
  subject_id,
  session_date,
  session_time,
  -- Check if session_time is in correct format
  CASE 
    WHEN session_time IS NULL THEN 'NULL'
    WHEN session_time::text ~ '^\d{2}:\d{2}:\d{2}$' THEN 'VALID TIME FORMAT'
    ELSE 'INVALID FORMAT: ' || session_time::text
  END as time_format_check,
  -- Create a test timestamp
  (session_date || ' ' || session_time)::timestamp as test_session_start,
  -- Check if we can create a valid Date object
  CASE 
    WHEN session_time IS NULL THEN 'NULL'
    WHEN session_date IS NULL THEN 'NULL DATE'
    ELSE 'OK'
  END as date_creation_check
FROM attendance_sessions 
WHERE is_active = true
ORDER BY session_date DESC, session_time DESC
LIMIT 10;

-- Test with a specific session
SELECT 
  s.id as session_id,
  s.session_date,
  s.session_time,
  s.session_time::text as session_time_text,
  (s.session_date || ' ' || s.session_time)::timestamp as session_start_timestamp,
  sub.name as subject_name,
  sub.late_threshold
FROM attendance_sessions s
JOIN subjects sub ON s.subject_id = sub.id
WHERE s.is_active = true
ORDER BY s.session_date DESC, s.session_time DESC
LIMIT 5; 