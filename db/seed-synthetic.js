/* Synthetic data loader for PostgreSQL (CourseFlix)
 * Usage:
 *   node db/seed-synthetic.js --users=200 --min-reviews=2 --max-reviews=8 --seed=42
 * Optional:
 *   --wipe=true      (truncate users/reviews/schedules and related tables)
 *   --wipe=all       (truncate all core tables, including courses/sections/etc)
 */

'use strict';

const { Pool } = require('pg');

const args = parseArgs(process.argv.slice(2));

const CONFIG = {
  users: Number(args.users || 200),
  minReviews: Number(args['min-reviews'] || 1),
  maxReviews: Number(args['max-reviews'] || 5),
  positiveBiasRate: Number(args['positive-rate'] || 0.3),
  negativeBiasRate: Number(args['negative-rate'] || 0.2),
  seed: args.seed ? Number(args.seed) : null,
  wipe: String(args.wipe || 'false').toLowerCase(),
};

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'courseflix',
  password: process.env.POSTGRES_PASSWORD || 'courseflix',
  database: process.env.POSTGRES_DB || 'courseflix',
});

const rand = makeRandom(CONFIG.seed);

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Jamie', 'Reese', 'Avery', 'Parker',
  'Quinn', 'Rowan', 'Drew', 'Cameron', 'Dakota', 'Elliot', 'Harper', 'Kai', 'Logan', 'Nico',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Lee', 'Brown', 'Davis', 'Miller', 'Wilson', 'Anderson', 'Thomas', 'Moore',
  'Martin', 'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott',
];

const REVIEW_POSITIVE = [
  'Excellent', 'Engaging', 'Insightful', 'Well-structured', 'Inspiring',
  'Supportive', 'Clear', 'Rewarding', 'Practical', 'Motivating',
];

const REVIEW_NEGATIVE = [
  'Disorganized', 'Overwhelming', 'Confusing', 'Frustrating', 'Inefficient',
  'Unclear', 'Challenging', 'Time-consuming', 'Dry', 'Stressful',
];

const REVIEW_NEUTRAL = [
  'Fast-paced', 'Balanced', 'Mixed', 'Average', 'Reasonable',
  'Standard', 'Straightforward', 'Survey', 'Introductory', 'Routine',
];

const GRADE_LETTERS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (CONFIG.wipe === 'true') {
      await client.query(`
        TRUNCATE
          review_tag_mapping,
          review_votes,
          review_comments,
          reviews,
          user_schedule_items,
          user_schedules,
          users
        CASCADE;
      `);
    }

    if (CONFIG.wipe === 'all') {
      await client.query(`
        TRUNCATE
          review_tag_mapping,
          review_votes,
          review_comments,
          reviews,
          user_schedule_items,
          user_schedules,
          section_instructors,
          section_meetings,
          course_sections,
          course_category_mapping,
          course_prerequisites,
          grading_breakdown,
          grade_distribution,
          courses,
          professors,
          terms,
          users,
          course_syllabi,
          departments
        CASCADE;
      `);

      await client.query('COMMIT');
      console.log('Database wiped (all core tables).');
      return;
    }

    const users = await insertUsers(client, CONFIG.users);
    const sections = await fetchExistingSections(client);
    const reviews = await insertReviewsByCourse(client, sections, users);
    await insertReviewTags(client, reviews);

    await client.query('COMMIT');

    console.log('Synthetic data generation complete.');
    console.log(`Users: ${users.length}`);
    console.log(`Existing sections used: ${sections.length}`);
    console.log(`Reviews: ${reviews.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Synthetic data generation failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }
    const [key, value] = arg.split('=');
    out[key.replace(/^--/, '')] = value ?? 'true';
  }
  return out;
}

function makeRandom(seed) {
  if (seed === null || Number.isNaN(seed)) {
    return () => Math.random();
  }
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomInt(max) {
  return Math.floor(rand() * max);
}

function pick(list) {
  return list[randomInt(list.length)];
}

function uniquePairs(count, aLen, bLen) {
  const pairs = new Set();
  while (pairs.size < count) {
    const a = randomInt(aLen);
    const b = randomInt(bLen);
    pairs.add(`${a}:${b}`);
  }
  return [...pairs].map((key) => key.split(':').map(Number));
}

async function fetchExistingSections(client) {
  const result = await client.query('SELECT id, term_id, course_id FROM course_sections');
  if (result.rows.length === 0) {
    throw new Error('No course sections found. Load real course/section data before generating reviews.');
  }
  return result.rows;
}

async function insertUsers(client, count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const email = `user${i + 1}@vanderbilt.edu`;
    const name = `User ${i + 1}`;
    const passwordHash = `seeded-${i + 1}`;

    const result = await client.query(
      'INSERT INTO users (email, password_hash, name, oauth_provider, oauth_id) VALUES ($1, $2, $3, NULL, NULL) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id, email, name',
      [email, passwordHash, name]
    );
    users.push(result.rows[0]);
  }
  return users;
}

async function insertReviewsByCourse(client, sections, users) {
  const reviews = [];
  const pairSet = new Set();
  const sectionsByCourse = new Map();

  for (const section of sections) {
    const list = sectionsByCourse.get(section.course_id) || [];
    list.push(section);
    sectionsByCourse.set(section.course_id, list);
  }

  for (const [courseId, courseSections] of sectionsByCourse.entries()) {
    const target = randomInt(CONFIG.maxReviews - CONFIG.minReviews + 1) + CONFIG.minReviews;
    const courseBias = pickCourseBias();
    let createdForCourse = 0;
    let attempts = 0;
    const maxAttempts = target * 20;

    while (createdForCourse < target && attempts < maxAttempts) {
      attempts += 1;
      const section = pick(courseSections);
      const user = pick(users);
      const key = `${section.id}:${user.id}`;
      if (pairSet.has(key)) {
        continue;
      }
      pairSet.add(key);

      const sentiment = pickSentiment(courseBias);
      const { rating, difficulty, text, firstWord, wouldTakeAgain } = buildReviewContent(sentiment);
      const grade = pick(GRADE_LETTERS);
      const hours = Number((2 + rand() * 12).toFixed(2));
      const attendanceRequired = rand() > 0.5;

      const result = await client.query(
        `
          INSERT INTO reviews (
            course_section_id, user_id, rating, difficulty, grade_received,
            text, first_impression_word, hours_per_week, would_take_again, attendance_required
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (course_section_id, user_id) DO NOTHING
          RETURNING id
        `,
        [
          section.id,
          user.id,
          rating,
          difficulty,
          grade,
          text,
          firstWord,
          hours,
          wouldTakeAgain,
          attendanceRequired,
        ]
      );

      if (result.rows.length > 0) {
        reviews.push({ id: result.rows[0].id, courseId });
        createdForCourse += 1;
      }
    }

    if (createdForCourse < target) {
      console.warn(`Course ${courseId}: created ${createdForCourse}/${target} reviews. Consider more users or fewer reviews per course.`);
    }
  }

  return reviews;
}

function pickCourseBias() {
  const roll = rand();
  if (roll < CONFIG.positiveBiasRate) return 'positive';
  if (roll < CONFIG.positiveBiasRate + CONFIG.negativeBiasRate) return 'negative';
  return 'neutral';
}

function pickSentiment(courseBias) {
  if (courseBias === 'positive') {
    return rand() < 0.75 ? 'positive' : 'neutral';
  }
  if (courseBias === 'negative') {
    return rand() < 0.75 ? 'negative' : 'neutral';
  }
  return rand() < 0.5 ? 'neutral' : (rand() < 0.75 ? 'positive' : 'negative');
}

function buildReviewContent(sentiment) {
  let rating;
  let difficulty;
  let words;
  let wouldTakeAgain;

  if (sentiment === 'positive') {
    rating = 4 + randomInt(2);
    difficulty = 1 + randomInt(3);
    words = REVIEW_POSITIVE;
    wouldTakeAgain = true;
  } else if (sentiment === 'negative') {
    rating = 1 + randomInt(2);
    difficulty = 3 + randomInt(3);
    words = REVIEW_NEGATIVE;
    wouldTakeAgain = false;
  } else {
    rating = 2 + randomInt(3);
    difficulty = 2 + randomInt(3);
    words = REVIEW_NEUTRAL;
    wouldTakeAgain = rand() > 0.5;
  }

  const firstWord = pick(words);
  const text = `${firstWord} course with ${pick(words).toLowerCase()} content.`;

  return { rating, difficulty, text, firstWord, wouldTakeAgain };
}

async function insertReviewTags(client, reviews) {
  const tagResult = await client.query('SELECT id FROM tags');
  const tags = tagResult.rows.map((row) => row.id);
  if (tags.length === 0) {
    return;
  }

  for (const review of reviews) {
    const tagCount = 1 + randomInt(3);
    const chosen = new Set();
    for (let i = 0; i < tagCount; i++) {
      chosen.add(pick(tags));
    }
    for (const tagId of chosen) {
      await client.query(
        'INSERT INTO review_tag_mapping (review_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [review.id, tagId]
      );
    }
  }
}

main();
