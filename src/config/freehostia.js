'use strict';

/**
 * FreeHostia (cp.freehostia.com) Stub Adapter
 * ============================================================
 * This file centralises every setting that differs when the app
 * is deployed to a FreeHostia free-hosting account.
 *
 * HOW TO USE
 * ----------
 * 1. Log in to your FreeHostia control panel at cp.freehostia.com.
 * 2. Navigate to "MySQL Databases" and note down:
 *      - Database host (usually a shared hostname like mysql*.freehostia.com)
 *      - Database name  (prefixed with your account name, e.g. acct_dbname)
 *      - Database user  (prefixed with your account name, e.g. acct_user)
 *      - Database password
 * 3. Copy .env.example -> .env and set:
 *      FREEHOSTIA_MODE=true
 *      DB_HOST=<host from step 2>
 *      DB_USER=<user from step 2>
 *      DB_PASSWORD=<password from step 2>
 *      DB_NAME=<name from step 2>
 *      FREEHOSTIA_DOMAIN=your-site.freehostia.com
 * 4. Fill in the TODO sections below if your plan requires further tweaks.
 *
 * NOTE: FreeHostia's free tier runs PHP/CGI apps natively; Node.js must be
 * started via CGI wrapper or a startup script.  Consult FreeHostia support
 * for the exact mechanism available on your plan.
 * ============================================================
 */

const isEnabled = process.env.FREEHOSTIA_MODE === 'true';

const config = {
  /** True when the app is running inside a FreeHostia environment */
  isEnabled,

  /** The public domain assigned in the FreeHostia control panel */
  domain: process.env.FREEHOSTIA_DOMAIN || '',

  /**
   * TODO: FreeHostia MySQL connection method
   * ----------------------------------------
   * FreeHostia's shared hosting sometimes exposes MySQL only via a Unix
   * socket path rather than a TCP host/port.
   * If that is the case on your plan, set this to the socket path shown
   * in cp.freehostia.com > MySQL Databases, e.g.:
   *   '/var/run/mysqld/mysqld.sock'
   * Leave as null to use the TCP host/port from DB_HOST / DB_PORT instead.
   */
  dbSocketPath: null, // TODO: set to socket path if required by FreeHostia

  /**
   * TODO: Static file serving
   * -------------------------
   * FreeHostia may already serve files from a public_html directory.
   * If so, point your FreeHostia document root to src/public/ or copy
   * index.html there after build.
   */

  /**
   * TODO: Environment variable injection
   * -------------------------------------
   * FreeHostia's control panel may not support .env files directly.
   * Options:
   *  a) Hard-code values here (for private repos only – never commit secrets).
   *  b) Use cp.freehostia.com > "Environment Variables" if your plan supports it.
   *  c) Inject them via a startup/wrapper script before launching Node.js.
   */

  /**
   * TODO: Port configuration
   * -------------------------
   * FreeHostia assigns a specific port for your Node.js process.
   * Check cp.freehostia.com > "Node.js" (or equivalent) for the assigned port
   * and set PORT in your .env accordingly.
   */
};

module.exports = config;
