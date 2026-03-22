'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimit');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

const MIN_AGE = 18;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_URLS_PER_MESSAGE = 3;
const SPAM_IDENTICAL_THRESHOLD = 5;
const SPAM_BURST_THRESHOLD = 20;
const URL_PATTERN = /https?:\/\/\S+/gi;

function toMySQLTimestamp(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}



function calculateAge(dob) {
  const now = Date.now();
  const dobMs = new Date(dob).getTime();
  return Math.floor((now - dobMs) / (365.25 * 24 * 60 * 60 * 1000));
}

async function assertUserVerifiedAndAdult(userId) {
  const rows = await db.query(
    `SELECT u.email_verified, p.date_of_birth
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );
  if (rows.length === 0) throw Object.assign(new Error('User not found.'), { status: 404 });
  const { email_verified, date_of_birth } = rows[0];
  if (!email_verified) throw Object.assign(new Error('User must verify their email.'), { status: 403 });
  if (calculateAge(date_of_birth) < MIN_AGE) throw Object.assign(new Error('User is not an adult.'), { status: 403 });
}

async function assertNoBlock(userAId, userBId) {
  const rows = await db.query(
    `SELECT id FROM blocks
     WHERE (blocker_id = ? AND blocked_id = ?)
        OR (blocker_id = ? AND blocked_id = ?)`,
    [userAId, userBId, userBId, userAId]
  );
  if (rows.length > 0) {
    throw Object.assign(new Error('A block exists between these users.'), { status: 403 });
  }
}

async function assertConversationParticipant(conversationId, userId) {
  const rows = await db.query(
    'SELECT id FROM conversations WHERE id = ? AND (participant_a = ? OR participant_b = ?)',
    [conversationId, userId, userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Conversation not found.'), { status: 404 });
  }
  return rows[0];
}

// POST /api/chat/conversations
router.post(
  '/conversations',
  authenticate,
  [
    body('recipientId')
      .isUUID()
      .withMessage('recipientId must be a valid UUID.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const senderId = req.user.id;
    const { recipientId } = req.body;

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot start a conversation with yourself.' });
    }

    try {
      await assertUserVerifiedAndAdult(senderId);
      await assertUserVerifiedAndAdult(recipientId);
      await assertNoBlock(senderId, recipientId);

      // Canonical ordering to avoid duplicate rows
      const [a, b] = [senderId, recipientId].sort();

      const existing = await db.query(
        'SELECT id FROM conversations WHERE participant_a = ? AND participant_b = ?',
        [a, b]
      );

      if (existing.length > 0) {
        return res.status(200).json({ conversationId: existing[0].id });
      }

      const convId = uuidv4();
      await db.query(
        'INSERT INTO conversations (id, participant_a, participant_b) VALUES (?, ?, ?)',
        [convId, a, b]
      );

      return res.status(201).json({ conversationId: convId });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      console.error('[POST /conversations] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// GET /api/chat/conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT c.id, c.participant_a, c.participant_b, c.created_at
       FROM conversations c
       WHERE c.participant_a = ? OR c.participant_b = ?
       ORDER BY c.created_at DESC`,
      [req.user.id, req.user.id]
    );
    return res.status(200).json({ conversations: rows });
  } catch (err) {
    console.error('[GET /conversations] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/chat/conversations/:conversationId/messages
router.post(
  '/conversations/:conversationId/messages',
  authenticate,
  messageLimiter,
  [
    body('body')
      .trim()
      .isLength({ min: 1, max: MAX_MESSAGE_LENGTH })
      .withMessage(`Message body must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`),
  ],
  handleValidationErrors,
  async (req, res) => {
    const senderId = req.user.id;
    const { conversationId } = req.params;
    const messageBody = req.body.body;

    try {
      // Verify sender is in the conversation
      await assertConversationParticipant(conversationId, senderId);

      // Determine recipient
      const convRows = await db.query(
        'SELECT participant_a, participant_b FROM conversations WHERE id = ?',
        [conversationId]
      );
      const conv = convRows[0];
      const recipientId = conv.participant_a === senderId ? conv.participant_b : conv.participant_a;

      // Both parties must be verified adults with no blocks
      await assertUserVerifiedAndAdult(senderId);
      await assertUserVerifiedAndAdult(recipientId);
      await assertNoBlock(senderId, recipientId);

      // Anti-spam: URL count check
      const urlMatches = messageBody.match(URL_PATTERN) || [];
      if (urlMatches.length > MAX_URLS_PER_MESSAGE) {
        return res.status(400).json({ error: `Messages may contain at most ${MAX_URLS_PER_MESSAGE} URLs.` });
      }

      // Anti-spam: identical message flood (>5 identical in last hour)
      const oneHourAgo = toMySQLTimestamp(new Date(Date.now() - 60 * 60 * 1000));
      const identicalRows = await db.query(
        `SELECT COUNT(*) AS cnt FROM messages
         WHERE conversation_id = ? AND sender_id = ? AND body = ? AND created_at >= ?`,
        [conversationId, senderId, messageBody, oneHourAgo]
      );
      if (identicalRows[0].cnt >= SPAM_IDENTICAL_THRESHOLD) {
        return res.status(429).json({ error: 'Duplicate message spam detected. Please vary your messages.' });
      }

      // Anti-spam: burst check (>20 messages in last minute)
      const oneMinuteAgo = toMySQLTimestamp(new Date(Date.now() - 60 * 1000));
      const burstRows = await db.query(
        `SELECT COUNT(*) AS cnt FROM messages
         WHERE conversation_id = ? AND sender_id = ? AND created_at >= ?`,
        [conversationId, senderId, oneMinuteAgo]
      );
      if (burstRows[0].cnt >= SPAM_BURST_THRESHOLD) {
        return res.status(429).json({ error: 'Message rate limit exceeded. Please wait before sending more messages.' });
      }

      const msgId = uuidv4();
      await db.query(
        'INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)',
        [msgId, conversationId, senderId, messageBody]
      );

      return res.status(201).json({ messageId: msgId });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      console.error('[POST /messages] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// GET /api/chat/conversations/:conversationId/messages
router.get(
  '/conversations/:conversationId/messages',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isUUID().withMessage('before must be a valid message UUID.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const { conversationId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before;

    try {
      await assertConversationParticipant(conversationId, req.user.id);

      let sql = `SELECT id, sender_id, body, created_at
                 FROM messages
                 WHERE conversation_id = ?`;
      const params = [conversationId];

      if (before) {
        // Cursor-based: get messages older than the given message id
        const cursorRows = await db.query('SELECT created_at FROM messages WHERE id = ?', [before]);
        if (cursorRows.length > 0) {
          sql += ' AND created_at < ?';
          params.push(cursorRows[0].created_at);
        }
      }

      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const rows = await db.query(sql, params);
      return res.status(200).json({ messages: rows.reverse() });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      console.error('[GET /messages] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

module.exports = router;
