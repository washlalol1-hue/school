// Admin routes: stats, users, freeze, approve/reject withdrawals, broadcast
import { authMiddleware } from '../auth.js';

export async function handleAdmin(request, env, path) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  if (!user.is_admin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
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
  const approveMatch = path.match(/^\/api\/admin\/withdrawals\/(\d+)\/approve$/);
  if (approveMatch && request.method === 'POST') {
    return approveWithdrawal(env, parseInt(approveMatch[1]));
  }
  const rejectMatch = path.match(/^\/api\/admin\/withdrawals\/(\d+)\/reject$/);
  if (rejectMatch && request.method === 'POST') {
    return rejectWithdrawal(env, parseInt(rejectMatch[1]));
  }
  if (path === '/api/admin/messages' && request.method === 'POST') {
    return broadcast(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
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
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
  }
  const newState = user.is_frozen ? 0 : 1;
  await env.DB.prepare('UPDATE users SET is_frozen = ? WHERE id = ?').bind(newState, userId).run();
  return new Response(JSON.stringify({ ok: true, frozen: newState === 1 }));
}

async function approveWithdrawal(env, withdrawalId) {
  const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(withdrawalId).first();
  if (!wd) {
    return new Response(JSON.stringify({ error: 'Withdrawal not found' }), { status: 404 });
  }
  await env.DB.prepare("UPDATE withdrawals SET status = 'Completed' WHERE id = ?").bind(withdrawalId).run();
  await env.DB.prepare(
    "UPDATE transactions SET status = 'Completed' WHERE user_id = ? AND type = 'Withdraw' AND status = 'Pending' AND description = ?"
  ).bind(wd.user_id, `Withdrawal #${withdrawalId} to ${wd.address}`).run();
  return new Response(JSON.stringify({ ok: true }));
}

async function rejectWithdrawal(env, withdrawalId) {
  const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(withdrawalId).first();
  if (!wd) {
    return new Response(JSON.stringify({ error: 'Withdrawal not found' }), { status: 404 });
  }
  await env.DB.prepare("UPDATE withdrawals SET status = 'Rejected' WHERE id = ?").bind(withdrawalId).run();
  await env.DB.prepare(
    "UPDATE transactions SET status = 'Rejected' WHERE user_id = ? AND type = 'Withdraw' AND status = 'Pending' AND description = ?"
  ).bind(wd.user_id, `Withdrawal #${withdrawalId} to ${wd.address}`).run();
  // Refund balance
  await env.DB.prepare(
    'UPDATE users SET balance = balance + ? WHERE id = ?'
  ).bind(wd.amount, wd.user_id).run();
  return new Response(JSON.stringify({ ok: true }));
}

async function broadcast(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { title, body: msgBody, tag } = body;
  if (!title || !msgBody) {
    return new Response(JSON.stringify({ error: 'Title and body are required' }), { status: 400 });
  }

  await env.DB.prepare(
    'INSERT INTO messages (title, body, tag) VALUES (?, ?, ?)'
  ).bind(title, msgBody, tag || 'System').run();

  return new Response(JSON.stringify({ ok: true }), { status: 201 });
}
