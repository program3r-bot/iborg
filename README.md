# iborg

Matchmaking web application – Node.js / Express + MySQL 8.

---

## Table of contents

- [Quick start (local)](#quick-start-local)
- [Environment variables](#environment-variables)
- [Deploying on FreeHostia](#deploying-on-freehostia)
- [Project structure](#project-structure)

---

## Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env
# Edit .env with your local MySQL credentials

# 3. Start the server
npm run dev
```

---

## Environment variables

All secrets and host-specific values are stored in a `.env` file that is
**never committed to the repository** (it is listed in `.gitignore`).

Copy `.env.example` to `.env` and fill in every value before starting the app.

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` |
| `PORT` | HTTP port the app listens on | `3000` |
| `DB_HOST` | MySQL server hostname or IP address | `127.0.0.1` |
| `DB_PORT` | MySQL server port | `3306` |
| `DB_NAME` | Database name | *(required)* |
| `DB_USER` | MySQL user | *(required)* |
| `DB_PASSWORD` | MySQL password | *(required)* |
| `SMTP_HOST` | Outgoing mail server | *(required)* |
| `SMTP_PORT` | SMTP port | `465` |
| `SMTP_SECURE` | Use TLS for SMTP (`true`/`false`) | `true` |
| `SMTP_USER` | SMTP username / email address | *(required)* |
| `SMTP_PASS` | SMTP password | *(required)* |
| `MAIL_FROM` | "From" address for outgoing mail | *(required)* |
| `SESSION_SECRET` | Secret used to sign session cookies | *(required)* |

---

## Deploying on FreeHostia

### MySQL connection

FreeHostia hosts MySQL on a **separate internal server**, not on `localhost`.
The actual server address (visible in phpMyAdmin under *Database server →
Server*) is **`10.123.0.78`** (TCP/IP, port 3306).

> **Important:** set `DB_HOST=10.123.0.78` in your FreeHostia environment
> configuration.  Using `localhost` or `127.0.0.1` will cause a connection
> error on FreeHostia shared hosting.

MySQL details confirmed via phpMyAdmin (`pma.us.freehostia.com`):

| Property | Value |
|---|---|
| Server host | `10.123.0.78` (TCP/IP) |
| Port | `3306` |
| MySQL version | `8.0.16` |
| SSL | Not used |
| Server charset | `UTF-8 Unicode (utf8)` |

The app uses the **mysql2** driver, which supports MySQL 8's
`caching_sha2_password` authentication plugin out of the box.  SSL is
explicitly disabled in `src/config/db.js` to match FreeHostia's configuration.

### Recommended `.env` values for FreeHostia

```dotenv
DB_HOST=10.123.0.78
DB_PORT=3306
DB_NAME=<your_freehostia_database_name>
DB_USER=<your_freehostia_db_user>
DB_PASSWORD=<your_rotated_password>

SMTP_HOST=mbox.freehostia.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<your_email@yourdomain.com>
SMTP_PASS=<your_rotated_smtp_password>
MAIL_FROM=<your_email@yourdomain.com>
```

> **Security reminder:** rotate any passwords that were previously exposed
> before deploying.

### Steps

1. Upload project files to FreeHostia via FTPS
   (`ftps5.us.freehostia.com`, port 21).
2. Create a `.env` file in the app root on the server with the values above.
3. Run `npm install --omit=dev` on the server.
4. Start with `npm start` (or configure FreeHostia's Node.js app launcher).

---

## Project structure

```
iborg/
├── src/
│   ├── config/
│   │   └── db.js        # MySQL connection pool (reads from env vars)
│   └── index.js         # Express entry point
├── .env.example         # Template – copy to .env and fill in secrets
├── .gitignore
├── package.json
└── README.md
```
