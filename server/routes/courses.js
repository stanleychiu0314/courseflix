const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/courses
 * Fetch courses with optional search, filters, and sorting
 *
 * Query params:
 * - search: search term for course name, code, or professor
 * - department: department code (e.g., "CS")
 * - term: term label (e.g., "Spring 2026")
 * - days: comma-separated days filter (e.g., "Mon,Wed,Fri")
 * - times: comma-separated time periods (e.g., "Morning,Afternoon")
 * - categories: comma-separated categories (e.g., "AXLE,Writing")
 * - sort: sort field (rating, hours, size)
 * - order: sort order (asc, desc)
 */
router.get('/', async (req, res) => {
  try {
    const { search, department, term, days, times, categories, sort, order } = req.query;

    let query = `
      SELECT DISTINCT ON (c.id, cs.id)
        c.id,
        c.code,
        c.name,
        c.description,
        c.credits,
        c.rating,
        c.review_count,
        c.avg_hours_per_week,
        c.difficulty_rating,
        c.would_take_again_percentage,
        d.code as department_code,
        d.name as department_name,
        cs.id as section_id,
        cs.max_seats,
        cs.enrolled_count,
        cs.attendance_policy,
        t.label as term_label,
        (
          SELECT string_agg(p.name, ', ')
          FROM section_instructors si
          JOIN professors p ON si.professor_id = p.id
          WHERE si.course_section_id = cs.id
        ) as professors,
        (
          SELECT json_agg(json_build_object(
            'day', sm.day::text,
            'start_time', sm.start_time::text,
            'end_time', sm.end_time::text,
            'time_of_day', sm.time_of_day::text
          ))
          FROM section_meetings sm
          WHERE sm.course_section_id = cs.id
        ) as meetings,
        (
          SELECT array_agg(DISTINCT tg.name)
          FROM reviews r
          JOIN review_tag_mapping rtm ON r.id = rtm.review_id
          JOIN tags tg ON rtm.tag_id = tg.id
          WHERE r.course_section_id = cs.id
        ) as tags
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN course_sections cs ON c.id = cs.course_id
      LEFT JOIN terms t ON cs.term_id = t.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Search filter
    if (search) {
      query += ` AND (
        c.name ILIKE $${paramIndex}
        OR c.code ILIKE $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM section_instructors si
          JOIN professors p ON si.professor_id = p.id
          WHERE si.course_section_id = cs.id AND p.name ILIKE $${paramIndex}
        )
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Department filter
    if (department && department !== 'All Departments') {
      query += ` AND d.name = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    // Term filter
    if (term) {
      query += ` AND t.label = $${paramIndex}`;
      params.push(term);
      paramIndex++;
    }

    // Days filter
    if (days) {
      const daysList = days.split(',').map(d => {
        const dayMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday' };
        return dayMap[d] || d;
      });
      query += ` AND EXISTS (
        SELECT 1 FROM section_meetings sm
        WHERE sm.course_section_id = cs.id
        AND sm.day = ANY($${paramIndex}::day_of_week_type[])
      )`;
      params.push(daysList);
      paramIndex++;
    }

    // Time periods filter
    if (times) {
      const timesList = times.split(',');
      query += ` AND EXISTS (
        SELECT 1 FROM section_meetings sm
        WHERE sm.course_section_id = cs.id
        AND sm.time_of_day = ANY($${paramIndex}::time_of_day_type[])
      )`;
      params.push(timesList);
      paramIndex++;
    }

    // Categories filter
    if (categories) {
      const categoriesList = categories.split(',');
      query += ` AND EXISTS (
        SELECT 1 FROM course_category_mapping ccm
        JOIN course_categories cc ON ccm.category_id = cc.id
        WHERE ccm.course_id = c.id
        AND cc.name = ANY($${paramIndex})
      )`;
      params.push(categoriesList);
      paramIndex++;
    }

    // Sorting - DISTINCT ON requires ORDER BY to start with the DISTINCT columns
    const sortField = {
      'Rating': 'c.rating',
      'Avg Hours/Week': 'c.avg_hours_per_week',
      'Class Size': 'cs.max_seats'
    }[sort] || 'c.rating';

    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY c.id, cs.id, ${sortField} ${sortOrder} NULLS LAST`;

    const result = await db.query(query, params);

    // Format the response to match frontend expectations
    const courses = result.rows.map(row => ({
      id: row.id,
      sectionId: row.section_id,
      code: row.code,
      name: row.name,
      description: row.description,
      credits: row.credits,
      professor: row.professors || 'TBA',
      schedule: formatSchedule(row.meetings),
      location: 'TBA', // Location would need to be added to section_meetings if needed
      avgHoursWeek: parseFloat(row.avg_hours_per_week) || 0,
      effortLevel: parseFloat(row.difficulty_rating) || 0,
      classSize: row.max_seats ? String(row.max_seats) : 'N/A',
      rating: parseFloat(row.rating) || 0,
      difficulty: getDifficultyLabel(row.difficulty_rating),
      tags: row.tags || [],
      departmentCode: row.department_code,
      departmentName: row.department_name,
      termLabel: row.term_label,
      reviewCount: row.review_count || 0,
      wouldTakeAgain: row.would_take_again_percentage
    }));

    res.json(courses);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

/**
 * GET /api/courses/:id
 * Fetch detailed information for a single course
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { term } = req.query;

    // Get course details
    const courseQuery = `
      SELECT
        c.id,
        c.code,
        c.name,
        c.description,
        c.credits,
        c.rating,
        c.review_count,
        c.avg_hours_per_week,
        c.difficulty_rating,
        c.would_take_again_percentage,
        d.code as department_code,
        d.name as department_name
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      WHERE c.id = $1
    `;

    const courseResult = await db.query(courseQuery, [id]);

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];

    // Get section details for the specified term (or most recent)
    let sectionQuery = `
      SELECT
        cs.id as section_id,
        cs.max_seats,
        cs.enrolled_count,
        cs.attendance_policy,
        cs.absences_allowed,
        t.label as term_label,
        (
          SELECT string_agg(p.name, ', ')
          FROM section_instructors si
          JOIN professors p ON si.professor_id = p.id
          WHERE si.course_section_id = cs.id
        ) as professors,
        (
          SELECT json_agg(json_build_object(
            'day', sm.day,
            'start_time', sm.start_time,
            'end_time', sm.end_time
          ))
          FROM section_meetings sm
          WHERE sm.course_section_id = cs.id
        ) as meetings
      FROM course_sections cs
      JOIN terms t ON cs.term_id = t.id
      WHERE cs.course_id = $1
    `;

    const sectionParams = [id];
    if (term) {
      sectionQuery += ` AND t.label = $2`;
      sectionParams.push(term);
    }
    sectionQuery += ` ORDER BY t.year DESC, t.season DESC LIMIT 1`;

    const sectionResult = await db.query(sectionQuery, sectionParams);
    const section = sectionResult.rows[0] || {};

    // Extract prerequisites from description text
    const prerequisites = extractPrerequisites(course.description);

    // Get grade distribution for this section
    const gradeDistQuery = `
      SELECT grade_letter, percentage
      FROM grade_distribution
      WHERE course_section_id = $1
      ORDER BY
        CASE grade_letter
          WHEN 'A' THEN 1
          WHEN 'A-' THEN 2
          WHEN 'B+' THEN 3
          WHEN 'B' THEN 4
          WHEN 'B-' THEN 5
          WHEN 'C+' THEN 6
          WHEN 'C' THEN 7
          WHEN 'C-' THEN 8
          WHEN 'D+' THEN 9
          WHEN 'D' THEN 10
          WHEN 'D-' THEN 11
          WHEN 'F' THEN 12
        END
    `;
    const gradeDistResult = section.section_id
      ? await db.query(gradeDistQuery, [section.section_id])
      : { rows: [] };

    const gradeDistribution = {};
    gradeDistResult.rows.forEach(r => {
      gradeDistribution[r.grade_letter] = parseFloat(r.percentage);
    });

    // Get grade breakdown
    const gradeBreakdownQuery = `
      SELECT component_name, percentage
      FROM grading_breakdown
      WHERE course_section_id = $1
      ORDER BY percentage DESC
    `;
    const gradeBreakdownResult = section.section_id
      ? await db.query(gradeBreakdownQuery, [section.section_id])
      : { rows: [] };

    const gradeBreakdown = gradeBreakdownResult.rows.map(r => ({
      name: r.component_name,
      percentage: parseFloat(r.percentage)
    }));

    // Get top tags from reviews
    const tagsQuery = `
      SELECT t.name, COUNT(*) as count
      FROM reviews r
      JOIN course_sections cs ON r.course_section_id = cs.id
      JOIN review_tag_mapping rtm ON r.id = rtm.review_id
      JOIN tags t ON rtm.tag_id = t.id
      WHERE cs.course_id = $1
      GROUP BY t.name
      ORDER BY count DESC
      LIMIT 10
    `;
    const tagsResult = await db.query(tagsQuery, [id]);
    const commentHighlights = tagsResult.rows.map(r => r.name);

    // Format response
    const response = {
      id: course.id,
      code: course.code,
      name: course.name,
      description: course.description,
      credits: course.credits,
      maxSeats: section.max_seats || 0,
      professor: section.professors || 'TBA',
      schedule: formatSchedule(section.meetings),
      location: 'TBA',
      rating: parseFloat(course.rating) || 0,
      reviewCount: course.review_count || 0,
      prerequisites,
      commentHighlights,
      gradeDistribution,
      gradeBreakdown,
      avgHoursPerWeek: parseFloat(course.avg_hours_per_week) || 0,
      difficulty: `${Math.round(parseFloat(course.difficulty_rating) || 0)}/5`,
      wouldTakeAgain: course.would_take_again_percentage
        ? `${Math.round(course.would_take_again_percentage)}%`
        : 'N/A',
      attendancePolicy: section.attendance_policy || 'flexible',
      absencesAllowed: section.absences_allowed || 0,
      termLabel: section.term_label,
      departmentCode: course.department_code,
      departmentName: course.department_name
    };

    res.json(response);
  } catch (err) {
    console.error('Error fetching course details:', err);
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
});

/**
 * GET /api/courses/:id/reviews
 * Fetch reviews for a course
 */
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        r.id,
        r.rating,
        r.difficulty,
        r.grade_received,
        r.text,
        r.hours_per_week,
        r.would_take_again,
        r.created_at,
        t.label as term_label,
        (
          SELECT array_agg(tg.name)
          FROM review_tag_mapping rtm
          JOIN tags tg ON rtm.tag_id = tg.id
          WHERE rtm.review_id = r.id
        ) as tags,
        (
          SELECT COUNT(*)
          FROM review_votes rv
          WHERE rv.review_id = r.id AND rv.vote_type = 'helpful'
        ) as helpful_count
      FROM reviews r
      JOIN course_sections cs ON r.course_section_id = cs.id
      JOIN terms t ON cs.term_id = t.id
      WHERE cs.course_id = $1
      ORDER BY r.created_at DESC
    `;

    const result = await db.query(query, [id]);

    const reviews = result.rows.map(row => ({
      id: row.id,
      rating: row.rating,
      difficulty: `${row.difficulty}/5`,
      grade: row.grade_received || 'N/A',
      text: row.text,
      date: formatReviewDate(row.created_at, row.term_label),
      tags: row.tags || [],
      helpfulCount: parseInt(row.helpful_count) || 0,
      hoursPerWeek: row.hours_per_week,
      wouldTakeAgain: row.would_take_again
    }));

    res.json(reviews);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Helper functions
function formatSchedule(meetings) {
  if (!meetings || !Array.isArray(meetings) || meetings.length === 0) {
    return 'TBA';
  }

  const dayAbbrev = {
    'Monday': 'M',
    'Tuesday': 'T',
    'Wednesday': 'W',
    'Thursday': 'Th',
    'Friday': 'F',
    'Saturday': 'Sa',
    'Sunday': 'Su'
  };

  const days = [...new Set(meetings.map(m => dayAbbrev[m.day] || m.day))].join('');
  const firstMeeting = meetings[0];
  const startTime = formatTime(firstMeeting.start_time);
  const endTime = formatTime(firstMeeting.end_time);

  return `${days} ${startTime}-${endTime}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const suffix = hour >= 12 ? 'p' : 'a';
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes}${suffix}`;
}

function getDifficultyLabel(rating) {
  if (!rating) return 'N/A';
  const r = parseFloat(rating);
  if (r >= 4.5) return 'Very Hard';
  if (r >= 3.5) return 'Hard';
  if (r >= 2.5) return 'Moderate';
  if (r >= 1.5) return 'Easy';
  return 'Very Easy';
}

function formatReviewDate(createdAt, termLabel) {
  const now = new Date();
  const reviewDate = new Date(createdAt);
  const diffTime = Math.abs(now - reviewDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let timeAgo;
  if (diffDays < 7) {
    timeAgo = diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    timeAgo = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    timeAgo = months === 1 ? '1 month ago' : `${months} months ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    timeAgo = years === 1 ? '1 year ago' : `${years} years ago`;
  }

  return `${termLabel} • ${timeAgo}`;
}

function extractPrerequisites(description) {
  if (!description) return null;

  // Look for "Prerequisite:" or "Prerequisites:" in the description
  const prereqMatch = description.match(/Prerequisites?:\s*([^.\[\]]+)/i);

  if (!prereqMatch) return null;

  // Return the raw prerequisite string as-is
  return prereqMatch[1].trim();
}

module.exports = router;
