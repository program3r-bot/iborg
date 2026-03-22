# iborg – Matchmaking Web App

A lightweight Node.js/Express + MySQL 8.0 matchmaking / dating web app with email-based auth, profile search, free chat, anti-spam, and ready to deploy on [cp.freehostia.com](https://cp.freehostia.com).

---

## Features

| Feature | Details |
|---|---|
| Authentication | Email + password (JWT, bcrypt) |
| Profile search | Filter by username, location, gender – **any age** |
| Free chat | Polling-based direct messages between users |
| Anti-spam | Multi-tier rate limiting (global / auth / chat) |
| Moderation | Block and report users |
| Hosting | Configured for [FreeHostia](https://cp.freehostia.com) (MySQL shared hosting) |

---

## Tech Stack

- **Runtime**: Node.js (≥ 18)
- **Framework**: Express 4
- **Database**: MySQL 8.0
- **Auth**: JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)
- **Rate limiting**: `express-rate-limit`
- **UI**: Vanilla HTML/CSS/JS (single-page, no build step)

---

## Quick Start (local development)

### 1. Prerequisites

- Node.js ≥ 18
- MySQL 8.0 server running locally

### 2. Clone & install

```bash
git clone https://github.com/program3r-bot/iborg.git
cd iborg
npm install
```

### 3. Create the database

```bash
mysql -u root -p < src/db/schema.sql
```

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env with your local MySQL credentials and a strong JWT_SECRET
```

Minimum `.env` for local dev:

```
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=iborg
JWT_SECRET=replace_with_a_64_char_random_hex_string
JWT_EXPIRES_IN=7d
FREEHOSTIA_MODE=false
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5. Start the server

```bash
npm start        # production
npm run dev      # auto-reload with nodemon
```

Open `http://localhost:3000` in your browser.

---

## API Reference

All endpoints return JSON.  Auth-protected routes require:

```
Authorization: Bearer <token>
```

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password}` | Register (returns JWT + user) |
| POST | `/api/auth/login` | `{email, password}` | Login (returns JWT + user) |

### Profiles

| Method | Path | Query / Body | Auth? | Description |
|---|---|---|---|---|
| GET | `/api/profiles/search` | `?username=&location=&gender=&page=&limit=` | Optional | Search profiles |
| GET | `/api/profiles/me` | – | **Yes** | Get own profile |
| GET | `/api/profiles/:id` | – | No | Get profile by id |
| PUT | `/api/profiles/me` | `{username,age,gender,bio,location,photo_url}` | **Yes** | Update own profile |

### Chat

| Method | Path | Description | Auth? |
|---|---|---|---|
| GET | `/api/chat/conversations` | List conversations | **Yes** |
| GET | `/api/chat/messages/:userId` | Get messages with a user (`?page=&limit=`) | **Yes** |
| POST | `/api/chat/messages/:userId` | Send a message `{content}` | **Yes** |

### Moderation

| Method | Path | Body | Auth? |
|---|---|---|---|
| POST | `/api/moderation/block` | `{userId}` | **Yes** |
| DELETE | `/api/moderation/block/:userId` | – | **Yes** |
| POST | `/api/moderation/report` | `{userId, reason, details?}` | **Yes** |

### Rate Limits

| Scope | Limit |
|---|---|
| Global API | 100 requests / 15 min |
| Auth routes | 10 requests / 15 min |
| Chat send | 30 requests / min |

---

## Deploying to FreeHostia (cp.freehostia.com)

FreeHostia provides free shared hosting with MySQL.  The `src/config/freehostia.js` stub adapter documents every setting that may need changing for a FreeHostia environment.

### Steps

1. **Create a FreeHostia account** at <https://www.freehostia.com> and log in to the control panel at <https://cp.freehostia.com>.

2. **Create a MySQL database**
   Go to *Control Panel → MySQL Databases*.
   Note down: host, database name, username, password.

3. **Import the schema**
   Use the FreeHostia phpMyAdmin link to import `src/db/schema.sql`.

4. **Upload app files**
   FreeHostia's free tier primarily supports PHP/CGI.  For Node.js:
   - Check *Control Panel → Node.js* for an assigned port.
   - Upload all files (excluding `node_modules/` and `.env`).
   - Run `npm install --production` on the server.

5. **Set environment variables**
   Create a `.env` file on the server (or use the control panel's environment variable section if available):

   ```
   PORT=<assigned port>
   NODE_ENV=production
   DB_HOST=<mysql host from FreeHostia>
   DB_PORT=3306
   DB_USER=<db user>
   DB_PASSWORD=<db password>
   DB_NAME=<db name>
   JWT_SECRET=<strong random secret>
   JWT_EXPIRES_IN=7d
   FREEHOSTIA_MODE=true
   FREEHOSTIA_DOMAIN=your-site.freehostia.com
   ```

6. **Socket path (if needed)**
   If FreeHostia exposes MySQL via a Unix socket instead of TCP, set `dbSocketPath` in `src/config/freehostia.js` – see the `TODO` comment inside that file.

7. **Start the server**
   ```bash
   npm start
   ```

> **Note**: The exact Node.js startup mechanism on FreeHostia depends on your hosting plan. Consult [FreeHostia support](https://www.freehostia.com/support/) for the method available on your account.

---

## Project Structure

```
iborg/
├── src/
│   ├── app.js                   # Express entry point
│   ├── config/
│   │   ├── database.js          # MySQL connection pool
│   │   └── freehostia.js        # cp.freehostia.com stub adapter (TODOs)
│   ├── db/
│   │   └── schema.sql           # MySQL 8.0 schema
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   └── rateLimit.js         # Anti-spam rate limiters
│   ├── routes/
│   │   ├── auth.js              # Register / login
│   │   ├── profiles.js          # Search / view / update profiles
│   │   ├── chat.js              # Conversations / messages
│   │   └── moderation.js        # Block / report
│   └── public/
│       └── index.html           # Single-page web UI
├── .env.example                 # Environment variable template
├── package.json
└── README.md
```

---

## Security Notes

- Passwords are hashed with bcrypt (cost factor 12).
- JWTs are signed with `HS256`; rotate `JWT_SECRET` if compromised.
- All SQL queries use parameterized placeholders (no string interpolation).
- The UI escapes HTML before rendering to prevent XSS.
- Rate limiting mitigates brute-force and spam attacks.
- **Never commit your `.env` file** – it is listed in `.gitignore`.

---

## Questions for cp.freehostia.com Deployment

The following are open questions that need FreeHostia account-specific answers before deploying:

1. **MySQL connection method**: Does your FreeHostia plan expose MySQL via TCP hostname or Unix socket? (Update `src/config/freehostia.js` → `dbSocketPath` accordingly.)
2. **Node.js support**: Which Node.js version and startup mechanism does your FreeHostia plan provide?
3. **Assigned port**: What port does FreeHostia assign for your Node.js process? (Set `PORT` in `.env`.)
4. **Environment variables**: Does the control panel support setting env vars, or must they be in a `.env` file?

Please answer these in the PR so the final configuration can be applied.

---

## License

MIT
