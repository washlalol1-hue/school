// VIP routes: list tiers, buy package
import { authMiddleware } from '../auth.js';
import { getVipTiers, getVipTier, getUser, addTransaction } from '../db.js';

export async function handleVip(request, env, path) {
  if (path === '/api/vip/tiers' && request.method === 'GET') {
    return listTiers(env);
  }
  if (path === '/api/vip/buy' && request.method === 'POST') {
    return buyTier(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
}

async function listTiers(env) {
  const tiers = await getVipTiers(env.DB);
  return new Response(JSON.stringify({ tiers }));
}

async function buyTier(request, env) {
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

  const { level } = body;
  if (level === undefined || level === null) {
    return new Response(JSON.stringify({ error: 'Level is required', code: 'INVALID_INPUT' }), { status: 400 });
  }

  const tier = await getVipTier(env.DB, level);
  if (!tier) {
    return new Response(JSON.stringify({ error: 'Invalid VIP level', code: 'INVALID_INPUT' }), { status: 400 });
  }

  // Prevent downgrading to a lower level
  if (level < user.vip_level) {
    return new Response(JSON.stringify({ error: 'Cannot downgrade VIP level', code: 'INVALID_INPUT' }), { status: 400 });
  }

  // Allow re-purchasing same level if expired, otherwise block
  if (level === user.vip_level && user.vip_level > 0) {
    const isExpired = user.vip_expires_at && new Date(user.vip_expires_at) < new Date();
    if (!isExpired) {
      return new Response(JSON.stringify({ error: 'Already at this VIP level', code: 'CONFLICT' }), { status: 400 });
    }
  }

  if (tier.price > 0 && user.balance < tier.price) {
    return new Response(JSON.stringify({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' }), { status: 400 });
  }

  // Calculate vip_expires_at (30 days from now for paid tiers)
  const vipExpiresAt = level > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;

  // Deduct balance if not free
  if (tier.price > 0) {
    const result = await env.DB.prepare(
      'UPDATE users SET balance = balance - ?, vip_level = ?, vip_expires_at = ? WHERE id = ? AND balance >= ?'
    ).bind(tier.price, level, vipExpiresAt, user.id, tier.price).run();

    if (!result.meta.changes) {
      return new Response(JSON.stringify({ error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' }), { status: 400 });
    }

    await addTransaction(env.DB, {
      userId: user.id,
      type: 'VIP Upgrade',
      amount: -tier.price,
      status: 'Completed',
      description: `Upgraded to ${tier.name}`,
    });
  } else {
    await env.DB.prepare(
      'UPDATE users SET vip_level = ?, vip_expires_at = ? WHERE id = ?'
    ).bind(level, vipExpiresAt, user.id).run();

    await addTransaction(env.DB, {
      userId: user.id,
      type: 'VIP Upgrade',
      amount: 0,
      status: 'Completed',
      description: `Activated ${tier.name}`,
    });
  }

  const updatedUser = await getUser(env.DB, user.id);
  return new Response(JSON.stringify({
    ok: true,
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      balance: updatedUser.balance,
      totalEarnings: updatedUser.total_earnings,
      todayEarnings: updatedUser.today_earnings,
      completedTasks: updatedUser.completed_tasks,
      vipLevel: updatedUser.vip_level,
      vipExpiresAt: updatedUser.vip_expires_at,
      inviteCode: updatedUser.invite_code,
      isAdmin: updatedUser.is_admin === 1,
    }
  }));
}
