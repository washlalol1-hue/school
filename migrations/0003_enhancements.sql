-- Migration 0003: Enhancements - new columns and tables

ALTER TABLE users ADD COLUMN last_login_at TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN last_login_date TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN vip_expires_at TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN username_changed_at TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  attempt_time TEXT DEFAULT (datetime('now')),
  success INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);

CREATE TABLE IF NOT EXISTS support_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  user_id INTEGER,
  is_admin INTEGER DEFAULT 0,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
