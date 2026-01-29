const fs = require('fs');
const path = require('path');

/**
 * Generates SQL INSERT statements for terms
 * Run: node db/seed-terms.js
 * Output: db/seed-terms.sql
 */

const outputPath = path.join(__dirname, 'seed-terms.sql');

// Current terms - add more as needed
const terms = [
    { season: 'Spring', year: 2026, label: 'Spring 2026' },
];

let sql = `-- Auto-generated terms seed data
-- Run: psql -U courseflix -d courseflix -f db/seed-terms.sql

INSERT INTO terms (season, year, label) VALUES
`;

const values = terms.map(t => `    ('${t.season}', ${t.year}, '${t.label}')`);
sql += values.join(',\n');
sql += '\nON CONFLICT (season, year) DO NOTHING;\n';

fs.writeFileSync(outputPath, sql, 'utf-8');

console.log(`Generated ${outputPath} with ${terms.length} terms`);
