-- T-Video Media Demo - D1 Database Schema
-- Educational demo for scam-awareness research

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  balance REAL DEFAULT 0,
  total_earnings REAL DEFAULT 0,
  today_earnings REAL DEFAULT 0,
  today_date TEXT DEFAULT '',
  completed_tasks INTEGER DEFAULT 0,
  vip_level INTEGER DEFAULT 0,
  invite_code TEXT NOT NULL UNIQUE,
  invited_by INTEGER DEFAULT NULL,
  is_admin INTEGER DEFAULT 0,
  is_frozen INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vip_tiers (
  level INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  daily_tasks INTEGER NOT NULL,
  daily_income REAL NOT NULL,
  monthly_income REAL NOT NULL,
  featured INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks_completed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  task_id TEXT NOT NULL,
  date TEXT NOT NULL,
  reward REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, task_id, date)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'Completed',
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  address TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tag TEXT DEFAULT 'System',
  target_user_id INTEGER DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (target_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'Other',
  message TEXT NOT NULL,
  status TEXT DEFAULT 'Open',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id INTEGER NOT NULL,
  invitee_id INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (inviter_id) REFERENCES users(id),
  FOREIGN KEY (invitee_id) REFERENCES users(id)
);

-- Seed VIP tiers
INSERT INTO vip_tiers (level, name, price, daily_tasks, daily_income, monthly_income, featured) VALUES
  (0, 'VIP 0 (Free)', 0, 3, 1.50, 45, 0),
  (1, 'VIP 1', 30, 6, 4.00, 120, 0),
  (2, 'VIP 2', 100, 10, 12.00, 360, 0),
  (3, 'VIP 3', 300, 15, 35.00, 1050, 1),
  (4, 'VIP 4', 800, 25, 95.00, 2850, 0),
  (5, 'VIP 5', 2000, 40, 280.00, 8400, 0);

-- Seed default messages
INSERT INTO messages (title, body, tag) VALUES
  ('Welcome to T-Video Media Demo', 'This is an educational demo platform for scam-awareness research. All balances and rewards are fictional.', 'System'),
  ('VIP Upgrade Promotion', 'Upgrade to VIP 3 today and unlock 15 daily tasks with $35/day earnings! (Educational demo - not real)', 'Promo'),
  ('New Feature: Team Dashboard', 'Check out the new team page to see your referral network stats. (Demo feature)', 'System'),
  ('Limited Time Offer', 'Double rewards for the next 24 hours! Upgrade now! (This is a fake urgency tactic - educational demo)', 'Alert'),
  ('Referral Bonus Active', 'Invite friends and earn up to 10% commission on their task rewards. (Demo only)', 'Invite');
