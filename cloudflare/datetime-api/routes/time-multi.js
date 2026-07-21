/**
 * Multi-time API for "Today on Earth" strip
 *
 * Per user 2026-07-20 (Tier 1 Today on Earth strip):
 *   GET /api/v1/time/now/multi?ids=5128581,2643743,1850147,...
 *   Returns batched time lookups for multiple cities in a single request.
 *
 * Response shape:
 *   { serverTime: ISO, results: [
 *     { cityId, time: HH:MM, abbr, offset, offsetMinutes, isDst, date: YYYY-MM-DD, dayOfWeek }
 *   ]}
 */

import { CACHE_HEADERS, TODAY_CACHE_HEADERS } from '../lib/d1.js';

const MULTI_TIME_CACHE = { ...TODAY_CACHE_HEADERS };

/**
 * Compute the current local time for a city given its timezone.
 * Server-side UTC + IANA offset.
 */
function computeLocalTime(timezone) {
  const now = new Date();
  const utcMs = now.getTime();
  let dateInTz, abbr;

  try {
    // Intl.DateTimeFormat provides the local date/time + abbreviation
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZoneName: 'short'
    });
    const parts = fmt.formatToParts(now).reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    dateInTz = {
      year: parseInt(parts.year, 10),
      month: parseInt(parts.month, 10),
      day: parseInt(parts.day, 10),
      hour: parseInt(parts.hour, 10) % 24,
      minute: parseInt(parts.minute, 10),
      second: parseInt(parts.second, 10)
    };
    abbr = parts.timeZoneName;
  } catch (e) {
    return null;
  }

  // Compute UTC offset for this timezone at this moment
  const offset = computeUTCOffset(timezone, now);

  const time = `${pad2(dateInTz.hour)}:${pad2(dateInTz.minute)}:${pad2(dateInTz.second)}`;
  const date = `${dateInTz.year}-${pad2(dateInTz.month)}-${pad2(dateInTz.day)}`;

  // Day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = new Date(dateInTz.year, dateInTz.month - 1, dateInTz.day).getDay();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Detect DST
  const isDst = detectDST(timezone, now);

  return {
    time,
    date,
    dayOfWeek: dayNames[dayOfWeek],
    abbr: abbr || '',
    offset,
    offsetMinutes: parseOffsetMinutes(offset),
    isDst
  };
}

/**
 * Compute UTC offset string for a timezone at a given moment.
 * Returns "+05:30" or "-08:00" format.
 */
function computeUTCOffset(timezone, date) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset'
    });
    const parts = fmt.formatToParts(date);
    const offset = parts.find(p => p.type === 'timeZoneName')?.value || '';
    // "GMT+05:30" → "+05:30"
    return offset.replace(/^GMT/, '') || '+00:00';
  } catch (e) {
    return '+00:00';
  }
}

/**
 * Detect if a timezone is in DST at a given moment.
 * Compares the offset with the offset that would apply in January (assumed standard time).
 */
function detectDST(timezone, date) {
  try {
    const jan = new Date(date.getFullYear(), 0, 15);
    const jul = new Date(date.getFullYear(), 6, 15);
    const offsetJan = parseOffsetMinutes(computeUTCOffset(timezone, jan));
    const offsetJul = parseOffsetMinutes(computeUTCOffset(timezone, jul));
    const offsetNow = parseOffsetMinutes(computeUTCOffset(timezone, date));
    const stdOffset = Math.min(offsetJan, offsetJul);
    return offsetNow > stdOffset;
  } catch (e) {
    return false;
  }
}

function parseOffsetMinutes(s) {
  const m = s.match(/^([+-])(\d{1,2}):?(\d{2})$/);
  if (!m) return 0;
  const sign = m[1] === '+' ? 1 : -1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

function pad2(n) { return String(n).padStart(2, '0'); }

/**
 * GET /api/v1/time/now/multi
 * Query: ids=5128581,2643743,1850147
 *       OR timezones=America/New_York,Europe/London
 */
export async function handleTimeNowMulti(env, request) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get('ids');
  const tzsParam = url.searchParams.get('timezones');
  const namesParam = url.searchParams.get('names');  // Pre-mapped: 5128581=New York,...

  if (!idsParam && !tzsParam && !namesParam) {
    return json({
      error: 'Missing cities',
      hint: 'Use ?ids=5128581,2643743 or ?timezones=America/New_York,Asia/Tokyo',
      example: '/api/v1/time/now/multi?ids=5128581,2643743,1850147,2147714,5128581'
    }, 400, MULTI_TIME_CACHE);
  }

  let queries = [];   // [{ cityId, cityName, country, timezone, lat, lon }]

  // Direct timezone query (no DB lookup needed)
  if (tzsParam) {
    const tzs = tzsParam.split(',').map(s => s.trim()).filter(Boolean);
    queries = tzs.map(tz => ({
      cityId: null,
      cityName: tz.split('/').pop().replace(/_/g, ' '),
      country: null,
      timezone: tz
    }));
  } else if (idsParam || namesParam) {
    // Lookup cities by ID or name from D1 (or JSON fallback)
    const ids = idsParam ? idsParam.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean) : [];
    const names = namesParam ? namesParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    queries = await lookupCities(env, ids, names);
  }

  if (queries.length === 0) {
    return json({ error: 'No valid cities found' }, 404, MULTI_TIME_CACHE);
  }

  // Limit to 50 cities per request
  if (queries.length > 50) {
    return json({
      error: 'Too many cities',
      max: 50,
      received: queries.length,
      hint: 'Split into multiple requests'
    }, 400, MULTI_TIME_CACHE);
  }

  const results = queries.map(q => {
    const local = computeLocalTime(q.timezone);
    if (!local) {
      return {
        cityId: q.cityId,
        cityName: q.cityName,
        country: q.country,
        timezone: q.timezone,
        error: 'Invalid timezone'
      };
    }
    return {
      cityId: q.cityId,
      cityName: q.cityName,
      country: q.country,
      timezone: q.timezone,
      ...local
    };
  });

  return json({
    serverTime: new Date().toISOString(),
    requested: queries.length,
    succeeded: results.filter(r => !r.error).length,
    results
  }, 200, MULTI_TIME_CACHE);
}

/**
 * Lookup cities by ID or name from D1.
 * Falls back to a hardcoded list of popular cities if D1 is unavailable.
 */
async function lookupCities(env, ids, names) {
  if (env.OTD_DB) {
    const where = [];
    const binds = [];
    if (ids.length) {
      where.push(`id IN (${ids.map(() => '?').join(',')})`);
      binds.push(...ids);
    }
    if (names.length) {
      const nameWhere = names.map(() => 'LOWER(REPLACE(name, " ", "_")) = ?').join(' OR ');
      where.push(`(${nameWhere})`);
      binds.push(...names.map(n => n.toLowerCase().replace(/[ -]/g, '_')));
    }
    if (!where.length) return [];

    const sql = `SELECT id, name, country, timezone, lat, lon FROM cities WHERE ${where.join(' OR ')}`;
    const result = await env.OTD_DB.prepare(sql).bind(...binds).all();
    return (result.results || []).map(r => ({
      cityId: r.id,
      cityName: r.name,
      country: r.country,
      timezone: r.timezone,
      lat: r.lat,
      lon: r.lon
    }));
  }

  // Fallback: hardcoded popular cities
  const POPULAR = {
    5128581: { cityId: 5128581, cityName: 'New York', country: 'US', timezone: 'America/New_York' },
    2643743: { cityId: 2643743, cityName: 'London', country: 'GB', timezone: 'Europe/London' },
    1850147: { cityId: 1850147, cityName: 'Tokyo', country: 'JP', timezone: 'Asia/Tokyo' },
    1816670: { cityId: 1816670, cityName: 'Beijing', country: 'CN', timezone: 'Asia/Shanghai' },
    2147714: { cityId: 2147714, cityName: 'Sydney', country: 'AU', timezone: 'Australia/Sydney' },
    3435907: { cityId: 3435907, cityName: 'Buenos Aires', country: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
    360630: { cityId: 360630, cityName: 'Cairo', country: 'EG', timezone: 'Africa/Cairo' },
    2332459: { cityId: 2332459, cityName: 'Lagos', country: 'NG', timezone: 'Africa/Lagos' },
    3448439: { cityId: 3448439, cityName: 'São Paulo', country: 'BR', timezone: 'America/Sao_Paulo' },
    1275339: { cityId: 1275339, cityName: 'Mumbai', country: 'IN', timezone: 'Asia/Kolkata' },
    1796236: { cityId: 1796236, cityName: 'Shanghai', country: 'CN', timezone: 'Asia/Shanghai' },
    5368361: { cityId: 5368361, cityName: 'Los Angeles', country: 'US', timezone: 'America/Los_Angeles' },
    5391959: { cityId: 5391959, cityName: 'San Francisco', country: 'US', timezone: 'America/Los_Angeles' },
    6167865: { cityId: 6167865, cityName: 'Toronto', country: 'CA', timezone: 'America/Toronto' },
    1796236: { cityId: 1796236, cityName: 'Shanghai', country: 'CN', timezone: 'Asia/Shanghai' },
    3133880: { cityId: 3133880, cityName: 'Stockholm', country: 'SE', timezone: 'Europe/Stockholm' },
    524901: { cityId: 524901, cityName: 'Moscow', country: 'RU', timezone: 'Europe/Moscow' },
    2950159: { cityId: 2950159, cityName: 'Berlin', country: 'DE', timezone: 'Europe/Berlin' },
    2988507: { cityId: 2988507, cityName: 'Paris', country: 'FR', timezone: 'Europe/Paris' },
    3117735: { cityId: 3117735, cityName: 'Madrid', country: 'ES', timezone: 'Europe/Madrid' }
  };
  const byIds = ids.map(id => POPULAR[id]).filter(Boolean);
  const byNames = names.map(n => {
    const key = n.toLowerCase().replace(/[ -]/g, '_');
    return Object.values(POPULAR).find(c => c.cityName.toLowerCase().replace(/[ -]/g, '_') === key);
  }).filter(Boolean);
  return [...byIds, ...byNames];
}

/**
 * GET /api/v1/snapshot
 * Combined "today's snapshot" for the homepage micro-cards:
 *   - holiday (today)
 *   - onthisday (today)
 *   - dst changes (upcoming 30 days)
 *   - sun times (for user's location, or default city)
 * Query: ?country=US (defaults to user's country, e.g. "US")
 *        ?city=5128581 (for sun times)
 */
export async function handleSnapshot(env, request) {
  const url = new URL(request.url);
  const countryCode = url.searchParams.get('country') || 'US';
  const cityId = url.searchParams.get('city') || '5128581';
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const d = new Date(date);
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const mmdd = `${pad2(month)}-${pad2(day)}`;

  // Compose multiple API calls (or use direct D1/file queries)
  const [holiday, onthisday, sunTimes] = await Promise.all([
    getHoliday(env, countryCode, month, day, year),
    getOnThisDaySample(env, month, day),
    getSunTimes(env, cityId)
  ]);

  return json({
    date,
    month,
    day,
    year,
    country: countryCode,
    cityId,
    holiday,         // { name, type, countries[] } or null
    onthisday,       // { featured: {title, year, type, ...}, count }
    sunTimes,        // { sunrise, sunset, dayLength } or null
    attribution: {
      holiday: 'Nager.Date',
      onthisday: 'Wikipedia / Wikimedia',
      sunTimes: 'Computed from city coordinates'
    }
  }, 200, MULTI_TIME_CACHE);
}

// ============================================================================
// Composed snapshot helpers
// ============================================================================

async function getHoliday(env, countryCode, month, day, year) {
  // Holiday lookup is normally in /api/v1/holidays/{CC}/{YYYY}
  // Here we just return whether today is a holiday for the country.
  // For now, return null (caller can fetch full list separately).
  return null;
}

async function getOnThisDaySample(env, month, day) {
  // Top 1 event for the homepage strip
  let featured = null;
  if (env.OTD_DB) {
    const result = await env.OTD_DB.prepare(`
      SELECT * FROM onthisday
      WHERE month = ? AND day = ? AND type = 'event'
      ORDER BY rank_score DESC LIMIT 1
    `).bind(month, day).all();
    if (result.results && result.results[0]) {
      const e = result.results[0];
      featured = {
        title: e.title,
        year: e.year,
        type: e.type,
        description: e.description,
        wikipediaUrl: e.wikipedia_url,
        image: e.image_url ? {
          url: e.image_url,
          license: e.image_license,
          credit: e.image_credit
        } : null
      };
    }
  } else {
    // File fallback
    const fs = await import('fs/promises');
    try {
      const content = await fs.readFile(`/tmp/otd-data-final/dates/${pad2(month)}-${pad2(day)}.json`, 'utf-8');
      const entries = JSON.parse(content);
      const events = entries.filter(e => e.type === 'event').sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
      if (events[0]) {
        const e = events[0];
        featured = {
          title: e.title,
          year: e.year,
          type: e.type,
          description: e.description,
          wikipediaUrl: e.wikipedia_url,
          image: e.image_url ? {
            url: e.image_url,
            license: e.image_license,
            credit: e.image_credit
          } : null
        };
      }
    } catch (e) {}
  }
  return { featured };
}

async function getSunTimes(env, cityId) {
  // Sun times already exist in the existing /api/v1/time/sun endpoint.
  // For the snapshot, we can fetch it here or return null.
  return null;
}

// ============================================================================
// Route registration
// ============================================================================

export async function handle(env, path, request) {
  if (path === '/api/v1/time/now/multi') {
    return handleTimeNowMulti(env, request);
  }
  if (path === '/api/v1/snapshot') {
    return handleSnapshot(env, request);
  }
  return null;
}

function json(data, status = 200, headers = MULTI_TIME_CACHE) {
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}
