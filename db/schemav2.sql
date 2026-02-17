-- OpenDore / CourseFlix Database Schema v2 (Revised)
-- PostgreSQL Schema for Course Review, Search, and Scheduling Platform
-- Updated: 2026-01-26
--
-- Key changes from v1:
-- 1) Proper section meeting modeling via section_meetings (replaces schedule_days/start/end/location on course_sections)
-- 2) Term/semester normalized into terms table (course_sections.term_id)
-- 3) Cart split into schedules + schedule_items (term-aware, supports multiple saved schedules)
-- 4) Review helpful voting + optional comments
-- 5) Tags normalized: tags table + review_tag_mapping; removed unused tag_categories
-- 6) Added pg_trgm extension for trigram index

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- User authentication provider types
DO $$ BEGIN
    CREATE TYPE oauth_provider_type AS ENUM ('google', 'github', 'microsoft');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Course attendance policy (section-level)
DO $$ BEGIN
    CREATE TYPE attendance_policy_type AS ENUM ('flexible', 'strict');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grade letter grades
DO $$ BEGIN
    CREATE TYPE grade_letter_type AS ENUM ('A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Days of the week for scheduling
DO $$ BEGIN
    CREATE TYPE day_of_week_type AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Time of day categories for filtering (optional; can be computed)
DO $$ BEGIN
    CREATE TYPE time_of_day_type AS ENUM ('Early AM', 'Morning', 'Afternoon', 'Evening');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Term season
DO $$ BEGIN
    CREATE TYPE term_season_type AS ENUM ('Spring', 'Summer', 'Fall', 'Winter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Review vote type (helpful/downvote if you want it)
DO $$ BEGIN
    CREATE TYPE review_vote_type AS ENUM ('helpful');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Users table for authentication and user management
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- NULL if OAuth user
    name VARCHAR(255) NOT NULL,
    oauth_provider oauth_provider_type, -- NULL if email/password user
    oauth_id VARCHAR(255), -- External OAuth provider ID
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT oauth_consistency CHECK (
        (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL AND password_hash IS NULL)
        OR (oauth_provider IS NULL AND oauth_id IS NULL AND password_hash IS NOT NULL)
    )
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE, -- e.g., "CS", "ECON"
    name VARCHAR(255) NOT NULL,       -- e.g., "Computer Science"
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Professors table
CREATE TABLE IF NOT EXISTS professors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Courses table (general course information, not specific sections)
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Keep a display code (e.g., "CS 2201") but also store department_id for filtering.
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    description TEXT,
    credits INTEGER NOT NULL CHECK (credits >= 0 AND credits <= 20),

    -- Cached aggregate statistics (computed from reviews/sections)
    rating NUMERIC(3, 2) CHECK (rating >= 0 AND rating <= 5),
    review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
    avg_hours_per_week NUMERIC(5, 2) CHECK (avg_hours_per_week >= 0),
    difficulty_rating NUMERIC(3, 2) CHECK (difficulty_rating >= 0 AND difficulty_rating <= 5),
    would_take_again_percentage NUMERIC(5, 2) CHECK (would_take_again_percentage >= 0 AND would_take_again_percentage <= 100),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(code, department_id)
);

-- =============================================================================
-- TERMS / SEMESTERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season term_season_type NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2100),
    label VARCHAR(50) NOT NULL, -- e.g., "Spring 2026"
    starts_on DATE,
    ends_on DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season, year),
    UNIQUE(label)
);

-- =============================================================================
-- COURSE SECTIONS & SCHEDULING
-- =============================================================================

-- Course sections (specific offerings with professor, term, enrollment, policies)
CREATE TABLE IF NOT EXISTS course_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

    -- Term
    term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,

    -- If you have YES identifiers, these help uniqueness and imports:
    crn VARCHAR(20),
    section_number VARCHAR(20),

    -- Enrollment
    max_seats INTEGER NOT NULL CHECK (max_seats >= 0),
    enrolled_count INTEGER DEFAULT 0 CHECK (enrolled_count >= 0),

    -- Section-specific policies
    attendance_policy attendance_policy_type DEFAULT 'flexible',
    absences_allowed INTEGER DEFAULT 0 CHECK (absences_allowed >= 0),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Prefer CRN uniqueness if present; otherwise prevent obvious duplicates:
    UNIQUE(term_id, crn),
    UNIQUE(course_id, term_id, section_number)
);

-- Many-to-many instructors (supports co-teaching)
CREATE TABLE IF NOT EXISTS section_instructors (
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES professors(id) ON DELETE RESTRICT,
    role VARCHAR(50), -- e.g., "Primary", "Co-Instructor"
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_section_id, professor_id)
);

-- Meeting patterns for sections (replaces schedule_days/start/end)
CREATE TABLE IF NOT EXISTS section_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    day day_of_week_type NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    meeting_type VARCHAR(30), -- lecture/lab/recitation
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT meeting_time_order CHECK (end_time > start_time)
);

-- Optional: derived time-of-day for filtering (can also compute in queries)
-- (Kept as a computed-on-write column to speed filters if you want.)
ALTER TABLE section_meetings
    ADD COLUMN IF NOT EXISTS time_of_day time_of_day_type;

-- =============================================================================
-- COURSE RELATIONSHIPS
-- =============================================================================

-- Course prerequisites (many-to-many)
CREATE TABLE IF NOT EXISTS course_prerequisites (
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    prerequisite_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    order_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, prerequisite_course_id),
    CHECK (course_id != prerequisite_course_id)
);

-- Course categories/tags (AXLE, Writing, FYS, etc.)
CREATE TABLE IF NOT EXISTS course_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Course-to-category mapping (many-to-many)
CREATE TABLE IF NOT EXISTS course_category_mapping (
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES course_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, category_id)
);

-- =============================================================================
-- GRADING INFORMATION
-- =============================================================================

-- Grading breakdown components (e.g., Midterm 25%, Final 25%, Projects 30%)
CREATE TABLE IF NOT EXISTS grading_breakdown (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    component_name VARCHAR(100) NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Grade distribution (percentage of students receiving each grade)
CREATE TABLE IF NOT EXISTS grade_distribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    grade_letter grade_letter_type NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_section_id, grade_letter)
);

-- =============================================================================
-- REVIEWS & FEEDBACK
-- =============================================================================

-- Course reviews (tied to specific course sections)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Ratings
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 5),
    grade_received grade_letter_type,

    -- Review content
    text TEXT NOT NULL,
    first_impression_word VARCHAR(50),

    -- Student perspective
    hours_per_week NUMERIC(5, 2) CHECK (hours_per_week >= 0),
    would_take_again BOOLEAN,
    attendance_required BOOLEAN,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(course_section_id, user_id)
);

-- Review votes (e.g., Helpful count in UI)
CREATE TABLE IF NOT EXISTS review_votes (
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type review_vote_type NOT NULL DEFAULT 'helpful',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (review_id, user_id, vote_type)
);

-- Optional: comments/discussion (matches “Comments” tab concept)
-- If you want comments per-course rather than per-review, change review_id -> course_id.
CREATE TABLE IF NOT EXISTS review_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Normalized tags (predefined + consistent)
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    category_type VARCHAR(50), -- e.g., "workload", "teaching_style", "assessment"
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_tag_mapping (
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (review_id, tag_id)
);

-- =============================================================================
-- SCHEDULES (TERM-AWARE CART + MULTIPLE SCHEDULES)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'My Schedule',
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enforce at most one "primary" schedule per user per term
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_primary_schedule_per_term
ON user_schedules (user_id, term_id)
WHERE is_primary = TRUE;

CREATE TABLE IF NOT EXISTS user_schedule_items (
    schedule_id UUID NOT NULL REFERENCES user_schedules(id) ON DELETE CASCADE,
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    color VARCHAR(7), -- Hex color for calendar display
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (schedule_id, course_section_id),
    CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- =============================================================================
-- USER PROFILES & PREFERENCES
-- =============================================================================

-- Extended user profile (1-to-1 with users)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,

    -- Academics
    major_1 VARCHAR(100),
    major_2 VARCHAR(100),
    minor_1 VARCHAR(100),
    minor_2 VARCHAR(100),
    departments_of_interest TEXT[] DEFAULT '{}',
    favorite_subjects TEXT[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User course preferences (1-to-1 with users)
CREATE TABLE IF NOT EXISTS user_course_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    preferred_times time_of_day_type[] DEFAULT '{}',
    preferred_days day_of_week_type[] DEFAULT '{}',
    max_effort_level INTEGER CHECK (max_effort_level IS NULL OR (max_effort_level >= 1 AND max_effort_level <= 5)),
    preferred_class_size VARCHAR(20) CHECK (preferred_class_size IS NULL OR preferred_class_size IN ('small', 'medium', 'large', 'any')),
    preferred_work_types TEXT[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Courses the user has already taken (many-to-many)
CREATE TABLE IF NOT EXISTS user_courses_taken (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_id)
);

-- Indexes for profile tables
CREATE INDEX IF NOT EXISTS idx_user_courses_taken_user ON user_courses_taken(user_id);
CREATE INDEX IF NOT EXISTS idx_user_courses_taken_course ON user_courses_taken(course_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_course_preferences_updated_at ON user_course_preferences;
CREATE TRIGGER update_user_course_preferences_updated_at
BEFORE UPDATE ON user_course_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FILES / SYLLABI
-- =============================================================================

CREATE TABLE IF NOT EXISTS course_syllabi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),

    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(course_section_id, file_name)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- Courses search/filters
CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_courses_rating ON courses(rating DESC);
CREATE INDEX IF NOT EXISTS idx_courses_name ON courses(name);
CREATE INDEX IF NOT EXISTS idx_courses_name_trgm ON courses USING gin(name gin_trgm_ops);

-- Terms
CREATE INDEX IF NOT EXISTS idx_terms_year_season ON terms(year, season);

-- Sections
CREATE INDEX IF NOT EXISTS idx_course_sections_course ON course_sections(course_id);
CREATE INDEX IF NOT EXISTS idx_course_sections_term ON course_sections(term_id);
CREATE INDEX IF NOT EXISTS idx_section_instructors_prof ON section_instructors(professor_id);
CREATE INDEX IF NOT EXISTS idx_section_instructors_section ON section_instructors(course_section_id);

-- Meetings (schedule grid / conflict checks)
CREATE INDEX IF NOT EXISTS idx_section_meetings_section_day_time
ON section_meetings(course_section_id, day, start_time);

CREATE INDEX IF NOT EXISTS idx_section_meetings_time_of_day
ON section_meetings(time_of_day);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_course_section ON reviews(course_section_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);

-- Helpful votes
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes(review_id);

-- Review comments
CREATE INDEX IF NOT EXISTS idx_review_comments_review ON review_comments(review_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_created ON review_comments(created_at DESC);

-- Schedule
CREATE INDEX IF NOT EXISTS idx_user_schedules_user_term ON user_schedules(user_id, term_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_section ON user_schedule_items(course_section_id);

-- Tags
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_review_tag_mapping_tag ON review_tag_mapping(tag_id);

-- Grading
CREATE INDEX IF NOT EXISTS idx_grading_breakdown_section ON grading_breakdown(course_section_id);
CREATE INDEX IF NOT EXISTS idx_grade_distribution_section ON grade_distribution(course_section_id);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- update_updated_at helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_professors_updated_at ON professors;
CREATE TRIGGER update_professors_updated_at
BEFORE UPDATE ON professors
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_terms_updated_at ON terms;
CREATE TRIGGER update_terms_updated_at
BEFORE UPDATE ON terms
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_course_sections_updated_at ON course_sections;
CREATE TRIGGER update_course_sections_updated_at
BEFORE UPDATE ON course_sections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_section_meetings_updated_at ON section_meetings;
CREATE TRIGGER update_section_meetings_updated_at
BEFORE UPDATE ON section_meetings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_review_comments_updated_at ON review_comments;
CREATE TRIGGER update_review_comments_updated_at
BEFORE UPDATE ON review_comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_schedules_updated_at ON user_schedules;
CREATE TRIGGER update_user_schedules_updated_at
BEFORE UPDATE ON user_schedules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FUNCTIONS FOR DERIVED DATA
-- =============================================================================

-- Optional: compute time_of_day based on start_time
CREATE OR REPLACE FUNCTION compute_time_of_day(t TIME)
RETURNS time_of_day_type AS $$
BEGIN
    -- Tune these thresholds as desired
    IF t < TIME '09:00' THEN
        RETURN 'Early AM';
    ELSIF t < TIME '12:00' THEN
        RETURN 'Morning';
    ELSIF t < TIME '17:00' THEN
        RETURN 'Afternoon';
    ELSE
        RETURN 'Evening';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to set section_meetings.time_of_day from start_time
CREATE OR REPLACE FUNCTION set_meeting_time_of_day()
RETURNS TRIGGER AS $$
BEGIN
    NEW.time_of_day = compute_time_of_day(NEW.start_time);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_section_meetings_time_of_day ON section_meetings;
CREATE TRIGGER set_section_meetings_time_of_day
BEFORE INSERT OR UPDATE OF start_time ON section_meetings
FOR EACH ROW EXECUTE FUNCTION set_meeting_time_of_day();

-- =============================================================================
-- FUNCTIONS FOR AGGREGATE STATISTICS
-- =============================================================================

-- Recalculate course aggregate statistics (from reviews across ALL sections)
CREATE OR REPLACE FUNCTION refresh_course_statistics(target_course_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE courses
    SET
        review_count = (
            SELECT COUNT(*)
            FROM reviews r
            JOIN course_sections cs ON r.course_section_id = cs.id
            WHERE cs.course_id = target_course_id
        ),
        rating = (
            SELECT ROUND(AVG(r.rating)::numeric, 2)
            FROM reviews r
            JOIN course_sections cs ON r.course_section_id = cs.id
            WHERE cs.course_id = target_course_id
        ),
        avg_hours_per_week = (
            SELECT ROUND(AVG(r.hours_per_week)::numeric, 2)
            FROM reviews r
            JOIN course_sections cs ON r.course_section_id = cs.id
            WHERE cs.course_id = target_course_id
              AND r.hours_per_week IS NOT NULL
        ),
        difficulty_rating = (
            SELECT ROUND(AVG(r.difficulty)::numeric, 2)
            FROM reviews r
            JOIN course_sections cs ON r.course_section_id = cs.id
            WHERE cs.course_id = target_course_id
        ),
        would_take_again_percentage = (
            SELECT ROUND(
                (SUM(CASE WHEN r.would_take_again THEN 1 ELSE 0 END)::numeric
                 / NULLIF(SUM(CASE WHEN r.would_take_again IS NULL THEN 0 ELSE 1 END), 0)) * 100
            , 2)
            FROM reviews r
            JOIN course_sections cs ON r.course_section_id = cs.id
            WHERE cs.course_id = target_course_id
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = target_course_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger wrapper for refresh_course_statistics on review changes
CREATE OR REPLACE FUNCTION trigger_refresh_course_statistics()
RETURNS TRIGGER AS $$
DECLARE
    affected_course_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT cs.course_id INTO affected_course_id
        FROM course_sections cs
        WHERE cs.id = OLD.course_section_id;
    ELSE
        SELECT cs.course_id INTO affected_course_id
        FROM course_sections cs
        WHERE cs.id = NEW.course_section_id;
    END IF;

    IF affected_course_id IS NOT NULL THEN
        PERFORM refresh_course_statistics(affected_course_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS review_statistics_trigger ON reviews;
CREATE TRIGGER review_statistics_trigger
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION trigger_refresh_course_statistics();

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Common course categories
INSERT INTO course_categories (name, description) VALUES
    ('AXLE', 'Vanderbilt AXLE general education requirement'),
    ('Writing', 'Writing-intensive course'),
    ('FYS', 'First Year Seminar'),
    ('Lab', 'Includes laboratory component'),
    ('Capstone', 'Senior capstone course'),
    ('Honors', 'Honors-level course')
ON CONFLICT (name) DO NOTHING;

-- Common tags (normalized)
INSERT INTO tags (name, category_type) VALUES
    ('Exam Heavy', 'workload'),
    ('Project Heavy', 'workload'),
    ('Paper Heavy', 'workload'),
    ('Discussion-based', 'workload'),
    ('Challenging Projects', 'difficulty'),
    ('Great Professor', 'teaching_style'),
    ('Helpful Office Hours', 'teaching_style'),
    ('Time-Consuming', 'effort'),
    ('Clear Lectures', 'teaching_style'),
    ('Fair Grading', 'assessment'),
    ('Heavy Debugging', 'difficulty'),
    ('Group Work', 'assessment')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- NOTES FOR DEVELOPERS
-- =============================================================================
/*
Implementation notes:

1) Scheduling:
   - Use section_meetings to render the weekly grid and detect conflicts.
   - For “time of day” filters, use section_meetings.time_of_day (auto-derived) or compute in query.

2) Professors:
   - section_instructors supports multiple professors per section.
   - If you only ever have one professor, you can still use it; treat the single instructor as the primary.

3) Schedules:
   - user_schedules + user_schedule_items is your “cart + schedule” system.
   - UI can show the primary schedule by term; users can create alternates.

4) Helpful counts:
   - Helpful count is COUNT(*) from review_votes where vote_type='helpful'.

5) Search:
   - pg_trgm enabled; idx_courses_name_trgm supports fuzzy course name search.
*/
