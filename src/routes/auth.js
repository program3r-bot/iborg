'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { signToken } = require('../utils/jwt');
const { sendVerificationEmail } = require('../utils/email');
const { authLimiter } = require('../middleware/rateLimit');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const MIN_AGE = 18;

function calculateAge(dob) {
  const now = Date.now();
  const dobMs = new Date(dob).getTime();
  return Math.floor((now - dobMs) / (365.25 * 24 * 60 * 60 * 1000));
}

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
    body('date_of_birth')
      .isDate({ format: 'YYYY-MM-DD' })
      .withMessage('date_of_birth must be a valid date (YYYY-MM-DD).'),
    body('display_name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('display_name is required (max 100 chars).'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { email, password, date_of_birth, display_name } = req.body;

    // Age gate: must be 18+
    const age = calculateAge(date_of_birth);
    if (age < MIN_AGE) {
      return res.status(400).json({
        error: `You must be at least ${MIN_AGE} years old to register.`,
      });
    }

    try {
      // Check for duplicate email
      const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }

      const userId = uuidv4();
      const profileId = uuidv4();
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const verificationToken = uuidv4();
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.query(
        `INSERT INTO users (id, email, password_hash, email_verified, verification_token, verification_token_expires)
         VALUES (?, ?, ?, 0, ?, ?)`,
        [userId, email, passwordHash, verificationToken, tokenExpires]
      );

      await db.query(
        `INSERT INTO profiles (id, user_id, display_name, date_of_birth)
         VALUES (?, ?, ?, ?)`,
        [profileId, userId, display_name, date_of_birth]
      );

      await sendVerificationEmail(email, verificationToken);

      return res.status(201).json({
        message: 'Account created. Please check your email to verify your account.',
      });
    } catch (err) {
      console.error('[register] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { email, password } = req.body;

    try {
      const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const user = users[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      if (!user.email_verified) {
        return res.status(403).json({
          error: 'Please verify your email address before logging in.',
        });
      }

      const token = signToken({ id: user.id, email: user.email });
      return res.status(200).json({ token });
    } catch (err) {
      console.error('[login] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// GET /api/auth/verify-email?token=
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  try {
    const users = await db.query(
      `SELECT id FROM users
       WHERE verification_token = ?
         AND email_verified = 0
         AND verification_token_expires > NOW()`,
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    await db.query(
      `UPDATE users
       SET email_verified = 1,
           verification_token = NULL,
           verification_token_expires = NULL
       WHERE id = ?`,
      [users[0].id]
    );

    return res.status(200).json({ message: 'Email verified successfully. You may now log in.' });
  } catch (err) {
    console.error('[verify-email] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
