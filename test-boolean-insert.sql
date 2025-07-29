-- Test boolean insertion into is_late column
-- This will help verify that the boolean type is working correctly

-- First, let's check the column definition
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
  AND column_name = 'is_late';

-- Test direct boolean insertion
-- This will help us verify that the column accepts boolean values
INSERT INTO attendance_records (session_id, student_id, status, check_in_time, is_late) 
VALUES (1, 1, 'test', NOW(), true)
ON CONFLICT DO NOTHING;

INSERT INTO attendance_records (session_id, student_id, status, check_in_time, is_late) 
VALUES (1, 2, 'test', NOW(), false)
ON CONFLICT DO NOTHING;

-- Check if the test inserts worked
SELECT 
  id,
  student_id,
  status,
  is_late,
  CASE 
    WHEN is_late IS NULL THEN 'NULL'
    WHEN is_late = true THEN 'TRUE'
    WHEN is_late = false THEN 'FALSE'
    ELSE 'UNKNOWN: ' || is_late::text
  END as is_late_status
FROM attendance_records 
WHERE status = 'test'
ORDER BY id DESC;

-- Clean up test data
DELETE FROM attendance_records WHERE status = 'test';

-- Check current state after cleanup
SELECT 
  COUNT(*) as total_records,
  COUNT(is_late) as non_null_is_late,
  COUNT(*) FILTER (WHERE is_late = true) as true_is_late,
  COUNT(*) FILTER (WHERE is_late = false) as false_is_late,
  COUNT(*) FILTER (WHERE is_late IS NULL) as null_is_late
FROM attendance_records; 