const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'courseflix',
  password: process.env.POSTGRES_PASSWORD || 'courseflix',
  database: process.env.POSTGRES_DB || 'courseflix',
  ssl: process.env.POSTGRES_HOST && process.env.POSTGRES_HOST !== 'localhost'
    ? { rejectUnauthorized: false }
    : false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
