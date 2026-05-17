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
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

async function listTiers(env) {
  const tiers = await getVipTiers(env.DB);
  return new Response(JSON.stringify({ tiers }));
}

async function buyTier(request, env) {
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

  const { level } = body;
  if (level === undefined || level === null) {
    return new Response(JSON.stringify({ error: 'Level is required' }), { status: 400 });
  }

  const tier = await getVipTier(env.DB, level);
  if (!tier) {
    return new Response(JSON.stringify({ error: 'Invalid VIP level' }), { status: 400 });
  }

  if (tier.price > 0 && user.balance < tier.price) {
    return new Response(JSON.stringify({ error: 'Insufficient balance' }), { status: 400 });
  }

  // Deduct balance if not free
  if (tier.price > 0) {
    await env.DB.prepare(
      'UPDATE users SET balance = balance - ?, vip_level = ? WHERE id = ?'
    ).bind(tier.price, level, user.id).run();

    await addTransaction(env.DB, {
      userId: user.id,
      type: 'VIP Upgrade',
      amount: -tier.price,
      status: 'Completed',
      description: `Upgraded to ${tier.name}`,
    });
  } else {
    await env.DB.prepare(
      'UPDATE users SET vip_level = ? WHERE id = ?'
    ).bind(level, user.id).run();

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
      inviteCode: updatedUser.invite_code,
      isAdmin: updatedUser.is_admin === 1,
    }
  }));
}
