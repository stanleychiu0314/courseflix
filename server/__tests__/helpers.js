/**
 * Shared test utilities.
 *
 * Each test file that uses createAuthAgent must already have declared:
 *   jest.mock('../db', ...)
 *   jest.mock('jose', ...)
 *   jest.mock('connect-pg-simple', ...)
 *
 * Those mocks are hoisted by Jest before this helper is required, so the
 * functions below will receive the mocked versions.
 */

const request = require('supertest');

/**
 * Log in a test user via the real /api/auth/microsoft/login route and return a
 * supertest agent whose cookie jar holds the resulting session cookie.
 *
 * @param {import('express').Application} app
 * @param {{ email?: string, name?: string }} [options]
 */
async function createAuthAgent(app, options = {}) {
  const { email = 'test@vanderbilt.edu', name = 'Test User' } = options;

  const { jwtVerify } = require('jose');
  const db = require('../db');

  // Make jwtVerify return a valid-looking Microsoft payload
  jwtVerify.mockResolvedValueOnce({
    payload: {
      iss: 'https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0',
      email,
      name,
      oid: 'oid-test-123',
    },
  });

  // The login route does one DB UPSERT and returns the user row
  db.query.mockResolvedValueOnce({
    rows: [{ id: 'user-uuid-abc', email, name }],
  });

  const agent = request.agent(app);
  await agent.post('/api/auth/microsoft/login').send({ idToken: 'test.token.xyz' });
  return agent;
}

module.exports = { createAuthAgent };
