/**
 * Year-page API
 *
 * Returns events for a specific (year, optional month+day).
 * Used by year-in-history pages, "X years ago" widgets, and
 * the "this day in history" search results.
 *
 *   GET /api/v1/year/{year}?month=MM&day=DD
 *   GET /api/v1/year/{year}                    (all events in year)
 *   GET /api/v1/year/{year}/multi?years=1969,2001,2024   (multi-year compare)
 *
 * Per Blueprint Ch 7 (T4 year pages):
 *   - /history/{year}/              top events + births + deaths of the year
 *   - /history/{year}/{month}/{day}/ events on this day in this year
 *
 * Response shape:
 *   { year, month, day, total, events: [...], byType: {event, birth, death, ...} }
 */

import { queryOTD, attributionBlock, CACHE_HEADERS } from '../lib/d1.js';
import { useFileFallback, loadOTDFromFiles } from '../lib/fallback.js';

const YEAR_CACHE = { ...CACHE_HEADERS };
const YEAR_CACHE_LONG = { ...CACHE_HEADERS, 'Cache-Control': 'public, max-age=86400, s-maxage=604800' };

/**
 * GET /api/v1/year/{year}?month=MM&day=DD
 * Returns events for the year (or specific date in the year)
 */
export async function handleYear(env, year, request) {
  const url = new URL(request.url);
  const monthParam = url.searchParams.get('month');
  const dayParam = url.searchParams.get('day');
  const typeParam = url.searchParams.get('type');
  const minRank = parseInt(url.searchParams.get('minRank') || '0', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const yearNum = parseInt(year, 10);
  if (!yearNum || yearNum < 1 || yearNum > 9999) {
    return json({ error: 'Invalid year', year }, 400, YEAR_CACHE);
  }

  const month = monthParam ? parseInt(monthParam, 10) : null;
  const day = dayParam ? parseInt(dayParam, 10) : null;
  const type = typeParam || null;

  let entries = [];

  if (useFileFallback(env)) {
    // File fallback: scan all per-date files for matching entries
    entries = await loadYearFromFiles(env, yearNum, month, day, type, minRank, limit);
  } else {
    const opts = {
      year: yearNum,
      month: month || 0,
      day: day || 0,
      rankMin: minRank,
      limit,
      verifiedOnly: false  // year pages should show all entries, even unverified
    };
    if (type) opts.type = type;

    if (month && day) {
      // Specific date in this year
      entries = await queryOTD(env.OTD_DB, { ...opts, month, day, year: undefined, yearMin: yearNum, yearMax: yearNum });
    } else {
      entries = await queryOTD(env.OTD_DB, opts);
    }
  }

  // Bucket by type
  const byType = entries.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  return json({
    year: yearNum,
    month,
    day,
    total: entries.length,
    requestedYear: yearNum,
    byType,
    events: entries,
    attribution: attributionBlock()
  }, 200, YEAR_CACHE);
}

/**
 * GET /api/v1/year/{year}/multi?years=1969,2001,2024
 * Compare events across multiple years (e.g. "what else happened in 1969")
 */
export async function handleYearMulti(env, request) {
  const url = new URL(request.url);
  const yearsParam = url.searchParams.get('years');
  const month = parseInt(url.searchParams.get('month') || '0', 10);
  const day = parseInt(url.searchParams.get('day') || '0', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 50);

  if (!yearsParam) {
    return json({
      error: 'Missing years',
      hint: 'Use ?years=1969,2001,2024',
      example: '/api/v1/year/multi?years=1969,2001&month=7&day=20'
    }, 400, YEAR_CACHE);
  }

  const years = yearsParam.split(',').map(y => parseInt(y.trim(), 10)).filter(Boolean);
  if (!years.length) {
    return json({ error: 'No valid years' }, 400, YEAR_CACHE);
  }

  if (years.length > 20) {
    return json({ error: 'Too many years (max 20)' }, 400, YEAR_CACHE);
  }

  const results = [];
  for (const year of years) {
    let entries = [];
    if (useFileFallback(env)) {
      entries = await loadYearFromFiles(env, year, month, day, null, 0, limit);
    } else {
      const opts = { year, rankMin: 0, limit, verifiedOnly: false };
      if (month && day) {
        opts.month = month;
        opts.day = day;
        opts.year = undefined;
        opts.yearMin = year;
        opts.yearMax = year;
      }
      entries = await queryOTD(env.OTD_DB, opts);
    }
    results.push({ year, total: entries.length, events: entries });
  }

  return json({
    years,
    month: month || null,
    day: day || null,
    total: results.reduce((s, r) => s + r.total, 0),
    results,
    attribution: attributionBlock()
  }, 200, YEAR_CACHE);
}

/**
 * File fallback: scan all per-date files for matching year
 */
async function loadYearFromFiles(env, year, month, day, type, minRank, limit) {
  const all = [];
  if (month && day) {
    // Specific date — just load that file
    const entries = await loadOTDFromFiles(month, day, env);
    for (const e of entries) {
      if (e.year === year && matchesType(e, type) && (e.rankScore || 0) >= minRank) {
        all.push(e);
      }
    }
  } else {
    // All dates — scan all 366 files (slow but works in dev)
    const fs = await import('fs/promises');
    const datesDir = env.OTD_DATES_DIR || '/tmp/otd-data-final/dates';
    try {
      const files = await fs.readdir(datesDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(`${datesDir}/${file}`, 'utf-8');
          const entries = JSON.parse(content);
          for (const e of entries) {
            if (e.year === year && matchesType(e, type) && (e.rankScore || e.rank_score || 0) >= minRank) {
              all.push(e);
            }
          }
        } catch (err) {
          // skip
        }
      }
    } catch (e) {
      // dir not found
    }
  }
  return all.slice(0, limit);
}

function matchesType(entry, type) {
  if (!type) return true;
  if (Array.isArray(type)) return type.includes(entry.type);
  return entry.type === type;
}

/**
 * GET /api/v1/year/{year}/timeline
 * Returns a year-spanning timeline of the most notable events
 * Used by /history/{year}/ pages
 */
export async function handleYearTimeline(env, year, request) {
  const url = new URL(request.url);
  const perMonth = Math.min(parseInt(url.searchParams.get('perMonth') || '1', 10), 5);

  const yearNum = parseInt(year, 10);
  if (!yearNum || yearNum < 1) {
    return json({ error: 'Invalid year' }, 400, YEAR_CACHE);
  }

  const months = {};
  for (let m = 1; m <= 12; m++) months[m] = [];

  // Load all events for this year
  let allEntries = [];
  if (useFileFallback(env)) {
    allEntries = await loadYearFromFiles(env, yearNum, null, null, 'event', 30, 500);
  } else {
    allEntries = await queryOTD(env.OTD_DB, {
      year: yearNum, type: 'event', rankMin: 30, limit: 500, verifiedOnly: false
    });
  }

  // Group by month
  for (const e of allEntries) {
    if (e.month && months[e.month]) {
      months[e.month].push(e);
    }
  }

  // Pick top N per month
  const timeline = Object.entries(months).map(([m, events]) => {
    const top = events.sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0)).slice(0, perMonth);
    return { month: parseInt(m, 10), total: events.length, top };
  });

  return json({
    year: yearNum,
    totalEvents: allEntries.length,
    timeline,
    attribution: attributionBlock()
  }, 200, YEAR_CACHE_LONG);
}

/**
 * Route registration
 */
export async function handle(env, path, request) {
  // GET /api/v1/year/{year}/timeline
  let m = path.match(/^\/api\/v1\/year\/(\d{1,4})\/timeline$/);
  if (m) {
    return handleYearTimeline(env, m[1], request);
  }

  // GET /api/v1/year/multi?years=1969,2001&month=7&day=20
  if (path === '/api/v1/year/multi' || path === '/api/v1/year/multi/') {
    return handleYearMulti(env, request);
  }

  // GET /api/v1/year/{year}?month=MM&day=DD
  m = path.match(/^\/api\/v1\/year\/(\d{1,4})$/);
  if (m) {
    return handleYear(env, m[1], request);
  }

  return null;
}

function json(data, status = 200, headers = YEAR_CACHE) {
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}
