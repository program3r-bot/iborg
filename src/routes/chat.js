'use strict';

const router = require('express').Router();
const { pool } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimit');

/**
 * GET /chat/conversations
 * Lists all conversations for the authenticated user.
 */
router.get('/conversations', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT
       c.id,
       c.created_at,
       u.id   AS partner_id,
       u.name AS partner_name,
       m.body AS last_message,
       m.created_at AS last_message_at
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id != ?
     JOIN users u ON u.id = cp2.user_id
     LEFT JOIN messages m ON m.id = (
       SELECT id FROM messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC LIMIT 1
     )
     ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
    [req.user.id, req.user.id]
  );
  res.json({ conversations: rows });
});

/**
 * POST /chat/conversations
 * Start a new conversation with another user.
 * Body: { partner_id }
 */
router.post('/conversations', requireAuth, messageLimiter, async (req, res) => {
  const { partner_id } = req.body;
  if (!partner_id) return res.status(400).json({ error: 'partner_id is required' });
  if (partner_id === req.user.id) return res.status(400).json({ error: 'Cannot start a conversation with yourself' });

  const conn = await pool.getConnection();
  try {
    // Check partner exists
    const [partnerRows] = await conn.query(
      'SELECT id FROM users WHERE id = ? AND email_verified = 1', [partner_id]
    );
    if (partnerRows.length === 0) return res.status(404).json({ error: 'Partner not found' });

    // Check if conversation already exists
    const [existing] = await conn.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = ?
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = ?`,
      [req.user.id, partner_id]
    );
    if (existing.length > 0) {
      return res.json({ conversation_id: existing[0].id });
    }

    await conn.beginTransaction();
    const [result] = await conn.query('INSERT INTO conversations () VALUES ()');
    const convId = result.insertId;
    await conn.query(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
      [convId, req.user.id, convId, partner_id]
    );
    await conn.commit();
    res.status(201).json({ conversation_id: convId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

/**
 * GET /chat/conversations/:id/messages
 * Returns paginated messages for a conversation.
 * Query: page, limit
 */
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const convId = req.params.id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;

  // Verify access
  const [access] = await pool.query(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [convId, req.user.id]
  );
  if (access.length === 0) return res.status(403).json({ error: 'Access denied' });

  const [rows] = await pool.query(
    `SELECT m.id, m.sender_id, u.name AS sender_name, m.body, m.created_at
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ?
     ORDER BY m.created_at ASC
     LIMIT ? OFFSET ?`,
    [convId, limit, offset]
  );

  res.json({ messages: rows, page, limit });
});

/**
 * POST /chat/conversations/:id/messages
 * Send a message to a conversation.
 * Body: { body }
 */
router.post('/conversations/:id/messages', requireAuth, messageLimiter, async (req, res) => {
  const convId = req.params.id;
  const { body } = req.body;

  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });
  if (body.length > 2000) return res.status(400).json({ error: 'Message exceeds 2000 characters' });

  // Verify access
  const [access] = await pool.query(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [convId, req.user.id]
  );
  if (access.length === 0) return res.status(403).json({ error: 'Access denied' });

  const [result] = await pool.query(
    'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
    [convId, req.user.id, body.trim()]
  );

  res.status(201).json({ message_id: result.insertId });
});

module.exports = router;
