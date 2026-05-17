// Wallet routes: withdraw, list withdrawals, recharge
import { authMiddleware } from '../auth.js';
import { updateBalance, addTransaction, getUser } from '../db.js';

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
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

async function withdraw(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { amount, address } = body;
  if (!amount || amount <= 0) {
    return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400 });
  }
  if (!address) {
    return new Response(JSON.stringify({ error: 'Address is required' }), { status: 400 });
  }
  if (amount > user.balance) {
    return new Response(JSON.stringify({ error: 'Insufficient balance' }), { status: 400 });
  }

  // Atomic balance deduction: only succeeds if balance is sufficient
  const deductResult = await env.DB.prepare(
    'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?'
  ).bind(amount, user.id, amount).run();

  if (!deductResult.meta.changes) {
    return new Response(JSON.stringify({ error: 'Insufficient balance' }), { status: 400 });
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const results = await env.DB.prepare(
    'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user.id).all();

  const withdrawals = results.results.map(w => ({
    id: w.id,
    amount: w.amount,
    address: w.address,
    status: w.status,
    date: w.created_at,
  }));

  return new Response(JSON.stringify({ withdrawals }));
}

async function recharge(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { amount } = body;
  if (!amount || amount <= 0) {
    return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400 });
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
