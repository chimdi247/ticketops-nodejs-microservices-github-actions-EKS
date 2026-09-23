'use strict';
// ── Admin user seed script ──────────────────────────────────────────────
// Creates (or updates) the default admin login so the dashboard can be
// logged into right after `docker compose up`. The password is hashed
// with bcrypt before it's ever written to Postgres — the plaintext value
// is only used locally, in memory, to compute the hash.
//
// Run automatically by the one-off `db-seed-admin` service in
// docker-compose.yml, after postgres is healthy and the `admins` table
// has been created by db/init/002-admins.sql. Safe to re-run — it
// upserts on email.
//
// Usage: node src/scripts/seedAdmin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const logger = require('../utils/logger');

const EMAIL = process.env.ADMIN_SEED_EMAIL || 'admin@example.com';
const PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'password123';
const SALT_ROUNDS = 10;

const waitForDb = async (retries = 20, delayMs = 2000) => {
  for (let i = 1; i <= retries; i += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      logger.warn({ message: `waiting for database (attempt ${i}/${retries})`, error: err.message });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('database not reachable after retries');
};

const ensureAdminsTable = async () => {
  // defensive — normally created by db/init/002-admins.sql, but this
  // makes the script safe to run standalone too (e.g. against a DB that
  // was created before this table existed).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          VARCHAR(20) NOT NULL DEFAULT 'admin',
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW()
    );
  `);
};

const seedAdmin = async () => {
  await waitForDb();
  await ensureAdminsTable();

  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

  await pool.query(
    `INSERT INTO admins (email, password_hash, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
    [EMAIL, passwordHash]
  );

  logger.info({ message: 'admin user seeded successfully', email: EMAIL });
  // eslint-disable-next-line no-console
  console.log(`✔ admin user ready — login with ${EMAIL} / <the password you configured>`);
};

seedAdmin()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ message: 'failed to seed admin user', error: err.message });
    console.error(err);
    process.exit(1);
  });
