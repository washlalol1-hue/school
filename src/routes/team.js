// Team routes: get team/referral list, get invite info
import { authMiddleware } from '../auth.js';

export async function handleTeam(request, env, path) {
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
  const refs = await env.DB.prepare(
    `SELECT u.id, u.username, u.vip_level, u.is_frozen, u.created_at
    FROM referrals r
    JOIN users u ON u.id = r.invitee_id
    WHERE r.inviter_id = ? AND r.level = 1
    ORDER BY u.created_at DESC`
  ).bind(user.id).all();

  const referrals = [];
  for (const r of refs.results) {
    // Calculate contribution per referral with a separate query
    const contrib = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'Referral' AND description LIKE ?"
    ).bind(user.id, `%user #${r.id}%`).first();

    referrals.push({
      username: r.username,
      vip: r.vip_level,
      joined: r.created_at ? r.created_at.split('T')[0] : r.created_at,
      contribution: contrib ? contrib.total : 0,
      status: r.is_frozen ? 'Inactive' : 'Active',
    });
  }

  return new Response(JSON.stringify({ referrals }));
}

async function getInvite(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  return new Response(JSON.stringify({
    inviteCode: user.invite_code,
    link: `https://demo.example.test/r/${user.invite_code}`,
  }));
}
