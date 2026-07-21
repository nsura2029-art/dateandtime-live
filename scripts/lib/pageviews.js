/**
 * Wikimedia Pageviews API connector
 *
 * Per Blueprint Ch 5: trailing-90-day average per entity.
 * Used in notability scoring formula.
 *
 * URL: https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{lang}.wikipedia/all-access/all-agents/{title}/daily/{start}/{end}
 *
 * License: CC BY-SA 4.0
 * Rate limit: 500 req/h (anonymous), 5,000 req/h (token)
 */

const PAGEVIEWS_BASE = 'https://wikimedia.org/api/rest_v1/metrics/pageviews';
const USER_AGENT = 'DateAndTime-Live/1.0 (https://dateandtime.live; contact@dateandtime.live)';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const TIMEOUT_MS = 30_000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, opts = {}) {
  const retries = opts.retries ?? MAX_RETRIES;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.status === 404) return null;
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
        const wait = retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`Pageviews HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[pageviews] fetch failed: ${err.message}`);
        return null;
      }
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
  return null;
}

/**
 * Get daily pageviews for a single article.
 * @param {string} title - Wikipedia article title (e.g. "Apollo_11")
 * @param {string} lang - 'en' (default)
 * @param {string} start - ISO date (YYYYMMDD)
 * @param {string} end - ISO date (YYYYMMDD)
 * @returns {Promise<Array<{timestamp, views}>|null>}
 */
async function getPageviews(title, lang = 'en', start, end) {
  const encodedTitle = encodeURIComponent(title);
  const url = `${PAGEVIEWS_BASE}/per-article/${lang}.wikipedia/all-access/all-agents/${encodedTitle}/daily/${start}/${end}`;
  const data = await fetchJson(url);
  return data?.items || null;
}

/**
 * Compute the trailing-90-day average for an article.
 * @param {string} title
 * @param {string} lang
 * @returns {Promise<number|null>} avg daily views, or null if not found
 */
async function getTrailingAverage(title, lang = 'en', days = 90) {
  const today = new Date();
  const start = new Date(today.getTime() - days * 86400_000);
  const startStr = start.toISOString().slice(0, 10).replace(/-/g, '');
  const endStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const items = await getPageviews(title, lang, startStr, endStr);
  if (!items || !Array.isArray(items) || items.length === 0) return null;

  const total = items.reduce((sum, it) => sum + (it.views || 0), 0);
  return total / items.length;
}

/**
 * Get pageviews for many articles in batch.
 * NOTE: This is sequential to respect rate limits. For 500+ articles,
 * use a KV cache and stagger over multiple days.
 *
 * @param {string[]} titles
 * @param {string} lang
 * @param {number} days
 * @returns {Promise<object>} {title → avg_daily_views|null}
 */
async function getPageviewsBatch(titles, lang = 'en', days = 90) {
  const result = {};
  let i = 0;
  for (const title of titles) {
    i++;
    if (i % 50 === 0) {
      console.log(`[pageviews] ${i}/${titles.length} processed`);
    }
    try {
      result[title] = await getTrailingAverage(title, lang, days);
    } catch (err) {
      console.warn(`[pageviews] ${title}: ${err.message}`);
      result[title] = null;
    }
    // Throttle: 1 req per 200ms (5 req/s, well under 500/h)
    await sleep(200);
  }
  return result;
}

module.exports = {
  getPageviews,
  getTrailingAverage,
  getPageviewsBatch,
  PAGEVIEWS_BASE,
  USER_AGENT
};
