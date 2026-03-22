'use strict';

const jwt = require('jsonwebtoken');

/**
 * Optional authentication middleware.
 * If a valid Bearer token is present, populates req.user = { id, email }.
 * If no token or an invalid token is provided, req.user remains null and the
 * request continues without error.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

module.exports = optionalAuth;
