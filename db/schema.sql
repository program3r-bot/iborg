-- iborg database schema
-- MySQL 8.0
-- Run once to initialise the database.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ─────────────────────────────────────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  email          VARCHAR(255)   NOT NULL,
  password_hash  VARCHAR(255)   NOT NULL,
  name           VARCHAR(100)   NOT NULL,
  -- date_of_birth is required for the 18+ age gate
  date_of_birth  DATE           NOT NULL,
  gender         VARCHAR(50)    DEFAULT NULL,
  location       VARCHAR(255)   DEFAULT NULL,
  email_verified TINYINT(1)     NOT NULL DEFAULT 0,
  verify_token   VARCHAR(36)    DEFAULT NULL,
  verify_expiry  DATETIME       DEFAULT NULL,
  reset_token    VARCHAR(36)    DEFAULT NULL,
  reset_expiry   DATETIME       DEFAULT NULL,
  created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_verify_token (verify_token),
  KEY idx_users_reset_token  (reset_token),
  KEY idx_users_dob          (date_of_birth)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Conversations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Conversation participants (two users per conversation)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id INT UNSIGNED NOT NULL,
  user_id         INT UNSIGNED NOT NULL,

  PRIMARY KEY (conversation_id, user_id),
  KEY idx_cp_user_id (user_id),
  CONSTRAINT fk_cp_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user         FOREIGN KEY (user_id)         REFERENCES users (id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Messages
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id INT UNSIGNED NOT NULL,
  sender_id       INT UNSIGNED NOT NULL,
  body            TEXT         NOT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_msg_conv (conversation_id),
  KEY idx_msg_sender (sender_id),
  CONSTRAINT fk_msg_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender       FOREIGN KEY (sender_id)       REFERENCES users (id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
