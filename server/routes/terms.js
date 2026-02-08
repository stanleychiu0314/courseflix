const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/terms
 * Fetch all terms
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT id, season, year, label, starts_on, ends_on
      FROM terms
      ORDER BY year DESC,
        CASE season
          WHEN 'Fall' THEN 1
          WHEN 'Summer' THEN 2
          WHEN 'Spring' THEN 3
          WHEN 'Winter' THEN 4
        END
    `;

    const result = await db.query(query);

    const terms = result.rows.map(row => ({
      id: row.id,
      season: row.season,
      year: row.year,
      label: row.label,
      startsOn: row.starts_on,
      endsOn: row.ends_on
    }));

    res.json(terms);
  } catch (err) {
    console.error('Error fetching terms:', err);
    res.status(500).json({ error: 'Failed to fetch terms' });
  }
});

module.exports = router;
