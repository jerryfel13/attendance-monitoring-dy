-- Migration script to convert TIMESTAMP to TIMESTAMPTZ
-- Run this in your PostgreSQL database to fix timezone issues

-- First, backup your data (recommended)
-- CREATE TABLE attendance_records_backup AS SELECT * FROM attendance_records;
-- CREATE TABLE attendance_sessions_backup AS SELECT * FROM attendance_sessions;
-- CREATE TABLE users_backup AS SELECT * FROM users;
-- CREATE TABLE subjects_backup AS SELECT * FROM subjects;
-- CREATE TABLE enrollments_backup AS SELECT * FROM enrollments;
-- CREATE TABLE manual_attendance_codes_backup AS SELECT * FROM manual_attendance_codes;

-- Convert attendance_records table
ALTER TABLE attendance_records 
  ALTER COLUMN check_in_time TYPE TIMESTAMPTZ USING check_in_time AT TIME ZONE 'UTC',
  ALTER COLUMN check_out_time TYPE TIMESTAMPTZ USING check_out_time AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Convert attendance_sessions table
ALTER TABLE attendance_sessions 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Convert users table
ALTER TABLE users 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Convert subjects table
ALTER TABLE subjects 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Convert enrollments table
ALTER TABLE enrollments 
  ALTER COLUMN enrolled_at TYPE TIMESTAMPTZ USING enrolled_at AT TIME ZONE 'UTC';

-- Convert manual_attendance_codes table
ALTER TABLE manual_attendance_codes 
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Update default values to use TIMESTAMPTZ
ALTER TABLE attendance_records 
  ALTER COLUMN check_in_time SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE attendance_sessions 
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE users 
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE subjects 
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE enrollments 
  ALTER COLUMN enrolled_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE manual_attendance_codes 
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- Verify the changes
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name IN ('attendance_records', 'attendance_sessions', 'users', 'subjects', 'enrollments', 'manual_attendance_codes')
  AND column_name LIKE '%_at' OR column_name IN ('check_in_time', 'check_out_time')
ORDER BY table_name, column_name; 