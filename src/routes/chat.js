'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rateLimit');

/**
 * GET /api/chat/conversations
 * List all conversations for the authenticated user.
 * Returns the most recent message per conversation partner.
 */
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.execute(
      `SELECT
         convs.partner_id,
         p.username   AS partner_username,
         p.photo_url  AS partner_photo_url,
         m.content    AS last_message,
         convs.last_at,
         convs.unread_count
       FROM (
         SELECT
           IF(sender_id = ?, recipient_id, sender_id) AS partner_id,
           MAX(id)         AS last_message_id,
           MAX(created_at) AS last_at,
           SUM(is_read = 0 AND recipient_id = ?) AS unread_count
         FROM messages
         WHERE sender_id = ? OR recipient_id = ?
         GROUP BY partner_id
       ) AS convs
       JOIN messages m ON m.id = convs.last_message_id
       JOIN profiles p ON p.user_id = convs.partner_id
       ORDER BY convs.last_at DESC`,
      [userId, userId, userId, userId]
    );

    return res.json({ conversations: rows });
  } catch (err) {
    console.error('Get conversations error:', err);
    return res.status(500).json({ error: 'Server error fetching conversations.' });
  }
});

/**
 * GET /api/chat/messages/:userId
 * Get paginated messages between the authenticated user and :userId.
 * Query params: page (default 1), limit (default 30)
 */
router.get('/messages/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const partnerId = req.params.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (page - 1) * limit;

    // Verify partner exists
    const [userCheck] = await db.execute('SELECT id FROM users WHERE id = ?', [partnerId]);
    if (userCheck.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const [rows] = await db.execute(
      `SELECT id, sender_id, recipient_id, content, is_read, created_at
       FROM messages
       WHERE (sender_id = ? AND recipient_id = ?)
          OR (sender_id = ? AND recipient_id = ?)
       ORDER BY created_at ASC
       LIMIT ? OFFSET ?`,
      [currentUserId, partnerId, partnerId, currentUserId, limit, offset]
    );

    // Mark received messages as read
    await db.execute(
      'UPDATE messages SET is_read = 1 WHERE recipient_id = ? AND sender_id = ? AND is_read = 0',
      [currentUserId, partnerId]
    );

    return res.json({ messages: rows, page, limit });
  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({ error: 'Server error fetching messages.' });
  }
});

/**
 * POST /api/chat/messages/:userId
 * Send a message to :userId.
 * Body: { content }
 */
router.post('/messages/:userId', auth, chatLimiter, async (req, res) => {
  try {
    const senderId = req.user.id;
    const recipientId = req.params.userId;
    const content = (req.body.content || '').trim();

    if (!content) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message is too long (max 2000 characters).' });
    }
    if (senderId === recipientId) {
      return res.status(400).json({ error: 'You cannot send a message to yourself.' });
    }

    // Verify recipient exists
    const [userCheck] = await db.execute('SELECT id FROM users WHERE id = ?', [recipientId]);
    if (userCheck.length === 0) {
      return res.status(404).json({ error: 'Recipient not found.' });
    }

    // Check block in either direction
    const [blockCheck] = await db.execute(
      `SELECT id FROM blocks
       WHERE (blocker_id = ? AND blocked_id = ?)
          OR (blocker_id = ? AND blocked_id = ?)
       LIMIT 1`,
      [senderId, recipientId, recipientId, senderId]
    );
    if (blockCheck.length > 0) {
      return res.status(403).json({ error: 'You cannot message this user.' });
    }

    const messageId = uuidv4();
    await db.execute(
      'INSERT INTO messages (id, sender_id, recipient_id, content) VALUES (?, ?, ?, ?)',
      [messageId, senderId, recipientId, content]
    );

    return res.status(201).json({
      message: { id: messageId, sender_id: senderId, recipient_id: recipientId, content, is_read: 0 }
    });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ error: 'Server error sending message.' });
  }
});

module.exports = router;
