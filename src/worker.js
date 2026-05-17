// T-Video Media Demo - Cloudflare Worker Entry Point
// Routes /api/* requests to handlers, everything else falls through to static assets

import { handleAuth } from './routes/auth.js';
import { handleVip } from './routes/vip.js';
import { handleTasks } from './routes/tasks.js';
import { handleWallet } from './routes/wallet.js';
import { handleTeam } from './routes/team.js';
import { handleTransactions } from './routes/transactions.js';
import { handleMessages } from './routes/messages.js';
import { handleSupport } from './routes/support.js';
import { handleSettings } from './routes/settings.js';
import { handleAdmin } from './routes/admin.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(corsHeaders())) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Only handle /api/* routes
    if (!path.startsWith('/api/')) {
      // Pass through to static assets
      return env.ASSETS.fetch(request);
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    let response;
    try {
      if (path.startsWith('/api/auth/')) {
        response = await handleAuth(request, env, path);
      } else if (path.startsWith('/api/vip/')) {
        response = await handleVip(request, env, path);
      } else if (path.startsWith('/api/tasks')) {
        response = await handleTasks(request, env, path);
      } else if (path.startsWith('/api/wallet/')) {
        response = await handleWallet(request, env, path);
      } else if (path.startsWith('/api/team') || path.startsWith('/api/invite')) {
        response = await handleTeam(request, env, path);
      } else if (path.startsWith('/api/transactions')) {
        response = await handleTransactions(request, env, path);
      } else if (path.startsWith('/api/messages')) {
        response = await handleMessages(request, env, path);
      } else if (path.startsWith('/api/support/')) {
        response = await handleSupport(request, env, path);
      } else if (path.startsWith('/api/settings/')) {
        response = await handleSettings(request, env, path);
      } else if (path.startsWith('/api/admin/')) {
        response = await handleAdmin(request, env, path);
      } else {
        response = new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      }
    } catch (err) {
      response = new Response(JSON.stringify({ error: 'Internal server error', detail: err.message }), { status: 500 });
    }

    return jsonResponse(response);
  }
};
