// Utility helpers for input validation and error responses

export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function isValidLength(str, min, max) {
  if (typeof str !== 'string') return false;
  return str.length >= min && str.length <= max;
}

export function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

export function errorResponse(message, code, status = 400) {
  return new Response(JSON.stringify({ error: message, code }), { status });
}
