const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/adminAuth');

// All admin routes require admin access
router.use(requireAdmin);

/**
 * GET /api/admin/syllabi
 * List syllabi with optional status filter and pagination.
 * Query params: status (pending|approved|rejected), page, limit
 */
router.get('/syllabi', async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      whereClause += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM course_syllabi s ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].total) || 0;

    const result = await db.query(
      `SELECT
         s.id,
         s.file_name,
         s.file_size,
         s.status,
         s.uploaded_at,
         s.reviewed_at,
         s.rejection_reason,
         u.name as uploaded_by_name,
         u.email as uploaded_by_email,
         c.code as course_code,
         c.name as course_name,
         t.label as term_label,
         reviewer.name as reviewed_by_name
       FROM course_syllabi s
       JOIN users u ON s.uploaded_by_user_id = u.id
       JOIN course_sections cs ON s.course_section_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       JOIN terms t ON cs.term_id = t.id
       LEFT JOIN users reviewer ON s.reviewed_by_user_id = reviewer.id
       ${whereClause}
       ORDER BY
         CASE s.status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
         s.uploaded_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );

    res.json({
      syllabi: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    console.error('Error fetching admin syllabi:', err);
    res.status(500).json({ error: 'Failed to fetch syllabi' });
  }
});

/**
 * GET /api/admin/syllabi/:id/preview
 * Serve syllabus file for admin preview (inline viewing).
 */
router.get('/syllabi/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;

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
    res.setHeader('Content-Disposition', 'inline');
    res.send(row.file_data);
  } catch (err) {
    console.error('Error previewing syllabus:', err);
    res.status(500).json({ error: 'Failed to preview syllabus' });
  }
});

/**
 * PATCH /api/admin/syllabi/:id/approve
 * Approve a pending syllabus.
 */
router.patch('/syllabi/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;

    const result = await db.query(
      `UPDATE course_syllabi
       SET status = 'approved',
           reviewed_by_user_id = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           rejection_reason = NULL
       WHERE id = $2 AND status = 'pending'
       RETURNING id, status, reviewed_at`,
      [adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Syllabus not found or already reviewed' });
    }

    res.json({ success: true, syllabus: result.rows[0] });
  } catch (err) {
    console.error('Error approving syllabus:', err);
    res.status(500).json({ error: 'Failed to approve syllabus' });
  }
});

/**
 * PATCH /api/admin/syllabi/:id/reject
 * Reject a pending syllabus with a reason.
 * Body: { reason: "string" }
 */
router.patch('/syllabi/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.session.user.id;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const result = await db.query(
      `UPDATE course_syllabi
       SET status = 'rejected',
           reviewed_by_user_id = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           rejection_reason = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING id, status, reviewed_at, rejection_reason`,
      [adminId, reason.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Syllabus not found or already reviewed' });
    }

    res.json({ success: true, syllabus: result.rows[0] });
  } catch (err) {
    console.error('Error rejecting syllabus:', err);
    res.status(500).json({ error: 'Failed to reject syllabus' });
  }
});

/**
 * DELETE /api/admin/reviews/:reviewId/text
 * Remove the written text of a review (sets text to NULL).
 * The review row itself (rating, difficulty, etc.) is preserved.
 */
router.delete('/reviews/:reviewId/text', async (req, res) => {
  try {
    const { reviewId } = req.params;

    const result = await db.query(
      `UPDATE reviews SET text = NULL WHERE id = $1 RETURNING id`,
      [reviewId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing review text:', err);
    res.status(500).json({ error: 'Failed to remove review text' });
  }
});

module.exports = router;
