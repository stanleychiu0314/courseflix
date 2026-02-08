-- Auto-generated terms seed data
-- Run: psql -U courseflix -d courseflix -f db/seed-terms.sql

INSERT INTO terms (season, year, label) VALUES
    ('Spring', 2026, 'Spring 2026')
ON CONFLICT (season, year) DO NOTHING;
