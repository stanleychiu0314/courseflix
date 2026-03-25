\set ON_ERROR_STOP on

BEGIN;

TRUNCATE
  review_tag_mapping,
  review_votes,
  review_comments,
  reviews,
  user_schedule_items,
  user_schedules,
  user_course_preferences,
  user_profiles,
  user_courses_taken,
  section_instructors,
  section_meetings,
  course_category_mapping,
  grading_breakdown,
  grade_distribution,
  course_syllabi,
  course_sections,
  courses,
  course_categories,
  tags,
  professors,
  users,
  terms,
  departments
CASCADE;

INSERT INTO departments (id, code, name)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'CS', 'Computer Science'),
  ('00000000-0000-0000-0000-000000000102', 'MATH', 'Mathematics');

INSERT INTO terms (id, season, year, label)
VALUES
  ('00000000-0000-0000-0000-000000000201', 'Spring', 2026, 'Spring 2026');

INSERT INTO courses (id, code, name, department_id, description, credits)
VALUES
  ('00000000-0000-0000-0000-000000000301', 'CS 2201', 'Intro to Testing', '00000000-0000-0000-0000-000000000101',
   'A hands-on course testing software systems.', 4),
  ('00000000-0000-0000-0000-000000000302', 'MATH 2010', 'Calculus I', '00000000-0000-0000-0000-000000000102',
   'Fundamental concepts in differentiation and integration.', 3);

INSERT INTO professors (id, name, department_id)
VALUES
  ('00000000-0000-0000-0000-000000000401', 'Dr. Ada Lovelace', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000402', 'Prof. Carl Gauss', '00000000-0000-0000-0000-000000000102');

INSERT INTO course_sections (id, course_id, term_id, section_number, max_seats, enrolled_count, crn)
VALUES
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000301',
   '00000000-0000-0000-0000-000000000201', '001', 50, 10, '30001'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000302',
   '00000000-0000-0000-0000-000000000201', '001', 60, 5, '30002');

INSERT INTO section_instructors (course_section_id, professor_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000401', 'Primary'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000402', 'Primary');

INSERT INTO section_meetings (course_section_id, day, start_time, end_time, meeting_type, time_of_day)
VALUES
  ('00000000-0000-0000-0000-000000000501', 'Monday', '10:00:00', '11:15:00', 'lecture', 'Morning'),
  ('00000000-0000-0000-0000-000000000501', 'Wednesday', '10:00:00', '11:15:00', 'lecture', 'Morning'),
  ('00000000-0000-0000-0000-000000000501', 'Friday', '10:00:00', '11:15:00', 'lecture', 'Morning'),
  ('00000000-0000-0000-0000-000000000502', 'Tuesday', '13:30:00', '14:45:00', 'lecture', 'Afternoon'),
  ('00000000-0000-0000-0000-000000000502', 'Thursday', '13:30:00', '14:45:00', 'lecture', 'Afternoon');

INSERT INTO course_categories (id, name)
VALUES
  ('00000000-0000-0000-0000-000000000601', 'HCA'),
  ('00000000-0000-0000-0000-000000000602', 'SBS');

INSERT INTO course_category_mapping (course_id, category_id)
VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000601'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000602');

INSERT INTO tags (id, name)
VALUES
  ('00000000-0000-0000-0000-000000000701', 'Clear'),
  ('00000000-0000-0000-0000-000000000702', 'Challenging');

INSERT INTO users (id, email, password_hash, name, oauth_provider, oauth_id)
VALUES
  ('00000000-0000-0000-0000-000000000801', 'student@vanderbilt.edu', 'seed-password', 'CourseFlix Student', NULL, NULL),
  ('00000000-0000-0000-0000-000000000802', 'admin@vanderbilt.edu', 'seed-password', 'CourseFlix Admin', NULL, NULL),
  ('00000000-0000-0000-0000-000000000803', 'reviewer@vanderbilt.edu', 'seed-password', 'CourseFlix Reviewer', NULL, NULL);

INSERT INTO user_profiles (user_id, first_name, last_name)
VALUES
  ('00000000-0000-0000-0000-000000000801', 'Course', 'Student'),
  ('00000000-0000-0000-0000-000000000802', 'Course', 'Admin'),
  ('00000000-0000-0000-0000-000000000803', 'Course', 'Reviewer');

INSERT INTO reviews (id, course_section_id, user_id, rating, difficulty, grade_received, text, first_impression_word,
                     hours_per_week, would_take_again, attendance_required)
VALUES
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000501',
   '00000000-0000-0000-0000-000000000803', 4, 3, 'A', 'Great practical introduction to software quality.', 'Great', 6.5, true, false)
ON CONFLICT (course_section_id, user_id) DO NOTHING;

INSERT INTO review_tag_mapping (review_id, tag_id)
VALUES
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000701');

INSERT INTO grade_distribution (course_section_id, grade_letter, percentage)
VALUES
  ('00000000-0000-0000-0000-000000000501', 'A', 30),
  ('00000000-0000-0000-0000-000000000501', 'B', 40),
  ('00000000-0000-0000-0000-000000000501', 'C', 20),
  ('00000000-0000-0000-0000-000000000501', 'D', 10),
  ('00000000-0000-0000-0000-000000000501', 'F', 0);

INSERT INTO grading_breakdown (course_section_id, component_name, percentage)
VALUES
  ('00000000-0000-0000-0000-000000000501', 'Homework', 35),
  ('00000000-0000-0000-0000-000000000501', 'Project', 40),
  ('00000000-0000-0000-0000-000000000501', 'Final Exam', 25);

INSERT INTO user_schedules (id, user_id, term_id, name, is_primary)
VALUES
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000801',
   '00000000-0000-0000-0000-000000000201', 'My Schedule', true);

INSERT INTO user_schedule_items (schedule_id, course_section_id, color)
VALUES
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000502', '#A9D9F9');

INSERT INTO user_courses_taken (user_id, course_id)
VALUES
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000302');

COMMIT;
