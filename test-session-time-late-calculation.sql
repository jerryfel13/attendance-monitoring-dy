-- Test late calculation using session_time (actual session start time)
-- This query compares check_in_time with session.session_time

WITH session_data AS (
  SELECT 
    s.id as session_id,
    s.session_date,
    s.session_time as actual_session_time,
    s.subject_id,
    sub.late_threshold,
    sub.name as subject_name,
    sub.code as subject_code,
    -- Create session start timestamp using SESSION's actual time (CORRECT)
    (s.session_date || ' ' || s.session_time)::timestamp as session_start_time
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
    ar.is_late,
    sd.session_start_time,
    sd.late_threshold,
    sd.subject_name,
    sd.subject_code,
    sd.actual_session_time,
    -- Calculate time difference in minutes using session_time
    EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 as minutes_late,
    -- Determine if student should be marked as late
    CASE 
      WHEN ar.check_in_time IS NULL THEN 'absent'
      WHEN ar.check_in_time <= sd.session_start_time THEN 'present'
      WHEN EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 > sd.late_threshold THEN 'late'
      ELSE 'present'
    END as calculated_status,
    -- Determine if student should be marked as late (boolean)
    CASE 
      WHEN ar.check_in_time IS NULL THEN false
      WHEN ar.check_in_time <= sd.session_start_time THEN false
      WHEN EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 > sd.late_threshold THEN true
      ELSE false
    END as should_be_late
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
  aa.is_late as current_is_late,
  aa.calculated_status,
  aa.should_be_late,
  aa.session_start_time,
  aa.actual_session_time,
  aa.late_threshold,
  aa.minutes_late,
  CASE 
    WHEN aa.status != aa.calculated_status THEN 'WRONG STATUS - Should be ' || aa.calculated_status
    WHEN aa.is_late != aa.should_be_late THEN 'WRONG IS_LATE - Should be ' || aa.should_be_late
    WHEN aa.status = 'pending' THEN 'PENDING - Will be calculated on scan-out'
    ELSE 'OK'
  END as status_check
FROM attendance_analysis aa
ORDER BY aa.student_id;

-- Example: Update existing records to correct status and is_late
/*
UPDATE attendance_records 
SET status = 'late', is_late = true
WHERE id IN (
  SELECT ar.id
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.status = 'present'
    AND ar.check_in_time IS NOT NULL
    AND EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 > sd.late_threshold
);

UPDATE attendance_records 
SET status = 'present', is_late = false
WHERE id IN (
  SELECT ar.id
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.status = 'late'
    AND ar.check_in_time IS NOT NULL
    AND EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 <= sd.late_threshold
);
*/ 