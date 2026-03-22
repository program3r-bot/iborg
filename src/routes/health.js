'use strict';

const { ping } = require('../config/database');
const router = require('express').Router();

/**
 * GET /health
 * Returns HTTP 200 if the app is running and the database is reachable.
 * Returns HTTP 503 if the database check fails.
 */
router.get('/', async (_req, res) => {
  try {
    const db = await ping();
    res.json({
      status: 'ok',
      db: { status: 'ok', version: db.version, serverTime: db.now },
      app: { name: 'iborg', version: process.env.npm_package_version },
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: { status: 'unreachable' },
      message: 'Database connection failed',
    });
  }
});

module.exports = router;
