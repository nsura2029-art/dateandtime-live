/**
 * Cloudflare Cron Worker for City Page Maintenance
 *
 * Detects when city page data has changed (content hash compare) and
 * marks cities that need rebuilding. The actual HTML regeneration is
 * done by ./scripts/build-city-pages.js + ./scripts/deploy.sh (manual
 * or via a webhook trigger).
 *
 * Three schedules:
 *   - Weekly Sunday 04:00 UTC: Scan all 1,000 shipped cities, detect stale
 *   - Yearly Dec 1 05:00 UTC:  Force-rebuild all (holiday year transition)
 *   - Manual: POST /trigger/scan or /trigger/yearly
 *
 * Required bindings:
 *   - env.OTD_DB: D1 database (for cities table)
 *   - env.CITY_BUILDS: KV namespace (city_id → content_hash + last_built_at)
 *   - env.WEBHOOK_URL: optional URL to POST rebuild notifications to
 */

const CACHE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*'
};

const CITIES_TO_CHECK_LIMIT = 1000;
const BATCH_SIZE = 20;  // Cities per Worker invocation (avoids timeout)

/**
 * Compute a stable hash of city data that matters for the page content.
 * (excludes time-of-day fields like sun_position that change daily)
 */
async function hashCityData(c) {
  const contentString = JSON.stringify({
    name: c.name,
    population: c.population,
    timezone: c.tz || c.timezone,
    country: c.country || c.countryCode,
    state: c.state_code || c.stateCode,
    latitude: c.latitude,
    longitude: c.longitude,
    is_capital: c.is_capital || c.isCapital
  });
  // Simple FNV-1a 32-bit hash (good enough for change detection)
  let hash = 2166136261;
  for (let i = 0; i < contentString.length; i++) {
    hash ^= contentString.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Fetch holiday content hash for a country (changes yearly)
 */
async function hashHolidays(env, countryCode, year) {
  // In a real impl, this would hash the holidays list for the country/year
  // For now, just use a year-based hash since holidays change yearly
  return `holidays-${countryCode}-${year}`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'city-cron',
        timestamp: new Date().toISOString()
      }), { headers: CACHE_HEADERS });
    }

    if (url.pathname === '/trigger/scan') {
      ctx.waitUntil(scanStaleCities(env));
      return new Response(JSON.stringify({
        status: 'triggered',
        action: 'weekly_scan',
        timestamp: new Date().toISOString()
      }), { status: 202, headers: CACHE_HEADERS });
    }

    // /scan-batch?offset=0&limit=20 — process one batch (20 cities by default)
    if (url.pathname === '/scan-batch') {
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || String(BATCH_SIZE), 10), 100);
      const isInternal = url.searchParams.get('internal') === '1';
      try {
        const result = await scanStaleCities(env, offset, limit, isInternal);
        // Get the stale IDs from KV (set during scan)
        const list = env.CITY_BUILDS ? await env.CITY_BUILDS.list({ prefix: 'rebuild:' }) : null;
        const rebuildKeys = list ? list.keys.map(k => k.name) : [];
        return new Response(JSON.stringify({
          ...result,
          offset,
          limit,
          rebuild_keys_count: rebuildKeys.length
        }, null, 2), { headers: CACHE_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }, null, 2),
          { status: 500, headers: CACHE_HEADERS });
      }
    }

    // /scan-all — full scan of up to CITIES_TO_CHECK_LIMIT, chained batches
    if (url.pathname === '/scan-all') {
      const sync = url.searchParams.get('sync') === '1';
      if (sync) {
        try {
          const result = await runFullScan(env, ctx);
          return new Response(JSON.stringify(result, null, 2), { headers: CACHE_HEADERS });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message, stack: e.stack }, null, 2),
            { status: 500, headers: CACHE_HEADERS });
        }
      } else {
        ctx.waitUntil(runFullScan(env, ctx));
        return new Response(JSON.stringify({
          status: 'triggered',
          action: 'full_scan',
          note: 'Running in background. Check /status for progress.',
          timestamp: new Date().toISOString()
        }), { status: 202, headers: CACHE_HEADERS });
      }
    }

    if (url.pathname === '/trigger/yearly') {
      ctx.waitUntil(triggerYearlyRebuild(env));
      return new Response(JSON.stringify({
        status: 'triggered',
        action: 'yearly_full_rebuild',
        timestamp: new Date().toISOString()
      }), { status: 202, headers: CACHE_HEADERS });
    }

    if (url.pathname === '/status') {
      return await getStatus(env);
    }

    if (url.pathname === '/stale') {
      return await getStaleList(env);
    }

    if (url.pathname === '/debug/run') {
      // Synchronous run for debugging (not via waitUntil)
      try {
        const result = await scanStaleCities(env, 0, BATCH_SIZE, false);
        return new Response(JSON.stringify(result, null, 2), { headers: CACHE_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }, null, 2),
          { status: 500, headers: CACHE_HEADERS });
      }
    }

    return new Response('Not found. Try /health, /trigger/scan, /trigger/yearly, /status, /stale', {
      status: 404, headers: CACHE_HEADERS
    });
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron;
    const scheduledTime = new Date(event.scheduledTime);
    const utcMonth = scheduledTime.getUTCMonth() + 1;
    const utcDay = scheduledTime.getUTCDate();
    const utcDayOfWeek = scheduledTime.getUTCDay();

    console.log(`[cron] Triggered: ${cron} at ${scheduledTime.toISOString()}`);

    // Weekly Sunday 04:00 UTC
    if (utcDayOfWeek === 0 && scheduledTime.getUTCHours() === 4) {
      ctx.waitUntil(scanStaleCities(env));
    }
    // Yearly Dec 1 05:00 UTC
    else if (utcMonth === 12 && utcDay === 1 && scheduledTime.getUTCHours() === 5) {
      ctx.waitUntil(triggerYearlyRebuild(env));
    }
  }
};

/**
 * Scan the cities table, compare content hashes, mark stale ones.
 * Stores "needs_rebuild:1" in KV for stale cities.
 *
 * @param {Object} env - Worker env
 * @param {number} offset - Skip this many cities from the top (default 0)
 * @param {number} limit - Scan this many cities from the offset (default BATCH_SIZE)
 * @param {boolean} isPartOfFullScan - If true, skip storing meta:last_scan
 * @returns {Object} { total, stale, unchanged, new, next_offset, has_more, duration_ms }
 */
async function scanStaleCities(env, offset = 0, limit = BATCH_SIZE, isPartOfFullScan = false) {
  if (!env.OTD_DB) {
    console.error('[scan] No OTD_DB binding');
    return { error: 'No DB' };
  }

  const startTime = Date.now();

  try {
    // Get a chunk of cities by population, starting at offset
    const result = await env.OTD_DB.prepare(`
      SELECT id, name, country, state_code, tz, latitude, longitude, population, is_capital
      FROM cities
      ORDER BY population DESC NULLS LAST
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const cities = result.results || [];
    if (cities.length === 0) {
      return { total: 0, stale: 0, unchanged: 0, new: 0, next_offset: offset, has_more: false, duration_ms: 0 };
    }

    const year = new Date().getFullYear();
    let stale = [];
    let unchanged = 0;
    let newcities = 0;

    for (const c of cities) {
      if (!c.id) continue;
      const newHash = await hashCityData(c);
      const holidayHash = await hashHolidays(env, c.country, year);
      const compositeHash = `${newHash}-${holidayHash}`;

      // Get previous hash from KV
      const previous = env.CITY_BUILDS ? await env.CITY_BUILDS.get(`c:${c.id}`) : null;

      let isStale = false;
      let reason = null;

      if (!previous) {
        newcities++;
        isStale = true;
        reason = 'new';
      } else {
        try {
          const prev = JSON.parse(previous);
          if (prev.hash !== compositeHash) {
            isStale = true;
            reason = 'data_changed';
          } else {
            unchanged++;
          }
        } catch {
          isStale = true;
          reason = 'parse_error';
        }
      }

      // Write current hash (only if changed or new — saves KV ops on unchanged)
      if (env.CITY_BUILDS && (isStale || !previous)) {
        await env.CITY_BUILDS.put(`c:${c.id}`, JSON.stringify({
          hash: compositeHash,
          name: c.name,
          country: c.country,
          scanned_at: new Date().toISOString()
        }));
      }

      // Mark stale
      if (isStale) {
        stale.push({ id: c.id, name: c.name, reason });
        if (env.CITY_BUILDS) {
          await env.CITY_BUILDS.put(`rebuild:${c.id}`, JSON.stringify({
            reason,
            marked_at: new Date().toISOString()
          }));
        }
      }
    }

    const scanDuration = Date.now() - startTime;
    const hasMore = cities.length === limit;  // more pages if we filled the batch

    // Only store meta:last_scan for the FULL scan (last batch) or for a single-batch call
    if (env.CITY_BUILDS && !isPartOfFullScan) {
      await env.CITY_BUILDS.put('meta:last_scan', JSON.stringify({
        timestamp: new Date().toISOString(),
        total_cities: cities.length,
        stale_count: stale.length,
        unchanged_count: unchanged,
        new_count: newcities,
        stale_ids: stale.map(s => s.id),
        duration_ms: scanDuration,
        offset,
        next_offset: hasMore ? offset + limit : null,
        has_more: hasMore
      }));
    }

    return {
      total: cities.length,
      stale: stale.length,
      unchanged,
      new: newcities,
      next_offset: hasMore ? offset + limit : null,
      has_more: hasMore,
      duration_ms: scanDuration
    };
  } catch (err) {
    console.error('[scan] Error:', err.message);
    return { error: err.message };
  }
}

/**
 * Run a full scan by chaining multiple batch invocations of the Worker itself.
 * Each batch processes 20 cities. We track progress in KV.
 * Called from /scan-all endpoint.
 */
async function runFullScan(env, ctx) {
  if (!env.OTD_DB) return { error: 'No DB' };

  console.log('[scan-all] Starting full scan, fetching total city count...');

  // Get total count
  const countResult = await env.OTD_DB.prepare(`
    SELECT COUNT(*) as total FROM cities
  `).first();
  const total = Math.min(countResult?.total || 0, CITIES_TO_CHECK_LIMIT);
  const batches = Math.ceil(total / BATCH_SIZE);

  console.log(`[scan-all] Total: ${total} cities, ${batches} batches of ${BATCH_SIZE}`);

  // Store run metadata
  if (env.CITY_BUILDS) {
    await env.CITY_BUILDS.put('meta:full_scan', JSON.stringify({
      started_at: new Date().toISOString(),
      total_cities: total,
      batches_total: batches,
      status: 'running',
      batches_completed: 0
    }));
  }

  // Run all batches in parallel via fetch to self
  const workerUrl = env.WORKER_URL || 'https://city-cron-dev.nsura2029.workers.dev';
  const batchPromises = [];
  const aggregateStale = [];
  let totalUnchanged = 0;
  let totalNew = 0;
  const fullStartTime = Date.now();

  for (let i = 0; i < batches; i++) {
    const offset = i * BATCH_SIZE;
    // Call scanStaleCities directly instead of fetch to self
    // (Cloudflare Workers' internal fetch to its own URL can be blocked)
    const promise = (async () => {
      try {
        const data = await scanStaleCities(env, offset, BATCH_SIZE, true);
        if (data.error) {
          return { offset, ok: false, error: data.error };
        }
        return {
          offset,
          ok: true,
          stale: data.stale || 0,
          new: data.new || 0,
          unchanged: data.unchanged || 0,
          total: data.total || 0
        };
      } catch (e) {
        return { offset, ok: false, error: e.message };
      }
    })();
    batchPromises.push(promise);
  }

  const results = await Promise.all(batchPromises);
  const okBatches = results.filter(r => r.ok).length;
  const failedBatches = results.filter(r => !r.ok);
  const totalDuration = Date.now() - fullStartTime;
  const totalStale = results.reduce((s, r) => s + (r.stale || 0), 0);
  const totalNewAll = results.reduce((s, r) => s + (r.new || 0), 0);
  const totalUnchangedAll = results.reduce((s, r) => s + (r.unchanged || 0), 0);

  // After all batches done, collect all the rebuild:* keys from KV
  let finalStaleIds = [];
  if (env.CITY_BUILDS && totalStale > 0) {
    try {
      const list = await env.CITY_BUILDS.list({ prefix: 'rebuild:' });
      finalStaleIds = list.keys.map(k => k.name.replace('rebuild:', ''));
    } catch (e) { /* ignore */ }
  }

  if (failedBatches.length > 0) {
    console.warn(`[scan-all] ${failedBatches.length} failed batches:`, JSON.stringify(failedBatches));
  }

  console.log(`[scan-all] Complete: ${okBatches}/${batches} batches in ${totalDuration}ms`);

  if (env.CITY_BUILDS) {
    await env.CITY_BUILDS.put('meta:last_scan', JSON.stringify({
      timestamp: new Date().toISOString(),
      total_cities: total,
      stale_count: totalStale,
      unchanged_count: totalUnchangedAll,
      new_count: totalNewAll,
      stale_ids: finalStaleIds,
      duration_ms: totalDuration,
      batches_completed: okBatches,
      batches_total: batches
    }));
    await env.CITY_BUILDS.put('meta:full_scan', JSON.stringify({
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      total_cities: total,
      batches_total: batches,
      status: okBatches === batches ? 'success' : 'partial',
      batches_completed: okBatches,
      duration_ms: totalDuration
    }));
  }

  // Webhook notify
  if (env.WEBHOOK_URL && finalStaleIds.length > 0) {
    try {
      await fetch(env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: 'full_scan',
          stale_count: finalStaleIds.length,
          stale_ids: finalStaleIds,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) { /* ignore */ }
  }

  return {
    total,
    stale: totalStale,
    unchanged: totalUnchangedAll,
    new: totalNewAll,
    batches: okBatches,
    batches_total: batches,
    failed: failedBatches,
    duration_ms: totalDuration
  };
}

/**
 * Yearly: mark ALL 1,000 cities for rebuild (holiday year transition)
 */
async function triggerYearlyRebuild(env) {
  console.log('[yearly] Marking all cities for yearly rebuild...');
  if (!env.OTD_DB || !env.CITY_BUILDS) {
    return { error: 'Missing bindings' };
  }

  try {
    const result = await env.OTD_DB.prepare(`
      SELECT id FROM cities ORDER BY population DESC NULLS LAST LIMIT ?
    `).bind(CITIES_TO_CHECK_LIMIT).all();

    const cities = result.results || [];
    const newYear = new Date().getFullYear() + 1; // next year

    for (const c of cities) {
      await env.CITY_BUILDS.put(`rebuild:${c.id}`, JSON.stringify({
        reason: 'yearly_holiday_transition',
        target_year: newYear,
        marked_at: new Date().toISOString()
      }));
    }

    await env.CITY_BUILDS.put('meta:last_yearly', JSON.stringify({
      timestamp: new Date().toISOString(),
      target_year: newYear,
      cities_marked: cities.length
    }));

    console.log(`[yearly] ${cities.length} cities marked for yearly rebuild (target year ${newYear})`);

    if (env.WEBHOOK_URL) {
      try {
        await fetch(env.WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: 'yearly_full_rebuild',
            target_year: newYear,
            cities_marked: cities.length
          })
        });
      } catch (e) { /* ignore */ }
    }

    return { cities_marked: cities.length, target_year: newYear };
  } catch (err) {
    console.error('[yearly] Error:', err.message);
    return { error: err.message };
  }
}

/**
 * GET /status — summary of last scan
 */
async function getStatus(env) {
  if (!env.CITY_BUILDS) {
    return new Response(JSON.stringify({ error: 'No KV binding' }),
      { status: 503, headers: CACHE_HEADERS });
  }
  const lastScan = await env.CITY_BUILDS.get('meta:last_scan');
  const lastYearly = await env.CITY_BUILDS.get('meta:last_yearly');
  return new Response(JSON.stringify({
    last_scan: lastScan ? JSON.parse(lastScan) : null,
    last_yearly: lastYearly ? JSON.parse(lastYearly) : null,
    timestamp: new Date().toISOString()
  }, null, 2), { headers: CACHE_HEADERS });
}

/**
 * GET /stale — list of cities currently marked for rebuild
 */
async function getStaleList(env) {
  if (!env.CITY_BUILDS) {
    return new Response(JSON.stringify({ error: 'No KV binding' }),
      { status: 503, headers: CACHE_HEADERS });
  }
  // List all rebuild:* keys
  const list = await env.CITY_BUILDS.list({ prefix: 'rebuild:' });
  const stale = await Promise.all(list.keys.map(async k => {
    const data = await env.CITY_BUILDS.get(k.name);
    return { id: k.name.replace('rebuild:', ''), ...(data ? JSON.parse(data) : {}) };
  }));
  return new Response(JSON.stringify({
    count: stale.length,
    cities: stale.slice(0, 100),
    note: stale.length > 100 ? `Showing first 100 of ${stale.length}` : null
  }, null, 2), { headers: CACHE_HEADERS });
}
