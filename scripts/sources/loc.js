/**
 * Chronicling America (Library of Congress) connector
 *
 * Per Blueprint Ch 5: 12M historic US newspapers.
 * Used for "100 years ago today" newspaper front pages.
 *
 * License: Public domain (US gov)
 * URL: https://chroniclingamerica.loc.gov/
 */

const LOC_BASE = 'https://chroniclingamerica.loc.gov';
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
 * Search newspaper pages for a (year, month, day) date.
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {Promise<Array>}
 */
async function searchByDate(year, month, day) {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const url = `${LOC_BASE}/search/pages/results/?dateFilterType=yearRange&date1=${year}&date2=${year}&language=&sequence=&lccn=&rows=20&searchType=advanced&proxtext=&phrasetext=&andtext=${dateStr}&ortext=&proxdistance=5&rows=20&searchType=advanced&sort=relevance`;
  const data = await fetchJson(url);
  return data?.items || [];
}

/**
 * Get front pages from a specific year.
 * @param {number} year
 * @returns {Promise<Array>}
 */
async function getFrontPages(year) {
  const url = `${LOC_BASE}/frontpages/${year}/`;
  return await fetchJson(url) || [];
}

module.exports = {
  searchByDate,
  getFrontPages,
  LOC_BASE
};
