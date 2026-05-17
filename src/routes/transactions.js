// Transactions routes: list transactions with optional type filter
import { authMiddleware } from '../auth.js';
import { getTransactions } from '../db.js';

export async function handleTransactions(request, env, path) {
  if (path === '/api/transactions' && request.method === 'GET') {
    return list(request, env);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

async function list(request, env) {
  const user = await authMiddleware(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'All';

  const results = await getTransactions(env.DB, user.id, type);
  const transactions = results.map(t => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    status: t.status,
    desc: t.description,
    date: t.created_at ? t.created_at.split('T')[0] : t.created_at,
  }));

  return new Response(JSON.stringify({ transactions }));
}
