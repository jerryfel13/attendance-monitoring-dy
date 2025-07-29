-- Check the is_late column definition and data
-- This will help us understand if the column is set up correctly

-- Check column definition
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
  AND column_name = 'is_late';

-- Check current data in is_late column
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
LIMIT 20;

-- Check if there are any records with non-NULL is_late values
SELECT 
  COUNT(*) as total_records,
  COUNT(is_late) as non_null_is_late,
  COUNT(*) FILTER (WHERE is_late = true) as true_is_late,
  COUNT(*) FILTER (WHERE is_late = false) as false_is_late,
  COUNT(*) FILTER (WHERE is_late IS NULL) as null_is_late
FROM attendance_records; 