-- CourseFlix Database Schema v1
-- PostgreSQL Schema for Course Review and Scheduling Platform
-- Created: 2026-01-22

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

-- User authentication provider types
CREATE TYPE oauth_provider_type AS ENUM ('google', 'github');

-- Course attendance policy
CREATE TYPE attendance_policy_type AS ENUM ('flexible', 'strict');

-- Grade letter grades
CREATE TYPE grade_letter_type AS ENUM ('A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F');

-- Days of the week for scheduling
CREATE TYPE day_of_week_type AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');

-- Time of day categories for filtering
CREATE TYPE time_of_day_type AS ENUM ('Early AM', 'Morning', 'Afternoon', 'Evening');

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Users table for authentication and user management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- NULL if OAuth user
    name VARCHAR(255) NOT NULL,
    oauth_provider oauth_provider_type, -- NULL if email/password user
    oauth_id VARCHAR(255), -- External OAuth provider ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT oauth_consistency CHECK (
        (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL AND password_hash IS NULL)
        OR (oauth_provider IS NULL AND oauth_id IS NULL AND password_hash IS NOT NULL)
    )
);

-- Departments table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) NOT NULL UNIQUE, -- e.g., "CS", "ECON"
    name VARCHAR(255) NOT NULL, -- e.g., "Computer Science"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Professors table
CREATE TABLE professors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Courses table (general course information, not specific sections)
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL, -- e.g., "CS 2201", "ECON 1010"
    name VARCHAR(255) NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    description TEXT,
    credits INTEGER NOT NULL CHECK (credits > 0 AND credits <= 6),

    -- Cached aggregate statistics (computed from reviews and sections)
    rating DECIMAL(3, 2) CHECK (rating >= 0 AND rating <= 5),
    review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
    avg_hours_per_week DECIMAL(4, 2) CHECK (avg_hours_per_week >= 0),
    difficulty_rating DECIMAL(3, 2) CHECK (difficulty_rating >= 0 AND difficulty_rating <= 5),
    would_take_again_percentage DECIMAL(5, 2) CHECK (would_take_again_percentage >= 0 AND would_take_again_percentage <= 100),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(code, department_id)
);

-- =============================================================================
-- COURSE SECTIONS & SCHEDULING
-- =============================================================================

-- Course sections (specific offerings with professor, time, location, semester)
CREATE TABLE course_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    professor_id UUID REFERENCES professors(id) ON DELETE SET NULL,

    -- Semester and scheduling
    semester VARCHAR(50) NOT NULL, -- e.g., "Spring 2026", "Fall 2025"
    location VARCHAR(100), -- e.g., "FGH 134"
    schedule_days VARCHAR(10), -- e.g., "MWF", "TTh"
    start_time TIME,
    end_time TIME,
    time_of_day time_of_day_type, -- Computed/set based on start_time

    -- Enrollment
    max_seats INTEGER NOT NULL CHECK (max_seats > 0),
    enrolled_count INTEGER DEFAULT 0 CHECK (enrolled_count >= 0 AND enrolled_count <= max_seats),

    -- Section-specific policies
    attendance_policy attendance_policy_type DEFAULT 'flexible',
    absences_allowed INTEGER DEFAULT 0 CHECK (absences_allowed >= 0),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(course_id, professor_id, semester, schedule_days, start_time)
);

-- =============================================================================
-- COURSE RELATIONSHIPS
-- =============================================================================

-- Course prerequisites (many-to-many)
CREATE TABLE course_prerequisites (
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    prerequisite_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    order_number INTEGER DEFAULT 1, -- Sequence of prerequisites
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (course_id, prerequisite_course_id),
    CHECK (course_id != prerequisite_course_id)
);

-- Course categories/tags (AXLE, Writing, FYS, etc.)
CREATE TABLE course_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Course-to-category mapping (many-to-many)
CREATE TABLE course_category_mapping (
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES course_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (course_id, category_id)
);

-- =============================================================================
-- GRADING INFORMATION
-- =============================================================================

-- Grading breakdown components (e.g., Midterm 25%, Final 25%, Projects 30%)
CREATE TABLE grading_breakdown (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    component_name VARCHAR(100) NOT NULL, -- e.g., "Midterm Exam", "Final Exam"
    percentage DECIMAL(5, 2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Grade distribution (percentage of students receiving each grade)
CREATE TABLE grade_distribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    grade_letter grade_letter_type NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(course_section_id, grade_letter)
);

-- =============================================================================
-- REVIEWS & FEEDBACK
-- =============================================================================

-- Course reviews (tied to specific course sections)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Ratings
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    difficulty INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 5),
    grade_received grade_letter_type,

    -- Review content
    text TEXT NOT NULL,
    first_impression_word VARCHAR(50), -- One-word summary

    -- Course details from student perspective
    hours_per_week DECIMAL(4, 2) CHECK (hours_per_week >= 0),
    would_take_again BOOLEAN,
    attendance_required BOOLEAN,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- One review per user per course section
    UNIQUE(course_section_id, user_id)
);

-- Review tags (e.g., "Exam Heavy", "Project Heavy", "Great Professor")
CREATE TABLE review_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Predefined tag categories for consistency
CREATE TABLE tag_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    category_type VARCHAR(50), -- e.g., "workload", "teaching_style", "assessment"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- USER INTERACTION TABLES
-- =============================================================================

-- User's shopping cart (courses they plan to take)
CREATE TABLE user_cart (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    color VARCHAR(7), -- Hex color for calendar display (e.g., "#FF5733")
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, course_section_id),
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Course syllabi uploads
CREATE TABLE course_syllabi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_section_id UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL, -- S3 or file storage path
    file_size INTEGER NOT NULL CHECK (file_size > 0), -- in bytes

    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate uploads of the same file
    UNIQUE(course_section_id, file_name)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);

-- Course searches and filters
CREATE INDEX idx_courses_department ON courses(department_id);
CREATE INDEX idx_courses_code ON courses(code);
CREATE INDEX idx_courses_rating ON courses(rating DESC);
CREATE INDEX idx_courses_name ON courses(name);
CREATE INDEX idx_courses_name_trgm ON courses USING gin(name gin_trgm_ops); -- For fuzzy search (requires pg_trgm extension)

-- Course section lookups
CREATE INDEX idx_course_sections_course ON course_sections(course_id);
CREATE INDEX idx_course_sections_professor ON course_sections(professor_id);
CREATE INDEX idx_course_sections_semester ON course_sections(semester);
CREATE INDEX idx_course_sections_time ON course_sections(time_of_day);

-- Review lookups
CREATE INDEX idx_reviews_course_section ON reviews(course_section_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- Cart lookups
CREATE INDEX idx_user_cart_user ON user_cart(user_id);
CREATE INDEX idx_user_cart_section ON user_cart(course_section_id);

-- Tag searches
CREATE INDEX idx_review_tags_review ON review_tags(review_id);
CREATE INDEX idx_review_tags_tag ON review_tags(tag);

-- Grading lookups
CREATE INDEX idx_grading_breakdown_section ON grading_breakdown(course_section_id);
CREATE INDEX idx_grade_distribution_section ON grade_distribution(course_section_id);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_sections_updated_at BEFORE UPDATE ON course_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_professors_updated_at BEFORE UPDATE ON professors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FUNCTIONS FOR AGGREGATE STATISTICS
-- =============================================================================

-- Function to recalculate course aggregate statistics
-- Call this after reviews are added/updated/deleted
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
        ),
        difficulty_rating = (
            SELECT ROUND(AVG(r.difficulty)::numeric, 2)
            FROM reviews r
            JOIN course_sections cs ON r.course_section_id = cs.id
            WHERE cs.course_id = target_course_id
        ),
        would_take_again_percentage = (
            SELECT ROUND((SUM(CASE WHEN r.would_take_again THEN 1 ELSE 0 END)::numeric
                        / NULLIF(COUNT(*), 0)) * 100, 2)
            FROM reviews r
            JOIN course_sections cs ON r.course_section_id = cs.id
            WHERE cs.course_id = target_course_id
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = target_course_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh course statistics when reviews change
CREATE OR REPLACE FUNCTION trigger_refresh_course_statistics()
RETURNS TRIGGER AS $$
DECLARE
    affected_course_id UUID;
BEGIN
    -- Get the course_id from the course_section
    IF TG_OP = 'DELETE' THEN
        SELECT cs.course_id INTO affected_course_id
        FROM course_sections cs
        WHERE cs.id = OLD.course_section_id;
    ELSE
        SELECT cs.course_id INTO affected_course_id
        FROM course_sections cs
        WHERE cs.id = NEW.course_section_id;
    END IF;

    -- Refresh statistics for the affected course
    PERFORM refresh_course_statistics(affected_course_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_statistics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_course_statistics();

-- =============================================================================
-- SAMPLE DATA CATEGORIES
-- =============================================================================

-- Insert common course categories
INSERT INTO course_categories (name, description) VALUES
    ('AXLE', 'Vanderbilt AXLE general education requirement'),
    ('Writing', 'Writing-intensive course'),
    ('FYS', 'First Year Seminar'),
    ('Lab', 'Includes laboratory component'),
    ('Capstone', 'Senior capstone course'),
    ('Honors', 'Honors-level course')
ON CONFLICT (name) DO NOTHING;

-- Insert common review tags
INSERT INTO tag_categories (name, category_type) VALUES
    ('Exam Heavy', 'workload'),
    ('Project Heavy', 'workload'),
    ('Paper Heavy', 'workload'),
    ('Discussion-based', 'workload'),
    ('Challenging Projects', 'difficulty'),
    ('Great Professor', 'teaching_style'),
    ('Helpful Office Hours', 'teaching_style'),
    ('Time-Consuming', 'effort'),
    ('Flexible Attendance', 'policy'),
    ('Group Work', 'assessment')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- NOTES FOR DEVELOPERS
-- =============================================================================

/*
IMPORTANT IMPLEMENTATION NOTES:

1. AGGREGATE STATISTICS CACHING:
   - Course-level statistics (rating, review_count, etc.) are cached in the courses table
   - These are automatically updated via triggers when reviews are added/updated/deleted
   - For bulk operations, you may want to disable triggers and manually call refresh_course_statistics()

2. FULL-TEXT SEARCH:
   - For better search performance, consider adding the pg_trgm extension:
     CREATE EXTENSION pg_trgm;
   - The idx_courses_name_trgm index is already defined for fuzzy text search

3. FILE STORAGE:
   - course_syllabi.file_url should point to cloud storage (e.g., AWS S3, Google Cloud Storage)
   - Implement file upload logic in your backend to handle S3 uploads and generate signed URLs

4. AUTHENTICATION:
   - password_hash should use bcrypt or Argon2 for secure password hashing
   - Implement JWT tokens or session management in your backend

5. TIME ZONE HANDLING:
   - All timestamps use TIMESTAMP WITH TIME ZONE
   - Store times in UTC and convert to local timezone in the frontend

6. SEMESTER FORMAT:
   - Semesters are stored as strings (e.g., "Spring 2026")
   - Consider adding a semesters table if you need more structured semester data

7. DATA VALIDATION:
   - Many constraints are enforced at the database level (CHECK constraints)
   - Additional business logic validation should be implemented in your backend API

8. PERFORMANCE CONSIDERATIONS:
   - For large datasets, consider partitioning the reviews table by semester
   - Monitor query performance and add additional indexes as needed
   - Consider materialized views for complex aggregations

9. FUTURE ENHANCEMENTS:
   - User roles and permissions (admin, moderator, student)
   - Review moderation workflow (pending, approved, rejected)
   - Course waitlists and enrollment management
   - Email notifications for cart changes and new reviews
   - User profile preferences and settings
*/
