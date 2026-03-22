'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

// POST /api/safety/blocks
router.post(
  '/blocks',
  authenticate,
  [
    body('targetId').isUUID().withMessage('targetId must be a valid UUID.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const blockerId = req.user.id;
    const { targetId } = req.body;

    if (blockerId === targetId) {
      return res.status(400).json({ error: 'Cannot block yourself.' });
    }

    try {
      // Verify target user exists
      const target = await db.query('SELECT id FROM users WHERE id = ?', [targetId]);
      if (target.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const existing = await db.query(
        'SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
        [blockerId, targetId]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: 'User is already blocked.' });
      }

      const blockId = uuidv4();
      await db.query(
        'INSERT INTO blocks (id, blocker_id, blocked_id) VALUES (?, ?, ?)',
        [blockId, blockerId, targetId]
      );

      return res.status(201).json({ message: 'User blocked.' });
    } catch (err) {
      console.error('[POST /blocks] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// DELETE /api/safety/blocks/:targetId
router.delete('/blocks/:targetId', authenticate, async (req, res) => {
  const blockerId = req.user.id;
  const { targetId } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, targetId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Block not found.' });
    }

    return res.status(200).json({ message: 'User unblocked.' });
  } catch (err) {
    console.error('[DELETE /blocks/:targetId] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/safety/reports
router.post(
  '/reports',
  authenticate,
  [
    body('targetId').isUUID().withMessage('targetId must be a valid UUID.'),
    body('reason')
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('reason must be between 10 and 500 characters.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const reporterId = req.user.id;
    const { targetId, reason } = req.body;

    if (reporterId === targetId) {
      return res.status(400).json({ error: 'Cannot report yourself.' });
    }

    try {
      const target = await db.query('SELECT id FROM users WHERE id = ?', [targetId]);
      if (target.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const reportId = uuidv4();
      await db.query(
        'INSERT INTO reports (id, reporter_id, reported_id, reason) VALUES (?, ?, ?, ?)',
        [reportId, reporterId, targetId, reason]
      );

      return res.status(201).json({ message: 'Report submitted. Thank you for helping keep the platform safe.' });
    } catch (err) {
      console.error('[POST /reports] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

module.exports = router;
