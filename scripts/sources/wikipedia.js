/**
 * Wikipedia / Wikimedia Feed API Connector (canonical)
 *
 * Uses the canonical Wikimedia Feed API at api.wikimedia.org/feed/v1/wikipedia
 * for "On this day" data. Falls back to en.wikipedia.org/api/rest_v1 if the
 * canonical feed is unavailable.
 *
 * Per Blueprint Prompt A (ingestion crawler):
 *   - User-Agent policy enforced by WMF (https://meta.wikimedia.org/wiki/User-Agent_policy)
 *   - Rate limits: 500 req/h anonymous, 5,000 req/h with personal token
 *   - Exponential backoff honoring Retry-After (429 throttling)
 *   - All 5 endpoints: events, births, deaths, holidays, selected, all
 *
 * License: CC BY-SA 4.0 (attribution required)
 * https://creativecommons.org/licenses/by-sa/4.0/
 *
 * Source: Blueprint Ch 5 (free data sources) + Prompt A
 */

const CANONICAL_FEED_BASE = 'https://api.wikimedia.org/feed/v1/wikipedia/en';
const LEGACY_FEED_BASE = 'https://en.wikipedia.org/api/rest_v1';
const LEGACY_MW_API = 'https://en.wikipedia.org/w/api.php';

// WMF requires a contact-bearing User-Agent on every request.
// Generic UAs get 429-throttled. Include app name, version, URL, contact.
const USER_AGENT = 'DateAndTime-Live/1.0 (https://dateandtime.live; contact@dateandtime.live)';

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_REQUESTS_PER_SECOND = 5;   // WMF soft limit
const HOURLY_BUDGET = 450;            // leave headroom under 500/h

// In-memory rate limiter (token bucket per second + hourly counter)
let lastRequestTime = 0;
let hourlyCount = 0;
let hourlyResetAt = Date.now() + 3600_000;

/**
 * Sleep helper.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Throttle to MAX_REQUESTS_PER_SECOND using a token bucket.
 * Also enforces an hourly budget.
 */
async function throttle() {
  // Hourly check
  const now = Date.now();
  if (now > hourlyResetAt) {
    hourlyCount = 0;
    hourlyResetAt = now + 3600_000;
  }
  if (hourlyCount >= HOURLY_BUDGET) {
    const waitMs = hourlyResetAt - now;
    console.warn(`[wikipedia] Hourly budget exhausted (${HOURLY_BUDGET}), waiting ${Math.ceil(waitMs / 1000)}s`);
    await sleep(waitMs);
    hourlyCount = 0;
    hourlyResetAt = Date.now() + 3600_000;
  }

  // Per-second throttling
  const elapsed = now - lastRequestTime;
  const minInterval = 1000 / MAX_REQUESTS_PER_SECOND;
  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed);
  }
  lastRequestTime = Date.now();
  hourlyCount++;
}

/**
 * Generic fetch with retries, exponential backoff, and Retry-After honoring.
 * @param {string} url
 * @param {object} opts - {retries, fetchTimeout}
 * @returns {Promise<string|null>}
 */
async function fetchText(url, opts = {}) {
  const retries = opts.retries ?? MAX_RETRIES;
  const timeout = opts.fetchTimeout ?? 30_000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    await throttle();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Api-User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // 404: resource doesn't exist, return null immediately
      if (res.status === 404) return null;

      // 429: rate limited, honor Retry-After
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[wikipedia] 429 rate-limited on ${url}, waiting ${waitMs}ms (attempt ${attempt}/${retries})`);
        await sleep(waitMs);
        continue;
      }

      // 5xx: server error, retry with backoff
      if (res.status >= 500) {
        const waitMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[wikipedia] ${res.status} on ${url}, retry in ${waitMs}ms (attempt ${attempt}/${retries})`);
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        console.warn(`[wikipedia] HTTP ${res.status} on ${url}`);
        return null;
      }

      return await res.text();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn(`[wikipedia] timeout (${timeout}ms) on ${url} (attempt ${attempt}/${retries})`);
      } else if (attempt === retries) {
        console.warn(`[wikipedia] fetch failed for ${url}: ${err.message}`);
        return null;
      }
      const waitMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(waitMs);
    }
  }
  return null;
}

/**
 * Generic JSON fetch with retries.
 */
async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, opts);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn(`[wikipedia] JSON parse failed for ${url}: ${err.message}`);
    return null;
  }
}

// ============================================================================
// CANONICAL FEED API (api.wikimedia.org/feed/v1/wikipedia)
// Per Blueprint Ch 5 + Prompt A
// ============================================================================

/**
 * Get one "On this day" type for a day via the canonical feed.
 * @param {string} type - 'events' | 'births' | 'deaths' | 'holidays' | 'selected'
 * @param {number|string} lang - 'en' (default), 'pt', 'es', etc.
 * @param {number} month - 1-12
 * @param {number} day - 1-31
 * @returns {Promise<object|null>}
 */
async function getOnThisDay(type, month, day, lang = 'en') {
  if (!['events', 'births', 'deaths', 'holidays', 'selected'].includes(type)) {
    throw new Error(`Invalid type: ${type}`);
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const url = `${CANONICAL_FEED_BASE.replace('/en', '/' + lang)}/onthisday/${type}/${mm}/${dd}`;
  return await fetchJson(url);
}

/**
 * Get ALL "On this day" types for a day in one call (canonical feed `/all` endpoint).
 * Most efficient — single request returns events, births, deaths, holidays, selected.
 * @param {number} month
 * @param {number} day
 * @param {string} lang
 * @returns {Promise<object|null>}
 */
async function getOnThisDayAllCanonical(month, day, lang = 'en') {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const url = `${CANONICAL_FEED_BASE.replace('/en', '/' + lang)}/onthisday/all/${mm}/${dd}`;
  return await fetchJson(url);
}

/**
 * Get all "On this day" types with fallback to legacy rest_v1 if canonical fails.
 * Per Prompt A, canonical is preferred; legacy is the safety net.
 * @param {number} month
 * @param {number} day
 * @param {string} lang
 * @returns {Promise<{events, births, deaths, holidays, selected, source: 'canonical'|'legacy'}>}
 */
async function getOnThisDayAll(month, day, lang = 'en') {
  // Try canonical first
  const canonical = await getOnThisDayAllCanonical(month, day, lang);
  if (canonical) {
    return {
      events: canonical.events,
      births: canonical.births,
      deaths: canonical.deaths,
      holidays: canonical.holidays,
      selected: canonical.selected,
      source: 'canonical'
    };
  }

  // Fallback to legacy rest_v1
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const base = LEGACY_FEED_BASE;
  const [events, births, deaths, holidays, selected] = await Promise.all([
    fetchJson(`${base}/feed/onthisday/events/${mm}/${dd}`).catch(() => null),
    fetchJson(`${base}/feed/onthisday/births/${mm}/${dd}`).catch(() => null),
    fetchJson(`${base}/feed/onthisday/deaths/${mm}/${dd}`).catch(() => null),
    fetchJson(`${base}/feed/onthisday/holidays/${mm}/${dd}`).catch(() => null),
    fetchJson(`${base}/feed/onthisday/selected/${mm}/${dd}`).catch(() => null)
  ]);

  return { events, births, deaths, holidays, selected, source: 'legacy' };
}

// ============================================================================
// ARTICLE-LEVEL APIs (used for descriptions, images, long-form content)
// ============================================================================

/**
 * Get article summary (canonical).
 * @param {string} title
 * @param {string} lang
 * @returns {Promise<object|null>}
 */
async function getSummary(title, lang = 'en') {
  if (!title) return null;
  const url = `${CANONICAL_FEED_BASE.replace('/en', '/' + lang)}/page/summary/${encodeURIComponent(title)}`;
  return await fetchJson(url);
}

/**
 * Get full article HTML (canonical).
 * @param {string} title
 * @param {string} lang
 * @returns {Promise<string|null>}
 */
async function getHtml(title, lang = 'en') {
  if (!title) return null;
  const url = `${CANONICAL_FEED_BASE.replace('/en', '/' + lang)}/page/html/${encodeURIComponent(title)}`;
  return await fetchText(url);
}

/**
 * Get plain-text extract via MediaWiki API.
 * Used for long_description (per Schema 011 — separate from short description).
 * @param {string} title
 * @param {string} lang
 * @param {number} chars - target length (default 1500)
 * @returns {Promise<string|null>}
 */
async function getExtract(title, lang = 'en', chars = 1500) {
  if (!title) return null;
  const url = `${LEGACY_MW_API}?action=query&prop=extracts&explaintext=1&exchars=${chars}&titles=${encodeURIComponent(title)}&format=json`;
  const data = await fetchJson(url);
  if (!data?.query?.pages) return null;
  const pages = Object.values(data.query.pages);
  return pages[0]?.extract || null;
}

/**
 * Search Wikipedia for an article by query.
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function search(query, limit = 10) {
  if (!query) return [];
  const url = `${LEGACY_MW_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&format=json`;
  const data = await fetchJson(url);
  if (!data || !Array.isArray(data) || data.length < 4) return [];
  const [, titles, descriptions, urls] = data;
  if (!titles || !urls) return [];
  return titles.map((title, i) => ({
    title,
    description: descriptions?.[i],
    url: urls?.[i]
  }));
}

/**
 * Get the Wikipedia article title from a Wikipedia URL.
 * @param {string} wikipediaUrl
 * @returns {string|null}
 */
function extractTitle(wikipediaUrl) {
  if (!wikipediaUrl) return null;
  const match = wikipediaUrl.match(/\/wiki\/(.+?)(?:#|$|\?)/);
  if (!match) return null;
  return decodeURIComponent(match[1]).replace(/_/g, ' ');
}

/**
 * Get the language code from a Wikipedia URL (e.g. en.wikipedia.org → 'en').
 * @param {string} wikipediaUrl
 * @returns {string|null}
 */
function extractLang(wikipediaUrl) {
  if (!wikipediaUrl) return null;
  const match = wikipediaUrl.match(/^https?:\/\/([a-z-]+)\.wikipedia\.org/);
  return match ? match[1] : null;
}

// ============================================================================
// FEED → OTD SCHEMA NORMALIZATION
// ============================================================================

/**
 * Map Wikipedia "On this day" type to our internal category.
 */
function typeToCategory(type) {
  const map = {
    'event': 'events',
    'birth': 'births',
    'death': 'deaths',
    'wedding': 'events',
    'divorce': 'events',
    'bizarre': 'events',
    'anniversary': 'events',
    'holiday': 'events'
  };
  return map[type] || 'events';
}

/**
 * Build the standard data_sources JSON array for a row pulled from the canonical feed.
 * Per Blueprint Risk #1: every row needs provenance.
 * @param {string} sourceName
 * @param {number} month
 * @param {number} day
 * @param {string} lang
 * @returns {string} JSON string
 */
function buildDataSources(sourceName, month, day, lang = 'en') {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const baseUrl = sourceName === 'wikipedia_feed'
    ? `https://api.wikimedia.org/feed/v1/wikipedia/${lang}/onthisday/all/${mm}/${dd}`
    : `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm}/${dd}`;

  return JSON.stringify([{
    name: sourceName,
    url: baseUrl,
    retrieved_at: new Date().toISOString().split('T')[0],
    license: 'CC BY-SA 4.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution_required: 1
  }]);
}

/**
 * Normalize a single "On this day" feed item to our onthisday schema (011-compatible).
 * @param {object} item - Raw feed item {year, text, pages, ...}
 * @param {string} type - 'event' | 'birth' | 'death' | 'holiday' | 'wedding' | etc.
 * @param {number} month
 * @param {number} day
 * @param {string} lang
 * @param {string} sourceName - 'wikipedia_feed' (canonical) or 'wikipedia_rest' (legacy)
 * @returns {object} Normalized entry
 */
function normalizeFeedItem(item, type, month, day, lang = 'en', sourceName = 'wikipedia_feed') {
  const year = item.year || 0;
  const text = item.text || '';
  const pages = item.pages || [];

  // First page typically has the main image
  const firstPage = pages[0] || {};

  // SKIP fair-use thumbnails: identifiable by /wikipedia/en/ path prefix
  // (per Blueprint Ch 6: "Never hotlink them")
  let imageUrl = firstPage.thumbnail?.source || null;
  if (imageUrl && imageUrl.includes('/wikipedia/en/')) {
    imageUrl = null;
  }

  const wikiUrl = firstPage.content_urls?.desktop?.page || null;
  const wikiTitle = firstPage.title || null;

  // Split title from description (feed text often starts with the year + bolded name)
  // e.g. "1969 — The Apollo 11 lunar module Eagle lands on the Moon."
  const title = (firstPage.displaytitle || text.split('—')[0] || text)
    .replace(/<[^>]+>/g, '')   // strip HTML
    .trim()
    .slice(0, 200);

  return {
    title,
    description: text.replace(/<[^>]+>/g, '').trim(),
    year,
    month,
    day,
    type,
    category: typeToCategory(type),
    importance: pages.length > 1 ? 3 : 2,
    wikipedia_url: wikiUrl,
    wikipedia_title: wikiTitle,
    wikidata_id: null,   // filled in by QLever enrichment pass
    image_url: imageUrl,
    image_alt: text.slice(0, 200),
    image_status: imageUrl ? 'wikipedia' : 'missing',
    image_license: imageUrl ? 'CC BY-SA 4.0' : null,
    image_credit: null,   // filled in from Commons extmetadata
    image_source_url: wikiUrl,
    language: lang,
    data_sources: buildDataSources(sourceName, month, day, lang),
    verified_in: JSON.stringify([sourceName]),
    verified: 0,          // single source, not cross-verified
    rank_score: 0,        // filled in by notability scoring
    sitelinks: 0,
    pageviews_30d_avg: 0,
    inbound_links: 0,
    notability_source: 'pending'
  };
}

/**
 * Fetch and normalize all "On this day" entries for a single day.
 * @param {number} month
 * @param {number} day
 * @param {string} lang
 * @returns {Promise<{events, births, deaths, holidays, selected, source}>}
 */
async function fetchOnThisDayEntries(month, day, lang = 'en') {
  const data = await getOnThisDayAll(month, day, lang);
  const sourceName = data.source === 'canonical' ? 'wikipedia_feed' : 'wikipedia_rest';

  // Handle both shapes: canonical (/all) returns flat arrays,
  // legacy returns nested objects with type-keyed arrays.
  const eventsArr = Array.isArray(data.events) ? data.events : (data.events?.events || []);
  const birthsArr = Array.isArray(data.births) ? data.births : (data.births?.births || []);
  const deathsArr = Array.isArray(data.deaths) ? data.deaths : (data.deaths?.deaths || []);
  const holidaysArr = Array.isArray(data.holidays) ? data.holidays : (data.holidays?.holidays || []);
  const selectedArr = Array.isArray(data.selected) ? data.selected : (data.selected?.selected || []);

  const normalize = (item, type) =>
    normalizeFeedItem(item, type, month, day, lang, sourceName);

  return {
    events: eventsArr.map(e => normalize(e, 'event')),
    births: birthsArr.map(b => normalize(b, 'birth')),
    deaths: deathsArr.map(d => normalize(d, 'death')),
    holidays: holidaysArr.map(h => normalize(h, 'holiday')),
    selected: selectedArr.map(s => normalize(s, 'event')),
    source: data.source
  };
}

/**
 * List of languages available on the Wikimedia Feed (per Blueprint Ch 5).
 * Source: https://en.wikipedia.org/api/rest_v1/feed/availability
 * Returns 14 languages.
 */
const AVAILABLE_LANGUAGES = [
  'en', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'sv', 'uk', 'fa', 'he', 'ar', 'hi'
];

/**
 * Get rate limit status (for monitoring/diagnostics).
 */
function getRateLimitStatus() {
  return {
    hourlyCount,
    hourlyBudget: HOURLY_BUDGET,
    hourlyResetIn: Math.max(0, hourlyResetAt - Date.now()),
    requestsPerSecond: MAX_REQUESTS_PER_SECOND
  };
}

module.exports = {
  // Canonical feed API (preferred)
  getOnThisDay,
  getOnThisDayAllCanonical,
  getOnThisDayAll,
  fetchOnThisDayEntries,

  // Article-level APIs
  getSummary,
  getHtml,
  getExtract,
  search,
  extractTitle,
  extractLang,

  // Normalization
  normalizeFeedItem,
  typeToCategory,
  buildDataSources,

  // Constants
  AVAILABLE_LANGUAGES,
  USER_AGENT,
  CANONICAL_FEED_BASE,

  // Diagnostics
  getRateLimitStatus,

  // Low-level (for tests)
  fetchJson,
  fetchText,
  throttle
};
