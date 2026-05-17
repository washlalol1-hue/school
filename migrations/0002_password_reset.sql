-- Password reset columns and unique email constraint
-- T-Video Media Demo

ALTER TABLE users ADD COLUMN password_reset_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN password_reset_expires TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
