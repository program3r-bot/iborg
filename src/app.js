'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({ origin: config.cors.origin, credentials: true }));

// Body parsing (limit to 10kb to prevent payload attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// CSRF note: This API uses Bearer token authentication (JWT in Authorization header).
// Browser-based CSRF attacks cannot read or inject the Authorization header, so
// CSRF tokens are not required for pure JSON API endpoints that use Bearer auth.
// If you add cookie-based session auth in the future, add csurf middleware here.

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Global error handler - never log sensitive data
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Unhandled error]', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;
