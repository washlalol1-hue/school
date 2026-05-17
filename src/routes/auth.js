// Auth routes: register, login, me
import { createJWT, hashPassword, verifyPassword, authMiddleware } from '../auth.js';
import { getUserByUsername, getUserByEmail, getUserByInviteCode, createUser, getUser, getUserCount, generateInviteCode } from '../db.js';
import { sanitizeInput, isValidUsername, isValidLength, validateEmail, errorResponse } from '../utils.js';

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
  return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
}

async function register(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), { status: 400 });
  }

  const { username, email, password, inviteCode } = body;
  if (!username || !email || !password) {
    return new Response(JSON.stringify({ error: 'Username, email, and password are required', code: 'INVALID_INPUT' }), { status: 400 });
  }

  const cleanUsername = sanitizeInput(username);

  if (!isValidUsername(cleanUsername)) {
    return errorResponse('Username must be 3-30 alphanumeric characters or underscores', 'INVALID_USERNAME');
  }

  if (!isValidLength(email, 5, 100)) {
    return errorResponse('Email must be between 5 and 100 characters', 'INVALID_EMAIL');
  }

  if (!isValidLength(password, 6, 128)) {
    return errorResponse('Password must be between 6 and 128 characters', 'INVALID_PASSWORD');
  }

  // Email format validation
  if (!validateEmail(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email format', code: 'INVALID_INPUT' }), { status: 400 });
  }

  const existing = await getUserByUsername(env.DB, cleanUsername);
  if (existing) {
    return new Response(JSON.stringify({ error: 'Username already taken', code: 'CONFLICT' }), { status: 409 });
  }

  // Check for duplicate email
  const existingEmail = await getUserByEmail(env.DB, email);
  if (existingEmail) {
    return new Response(JSON.stringify({ error: 'Email already registered', code: 'CONFLICT' }), { status: 409 });
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
  const userId = await createUser(env.DB, { username: cleanUsername, email, passwordHash, inviteCode: newInviteCode, invitedBy });

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

  const token = await createJWT({ userId, tokenVersion: 0 }, env.JWT_SECRET);
  const user = await getUser(env.DB, userId);
  return new Response(JSON.stringify({ token, user: sanitizeUser(user) }), { status: 201 });
}

async function login(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password are required', code: 'INVALID_INPUT' }), { status: 400 });
  }

  // Cleanup old login attempts on every login attempt to prevent unbounded table growth
  await env.DB.prepare(
    "DELETE FROM login_attempts WHERE attempt_time < datetime('now', '-1 hour')"
  ).run();

  // Rate limiting: check failed attempts in last 15 minutes
  const failedAttempts = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM login_attempts WHERE identifier = ? AND success = 0 AND attempt_time > datetime('now', '-15 minutes')"
  ).bind(username).first();

  if (failedAttempts && failedAttempts.cnt >= 5) {
    return new Response(JSON.stringify({ error: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' }), { status: 429 });
  }

  const user = await getUserByUsername(env.DB, username);
  if (!user) {
    // Record failed attempt
    await env.DB.prepare(
      'INSERT INTO login_attempts (identifier, success) VALUES (?, 0)'
    ).bind(username).run();
    return new Response(JSON.stringify({ error: 'Invalid credentials', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  if (user.is_frozen) {
    return new Response(JSON.stringify({ error: 'Account is frozen', code: 'FORBIDDEN' }), { status: 403 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    // Record failed attempt
    await env.DB.prepare(
      'INSERT INTO login_attempts (identifier, success) VALUES (?, 0)'
    ).bind(username).run();
    return new Response(JSON.stringify({ error: 'Invalid credentials', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  // Record successful login attempt
  await env.DB.prepare(
    'INSERT INTO login_attempts (identifier, success) VALUES (?, 1)'
  ).bind(username).run();

  // Daily login bonus: check if last_login_date was NOT today
  const todayDate = new Date().toISOString().split('T')[0];
  if (user.last_login_date !== todayDate) {
    await env.DB.prepare('UPDATE users SET balance = balance + 0.50 WHERE id = ?').bind(user.id).run();
    await env.DB.prepare(
      "INSERT INTO transactions (user_id, type, amount, status, description) VALUES (?, 'Login Bonus', 0.50, 'Completed', 'Daily login bonus')"
    ).bind(user.id).run();
  }

  // Update last login info
  await env.DB.prepare(
    "UPDATE users SET last_login_at = datetime('now'), login_count = login_count + 1, last_login_date = ? WHERE id = ?"
  ).bind(todayDate, user.id).run();

  // Cleanup expired password reset tokens
  await env.DB.prepare(
    "UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE password_reset_expires IS NOT NULL AND password_reset_expires < datetime('now')"
  ).run();

  const token = await createJWT({ userId: user.id, tokenVersion: user.token_version || 0 }, env.JWT_SECRET);
  return new Response(JSON.stringify({ token, user: sanitizeUser(user) }));
}

async function me(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }
  return new Response(JSON.stringify({ user: sanitizeUser(user) }));
}

async function forgotPassword(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), { status: 400 });
  }

  const { username, email } = body;
  if (!username || !email) {
    return new Response(JSON.stringify({ error: 'Username and email are required', code: 'INVALID_INPUT' }), { status: 400 });
  }

  const user = await getUserByUsername(env.DB, username);
  if (!user || user.email !== email) {
    return new Response(JSON.stringify({ error: 'No account found with that username and email combination', code: 'NOT_FOUND' }), { status: 404 });
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

  // NOTE: Demo-only behavior. In production, the reset token must be sent via email/SMS,
  // never returned directly in the API response body.
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
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'INVALID_JSON' }), { status: 400 });
  }

  const { token, newPassword } = body;
  if (!token || !newPassword) {
    return new Response(JSON.stringify({ error: 'Token and new password are required', code: 'INVALID_INPUT' }), { status: 400 });
  }

  if (newPassword.length < 6) {
    return new Response(JSON.stringify({ error: 'Password too short', code: 'INVALID_INPUT' }), { status: 400 });
  }

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE password_reset_token = ?'
  ).bind(token).first();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired reset token', code: 'INVALID_INPUT' }), { status: 400 });
  }

  // Check if token has expired
  if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
    return new Response(JSON.stringify({ error: 'Reset token has expired', code: 'INVALID_INPUT' }), { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);

  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, token_version = token_version + 1 WHERE id = ?'
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
