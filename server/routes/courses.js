const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/courses
 * Fetch courses with optional search, filters, sorting, and pagination
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
 * - page: page number (default: 1)
 * - limit: results per page (default: 20, max: 100)
 */
router.get('/', async (req, res) => {
  try {
    const { search, department, term, days, times, categories, page, limit } = req.query;

    // Pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    let query = `
      SELECT DISTINCT ON (c.id, cs.id)
        c.id,
        c.code,
        c.name,
        c.description,
        c.credits,
        (
          SELECT ROUND(AVG(r.rating)::numeric, 2)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS rating,
        (
          SELECT COUNT(r.id)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS review_count,
        (
          SELECT ROUND(AVG(r.hours_per_week)::numeric, 2)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS avg_hours_per_week,
        (
          SELECT ROUND(AVG(r.difficulty)::numeric, 2)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS difficulty_rating,
        (
          SELECT ROUND(
            (COUNT(CASE WHEN r.would_take_again THEN 1 END) * 100.0 / NULLIF(COUNT(r.id), 0))::numeric,
            2
          )
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS would_take_again_percentage,
        d.code as department_code,
        d.name as department_name,
        cs.id as section_id,
        cs.section_title,
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
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) as tags,
        (
          SELECT csyl.id
          FROM course_syllabi csyl
          JOIN course_sections syll_cs ON syll_cs.id = csyl.course_section_id
          WHERE csyl.status = 'approved'
            AND (
              -- Any syllabus from this course (including prior years)
              syll_cs.course_id = c.id
              OR
              -- Any syllabus from a cross-listed equivalent section, including prior years
              EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_meetings base_sm ON base_sm.course_section_id = base_si.course_section_id
                JOIN section_instructors syll_si ON syll_si.professor_id = base_si.professor_id
                  AND syll_si.course_section_id = syll_cs.id
                JOIN section_meetings syll_sm ON syll_sm.course_section_id = syll_cs.id
                  AND syll_sm.day = base_sm.day
                  AND syll_sm.start_time = base_sm.start_time
                  AND syll_sm.end_time = base_sm.end_time
                WHERE base_si.course_section_id = cs.id
              )
            )
          ORDER BY csyl.uploaded_at DESC
          LIMIT 1
        ) as syllabus_id
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN course_sections cs ON c.id = cs.course_id
      LEFT JOIN terms t ON cs.term_id = t.id
    `;

    const params = [];
    let paramIndex = 1;

    // Build WHERE conditions separately so we can reuse for count query
    let whereConditions = 'WHERE 1=1';

    // Search filter
    if (search) {
      whereConditions += ` AND (
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
      whereConditions += ` AND d.name = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    // Term filter
    if (term) {
      whereConditions += ` AND t.label = $${paramIndex}`;
      params.push(term);
      paramIndex++;
    }

    // Days filter
    if (days) {
      const daysList = days.split(',').map(d => {
        const dayMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday' };
        return dayMap[d] || d;
      });
      whereConditions += ` AND EXISTS (
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
      whereConditions += ` AND EXISTS (
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
      whereConditions += ` AND EXISTS (
        SELECT 1 FROM course_category_mapping ccm
        JOIN course_categories cc ON ccm.category_id = cc.id
        WHERE ccm.course_id = c.id
        AND cc.name = ANY($${paramIndex})
      )`;
      params.push(categoriesList);
      paramIndex++;
    }

    // Append WHERE conditions to main query
    query += whereConditions;

    // DISTINCT ON requires ORDER BY to start with the DISTINCT columns
    // So we wrap the query in a subquery and apply proper sorting outside
    query += ` ORDER BY c.id, cs.id`;

    // Get total count for pagination (before applying LIMIT/OFFSET)
    // Count distinct (course_id, section_id) pairs to match main query's DISTINCT ON
    const countQuery = `
      SELECT COUNT(*) as total FROM (
        SELECT DISTINCT c.id, cs.id
        FROM courses c
        JOIN departments d ON c.department_id = d.id
        LEFT JOIN course_sections cs ON c.id = cs.course_id
        LEFT JOIN terms t ON cs.term_id = t.id
        ${whereConditions}
      ) as course_sections
    `;
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total) || 0;
    const totalPages = Math.ceil(totalCount / limitNum);

    // Wrap in subquery to apply proper sorting (alphabetical then numerical by course code)
    // and pagination
    const offset = (pageNum - 1) * limitNum;
    const sortedQuery = `
      SELECT * FROM (${query}) AS courses_subquery
      ORDER BY
        REGEXP_REPLACE(code, '[0-9]', '', 'g') ASC,
        CAST(NULLIF(REGEXP_REPLACE(code, '[^0-9]', '', 'g'), '') AS INTEGER) ASC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limitNum, offset);

    const result = await db.query(sortedQuery, params);

    // Format the response to match frontend expectations
    const courses = result.rows.map(row => ({
      id: row.id,
      sectionId: row.section_id,
      sectionTitle: row.section_title || null,
      code: row.code,
      name: row.name,
      description: row.description,
      credits: row.credits,
      professor: row.professors || 'TBA',
      schedule: formatSchedule(row.meetings),
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
      wouldTakeAgain: row.would_take_again_percentage,
      syllabusId: row.syllabus_id || null
    }));

    res.json({
      courses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages
      }
    });
  } catch (err) {
    console.error('Error fetching courses:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Failed to fetch courses', details: err.message });
  }
});

/**
 * GET /api/courses/recommended
 * Fetch personalized course recommendations based on user profile and preferences.
 * Requires authentication.
 */
router.get('/recommended', async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.session.user.id;
    const { search, department, term, days, times, categories, page, limit } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    // Fetch user profile
    const profileResult = await db.query(
      `SELECT major_1, major_2, minor_1, minor_2,
              departments_of_interest, favorite_subjects
       FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    const profile = profileResult.rows[0] || {};

    // Fetch user preferences
    const prefsResult = await db.query(
      `SELECT preferred_times::text[] as preferred_times,
              preferred_days::text[] as preferred_days,
              max_effort_level, preferred_class_size,
              preferred_work_types::text[] as preferred_work_types
       FROM user_course_preferences WHERE user_id = $1`,
      [userId]
    );
    const prefs = prefsResult.rows[0] || {};

    // Fetch courses taken (to exclude)
    const takenResult = await db.query(
      `SELECT course_id FROM user_courses_taken WHERE user_id = $1`,
      [userId]
    );
    const takenCourseIds = takenResult.rows.map(r => r.course_id);

    // Collect department names for major/minor
    const majorMinorDepts = [profile.major_1, profile.major_2, profile.minor_1, profile.minor_2]
      .filter(Boolean);

    // Collect interest department names
    const interestDepts = Array.isArray(profile.departments_of_interest)
      ? profile.departments_of_interest
      : [];

    const allDepts = [...new Set([...majorMinorDepts, ...interestDepts])];

    if (allDepts.length === 0) {
      return res.json({
        courses: [],
        pagination: { page: pageNum, limit: limitNum, totalCount: 0, totalPages: 0 }
      });
    }

    const prefTimes = Array.isArray(prefs.preferred_times) ? prefs.preferred_times : [];
    const prefDays = Array.isArray(prefs.preferred_days) ? prefs.preferred_days : [];

    const params = [];
    let paramIndex = 1;

    // $1: major/minor department names
    params.push(majorMinorDepts.length > 0 ? majorMinorDepts : ['__none__']);
    const majorMinorParam = paramIndex++;

    // $2: interest department names (excluding major/minor to avoid double-counting)
    const interestOnly = interestDepts.filter(d => !majorMinorDepts.includes(d));
    params.push(interestOnly.length > 0 ? interestOnly : ['__none__']);
    const interestParam = paramIndex++;

    // $3: taken course IDs to exclude
    params.push(takenCourseIds.length > 0 ? takenCourseIds : ['00000000-0000-0000-0000-000000000000']);
    const takenParam = paramIndex++;

    // $4: preferred times for scoring
    params.push(prefTimes.length > 0 ? prefTimes : ['__none__']);
    const timesParam = paramIndex++;

    // $5: preferred days for scoring
    params.push(prefDays.length > 0 ? prefDays : ['__none__']);
    const daysParam = paramIndex++;

    let innerQuery = `
      SELECT DISTINCT ON (c.id, cs.id)
        c.id,
        c.code,
        c.name,
        c.description,
        c.credits,
        (
          SELECT ROUND(AVG(r.rating)::numeric, 2)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS rating,
        (
          SELECT COUNT(r.id)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS review_count,
        (
          SELECT ROUND(AVG(r.hours_per_week)::numeric, 2)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS avg_hours_per_week,
        (
          SELECT ROUND(AVG(r.difficulty)::numeric, 2)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS difficulty_rating,
        (
          SELECT ROUND(
            (COUNT(CASE WHEN r.would_take_again THEN 1 END) * 100.0 / NULLIF(COUNT(r.id), 0))::numeric,
            2
          )
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) AS would_take_again_percentage,
        d.code as department_code,
        d.name as department_name,
        cs.id as section_id,
        cs.section_title,
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
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
            AND (
              rev_cs.id = cs.id
              OR EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_instructors rev_si ON rev_si.professor_id = base_si.professor_id
                  AND rev_si.course_section_id = rev_cs.id
                WHERE base_si.course_section_id = cs.id
              )
            )
        ) as tags,
        (
          SELECT csyl.id
          FROM course_syllabi csyl
          JOIN course_sections syll_cs ON syll_cs.id = csyl.course_section_id
          WHERE csyl.status = 'approved'
            AND (
              -- Any syllabus from this course (including prior years)
              syll_cs.course_id = c.id
              OR
              -- Any syllabus from a cross-listed equivalent section, including prior years
              EXISTS (
                SELECT 1
                FROM section_instructors base_si
                JOIN section_meetings base_sm ON base_sm.course_section_id = base_si.course_section_id
                JOIN section_instructors syll_si ON syll_si.professor_id = base_si.professor_id
                  AND syll_si.course_section_id = syll_cs.id
                JOIN section_meetings syll_sm ON syll_sm.course_section_id = syll_cs.id
                  AND syll_sm.day = base_sm.day
                  AND syll_sm.start_time = base_sm.start_time
                  AND syll_sm.end_time = base_sm.end_time
                WHERE base_si.course_section_id = cs.id
              )
            )
          ORDER BY csyl.uploaded_at DESC
          LIMIT 1
        ) as syllabus_id,
        CASE
          WHEN d.name = ANY($${majorMinorParam}) THEN 1
          WHEN d.name = ANY($${interestParam}) THEN 2
          ELSE 3
        END as priority,
        COALESCE((
          SELECT COUNT(*)
          FROM section_meetings sm
          WHERE sm.course_section_id = cs.id
            AND (sm.time_of_day::text = ANY($${timesParam}) OR sm.day::text = ANY($${daysParam}))
        ), 0) as schedule_score
      FROM courses c
      JOIN departments d ON c.department_id = d.id
      LEFT JOIN course_sections cs ON c.id = cs.course_id
      LEFT JOIN terms t ON cs.term_id = t.id
      WHERE (d.name = ANY($${majorMinorParam}) OR d.name = ANY($${interestParam}))
        AND c.id != ALL($${takenParam})
    `;

    // Additional filters from query params
    if (search) {
      innerQuery += ` AND (
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

    if (department && department !== 'All Departments') {
      innerQuery += ` AND d.name = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    if (term) {
      innerQuery += ` AND t.label = $${paramIndex}`;
      params.push(term);
      paramIndex++;
    }

    if (days) {
      const daysList = days.split(',').map(d => {
        const dayMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday' };
        return dayMap[d] || d;
      });
      innerQuery += ` AND EXISTS (
        SELECT 1 FROM section_meetings sm
        WHERE sm.course_section_id = cs.id
        AND sm.day = ANY($${paramIndex}::day_of_week_type[])
      )`;
      params.push(daysList);
      paramIndex++;
    }

    if (times) {
      const timesList = times.split(',');
      innerQuery += ` AND EXISTS (
        SELECT 1 FROM section_meetings sm
        WHERE sm.course_section_id = cs.id
        AND sm.time_of_day = ANY($${paramIndex}::time_of_day_type[])
      )`;
      params.push(timesList);
      paramIndex++;
    }

    if (categories) {
      const categoriesList = categories.split(',');
      innerQuery += ` AND EXISTS (
        SELECT 1 FROM course_category_mapping ccm
        JOIN course_categories cc ON ccm.category_id = cc.id
        WHERE ccm.course_id = c.id
        AND cc.name = ANY($${paramIndex})
      )`;
      params.push(categoriesList);
      paramIndex++;
    }

    innerQuery += ` ORDER BY c.id, cs.id`;

    // Outer query: filter interest courses by effort/size prefs, sort by priority + schedule score
    let outerQuery = `SELECT * FROM (${innerQuery}) AS scored WHERE priority <= 2`;

    // For interest courses (priority=2), apply effort/size filters; major/minor (priority=1) pass through
    if (prefs.max_effort_level) {
      outerQuery += ` AND (priority = 1 OR difficulty_rating <= $${paramIndex} OR difficulty_rating IS NULL)`;
      params.push(prefs.max_effort_level);
      paramIndex++;
    }

    if (prefs.preferred_class_size) {
      if (prefs.preferred_class_size === 'small') {
        outerQuery += ` AND (priority = 1 OR max_seats < 20 OR max_seats IS NULL)`;
      } else if (prefs.preferred_class_size === 'medium') {
        outerQuery += ` AND (priority = 1 OR (max_seats >= 20 AND max_seats <= 50) OR max_seats IS NULL)`;
      } else if (prefs.preferred_class_size === 'large') {
        outerQuery += ` AND (priority = 1 OR max_seats > 50 OR max_seats IS NULL)`;
      }
    }

    // Filter out generic courses (Undergraduate Research, Independent Study, etc.)
    // by excluding courses that have 6+ sections with the same code and name in the result set
    const filteredQuery = `
      SELECT * FROM (
        SELECT *, COUNT(*) OVER (PARTITION BY id) as section_count
        FROM (${outerQuery}) as with_prefs
      ) as with_counts
      WHERE section_count < 6
    `;

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${filteredQuery}) as recommended`;
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].total) || 0;
    const totalPages = Math.ceil(totalCount / limitNum);

    // Sort and paginate
    const offset = (pageNum - 1) * limitNum;
    const finalQuery = `
      ${filteredQuery}
      ORDER BY
        priority ASC,
        schedule_score DESC,
        CAST(NULLIF(REGEXP_REPLACE(code, '[^0-9]', '', 'g'), '') AS INTEGER) ASC NULLS LAST,
        REGEXP_REPLACE(code, '[0-9]', '', 'g') ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limitNum, offset);

    const result = await db.query(finalQuery, params);

    const courses = result.rows.map(row => ({
      id: row.id,
      sectionId: row.section_id,
      sectionTitle: row.section_title || null,
      code: row.code,
      name: row.name,
      description: row.description,
      credits: row.credits,
      professor: row.professors || 'TBA',
      schedule: formatSchedule(row.meetings),
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
      wouldTakeAgain: row.would_take_again_percentage,
      syllabusId: row.syllabus_id || null
    }));

    res.json({
      courses,
      pagination: { page: pageNum, limit: limitNum, totalCount, totalPages }
    });
  } catch (err) {
    console.error('Error fetching recommended courses:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Failed to fetch recommended courses', details: err.message });
  }
});

/**
 * GET /api/courses/:id
 * Fetch detailed information for a single course
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { term, sectionId } = req.query;

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
        (
          SELECT ROUND(AVG(r.hours_per_week)::numeric, 2)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
             OR EXISTS (
               SELECT 1
               FROM course_sections ts
               JOIN section_instructors ts_si ON ts_si.course_section_id = ts.id
               JOIN section_instructors rev_cs_si ON rev_cs_si.professor_id = ts_si.professor_id
                 AND rev_cs_si.course_section_id = rev_cs.id
               JOIN section_meetings ts_sm ON ts_sm.course_section_id = ts.id
               JOIN section_meetings rev_cs_sm ON rev_cs_sm.course_section_id = rev_cs.id
                 AND rev_cs_sm.day = ts_sm.day
                 AND rev_cs_sm.start_time = ts_sm.start_time
                 AND rev_cs_sm.end_time = ts_sm.end_time
               WHERE ts.course_id = c.id
                 AND ts.term_id = rev_cs.term_id
             )
        ) AS avg_hours_per_week,
        (
          SELECT ROUND(AVG(r.difficulty)::numeric, 2)
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
             OR EXISTS (
               SELECT 1
               FROM course_sections ts
               JOIN section_instructors ts_si ON ts_si.course_section_id = ts.id
               JOIN section_instructors rev_cs_si ON rev_cs_si.professor_id = ts_si.professor_id
                 AND rev_cs_si.course_section_id = rev_cs.id
               JOIN section_meetings ts_sm ON ts_sm.course_section_id = ts.id
               JOIN section_meetings rev_cs_sm ON rev_cs_sm.course_section_id = rev_cs.id
                 AND rev_cs_sm.day = ts_sm.day
                 AND rev_cs_sm.start_time = ts_sm.start_time
                 AND rev_cs_sm.end_time = ts_sm.end_time
               WHERE ts.course_id = c.id
                 AND ts.term_id = rev_cs.term_id
             )
        ) AS difficulty_rating,
        (
          SELECT ROUND(
            (COUNT(CASE WHEN r.would_take_again THEN 1 END) * 100.0 / NULLIF(COUNT(r.id), 0))::numeric,
            2
          )
          FROM reviews r
          JOIN course_sections rev_cs ON r.course_section_id = rev_cs.id
          WHERE rev_cs.course_id = c.id
             OR EXISTS (
               SELECT 1
               FROM course_sections ts
               JOIN section_instructors ts_si ON ts_si.course_section_id = ts.id
               JOIN section_instructors rev_cs_si ON rev_cs_si.professor_id = ts_si.professor_id
                 AND rev_cs_si.course_section_id = rev_cs.id
               JOIN section_meetings ts_sm ON ts_sm.course_section_id = ts.id
               JOIN section_meetings rev_cs_sm ON rev_cs_sm.course_section_id = rev_cs.id
                 AND rev_cs_sm.day = ts_sm.day
                 AND rev_cs_sm.start_time = ts_sm.start_time
                 AND rev_cs_sm.end_time = ts_sm.end_time
               WHERE ts.course_id = c.id
                 AND ts.term_id = rev_cs.term_id
             )
        ) AS would_take_again_percentage,
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
        cs.section_title,
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
    if (sectionId) {
      sectionQuery += ` AND cs.id = $2`;
      sectionParams.push(sectionId);
    } else if (term) {
      sectionQuery += ` AND t.label = $2`;
      sectionParams.push(term);
    }
    sectionQuery += ` ORDER BY t.year DESC, t.season DESC LIMIT 1`;

    const sectionResult = await db.query(sectionQuery, sectionParams);
    const section = sectionResult.rows[0] || {};

    // Extract prerequisites from description text
    const prerequisites = extractPrerequisites(course.description);

    // Find cross-listed sections: same professor AND same meeting time on the same target section
    const crossListQuery = `
      SELECT DISTINCT cs.id AS section_id, c.code AS course_code
      FROM course_sections cs
      JOIN courses c ON cs.course_id = c.id
      WHERE cs.course_id != $1
        AND EXISTS (
          SELECT 1
          FROM course_sections ts
          JOIN section_instructors ts_si ON ts_si.course_section_id = ts.id
          JOIN section_instructors cs_si ON cs_si.professor_id = ts_si.professor_id
            AND cs_si.course_section_id = cs.id
          JOIN section_meetings ts_sm ON ts_sm.course_section_id = ts.id
          JOIN section_meetings cs_sm ON cs_sm.course_section_id = cs.id
            AND cs_sm.day = ts_sm.day
            AND cs_sm.start_time = ts_sm.start_time
            AND cs_sm.end_time = ts_sm.end_time
          WHERE ts.course_id = $1
            AND ts.term_id = cs.term_id
        )
    `;
    const crossListResult = await db.query(crossListQuery, [id]);
    const crossListedSectionIds = crossListResult.rows.map(r => r.section_id);
    const crossListedAs = [...new Set(crossListResult.rows.map(r => r.course_code))];

    // Compute live stats scoped to sections that share professor(s) with selected section
    const statsResult = await db.query(
      `SELECT
         ROUND(AVG(r.rating)::numeric, 2) AS rating,
         COUNT(r.id) AS review_count,
         ROUND(AVG(r.hours_per_week)::numeric, 2) AS avg_hours_per_week,
         ROUND(AVG(r.difficulty)::numeric, 2) AS difficulty_rating,
         ROUND(
           (COUNT(CASE WHEN r.would_take_again THEN 1 END) * 100.0 / NULLIF(COUNT(r.id), 0))::numeric,
           2
         ) AS would_take_again_percentage
       FROM reviews r
       JOIN course_sections cs ON r.course_section_id = cs.id
       WHERE cs.course_id = $1
         AND (
           $2::uuid IS NULL
           OR EXISTS (
             SELECT 1
             FROM section_instructors selected_si
             JOIN section_instructors review_si ON review_si.professor_id = selected_si.professor_id
             WHERE selected_si.course_section_id = $2::uuid
               AND review_si.course_section_id = cs.id
           )
         )`,
      [id, section.section_id || null]
    );
    const stats = statsResult.rows[0] || {};

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

    // Get syllabi for this course + cross-listed equivalents, including prior years
    let syllabi = [];
    const syllabiResult = await db.query(
      `SELECT csyl.id, csyl.file_name, csyl.mime_type
       FROM course_syllabi csyl
       JOIN course_sections syll_cs ON csyl.course_section_id = syll_cs.id
       WHERE csyl.status = 'approved'
         AND (
           -- Directly uploaded for this course (all years)
           syll_cs.course_id = $1
           OR
           -- Cross-listed equivalent by shared instructor + identical meeting pattern, across years
           EXISTS (
             SELECT 1
             FROM course_sections target_cs
             JOIN section_instructors target_si ON target_si.course_section_id = target_cs.id
             JOIN section_meetings target_sm ON target_sm.course_section_id = target_cs.id
             JOIN section_instructors syll_si ON syll_si.professor_id = target_si.professor_id
               AND syll_si.course_section_id = syll_cs.id
             JOIN section_meetings syll_sm ON syll_sm.course_section_id = syll_cs.id
               AND syll_sm.day = target_sm.day
               AND syll_sm.start_time = target_sm.start_time
               AND syll_sm.end_time = target_sm.end_time
             WHERE target_cs.course_id = $1
           )
         )
       -- Keep most recent uploads first for UI
       ORDER BY csyl.uploaded_at DESC`,
      [id]
    );
    syllabi = syllabiResult.rows.map(r => ({
      id: r.id,
      fileName: r.file_name,
      mimeType: r.mime_type,
    }));

    // Get top tags from reviews for sections sharing professor with selected section
    const tagsQuery = `
      SELECT t.name, COUNT(*) as count
      FROM reviews r
      JOIN course_sections cs ON r.course_section_id = cs.id
      JOIN review_tag_mapping rtm ON r.id = rtm.review_id
      JOIN tags t ON rtm.tag_id = t.id
      WHERE cs.course_id = $1
        AND (
          $2::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM section_instructors selected_si
            JOIN section_instructors review_si ON review_si.professor_id = selected_si.professor_id
            WHERE selected_si.course_section_id = $2::uuid
              AND review_si.course_section_id = cs.id
          )
        )
      GROUP BY t.name
      ORDER BY count DESC
      LIMIT 10
    `;
    const tagsResult = await db.query(tagsQuery, [id, section.section_id || null]);
    const commentHighlights = tagsResult.rows.map(r => r.name);

    // Format response
    const response = {
      id: course.id,
      sectionId: section.section_id || null,
      sectionTitle: section.section_title || null,
      code: course.code,
      name: course.name,
      description: course.description,
      credits: course.credits,
      maxSeats: section.max_seats || 0,
      professor: section.professors || 'TBA',
      schedule: formatSchedule(section.meetings),
      rating: parseFloat(stats.rating) || 0,
      reviewCount: parseInt(stats.review_count) || 0,
      prerequisites,
      commentHighlights,
      gradeDistribution,
      gradeBreakdown,
      avgHoursPerWeek: parseFloat(stats.avg_hours_per_week) || 0,
      difficulty: `${Math.round(parseFloat(stats.difficulty_rating) || 0)}/5`,
      wouldTakeAgain: stats.would_take_again_percentage
        ? `${Math.round(stats.would_take_again_percentage)}%`
        : 'N/A',
      attendancePolicy: section.attendance_policy || 'flexible',
      absencesAllowed: section.absences_allowed || 0,
      termLabel: section.term_label,
      departmentCode: course.department_code,
      departmentName: course.department_name,
      syllabi,
      crossListedAs,
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
    const { page, limit, sectionId } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Anchor to the most recent section for this course so we can
    // scope review/tag crosslisting to the same professor(s).
    let targetSectionId = sectionId || null;
    if (!targetSectionId) {
      const targetSectionResult = await db.query(
        `SELECT cs.id
         FROM course_sections cs
         JOIN terms t ON cs.term_id = t.id
         WHERE cs.course_id = $1
         ORDER BY t.year DESC, t.season DESC
         LIMIT 1`,
        [id]
      );
      targetSectionId = targetSectionResult.rows[0]?.id || null;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM reviews r
       JOIN course_sections cs ON r.course_section_id = cs.id
       WHERE cs.course_id = $1
         AND (
           $2::uuid IS NULL
           OR EXISTS (
             SELECT 1
             FROM section_instructors target_si
             JOIN section_instructors review_si ON review_si.professor_id = target_si.professor_id
             WHERE target_si.course_section_id = $2::uuid
               AND review_si.course_section_id = cs.id
           )
         )`,
      [id, targetSectionId]
    );
    const totalCount = parseInt(countResult.rows[0].total) || 0;
    const totalPages = Math.ceil(totalCount / limitNum);

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
        AND (
          $2::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM section_instructors target_si
            JOIN section_instructors review_si ON review_si.professor_id = target_si.professor_id
            WHERE target_si.course_section_id = $2::uuid
              AND review_si.course_section_id = cs.id
          )
        )
      ORDER BY r.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await db.query(query, [id, targetSectionId, limitNum, offset]);

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

    res.json({
      reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages
      }
    });
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
