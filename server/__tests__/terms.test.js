jest.mock('../db', () => ({ query: jest.fn(), pool: {} }));
jest.mock('connect-pg-simple', () => () => require('express-session').MemoryStore);

const request = require('supertest');
const app = require('../app');
const db = require('../db');

const SAMPLE_TERMS = [
  { id: 1, season: 'Fall', year: 2025, label: 'Fall 2025', starts_on: '2025-08-25', ends_on: '2025-12-15' },
  { id: 2, season: 'Spring', year: 2025, label: 'Spring 2025', starts_on: '2025-01-13', ends_on: '2025-05-05' },
];

beforeEach(() => jest.clearAllMocks());

describe('GET /api/terms', () => {
  it('returns a list of terms with camelCase keys', async () => {
    db.query.mockResolvedValueOnce({ rows: SAMPLE_TERMS });

    const res = await request(app).get('/api/terms');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      id: 1,
      season: 'Fall',
      year: 2025,
      label: 'Fall 2025',
    });
    // snake_case DB columns mapped to camelCase
    expect(res.body[0]).toHaveProperty('startsOn');
    expect(res.body[0]).toHaveProperty('endsOn');
  });

  it('returns an empty array when there are no terms', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/terms');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 when the database throws', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/terms');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
