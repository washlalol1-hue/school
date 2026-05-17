// JWT and password utilities for T-Video Media Demo
// Uses Web Crypto API (available in Cloudflare Workers)

const DEFAULT_SECRET = 'tvmd-demo-secret-key-2025';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret || DEFAULT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + 86400 * 7 };

  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(claims)));
  const data = `${headerB64}.${payloadB64}`;

  const key = await getKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${data}.${base64url(sig)}`;
}

export async function verifyJWT(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const key = await getKey(secret);
    const data = `${parts[0]}.${parts[1]}`;
    const sig = base64urlDecode(parts[2]);
    const valid = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(data));
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(base64urlDecode(parts[1])));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return base64url(salt) + '.' + base64url(hash);
}

export async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = stored.split('.');
  if (!saltB64 || !hashB64) return false;

  const salt = base64urlDecode(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return base64url(hash) === hashB64;
}

export async function authMiddleware(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const secret = env.JWT_SECRET || DEFAULT_SECRET;
  const payload = await verifyJWT(token, secret);
  if (!payload || !payload.userId) return null;

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first();
  if (!user) return null;
  if (user.is_frozen) return null;

  // Verify token_version matches
  if (payload.tokenVersion !== undefined && user.token_version !== undefined && payload.tokenVersion !== user.token_version) return null;

  return user;
}
