const fs = require('fs');
const path = require('path');

/**
 * Generates SQL INSERT statements for departments from course-code.csv
 * Run: node db/seed-departments.js
 * Output: db/seed-departments.sql
 */

const csvPath = path.join(__dirname, '../scraper/course-code.csv');
const outputPath = path.join(__dirname, 'seed-departments.sql');

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.trim().split('\n');

const departments = lines.map(line => {
    const commaIndex = line.indexOf(',');
    const code = line.substring(0, commaIndex).trim();
    const name = line.substring(commaIndex + 1).trim();
    return { code, name };
});

// Escape single quotes for SQL
const escapeSql = (str) => str.replace(/'/g, "''");

let sql = `-- Auto-generated departments seed data
-- Generated from scraper/course-code.csv
-- Run: psql -U courseflix -d courseflix -f db/seed-departments.sql

INSERT INTO departments (code, name) VALUES
`;

const values = departments.map(d => `    ('${escapeSql(d.code)}', '${escapeSql(d.name)}')`);
sql += values.join(',\n');
sql += '\nON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;\n';

fs.writeFileSync(outputPath, sql, 'utf-8');

console.log(`Generated ${outputPath} with ${departments.length} departments`);
