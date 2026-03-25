// Minimal env vars so app.js doesn't throw at startup
process.env.SESSION_SECRET = 'test-secret';
process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
process.env.POSTGRES_DB = 'courseflix_test';
process.env.POSTGRES_USER = 'courseflix';
process.env.POSTGRES_PASSWORD = 'courseflix';
process.env.POSTGRES_PORT = '5432';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.ADMIN_EMAILS = 'admin@vanderbilt.edu';

const EXPECTED_TEST_ERROR_LOG_PATTERNS = [
  /^Error fetching courses:/,
  /^Error fetching course details:/,
  /^Error fetching departments:/,
  /^Error fetching terms:/,
  /^Microsoft login error:/,
  /^Test login error:/,
  /^Stack:/,
];

const originalConsoleError = console.error.bind(console);
const shouldSuppressKnownErrors = process.env.SUPPRESS_TEST_ERROR_LOGS !== 'false';

function formatErrorArgs(args) {
  return args
    .map((value) => {
      if (value instanceof Error) {
        return value.stack || value.message || String(value);
      }
      if (typeof value === 'string') {
        return value;
      }
      if (value === undefined) {
        return 'undefined';
      }
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    })
    .join(' ');
}

if (!console.__courseflixTestErrorSuppress && shouldSuppressKnownErrors) {
  console.error = (...args) => {
    const message = formatErrorArgs(args);
    const shouldSuppress = EXPECTED_TEST_ERROR_LOG_PATTERNS.some((pattern) => pattern.test(message));

    if (!shouldSuppress) {
      originalConsoleError(...args);
    }
  };

  console.__courseflixTestErrorSuppress = true;
}

const supertest = require('supertest');
const tls = require('tls');

// Some Node/test environments can return an IPv6 wildcard for ephemeral
// listener ports. Force the request URL to use localhost so callers use loopback.
if (!supertest.Test.prototype.__courseflixLoopbackPatch) {
  const originalServerAddress = supertest.Test.prototype.serverAddress;

  supertest.Test.prototype.serverAddress = function (app, path) {
    const url = originalServerAddress.call(this, app, path);
    const addr = app && app.address && app.address();

    if (!addr || typeof addr === 'string') {
      return url;
    }

    if (addr.address === '::' || addr.address === '0.0.0.0') {
      const protocol = app instanceof tls.Server ? 'https' : 'http';
      return `${protocol}://127.0.0.1:${addr.port}${path}`;
    }

    return url;
  };

  supertest.Test.prototype.__courseflixLoopbackPatch = true;
}
