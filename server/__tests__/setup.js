// Minimal env vars so app.js doesn't throw at startup
process.env.SESSION_SECRET = 'test-secret';
process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
process.env.POSTGRES_DB = 'courseflix_test';
process.env.POSTGRES_USER = 'courseflix';
process.env.POSTGRES_PASSWORD = 'courseflix';
process.env.POSTGRES_PORT = '5432';
process.env.CORS_ORIGIN = 'http://localhost:5173';
