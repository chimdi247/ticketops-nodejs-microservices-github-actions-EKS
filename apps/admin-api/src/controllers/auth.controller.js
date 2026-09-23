const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const logger = require('../utils/logger');

// Looks up the admin by email in Postgres (seeded via
// src/scripts/seedAdmin.js) and compares the bcrypt hash. This is the
// primary auth path.
const authenticateAgainstDb = async (email, password) => {
  const { rows } = await pool.query(
    'SELECT email, password_hash, role FROM admins WHERE email = $1',
    [email]
  );
  if (!rows.length) return null;

  const admin = rows[0];
  const isValid = await bcrypt.compare(password, admin.password_hash);
  if (!isValid) return null;

  return { email: admin.email, role: admin.role || 'admin' };
};

// Fallback for environments where the admins table hasn't been seeded
// yet (e.g. the DB migration/seed job hasn't run), or where an admin is
// configured purely via env vars/secrets instead of the DB. Supports
// both a bcrypt-hashed ADMIN_PASSWORD and a plain-text one for dev.
const authenticateAgainstEnv = async (email, password) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword || email !== adminEmail) return null;

  const looksHashed = /^\$2[aby]\$/.test(adminPassword);
  const isValid = looksHashed
    ? await bcrypt.compare(password, adminPassword)
    : password === adminPassword;

  if (!isValid) return null;
  return { email: adminEmail, role: 'admin' };
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    let user = null;
    try {
      user = await authenticateAgainstDb(email, password);
    } catch (dbErr) {
      // admins table may not exist yet — fall through to env-based auth
      logger.warn({ message: 'DB admin lookup failed, falling back to env auth', error: dbErr.message });
    }

    if (!user) {
      user = await authenticateAgainstEnv(email, password);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    logger.info({ message: 'Admin login successful', email: user.email });

    return res.json({
      token,
      expiresIn: '8h',
      email: user.email,
    });

  } catch (err) {
    logger.error({ message: 'Login error', error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const me = (req, res) => {
  return res.json({ 
    email: req.user.email,
    role: req.user.role 
  });
};

const logout = (req, res) => {
  return res.json({ message: 'Logged out successfully' });
};

module.exports = { login, me, logout };
