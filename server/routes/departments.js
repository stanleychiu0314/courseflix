const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/departments
 * Fetch all departments
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT id, code, name
      FROM departments
      ORDER BY name
    `;

    const result = await db.query(query);

    const departments = result.rows.map(row => ({
      id: row.id,
      code: row.code,
      name: row.name
    }));

    res.json(departments);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

module.exports = router;
