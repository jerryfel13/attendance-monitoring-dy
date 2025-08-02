-- Clean up duplicate enrollment records
-- Keep only the first record for each student_id and subject_id combination

-- First, let's see what duplicates we have
SELECT 
    student_id, 
    subject_id, 
    COUNT(*) as duplicate_count,
    MIN(id) as first_record_id,
    MAX(id) as last_record_id
FROM enrollments 
GROUP BY student_id, subject_id 
HAVING COUNT(*) > 1
ORDER BY student_id, subject_id;

-- Delete duplicate records, keeping only the first one
DELETE FROM enrollments 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY student_id, subject_id ORDER BY id) as rn
        FROM enrollments
    ) t 
    WHERE t.rn > 1
);

-- Verify the cleanup
SELECT 
    student_id, 
    subject_id, 
    COUNT(*) as record_count
FROM enrollments 
GROUP BY student_id, subject_id 
HAVING COUNT(*) > 1
ORDER BY student_id, subject_id; 