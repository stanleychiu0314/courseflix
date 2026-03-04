jest.mock('../db', () => ({ query: jest.fn(), pool: {} }));
jest.mock('connect-pg-simple', () => () => require('express-session').MemoryStore);

const request = require('supertest');
const app = require('../app');
const db = require('../db');

const SAMPLE_DEPARTMENTS = [
  { id: 1, code: 'CS', name: 'Computer Science' },
  { id: 2, code: 'MATH', name: 'Mathematics' },
];

beforeEach(() => jest.resetAllMocks());

describe('GET /api/departments', () => {
  it('returns a list of departments', async () => {
    db.query.mockResolvedValueOnce({ rows: SAMPLE_DEPARTMENTS });

    const res = await request(app).get('/api/departments');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ id: 1, code: 'CS', name: 'Computer Science' });
  });

  it('returns an empty array when there are no departments', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/departments');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 when the database throws', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/departments');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
