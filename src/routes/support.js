// Support routes: create, list, and view ticket detail
import { authMiddleware } from '../auth.js';
import { sanitizeInput, isValidLength, errorResponse } from '../utils.js';

export async function handleSupport(request, env, path) {
  if (path === '/api/support/tickets' && request.method === 'POST') {
    return create(request, env);
  }
  if (path === '/api/support/tickets' && request.method === 'GET') {
    return list(request, env);
  }
  const ticketMatch = path.match(/^\/api\/support\/tickets\/(\d+)$/);
  if (ticketMatch && request.method === 'GET') {
    return getTicketDetail(request, env, parseInt(ticketMatch[1]));
  }
  return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
}

async function create(request, env) {
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

  const { subject, category, message } = body;
  if (!subject || !message) {
    return new Response(JSON.stringify({ error: 'Subject and message are required', code: 'INVALID_INPUT' }), { status: 400 });
  }

  if (!isValidLength(subject, 1, 200)) {
    return errorResponse('Subject must be between 1 and 200 characters', 'INVALID_INPUT');
  }
  if (!isValidLength(message, 1, 2000)) {
    return errorResponse('Message must be between 1 and 2000 characters', 'INVALID_INPUT');
  }

  const cleanSubject = sanitizeInput(subject);
  const cleanMessage = sanitizeInput(message);
  const cleanCategory = sanitizeInput(category || 'Other');

  await env.DB.prepare(
    'INSERT INTO support_tickets (user_id, subject, category, message) VALUES (?, ?, ?, ?)'
  ).bind(user.id, cleanSubject, cleanCategory, cleanMessage).run();

  return new Response(JSON.stringify({ ok: true }), { status: 201 });
}

async function list(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  const url = new URL(request.url);
  let page = parseInt(url.searchParams.get('page')) || 1;
  let limit = parseInt(url.searchParams.get('limit')) || 20;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;
  const offset = (page - 1) * limit;

  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM support_tickets WHERE user_id = ?'
  ).bind(user.id).first();

  const results = await env.DB.prepare(
    'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(user.id, limit, offset).all();

  const total = countResult.cnt;
  const tickets = results.results.map(t => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    message: t.message,
    status: t.status,
    date: t.created_at,
  }));

  return new Response(JSON.stringify({
    tickets,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }));
}

async function getTicketDetail(request, env, ticketId) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
  }

  const ticket = await env.DB.prepare(
    'SELECT * FROM support_tickets WHERE id = ? AND user_id = ?'
  ).bind(ticketId, user.id).first();

  if (!ticket) {
    return new Response(JSON.stringify({ error: 'Ticket not found', code: 'NOT_FOUND' }), { status: 404 });
  }

  const replies = await env.DB.prepare(
    `SELECT sr.*, u.username FROM support_replies sr
     LEFT JOIN users u ON u.id = sr.user_id
     WHERE sr.ticket_id = ? ORDER BY sr.created_at ASC`
  ).bind(ticketId).all();

  return new Response(JSON.stringify({
    ticket,
    replies: replies.results
  }));
}
