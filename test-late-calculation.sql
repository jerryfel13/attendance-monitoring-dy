-- Test late calculation logic
-- This query compares check_in_time with session start time and late threshold

WITH session_data AS (
  SELECT 
    s.id as session_id,
    s.session_date,
    s.session_time,
    s.subject_id,
    sub.late_threshold,
    -- Create session start timestamp
    (s.session_date || ' ' || s.session_time)::timestamp as session_start_time
  FROM attendance_sessions s
  JOIN subjects sub ON s.subject_id = sub.id
  WHERE s.id = 1  -- Replace with your session ID
),
attendance_analysis AS (
  SELECT 
    ar.id,
    ar.student_id,
    ar.check_in_time,
    ar.status,
    ar.check_out_time,
    sd.session_start_time,
    sd.late_threshold,
    -- Calculate time difference in minutes
    EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 as minutes_late,
    -- Determine if student should be marked as late
    CASE 
      WHEN ar.check_in_time IS NULL THEN 'absent'
      WHEN ar.check_in_time <= sd.session_start_time THEN 'present'
      WHEN EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 > sd.late_threshold THEN 'late'
      ELSE 'present'
    END as calculated_status
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
)
SELECT 
  aa.id,
  aa.student_id,
  aa.check_in_time,
  aa.status as current_status,
  aa.calculated_status,
  aa.session_start_time,
  aa.late_threshold,
  aa.minutes_late,
  CASE 
    WHEN aa.status != aa.calculated_status THEN 'MISMATCH'
    ELSE 'OK'
  END as status_check
FROM attendance_analysis aa
ORDER BY aa.student_id;

-- Example update query to fix late status based on calculation
-- UPDATE attendance_records 
-- SET status = 'late', check_out_time = NOW()
-- WHERE id IN (
--   SELECT ar.id
--   FROM attendance_records ar
--   JOIN session_data sd ON ar.session_id = sd.session_id
--   WHERE ar.check_in_time IS NOT NULL
--     AND EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 > sd.late_threshold
--     AND ar.status = 'pending'
-- ); 