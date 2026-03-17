const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

/**
 * Imports courses-data.json into the PostgreSQL database
 *
 * Prerequisites:
 *   1. Docker running: docker-compose up -d
 *   2. Schema applied: seed-departments.sql and seed-terms.sql already run
 *   3. Re-scraped data with hours and term fields
 *
 * Run: node db/import-courses.js
 */

const DATA_PATH = path.join(__dirname, '../scraper/courses-data.json');

// Database connection - matches docker-compose.yml defaults
const DB_CONFIG = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'courseflix',
    user: process.env.POSTGRES_USER || 'courseflix',
    password: process.env.POSTGRES_PASSWORD || 'courseflix',
};

// Parse "2026 Spring" -> { year: 2026, season: 'Spring' }
function parseTerm(termStr) {
    if (!termStr) return null;
    const match = termStr.match(/^(\d{4})\s+(Spring|Summer|Fall|Winter)$/);
    if (!match) return null;
    return { year: parseInt(match[1], 10), season: match[2] };
}

// Parse "3.0" -> 3
function parseCredits(hoursStr) {
    if (!hoursStr) return null;
    const num = parseFloat(hoursStr);
    if (isNaN(num)) return null;
    return Math.round(num);
}

// Parse "MWF" -> ['Monday', 'Wednesday', 'Friday']
function parseDays(daysStr) {
    if (!daysStr) return [];
    const dayMap = {
        'M': 'Monday',
        'T': 'Tuesday',
        'W': 'Wednesday',
        'R': 'Thursday',
        'F': 'Friday',
        'S': 'Saturday',
        'U': 'Sunday',
    };
    const days = [];
    for (const char of daysStr) {
        if (dayMap[char]) {
            days.push(dayMap[char]);
        }
    }
    return days;
}

// Parse "09:30a - 10:45a" -> { start: '09:30:00', end: '10:45:00' }
function parseTime(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})([ap])\s*-\s*(\d{1,2}):(\d{2})([ap])$/);
    if (!match) return null;

    const [, startHour, startMin, startMeridiem, endHour, endMin, endMeridiem] = match;

    const convertTo24 = (hour, min, meridiem) => {
        let h = parseInt(hour, 10);
        if (meridiem === 'p' && h !== 12) h += 12;
        if (meridiem === 'a' && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${min}:00`;
    };

    return {
        start: convertTo24(startHour, startMin, startMeridiem),
        end: convertTo24(endHour, endMin, endMeridiem),
    };
}

// Parse "15/25" -> { enrolled: 15, max: 25 }
function parseAvailability(availStr) {
    if (!availStr) return { enrolled: 0, max: 1 };
    const match = availStr.match(/^(\d+)\/(\d+)$/);
    if (!match) return { enrolled: 0, max: 1 };
    return {
        enrolled: parseInt(match[1], 10),
        max: parseInt(match[2], 10),
    };
}

async function importCourses() {
    const client = new Client(DB_CONFIG);

    try {
        await client.connect();
        console.log('Connected to database');

        // Load JSON data
        const rawData = fs.readFileSync(DATA_PATH, 'utf-8');
        const courses = JSON.parse(rawData);
        console.log(`Loaded ${courses.length} courses from JSON`);

        // Pre-fetch departments and terms for lookup (will auto-create missing entries)
        const deptResult = await client.query('SELECT id, code FROM departments');
        const deptMap = new Map(deptResult.rows.map(r => [r.code, r.id]));

        const termResult = await client.query('SELECT id, season, year FROM terms');
        const termMap = new Map(termResult.rows.map(r => [`${r.year} ${r.season}`, r.id]));

        // Track professors and categories for upsert
        const professorCache = new Map();
        const categoryCache = new Map();

        let courseCount = 0;
        let sectionCount = 0;
        let meetingCount = 0;
        let categoryCount = 0;
        let skippedCount = 0;

        for (const course of courses) {
            let departmentId = deptMap.get(course.subject);
            if (!departmentId) {
                const deptName = course.subject;
                const deptInsert = await client.query(
                    `INSERT INTO departments (code, name)
                     VALUES ($1, $2)
                     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
                     RETURNING id`,
                    [course.subject, deptName]
                );
                departmentId = deptInsert.rows[0].id;
                deptMap.set(course.subject, departmentId);
            }

            const termParsed = parseTerm(course.term);
            if (!termParsed) {
                console.warn(`  Skipping ${course.subject} ${course.catalogNumber}: invalid term "${course.term}"`);
                skippedCount++;
                continue;
            }

            const termKey = `${termParsed.year} ${termParsed.season}`;
            let termId = termMap.get(termKey);
            if (!termId) {
                const termInsert = await client.query(
                    `INSERT INTO terms (season, year, label)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (season, year) DO UPDATE SET label = EXCLUDED.label
                     RETURNING id`,
                    [termParsed.season, termParsed.year, termKey]
                );
                termId = termInsert.rows[0].id;
                termMap.set(termKey, termId);
            }

            const credits = parseCredits(course.hours);
            if (credits == null || credits < 0 || credits > 20) {
                console.warn(`  Skipping ${course.subject} ${course.catalogNumber}: invalid credits "${course.hours}"`);
                skippedCount++;
                continue;
            }

            // Upsert course
            const courseCode = `${course.subject} ${course.catalogNumber}`;
            const courseResult = await client.query(`
                INSERT INTO courses (code, name, department_id, description, credits)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (code, department_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    credits = EXCLUDED.credits,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            `, [courseCode, course.sections[0]?.courseTitle || '', departmentId, course.courseDescription, credits]);

            const courseId = courseResult.rows[0].id;
            courseCount++;

            // Process sections
            for (const section of course.sections) {
                const availability = parseAvailability(section.availability);

                // Upsert section
                const sectionResult = await client.query(`
                    INSERT INTO course_sections (course_id, term_id, section_number, max_seats, enrolled_count, section_title)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (course_id, term_id, section_number) DO UPDATE SET
                        max_seats = EXCLUDED.max_seats,
                        enrolled_count = EXCLUDED.enrolled_count,
                        section_title = EXCLUDED.section_title,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING id
                `, [courseId, termId, section.section, availability.max, availability.enrolled, section.courseTitle || null]);

                const sectionId = sectionResult.rows[0].id;
                sectionCount++;

                // Handle instructor
                if (section.instructor && section.instructor !== 'Staff' && section.instructor !== 'TBA') {
                    let professorId = professorCache.get(section.instructor);

                    if (!professorId) {
                        const profResult = await client.query(`
                            INSERT INTO professors (name, department_id)
                            VALUES ($1, $2)
                            ON CONFLICT (name) DO NOTHING
                            RETURNING id
                        `, [section.instructor, departmentId]);

                        if (profResult.rows.length > 0) {
                            professorId = profResult.rows[0].id;
                        } else {
                            // Already exists, fetch it
                            const existingProf = await client.query(
                                'SELECT id FROM professors WHERE name = $1',
                                [section.instructor]
                            );
                            professorId = existingProf.rows[0]?.id;
                        }

                        if (professorId) {
                            professorCache.set(section.instructor, professorId);
                        }
                    }

                    if (professorId) {
                        await client.query(`
                            INSERT INTO section_instructors (course_section_id, professor_id)
                            VALUES ($1, $2)
                            ON CONFLICT DO NOTHING
                        `, [sectionId, professorId]);
                    }
                }

                // Handle meetings (days + times)
                const days = parseDays(section.days);
                const time = parseTime(section.time);

                if (days.length > 0 && time) {
                    // Delete existing meetings for this section (in case of re-import)
                    await client.query(
                        'DELETE FROM section_meetings WHERE course_section_id = $1',
                        [sectionId]
                    );

                    for (const day of days) {
                        await client.query(`
                            INSERT INTO section_meetings (course_section_id, day, start_time, end_time, meeting_type)
                            VALUES ($1, $2, $3, $4, 'lecture')
                        `, [sectionId, day, time.start, time.end]);
                        meetingCount++;
                    }
                }
            }

            // Handle categories
            if (course.categories && course.categories.length > 0) {
                for (const catName of course.categories) {
                    let categoryId = categoryCache.get(catName);

                    if (!categoryId) {
                        const catResult = await client.query(`
                            INSERT INTO course_categories (name)
                            VALUES ($1)
                            ON CONFLICT (name) DO NOTHING
                            RETURNING id
                        `, [catName]);

                        if (catResult.rows.length > 0) {
                            categoryId = catResult.rows[0].id;
                        } else {
                            const existingCat = await client.query(
                                'SELECT id FROM course_categories WHERE name = $1',
                                [catName]
                            );
                            categoryId = existingCat.rows[0]?.id;
                        }

                        if (categoryId) {
                            categoryCache.set(catName, categoryId);
                        }
                    }

                    if (categoryId) {
                        await client.query(`
                            INSERT INTO course_category_mapping (course_id, category_id)
                            VALUES ($1, $2)
                            ON CONFLICT DO NOTHING
                        `, [courseId, categoryId]);
                        categoryCount++;
                    }
                }
            }

            if (courseCount % 50 === 0) {
                console.log(`  Processed ${courseCount} courses...`);
            }
        }

        console.log('\n========================================');
        console.log('IMPORT COMPLETE');
        console.log('========================================');
        console.log(`Courses imported: ${courseCount}`);
        console.log(`Sections imported: ${sectionCount}`);
        console.log(`Meetings created: ${meetingCount}`);
        console.log(`Category mappings: ${categoryCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('Import failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

importCourses();
