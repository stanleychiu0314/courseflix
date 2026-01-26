BEGIN;

-- ============================
-- Create database (if missing)
-- ============================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = 'courseflix'
  ) THEN
    EXECUTE 'CREATE DATABASE courseflix';
  END IF;
END $$;

COMMIT;

-- ============================
-- Switch to app database
-- ============================
\c courseflix

BEGIN;

-- ============================
-- Create shared role (if missing)
-- ============================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'courseflix_shared'
  ) THEN
    CREATE ROLE courseflix_shared
      LOGIN
      PASSWORD 'courseflix123';
  END IF;
END $$;

-- ============================
-- Database + schema access
-- ============================
GRANT CONNECT ON DATABASE courseflix TO courseflix_shared;
GRANT USAGE, CREATE ON SCHEMA public TO courseflix_shared;

-- ============================
-- Existing tables & sequences
-- ============================
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO courseflix_shared;

GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA public
TO courseflix_shared;

-- ============================
-- Future tables & sequences
-- ============================
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES TO courseflix_shared;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE
ON SEQUENCES TO courseflix_shared;

COMMIT;

