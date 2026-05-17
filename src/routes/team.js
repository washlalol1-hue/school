// Team routes: get team/referral list, get invite info
import { authMiddleware } from '../auth.js';

export async function handleTeam(request, env, path) {
  if (path === '/api/team' && request.method === 'GET') {
    return getTeam(request, env);
  }
  if (path === '/api/invite' && request.method === 'GET') {
    return getInvite(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

async function getTeam(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Get L1 referrals with their info
  const refs = await env.DB.prepare(
    `SELECT u.id, u.username, u.vip_level, u.is_frozen, u.created_at,
      COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = r.inviter_id AND type = 'Referral' AND description LIKE '%user #' || u.id || '%'), 0) as contribution
    FROM referrals r
    JOIN users u ON u.id = r.invitee_id
    WHERE r.inviter_id = ? AND r.level = 1
    ORDER BY u.created_at DESC`
  ).bind(user.id).all();

  const referrals = refs.results.map(r => ({
    username: r.username,
    vip: r.vip_level,
    joined: r.created_at ? r.created_at.split('T')[0] : r.created_at,
    contribution: r.contribution || 0,
    status: r.is_frozen ? 'Inactive' : 'Active',
  }));

  return new Response(JSON.stringify({ referrals }));
}

async function getInvite(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  return new Response(JSON.stringify({
    inviteCode: user.invite_code,
    link: `https://demo.example.test/r/${user.invite_code}`,
  }));
}
