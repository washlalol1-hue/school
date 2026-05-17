// Wallet routes: withdraw, list withdrawals, recharge
import { authMiddleware } from '../auth.js';
import { updateBalance, addTransaction, getUser } from '../db.js';
import { isValidLength, errorResponse } from '../utils.js';

export async function handleWallet(request, env, path) {
  if (path === '/api/wallet/withdraw' && request.method === 'POST') {
    return withdraw(request, env);
  }
  if (path === '/api/wallet/withdrawals' && request.method === 'GET') {
    return listWithdrawals(request, env);
  }
  if (path === '/api/wallet/recharge' && request.method === 'POST') {
    return recharge(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
}

async function withdraw(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), { status: 400 });
  }

  const { amount, address } = body;
  if (!amount || amount <= 0) {
    return new Response(JSON.stringify({ error: 'Invalid amount', code: 'INVALID_INPUT' }), { status: 400 });
  }
  if (amount < 5) {
    return errorResponse('Minimum withdrawal is $5', 'MIN_WITHDRAWAL');
  }
  if (!address) {
    return new Response(JSON.stringify({ error: 'Address is required', code: 'INVALID_INPUT' }), { status: 400 });
  }
  if (!isValidLength(address, 1, 200)) {
    return errorResponse('Address must be between 1 and 200 characters', 'INVALID_INPUT');
  }
  if (amount > user.balance) {
    return new Response(JSON.stringify({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' }), { status: 400 });
  }

  // Daily withdrawal limit checks
  const dailyStats = await env.DB.prepare(
    "SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total FROM withdrawals WHERE user_id = ? AND created_at > datetime('now', '-1 day')"
  ).bind(user.id).first();

  if (dailyStats.cnt >= 3) {
    return errorResponse('Maximum 3 withdrawals per day', 'DAILY_LIMIT');
  }
  if (dailyStats.total + amount > 5000) {
    return errorResponse('Daily withdrawal limit is $5000', 'DAILY_LIMIT');
  }

  // Atomic balance deduction: only succeeds if balance is sufficient
  const deductResult = await env.DB.prepare(
    'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?'
  ).bind(amount, user.id, amount).run();

  if (!deductResult.meta.changes) {
    return new Response(JSON.stringify({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' }), { status: 400 });
  }

  // Create withdrawal record
  const wdResult = await env.DB.prepare(
    'INSERT INTO withdrawals (user_id, amount, address, status) VALUES (?, ?, ?, ?)'
  ).bind(user.id, amount, address, 'Pending').run();

  const withdrawalId = wdResult.meta.last_row_id;

  // Create transaction with withdrawal_id in description for unambiguous matching
  await addTransaction(env.DB, {
    userId: user.id,
    type: 'Withdraw',
    amount: -amount,
    status: 'Pending',
    description: `Withdrawal #${withdrawalId} to ${address}`,
  });

  const updatedUser = await getUser(env.DB, user.id);
  return new Response(JSON.stringify({ ok: true, balance: updatedUser.balance }));
}

async function listWithdrawals(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  const url = new URL(request.url);
  let page = parseInt(url.searchParams.get('page')) || 1;
  let limit = parseInt(url.searchParams.get('limit')) || 20;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;
  const offset = (page - 1) * limit;

  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM withdrawals WHERE user_id = ?'
  ).bind(user.id).first();

  const results = await env.DB.prepare(
    'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(user.id, limit, offset).all();

  const total = countResult.cnt;
  const withdrawals = results.results.map(w => ({
    id: w.id,
    amount: w.amount,
    address: w.address,
    status: w.status,
    date: w.created_at,
  }));

  return new Response(JSON.stringify({
    withdrawals,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }));
}

async function recharge(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), { status: 400 });
  }

  const { amount } = body;
  if (!amount || amount < 1) {
    return errorResponse('Minimum recharge is $1', 'INVALID_AMOUNT');
  }
  if (amount > 10000) {
    return errorResponse('Maximum recharge is $10000', 'INVALID_AMOUNT');
  }

  // Add to balance
  await updateBalance(env.DB, user.id, amount);

  // Create transaction
  await addTransaction(env.DB, {
    userId: user.id,
    type: 'Recharge',
    amount: amount,
    status: 'Completed',
    description: `Recharge +$${amount}`,
  });

  const updatedUser = await getUser(env.DB, user.id);
  return new Response(JSON.stringify({ ok: true, balance: updatedUser.balance }));
}
