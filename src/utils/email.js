'use strict';

const config = require('../config');

// TODO: Configure SMTP credentials in .env and replace this stub with nodemailer.
// Example: const nodemailer = require('nodemailer'); const transporter = nodemailer.createTransport({ ... })
async function sendVerificationEmail(email, token) {
  const verificationUrl = `${config.cors.origin}/api/auth/verify-email?token=${token}`;
  console.log('[Email stub] Would send verification email.');
  console.log('[Email stub] Verification URL:', verificationUrl);
}

module.exports = { sendVerificationEmail };
