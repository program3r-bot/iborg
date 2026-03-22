-- iborg Dating Platform - Initial Schema
-- MySQL 8.0 | utf8mb4

CREATE DATABASE IF NOT EXISTS iborg_dating CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE iborg_dating;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_token CHAR(36),
  verification_token_expires DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  bio TEXT,
  location VARCHAR(200),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_profiles_user_id (user_id),
  INDEX idx_profiles_dob (date_of_birth)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conversations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  participant_a CHAR(36) NOT NULL,
  participant_b CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_a) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_b) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_conversation (participant_a, participant_b),
  INDEX idx_conv_a (participant_a),
  INDEX idx_conv_b (participant_b)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_messages_conv (conversation_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blocks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  blocker_id CHAR(36) NOT NULL,
  blocked_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_block (blocker_id, blocked_id),
  INDEX idx_block_blocker (blocker_id),
  INDEX idx_block_blocked (blocked_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reporter_id CHAR(36) NOT NULL,
  reported_id CHAR(36) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reports_reported (reported_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36),
  action VARCHAR(50) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rl_user_action (user_id, action, created_at),
  INDEX idx_rl_ip_action (ip, action, created_at)
) ENGINE=InnoDB;
