import { authMiddleware } from '../auth.js';
import { todayStr } from '../db.js';

export async function handleStats(request, env, path) {
  if (path === '/api/stats' && request.method === 'GET') {
    return getUserStats(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
}

async function getUserStats(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  const today = todayStr();

  // Get today's completed tasks count
  const todayTasks = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM tasks_completed WHERE user_id = ? AND date = ?'
  ).bind(user.id, today).first();

  // Get VIP tier for total daily tasks
  const tier = await env.DB.prepare(
    'SELECT daily_tasks FROM vip_tiers WHERE level = ?'
  ).bind(user.vip_level).first();

  // Get referral count (L1)
  const refCount = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM referrals WHERE inviter_id = ? AND level = 1'
  ).bind(user.id).first();

  return new Response(JSON.stringify({
    todayTasksDone: todayTasks.cnt || 0,
    todayTasksTotal: tier ? tier.daily_tasks : 0,
    todayEarnings: user.today_date === today ? user.today_earnings : 0,
    totalEarnings: user.total_earnings,
    balance: user.balance,
    vipLevel: user.vip_level,
    vipExpiresAt: user.vip_expires_at,
    memberSince: user.created_at,
    loginCount: user.login_count || 0,
    referralCount: refCount.cnt || 0
  }));
}
