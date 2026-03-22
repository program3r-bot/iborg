'use strict';

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { sendMail } = require('../config/email');
const { authLimiter } = require('../middleware/rateLimit');

const BCRYPT_ROUNDS = 12;

/** Validate that the user is at least 18 years old. */
function isAdult(dateOfBirthStr) {
  const dob = new Date(dateOfBirthStr);
  if (isNaN(dob.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob <= cutoff;
}

/**
 * POST /auth/register
 * Body: { email, password, name, date_of_birth (YYYY-MM-DD), gender, location }
 */
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, name, date_of_birth, gender, location } = req.body;

  if (!email || !password || !name || !date_of_birth) {
    return res.status(400).json({ error: 'email, password, name and date_of_birth are required' });
  }

  // 18+ age gate
  if (!isAdult(date_of_birth)) {
    return res.status(403).json({ error: 'You must be 18 or older to register' });
  }

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verifyToken = uuidv4();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [result] = await conn.query(
      `INSERT INTO users
         (email, password_hash, name, date_of_birth, gender, location, verify_token, verify_expiry)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, passwordHash, name, date_of_birth, gender || null, location || null, verifyToken, verifyExpiry]
    );

    const verifyUrl = `${process.env.APP_URL}/auth/verify-email?token=${verifyToken}`;
    await sendMail({
      to: email,
      subject: 'Verify your iborg account',
      html: `<p>Hi ${name},</p>
             <p>Please verify your email by clicking the link below (valid for 24 hours):</p>
             <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    res.status(201).json({ message: 'Registration successful. Check your email to verify your account.' });
  } finally {
    conn.release();
  }
});

/**
 * GET /auth/verify-email?token=<uuid>
 */
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, verify_expiry FROM users WHERE verify_token = ? AND email_verified = 0',
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or already-used verification token' });
    }
    const user = rows[0];
    if (new Date() > new Date(user.verify_expiry)) {
      return res.status(400).json({ error: 'Verification token has expired. Please register again.' });
    }
    await conn.query(
      'UPDATE users SET email_verified = 1, verify_token = NULL, verify_expiry = NULL WHERE id = ?',
      [user.id]
    );
    res.json({ message: 'Email verified. You can now log in.' });
  } finally {
    conn.release();
  }
});

/**
 * POST /auth/login
 * Body: { email, password }
 */
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const [rows] = await pool.query(
    'SELECT id, email, password_hash, email_verified FROM users WHERE email = ?',
    [email]
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const user = rows[0];

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!user.email_verified) {
    return res.status(403).json({ error: 'Please verify your email before logging in' });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
});

/**
 * POST /auth/forgot-password
 * Body: { email }
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT id, name FROM users WHERE email = ?', [email]);
    // Always return 200 to avoid user enumeration
    if (rows.length === 0) {
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }
    const user = rows[0];
    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await conn.query(
      'UPDATE users SET reset_token = ?, reset_expiry = ? WHERE id = ?',
      [resetToken, resetExpiry, user.id]
    );

    const resetUrl = `${process.env.APP_URL}/auth/reset-password?token=${resetToken}`;
    await sendMail({
      to: email,
      subject: 'Reset your iborg password',
      html: `<p>Hi ${user.name},</p>
             <p>Click below to reset your password (link valid for 1 hour):</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>
             <p>If you did not request a password reset, you can safely ignore this email.</p>`,
    });

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } finally {
    conn.release();
  }
});

/**
 * POST /auth/reset-password
 * Body: { token, password }
 */
router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'token and password are required' });
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, reset_expiry FROM users WHERE reset_token = ?',
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    const user = rows[0];
    if (new Date() > new Date(user.reset_expiry)) {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await conn.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expiry = NULL WHERE id = ?',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
