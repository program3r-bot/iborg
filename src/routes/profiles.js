'use strict';

const router = require('express').Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /profiles
 * Query params: gender, location, min_age, max_age, page, limit
 * Lists verified, active users — requires authentication.
 */
router.get('/', requireAuth, async (req, res) => {
  const { gender, location, min_age, max_age, page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  let where = ['u.email_verified = 1', 'u.id != ?'];
  const params = [req.user.id];

  if (gender) {
    where.push('u.gender = ?');
    params.push(gender);
  }
  if (location) {
    where.push('u.location LIKE ?');
    params.push(`%${location}%`);
  }
  if (min_age) {
    const maxDob = new Date();
    maxDob.setFullYear(maxDob.getFullYear() - parseInt(min_age, 10));
    where.push('u.date_of_birth <= ?');
    params.push(maxDob.toISOString().slice(0, 10));
  }
  if (max_age) {
    const minDob = new Date();
    minDob.setFullYear(minDob.getFullYear() - parseInt(max_age, 10) - 1);
    where.push('u.date_of_birth >= ?');
    params.push(minDob.toISOString().slice(0, 10));
  }

  const whereClause = where.join(' AND ');

  const countParams = [...params];
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u WHERE ${whereClause}`,
    countParams
  );
  const total = countRows[0].total;

  params.push(limitNum, offset);
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.gender, u.location,
            TIMESTAMPDIFF(YEAR, u.date_of_birth, CURDATE()) AS age,
            u.created_at
     FROM users u
     WHERE ${whereClause}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    params
  );

  res.json({
    profiles: rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

/**
 * GET /profiles/:id
 * Returns a single public profile.
 */
router.get('/:id', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, gender, location,
            TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) AS age,
            created_at
     FROM users
     WHERE id = ? AND email_verified = 1`,
    [req.params.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  res.json(rows[0]);
});

module.exports = router;
