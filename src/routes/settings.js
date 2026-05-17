// Settings routes: profile update, password change, reset user data
import { authMiddleware, hashPassword, verifyPassword } from '../auth.js';
import { getUser } from '../db.js';
import { sanitizeInput, isValidUsername, isValidLength, validateEmail, errorResponse } from '../utils.js';

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
  if (path === '/api/settings/account' && request.method === 'DELETE') {
    return deleteAccount(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
}

async function updateProfile(request, env) {
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

  const { username, email, password } = body;

  if (username) {
    const cleanUsername = sanitizeInput(username);
    if (!isValidUsername(cleanUsername)) {
      return errorResponse('Username must be 3-30 alphanumeric characters or underscores', 'INVALID_USERNAME');
    }

    // Check username change cooldown (24 hours)
    if (user.username_changed_at) {
      const lastChange = new Date(user.username_changed_at).getTime();
      const now = Date.now();
      if (now - lastChange < 24 * 60 * 60 * 1000) {
        return errorResponse('Can only change username once every 24 hours', 'USERNAME_COOLDOWN');
      }
    }

    // Check uniqueness
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? AND id != ?'
    ).bind(cleanUsername, user.id).first();
    if (existing) {
      return new Response(JSON.stringify({ error: 'Username already taken', code: 'CONFLICT' }), { status: 409 });
    }
  }

  if (email) {
    if (!validateEmail(email)) {
      return errorResponse('Invalid email format', 'INVALID_EMAIL');
    }
    if (!isValidLength(email, 5, 100)) {
      return errorResponse('Email must be between 5 and 100 characters', 'INVALID_EMAIL');
    }

    // Require password for email change
    if (!password) {
      return errorResponse('Password is required to change email', 'PASSWORD_REQUIRED');
    }
    const validPass = await verifyPassword(password, user.password_hash);
    if (!validPass) {
      return errorResponse('Incorrect password', 'INVALID_PASSWORD');
    }

    // Check email uniqueness
    const existingEmail = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND id != ?'
    ).bind(email, user.id).first();
    if (existingEmail) {
      return new Response(JSON.stringify({ error: 'Email already in use', code: 'CONFLICT' }), { status: 409 });
    }
  }

  // Build update query
  if (username && email) {
    const cleanUsername = sanitizeInput(username);
    await env.DB.prepare(
      "UPDATE users SET username = ?, email = ?, username_changed_at = datetime('now') WHERE id = ?"
    ).bind(cleanUsername, email, user.id).run();
  } else if (username) {
    const cleanUsername = sanitizeInput(username);
    await env.DB.prepare(
      "UPDATE users SET username = ?, username_changed_at = datetime('now') WHERE id = ?"
    ).bind(cleanUsername, user.id).run();
  } else if (email) {
    await env.DB.prepare(
      'UPDATE users SET email = ? WHERE id = ?'
    ).bind(email, user.id).run();
  }

  const updated = await getUser(env.DB, user.id);
  return new Response(JSON.stringify({ ok: true, username: updated.username, email: updated.email }));
}

async function updatePassword(request, env) {
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

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return new Response(JSON.stringify({ error: 'Current and new passwords are required', code: 'INVALID_INPUT' }), { status: 400 });
  }

  if (!isValidLength(newPassword, 6, 128)) {
    return errorResponse('Password must be between 6 and 128 characters', 'INVALID_PASSWORD');
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Current password is incorrect', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').bind(newHash, user.id).run();

  return new Response(JSON.stringify({ ok: true }));
}

async function resetUser(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
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

async function deleteAccount(request, env) {
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

  const { password } = body;
  if (!password) {
    return errorResponse('Password is required', 'INVALID_INPUT');
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return errorResponse('Incorrect password', 'INVALID_PASSWORD');
  }

  // Delete all associated data in order
  await env.DB.prepare('DELETE FROM tasks_completed WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM transactions WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM withdrawals WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM support_tickets WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM support_replies WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM referrals WHERE inviter_id = ? OR invitee_id = ?').bind(user.id, user.id).run();
  await env.DB.prepare('DELETE FROM messages WHERE target_user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM activity_log WHERE user_id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM login_attempts WHERE identifier = ?').bind(user.username).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  return new Response(JSON.stringify({ ok: true, code: 'ACCOUNT_DELETED' }));
}
