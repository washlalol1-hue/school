// Transactions routes: list transactions with optional type filter and pagination
import { authMiddleware } from '../auth.js';

export async function handleTransactions(request, env, path) {
  if (path === '/api/transactions' && request.method === 'GET') {
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
  const type = url.searchParams.get('type') || 'All';
  let page = parseInt(url.searchParams.get('page')) || 1;
  let limit = parseInt(url.searchParams.get('limit')) || 20;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;
  const offset = (page - 1) * limit;

  let countResult;
  let dataResult;

  if (type && type !== 'All') {
    countResult = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM transactions WHERE user_id = ? AND type = ?'
    ).bind(user.id, type).first();
    dataResult = await env.DB.prepare(
      'SELECT * FROM transactions WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(user.id, type, limit, offset).all();
  } else {
    countResult = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM transactions WHERE user_id = ?'
    ).bind(user.id).first();
    dataResult = await env.DB.prepare(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(user.id, limit, offset).all();
  }

  const total = countResult.cnt;
  const transactions = dataResult.results.map(t => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    status: t.status,
    desc: t.description,
    date: t.created_at ? t.created_at.split('T')[0] : t.created_at,
  }));

  return new Response(JSON.stringify({
    transactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }));
}
