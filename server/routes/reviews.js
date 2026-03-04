const express = require('express');
const path = require('path');
const router = express.Router();
const multer = require('multer');
const db = require('../db');

const MAX_SYLLABUS_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SYLLABUS_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX'));
    }
  },
});

/**
 * POST /api/reviews
 * Submit a course review (feedback form) + optional syllabus file
 *
 * Body (multipart/form-data):
 * - sectionId, overallRating, hoursPerWeek, effortLevel, wouldTakeAgain,
 *   workloadTypes (JSON string), firstWord, grade, attendancePolicy, comments
 * - syllabus: file (optional, max 5MB, PDF/DOC/DOCX)
 *
 * Course aggregates are updated automatically by review_statistics_trigger.
 * Syllabus is stored in course_syllabi (file_data bytea in PostgreSQL).
 */
router.post('/', upload.single('syllabus'), async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const body = req.body || {};
    const sectionId = body.sectionId;
    let overallRating = parseInt(body.overallRating, 10);
    let hoursPerWeek = parseFloat(body.hoursPerWeek);
    let effortLevel = parseInt(body.effortLevel, 10);
    const wouldTakeAgain = body.wouldTakeAgain;
    let workloadTypes = [];
    try {
      workloadTypes = body.workloadTypes ? JSON.parse(body.workloadTypes) : [];
    } catch (_e) {
      workloadTypes = [];
    }
    const firstWord = body.firstWord;
    const grade = body.grade;
    const attendancePolicy = body.attendancePolicy;
    const comments = (body.comments || '').trim();
    const absencesAllowed = parseInt(body.absencesAllowed, 10);
    const syllabusFile = req.file;

    if (!sectionId) {
      return res.status(400).json({ error: 'sectionId is required' });
    }

    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({ error: 'overallRating must be between 1 and 5' });
    }

    if (typeof hoursPerWeek !== 'number' || hoursPerWeek < 0 || isNaN(hoursPerWeek)) {
      return res.status(400).json({ error: 'hoursPerWeek must be a non-negative number' });
    }

    if (!effortLevel || effortLevel < 1 || effortLevel > 5) {
      return res.status(400).json({ error: 'effortLevel must be between 1 and 5' });
    }

    if (wouldTakeAgain !== 'Yes' && wouldTakeAgain !== 'No') {
      return res.status(400).json({ error: 'wouldTakeAgain must be Yes or No' });
    }

    if (!comments) {
      return res.status(400).json({ error: 'comments is required' });
    }

    if (syllabusFile && syllabusFile.size > MAX_SYLLABUS_SIZE) {
      return res.status(400).json({ error: 'Syllabus file too large. Maximum size is 5MB.' });
    }

    // Verify section exists
    const sectionCheck = await db.query(
      'SELECT id FROM course_sections WHERE id = $1',
      [sectionId]
    );
    if (sectionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Insert review (ON CONFLICT = user already reviewed this section - do not overwrite)
    const insertReview = `
      INSERT INTO reviews (
        course_section_id, user_id,
        rating, difficulty, grade_received,
        text, first_impression_word,
        hours_per_week, would_take_again, attendance_required
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (course_section_id, user_id) DO NOTHING
      RETURNING id
    `;

    const validGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    const gradeValue = grade && validGrades.includes(grade) ? grade : null;
    const attendanceRequired = attendancePolicy === 'Strict';

    const reviewResult = await db.query(insertReview, [
      sectionId,
      userId,
      overallRating,
      effortLevel,
      gradeValue,
      comments.trim(),
      firstWord?.trim() || null,
      hoursPerWeek,
      wouldTakeAgain === 'Yes',
      attendanceRequired,
    ]);

    if (reviewResult.rows.length === 0) {
      // User already reviewed - still allow syllabus upload/update if provided
      if (syllabusFile && syllabusFile.buffer) {
        const fileName = syllabusFile.originalname || 'syllabus.pdf';
        const mimeType = syllabusFile.mimetype || 'application/pdf';
        await db.query(
          `INSERT INTO course_syllabi (
            course_section_id, uploaded_by_user_id,
            file_name, file_url, file_size, file_data, mime_type
          )
          VALUES ($1, $2, $3, NULL, $4, $5, $6)
          ON CONFLICT (course_section_id, file_name)
          DO UPDATE SET
            uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
            file_size = EXCLUDED.file_size,
            file_data = EXCLUDED.file_data,
            mime_type = EXCLUDED.mime_type`,
          [sectionId, userId, fileName, syllabusFile.size, syllabusFile.buffer, mimeType]
        );
      }
      return res.status(409).json({
        error: 'You have already reviewed this course. Only one review per course is allowed.',
      });
    }

    const reviewId = reviewResult.rows[0].id;

    // Handle workload tags: delete existing mappings, insert new ones
    await db.query('DELETE FROM review_tag_mapping WHERE review_id = $1', [reviewId]);

    if (Array.isArray(workloadTypes) && workloadTypes.length > 0) {
      const tagNames = workloadTypes.filter((t) => typeof t === 'string' && t.trim());
      if (tagNames.length > 0) {
        const tagResult = await db.query(
          'SELECT id, name FROM tags WHERE name = ANY($1::text[])',
          [tagNames]
        );
        for (const tag of tagResult.rows) {
          await db.query(
            'INSERT INTO review_tag_mapping (review_id, tag_id) VALUES ($1, $2) ON CONFLICT (review_id, tag_id) DO NOTHING',
            [reviewId, tag.id]
          );
        }
      }
    }

    // Insert syllabus into course_syllabi if file was uploaded (stored in PostgreSQL)
    if (syllabusFile && syllabusFile.buffer) {
      const fileName = syllabusFile.originalname || 'syllabus.pdf';
      const mimeType = syllabusFile.mimetype || 'application/pdf';
      await db.query(
        `INSERT INTO course_syllabi (
          course_section_id, uploaded_by_user_id,
          file_name, file_url, file_size, file_data, mime_type
        )
        VALUES ($1, $2, $3, NULL, $4, $5, $6)
        ON CONFLICT (course_section_id, file_name)
        DO UPDATE SET
          uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
          file_size = EXCLUDED.file_size,
          file_data = EXCLUDED.file_data,
          mime_type = EXCLUDED.mime_type`,
        [sectionId, userId, fileName, syllabusFile.size, syllabusFile.buffer, mimeType]
      );
    }

    // Update absences_allowed on the section if provided
    if (!isNaN(absencesAllowed) && absencesAllowed >= 0) {
      await db.query(
        'UPDATE course_sections SET absences_allowed = $1 WHERE id = $2',
        [absencesAllowed, sectionId]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      reviewId,
    });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Syllabus file too large. Maximum size is 10MB.' });
    }
    if (err.message && err.message.includes('Invalid file type')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Error submitting review:', err);
    res.status(500).json({ error: 'Failed to submit review', details: err.message });
  }
});

/**
 * GET /api/reviews/syllabus/:id
 * Download or view a syllabus file (stored in course_syllabi)
 * Query: ?inline=1 - serve for inline viewing (e.g. in iframe)
 */
router.get('/syllabus/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const inline = req.query.inline === '1';

    const result = await db.query(
      `SELECT file_name, file_data, mime_type FROM course_syllabi WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Syllabus not found' });
    }

    const row = result.rows[0];
    if (!row.file_data) {
      return res.status(404).json({ error: 'File content not available' });
    }

    res.setHeader('Content-Type', row.mime_type || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      inline ? 'inline' : `attachment; filename="${row.file_name}"`
    );
    res.send(row.file_data);
  } catch (err) {
    console.error('Error fetching syllabus:', err);
    res.status(500).json({ error: 'Failed to fetch syllabus', details: err.message });
  }
});

/**
 * POST /api/reviews/:reviewId/like
 * Mark a review as helpful (vote)
 */
router.post('/:reviewId/like', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const { reviewId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await db.query(
      `
      INSERT INTO review_votes (review_id, user_id, vote_type)
      VALUES ($1, $2, 'helpful')
      ON CONFLICT (review_id, user_id, vote_type) DO NOTHING
      RETURNING review_id
      `,
      [reviewId, userId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'Already liked or review not found' });
    }

    res.json({ success: true, message: 'Review marked as helpful' });
  } catch (err) {
    console.error('Error liking review:', err);
    res.status(500).json({ error: 'Failed to like review', details: err.message });
  }
});

module.exports = router;
