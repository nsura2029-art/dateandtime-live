/**
 * Wikimedia featured content connector
 *
 * Per Blueprint Ch 5: Wikimedia Feed API extensions
 *   - Today's Featured Article (TFA)
 *   - Picture of the Day (POTD)
 *   - On The News
 *   - Most Read articles
 *   - Did You Know (DYK)
 *
 * License: CC BY-SA 4.0
 * URL: api.wikimedia.org/feed/v1/wikipedia/{lang}/featured/{YYYY}/{MM}/{DD}
 */

const CANONICAL_FEED_BASE = 'https://api.wikimedia.org/feed/v1/wikipedia';
const USER_AGENT = 'DateAndTime-Live/1.0 (https://dateandtime.live; contact@dateandtime.live)';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url, opts = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
      });
      if (res.status === 404) return null;
      if (res.status === 429) {
        await sleep(2000);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      if (attempt === 3) return null;
      await sleep(1500);
    }
  }
  return null;
}

/**
 * Get featured content for a specific date.
 * @param {string} lang - 'en' (default)
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {Promise<object>}
 */
async function getFeatured(lang, year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const url = `${CANONICAL_FEED_BASE}/${lang}/featured/${year}/${mm}/${dd}`;
  return await fetchJson(url);
}

/**
 * Get most-read articles for a date.
 */
async function getMostRead(lang, year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const url = `${CANONICAL_FEED_BASE}/${lang}/mostread/${year}/${mm}/${dd}`;
  return await fetchJson(url);
}

/**
 * Get news for a date.
 */
async function getNews(lang, year, month, day) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const url = `${CANONICAL_FEED_BASE}/${lang}/news/${year}/${mm}/${dd}`;
  return await fetchJson(url);
}

module.exports = {
  getFeatured,
  getMostRead,
  getNews
};
