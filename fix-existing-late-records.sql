-- Fix existing attendance records with incorrect late status
-- This script corrects records that were marked as 'present' but should be 'late'

-- First, let's see what needs to be fixed
WITH session_data AS (
  SELECT 
    s.id as session_id,
    s.session_date,
    s.subject_id,
    sub.late_threshold,
    sub.start_time as subject_start_time,
    (s.session_date || ' ' || sub.start_time)::timestamp as correct_session_start_time
  FROM attendance_sessions s
  JOIN subjects sub ON s.subject_id = sub.id
),
records_to_fix AS (
  SELECT 
    ar.id,
    ar.student_id,
    ar.check_in_time,
    ar.status,
    ar.check_out_time,
    sd.correct_session_start_time,
    sd.late_threshold,
    EXTRACT(EPOCH FROM (ar.check_in_time - sd.correct_session_start_time)) / 60 as minutes_late,
    CASE 
      WHEN ar.check_in_time IS NULL THEN 'absent'
      WHEN ar.check_in_time <= sd.correct_session_start_time THEN 'present'
      WHEN EXTRACT(EPOCH FROM (ar.check_in_time - sd.correct_session_start_time)) / 60 > sd.late_threshold THEN 'late'
      ELSE 'present'
    END as correct_status
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.status IN ('present', 'late')  -- Only check finalized records
    AND ar.check_in_time IS NOT NULL
)
SELECT 
  'RECORDS TO FIX:' as info,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status != correct_status) as incorrect_records,
  COUNT(*) FILTER (WHERE status = 'present' AND correct_status = 'late') as should_be_late,
  COUNT(*) FILTER (WHERE status = 'late' AND correct_status = 'present') as should_be_present
FROM records_to_fix;

-- Show specific records that need fixing
WITH session_data AS (
  SELECT 
    s.id as session_id,
    s.session_date,
    s.subject_id,
    sub.late_threshold,
    sub.start_time as subject_start_time,
    (s.session_date || ' ' || sub.start_time)::timestamp as correct_session_start_time
  FROM attendance_sessions s
  JOIN subjects sub ON s.subject_id = sub.id
),
records_to_fix AS (
  SELECT 
    ar.id,
    ar.student_id,
    ar.check_in_time,
    ar.status,
    ar.check_out_time,
    sd.correct_session_start_time,
    sd.late_threshold,
    EXTRACT(EPOCH FROM (ar.check_in_time - sd.correct_session_start_time)) / 60 as minutes_late,
    CASE 
      WHEN ar.check_in_time IS NULL THEN 'absent'
      WHEN ar.check_in_time <= sd.correct_session_start_time THEN 'present'
      WHEN EXTRACT(EPOCH FROM (ar.check_in_time - sd.correct_session_start_time)) / 60 > sd.late_threshold THEN 'late'
      ELSE 'present'
    END as correct_status
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.status IN ('present', 'late')
    AND ar.check_in_time IS NOT NULL
)
SELECT 
  id,
  student_id,
  check_in_time,
  status as current_status,
  correct_status,
  minutes_late,
  late_threshold,
  CASE 
    WHEN status != correct_status THEN 'NEEDS FIX'
    ELSE 'OK'
  END as action_needed
FROM records_to_fix
WHERE status != correct_status
ORDER BY student_id;

-- FIX: Update records that should be 'late' but are marked as 'present'
/*
UPDATE attendance_records 
SET status = 'late'
WHERE id IN (
  SELECT ar.id
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.status = 'present'
    AND ar.check_in_time IS NOT NULL
    AND EXTRACT(EPOCH FROM (ar.check_in_time - sd.correct_session_start_time)) / 60 > sd.late_threshold
);
*/

-- FIX: Update records that should be 'present' but are marked as 'late'
/*
UPDATE attendance_records 
SET status = 'present'
WHERE id IN (
  SELECT ar.id
  FROM attendance_records ar
  JOIN session_data sd ON ar.session_id = sd.session_id
  WHERE ar.status = 'late'
    AND ar.check_in_time IS NOT NULL
    AND EXTRACT(EPOCH FROM (ar.check_in_time - sd.correct_session_start_time)) / 60 <= sd.late_threshold
);
*/ 