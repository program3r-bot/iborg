'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimit');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

const MIN_AGE = 18;

function calculateAge(dob) {
  const now = Date.now();
  const dobMs = new Date(dob).getTime();
  return Math.floor((now - dobMs) / (365.25 * 24 * 60 * 60 * 1000));
}

// Max DOB for 18+ (date_of_birth must be at least 18 years before today)
function maxDobFor18Plus() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE);
  return d.toISOString().slice(0, 10);
}

// GET /api/profiles/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT p.id, p.display_name, p.date_of_birth, p.bio, p.location, p.is_active, p.created_at
       FROM profiles p
       WHERE p.user_id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const profile = rows[0];
    profile.age = calculateAge(profile.date_of_birth);
    return res.status(200).json(profile);
  } catch (err) {
    console.error('[GET /profiles/me] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/profiles/me
router.put(
  '/me',
  authenticate,
  [
    body('display_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('display_name must be between 1 and 100 characters.'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('bio must be at most 1000 characters.'),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('location must be at most 200 characters.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { display_name, bio, location } = req.body;

    try {
      const rows = await db.query('SELECT id FROM profiles WHERE user_id = ?', [req.user.id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Profile not found.' });
      }

      const fields = [];
      const params = [];

      if (display_name !== undefined) {
        fields.push('display_name = ?');
        params.push(display_name);
      }
      if (bio !== undefined) {
        fields.push('bio = ?');
        params.push(bio);
      }
      if (location !== undefined) {
        fields.push('location = ?');
        params.push(location);
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided.' });
      }

      params.push(req.user.id);
      await db.query(`UPDATE profiles SET ${fields.join(', ')} WHERE user_id = ?`, params);

      return res.status(200).json({ message: 'Profile updated.' });
    } catch (err) {
      console.error('[PUT /profiles/me] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// GET /api/profiles/search  (must be before /:userId to avoid conflict)
router.get(
  '/search',
  authenticate,
  searchLimiter,
  [
    query('location').optional().trim().isLength({ max: 200 }),
    query('minAge')
      .optional()
      .isInt({ min: MIN_AGE })
      .withMessage(`minAge must be at least ${MIN_AGE}.`),
    query('maxAge')
      .optional()
      .isInt({ min: MIN_AGE })
      .withMessage(`maxAge must be at least ${MIN_AGE}.`),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    const location = req.query.location;
    const minAge = parseInt(req.query.minAge, 10) || MIN_AGE;
    const maxAge = parseInt(req.query.maxAge, 10) || 120;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    // Clamp minAge and maxAge to always be at least 18
    const safeMinAge = Math.max(minAge, MIN_AGE);
    const safeMaxAge = Math.max(maxAge, MIN_AGE);

    // Convert ages to date_of_birth boundaries (older DOB = younger bound)
    const now = new Date();
    const maxDob = new Date(now);
    maxDob.setFullYear(now.getFullYear() - safeMinAge);
    const minDob = new Date(now);
    minDob.setFullYear(now.getFullYear() - safeMaxAge - 1);

    try {
      const conditions = [
        'p.is_active = 1',
        'p.date_of_birth <= ?', // at least minAge years old
        'p.date_of_birth >= ?', // at most maxAge years old
        'p.user_id != ?',       // exclude self
      ];
      const params = [
        maxDob.toISOString().slice(0, 10),
        minDob.toISOString().slice(0, 10),
        req.user.id,
      ];

      if (location) {
        conditions.push('p.location LIKE ?');
        params.push(`%${location}%`);
      }

      params.push(limit, offset);

      const rows = await db.query(
        `SELECT p.id, p.display_name, p.bio, p.location, p.date_of_birth, p.created_at
         FROM profiles p
         WHERE ${conditions.join(' AND ')}
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
        params
      );

      // Replace exact DOB with integer age; never expose raw DOB in search results
      const results = rows.map((r) => ({
        id: r.id,
        display_name: r.display_name,
        bio: r.bio,
        location: r.location,
        age: calculateAge(r.date_of_birth),
        created_at: r.created_at,
      }));

      return res.status(200).json({ results, limit, offset });
    } catch (err) {
      console.error('[GET /profiles/search] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// GET /api/profiles/:userId  - public profile view
router.get('/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;

  try {
    const rows = await db.query(
      `SELECT p.id, p.display_name, p.bio, p.location, p.date_of_birth, p.is_active
       FROM profiles p
       WHERE p.user_id = ? AND p.is_active = 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const profile = rows[0];

    // Safety: do not expose a minor's profile under any circumstances
    const age = calculateAge(profile.date_of_birth);
    if (age < MIN_AGE) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    // Return safe public view: no raw DOB, no email
    return res.status(200).json({
      id: profile.id,
      display_name: profile.display_name,
      bio: profile.bio,
      location: profile.location,
      age,
    });
  } catch (err) {
    console.error('[GET /profiles/:userId] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
