'use strict';

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');

/**
 * GET /api/profiles/search
 * Query params: username, location, gender, page (default 1), limit (default 20)
 * No age restriction. Excludes users who have blocked the requester or been blocked by them.
 * Authentication is optional; blocked-user exclusion only applies when authenticated.
 */
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const username = (req.query.username || '').trim();
    const location = (req.query.location || '').trim();
    const gender = (req.query.gender || '').trim();

    const currentUserId = req.user ? req.user.id : null;

    const conditions = ['p.is_active = 1'];
    const params = [];

    if (username) {
      conditions.push('p.username LIKE ?');
      params.push(`%${username}%`);
    }
    if (location) {
      conditions.push('p.location LIKE ?');
      params.push(`%${location}%`);
    }
    if (gender) {
      conditions.push('p.gender = ?');
      params.push(gender);
    }

    // Exclude blocked relationships when the requester is authenticated
    if (currentUserId) {
      conditions.push(`p.user_id NOT IN (
        SELECT blocked_id FROM blocks WHERE blocker_id = ?
        UNION
        SELECT blocker_id FROM blocks WHERE blocked_id = ?
      )`);
      params.push(currentUserId, currentUserId);
      // Also exclude own profile
      conditions.push('p.user_id != ?');
      params.push(currentUserId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await db.execute(
      `SELECT p.id, p.user_id, p.username, p.age, p.gender, p.bio, p.location, p.photo_url, p.created_at
       FROM profiles p
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM profiles p ${where}`,
      params
    );

    return res.json({ profiles: rows, total, page, limit });
  } catch (err) {
    console.error('Profile search error:', err);
    return res.status(500).json({ error: 'Server error during search.' });
  }
});

/**
 * GET /api/profiles/:id
 * Get a single profile by profile id.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT p.id, p.user_id, p.username, p.age, p.gender, p.bio, p.location, p.photo_url, p.created_at
       FROM profiles p
       WHERE p.id = ? AND p.is_active = 1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    return res.json({ profile: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Server error fetching profile.' });
  }
});

/**
 * GET /api/profiles/me
 * Get the authenticated user's own profile.
 */
router.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, user_id, username, age, gender, bio, location, photo_url, created_at FROM profiles WHERE user_id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    return res.json({ profile: rows[0] });
  } catch (err) {
    console.error('Get own profile error:', err);
    return res.status(500).json({ error: 'Server error fetching profile.' });
  }
});

/**
 * PUT /api/profiles/me
 * Update the authenticated user's own profile.
 * Body (all optional): { username, age, gender, bio, location, photo_url }
 */
router.put('/me', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const allowed = ['username', 'age', 'gender', 'bio', 'location', 'photo_url'];
    const updates = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates[field] = typeof req.body[field] === 'string'
          ? req.body[field].trim()
          : req.body[field];
      }
    }

    if (updates.username !== undefined) {
      if (!/^[a-zA-Z0-9_]{3,50}$/.test(updates.username)) {
        return res.status(400).json({ error: 'Username must be 3-50 characters (letters, numbers, underscores).' });
      }
      // Check uniqueness
      const [dup] = await db.execute(
        'SELECT id FROM profiles WHERE username = ? AND user_id != ?',
        [updates.username, userId]
      );
      if (dup.length > 0) {
        return res.status(409).json({ error: 'Username is already taken.' });
      }
    }

    if (updates.age !== undefined) {
      const age = parseInt(updates.age, 10);
      if (isNaN(age) || age < 0 || age > 150) {
        return res.status(400).json({ error: 'Invalid age value.' });
      }
      updates.age = age;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), userId];

    await db.execute(`UPDATE profiles SET ${setClauses} WHERE user_id = ?`, values);

    const [rows] = await db.execute(
      'SELECT id, user_id, username, age, gender, bio, location, photo_url FROM profiles WHERE user_id = ?',
      [userId]
    );
    return res.json({ profile: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Server error updating profile.' });
  }
});

module.exports = router;
