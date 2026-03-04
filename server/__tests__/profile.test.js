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
// All profile endpoints require authentication
// ---------------------------------------------------------------------------
describe('Profile endpoints — unauthenticated', () => {
  it('GET /api/profile → 401', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  it('PUT /api/profile → 401', async () => {
    const res = await request(app).put('/api/profile').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/profile/courses-taken → 401', async () => {
    const res = await request(app).post('/api/profile/courses-taken').send({});
    expect(res.status).toBe(401);
  });

  it('DELETE /api/profile/courses-taken/:courseId → 401', async () => {
    const res = await request(app).delete('/api/profile/courses-taken/course-1');
    expect(res.status).toBe(401);
  });

  it('GET /api/profile/status → 401', async () => {
    const res = await request(app).get('/api/profile/status');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Authenticated profile operations
// ---------------------------------------------------------------------------
describe('GET /api/profile (authenticated)', () => {
  it('returns profile, preferences, and coursesTaken', async () => {
    const agent = await createAuthAgent(app);

    const userRow = {
      id: 'user-uuid-abc', email: 'test@vanderbilt.edu', name: 'Test User',
      first_name: 'Test', last_name: 'User', avatar_url: null,
      major_1: 'Computer Science', major_2: null,
      minor_1: null, minor_2: null,
      departments_of_interest: [], favorite_subjects: [],
    };

    db.query
      .mockResolvedValueOnce({ rows: [userRow] })  // user + profile join
      .mockResolvedValueOnce({ rows: [] })          // preferences
      .mockResolvedValueOnce({ rows: [] });         // courses taken

    const res = await agent.get('/api/profile');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profile');
    expect(res.body).toHaveProperty('preferences');
    expect(res.body).toHaveProperty('coursesTaken');
    expect(res.body.profile.email).toBe('test@vanderbilt.edu');
  });

  it('returns 404 when the user row is not found', async () => {
    const agent = await createAuthAgent(app);
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await agent.get('/api/profile');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/profile/status (authenticated)', () => {
  it('returns { complete: false } when profile is empty', async () => {
    const agent = await createAuthAgent(app);
    db.query
      .mockResolvedValueOnce({ rows: [] })  // profile → no row
      .mockResolvedValueOnce({ rows: [] }); // preferences → no row

    const res = await agent.get('/api/profile/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ complete: false });
  });

  it('returns { complete: true } when majors and preferences are set', async () => {
    const agent = await createAuthAgent(app);
    db.query
      .mockResolvedValueOnce({
        rows: [{ major_1: 'Computer Science', major_2: null, minor_1: null, minor_2: null, departments_of_interest: [], favorite_subjects: [] }],
      })
      .mockResolvedValueOnce({
        rows: [{ preferred_times: ['Morning'], preferred_days: [], max_effort_level: null, preferred_class_size: null, preferred_work_types: [] }],
      });

    const res = await agent.get('/api/profile/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ complete: true });
  });
});

describe('PUT /api/profile (authenticated)', () => {
  it('returns { success: true } on valid update', async () => {
    const agent = await createAuthAgent(app);
    db.query
      .mockResolvedValueOnce({ rows: [] })  // upsert user_profiles
      .mockResolvedValueOnce({ rows: [] })  // update users.name
      .mockResolvedValueOnce({ rows: [] }); // upsert preferences

    const res = await agent.put('/api/profile').send({
      profile: { firstName: 'Jane', lastName: 'Doe', major1: 'CS', departmentsOfInterest: [], favoriteSubjects: [] },
      preferences: { preferredTimes: [], preferredDays: [], preferredWorkTypes: [] },
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

describe('POST /api/profile/courses-taken (authenticated)', () => {
  it('returns 400 when courseId is missing', async () => {
    const agent = await createAuthAgent(app);
    const res = await agent.post('/api/profile/courses-taken').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/courseId/);
  });

  it('returns { success: true } when courseId is provided', async () => {
    const agent = await createAuthAgent(app);
    db.query.mockResolvedValueOnce({ rows: [] }); // upsert

    const res = await agent.post('/api/profile/courses-taken').send({ courseId: 'course-123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

describe('DELETE /api/profile/courses-taken/:courseId (authenticated)', () => {
  it('returns { success: true }', async () => {
    const agent = await createAuthAgent(app);
    db.query.mockResolvedValueOnce({ rows: [] }); // delete

    const res = await agent.delete('/api/profile/courses-taken/course-123');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
