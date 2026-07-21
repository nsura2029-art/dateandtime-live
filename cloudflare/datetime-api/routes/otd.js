/**
 * Public read API routes for on-this-day
 *
 * Per Blueprint Ch 5 (free data sources) + Feature #5 (developer API):
 *   GET /api/v1/on-this-day/{MM-DD}     events + births + deaths + holidays
 *   GET /api/v1/born/{MM-DD}            persons only
 *   GET /api/v1/died/{MM-DD}            persons only
 *   GET /api/v1/today                   server date + payload
 *   GET /api/v1/holidays/{CC}/{YYYY}    Nager data
 *   GET /api/v1/national-days/{MM-DD}   observances
 *   GET /api/v1/ask?q=...               RAG (Phase 3)
 *
 * License: All Wikimedia-derived data is CC BY-SA 4.0.
 * Nager data: free to use. Wikidata: CC0.
 *
 * Source: Blueprint Ch 5 (data sources) + Feature #5 (dev API tier)
 */

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400',
  'Content-Type': 'application/json; charset=utf-8'
};

const TODAY_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=600',  // 5min cache for today
  'Content-Type': 'application/json; charset=utf-8'
};

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Format a date as ISO YYYY-MM-DD
 */
function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Common attribution block for all responses.
 */
function attributionBlock() {
  return {
    text: 'Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0.',
    text_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    wikimedia_feed: 'https://api.wikimedia.org/feed/v1/wikipedia/',
    byabbe: 'https://byabbe.se/',
    muffinlabs: 'https://history.muffinlabs.com/',
    nager_date: 'https://date.nager.at/Api',
    wikidata: 'https://www.wikidata.org/'
  };
}

/**
 * GET /api/v1/on-this-day/{MM-DD}
 * Main endpoint: events + births + deaths + holidays for a date
 */
async function handleOnThisDay(env, request, mmdd) {
  const match = mmdd.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Invalid date format. Use MM-DD' }), {
      status: 400, headers: CACHE_HEADERS
    });
  }

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const lang = new URL(request.url).searchParams.get('lang') || 'en';
  const limit = parseInt(new URL(request.url).searchParams.get('limit') || '20', 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return new Response(JSON.stringify({ error: 'Invalid date' }), {
      status: 400, headers: CACHE_HEADERS
    });
  }

  // Query D1 database (or fallback to static data)
  let entries = [];
  if (env.OTD_DB) {
    try {
      const result = await env.OTD_DB.prepare(`
        SELECT * FROM onthisday
        WHERE month = ? AND day = ?
        ORDER BY rank_score DESC, year ASC
        LIMIT ?
      `).bind(month, day, limit).all();
      entries = result.results || [];
    } catch (err) {
      console.warn('D1 query failed:', err.message);
    }
  }

  // Group by type
  const events = entries.filter(e => e.type === 'event');
  const births = entries.filter(e => e.type === 'birth');
  const deaths = entries.filter(e => e.type === 'death');
  const holidays = entries.filter(e => e.type === 'holiday');
  const weddings = entries.filter(e => e.type === 'wedding');

  return new Response(JSON.stringify({
    date: `${month}-${day}`,
    month,
    day,
    month_name: MONTH_NAMES[month],
    events,
    births,
    deaths,
    holidays,
    weddings,
    total: entries.length,
    attribution: attributionBlock()
  }, null, 2), { headers: CACHE_HEADERS });
}

/**
 * GET /api/v1/born/{MM-DD}
 * Persons only (births on a date)
 */
async function handleBorn(env, request, mmdd) {
  const match = mmdd.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Invalid date format. Use MM-DD' }), {
      status: 400, headers: CACHE_HEADERS
    });
  }

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const limit = parseInt(new URL(request.url).searchParams.get('limit') || '50', 10);

  let entries = [];
  if (env.OTD_DB) {
    try {
      const result = await env.OTD_DB.prepare(`
        SELECT * FROM onthisday
        WHERE month = ? AND day = ? AND type = 'birth'
        ORDER BY rank_score DESC
        LIMIT ?
      `).bind(month, day, limit).all();
      entries = result.results || [];
    } catch (err) {
      console.warn('D1 query failed:', err.message);
    }
  }

  return new Response(JSON.stringify({
    date: `${month}-${day}`,
    type: 'births',
    persons: entries,
    total: entries.length,
    attribution: attributionBlock()
  }, null, 2), { headers: CACHE_HEADERS });
}

/**
 * GET /api/v1/died/{MM-DD}
 */
async function handleDied(env, request, mmdd) {
  const match = mmdd.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Invalid date format. Use MM-DD' }), {
      status: 400, headers: CACHE_HEADERS
    });
  }

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const limit = parseInt(new URL(request.url).searchParams.get('limit') || '50', 10);

  let entries = [];
  if (env.OTD_DB) {
    try {
      const result = await env.OTD_DB.prepare(`
        SELECT * FROM onthisday
        WHERE month = ? AND day = ? AND type = 'death'
        ORDER BY rank_score DESC
        LIMIT ?
      `).bind(month, day, limit).all();
      entries = result.results || [];
    } catch (err) {
      console.warn('D1 query failed:', err.message);
    }
  }

  return new Response(JSON.stringify({
    date: `${month}-${day}`,
    type: 'deaths',
    persons: entries,
    total: entries.length,
    attribution: attributionBlock()
  }, null, 2), { headers: CACHE_HEADERS });
}

/**
 * GET /api/v1/today
 * Server date + payload
 */
async function handleToday(env, request) {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const year = now.getUTCFullYear();

  let entries = [];
  if (env.OTD_DB) {
    try {
      const result = await env.OTD_DB.prepare(`
        SELECT * FROM onthisday
        WHERE month = ? AND day = ? AND verified = 1
        ORDER BY rank_score DESC
        LIMIT 30
      `).bind(month, day).all();
      entries = result.results || [];
    } catch (err) {
      console.warn('D1 query failed:', err.message);
    }
  }

  return new Response(JSON.stringify({
    today: isoDate(year, month, day),
    month,
    day,
    month_name: MONTH_NAMES[month],
    day_of_year: Math.floor((now - new Date(year, 0, 0)) / 86400000),
    week_number: getWeekNumber(now),
    events: entries.filter(e => e.type === 'event').slice(0, 5),
    births: entries.filter(e => e.type === 'birth').slice(0, 5),
    deaths: entries.filter(e => e.type === 'death').slice(0, 5),
    holidays: entries.filter(e => e.type === 'holiday'),
    total: entries.length,
    attribution: attributionBlock()
  }, null, 2), { headers: TODAY_CACHE_HEADERS });
}

/**
 * GET /api/v1/holidays/{CC}/{YYYY}
 * Nager.Date data for a country/year
 */
async function handleHolidays(env, request, cc, yyyy) {
  const countryCode = cc.toUpperCase();
  const year = parseInt(yyyy, 10);
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DateAndTime-Live/1.0 (https://dateandtime.live; contact@dateandtime.live)' }
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Nager returned ${res.status}` }), {
        status: res.status, headers: CACHE_HEADERS
      });
    }
    const data = await res.json();
    return new Response(JSON.stringify({
      country: countryCode,
      year,
      holidays: data,
      source: 'nager_date',
      attribution: {
        text: 'Holidays from Nager.Date',
        url: 'https://date.nager.at/Api',
        license: 'free-to-use'
      }
    }, null, 2), { headers: CACHE_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: CACHE_HEADERS
    });
  }
}

/**
 * GET /api/v1/national-days/{MM-DD}
 * Curated list of national/international days
 */
async function handleNationalDays(env, request, mmdd) {
  // In production, this would query the otd_observances table
  // For now, return a stub indicating where data lives
  return new Response(JSON.stringify({
    date: mmdd,
    note: 'National day data is stored in content/otd/national-days/. See scripts/lib/national-days.js for the curated list.',
    attribution: {
      text: 'Curated from public sources',
      license: 'CC0'
    }
  }, null, 2), { headers: CACHE_HEADERS });
}

/**
 * GET /api/v1/ask?q=... (Phase 3 - RAG)
 * Cited AI answer endpoint
 */
async function handleAsk(env, request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
      status: 400, headers: CACHE_HEADERS
    });
  }

  // For data-only mode, return a stub that the RAG layer can build on
  return new Response(JSON.stringify({
    query,
    note: 'RAG endpoint available in Phase 3. Use scripts/lib/rag-retrieve.js + rag-generate.js to construct the answer.',
    attribution: attributionBlock()
  }, null, 2), { headers: CACHE_HEADERS });
}

/**
 * Compute ISO week number.
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Main router for /api/v1/* OTD endpoints
 */
export async function handle(env, path, request) {
  // Signature matches other route modules: (env, path, request)
  const url = new URL(request.url);
  const routePath = path || url.pathname;

  // Route matching
  const routes = [
    { match: /^\/api\/v1\/on-this-day\/(\d{1,2}-\d{1,2})$/, handler: (req, env) => {
      const m = routePath.match(/^\/api\/v1\/on-this-day\/(\d{1,2}-\d{1,2})$/);
      return handleOnThisDay(env, req, m[1]);
    }},
    { match: /^\/api\/v1\/born\/(\d{1,2}-\d{1,2})$/, handler: (req, env) => {
      const m = routePath.match(/^\/api\/v1\/born\/(\d{1,2}-\d{1,2})$/);
      return handleBorn(env, req, m[1]);
    }},
    { match: /^\/api\/v1\/died\/(\d{1,2}-\d{1,2})$/, handler: (req, env) => {
      const m = routePath.match(/^\/api\/v1\/died\/(\d{1,2}-\d{1,2})$/);
      return handleDied(env, req, m[1]);
    }},
    { match: /^\/api\/v1\/today$/, handler: handleToday },
    { match: /^\/api\/v1\/holidays\/([A-Z]{2})\/(\d{4})$/, handler: (req, env) => {
      const m = routePath.match(/^\/api\/v1\/holidays\/([A-Z]{2})\/(\d{4})$/);
      return handleHolidays(env, req, m[1], m[2]);
    }},
    { match: /^\/api\/v1\/national-days\/(\d{1,2}-\d{1,2})$/, handler: (req, env) => {
      const m = routePath.match(/^\/api\/v1\/national-days\/(\d{1,2}-\d{1,2})$/);
      return handleNationalDays(env, req, m[1]);
    }},
    { match: /^\/api\/v1\/ask$/, handler: handleAsk }
  ];

  for (const route of routes) {
    if (route.match.test(routePath)) {
      return route.handler(request, env);
    }
  }

  // No route matched — return null so the worker can fall through to
  // the legacy proxy (api.dateandtime.live) for unmatched paths.
  return null;
}
