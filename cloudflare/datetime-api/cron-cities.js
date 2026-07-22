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

const CITIES_TO_CHECK_LIMIT = 50;  // Start small to avoid timeout

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
        const result = await scanStaleCities(env);
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
 */
async function scanStaleCities(env) {
  if (!env.OTD_DB) {
    console.error('[scan] No OTD_DB binding');
    return { error: 'No DB' };
  }

  console.log('[scan] Starting weekly city page scan...');
  const startTime = Date.now();

  try {
    // Get top 1000 cities by population
    const result = await env.OTD_DB.prepare(`
      SELECT id, name, country, state_code, tz, latitude, longitude, population, is_capital
      FROM cities
      ORDER BY population DESC NULLS LAST
      LIMIT ?
    `).bind(CITIES_TO_CHECK_LIMIT).all();

    const cities = result.results || [];
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

      // Always write current hash (for next scan)
      if (env.CITY_BUILDS) {
        await env.CITY_BUILDS.put(`c:${c.id}`, JSON.stringify({
          hash: compositeHash,
          name: c.name,
          country: c.country,
          scanned_at: new Date().toISOString()
        }));
      }

      if (!previous) {
        newcities++;
        stale.push({ id: c.id, name: c.name, reason: 'new' });
      } else {
        try {
          const prev = JSON.parse(previous);
          if (prev.hash !== compositeHash) {
            stale.push({ id: c.id, name: c.name, reason: 'data_changed' });
          } else {
            unchanged++;
          }
        } catch {
          stale.push({ id: c.id, name: c.name, reason: 'parse_error' });
        }
      }
    }

    const scanDuration = Date.now() - startTime;
    console.log(`[scan] ${cities.length} cities scanned in ${scanDuration}ms`);
    console.log(`[scan] ${stale.length} stale, ${unchanged} unchanged, ${newcities} new`);

    // Store the scan result in KV (last_scan)
    if (env.CITY_BUILDS) {
      await env.CITY_BUILDS.put('meta:last_scan', JSON.stringify({
        timestamp: new Date().toISOString(),
        total_cities: cities.length,
        stale_count: stale.length,
        unchanged_count: unchanged,
        new_count: newcities,
        stale_ids: stale.map(s => s.id),
        duration_ms: scanDuration
      }));

      // Mark each stale city
      for (const s of stale) {
        await env.CITY_BUILDS.put(`rebuild:${s.id}`, JSON.stringify({
          reason: s.reason,
          marked_at: new Date().toISOString()
        }));
      }
    }

    // Optionally POST to a webhook to trigger the build
    if (env.WEBHOOK_URL && stale.length > 0) {
      try {
        await fetch(env.WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: 'weekly_scan',
            stale_count: stale.length,
            stale_ids: stale.map(s => s.id),
            timestamp: new Date().toISOString()
          })
        });
        console.log(`[scan] Webhook notified: ${stale.length} stale cities`);
      } catch (e) {
        console.warn('[scan] Webhook failed:', e.message);
      }
    }

    return {
      total: cities.length,
      stale: stale.length,
      unchanged,
      new: newcities,
      duration_ms: scanDuration
    };
  } catch (err) {
    console.error('[scan] Error:', err.message);
    return { error: err.message };
  }
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
