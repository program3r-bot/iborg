'use strict';

module.exports = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'iborg',
    password: process.env.DB_PASSWORD || 'changeme',
    name: process.env.DB_NAME || 'iborg_dating',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-must-change-in-production-32',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    smtpHost: process.env.SMTP_HOST || 'smtp.example.com',
    smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  cookie: {
    secret: process.env.COOKIE_SECRET || 'dev-cookie-secret-must-change',
  },
};
