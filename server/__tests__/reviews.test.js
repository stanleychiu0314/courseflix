jest.mock('../db', () => ({ query: jest.fn(), pool: {} }));
jest.mock('connect-pg-simple', () => () => require('express-session').MemoryStore);
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => ({})),
  jwtVerify: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const db = require('../db');
const { createAuthAgent } = require('./helpers');

beforeEach(() => jest.resetAllMocks());

// ---------------------------------------------------------------------------
// POST /api/reviews — unauthenticated
// ---------------------------------------------------------------------------
describe('POST /api/reviews (unauthenticated)', () => {
  it('returns 401 when not logged in', async () => {
    const res = await request(app).post('/api/reviews').send({});
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// POST /api/reviews — input validation (requires authenticated agent)
// ---------------------------------------------------------------------------
describe('POST /api/reviews — validation', () => {
  let agent;

  beforeEach(async () => {
    agent = await createAuthAgent(app);
  });

  // Helper: build a valid review body missing one field at a time
  const valid = {
    sectionId: 'section-uuid',
    overallRating: '4',
    hoursPerWeek: '5',
    effortLevel: '3',
    wouldTakeAgain: 'Yes',
    comments: 'Really enjoyed this course.',
  };

  it('returns 400 when sectionId is missing', async () => {
    const { sectionId: _, ...body } = valid;
    const res = await agent.post('/api/reviews').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sectionId/);
  });

  it('returns 400 when overallRating is out of range', async () => {
    const res = await agent.post('/api/reviews').send({ ...valid, overallRating: '6' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/overallRating/);
  });

  it('returns 400 when effortLevel is out of range', async () => {
    const res = await agent.post('/api/reviews').send({ ...valid, effortLevel: '0' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/effortLevel/);
  });

  it('returns 400 when wouldTakeAgain is not Yes or No', async () => {
    const res = await agent.post('/api/reviews').send({ ...valid, wouldTakeAgain: 'Maybe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/wouldTakeAgain/);
  });

  it('returns 400 when comments is empty', async () => {
    const res = await agent.post('/api/reviews').send({ ...valid, comments: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/comments/);
  });

  it('returns 404 when the section does not exist', async () => {
    // All validation passes, but section lookup returns empty
    db.query.mockResolvedValueOnce({ rows: [] }); // section check → not found

    const res = await agent.post('/api/reviews').send(valid);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Section not found/);
  });

  it('returns 201 and reviewId on successful submission', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'section-uuid' }] })  // section check
      .mockResolvedValueOnce({ rows: [{ id: 'review-new-1' }] })  // insert review
      .mockResolvedValueOnce({ rows: [] })                        // delete tags
      .mockResolvedValueOnce({ rows: [] });                       // absences update (skipped if NaN)

    const res = await agent.post('/api/reviews').send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, reviewId: 'review-new-1' });
  });
});

// ---------------------------------------------------------------------------
// GET /api/reviews/syllabus/:id
// ---------------------------------------------------------------------------
describe('GET /api/reviews/syllabus/:id', () => {
  it('returns 404 when syllabus does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/reviews/syllabus/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 404 when file_data is null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ file_name: 'test.pdf', file_data: null, mime_type: 'application/pdf' }] });
    const res = await request(app).get('/api/reviews/syllabus/some-id');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reviews/:reviewId/like
// ---------------------------------------------------------------------------
describe('POST /api/reviews/:reviewId/like', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/api/reviews/review-123/like');
    expect(res.status).toBe(401);
  });

  it('returns 200 when authenticated', async () => {
    const agent = await createAuthAgent(app);
    db.query.mockResolvedValueOnce({ rows: [{ review_id: 'review-123' }] });

    const res = await agent.post('/api/reviews/review-123/like');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
