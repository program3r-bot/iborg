'use strict';

/**
 * MySQL connection pool
 *
 * Uses mysql2 which supports:
 *   - MySQL 8.x caching_sha2_password authentication
 *   - Connection pooling with automatic reconnection
 *   - Promise-based API
 *
 * All credentials are read exclusively from environment variables.
 * On FreeHostia shared hosting the MySQL server is reachable via TCP/IP
 * at 10.123.0.78 (set DB_HOST accordingly).  Do NOT use "localhost" there
 * unless FreeHostia explicitly confirms it works in your account.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // ── MySQL 8 compatibility ──────────────────────────────────
  // mysql2 uses caching_sha2_password by default, which matches MySQL 8.
  // No extra authPlugin setting required.

  // ── SSL ───────────────────────────────────────────────────
  // FreeHostia does not use SSL for MySQL connections (as confirmed via
  // phpMyAdmin: "SSL is not being used").  Setting ssl to false explicitly
  // prevents the driver from attempting an SSL handshake.
  ssl: false,

  // ── Pool settings ─────────────────────────────────────────
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // Keep idle connections alive (important on shared hosting where the
  // server may close long-idle connections).
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
});

module.exports = pool;
