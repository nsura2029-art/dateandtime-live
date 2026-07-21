/**
 * byabbe.se on-this-day cross-check connector
 *
 * Free mirror of the Wikimedia Feed API. No auth required, no rate limit
 * enforced (be a good citizen and stay under 5 req/s).
 *
 * License: CC BY-SA 4.0 (per Wikimedia source)
 * https://creativecommons.org/licenses/by-sa/4.0/
 *
 * Per Blueprint Ch 5 + Prompt A: this is a CROSS-CHECK source.
 * Rows present in 2+ sources = "verified"; only this source = "review".
 *
 * Source: https://byabbe.se/on-this-day/{M}/{D}/events.json (no zero-padding)
 */

const BYABBE_BASE = 'https://byabbe.se/on-this-day';
const USER_AGENT = 'DateAndTime-Live/1.0 (https://dateandtime.live; contact@dateandtime.live)';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const MAX_REQUESTS_PER_SECOND = 5;

let lastRequestTime = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function throttle() {
  const elapsed = Date.now() - lastRequestTime;
  const minInterval = 1000 / MAX_REQUESTS_PER_SECOND;
  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed);
  }
  lastRequestTime = Date.now();
}

async function fetchText(url, opts = {}) {
  const retries = opts.retries ?? MAX_RETRIES;
  for (let attempt = 1; attempt <= retries; attempt++) {
    await throttle();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
      });
      if (res.status === 404) return null;
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
        const wait = retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[byabbe] 429 rate-limited, waiting ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        console.warn(`[byabbe] HTTP ${res.status} on ${url}`);
        return null;
      }
      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[byabbe] fetch failed for ${url}: ${err.message}`);
        return null;
      }
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
  return null;
}

async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, opts);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn(`[byabbe] JSON parse failed for ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Get events for a single day.
 * URL: https://byabbe.se/on-this-day/7/20/events.json (no zero-padding!)
 * @param {number} month - 1-12 (no zero-padding)
 * @param {number} day - 1-31 (no zero-padding)
 * @returns {Promise<{events: Array, date: string, wikipedia_url: string}>}
 */
async function getEvents(month, day) {
  const url = `${BYABBE_BASE}/${month}/${day}/events.json`;
  const data = await fetchJson(url);
  if (!data) return null;
  return {
    events: data.events || [],
    date: data.date,
    wikipedia_url: data.wikipedia_url
  };
}

/**
 * Get births for a single day.
 * URL: https://byabbe.se/on-this-day/7/20/births.json
 * @param {number} month
 * @param {number} day
 * @returns {Promise<{births: Array, date: string, wikipedia_url: string}>}
 */
async function getBirths(month, day) {
  const url = `${BYABBE_BASE}/${month}/${day}/births.json`;
  const data = await fetchJson(url);
  if (!data) return null;
  return {
    births: data.births || [],
    date: data.date,
    wikipedia_url: data.wikipedia_url
  };
}

/**
 * Get deaths for a single day.
 * URL: https://byabbe.se/on-this-day/7/20/deaths.json
 * @param {number} month
 * @param {number} day
 * @returns {Promise<{deaths: Array, date: string, wikipedia_url: string}>}
 */
async function getDeaths(month, day) {
  const url = `${BYABBE_BASE}/${month}/${day}/deaths.json`;
  const data = await fetchJson(url);
  if (!data) return null;
  return {
    deaths: data.deaths || [],
    date: data.date,
    wikipedia_url: data.wikipedia_url
  };
}

/**
 * Fetch all 3 types in parallel for a single day.
 * Returns 366 days × 3 calls = 1,098 requests for full coverage.
 * @param {number} month
 * @param {number} day
 * @returns {Promise<{events, births, deaths, source: 'byabbe'}>}
 */
async function getAll(month, day) {
  const [events, births, deaths] = await Promise.all([
    getEvents(month, day).catch(() => null),
    getBirths(month, day).catch(() => null),
    getDeaths(month, day).catch(() => null)
  ]);

  return {
    events: events?.events || [],
    births: births?.births || [],
    deaths: deaths?.deaths || [],
    source: 'byabbe',
    wikipedia_url: events?.wikipedia_url || births?.wikipedia_url || deaths?.wikipedia_url
  };
}

/**
 * Normalize a byabbe event/birth/death to our onthisday schema (011-compatible).
 * Schema reference:
 *   {year, description, wikipedia: [{title, content_urls, ...}], lang}
 *   Note: byabbe uses a different shape than Wikimedia Feed.
 * @param {object} item - byabbe raw item
 * @param {string} type - 'event' | 'birth' | 'death'
 * @param {number} month
 * @param {number} day
 * @returns {object} Normalized entry
 */
function normalizeItem(item, type, month, day) {
  const year = item.year || 0;
  const description = item.description || '';
  const wikipedia = item.wikipedia || [];
  const firstWp = wikipedia[0] || {};

  // Extract Wikipedia URL
  const wikiUrl = null;  // byabbe doesn't include content_urls

  // Title: first sentence up to em-dash
  const titleMatch = description.match(/^([^—]+)—\s*(.+)/);
  let title = '';
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else {
    title = description.split('.')[0].slice(0, 200);
  }

  return {
    title: title.slice(0, 200),
    description: description.trim(),
    year,
    month,
    day,
    type,
    category: type === 'birth' ? 'births' : type === 'death' ? 'deaths' : 'events',
    importance: wikipedia.length > 1 ? 3 : 2,
    wikipedia_url: wikiUrl,
    wikipedia_title: firstWp.title || null,
    wikidata_id: null,
    image_url: null,           // byabbe doesn't include images
    image_alt: null,
    image_status: 'missing',
    image_license: null,
    image_credit: null,
    image_source_url: null,
    language: 'en',
    data_sources: JSON.stringify([{
      name: 'byabbe',
      url: `${BYABBE_BASE}/${month}/${day}/${type}s.json`,
      retrieved_at: new Date().toISOString().split('T')[0],
      license: 'CC BY-SA 4.0',
      license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attribution_required: 1
    }]),
    verified_in: JSON.stringify(['byabbe']),
    verified: 0,
    rank_score: 0,
    sitelinks: 0,
    pageviews_30d_avg: 0,
    inbound_links: 0,
    notability_source: 'pending'
  };
}

/**
 * Fetch and normalize all byabbe entries for a single day.
 * @param {number} month
 * @param {number} day
 * @returns {Promise<{events, births, deaths, source}>}
 */
async function fetchOnThisDayEntries(month, day) {
  const data = await getAll(month, day);
  return {
    events: data.events.map(e => normalizeItem(e, 'event', month, day)),
    births: data.births.map(b => normalizeItem(b, 'birth', month, day)),
    deaths: data.deaths.map(d => normalizeItem(d, 'death', month, day)),
    source: 'byabbe'
  };
}

module.exports = {
  getEvents,
  getBirths,
  getDeaths,
  getAll,
  fetchOnThisDayEntries,
  normalizeItem,
  BYABBE_BASE,
  USER_AGENT
};
