// Mock Postgres connections so the app starts without a real DB
jest.mock('../db', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

jest.mock('connect-pg-simple', () => () => require('express-session').MemoryStore);

const request = require('supertest');
const app = require('../app');

describe('GET /api/hello', () => {
  it('returns 200 with a message', async () => {
    const res = await request(app).get('/api/hello');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});
