'use strict';

const rateLimit = require('express-rate-limit');

/** General API rate limiter — 120 requests per 15 min per IP. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/** Strict limiter for auth endpoints — 10 attempts per 15 min per IP. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

/** Message-send limiter — 30 messages per minute per IP. */
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Message rate limit exceeded.' },
});

module.exports = { apiLimiter, authLimiter, messageLimiter };
