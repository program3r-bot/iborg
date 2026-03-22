'use strict';

require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic rate limiter applied to all routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Health-check / DB connectivity test
app.get('/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: rows[0] });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`iborg listening on port ${PORT}`);
}).on('error', (err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

module.exports = app;
