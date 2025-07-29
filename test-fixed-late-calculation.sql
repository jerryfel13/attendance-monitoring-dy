-- Test the FIXED late calculation logic
-- This query uses subject.start_time instead of session.session_time for comparison

WITH session_data AS (
  SELECT 
    s.id as session_id,
    s.session_date,
    s.session_time as actual_session_time,  -- This is the incorrect time
    s.subject_id,
    sub.late_threshold,
    sub.start_time as subject_start_time,   -- This is the correct scheduled time
    sub.name as subject_name,
    sub.code as subject_code,
    -- Create session start timestamp using SUBJECT's scheduled start time (CORRECT)
    (s.session_date || ' ' || sub.start_time)::timestamp as correct_session_start_time,
    -- Create session start timestamp using SESSION's actual time (INCORRECT - what was used before)
    (s.session_date || ' ' || s.session_time)::timestamp as incorrect_session_start_time
  FROM attendance_sessions s
  JOIN subjects sub ON s.subject_id = sub.id
  WHERE s.id = 29  -- Replace with your session ID
),
attendance_analysis AS (
  SELECT 
    ar.id,
    ar.student_id,
    ar.check_in_time,
    ar.status,
    ar.check_out_time,
    sd.correct_session_start_time,
    sd.incorrect_session_start_time,
    sd.late_threshold,
    sd.subject_name,
    sd.subject_code,
    sd.subject_start_time,
    sd.actual_session_time,
    -- Calculate time difference using CORRECT session start time
    EXTRACT(EPOCH FROM (ar.check_in_time - sd.correct_session_start_time)) / 60 as minutes_late_correct,
    -- Calculate time difference using INCORRECT session start time (old method)
    EXTRACT(EPOCH FROM (ar.check_in_time - sd.incorrect_session_start_time)) / 60 as minutes_late_incorrect,
    -- Determine correct status using subject's scheduled start time
    CASE 
      WHEN ar.check_in_time IS NULL THEN 'absent'
      WHEN ar.check_in_time <= sd.correct_session_start_time THEN 'present'
      WHEN EXTRACT(EPOCH FROM (ar.check_in_time - sd.correct_session_start_time)) / 60 > sd.late_threshold THEN 'late'
      ELSE 'present'
    END as correct_status,
    -- Determine status using session's actual time (old method)
    CASE 
      WHEN ar.check_in_time IS NULL THEN 'absent'
      WHEN ar.check_in_time <= sd.incorrect_session_start_time THEN 'present'
      WHEN EXTRACT(EPOCH FROM (ar.check_in_time - sd.incorrect_session_start_time)) / 60 > sd.late_threshold THEN 'late'
      ELSE 'present'
    END as incorrect_status
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
)
SELECT 
  aa.id,
  aa.student_id,
  aa.subject_name,
  aa.subject_code,
  aa.check_in_time,
  aa.status as current_status,
  aa.correct_status,
  aa.incorrect_status,
  aa.subject_start_time as scheduled_start_time,
  aa.actual_session_time as recorded_session_time,
  aa.correct_session_start_time,
  aa.incorrect_session_start_time,
  aa.late_threshold,
  aa.minutes_late_correct,
  aa.minutes_late_incorrect,
  CASE 
    WHEN aa.status != aa.correct_status THEN 'WRONG STATUS - Should be ' || aa.correct_status
    WHEN aa.status = 'pending' THEN 'PENDING - Will be calculated correctly on scan-out'
    ELSE 'OK'
  END as status_check
FROM attendance_analysis aa
ORDER BY aa.student_id;

-- Example: Update existing records to correct status
/*
UPDATE attendance_records 
SET status = 'late', check_out_time = NOW()
WHERE id IN (
  SELECT ar.id
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.status = 'present'
    AND ar.check_in_time IS NOT NULL
    AND EXTRACT(EPOCH FROM (ar.check_in_time - sd.correct_session_start_time)) / 60 > sd.late_threshold
);
*/ 