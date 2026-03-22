# iborg Dating Platform

A consenting-adults-only dating platform built with Node.js, Express, and MySQL 8.0.

---

## Safety First

- **18+ age gate** enforced at registration, profile viewing, search, and messaging.
- **Email verification** required before users can log in or send messages.
- **Block & report** system to protect users.
- **Anti-spam** limits on repeated and URL-heavy messages.
- **Rate limiting** on authentication and search endpoints.
- Parameterized queries everywhere — no SQL injection.
- Passwords hashed with bcrypt (12 rounds).
- JWT Bearer tokens — no CSRF risk for API consumers.
- `helmet` security headers on all responses.

---

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Runtime    | Node.js ≥ 18                            |
| Framework  | Express 4                               |
| Database   | MySQL 8.0 (mysql2 driver)               |
| Auth       | bcrypt + jsonwebtoken                   |
| Validation | express-validator                       |
| Rate limit | express-rate-limit                      |
| Tests      | Jest + supertest                        |

---

## Project Structure

```
src/
├── app.js            # Express app (middleware, routes, error handlers)
├── server.js         # HTTP server entry point
├── config/index.js   # Environment config
├── db/
│   ├── index.js      # mysql2 connection pool + query helper
│   ├── migrate.js    # Migration runner
│   └── migrations/
│       └── 001_initial.sql
├── middleware/
│   ├── auth.js       # JWT authentication middleware
│   ├── rateLimit.js  # Rate limiters
│   └── validate.js   # express-validator error handler
├── routes/
│   ├── index.js      # Mount all routers under /api
│   ├── auth.js       # /api/auth  (register, login, verify-email)
│   ├── profiles.js   # /api/profiles
│   ├── chat.js       # /api/chat
│   └── safety.js     # /api/safety (blocks, reports)
└── utils/
    ├── jwt.js         # signToken / verifyToken
    └── email.js       # Email stub (configure SMTP for production)

tests/
├── setup.js           # In-memory DB mock for tests
├── ageGating.test.js
├── auth.test.js
└── messaging.test.js
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- MySQL 8.0

### 1. Clone and install

```bash
git clone <repo-url>
cd iborg
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your DB credentials, JWT secret, etc.
```

| Variable            | Description                                   |
|---------------------|-----------------------------------------------|
| `DB_HOST`           | MySQL host (default: localhost)               |
| `DB_PORT`           | MySQL port (default: 3306)                    |
| `DB_USER`           | MySQL username                                |
| `DB_PASSWORD`       | MySQL password                                |
| `DB_NAME`           | Database name (default: iborg_dating)         |
| `JWT_SECRET`        | >=32-char secret for signing JWTs             |
| `JWT_EXPIRES_IN`    | Token lifetime (default: 7d)                  |
| `PORT`              | Server port (default: 3000)                   |
| `NODE_ENV`          | development or production                     |
| `EMAIL_FROM`        | Sender address for verification emails        |
| `SMTP_HOST`         | SMTP server host                              |
| `SMTP_PORT`         | SMTP server port                              |
| `SMTP_USER`         | SMTP credentials                              |
| `SMTP_PASS`         | SMTP credentials                              |
| `CORS_ORIGIN`       | Allowed CORS origin                           |
| `COOKIE_SECRET`     | Secret for cookie signing                     |

### 3. Run database migrations

```bash
npm run migrate
```

### 4. Start the server

```bash
# Production
npm start

# Development (auto-restart on change)
npm run dev
```

---

## API Overview

### Auth  /api/auth

| Method | Path                   | Description                   |
|--------|------------------------|-------------------------------|
| POST   | /register              | Create account (18+ enforced) |
| POST   | /login                 | Login -> JWT token            |
| GET    | /verify-email?token=   | Verify email address          |

### Profiles  /api/profiles  (auth required)

| Method | Path       | Description                                         |
|--------|------------|-----------------------------------------------------|
| GET    | /me        | Get own profile                                     |
| PUT    | /me        | Update display_name / bio / location                |
| GET    | /search    | Search 18+ profiles (query: location, minAge, maxAge)|
| GET    | /:userId   | View a public profile (no raw DOB, no email)        |

### Chat  /api/chat  (auth + verified + 18+ required)

| Method | Path                              | Description                     |
|--------|-----------------------------------|---------------------------------|
| POST   | /conversations                    | Start or get conversation       |
| GET    | /conversations                    | List conversations              |
| POST   | /conversations/:id/messages       | Send message (anti-spam checks) |
| GET    | /conversations/:id/messages       | Get messages (paginated)        |

### Safety  /api/safety  (auth required)

| Method | Path               | Description     |
|--------|--------------------|-----------------|
| POST   | /blocks            | Block a user    |
| DELETE | /blocks/:targetId  | Unblock a user  |
| POST   | /reports           | Report a user   |

---

## Running Tests

```bash
npm test
```

Tests use an in-memory mock database — no MySQL required.

---

## Production Checklist

- [ ] Set strong JWT_SECRET (>=32 random characters)
- [ ] Configure real SMTP in .env and replace stub in src/utils/email.js with nodemailer
- [ ] Use HTTPS (TLS at load balancer or reverse proxy)
- [ ] Set NODE_ENV=production
- [ ] Restrict CORS_ORIGIN to your actual frontend domain
- [ ] Run behind a reverse proxy (nginx/Caddy) with connection rate limiting
