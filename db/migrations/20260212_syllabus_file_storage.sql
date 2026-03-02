-- Store syllabus file content in PostgreSQL (bytea) instead of external URL
-- Max file size: 5MB

ALTER TABLE course_syllabi
  ADD COLUMN IF NOT EXISTS file_data bytea,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

ALTER TABLE course_syllabi
  ALTER COLUMN file_url DROP NOT NULL;

-- When file_data is used, file_url can be NULL
