const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/schedule
 * Fetch user's schedule for a specific term
 * For now, returns demo data or empty array since auth is not implemented
 *
 * Query params:
 * - term: term label (e.g., "Spring 2026")
 * - userId: user ID (optional, will use auth later)
 */
router.get('/', async (req, res) => {
  try {
    const { term, userId } = req.query;

    // If no userId, return empty array (user not logged in)
    if (!userId) {
      return res.json([]);
    }

    const query = `
      SELECT
        c.id as course_id,
        c.code,
        c.name,
        cs.id as section_id,
        usi.color,
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
      FROM user_schedule_items usi
      JOIN user_schedules us ON usi.schedule_id = us.id
      JOIN course_sections cs ON usi.course_section_id = cs.id
      JOIN courses c ON cs.course_id = c.id
      JOIN terms t ON cs.term_id = t.id
      WHERE us.user_id = $1
        AND us.is_primary = true
        ${term ? 'AND t.label = $2' : ''}
    `;

    const params = term ? [userId, term] : [userId];
    const result = await db.query(query, params);

    const scheduleItems = [];

    result.rows.forEach(row => {
      if (row.meetings && Array.isArray(row.meetings)) {
        row.meetings.forEach(meeting => {
          scheduleItems.push({
            id: row.section_id,
            code: row.code,
            name: row.name.length > 15 ? row.name.substring(0, 15) + '...' : row.name,
            professor: row.professors ? `Dr. ${row.professors.split(' ').pop()}` : 'TBA',
            day: getDayAbbrev(meeting.day),
            startTime: meeting.start_time.substring(0, 5),
            endTime: meeting.end_time.substring(0, 5),
            color: row.color || generateColor(row.code)
          });
        });
      }
    });

    res.json(scheduleItems);
  } catch (err) {
    console.error('Error fetching schedule:', err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

/**
 * POST /api/schedule/add
 * Add a course section to user's schedule
 */
router.post('/add', async (req, res) => {
  try {
    const { userId, sectionId, term, color } = req.body;

    if (!userId || !sectionId) {
      return res.status(400).json({ error: 'userId and sectionId are required' });
    }

    // Find or create the user's primary schedule for this term
    const termQuery = `
      SELECT t.id FROM terms t
      JOIN course_sections cs ON cs.term_id = t.id
      WHERE cs.id = $1
    `;
    const termResult = await db.query(termQuery, [sectionId]);

    if (termResult.rows.length === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }

    const termId = termResult.rows[0].id;

    // Get or create schedule
    let scheduleQuery = `
      SELECT id FROM user_schedules
      WHERE user_id = $1 AND term_id = $2 AND is_primary = true
    `;
    let scheduleResult = await db.query(scheduleQuery, [userId, termId]);

    let scheduleId;
    if (scheduleResult.rows.length === 0) {
      const createScheduleQuery = `
        INSERT INTO user_schedules (user_id, term_id, name, is_primary)
        VALUES ($1, $2, 'My Schedule', true)
        RETURNING id
      `;
      const newSchedule = await db.query(createScheduleQuery, [userId, termId]);
      scheduleId = newSchedule.rows[0].id;
    } else {
      scheduleId = scheduleResult.rows[0].id;
    }

    // Add the course to the schedule
    const addQuery = `
      INSERT INTO user_schedule_items (schedule_id, course_section_id, color)
      VALUES ($1, $2, $3)
      ON CONFLICT (schedule_id, course_section_id) DO UPDATE
      SET color = EXCLUDED.color
      RETURNING *
    `;
    await db.query(addQuery, [scheduleId, sectionId, color || null]);

    res.json({ success: true, message: 'Course added to schedule' });
  } catch (err) {
    console.error('Error adding to schedule:', err);
    res.status(500).json({ error: 'Failed to add course to schedule' });
  }
});

/**
 * DELETE /api/schedule/:sectionId
 * Remove a course section from user's schedule
 */
router.delete('/:sectionId', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const query = `
      DELETE FROM user_schedule_items usi
      USING user_schedules us
      WHERE usi.schedule_id = us.id
        AND us.user_id = $1
        AND usi.course_section_id = $2
    `;

    await db.query(query, [userId, sectionId]);

    res.json({ success: true, message: 'Course removed from schedule' });
  } catch (err) {
    console.error('Error removing from schedule:', err);
    res.status(500).json({ error: 'Failed to remove course from schedule' });
  }
});

// Helper functions
function getDayAbbrev(day) {
  const dayMap = {
    'Monday': 'MWF',
    'Tuesday': 'TTh',
    'Wednesday': 'MWF',
    'Thursday': 'TTh',
    'Friday': 'MWF'
  };
  return dayMap[day] || day;
}

function generateColor(code) {
  const colors = [
    '#8B7FD9', '#5FD9A8', '#D9A25F', '#D95F5F',
    '#F9D66D', '#A9D9F9', '#D97FD9', '#7FD9D9'
  ];
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

module.exports = router;
