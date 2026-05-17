// Support routes: create and list tickets
import { authMiddleware } from '../auth.js';
import { sanitizeInput, isValidLength, errorResponse } from '../utils.js';

export async function handleSupport(request, env, path) {
  if (path === '/api/support/tickets' && request.method === 'POST') {
    return create(request, env);
  }
  if (path === '/api/support/tickets' && request.method === 'GET') {
    return list(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

async function create(request, env) {
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

  const { subject, category, message } = body;
  if (!subject || !message) {
    return new Response(JSON.stringify({ error: 'Subject and message are required' }), { status: 400 });
  }

  if (!isValidLength(subject, 1, 200)) {
    return errorResponse('Subject must be between 1 and 200 characters', 'INVALID_SUBJECT');
  }
  if (!isValidLength(message, 1, 2000)) {
    return errorResponse('Message must be between 1 and 2000 characters', 'INVALID_MESSAGE');
  }

  const cleanSubject = sanitizeInput(subject);

  await env.DB.prepare(
    'INSERT INTO support_tickets (user_id, subject, category, message) VALUES (?, ?, ?, ?)'
  ).bind(user.id, cleanSubject, category || 'Other', message).run();

  return new Response(JSON.stringify({ ok: true }), { status: 201 });
}

async function list(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const results = await env.DB.prepare(
    'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user.id).all();

  const tickets = results.results.map(t => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    message: t.message,
    status: t.status,
    date: t.created_at,
  }));

  return new Response(JSON.stringify({ tickets }));
}
