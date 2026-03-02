-- Add approval workflow columns to course_syllabi

DO $$ BEGIN
    CREATE TYPE syllabus_status_type AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE course_syllabi
    ADD COLUMN IF NOT EXISTS status syllabus_status_type NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_course_syllabi_status ON course_syllabi(status);
CREATE INDEX IF NOT EXISTS idx_course_syllabi_section ON course_syllabi(course_section_id);
