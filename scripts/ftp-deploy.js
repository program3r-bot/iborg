'use strict';

/**
 * scripts/ftp-deploy.js
 *
 * Deploys the application to FreeHostia (or any FTPS host) using credentials
 * read exclusively from environment variables — no secrets are hard-coded.
 *
 * Usage:
 *   node scripts/ftp-deploy.js
 *   npm run deploy
 *
 * Required env vars (add to .env or set in your CI/CD pipeline):
 *   FTP_HOST        — FTPS hostname (e.g. ftps5.us.freehostia.com)
 *   FTP_USER        — FTP username
 *   FTP_PASSWORD    — FTP password
 *   FTP_REMOTE_DIR  — Remote directory to upload into (default: /)
 *   FTP_PORT        — FTPS port (default: 21)
 */

require('dotenv').config();

const path = require('path');
const fs   = require('fs');
const ftp  = require('basic-ftp');

// ── Configuration ─────────────────────────────────────────────────────────────

const HOST       = process.env.FTP_HOST;
const USER       = process.env.FTP_USER;
const PASSWORD   = process.env.FTP_PASSWORD;
const REMOTE_DIR = process.env.FTP_REMOTE_DIR || '/';
const PORT       = parseInt(process.env.FTP_PORT || '21', 10);
const LOCAL_DIR  = path.resolve(__dirname, '..');

// Files and directories that must never be uploaded
const EXCLUDE = new Set([
  '.env',
  '.git',
  'node_modules',
  '.DS_Store',
  'Thumbs.db',
]);

if (!HOST || !USER || !PASSWORD) {
  console.error(
    '[ftp-deploy] Missing required env vars: FTP_HOST, FTP_USER, FTP_PASSWORD'
  );
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recursively collect all files under `dir`, skipping excluded names.
 * @param {string} dir   Absolute local path
 * @param {string} base  Relative prefix for display
 * @returns {{ local: string, remote: string }[]}
 */
function collectFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result  = [];
  for (const entry of entries) {
    if (EXCLUDE.has(entry.name)) continue;
    const localPath  = path.join(dir, entry.name);
    const remotePath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...collectFiles(localPath, remotePath));
    } else {
      result.push({ local: localPath, remote: remotePath });
    }
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function deploy() {
  const client = new ftp.Client();
  // Log FTP protocol messages but redact passwords
  client.ftp.log = (msg) => {
    const safe = msg.replace(/PASS .+/, 'PASS ***');
    console.log('[ftp]', safe);
  };

  try {
    console.log(`[ftp-deploy] Connecting to ${HOST}:${PORT} as ${USER} …`);
    await client.access({
      host:          HOST,
      port:          PORT,
      user:          USER,
      password:      PASSWORD,
      // Explicit FTPS (STARTTLS on port 21) — required for FreeHostia
      secure:        process.env.FTP_SECURE === 'implicit' ? 'implicit' : true,
      secureOptions: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
    });

    console.log(`[ftp-deploy] Connected. Navigating to remote dir: ${REMOTE_DIR}`);
    await client.ensureDir(REMOTE_DIR);

    const files = collectFiles(LOCAL_DIR);
    console.log(`[ftp-deploy] Uploading ${files.length} files …`);

    for (const { local, remote } of files) {
      const remoteFull = `${REMOTE_DIR.replace(/\/$/, '')}/${remote}`;
      const remoteDir  = remoteFull.substring(0, remoteFull.lastIndexOf('/'));

      // Ensure parent directory exists on the server
      await client.ensureDir(remoteDir);
      await client.cd(REMOTE_DIR); // reset working dir after ensureDir

      process.stdout.write(`  → ${remote}\n`);
      await client.uploadFrom(local, remoteFull);
    }

    console.log('[ftp-deploy] ✓ Upload complete.');
  } catch (err) {
    // Never log the error object directly — it may contain credentials in the
    // connection string or stack trace.
    console.error('[ftp-deploy] Upload failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

deploy();
