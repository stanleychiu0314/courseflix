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

// setup.js sets ADMIN_EMAILS=admin@vanderbilt.edu
const ADMIN_EMAIL = 'admin@vanderbilt.edu';

beforeEach(() => jest.resetAllMocks());

// ---------------------------------------------------------------------------
// All admin endpoints require authentication
// ---------------------------------------------------------------------------
describe('Admin endpoints — unauthenticated', () => {
  it('GET /api/admin/syllabi → 401', async () => {
    const res = await request(app).get('/api/admin/syllabi');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/admin/syllabi/:id/approve → 401', async () => {
    const res = await request(app).patch('/api/admin/syllabi/123/approve');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/admin/syllabi/:id/reject → 401', async () => {
    const res = await request(app).patch('/api/admin/syllabi/123/reject').send({ reason: 'bad' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/admin/reviews/:reviewId/text → 401', async () => {
    const res = await request(app).delete('/api/admin/reviews/review-1/text');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Authenticated but non-admin user → 403
// ---------------------------------------------------------------------------
describe('Admin endpoints — authenticated non-admin', () => {
  it('GET /api/admin/syllabi → 403', async () => {
    const agent = await createAuthAgent(app, { email: 'regular@vanderbilt.edu' });

    const res = await agent.get('/api/admin/syllabi');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Admin-authenticated happy paths
// ---------------------------------------------------------------------------
describe('GET /api/admin/syllabi (admin)', () => {
  it('returns syllabi list with pagination', async () => {
    const agent = await createAuthAgent(app, { email: ADMIN_EMAIL });

    db.query
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })  // count
      .mockResolvedValueOnce({ rows: [] });               // syllabi

    const res = await agent.get('/api/admin/syllabi');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('syllabi');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.syllabi)).toBe(true);
  });

  it('accepts ?status=pending filter', async () => {
    const agent = await createAuthAgent(app, { email: ADMIN_EMAIL });

    db.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 's-1', status: 'pending', file_name: 'a.pdf' }] });

    const res = await agent.get('/api/admin/syllabi?status=pending');
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalCount).toBe(1);
  });
});

describe('PATCH /api/admin/syllabi/:id/approve (admin)', () => {
  it('returns 404 when syllabus is not found or already reviewed', async () => {
    const agent = await createAuthAgent(app, { email: ADMIN_EMAIL });
    db.query.mockResolvedValueOnce({ rows: [] }); // update returned nothing

    const res = await agent.patch('/api/admin/syllabi/no-such-id/approve');
    expect(res.status).toBe(404);
  });

  it('returns { success: true } when approval succeeds', async () => {
    const agent = await createAuthAgent(app, { email: ADMIN_EMAIL });
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'syl-1', status: 'approved', reviewed_at: new Date() }],
    });

    const res = await agent.patch('/api/admin/syllabi/syl-1/approve');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

describe('PATCH /api/admin/syllabi/:id/reject (admin)', () => {
  it('returns 400 when reason is missing', async () => {
    const agent = await createAuthAgent(app, { email: ADMIN_EMAIL });

    const res = await agent.patch('/api/admin/syllabi/syl-1/reject').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/i);
  });

  it('returns { success: true } with a valid reason', async () => {
    const agent = await createAuthAgent(app, { email: ADMIN_EMAIL });
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'syl-1', status: 'rejected', reviewed_at: new Date(), rejection_reason: 'Blurry scan' }],
    });

    const res = await agent.patch('/api/admin/syllabi/syl-1/reject').send({ reason: 'Blurry scan' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

describe('DELETE /api/admin/reviews/:reviewId/text (admin)', () => {
  it('returns 404 when review does not exist', async () => {
    const agent = await createAuthAgent(app, { email: ADMIN_EMAIL });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await agent.delete('/api/admin/reviews/no-such-review/text');
    expect(res.status).toBe(404);
  });

  it('returns { success: true } when review text is cleared', async () => {
    const agent = await createAuthAgent(app, { email: ADMIN_EMAIL });
    db.query.mockResolvedValueOnce({ rows: [{ id: 'review-1' }] });

    const res = await agent.delete('/api/admin/reviews/review-1/text');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
