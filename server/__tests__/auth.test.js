jest.mock('../db', () => ({ query: jest.fn(), pool: {} }));
jest.mock('connect-pg-simple', () => () => require('express-session').MemoryStore);

// Prevent the JWKS fetch that happens at module load time
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => ({})),
  jwtVerify: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');

beforeEach(() => jest.resetAllMocks());

describe('GET /api/auth/me', () => {
  it('returns 401 with authenticated:false when no session', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ authenticated: false });
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears the session cookie', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Logged out.' });
  });
});

describe('POST /api/auth/microsoft/login', () => {
  it('returns 400 when idToken is missing', async () => {
    const res = await request(app)
      .post('/api/auth/microsoft/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message', 'Missing idToken');
  });

  it('returns 401 when the token is invalid', async () => {
    const { jwtVerify } = require('jose');
    jwtVerify.mockRejectedValueOnce(new Error('invalid signature'));

    const res = await request(app)
      .post('/api/auth/microsoft/login')
      .send({ idToken: 'bad.token.here' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message', 'Invalid or expired token');
  });
});
