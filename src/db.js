// D1 database helper functions for T-Video Media Demo

export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TVMD-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export async function getUser(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

export async function getUserByUsername(db, username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
}

export async function getUserByInviteCode(db, code) {
  return db.prepare('SELECT * FROM users WHERE invite_code = ?').bind(code).first();
}

export async function createUser(db, { username, email, passwordHash, inviteCode, invitedBy }) {
  const result = await db.prepare(
    'INSERT INTO users (username, email, password_hash, invite_code, invited_by) VALUES (?, ?, ?, ?, ?)'
  ).bind(username, email, passwordHash, inviteCode, invitedBy || null).run();
  return result.meta.last_row_id;
}

export async function updateBalance(db, userId, amount) {
  await db.prepare(
    'UPDATE users SET balance = balance + ? WHERE id = ?'
  ).bind(amount, userId).run();
}

export async function updateTodayEarnings(db, userId, amount, today) {
  const user = await getUser(db, userId);
  if (user.today_date !== today) {
    await db.prepare(
      'UPDATE users SET today_earnings = ?, today_date = ? WHERE id = ?'
    ).bind(amount, today, userId).run();
  } else {
    await db.prepare(
      'UPDATE users SET today_earnings = today_earnings + ? WHERE id = ?'
    ).bind(amount, userId).run();
  }
}

export async function addTransaction(db, { userId, type, amount, status, description }) {
  await db.prepare(
    'INSERT INTO transactions (user_id, type, amount, status, description) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, type, amount, status || 'Completed', description || '').run();
}

export async function getTransactions(db, userId, type) {
  if (type && type !== 'All') {
    return db.prepare(
      'SELECT * FROM transactions WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(userId, type).all().then(r => r.results);
  }
  return db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(userId).all().then(r => r.results);
}

export async function getVipTiers(db) {
  return db.prepare('SELECT * FROM vip_tiers ORDER BY level ASC').all().then(r => r.results);
}

export async function getVipTier(db, level) {
  return db.prepare('SELECT * FROM vip_tiers WHERE level = ?').bind(level).first();
}

export async function getCompletedTasksToday(db, userId, today) {
  return db.prepare(
    'SELECT * FROM tasks_completed WHERE user_id = ? AND date = ?'
  ).bind(userId, today).all().then(r => r.results);
}

export async function completeTask(db, userId, taskId, date, reward) {
  await db.prepare(
    'INSERT INTO tasks_completed (user_id, task_id, date, reward) VALUES (?, ?, ?, ?)'
  ).bind(userId, taskId, date, reward).run();
}

export async function getUserCount(db) {
  const r = await db.prepare('SELECT COUNT(*) as cnt FROM users').first();
  return r.cnt;
}
