/**
 * Nager.Date Public Holidays API connector
 *
 * Free public holidays API for 197 countries. No key required.
 * Per Blueprint Ch 5: this is the PRIMARY holiday source.
 *
 * License: Free to use (no key, no rate limit stated)
 * https://date.nager.at/Api
 *
 * URL: https://date.nager.at/api/v3/publicholidays/{YYYY}/{CC}
 * Initial countries: US, GB, CA, AU (top 4 by traffic per Blueprint)
 */

const NAGER_BASE = 'https://date.nager.at/api/v3';
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
        console.warn(`[nager] 429 rate-limited, waiting ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        if (res.status === 204 || res.status === 404) return null;
        throw new Error(`Nager HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[nager] fetch failed for ${url}: ${err.message}`);
        return null;
      }
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
  return null;
}

/**
 * List of countries available in Nager.Date.
 * Returns array of {countryCode, name, officialName, region}.
 * @returns {Promise<Array>}
 */
async function getAvailableCountries() {
  const url = `${NAGER_BASE}/AvailableCountries`;
  return await fetchJson(url) || [];
}

/**
 * Get public holidays for a country in a year.
 * @param {string} countryCode - ISO 3166-1 alpha-2 (e.g. "US")
 * @param {number} year
 * @returns {Promise<Array>}
 */
async function getPublicHolidays(countryCode, year) {
  const url = `${NAGER_BASE}/PublicHolidays/${year}/${countryCode}`;
  return await fetchJson(url) || [];
}

/**
 * Get public holidays for a country across multiple years.
 * @param {string} countryCode
 * @param {number} startYear
 * @param {number} endYear
 * @returns {Promise<Array>} flat array of holidays
 */
async function getHolidaysMultiYear(countryCode, startYear, endYear) {
  const years = endYear - startYear + 1;
  const allHolidays = [];

  for (let y = startYear; y <= endYear; y++) {
    const holidays = await getPublicHolidays(countryCode, y);
    if (holidays && Array.isArray(holidays)) {
      for (const h of holidays) {
        allHolidays.push({ ...h, countryCode, year: y });
      }
    }
  }

  return allHolidays;
}

/**
 * Get holidays for many countries in parallel for a single year.
 * @param {string[]} countryCodes
 * @param {number} year
 * @returns {Promise<Array>}
 */
async function getHolidaysMultiCountry(countryCodes, year) {
  const results = await Promise.allSettled(
    countryCodes.map(cc => getPublicHolidays(cc, year))
  );

  const allHolidays = [];
  results.forEach((result, idx) => {
    const cc = countryCodes[idx];
    if (result.status === 'fulfilled' && result.value) {
      for (const h of result.value) {
        allHolidays.push({ ...h, countryCode: cc, year });
      }
    }
  });
  return allHolidays;
}

/**
 * Normalize a Nager.Date holiday to our onthisday schema (011-compatible).
 * Schema reference:
 *   {date, localName, name, countryCode, global, counties, types, year}
 * @param {object} nagerHoliday
 * @returns {object} Normalized entry
 */
function normalizeHoliday(nagerHoliday) {
  const [year, month, day] = nagerHoliday.date ? nagerHoliday.date.split('-').map(Number) : [null, null, null];

  return {
    title: nagerHoliday.name || nagerHoliday.localName,
    description: `${nagerHoliday.name} (${nagerHoliday.localName}) — public holiday in ${nagerHoliday.countryCode}`,
    year,
    month,
    day,
    type: 'holiday',
    category: 'events',
    importance: nagerHoliday.global ? 3 : 2,
    country_code: nagerHoliday.countryCode,
    region: countryToRegion(nagerHoliday.countryCode),
    holiday_type: (nagerHoliday.types && nagerHoliday.types[0]) || 'Public',
    holiday_global: nagerHoliday.global ? 1 : 0,
    observance_countries: JSON.stringify([nagerHoliday.countryCode]),
    language: 'en',
    data_sources: JSON.stringify([{
      name: 'nager_date',
      url: `${NAGER_BASE}/PublicHolidays/${year}/${nagerHoliday.countryCode}`,
      retrieved_at: new Date().toISOString().split('T')[0],
      license: 'free-to-use',
      license_url: 'https://date.nager.at/Api',
      attribution_required: 0
    }]),
    verified_in: JSON.stringify(['nager_date']),
    verified: 0
  };
}

/**
 * Get holidays for a single (month, day) across many countries.
 * Used for "holidays on this day" pages.
 * @param {number} month
 * @param {number} day
 * @param {number} year
 * @param {string[]} countryCodes
 * @returns {Promise<object[]>}
 */
async function getHolidaysForDay(month, day, year, countryCodes) {
  const allHolidays = await getHolidaysMultiCountry(countryCodes, year);
  return allHolidays
    .filter(h => {
      const [, m, d] = h.date?.split('-').map(Number) || [null, null, null];
      return m === month && d === day;
    })
    .map(normalizeHoliday);
}

const COUNTRY_TO_REGION = {
  US: 'north_america', CA: 'north_america', MX: 'north_america',
  BR: 'south_america', AR: 'south_america', CL: 'south_america', PE: 'south_america',
  GB: 'europe', FR: 'europe', DE: 'europe', IT: 'europe', ES: 'europe', NL: 'europe',
  CH: 'europe', AT: 'europe', PT: 'europe', IE: 'europe', BE: 'europe', NO: 'europe', SE: 'europe', DK: 'europe', FI: 'europe', PL: 'europe', GR: 'europe',
  CN: 'asia', JP: 'asia', IN: 'asia', KR: 'asia', TW: 'asia', HK: 'asia',
  TH: 'asia', ID: 'asia', PH: 'asia', SG: 'asia', VN: 'asia', MY: 'asia',
  AE: 'middle_east', SA: 'middle_east', IL: 'middle_east',
  EG: 'africa', ZA: 'africa', NG: 'africa', KE: 'africa',
  AU: 'oceania', NZ: 'oceania'
};

function countryToRegion(countryCode) {
  return COUNTRY_TO_REGION[countryCode] || 'global';
}

module.exports = {
  getAvailableCountries,
  getPublicHolidays,
  getHolidaysMultiYear,
  getHolidaysMultiCountry,
  getHolidaysForDay,
  normalizeHoliday,
  countryToRegion,
  NAGER_BASE,
  USER_AGENT
};
