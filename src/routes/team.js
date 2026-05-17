// Team routes: get team/referral list, get invite info, get team stats
import { authMiddleware } from '../auth.js';

export async function handleTeam(request, env, path) {
  if (path === '/api/team/stats' && request.method === 'GET') {
    return getTeamStats(request, env);
  }
  if (path === '/api/team' && request.method === 'GET') {
    return getTeam(request, env);
  }
  if (path === '/api/invite' && request.method === 'GET') {
    return getInvite(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
}

async function getTeam(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  // Get L1 referrals
  const l1Refs = await env.DB.prepare(
    `SELECT u.id, u.username, u.vip_level, u.is_frozen, u.created_at
    FROM referrals r
    JOIN users u ON u.id = r.invitee_id
    WHERE r.inviter_id = ? AND r.level = 1
    ORDER BY u.created_at DESC`
  ).bind(user.id).all();

  // Get L2 referrals
  const l2Refs = await env.DB.prepare(
    `SELECT u.id, u.username, u.vip_level, u.is_frozen, u.created_at
    FROM referrals r
    JOIN users u ON u.id = r.invitee_id
    WHERE r.inviter_id = ? AND r.level = 2
    ORDER BY u.created_at DESC`
  ).bind(user.id).all();

  // Get L3 referrals
  const l3Refs = await env.DB.prepare(
    `SELECT u.id, u.username, u.vip_level, u.is_frozen, u.created_at
    FROM referrals r
    JOIN users u ON u.id = r.invitee_id
    WHERE r.inviter_id = ? AND r.level = 3
    ORDER BY u.created_at DESC`
  ).bind(user.id).all();

  const referrals = [];
  for (const r of l1Refs.results) {
    const contrib = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'Referral' AND description LIKE ?"
    ).bind(user.id, `%user #${r.id}%`).first();

    referrals.push({
      username: r.username,
      vip: r.vip_level,
      level: 1,
      joined: r.created_at ? r.created_at.split('T')[0] : r.created_at,
      contribution: contrib ? contrib.total : 0,
      status: r.is_frozen ? 'Inactive' : 'Active',
    });
  }

  for (const r of l2Refs.results) {
    const contrib = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'Referral' AND description LIKE ?"
    ).bind(user.id, `%user #${r.id}%`).first();

    referrals.push({
      username: r.username,
      vip: r.vip_level,
      level: 2,
      joined: r.created_at ? r.created_at.split('T')[0] : r.created_at,
      contribution: contrib ? contrib.total : 0,
      status: r.is_frozen ? 'Inactive' : 'Active',
    });
  }

  for (const r of l3Refs.results) {
    const contrib = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'Referral' AND description LIKE ?"
    ).bind(user.id, `%user #${r.id}%`).first();

    referrals.push({
      username: r.username,
      vip: r.vip_level,
      level: 3,
      joined: r.created_at ? r.created_at.split('T')[0] : r.created_at,
      contribution: contrib ? contrib.total : 0,
      status: r.is_frozen ? 'Inactive' : 'Active',
    });
  }

  // Calculate total commission from all referral transactions
  const totalCommResult = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'Referral'"
  ).bind(user.id).first();

  return new Response(JSON.stringify({
    referrals,
    l1Count: l1Refs.results.length,
    l2Count: l2Refs.results.length,
    l3Count: l3Refs.results.length,
    totalCommission: totalCommResult ? totalCommResult.total : 0
  }));
}

async function getTeamStats(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  const l1Count = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM referrals WHERE inviter_id = ? AND level = 1'
  ).bind(user.id).first();

  const l2Count = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM referrals WHERE inviter_id = ? AND level = 2'
  ).bind(user.id).first();

  const l3Count = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM referrals WHERE inviter_id = ? AND level = 3'
  ).bind(user.id).first();

  const totalCommResult = await env.DB.prepare(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'Referral'"
  ).bind(user.id).first();

  return new Response(JSON.stringify({
    l1Count: l1Count ? l1Count.cnt : 0,
    l2Count: l2Count ? l2Count.cnt : 0,
    l3Count: l3Count ? l3Count.cnt : 0,
    totalCommission: totalCommResult ? totalCommResult.total : 0
  }));
}

async function getInvite(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  // Return the invite code - the frontend will construct the full link using window.location.origin
  return new Response(JSON.stringify({
    inviteCode: user.invite_code,
  }));
}
