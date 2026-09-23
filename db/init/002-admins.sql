-- Admin users table for admin-api JWT login.
-- Mounted into postgres's /docker-entrypoint-initdb.d/ alongside the
-- events-api schema (001-schema.sql), so it's created automatically the
-- first time the postgres container starts with an empty data volume.
CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
