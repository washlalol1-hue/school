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
import { handleStats } from './routes/stats.js';

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

    // Only handle /api/* routes - let Wrangler serve static assets
    if (!path.startsWith('/api/')) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      // If ASSETS binding not available (Wrangler serves assets directly),
      // return 404 for any non-asset request that falls through
      return new Response('Not found', { status: 404 });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    let response;
    try {
      // Health check - no auth required
      if (path === '/api/health' && request.method === 'GET') {
        return jsonResponse(new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })));
      }

      if (path.startsWith('/api/auth/')) {
        response = await handleAuth(request, env, path);
      } else if (path.startsWith('/api/vip/')) {
        response = await handleVip(request, env, path);
      } else if (path.startsWith('/api/tasks')) {
        response = await handleTasks(request, env, path);
      } else if (path.startsWith('/api/wallet/')) {
        response = await handleWallet(request, env, path);
      } else if (path.startsWith('/api/team') || path.startsWith('/api/invite')) {
        // Handles /api/team, /api/team/stats, /api/invite
        response = await handleTeam(request, env, path);
      } else if (path.startsWith('/api/transactions')) {
        response = await handleTransactions(request, env, path);
      } else if (path.startsWith('/api/messages')) {
        response = await handleMessages(request, env, path);
      } else if (path === '/api/stats' || path.startsWith('/api/stats/')) {
        response = await handleStats(request, env, path);
      } else if (path.startsWith('/api/support/')) {
        response = await handleSupport(request, env, path);
      } else if (path.startsWith('/api/settings/')) {
        response = await handleSettings(request, env, path);
      } else if (path.startsWith('/api/admin/')) {
        response = await handleAdmin(request, env, path);
      } else {
        response = new Response(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }), { status: 404 });
      }
    } catch (err) {
      response = new Response(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR', detail: err.message }), { status: 500 });
    }

    return jsonResponse(response);
  }
};
