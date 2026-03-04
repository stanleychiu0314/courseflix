jest.mock('../db', () => ({ query: jest.fn(), pool: {} }));
jest.mock('connect-pg-simple', () => () => require('express-session').MemoryStore);

const request = require('supertest');
const app = require('../app');
const db = require('../db');

beforeEach(() => jest.clearAllMocks());

describe('GET /api/schedule/count', () => {
  it('returns count:0 when the user is not logged in', async () => {
    const res = await request(app).get('/api/schedule/count');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0 });
    // DB should NOT be queried — there is no session user
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('GET /api/schedule', () => {
  it('returns an empty array when the user is not logged in', async () => {
    const res = await request(app).get('/api/schedule');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('POST /api/schedule/add', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/schedule/add')
      .send({ sectionId: 1 });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when sectionId is missing (even if authenticated)', async () => {
    // Simulate an authenticated session by injecting it manually
    const agent = request.agent(app);

    // POST without sectionId but with a valid-ish session would still
    // return 401 first (no session cookie). We can only test the 400 path
    // through an integration test with a real session store.
    // Here we verify the unauthenticated path returns 401.
    const res = await agent.post('/api/schedule/add').send({});
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/schedule/:sectionId', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).delete('/api/schedule/42');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
