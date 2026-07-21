/**
 * OpenHolidays API connector
 *
 * Free public/school holidays API for 36 EU countries. No key required.
 * Per Blueprint Ch 5: covers countries Nager misses or only partially covers.
 *
 * License: Free to use (no key, no rate limit stated)
 * https://openholidaysapi.org
 *
 * Base URL: https://openholidaysapi.org
 * Endpoints:
 *   GET /PublicHolidays?countryIsoCode=DE&validFrom=2026-01-01&validTo=2026-12-31&languageIsoCode=en
 *   GET /SchoolHolidays?countryIsoCode=DE&validFrom=2026-01-01&validTo=2026-12-31&languageIsoCode=en
 *   GET /PublicHolidaysByCountry?languageIsoCode=en
 */

const OPENHOLIDAYS_BASE = 'https://openholidaysapi.org';
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
        const wait = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        if (res.status === 204) return null;
        throw new Error(`OpenHolidays HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[openholidays] fetch failed for ${url}: ${err.message}`);
        return null;
      }
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
  return null;
}

/**
 * Get public holidays for a country in a date range.
 * @param {string} countryCode - ISO 3166-1 alpha-2 (e.g. "DE")
 * @param {string} validFrom - ISO date
 * @param {string} validTo - ISO date
 * @param {string} language - 'en' (default), 'de', 'fr', etc.
 * @returns {Promise<Array>}
 */
async function getPublicHolidays(countryCode, validFrom, validTo, language = 'en') {
  const url = `${OPENHOLIDAYS_BASE}/PublicHolidays?countryIsoCode=${countryCode}&validFrom=${validFrom}&validTo=${validTo}&languageIsoCode=${language}`;
  return await fetchJson(url) || [];
}

/**
 * Get school holidays for a country in a date range.
 * @param {string} countryCode
 * @param {string} validFrom
 * @param {string} validTo
 * @param {string} language
 * @returns {Promise<Array>}
 */
async function getSchoolHolidays(countryCode, validFrom, validTo, language = 'en') {
  const url = `${OPENHOLIDAYS_BASE}/SchoolHolidays?countryIsoCode=${countryCode}&validFrom=${validFrom}&validTo=${validTo}&languageIsoCode=${language}`;
  return await fetchJson(url) || [];
}

/**
 * Get list of available countries.
 * @param {string} language
 * @returns {Promise<Array>}
 */
async function getAvailableCountries(language = 'en') {
  const url = `${OPENHOLIDAYS_BASE}/PublicHolidaysByCountry?languageIsoCode=${language}`;
  return await fetchJson(url) || [];
}

/**
 * Normalize an OpenHolidays public holiday to our onthisday schema (011-compatible).
 * Schema reference:
 *   {id, country, name, date, type, regionalScope, regions, temporalScope, nationwide}
 * @param {object} oh
 * @returns {object|null}
 */
function normalizePublicHoliday(oh) {
  if (!oh.startDate) return null;
  const [year, month, day] = oh.startDate.split('-').map(Number);

  return {
    title: oh.name?.[0]?.text || 'Public Holiday',
    description: `${oh.name?.[0]?.text} — public holiday in ${oh.country}`,
    year,
    month,
    day,
    type: 'holiday',
    category: 'events',
    importance: oh.nationwide ? 3 : 2,
    country_code: oh.country,
    region: countryToRegion(oh.country),
    holiday_type: oh.type || 'Public',
    holiday_global: oh.nationwide ? 1 : 0,
    observance_countries: JSON.stringify([oh.country]),
    language: oh.name?.[0]?.language || 'en',
    data_sources: JSON.stringify([{
      name: 'openholidays',
      url: `${OPENHOLIDAYS_BASE}/PublicHolidays?countryIsoCode=${oh.country}&validFrom=${oh.startDate}&validTo=${oh.startDate}`,
      retrieved_at: new Date().toISOString().split('T')[0],
      license: 'free-to-use',
      license_url: 'https://openholidaysapi.org',
      attribution_required: 0
    }]),
    verified_in: JSON.stringify(['openholidays']),
    verified: 0
  };
}

const COUNTRY_TO_REGION = {
  US: 'north_america', CA: 'north_america', MX: 'north_america',
  BR: 'south_america', AR: 'south_america',
  GB: 'europe', FR: 'europe', DE: 'europe', IT: 'europe', ES: 'europe', NL: 'europe',
  CH: 'europe', AT: 'europe', PT: 'europe', IE: 'europe', BE: 'europe', NO: 'europe', SE: 'europe', DK: 'europe', FI: 'europe', PL: 'europe', GR: 'europe',
  LU: 'europe', MT: 'europe', LI: 'europe', IS: 'europe', AD: 'europe', MC: 'europe',
  CN: 'asia', JP: 'asia', IN: 'asia', KR: 'asia', TW: 'asia',
  AU: 'oceania', NZ: 'oceania'
};

function countryToRegion(countryCode) {
  return COUNTRY_TO_REGION[countryCode] || 'europe';  // OpenHolidays is EU-focused
}

/**
 * Get holidays for a single (month, day) across many EU countries.
 * @param {number} month
 * @param {number} day
 * @param {number} year
 * @param {string[]} countryCodes
 * @returns {Promise<object[]>}
 */
async function getHolidaysForDay(month, day, year, countryCodes) {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const results = await Promise.allSettled(
    countryCodes.map(cc => getPublicHolidays(cc, dateStr, dateStr))
  );

  const all = [];
  results.forEach((r) => {
    if (r.status === 'fulfilled' && r.value) {
      for (const oh of r.value) {
        const normalized = normalizePublicHoliday(oh);
        if (normalized) all.push(normalized);
      }
    }
  });
  return all;
}

module.exports = {
  getPublicHolidays,
  getSchoolHolidays,
  getAvailableCountries,
  getHolidaysForDay,
  normalizePublicHoliday,
  OPENHOLIDAYS_BASE,
  USER_AGENT
};
