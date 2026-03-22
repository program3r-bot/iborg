-- ============================================================
-- iborg - MySQL 8.0 Database Schema
-- Run this file once to initialise the database:
--   mysql -u root -p < src/db/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS `iborg`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `iborg`;

-- Users: authentication credentials only
CREATE TABLE IF NOT EXISTS users (
  id           VARCHAR(36)  PRIMARY KEY,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Profiles: public-facing dating profile linked 1-to-1 with a user
CREATE TABLE IF NOT EXISTS profiles (
  id         VARCHAR(36)  PRIMARY KEY,
  user_id    VARCHAR(36)  NOT NULL UNIQUE,
  username   VARCHAR(50)  UNIQUE NOT NULL,
  age        INT,
  gender     VARCHAR(20),
  bio        TEXT,
  location   VARCHAR(100),
  photo_url  VARCHAR(500),
  is_active  TINYINT(1)   DEFAULT 1,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_profiles_username (username),
  INDEX idx_profiles_location (location),
  INDEX idx_profiles_gender   (gender),
  INDEX idx_profiles_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages: direct messages between users (polling-based chat)
CREATE TABLE IF NOT EXISTS messages (
  id           VARCHAR(36) PRIMARY KEY,
  sender_id    VARCHAR(36) NOT NULL,
  recipient_id VARCHAR(36) NOT NULL,
  content      TEXT        NOT NULL,
  is_read      TINYINT(1)  DEFAULT 0,
  created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_messages_sender    (sender_id),
  INDEX idx_messages_recipient (recipient_id),
  INDEX idx_messages_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blocks: user-to-user blocking
CREATE TABLE IF NOT EXISTS blocks (
  id         VARCHAR(36) PRIMARY KEY,
  blocker_id VARCHAR(36) NOT NULL,
  blocked_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_block (blocker_id, blocked_id),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reports: user-to-user reports for moderation
CREATE TABLE IF NOT EXISTS reports (
  id          VARCHAR(36)  PRIMARY KEY,
  reporter_id VARCHAR(36)  NOT NULL,
  reported_id VARCHAR(36)  NOT NULL,
  reason      VARCHAR(255) NOT NULL,
  details     TEXT,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reports_reported (reported_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
