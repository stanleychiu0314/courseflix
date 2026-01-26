-- PostgreSQL schema for course + instructor + student feedback (OpenDore-style)
-- Safe to run as a migration (create tables only). Adjust names/types as you like.

USE courseflix;

BEGIN;

-- =========================
-- 0) Helper: updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =========================
-- 1) Core academic entities
-- =========================

CREATE TABLE IF NOT EXISTS departments (
  id    BIGSERIAL PRIMARY KEY,
  code  TEXT NOT NULL UNIQUE,     -- e.g., 'CS'
  name  TEXT                      -- optional
);

CREATE TABLE IF NOT EXISTS courses (
  id             BIGSERIAL PRIMARY KEY,
  department_id  BIGINT NOT NULL REFERENCES departments(id),
  catalog_number TEXT NOT NULL,           -- e.g., '2201'
  title          TEXT NOT NULL,
  description    TEXT,
  requirements   TEXT,
  credits_min    NUMERIC(3,1),
  credits_max    NUMERIC(3,1),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, catalog_number)
);

CREATE TRIGGER trg_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS terms (
  id          BIGSERIAL PRIMARY KEY,
  year        INT NOT NULL,
  season      TEXT NOT NULL CHECK (season IN ('Spring','Summer','Fall','Winter')),
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, season)
);

CREATE TRIGGER trg_terms_updated_at
BEFORE UPDATE ON terms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS course_offerings (
  id         BIGSERIAL PRIMARY KEY,
  course_id  BIGINT NOT NULL REFERENCES courses(id),
  term_id    BIGINT NOT NULL REFERENCES terms(id),
  long_title TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, term_id)
);

CREATE TRIGGER trg_course_offerings_updated_at
BEFORE UPDATE ON course_offerings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS sections (
  id            BIGSERIAL PRIMARY KEY,
  offering_id   BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  section_code  TEXT NOT NULL,   -- e.g., '01'
  component     TEXT,            -- lecture/lab/etc if you have it
  location_text TEXT,
  modality      TEXT,

  -- seat availability (raw + parsed)
  seats_taken   INT,
  seats_total   INT,
  seats_raw     TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (offering_id, section_code)
);

CREATE INDEX IF NOT EXISTS sections_offering_id_idx ON sections(offering_id);

CREATE TRIGGER trg_sections_updated_at
BEFORE UPDATE ON sections
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS meeting_patterns (
  id         BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,

  days_raw   TEXT,       -- e.g., 'MWF', 'TR', 'TBA'
  time_raw   TEXT,       -- e.g., '09:30a - 10:45a', 'TBA'

  -- optional parsed fields (nullable)
  start_time TIME,
  end_time   TIME,

  building   TEXT,
  room       TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_patterns_section_id_idx ON meeting_patterns(section_id);

CREATE TRIGGER trg_meeting_patterns_updated_at
BEFORE UPDATE ON meeting_patterns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- 2) Instructors (people)
-- =========================

CREATE TABLE IF NOT EXISTS instructors (
  id           BIGSERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,   -- e.g., 'Bolton, Jeremy'
  first_name   TEXT,
  last_name    TEXT,
  middle_name  TEXT,
  suffix       TEXT,
  email        TEXT,
  vanderbilt_id TEXT,

  -- stable key if you can derive one later from YES or directory
  external_key TEXT UNIQUE,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instructors_last_name_idx ON instructors(last_name);

CREATE TRIGGER trg_instructors_updated_at
BEFORE UPDATE ON instructors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS section_instructors (
  section_id    BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  instructor_id BIGINT NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
  role          TEXT, -- 'Primary', 'Co-Instructor', etc (optional)
  PRIMARY KEY (section_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS section_instructors_instructor_id_idx
  ON section_instructors(instructor_id);

-- =========================
-- 3) Users + course feedback (OpenDore-style)
-- =========================

CREATE TABLE IF NOT EXISTS users (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT UNIQUE,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS course_reviews (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,

  offering_id      BIGINT NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  section_id       BIGINT REFERENCES sections(id) ON DELETE SET NULL,

  overall_rating   INT CHECK (overall_rating BETWEEN 1 AND 5),
  weekly_hours     INT CHECK (weekly_hours BETWEEN 0 AND 80),
  effort_level     INT CHECK (effort_level BETWEEN 1 AND 5),
  would_take_again BOOLEAN,

  first_word       TEXT,

  grade_received   TEXT CHECK (
    grade_received IN ('A','A-','B+','B','B-','C+','C','C-','D','F')
  ),

  overall_comments TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_reviews_offering_id_idx ON course_reviews(offering_id);
CREATE INDEX IF NOT EXISTS course_reviews_section_id_idx  ON course_reviews(section_id);

CREATE TRIGGER trg_course_reviews_updated_at
BEFORE UPDATE ON course_reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Workload multi-select tags (Exam Heavy, Project Heavy, etc.)
CREATE TABLE IF NOT EXISTS workload_tags (
  id    BIGSERIAL PRIMARY KEY,
  key   TEXT NOT NULL UNIQUE,   -- 'exam_heavy'
  label TEXT NOT NULL           -- 'Exam Heavy'
);

CREATE TABLE IF NOT EXISTS review_workload_tags (
  review_id       BIGINT NOT NULL REFERENCES course_reviews(id) ON DELETE CASCADE,
  workload_tag_id BIGINT NOT NULL REFERENCES workload_tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (review_id, workload_tag_id)
);

CREATE INDEX IF NOT EXISTS review_workload_tags_tag_id_idx
  ON review_workload_tags(workload_tag_id);

-- Grading breakdown (flexible list of component + percent)
CREATE TABLE IF NOT EXISTS review_grading_components (
  id         BIGSERIAL PRIMARY KEY,
  review_id  BIGINT NOT NULL REFERENCES course_reviews(id) ON DELETE CASCADE,
  component  TEXT NOT NULL,  -- 'Midterm', 'Final', 'Projects', etc.
  weight_pct NUMERIC(5,2) NOT NULL CHECK (weight_pct >= 0 AND weight_pct <= 100)
);

CREATE INDEX IF NOT EXISTS review_grading_components_review_id_idx
  ON review_grading_components(review_id);

-- Uploaded syllabus (store metadata + storage key)
CREATE TABLE IF NOT EXISTS review_files (
  id          BIGSERIAL PRIMARY KEY,
  review_id   BIGINT NOT NULL REFERENCES course_reviews(id) ON DELETE CASCADE,
  file_kind   TEXT NOT NULL CHECK (file_kind IN ('syllabus')),
  storage_key TEXT NOT NULL,    -- e.g., S3 key/path
  filename    TEXT,
  mime_type   TEXT,
  size_bytes  BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_files_review_id_idx ON review_files(review_id);

-- =========================
-- 4) Scraping provenance (recommended)
-- =========================

CREATE TABLE IF NOT EXISTS scrape_runs (
  id          BIGSERIAL PRIMARY KEY,
  source      TEXT NOT NULL,  -- 'YES'
  term_id     BIGINT REFERENCES terms(id) ON DELETE SET NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT NOT NULL CHECK (status IN ('running','success','failed')),
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS scrape_runs_term_id_idx ON scrape_runs(term_id);

CREATE TABLE IF NOT EXISTS raw_course_payloads (
  id             BIGSERIAL PRIMARY KEY,
  scrape_run_id  BIGINT NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
  department     TEXT,
  catalog_number TEXT,
  payload        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raw_course_payloads_scrape_run_id_idx
  ON raw_course_payloads(scrape_run_id);

CREATE INDEX IF NOT EXISTS raw_course_payloads_payload_gin
  ON raw_course_payloads USING GIN (payload);

-- =========================
-- 5) Seed workload tags (optional)
-- =========================
INSERT INTO workload_tags (key, label) VALUES
  ('exam_heavy', 'Exam Heavy'),
  ('project_heavy', 'Project Heavy'),
  ('paper_heavy', 'Paper Heavy'),
  ('discussion_based', 'Discussion-based')
ON CONFLICT (key) DO NOTHING;

COMMIT;

