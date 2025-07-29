-- Test scan-out late calculation logic
-- This query simulates the late calculation that happens when students scan out

WITH session_data AS (
  SELECT 
    s.id as session_id,
    s.session_date,
    s.session_time,
    s.subject_id,
    sub.late_threshold,
    sub.name as subject_name,
    sub.code as subject_code,
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
    sd.subject_name,
    sd.subject_code,
    -- Calculate time difference in minutes
    EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 as minutes_late,
    -- Determine if student should be marked as late (same logic as scan-out)
    CASE 
      WHEN ar.check_in_time IS NULL THEN 'absent'
      WHEN ar.check_in_time <= sd.session_start_time THEN 'present'
      WHEN EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 > sd.late_threshold THEN 'late'
      ELSE 'present'
    END as calculated_status_for_scan_out
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
  aa.calculated_status_for_scan_out,
  aa.session_start_time,
  aa.late_threshold,
  aa.minutes_late,
  CASE 
    WHEN aa.status != aa.calculated_status_for_scan_out THEN 'MISMATCH - Will be corrected on scan-out'
    WHEN aa.status = 'pending' THEN 'PENDING - Will be calculated on scan-out'
    ELSE 'OK'
  END as status_check
FROM attendance_analysis aa
ORDER BY aa.student_id;

-- Example: Test specific scenarios
-- 1. Student who checked in 5 minutes late (should be 'late')
-- 2. Student who checked in on time (should be 'present') 
-- 3. Student who checked in 20 minutes late (should be 'late')
-- 4. Student with no check_in_time (should be 'absent')

-- To simulate scan-out processing for pending records:
/*
UPDATE attendance_records 
SET status = 'late', check_out_time = NOW()
WHERE id IN (
  SELECT ar.id
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.status = 'pending'
    AND ar.check_in_time IS NOT NULL
    AND EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 > sd.late_threshold
);

UPDATE attendance_records 
SET status = 'present', check_out_time = NOW()
WHERE id IN (
  SELECT ar.id
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.status = 'pending'
    AND ar.check_in_time IS NOT NULL
    AND EXTRACT(EPOCH FROM (ar.check_in_time - sd.session_start_time)) / 60 <= sd.late_threshold
);
*/ 