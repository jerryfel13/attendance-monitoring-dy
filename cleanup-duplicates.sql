-- Clean up duplicate attendance records
-- Keep only the first record for each session_id and student_id combination

-- First, let's see what duplicates we have
SELECT 
    session_id, 
    student_id, 
    COUNT(*) as duplicate_count,
    MIN(id) as first_record_id,
    MAX(id) as last_record_id
FROM attendance_records 
GROUP BY session_id, student_id 
HAVING COUNT(*) > 1
ORDER BY session_id, student_id;

-- Delete duplicate records, keeping only the first one
DELETE FROM attendance_records 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY session_id, student_id ORDER BY id) as rn
        FROM attendance_records
    ) t 
    WHERE t.rn > 1
);

-- Verify the cleanup
SELECT 
    session_id, 
    student_id, 
    COUNT(*) as record_count
FROM attendance_records 
GROUP BY session_id, student_id 
HAVING COUNT(*) > 1
ORDER BY session_id, student_id; 