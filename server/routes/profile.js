const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware: require authenticated user
function requireAuth(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

router.use(requireAuth);

/**
 * GET /api/profile
 * Fetch the current user's profile, preferences, and courses taken
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get user + profile
    const userQuery = `
      SELECT
        u.id, u.email, u.name,
        p.first_name, p.last_name, p.avatar_url,
        p.major_1, p.major_2, p.minor_1, p.minor_2,
        p.departments_of_interest, p.favorite_subjects
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `;
    const userResult = await db.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = userResult.rows[0];

    // Get preferences
    const prefsQuery = `
      SELECT preferred_times::text[] as preferred_times,
             preferred_days::text[] as preferred_days,
             max_effort_level,
             preferred_class_size,
             preferred_work_types::text[] as preferred_work_types
      FROM user_course_preferences
      WHERE user_id = $1
    `;
    const prefsResult = await db.query(prefsQuery, [userId]);
    const prefs = prefsResult.rows[0] || {};

    // Get courses taken
    const coursesQuery = `
      SELECT c.id, c.code, c.name, d.code as department_code
      FROM user_courses_taken uct
      JOIN courses c ON uct.course_id = c.id
      JOIN departments d ON c.department_id = d.id
      WHERE uct.user_id = $1
      ORDER BY c.code
    `;
    const coursesResult = await db.query(coursesQuery, [userId]);

    // Parse name into first/last if profile doesn't have them yet
    let firstName = row.first_name;
    let lastName = row.last_name;
    if (!firstName && !lastName && row.name) {
      const parts = row.name.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    res.json({
      profile: {
        firstName: firstName || '',
        lastName: lastName || '',
        email: row.email,
        avatarUrl: row.avatar_url || null,
        major1: row.major_1 || '',
        major2: row.major_2 || '',
        minor1: row.minor_1 || '',
        minor2: row.minor_2 || '',
        departmentsOfInterest: row.departments_of_interest || [],
        favoriteSubjects: row.favorite_subjects || [],
      },
      preferences: {
        preferredTimes: prefs.preferred_times || [],
        preferredDays: prefs.preferred_days || [],
        maxEffortLevel: prefs.max_effort_level || null,
        preferredClassSize: prefs.preferred_class_size || null,
        preferredWorkTypes: prefs.preferred_work_types || [],
      },
      coursesTaken: coursesResult.rows.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        departmentCode: c.department_code,
      })),
    });
  } catch (err) {
    console.error('Error fetching profile:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

/**
 * PUT /api/profile
 * Update the current user's profile and preferences
 */
router.put('/', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { profile, preferences } = req.body;

    // Upsert profile
    if (profile) {
      await db.query(
        `INSERT INTO user_profiles (
          user_id, first_name, last_name,
          major_1, major_2, minor_1, minor_2,
          departments_of_interest, favorite_subjects
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          major_1 = EXCLUDED.major_1,
          major_2 = EXCLUDED.major_2,
          minor_1 = EXCLUDED.minor_1,
          minor_2 = EXCLUDED.minor_2,
          departments_of_interest = EXCLUDED.departments_of_interest,
          favorite_subjects = EXCLUDED.favorite_subjects`,
        [
          userId,
          profile.firstName || null,
          profile.lastName || null,
          profile.major1 || null,
          profile.major2 || null,
          profile.minor1 || null,
          profile.minor2 || null,
          profile.departmentsOfInterest || [],
          profile.favoriteSubjects || [],
        ]
      );

      // Also update the name on the users table for session consistency
      const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
      if (fullName) {
        await db.query('UPDATE users SET name = $1 WHERE id = $2', [fullName, userId]);
        // Update session
        req.session.user.name = fullName;
        const parts = fullName.trim().split(/\s+/);
        req.session.user.initials = parts.length === 1
          ? parts[0].substring(0, 2).toUpperCase()
          : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
    }

    // Upsert preferences
    if (preferences) {
      await db.query(
        `INSERT INTO user_course_preferences (
          user_id, preferred_times, preferred_days,
          max_effort_level, preferred_class_size, preferred_work_types
        ) VALUES ($1, $2::time_of_day_type[], $3::day_of_week_type[], $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
          preferred_times = EXCLUDED.preferred_times,
          preferred_days = EXCLUDED.preferred_days,
          max_effort_level = EXCLUDED.max_effort_level,
          preferred_class_size = EXCLUDED.preferred_class_size,
          preferred_work_types = EXCLUDED.preferred_work_types`,
        [
          userId,
          preferences.preferredTimes || [],
          preferences.preferredDays || [],
          preferences.maxEffortLevel || null,
          preferences.preferredClassSize || null,
          preferences.preferredWorkTypes || [],
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating profile:', err.message);
    res.status(500).json({ error: 'Failed to update profile', details: err.message });
  }
});

/**
 * POST /api/profile/courses-taken
 * Add a course to the user's courses taken list
 */
router.post('/courses-taken', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    await db.query(
      `INSERT INTO user_courses_taken (user_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [userId, courseId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error adding course taken:', err.message);
    res.status(500).json({ error: 'Failed to add course', details: err.message });
  }
});

/**
 * DELETE /api/profile/courses-taken/:courseId
 * Remove a course from the user's courses taken list
 */
router.delete('/courses-taken/:courseId', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { courseId } = req.params;

    await db.query(
      'DELETE FROM user_courses_taken WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing course taken:', err.message);
    res.status(500).json({ error: 'Failed to remove course', details: err.message });
  }
});

/**
 * GET /api/profile/status
 * Check if the user's profile is complete enough for recommendations
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Check academic fields
    const profileResult = await db.query(
      `SELECT major_1, major_2, minor_1, minor_2,
              departments_of_interest, favorite_subjects
       FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    // Check preferences
    const prefsResult = await db.query(
      `SELECT preferred_times::text[] as preferred_times,
              preferred_days::text[] as preferred_days,
              max_effort_level, preferred_class_size,
              preferred_work_types::text[] as preferred_work_types
       FROM user_course_preferences WHERE user_id = $1`,
      [userId]
    );

    const profile = profileResult.rows[0] || {};
    const prefs = prefsResult.rows[0] || {};

    // Need at least one academic field set
    const hasAcademics = !!(
      profile.major_1 ||
      (Array.isArray(profile.departments_of_interest) && profile.departments_of_interest.length > 0) ||
      (Array.isArray(profile.favorite_subjects) && profile.favorite_subjects.length > 0)
    );

    // Need at least one preference set
    const hasPreferences = !!(
      (Array.isArray(prefs.preferred_times) && prefs.preferred_times.length > 0) ||
      (Array.isArray(prefs.preferred_days) && prefs.preferred_days.length > 0) ||
      prefs.max_effort_level ||
      prefs.preferred_class_size ||
      (Array.isArray(prefs.preferred_work_types) && prefs.preferred_work_types.length > 0)
    );

    res.json({ complete: hasAcademics && hasPreferences });
  } catch (err) {
    console.error('Error checking profile status:', err.message);
    res.status(500).json({ error: 'Failed to check profile status', details: err.message });
  }
});

module.exports = router;
