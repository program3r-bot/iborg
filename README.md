# iborg — Consenting-Adults Dating App

A Node.js / Express web application backed by MySQL 8.0.  
**Adults (18+) only.** All registration requests are age-gated.

---

## Features

| Feature | Details |
|---------|---------|
| Registration & Login | Email/password with email-verification flow |
| Age gate | Date-of-birth validation (18+) enforced at registration |
| Profile search | Filter by gender, location, age range |
| Free chat | Private conversations between members |
| Anti-spam | Rate limiting on all endpoints (stricter on auth + messaging) |
| Transactional email | Verification and password-reset emails via SMTP |
| Health check | `GET /health` — verifies DB connectivity |

---

## Quick Start (local development)

### Prerequisites

- Node.js ≥ 18
- MySQL 8.0

### 1 — Clone & install

```bash
git clone https://github.com/program3r-bot/iborg.git
cd iborg
npm install
```

### 2 — Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your local MySQL and SMTP credentials
```

### 3 — Import the database schema

```bash
mysql -u <user> -p <database> < db/schema.sql
```

### 4 — Start the server

```bash
npm start          # production
npm run dev        # development (auto-restarts on file changes)
```

The API is available at `http://localhost:3000` (or the `PORT` you set).

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | DB connectivity check |
| POST | `/auth/register` | — | Register (18+ enforced) |
| GET | `/auth/verify-email?token=` | — | Verify email address |
| POST | `/auth/login` | — | Obtain JWT |
| POST | `/auth/forgot-password` | — | Request password-reset email |
| POST | `/auth/reset-password` | — | Reset password via token |
| GET | `/profiles` | JWT | Search profiles |
| GET | `/profiles/:id` | JWT | View a profile |
| GET | `/chat/conversations` | JWT | List conversations |
| POST | `/chat/conversations` | JWT | Start conversation |
| GET | `/chat/conversations/:id/messages` | JWT | Read messages |
| POST | `/chat/conversations/:id/messages` | JWT | Send message |

Pass the JWT in the `Authorization: Bearer <token>` header.

---

## Environment Variables

All configuration is via environment variables. **Never commit real values.**  
Copy `.env.example` to `.env` and fill in your values.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the HTTP server listens on |
| `NODE_ENV` | `development` | `production` \| `development` |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | — | MySQL username |
| `DB_PASSWORD` | — | MySQL password |
| `DB_NAME` | — | MySQL database name |
| `DB_POOL_MAX` | `10` | Max DB pool connections |
| `JWT_SECRET` | — | Long random secret for signing JWTs |
| `JWT_EXPIRES_IN` | `7d` | JWT lifetime |
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | `465` | SMTP port |
| `SMTP_SECURE` | `true` | `true` for port 465 (TLS) |
| `SMTP_USER` | — | SMTP username / email address |
| `SMTP_PASSWORD` | — | SMTP password |
| `SMTP_FROM` | — | "From" display name + address |
| `APP_URL` | `http://localhost:3000` | Public URL (used in email links) |

---

## Deploying on FreeHostia

> FreeHostia offers shared PHP/MySQL hosting. Node.js processes cannot run as
> persistent daemons on free-tier accounts. The instructions below apply to
> accounts that support Node.js (e.g. via the "Paste" plan or a VPS add-on).
> For shared hosting, consider exporting only the MySQL schema and connecting a
> separately-hosted Node.js app (e.g. on Railway, Render, or Fly.io) to the
> FreeHostia MySQL instance.

### Environment Variables in the FreeHostia Control Panel

In the control panel at **cp.freehostia.com** → **Environment** (or your
hosting plan's equivalent), create the following variables:

```
NODE_ENV=production
PORT=3000                          # or whatever port your plan assigns
APP_URL=https://yourdomain.com

DB_HOST=localhost                  # see note below
DB_PORT=3306
DB_USER=<your_db_user>             # set in cp.freehostia.com
DB_PASSWORD=<your_db_password>     # set in cp.freehostia.com — do not commit
DB_NAME=<your_database_name>       # set in cp.freehostia.com

JWT_SECRET=<long_random_string>    # generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_EXPIRES_IN=7d

SMTP_HOST=mbox.freehostia.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=admin@yourdomain.com     # replace with your email
SMTP_PASSWORD=<your_smtp_password> # set in cp.freehostia.com — do not commit
SMTP_FROM="iborg <admin@yourdomain.com>"
```

> **Important — never paste real passwords into code, documentation, or PR
> descriptions. Set them only through the hosting-panel's secure environment
> variable UI.**

### DB Host: `localhost` vs explicit hostname

FreeHostia documentation states the MySQL host is `localhost` from within the
same server. If you are connecting from an **external** host (e.g. a separate
Node.js deployment on another platform), you will need the external MySQL
hostname. To find it:

1. Log in to **cp.freehostia.com**.
2. Go to **MySQL Databases**.
3. The "Server" field shows the hostname accessible from outside — it is often
   something like `mysql**.freehostia.com`.
4. Set `DB_HOST` to that value in your remote environment.

When running the Node.js app **on the same FreeHostia server**, use
`DB_HOST=localhost`.

To verify connectivity after deployment, call:

```
GET https://yourdomain.com/health
```

A 200 response with `"db": { "status": "ok" }` confirms the database is
reachable.

### Importing the Database Schema

1. In the FreeHostia control panel, create a MySQL 8.0 database and user.
2. Import the schema via phpMyAdmin (available in the control panel) or via
   the MySQL CLI:

   ```bash
   mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < db/schema.sql
   ```

### SMTP Configuration

FreeHostia provides SMTP at `mbox.freehostia.com:465` (TLS/SSL).

- Set `SMTP_HOST=mbox.freehostia.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`.
- `SMTP_USER` is your full email address (e.g. `admin@yourdomain.com`).
- `SMTP_PASSWORD` is your email account password — **set only via the
  environment variable panel, never in code or docs**.

### FTP Deployment

The project includes a built-in FTPS deploy script (`scripts/ftp-deploy.js`)
that uploads all app files to FreeHostia — excluding `.env`, `node_modules/`,
and `.git` — using credentials from environment variables.

#### 1 — Set FTP env vars

Add to your `.env` (or CI/CD secrets):

```
FTP_HOST=ftps5.us.freehostia.com
FTP_PORT=21
FTP_USER=your_ftp_username
FTP_PASSWORD=your_ftp_password
FTP_REMOTE_DIR=/public_html
```

> **Never commit FTP credentials.** `.env` is in `.gitignore`.

#### 2 — Run the deploy script

```bash
npm run deploy
```

The script will:

1. Connect to the FTPS server (explicit TLS on port 21).
2. Mirror the local directory tree to `FTP_REMOTE_DIR`, creating any missing
   remote folders automatically.
3. Print each file as it is uploaded. Passwords are never written to the log.

#### 3 — Install dependencies on the server

After uploading, open an SSH/terminal session on your hosting account and run:

```bash
cd /path/to/your/app
npm install --omit=dev
```

#### FTP connection details (FreeHostia)

| Setting | Value |
|---------|-------|
| Host | `ftps5.us.freehostia.com` |
| Port | `21` (explicit FTPS / STARTTLS) |
| Protocol | FTPS (not SFTP) |
| Remote dir | Typically `/public_html` — check your control panel |

---

## Security Notes

- `.env` is listed in `.gitignore` and will never be committed.
- Passwords are hashed with bcrypt (12 rounds).
- JWTs are signed with `HS256`; rotate `JWT_SECRET` periodically.
- All endpoints use `helmet` security headers and express-rate-limit.
- SMTP credentials are never logged.
- Stack traces are never sent to clients.
