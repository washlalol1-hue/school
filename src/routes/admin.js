// Admin routes: stats, users, freeze, approve/reject withdrawals, broadcast, support management
import { authMiddleware } from '../auth.js';
import { isValidLength, errorResponse, sanitizeInput } from '../utils.js';

export async function handleAdmin(request, env, path) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }
  if (!user.is_admin) {
    return new Response(JSON.stringify({ error: 'Forbidden', code: 'FORBIDDEN' }), { status: 403 });
  }

  if (path === '/api/admin/stats' && request.method === 'GET') {
    return stats(env);
  }
  if (path === '/api/admin/users' && request.method === 'GET') {
    return listUsers(request, env);
  }
  const freezeMatch = path.match(/^\/api\/admin\/users\/(\d+)\/freeze$/);
  if (freezeMatch && request.method === 'POST') {
    return freezeUser(env, parseInt(freezeMatch[1]));
  }
  const unfreezeMatch = path.match(/^\/api\/admin\/users\/(\d+)\/unfreeze$/);
  if (unfreezeMatch && request.method === 'POST') {
    return unfreezeUser(env, parseInt(unfreezeMatch[1]));
  }
  const approveMatch = path.match(/^\/api\/admin\/withdrawals\/(\d+)\/approve$/);
  if (approveMatch && request.method === 'POST') {
    return approveWithdrawal(env, parseInt(approveMatch[1]));
  }
  const rejectMatch = path.match(/^\/api\/admin\/withdrawals\/(\d+)\/reject$/);
  if (rejectMatch && request.method === 'POST') {
    return rejectWithdrawal(env, parseInt(rejectMatch[1]));
  }

  // Support routes (more specific first)
  const supportTicketReplyMatch = path.match(/^\/api\/admin\/support\/(\d+)\/reply$/);
  if (supportTicketReplyMatch && request.method === 'POST') {
    return adminReplyToTicket(request, env, user, parseInt(supportTicketReplyMatch[1]));
  }
  const supportTicketMatch = path.match(/^\/api\/admin\/support\/(\d+)$/);
  if (supportTicketMatch && request.method === 'GET') {
    return getAdminTicketDetail(env, parseInt(supportTicketMatch[1]));
  }
  if (path === '/api/admin/support' && request.method === 'GET') {
    return listAdminSupport(request, env);
  }

  if (path === '/api/admin/messages' && request.method === 'POST') {
    return broadcast(request, env);
  }

  // User detail/delete (general pattern last)
  const userIdMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
  if (userIdMatch && request.method === 'GET') {
    return getUserDetail(env, parseInt(userIdMatch[1]));
  }
  if (userIdMatch && request.method === 'DELETE') {
    return deleteUser(env, parseInt(userIdMatch[1]));
  }

  return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
}

async function stats(env) {
  const totalUsers = await env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first();
  const totalDeposits = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'Recharge'"
  ).first();
  const totalWithdrawals = await env.DB.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM withdrawals'
  ).first();
  const pendingWd = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM withdrawals WHERE status = 'Pending'"
  ).first();

  // VIP distribution
  const vipDist = [];
  for (let i = 0; i <= 5; i++) {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM users WHERE vip_level = ?'
    ).bind(i).first();
    vipDist.push({ level: `VIP ${i}`, pct: totalUsers.cnt > 0 ? Math.round((row.cnt / totalUsers.cnt) * 100) : 0 });
  }

  // Weekly tasks (last 7 days)
  const weeklyTasks = [];
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const row = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM tasks_completed WHERE date = ?'
    ).bind(dateStr).first();
    weeklyTasks.push(row.cnt || 0);
  }

  // Pending review items
  const pendingReview = await env.DB.prepare(
    `SELECT w.id, w.amount, w.address, w.created_at, u.username
     FROM withdrawals w JOIN users u ON u.id = w.user_id
     WHERE w.status = 'Pending' ORDER BY w.created_at DESC LIMIT 20`
  ).all();

  return new Response(JSON.stringify({
    totalUsers: totalUsers.cnt,
    totalDeposits: totalDeposits.total,
    totalWithdrawals: totalWithdrawals.total,
    pendingWithdrawals: pendingWd.cnt,
    vipDistribution: vipDist,
    weeklyTasks,
    pendingReview: pendingReview.results.map(r => ({
      id: r.id,
      username: r.username,
      amount: r.amount,
      address: r.address,
      date: r.created_at ? r.created_at.split('T')[0] : r.created_at,
    })),
  }));
}

async function listUsers(request, env) {
  const url = new URL(request.url);
  let page = parseInt(url.searchParams.get('page')) || 1;
  let limit = parseInt(url.searchParams.get('limit')) || 50;
  const search = url.searchParams.get('search') || '';

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;
  const offset = (page - 1) * limit;

  let countQuery;
  let dataQuery;

  if (search) {
    const pattern = `%${search}%`;
    countQuery = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM users WHERE username LIKE ?'
    ).bind(pattern).first();
    dataQuery = await env.DB.prepare(
      'SELECT id, username, vip_level, balance, is_frozen, created_at FROM users WHERE username LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?'
    ).bind(pattern, limit, offset).all();
  } else {
    countQuery = await env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first();
    dataQuery = await env.DB.prepare(
      'SELECT id, username, vip_level, balance, is_frozen, created_at FROM users ORDER BY id DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();
  }

  const users = dataQuery.results.map(u => ({
    id: u.id,
    username: u.username,
    vip: u.vip_level,
    balance: u.balance,
    status: u.is_frozen ? 'Suspended' : 'Active',
  }));

  return new Response(JSON.stringify({ users, total: countQuery.cnt, page, limit }));
}

async function freezeUser(env, userId) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found', code: 'NOT_FOUND' }), { status: 404 });
  }
  const newState = user.is_frozen ? 0 : 1;
  await env.DB.prepare('UPDATE users SET is_frozen = ? WHERE id = ?').bind(newState, userId).run();
  return new Response(JSON.stringify({ ok: true, frozen: newState === 1 }));
}

async function unfreezeUser(env, userId) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found', code: 'NOT_FOUND' }), { status: 404 });
  }
  await env.DB.prepare('UPDATE users SET is_frozen = 0 WHERE id = ?').bind(userId).run();
  return new Response(JSON.stringify({ ok: true, frozen: false }));
}

async function deleteUser(env, userId) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found', code: 'NOT_FOUND' }), { status: 404 });
  }
  // Delete all associated data atomically using batch
  await env.DB.batch([
    env.DB.prepare('DELETE FROM tasks_completed WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM transactions WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM withdrawals WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM support_tickets WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM support_replies WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM referrals WHERE inviter_id = ? OR invitee_id = ?').bind(userId, userId),
    env.DB.prepare('DELETE FROM messages WHERE target_user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM activity_log WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM login_attempts WHERE identifier = ?').bind(user.username),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);
  return new Response(JSON.stringify({ ok: true }));
}

async function getUserDetail(env, userId) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found', code: 'NOT_FOUND' }), { status: 404 });
  }

  const transactions = await env.DB.prepare(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(userId).all();

  const refCount = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM referrals WHERE inviter_id = ? AND level = 1'
  ).bind(userId).first();

  const withdrawals = await env.DB.prepare(
    'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(userId).all();

  return new Response(JSON.stringify({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      balance: user.balance,
      vip_level: user.vip_level,
      total_earnings: user.total_earnings,
      today_earnings: user.today_earnings,
      is_frozen: user.is_frozen,
      is_admin: user.is_admin,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      login_count: user.login_count,
      vip_expires_at: user.vip_expires_at,
      invite_code: user.invite_code
    },
    transactions: transactions.results,
    referralCount: refCount ? refCount.cnt : 0,
    withdrawals: withdrawals.results
  }));
}

async function listAdminSupport(request, env) {
  const url = new URL(request.url);
  let page = parseInt(url.searchParams.get('page')) || 1;
  let limit = parseInt(url.searchParams.get('limit')) || 20;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;
  const offset = (page - 1) * limit;

  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM support_tickets'
  ).first();

  const results = await env.DB.prepare(
    `SELECT st.*, u.username FROM support_tickets st
     JOIN users u ON u.id = st.user_id
     ORDER BY st.created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return new Response(JSON.stringify({
    tickets: results.results,
    total: countResult.cnt,
    page,
    limit
  }));
}

async function getAdminTicketDetail(env, ticketId) {
  const ticket = await env.DB.prepare(
    'SELECT * FROM support_tickets WHERE id = ?'
  ).bind(ticketId).first();

  if (!ticket) {
    return new Response(JSON.stringify({ error: 'Ticket not found', code: 'NOT_FOUND' }), { status: 404 });
  }

  const replies = await env.DB.prepare(
    `SELECT sr.*, u.username FROM support_replies sr
     LEFT JOIN users u ON u.id = sr.user_id
     WHERE sr.ticket_id = ? ORDER BY sr.created_at ASC`
  ).bind(ticketId).all();

  return new Response(JSON.stringify({
    ticket,
    replies: replies.results
  }));
}

async function adminReplyToTicket(request, env, adminUser, ticketId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), { status: 400 });
  }

  const { message } = body;
  if (!message) {
    return errorResponse('Message is required', 'INVALID_INPUT');
  }
  if (!isValidLength(message, 1, 2000)) {
    return errorResponse('Message must be between 1 and 2000 characters', 'INVALID_INPUT');
  }

  const ticket = await env.DB.prepare(
    'SELECT * FROM support_tickets WHERE id = ?'
  ).bind(ticketId).first();

  if (!ticket) {
    return new Response(JSON.stringify({ error: 'Ticket not found', code: 'NOT_FOUND' }), { status: 404 });
  }

  const cleanMessage = sanitizeInput(message);

  await env.DB.prepare(
    'INSERT INTO support_replies (ticket_id, user_id, is_admin, message) VALUES (?, ?, 1, ?)'
  ).bind(ticketId, adminUser.id, cleanMessage).run();

  await env.DB.prepare(
    "UPDATE support_tickets SET status = 'In Progress' WHERE id = ?"
  ).bind(ticketId).run();

  return new Response(JSON.stringify({ ok: true }));
}

async function approveWithdrawal(env, withdrawalId) {
  const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(withdrawalId).first();
  if (!wd) {
    return new Response(JSON.stringify({ error: 'Withdrawal not found' }), { status: 404 });
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE withdrawals SET status = 'Completed' WHERE id = ?").bind(withdrawalId),
    env.DB.prepare(
      "UPDATE transactions SET status = 'Completed' WHERE user_id = ? AND type = 'Withdraw' AND status = 'Pending' AND description = ?"
    ).bind(wd.user_id, `Withdrawal #${withdrawalId} to ${wd.address}`),
  ]);
  return new Response(JSON.stringify({ ok: true }));
}

async function rejectWithdrawal(env, withdrawalId) {
  const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(withdrawalId).first();
  if (!wd) {
    return new Response(JSON.stringify({ error: 'Withdrawal not found' }), { status: 404 });
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE withdrawals SET status = 'Rejected' WHERE id = ?").bind(withdrawalId),
    env.DB.prepare(
      "UPDATE transactions SET status = 'Rejected' WHERE user_id = ? AND type = 'Withdraw' AND status = 'Pending' AND description = ?"
    ).bind(wd.user_id, `Withdrawal #${withdrawalId} to ${wd.address}`),
    env.DB.prepare(
      'UPDATE users SET balance = balance + ? WHERE id = ?'
    ).bind(wd.amount, wd.user_id),
  ]);
  return new Response(JSON.stringify({ ok: true }));
}

async function broadcast(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), { status: 400 });
  }

  const { title, body: msgBody, tag } = body;
  if (!title || !msgBody) {
    return new Response(JSON.stringify({ error: 'Title and body are required', code: 'INVALID_INPUT' }), { status: 400 });
  }

  if (!isValidLength(title, 1, 200)) {
    return errorResponse('Title must be between 1 and 200 characters', 'INVALID_INPUT');
  }
  if (!isValidLength(msgBody, 1, 5000)) {
    return errorResponse('Body must be between 1 and 5000 characters', 'INVALID_INPUT');
  }

  const cleanTitle = sanitizeInput(title);
  const cleanBody = sanitizeInput(msgBody);

  await env.DB.prepare(
    'INSERT INTO messages (title, body, tag) VALUES (?, ?, ?)'
  ).bind(cleanTitle, cleanBody, tag || 'System').run();

  return new Response(JSON.stringify({ ok: true }), { status: 201 });
}
