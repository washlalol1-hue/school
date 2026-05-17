// Settings routes: profile update, password change, reset user data
import { authMiddleware, hashPassword, verifyPassword } from '../auth.js';
import { getUser } from '../db.js';

export async function handleSettings(request, env, path) {
  if (path === '/api/settings/profile' && request.method === 'PUT') {
    return updateProfile(request, env);
  }
  if (path === '/api/settings/password' && request.method === 'PUT') {
    return updatePassword(request, env);
  }
  if (path === '/api/settings/reset' && request.method === 'DELETE') {
    return resetUser(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

async function updateProfile(request, env) {
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

  const { username, email } = body;
  if (username) {
    // Check uniqueness
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? AND id != ?'
    ).bind(username, user.id).first();
    if (existing) {
      return new Response(JSON.stringify({ error: 'Username already taken' }), { status: 409 });
    }
  }

  await env.DB.prepare(
    'UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email) WHERE id = ?'
  ).bind(username || null, email || null, user.id).run();

  const updated = await getUser(env.DB, user.id);
  return new Response(JSON.stringify({ ok: true, username: updated.username, email: updated.email }));
}

async function updatePassword(request, env) {
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

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return new Response(JSON.stringify({ error: 'Current and new passwords are required' }), { status: 400 });
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Current password is incorrect' }), { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, user.id).run();

  return new Response(JSON.stringify({ ok: true }));
}

async function resetUser(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Reset user data but keep account
  await env.DB.prepare(
    `UPDATE users SET balance = 0, total_earnings = 0, today_earnings = 0,
     today_date = '', completed_tasks = 0, vip_level = 0 WHERE id = ?`
  ).bind(user.id).run();

  // Delete related records
  await env.DB.prepare('DELETE FROM tasks_completed WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM transactions WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM withdrawals WHERE user_id = ?').bind(user.id).run();

  return new Response(JSON.stringify({ ok: true }));
}
