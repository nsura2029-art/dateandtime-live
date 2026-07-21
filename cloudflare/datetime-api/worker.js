/**
 * Main API Worker — dateandtime.live / api.dateandtime.live
 *
 * Composes all route modules:
 *   - /api/v1/*            existing (cities, time, holidays, etc.)
 *   - /api/v1/person/*     new (per-person, today's birthdays, birthday-twin)
 *   - /api/v1/onthisday/*  new + existing (per-event, batch POST)
 *   - /api/v1/time/now/multi  new (batched time lookup)
 *   - /api/v1/snapshot       new (today's combined snapshot)
 *
 * Each route module exports `handle(env, path, request)` that returns
 * either a Response (matched) or null (no match).
 *
 * Deployment:
 *   wrangler deploy --name datetime-api \
 *     --compatibility-date 2024-09-23 \
 *     --main worker.js
 *
 * Required bindings in wrangler.toml [env.production]:
 *   [[d1_databases]]
 *   binding = "OTD_DB"
 *   database_name = "timeandtimepro-full"
 *   database_id = "<UUID>"
 *
 *   [vars]
 *   OTD_DATES_DIR = "/tmp/otd-data-final/dates"  # optional fallback
 *   OTD_WEDDINGS_DIR = "/tmp/otd-weddings/by-date"
 *   OTD_PERSONS_FILE = "/tmp/otd-final/persons-top-50k.json"
 */

import { handle as personRoutes } from './routes/person.js';
import { handle as eventRoutes } from './routes/event.js';
import { handle as timeMultiRoutes } from './routes/time-multi.js';
import { handle as otdRoutes } from './routes/otd.js';
import { handle as yearRoutes } from './routes/year.js';

const ROUTE_MODULES = [personRoutes, eventRoutes, timeMultiRoutes, yearRoutes, otdRoutes];

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
        routes: ['person', 'event', 'time-multi', 'otd'],
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // Try each route module
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

    return jsonNotFound(path);
  }
};
