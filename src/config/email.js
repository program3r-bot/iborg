'use strict';

const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false', // true for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Do not log credentials
    logger: false,
    debug: false,
  });
}

const transport = createTransport();

/**
 * Send an email. Credentials are never logged.
 * @param {{to: string, subject: string, html: string}} opts
 */
async function sendMail({ to, subject, html }) {
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

module.exports = { sendMail };
