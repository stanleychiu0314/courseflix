jest.mock('../db', () => ({ query: jest.fn(), pool: {} }));
jest.mock('connect-pg-simple', () => () => require('express-session').MemoryStore);
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => ({})),
  jwtVerify: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const db = require('../db');

beforeEach(() => jest.resetAllMocks());

// ---------------------------------------------------------------------------
// GET /api/courses
// ---------------------------------------------------------------------------
describe('GET /api/courses', () => {
  it('returns empty courses list with pagination when DB has no rows', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })  // count query
      .mockResolvedValueOnce({ rows: [] });                // courses query

    const res = await request(app).get('/api/courses');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('courses');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.courses)).toBe(true);
    expect(res.body.courses).toHaveLength(0);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, totalCount: 0 });
  });

  it('returns formatted courses with expected fields', async () => {
    const dbRow = {
      id: 'course-1', code: 'CS 1101', name: 'Intro to CS', description: 'Basics',
      credits: 3, rating: '4.2', review_count: 10, avg_hours_per_week: '5.5',
      difficulty_rating: '2.5', would_take_again_percentage: 80,
      department_code: 'CS', department_name: 'Computer Science',
      section_id: 'section-1', max_seats: 30, enrolled_count: 25,
      attendance_policy: 'flexible', term_label: 'Spring 2026',
      professors: 'Dr. Smith', meetings: null, tags: ['Exams'], syllabus_id: null,
    };
    db.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [dbRow] });

    const res = await request(app).get('/api/courses');

    expect(res.status).toBe(200);
    const course = res.body.courses[0];
    expect(course).toMatchObject({
      id: 'course-1',
      code: 'CS 1101',
      name: 'Intro to CS',
      professor: 'Dr. Smith',
      departmentCode: 'CS',
      termLabel: 'Spring 2026',
    });
    expect(course).toHaveProperty('rating');
    expect(course).toHaveProperty('schedule');
  });

  it('accepts search and pagination query params', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/courses?search=calculus&page=2&limit=5');

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 5 });
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('clamps limit to a maximum of 100', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/courses?limit=999');

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(100);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app).get('/api/courses');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// GET /api/courses/recommended
// ---------------------------------------------------------------------------
describe('GET /api/courses/recommended', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/courses/recommended');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// GET /api/courses/:id
// ---------------------------------------------------------------------------
describe('GET /api/courses/:id', () => {
  it('returns 404 when the course does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // course query → not found

    const res = await request(app).get('/api/courses/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Course not found');
  });

  it('returns a course object with required fields', async () => {
    const courseRow = {
      id: 'course-1', code: 'CS 2201', name: 'Data Structures',
      description: 'Prerequisite: CS 1101. Trees and graphs.',
      credits: 3, rating: '4.0', review_count: 5,
      avg_hours_per_week: '8', difficulty_rating: '3',
      would_take_again_percentage: 75,
      department_code: 'CS', department_name: 'Computer Science',
    };

    db.query
      .mockResolvedValueOnce({ rows: [courseRow] })  // course query
      .mockResolvedValueOnce({ rows: [] })            // section query (no section)
      .mockResolvedValueOnce({ rows: [] })            // cross-list query
      .mockResolvedValueOnce({ rows: [] })            // stats query
      .mockResolvedValueOnce({ rows: [] })            // syllabi query
      .mockResolvedValueOnce({ rows: [] });           // tags query

    const res = await request(app).get('/api/courses/course-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'course-1',
      code: 'CS 2201',
      name: 'Data Structures',
    });
    expect(res.body).toHaveProperty('gradeDistribution');
    expect(res.body).toHaveProperty('gradeBreakdown');
    expect(res.body).toHaveProperty('syllabi');
    expect(res.body).toHaveProperty('commentHighlights');
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/courses/course-1');

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/courses/:id/reviews
// ---------------------------------------------------------------------------
describe('GET /api/courses/:id/reviews', () => {
  it('returns empty reviews list with pagination', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] }) // count
      .mockResolvedValueOnce({ rows: [] });               // reviews

    const res = await request(app).get('/api/courses/course-1/reviews');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reviews');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.reviews).toHaveLength(0);
  });

  it('returns formatted review objects', async () => {
    const reviewRow = {
      id: 'review-1', rating: 4, difficulty: 3, grade_received: 'A',
      text: 'Great class!', hours_per_week: 5, would_take_again: true,
      created_at: new Date('2025-12-01'), term_label: 'Fall 2025',
      tags: ['Lectures'], helpful_count: '2',
    };
    db.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [reviewRow] });

    const res = await request(app).get('/api/courses/course-1/reviews');

    expect(res.status).toBe(200);
    expect(res.body.reviews[0]).toMatchObject({
      id: 'review-1',
      rating: 4,
      grade: 'A',
      text: 'Great class!',
      wouldTakeAgain: true,
    });
    expect(res.body.reviews[0]).toHaveProperty('date');
    expect(res.body.reviews[0]).toHaveProperty('helpfulCount', 2);
  });
});
