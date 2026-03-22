'use strict';

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10),
  queueLimit: 0,
  // MySQL 8.0: use timezone UTC to avoid ambiguous timestamp issues
  timezone: '+00:00',
  // mysql2 handles caching_sha2_password (MySQL 8.0 default auth plugin) automatically
  authPlugins: undefined,
});

/**
 * Verify the database is reachable and return basic server info.
 * @returns {Promise<{version: string, now: string}>}
 */
async function ping() {
  const [rows] = await pool.query('SELECT VERSION() AS version, NOW() AS now');
  return rows[0];
}

module.exports = { pool, ping };
