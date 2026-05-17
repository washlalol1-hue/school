// Auth routes: register, login, me
import { createJWT, hashPassword, verifyPassword, authMiddleware } from '../auth.js';
import { getUserByUsername, getUserByEmail, getUserByInviteCode, createUser, getUser, getUserCount, generateInviteCode } from '../db.js';

export async function handleAuth(request, env, path) {
  if (path === '/api/auth/register' && request.method === 'POST') {
    return register(request, env);
  }
  if (path === '/api/auth/login' && request.method === 'POST') {
    return login(request, env);
  }
  if (path === '/api/auth/me' && request.method === 'GET') {
    return me(request, env);
  }
  if (path === '/api/auth/forgot-password' && request.method === 'POST') {
    return forgotPassword(request, env);
  }
  if (path === '/api/auth/reset-password' && request.method === 'POST') {
    return resetPassword(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

async function register(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { username, email, password, inviteCode } = body;
  if (!username || !email || !password) {
    return new Response(JSON.stringify({ error: 'Username, email, and password are required' }), { status: 400 });
  }
  if (password.length < 3) {
    return new Response(JSON.stringify({ error: 'Password too short' }), { status: 400 });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400 });
  }

  const existing = await getUserByUsername(env.DB, username);
  if (existing) {
    return new Response(JSON.stringify({ error: 'Username already taken' }), { status: 409 });
  }

  // Check for duplicate email
  const existingEmail = await getUserByEmail(env.DB, email);
  if (existingEmail) {
    return new Response(JSON.stringify({ error: 'Email already registered' }), { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const newInviteCode = generateInviteCode();

  let invitedBy = null;
  if (inviteCode) {
    const inviter = await getUserByInviteCode(env.DB, inviteCode);
    if (inviter) {
      invitedBy = inviter.id;
    }
  }

  // Check if this is the first user (make them admin)
  const userCount = await getUserCount(env.DB);
  const userId = await createUser(env.DB, { username, email, passwordHash, inviteCode: newInviteCode, invitedBy });

  if (userCount === 0) {
    await env.DB.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').bind(userId).run();
  }

  // Create referral records for multi-level
  if (invitedBy) {
    await env.DB.prepare(
      'INSERT INTO referrals (inviter_id, invitee_id, level) VALUES (?, ?, 1)'
    ).bind(invitedBy, userId).run();

    // L2 - inviter's inviter
    const inviterUser = await getUser(env.DB, invitedBy);
    if (inviterUser && inviterUser.invited_by) {
      await env.DB.prepare(
        'INSERT INTO referrals (inviter_id, invitee_id, level) VALUES (?, ?, 2)'
      ).bind(inviterUser.invited_by, userId).run();

      // L3
      const l2User = await getUser(env.DB, inviterUser.invited_by);
      if (l2User && l2User.invited_by) {
        await env.DB.prepare(
          'INSERT INTO referrals (inviter_id, invitee_id, level) VALUES (?, ?, 3)'
        ).bind(l2User.invited_by, userId).run();
      }
    }
  }

  const token = await createJWT({ userId }, env.JWT_SECRET);
  const user = await getUser(env.DB, userId);
  return new Response(JSON.stringify({ token, user: sanitizeUser(user) }), { status: 201 });
}

async function login(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password are required' }), { status: 400 });
  }

  const user = await getUserByUsername(env.DB, username);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  }

  if (user.is_frozen) {
    return new Response(JSON.stringify({ error: 'Account is frozen' }), { status: 403 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  }

  const token = await createJWT({ userId: user.id }, env.JWT_SECRET);
  return new Response(JSON.stringify({ token, user: sanitizeUser(user) }));
}

async function me(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return new Response(JSON.stringify({ user: sanitizeUser(user) }));
}

async function forgotPassword(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { username, email } = body;
  if (!username || !email) {
    return new Response(JSON.stringify({ error: 'Username and email are required' }), { status: 400 });
  }

  const user = await getUserByUsername(env.DB, username);
  if (!user || user.email !== email) {
    return new Response(JSON.stringify({ error: 'No account found with that username and email combination' }), { status: 404 });
  }

  // Generate a random reset token
  const tokenBytes = new Uint8Array(24);
  crypto.getRandomValues(tokenBytes);
  let token = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    token += chars[tokenBytes[i % tokenBytes.length] % chars.length];
  }

  // Token expires in 1 hour
  const expires = new Date(Date.now() + 3600000).toISOString();

  await env.DB.prepare(
    'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?'
  ).bind(token, expires, user.id).run();

  return new Response(JSON.stringify({
    message: 'Reset token generated. Since this is a demo without email service, the token is returned directly.',
    token: token
  }));
}

async function resetPassword(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { token, newPassword } = body;
  if (!token || !newPassword) {
    return new Response(JSON.stringify({ error: 'Token and new password are required' }), { status: 400 });
  }

  if (newPassword.length < 3) {
    return new Response(JSON.stringify({ error: 'Password too short' }), { status: 400 });
  }

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE password_reset_token = ?'
  ).bind(token).first();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired reset token' }), { status: 400 });
  }

  // Check if token has expired
  if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
    return new Response(JSON.stringify({ error: 'Reset token has expired' }), { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);

  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?'
  ).bind(passwordHash, user.id).run();

  return new Response(JSON.stringify({ message: 'Password has been reset successfully' }));
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    balance: user.balance,
    totalEarnings: user.total_earnings,
    todayEarnings: user.today_earnings,
    todayDate: user.today_date,
    completedTasks: user.completed_tasks,
    vipLevel: user.vip_level,
    inviteCode: user.invite_code,
    invitedBy: user.invited_by,
    isAdmin: user.is_admin === 1,
    isFrozen: user.is_frozen === 1,
    createdAt: user.created_at,
  };
}
