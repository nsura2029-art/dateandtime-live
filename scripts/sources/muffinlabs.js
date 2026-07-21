/**
 * Muffin Labs history.muffinlabs.com on-this-day cross-check connector
 *
 * Free mirror of Wikipedia day pages. No auth required.
 *
 * License: CC BY-SA 4.0 (per Wikipedia source)
 * https://creativecommons.org/licenses/by-sa/4.0/
 *
 * Per Blueprint Ch 5 + Prompt A: this is a CROSS-CHECK source.
 * Returns ~60 events, 217 births, 117 deaths per day.
 *
 * URL: https://history.muffinlabs.com/date/{M}/{D} (no zero-padding)
 */

const MUFFIN_BASE = 'https://history.muffinlabs.com/date';
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
        const wait = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[muffinlabs] 429 rate-limited, waiting ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        console.warn(`[muffinlabs] HTTP ${res.status} on ${url}`);
        return null;
      }
      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[muffinlabs] fetch failed for ${url}: ${err.message}`);
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
    console.warn(`[muffinlabs] JSON parse failed for ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Get all data for a single day.
 * URL: https://history.muffinlabs.com/date/7/20 (no zero-padding)
 * Response shape:
 *   {
 *     date: "July 20",
 *     url: "https://en.wikipedia.org/wiki/July_20",
 *     data: {
 *       Events: [{year, text, html, links: [...]}],
 *       Births: [...],
 *       Deaths: [...]
 *     }
 *   }
 * @param {number} month
 * @param {number} day
 * @returns {Promise<object|null>}
 */
async function getDay(month, day) {
  const url = `${MUFFIN_BASE}/${month}/${day}`;
  return await fetchJson(url);
}

/**
 * Fetch and normalize all muffinlabs entries for a single day.
 * @param {number} month
 * @param {number} day
 * @returns {Promise<{events, births, deaths, source}>}
 */
async function fetchOnThisDayEntries(month, day) {
  const data = await getDay(month, day);
  if (!data || !data.data) {
    return { events: [], births: [], deaths: [], source: 'muffinlabs' };
  }

  return {
    events: (data.data.Events || []).map(e => normalizeItem(e, 'event', month, day, data.url)),
    births: (data.data.Births || []).map(b => normalizeItem(b, 'birth', month, day, data.url)),
    deaths: (data.data.Deaths || []).map(d => normalizeItem(d, 'death', month, day, data.url)),
    source: 'muffinlabs',
    wikipedia_url: data.url
  };
}

/**
 * Normalize a muffinlabs item to our onthisday schema (011-compatible).
 * Schema reference:
 *   {year, text, html, links: [{Title, DisplayTitle, Url}]}
 *   Note: muffinlabs format is HTML-stripped text + wiki link array.
 * @param {object} item - muffinlabs raw item
 * @param {string} type - 'event' | 'birth' | 'death'
 * @param {number} month
 * @param {number} day
 * @param {string} dayUrl - the day's Wikipedia URL (e.g. https://en.wikipedia.org/wiki/July_20)
 * @returns {object} Normalized entry
 */
function normalizeItem(item, type, month, day, dayUrl) {
  const year = item.year || 0;
  const text = item.text || '';
  const links = item.links || [];
  const firstLink = links[0] || {};

  // Title: first sentence
  const title = (firstLink.DisplayTitle || text.split('.')[0] || text)
    .replace(/<[^>]+>/g, '')
    .trim()
    .slice(0, 200);

  return {
    title,
    description: text.replace(/<[^>]+>/g, '').trim(),
    year,
    month,
    day,
    type,
    category: type === 'birth' ? 'births' : type === 'death' ? 'deaths' : 'events',
    importance: links.length > 1 ? 3 : 2,
    wikipedia_url: firstLink.Url ? `https://en.wikipedia.org/wiki/${firstLink.Url}` : dayUrl,
    wikipedia_title: firstLink.Title || null,
    wikidata_id: null,
    image_url: null,           // muffinlabs doesn't include images
    image_alt: null,
    image_status: 'missing',
    image_license: null,
    image_credit: null,
    image_source_url: dayUrl,
    language: 'en',
    data_sources: JSON.stringify([{
      name: 'muffinlabs',
      url: `${MUFFIN_BASE}/${month}/${day}`,
      retrieved_at: new Date().toISOString().split('T')[0],
      license: 'CC BY-SA 4.0',
      license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attribution_required: 1
    }]),
    verified_in: JSON.stringify(['muffinlabs']),
    verified: 0,
    rank_score: 0,
    sitelinks: 0,
    pageviews_30d_avg: 0,
    inbound_links: 0,
    notability_source: 'pending'
  };
}

module.exports = {
  getDay,
  fetchOnThisDayEntries,
  normalizeItem,
  MUFFIN_BASE,
  USER_AGENT
};
