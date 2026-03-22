'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const auth = require('../middleware/auth');

/**
 * POST /api/moderation/block
 * Block another user.
 * Body: { userId }
 */
router.post('/block', auth, async (req, res) => {
  try {
    const blockerId = req.user.id;
    const blockedId = (req.body.userId || '').trim();

    if (!blockedId) {
      return res.status(400).json({ error: 'userId is required.' });
    }
    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'You cannot block yourself.' });
    }

    const [userCheck] = await db.execute('SELECT id FROM users WHERE id = ?', [blockedId]);
    if (userCheck.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const id = uuidv4();
    await db.execute(
      'INSERT IGNORE INTO blocks (id, blocker_id, blocked_id) VALUES (?, ?, ?)',
      [id, blockerId, blockedId]
    );

    return res.status(201).json({ message: 'User blocked successfully.' });
  } catch (err) {
    console.error('Block error:', err);
    return res.status(500).json({ error: 'Server error blocking user.' });
  }
});

/**
 * DELETE /api/moderation/block/:userId
 * Unblock a previously blocked user.
 */
router.delete('/block/:userId', auth, async (req, res) => {
  try {
    const blockerId = req.user.id;
    const blockedId = req.params.userId;

    const [result] = await db.execute(
      'DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, blockedId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Block relationship not found.' });
    }

    return res.json({ message: 'User unblocked successfully.' });
  } catch (err) {
    console.error('Unblock error:', err);
    return res.status(500).json({ error: 'Server error unblocking user.' });
  }
});

/**
 * POST /api/moderation/report
 * Report a user for inappropriate behaviour.
 * Body: { userId, reason, details? }
 */
router.post('/report', auth, async (req, res) => {
  try {
    const reporterId = req.user.id;
    const reportedId = (req.body.userId || '').trim();
    const reason = (req.body.reason || '').trim();
    const details = (req.body.details || '').trim();

    if (!reportedId || !reason) {
      return res.status(400).json({ error: 'userId and reason are required.' });
    }
    if (reporterId === reportedId) {
      return res.status(400).json({ error: 'You cannot report yourself.' });
    }
    if (reason.length > 255) {
      return res.status(400).json({ error: 'Reason must be 255 characters or fewer.' });
    }

    const [userCheck] = await db.execute('SELECT id FROM users WHERE id = ?', [reportedId]);
    if (userCheck.length === 0) {
      return res.status(404).json({ error: 'Reported user not found.' });
    }

    const id = uuidv4();
    await db.execute(
      'INSERT INTO reports (id, reporter_id, reported_id, reason, details) VALUES (?, ?, ?, ?, ?)',
      [id, reporterId, reportedId, reason, details || null]
    );

    return res.status(201).json({ message: 'Report submitted successfully.' });
  } catch (err) {
    console.error('Report error:', err);
    return res.status(500).json({ error: 'Server error submitting report.' });
  }
});

module.exports = router;
