'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

async function migrate() {
  // Connect without database selected first to support CREATE DATABASE
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  const sqlFile = path.join(__dirname, 'migrations', '001_initial.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('Running migration: 001_initial.sql');
  await connection.query(sql);
  console.log('Migration complete.');
  await connection.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
