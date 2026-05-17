// Messages routes: list announcements/messages
import { authMiddleware } from '../auth.js';

export async function handleMessages(request, env, path) {
  if (path === '/api/messages' && request.method === 'GET') {
    return list(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
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
  if (limit > 50) limit = 50;
  const offset = (page - 1) * limit;

  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM messages WHERE target_user_id IS NULL OR target_user_id = ?'
  ).bind(user.id).first();

  const results = await env.DB.prepare(
    `SELECT * FROM messages
     WHERE target_user_id IS NULL OR target_user_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(user.id, limit, offset).all();

  const messages = results.results.map(m => ({
    id: m.id,
    title: m.title,
    body: m.body,
    tag: m.tag,
    date: m.created_at ? m.created_at.split('T')[0] : m.created_at,
  }));

  return new Response(JSON.stringify({ messages, total: countResult.cnt, page, limit }));
}
