'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');

const { apiLimiter } = require('./src/middleware/rateLimit');
const healthRouter = require('./src/routes/health');
const authRouter = require('./src/routes/auth');
const profilesRouter = require('./src/routes/profiles');
const chatRouter = require('./src/routes/chat');

const app = express();

// Security headers
app.use(helmet());

// Parse JSON request bodies
app.use(express.json());

// Apply general rate limiter to all routes
app.use(apiLimiter);

// Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/profiles', profilesRouter);
app.use('/chat', chatRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — never leak stack traces to clients
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`iborg listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
