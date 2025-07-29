-- Test the fixed is_late calculation
-- This query will help verify that the is_late column is now being saved correctly

-- First, let's see the current state of recent records
SELECT 
  id,
  student_id,
  check_in_time,
  status,
  is_late,
  CASE 
    WHEN is_late IS NULL THEN 'NULL'
    WHEN is_late = true THEN 'TRUE'
    WHEN is_late = false THEN 'FALSE'
    ELSE 'UNKNOWN: ' || is_late::text
  END as is_late_status
FROM attendance_records 
ORDER BY check_in_time DESC
LIMIT 10;

-- Test the calculation logic for a specific session
WITH session_data AS (
  SELECT 
    s.id as session_id,
    s.session_date,
    s.session_time,
    sub.late_threshold,
    sub.name as subject_name,
    (s.session_date || ' ' || s.session_time)::timestamp as session_start_time
  FROM attendance_sessions s
  JOIN subjects sub ON s.subject_id = sub.id
  WHERE s.is_active = true
  ORDER BY s.session_date DESC, s.session_time DESC
  LIMIT 1
),
attendance_analysis AS (
  SELECT 
    ar.id,
    ar.student_id,
    ar.check_in_time,
    ar.status,
    ar.is_late as current_is_late,
    sd.session_start_time,
    sd.late_threshold,
    sd.subject_name,
    -- Calculate what is_late should be
    CASE 
      WHEN ar.check_in_time IS NULL THEN false
      WHEN ar.check_in_time <= sd.session_start_time THEN false
      WHEN EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 > sd.late_threshold THEN true
      ELSE false
    END as should_be_late,
    -- Calculate time difference
    EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 as minutes_late
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.check_in_time IS NOT NULL
)
SELECT 
  aa.id,
  aa.student_id,
  aa.subject_name,
  aa.check_in_time,
  aa.status,
  aa.current_is_late,
  aa.should_be_late,
  aa.session_start_time,
  aa.late_threshold,
  aa.minutes_late,
  CASE 
    WHEN aa.current_is_late IS NULL THEN 'NULL - Needs to be calculated'
    WHEN aa.current_is_late = aa.should_be_late THEN 'CORRECT'
    ELSE 'WRONG - Should be ' || aa.should_be_late
  END as status_check
FROM attendance_analysis aa
ORDER BY aa.check_in_time DESC
LIMIT 10;

-- Summary of is_late column status
SELECT 
  COUNT(*) as total_records,
  COUNT(is_late) as non_null_is_late,
  COUNT(*) FILTER (WHERE is_late = true) as true_is_late,
  COUNT(*) FILTER (WHERE is_late = false) as false_is_late,
  COUNT(*) FILTER (WHERE is_late IS NULL) as null_is_late,
  ROUND(COUNT(is_late) * 100.0 / COUNT(*), 2) as percent_with_is_late
FROM attendance_records; 