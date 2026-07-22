/**
 * Main API Worker — dateandtime.live / api.dateandtime.live
 *
 * Composes all route modules:
 *   - /api/v1/*            existing (cities, time, holidays, etc.) — proxied to prod
 *   - /api/v1/person/*     new (per-person, today's birthdays, birthday-twin)
 *   - /api/v1/onthisday/*  new + existing (per-event, batch POST)
 *   - /api/v1/time/now/multi  new (batched time lookup)
 *   - /api/v1/snapshot       new (today's combined snapshot)
 *   - /api/v1/year/*       new (year-page data, multi-year compare)
 *
 * Each route module exports `handle(env, path, request)` that returns
 * either a Response (matched) or null (no match).
 *
 * FALLBACK: paths that don't match any of the new route modules are
 * forwarded to the prod API (api.dateandtime.live). This lets the dev
 * frontend keep using legacy routes (cities, countries, holidays/today,
 * dst, search, feedback, etc.) while the new endpoints use the dev D1.
 *
 * Deployment:
 *   wrangler deploy --name datetime-api-dev
 *   (see cloudflare/datetime-api/wrangler.toml)
 */

import { handle as personRoutes } from './routes/person.js';
import { handle as eventRoutes } from './routes/event.js';
import { handle as timeMultiRoutes } from './routes/time-multi.js';
import { handle as otdRoutes } from './routes/otd.js';
import { handle as yearRoutes } from './routes/year.js';
import { handle as citiesRoutes } from './routes/cities.js';

const ROUTE_MODULES = [personRoutes, eventRoutes, timeMultiRoutes, yearRoutes, otdRoutes, citiesRoutes];

// ============================================================================
// CORS preflight
// ============================================================================

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function handleCORS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// ============================================================================
// Error handlers
// ============================================================================

function jsonError(message, status, extra = {}) {
  return new Response(JSON.stringify({
    error: message,
    ...extra,
    timestamp: new Date().toISOString()
  }, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function jsonNotFound(path) {
  return jsonError('Not found', 404, { path });
}

function jsonServerError(err) {
  console.error('API error:', err);
  return jsonError('Internal server error', 500, {
    message: err?.message || String(err)
  });
}

// ============================================================================
// Fallback proxy to prod API (for legacy routes)
// ============================================================================

async function proxyToProd(request) {
  const url = new URL(request.url);
  const target = `https://api.dateandtime.live${url.pathname}${url.search}`;
  try {
    const r = await fetch(target, {
      headers: { "Accept": "application/json" }
    });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=300"
      }
    });
  } catch (e) {
    return jsonError("upstream_unavailable", 502, { message: e?.message });
  }
}

// ============================================================================
// Main fetch handler
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') return handleCORS();

    // Health check
    if (path === '/api/health' || path === '/api/v1/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'datetime-api',
        version: '2.0.0',
        routes: ['person', 'event', 'time-multi', 'year', 'otd', 'fallback-proxy'],
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // Try each new route module
    for (const routeFn of ROUTE_MODULES) {
      try {
        const response = await routeFn(env, path, request);
        if (response) {
          // Add CORS headers if missing
          const newResponse = new Response(response.body, response);
          Object.entries(corsHeaders()).forEach(([k, v]) => {
            if (!newResponse.headers.get(k)) newResponse.headers.set(k, v);
          });
          return newResponse;
        }
      } catch (err) {
        console.error(`Route error for ${path}:`, err);
        return jsonServerError(err);
      }
    }

    // Fallback: forward unmatched /api/* paths to prod
    if (path.startsWith('/api/')) {
      return proxyToProd(request);
    }

    return jsonNotFound(path);
  }
};
