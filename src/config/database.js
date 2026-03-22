'use strict';

require('dotenv').config();
const mysql = require('mysql2');
const freehostia = require('./freehostia');

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// When running on FreeHostia, apply any hosting-specific overrides
if (freehostia.isEnabled && freehostia.dbSocketPath) {
  // FreeHostia may expose MySQL via a Unix socket instead of TCP
  delete poolConfig.host;
  delete poolConfig.port;
  poolConfig.socketPath = freehostia.dbSocketPath;
}

const pool = mysql.createPool(poolConfig);

module.exports = pool.promise();
