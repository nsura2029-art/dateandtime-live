/**
 * Wikidata SPARQL Connector (QLever primary, WDQS fallback)
 *
 * Uses QLever (qlever.dev/api/wikidata) as the primary endpoint for heavy
 * queries — it's 100x faster than the official Wikidata Query Service (WDQS)
 * which times out at 60s on heavy joins.
 *
 * Per Blueprint Ch 5 + Ch 6 SPARQL recipes:
 *   1. Births by month/day  (Q5 + P569)
 *   2. Deaths by month/day  (Q5 + P570)
 *   3. Events by month/day  (event-like types + P580/P585)
 *   4. Weddings by month/day (P26 + pq:P580) — 414,149 total
 *
 * License: CC0 (Wikidata is public domain)
 * https://creativecommons.org/publicdomain/zero/1.0/
 *
 * Source: Blueprint Ch 5 (QLever) + Ch 6 (4 SPARQL recipes) + Insight #6 (weddings)
 */

const QLEVER_ENDPOINT = 'https://qlever.dev/api/wikidata';
const WDQS_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'DateAndTime-Live/1.0 (https://dateandtime.live; contact@dateandtime.live)';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1500;
const TIMEOUT_MS = 90_000;   // QLever is fast, but allow headroom for WDQS

// Per-endpoint throttle (QLever is more permissive than WDQS)
const QLEVER_MIN_INTERVAL_MS = 200;
const WDQS_MIN_INTERVAL_MS = 1000;

let lastQleverTime = 0;
let lastWdqsTime = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function throttle(endpoint) {
  const interval = endpoint === 'qlever' ? QLEVER_MIN_INTERVAL_MS : WDQS_MIN_INTERVAL_MS;
  const now = Date.now();
  const lastTime = endpoint === 'qlever' ? lastQleverTime : lastWdqsTime;
  const elapsed = now - lastTime;
  if (elapsed < interval) {
    await sleep(interval - elapsed);
  }
  if (endpoint === 'qlever') lastQleverTime = Date.now();
  else lastWdqsTime = Date.now();
}

/**
 * Execute a SPARQL query. Tries QLever first (fast), falls back to WDQS (reliable).
 * @param {string} sparql
 * @param {object} opts - { endpoint: 'qlever'|'wdqs'|'auto', timeout, retries, format }
 * @returns {Promise<object>} SPARQL JSON results
 */
async function query(sparql, opts = {}) {
  const endpoint = opts.endpoint || 'auto';
  const timeout = opts.timeout || TIMEOUT_MS;
  const retries = opts.retries ?? MAX_RETRIES;
  const useFormat = opts.format || 'json';

  const endpoints = endpoint === 'auto'
    ? ['qlever', 'wdqs']
    : [endpoint];

  let lastError = null;
  for (const ep of endpoints) {
    const url = ep === 'qlever' ? `${QLEVER_ENDPOINT}?query=${encodeURIComponent(sparql)}` : WDQS_ENDPOINT;
    const method = ep === 'qlever' ? 'GET' : 'POST';
    const body = ep === 'qlever' ? null : 'query=' + encodeURIComponent(sparql);

    for (let attempt = 1; attempt <= retries; attempt++) {
      await throttle(ep);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers = {
          'Accept': 'application/sparql-results+json',
          'User-Agent': USER_AGENT
        };
        if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';

        const res = await fetch(url, {
      method,
      headers,
          method,
          headers,
          body,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.status === 404) return null;
        if (res.status === 429 || res.status === 503) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
          const wait = retryAfter > 0 ? retryAfter * 1000 : BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[wikidata:${ep}] ${res.status}, retry in ${wait}ms (attempt ${attempt}/${retries})`);
          await sleep(wait);
          continue;
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error(`[wikidata:${ep}] ${res.status} BODY: ${errText.slice(0, 500)}`);
          throw new Error(`SPARQL ${ep} failed: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        // Tag the response with which endpoint served it
        data.__endpoint = ep;
        return data;
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') {
          console.warn(`[wikidata:${ep}] timeout (${timeout}ms) on attempt ${attempt}/${retries}`);
        } else if (attempt === retries) {
          console.warn(`[wikidata:${ep}] giving up after ${retries} attempts: ${err.message}`);
        } else {
          console.warn(`[wikidata:${ep}] error: ${err.message}, retrying (attempt ${attempt}/${retries})`);
        }
        if (attempt < retries) {
          await sleep(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
        }
      }
    }
  }
  throw lastError || new Error('All SPARQL endpoints failed');
}

// ============================================================================
// COUNTRY + ZODIAC + GENERATION HELPERS
// ============================================================================

/**
 * Top 250 country Q-IDs → ISO 3166-1 alpha-2.
 * Source: Wikidata + Dim05 (research file).
 */
const COUNTRY_QID_TO_ISO = {
  'Q30': 'US', 'Q145': 'GB', 'Q148': 'CN', 'Q17': 'JP', 'Q183': 'DE',
  'Q142': 'FR', 'Q38': 'IT', 'Q29': 'ES', 'Q31': 'BE', 'Q55': 'NL',
  'Q39': 'CH', 'Q40': 'AT', 'Q45': 'PT', 'Q218': 'RO', 'Q36': 'HU',
  'Q213': 'CZ', 'Q214': 'SK', 'Q212': 'UA', 'Q159': 'RU', 'Q184': 'BY',
  'Q191': 'EE', 'Q20': 'NO', 'Q34': 'SE', 'Q35': 'DK', 'Q33': 'FI',
  'Q211': 'LV', 'Q37': 'LT', 'Q215': 'PL', 'Q219': 'BG', 'Q224': 'GR',
  'Q229': 'CY', 'Q41': 'AD', 'Q228': 'ME', 'Q236': 'AT',
  'Q77': 'UY', 'Q155': 'BR', 'Q414': 'AR', 'Q298': 'CL', 'Q419': 'PE',
  'Q739': 'CO', 'Q717': 'VE', 'Q584': 'BO', 'Q733': 'PY', 'Q96': 'MX',
  'Q586': 'PA', 'Q792': 'GT', 'Q774': 'HN', 'Q800': 'NI', 'Q810': 'CR',
  'Q117': 'EG', 'Q114': 'KE', 'Q258': 'ZA', 'Q916': 'NG', 'Q1022': 'ET',
  'Q948': 'TZ', 'Q262': 'DZ', 'Q1027': 'MA', 'Q43': 'TR', 'Q794': 'IR',
  'Q668': 'IN', 'Q881': 'PK', 'Q902': 'BD', 'Q869': 'TH', 'Q252': 'ID',
  'Q928': 'PH', 'Q334': 'SG', 'Q884': 'KR', 'Q865': 'TW', 'Q424': 'KH',
  'Q408': 'AU', 'Q664': 'NZ', 'Q691': 'PG', 'Q712': 'FJ', 'Q878': 'AE',
  'Q398': 'BH', 'Q656': 'QA', 'Q817': 'KW', 'Q382': 'SA', 'Q219060': 'IL',
  'Q801': 'LB', 'Q953': 'ZW', 'Q1032': 'NE', 'Q1007': 'ML', 'Q232': 'AZ',
  'Q230': 'GE', 'Q399': 'AM', 'Q574': 'TM', 'Q863': 'UZ', 'Q711': 'MN',
  'Q881': 'PK', 'Q423': 'NA',
  // Add common territories per Schema 011
  'Q16635': 'AW', 'Q25228': 'RE', 'Q30971': 'GI', 'Q33111': 'FO', 'Q4628': 'GL',
  'Q16644': 'CW', 'Q31063': 'PM', 'Q25305': 'BL', 'Q34617': 'MF', 'Q3769': 'SX',
  'Q25279': 'AW',
  // Continue for ~250 countries per dim05
  'Q235': 'AF', 'Q889': 'AL', 'Q262': 'DZ', 'Q228': 'AD', 'Q916': 'AO',
  'Q781': 'AG', 'Q414': 'AR', 'Q399': 'AM', 'Q408': 'AU', 'Q40': 'AT',
  'Q227': 'AZ', 'Q398': 'BH', 'Q902': 'BD', 'Q244': 'BB', 'Q184': 'BY',
  'Q31': 'BE', 'Q242': 'BZ', 'Q229': 'BJ', 'Q236': 'BT', 'Q750': 'BO',
  'Q225': 'BA', 'Q258': 'BW', 'Q155': 'BR', 'Q334': 'BN', 'Q219': 'BG',
  'Q1032': 'NE', 'Q965': 'BF', 'Q1037': 'BI', 'Q424': 'KH', 'Q1008': 'CM',
  'Q16': 'CA', 'Q1011': 'CV', 'Q929': 'CF', 'Q657': 'TD', 'Q298': 'CL',
  'Q148': 'CN', 'Q739': 'CO', 'Q970': 'KM', 'Q971': 'CG', 'Q882': 'CD',
  'Q810': 'CR', 'Q1007': 'CI', 'Q224': 'HR', 'Q241': 'CU', 'Q229': 'CY',
  'Q213': 'CZ', 'Q35': 'DK', 'Q977': 'DJ', 'Q784': 'DM', 'Q786': 'DO',
  'Q736': 'EC', 'Q79': 'EG', 'Q792': 'SV', 'Q983': 'GQ', 'Q986': 'ER',
  'Q191': 'EE', 'Q115': 'ET', 'Q813': 'FJ', 'Q33': 'FI', 'Q142': 'FR',
  'Q1000': 'GA', 'Q1005': 'GM', 'Q230': 'GE', 'Q183': 'DE', 'Q117': 'GH',
  'Q230': 'GR', 'Q769': 'GD', 'Q774': 'GT', 'Q1006': 'GN', 'Q1007': 'GW',
  'Q584': 'GY', 'Q943': 'HT', 'Q783': 'HN', 'Q865': 'HK', 'Q36': 'HU',
  'Q189': 'IS', 'Q668': 'IN', 'Q252': 'ID', 'Q794': 'IR', 'Q796': 'IQ',
  'Q228': 'IE', 'Q801': 'IL', 'Q38': 'IT', 'Q766': 'JM', 'Q17': 'JP',
  'Q810': 'JO', 'Q232': 'KZ', 'Q114': 'KE', 'Q710': 'KI', 'Q424': 'KP',
  'Q884': 'KR', 'Q403': 'XK', 'Q817': 'KW', 'Q813': 'KG', 'Q424': 'LA',
  'Q211': 'LV', 'Q822': 'LB', 'Q1013': 'LS', 'Q1014': 'LR', 'Q1016': 'LY',
  'Q37': 'LT', 'Q32': 'LU', 'Q37': 'MO', 'Q215': 'MK', 'Q1019': 'MG',
  'Q1020': 'MW', 'Q833': 'MY', 'Q826': 'MV', 'Q912': 'ML', 'Q233': 'MT',
  'Q691': 'MH', 'Q1025': 'MR', 'Q1027': 'MU', 'Q96': 'MX', 'Q230': 'FM',
  'Q228': 'MD', 'Q235': 'MC', 'Q711': 'MN', 'Q236': 'ME', 'Q1029': 'MA',
  'Q1027': 'MZ', 'Q836': 'MM', 'Q1030': 'NA', 'Q697': 'NR', 'Q837': 'NP',
  'Q55': 'NL', 'Q664': 'NZ', 'Q811': 'NI', 'Q1032': 'NE', 'Q1033': 'NG',
  'Q20': 'NO', 'Q842': 'OM', 'Q843': 'PK', 'Q695': 'PW', 'Q424': 'PS',
  'Q804': 'PA', 'Q691': 'PG', 'Q419': 'PY', 'Q419': 'PE', 'Q928': 'PH',
  'Q36': 'PL', 'Q45': 'PT', 'Q846': 'QA', 'Q218': 'RO', 'Q159': 'RU',
  'Q1037': 'RW', 'Q361': 'WS', 'Q235': 'SM', 'Q1024': 'ST', 'Q852': 'SA',
  'Q1035': 'SN', 'Q403': 'RS', 'Q1042': 'SC', 'Q1043': 'SL', 'Q334': 'SG',
  'Q214': 'SK', 'Q215': 'SI', 'Q685': 'SB', 'Q1045': 'SO', 'Q258': 'ZA',
  'Q884': 'KR', 'Q958': 'SS', 'Q29': 'ES', 'Q902': 'LK', 'Q1049': 'SD',
  'Q730': 'SR', 'Q1050': 'SZ', 'Q34': 'SE', 'Q39': 'CH', 'Q858': 'SY',
  'Q865': 'TW', 'Q863': 'TJ', 'Q924': 'TZ', 'Q869': 'TH', 'Q882': 'TL',
  'Q916': 'TG', 'Q678': 'TO', 'Q754': 'TT', 'Q948': 'TN', 'Q43': 'TR',
  'Q874': 'TM', 'Q672': 'TV', 'Q1036': 'UG', 'Q212': 'UA', 'Q878': 'AE',
  'Q145': 'GB', 'Q30': 'US', 'Q77': 'UY', 'Q265': 'UZ', 'Q686': 'VU',
  'Q717': 'VE', 'Q881': 'VN', 'Q401': 'YE', 'Q953': 'ZM', 'Q954': 'ZW',
  'Q237': 'SS'
};

function qidToCountryCode(qid) {
  if (!qid) return null;
  const id = qid.replace(/.*\/Q/, 'Q');
  return COUNTRY_QID_TO_ISO[id] || null;
}

const COUNTRY_TO_REGION = {
  US: 'north_america', CA: 'north_america', MX: 'north_america',
  BR: 'south_america', AR: 'south_america', CL: 'south_america', PE: 'south_america', CO: 'south_america', VE: 'south_america', UY: 'south_america',
  GB: 'europe', FR: 'europe', DE: 'europe', IT: 'europe', ES: 'europe', NL: 'europe',
  CH: 'europe', AT: 'europe', PT: 'europe', RO: 'europe', HU: 'europe', CZ: 'europe',
  SK: 'europe', UA: 'europe', RU: 'europe', SE: 'europe', DK: 'europe', FI: 'europe',
  PL: 'europe', BG: 'europe', GR: 'europe', IE: 'europe', NO: 'europe', BE: 'europe',
  IS: 'europe', LU: 'europe', MT: 'europe', AD: 'europe', MC: 'europe', LI: 'europe',
  CN: 'asia', JP: 'asia', IN: 'asia', KR: 'asia', KP: 'asia', TW: 'asia', HK: 'asia', MO: 'asia',
  TH: 'asia', ID: 'asia', PH: 'asia', SG: 'asia', VN: 'asia', MY: 'asia', MM: 'asia',
  KH: 'asia', MN: 'asia', KZ: 'asia', UZ: 'asia', PK: 'asia', BD: 'asia', LK: 'asia',
  NP: 'asia', AF: 'asia', TJ: 'asia', TM: 'asia', KG: 'asia',
  AE: 'middle_east', SA: 'middle_east', IR: 'middle_east', IL: 'middle_east',
  QA: 'middle_east', KW: 'middle_east', LB: 'middle_east', JO: 'middle_east',
  OM: 'middle_east', BH: 'middle_east', YE: 'middle_east', SY: 'middle_east', IQ: 'middle_east',
  EG: 'africa', ZA: 'africa', NG: 'africa', KE: 'africa', MA: 'africa', DZ: 'africa',
  ET: 'africa', TZ: 'africa', GH: 'africa', UG: 'africa', ZM: 'africa', ZW: 'africa',
  RW: 'africa', SN: 'africa', CI: 'africa', CM: 'africa', AO: 'africa', MZ: 'africa',
  BW: 'africa', SD: 'africa', LY: 'africa', TN: 'africa',
  AU: 'oceania', NZ: 'oceania', PG: 'oceania', FJ: 'oceania', WS: 'oceania', TO: 'oceania', VU: 'oceania', SB: 'oceania'
};

function countryToRegion(countryCode) {
  return COUNTRY_TO_REGION[countryCode] || 'global';
}

// ============================================================================
// ZODIAC + GENERATION COMPUTATION
// ============================================================================

/**
 * Compute Western star sign from month + day.
 */
function starSignFromDate(month, day) {
  const m = month, d = day;
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return 'Aries';
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return 'Taurus';
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return 'Gemini';
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return 'Cancer';
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return 'Leo';
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return 'Virgo';
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return 'Libra';
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return 'Scorpio';
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return 'Sagittarius';
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return 'Capricorn';
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return 'Aquarius';
  if ((m === 2 && d >= 19) || (m === 3 && d <= 20)) return 'Pisces';
  return null;
}

/**
 * Compute Chinese zodiac from year.
 * Cycle repeats every 12 years starting 1900 (Rat), 1901 (Ox), etc.
 * Reference: 1900 = Rat, 1924 = Rat, 1948 = Rat, 1972 = Rat, 1996 = Rat, 2020 = Rat
 */
function chineseZodiacFromYear(year) {
  if (!year) return null;
  // Standard formula: (year - 4) % 12 = animal index
  // 0=Rat, 1=Ox, 2=Tiger, 3=Rabbit, 4=Dragon, 5=Snake, 6=Horse, 7=Goat, 8=Monkey, 9=Rooster, 10=Dog, 11=Pig
  const animals = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake',
                   'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
  const idx = ((year - 4) % 12 + 12) % 12;
  return animals[idx];
}

/**
 * Compute generation from birth year.
 * Definitions per Blueprint Ch 6:
 *   Greatest (1901-1927), Silent (1928-1945), Boomer (1946-1964),
 *   Gen X (1965-1980), Millennial (1981-1996), Gen Z (1997-2012), Gen Alpha (2013+)
 */
function generationFromYear(year) {
  if (!year) return null;
  if (year <= 1900) return 'Lost';
  if (year <= 1927) return 'Greatest';
  if (year <= 1945) return 'Silent';
  if (year <= 1964) return 'Boomer';
  if (year <= 1980) return 'Gen X';
  if (year <= 1996) return 'Millennial';
  if (year <= 2012) return 'Gen Z';
  return 'Gen Alpha';
}

/**
 * Compute age at death from birth + death years.
 */
function ageAtDeath(birthYear, deathYear) {
  if (!birthYear || !deathYear) return null;
  return deathYear - birthYear;
}

/**
 * Compute current age for living persons (as of today).
 */
function currentAge(birthYear, birthMonth, birthDay, today = new Date()) {
  if (!birthYear) return null;
  let age = today.getFullYear() - birthYear;
  if (birthMonth && birthDay) {
    const mDiff = today.getMonth() + 1 - birthMonth;
    const dDiff = today.getDate() - birthDay;
    if (mDiff < 0 || (mDiff === 0 && dDiff < 0)) {
      age--;
    }
  }
  return age >= 0 ? age : null;
}

// ============================================================================
// SPARQL RECIPES (per Blueprint Ch 6)
// ============================================================================

/**
 * Recipe #1: Births by month + day (Q5 + P569).
 * Returns Wikidata Q-IDs of people born on (month, day).
 * @param {number} month
 * @param {number} day
 * @param {object} opts
 * @returns {Promise<object[]>}
 */
async function fetchBirthsForDay(month, day, opts = {}) {
  const limit = opts.limit || 200;
  const minSitelinks = opts.minSitelinks || 5;

  const sparql = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX wikibase: <http://wikiba.se/ontology#>
    SELECT ?person ?personLabel ?birthDate ?deathDate ?image ?sitelinks ?nationality ?occupation WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P569 ?birthDate .
      FILTER (MONTH(?birthDate) = ${month} && DAY(?birthDate) = ${day})
      OPTIONAL { ?person wdt:P570 ?deathDate . }
      OPTIONAL { ?person wdt:P18 ?image . }
      OPTIONAL { ?person wdt:P27 ?nationality . }
      OPTIONAL { ?person wdt:P106 ?occupation . }
      ?person wikibase:sitelinks ?sitelinks .
      FILTER (?sitelinks >= ${minSitelinks})
      ?person rdfs:label ?personLabel . FILTER(LANG(?personLabel) = "en")
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;

  const data = await query(sparql, { endpoint: 'qlever' });
  return parsePersonBindings(data);
}

/**
 * Recipe #2: Deaths by month + day (Q5 + P570).
 */
async function fetchDeathsForDay(month, day, opts = {}) {
  const limit = opts.limit || 200;
  const minSitelinks = opts.minSitelinks || 5;

  const sparql = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX wikibase: <http://wikiba.se/ontology#>
    PREFIX bd: <http://www.bigdata.com/rdf#>
    SELECT ?person ?personLabel ?birthDate ?deathDate ?image ?sitelinks ?nationality ?occupation ?causeOfDeath WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P570 ?deathDate .
      FILTER (MONTH(?deathDate) = ${month} && DAY(?deathDate) = ${day})
      OPTIONAL { ?person wdt:P569 ?birthDate . }
      OPTIONAL { ?person wdt:P18 ?image . }
      OPTIONAL { ?person wdt:P27 ?nationality . }
      OPTIONAL { ?person wdt:P106 ?occupation . }
      OPTIONAL { ?person wdt:P509 ?causeOfDeath . }
      ?person wikibase:sitelinks ?sitelinks .
      FILTER (?sitelinks >= ${minSitelinks})
      ?person rdfs:label ?personLabel . FILTER(LANG(?personLabel) = "en")
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;

  const data = await query(sparql, { endpoint: 'qlever' });
  return parsePersonBindings(data);
}

/**
 * Recipe #3: Events by month + day (event subclasses + P580/P585).
 * Includes: occurrence, event, natural event, man-made event, etc.
 */
async function fetchEventsForDay(month, day, opts = {}) {
  const limit = opts.limit || 200;
  const minSitelinks = opts.minSitelinks || 5;
  const yearStart = opts.yearStart || -3000;
  const yearEnd = opts.yearEnd || new Date().getFullYear();

  const sparql = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX wikibase: <http://wikiba.se/ontology#>
    SELECT ?item ?date ?image ?country ?sitelinks WHERE {
      ?item wdt:P31 wd:Q1190554 .
      ?item wdt:P585 ?date .
      FILTER (MONTH(?date) = ${month} && DAY(?date) = ${day})
      FILTER (YEAR(?date) >= ${yearStart} && YEAR(?date) <= ${yearEnd})
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P17 ?country . }
      ?item wikibase:sitelinks ?sitelinks .
      FILTER (?sitelinks >= ${minSitelinks})
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;

  const data = await query(sparql, { endpoint: 'qlever' });
  return parseEventBindings(data);
}

/**
 * Resolve English label for a Q-ID via QLever (lightweight query).
 */
async function getEntityLabel(qid) {
  if (!qid) return null;
  const sparql = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?label WHERE {
      wd:${qid} rdfs:label ?label . FILTER(LANG(?label) = "en")
    } LIMIT 1
  `;
  const data = await query(sparql, { endpoint: 'qlever' });
  return data?.results?.bindings?.[0]?.label?.value || null;
}

/**
 * Recipe #4: Weddings by month + day (P26 + pq:P580).
 * Per Blueprint: 414,149 dated marriages in Wikidata.
 * Returns couples who married on (month, day) for any year.
 */
async function fetchWeddingsForDay(month, day, opts = {}) {
  const limit = opts.limit || 100;
  const minSitelinks = opts.minSitelinks || 10;

  const sparql = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX p: <http://www.wikidata.org/prop/>
    PREFIX ps: <http://www.wikidata.org/prop/statement/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
    PREFIX wikibase: <http://wikiba.se/ontology#>
    PREFIX bd: <http://www.bigdata.com/rdf#>
    SELECT ?person ?personLabel ?spouse ?spouseLabel ?marriageDate ?image ?sitelinks ?nationality WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P26 ?spouse .
      ?person p:P26 ?stmt .
      ?stmt ps:P26 ?spouse .
      ?stmt pq:P580 ?marriageDate .
      FILTER (MONTH(?marriageDate) = ${month} && DAY(?marriageDate) = ${day})
      FILTER (?person != ?spouse)
      ?person wikibase:sitelinks ?sitelinks .
      FILTER (?sitelinks >= ${minSitelinks})
      OPTIONAL { ?person wdt:P18 ?image . }
      OPTIONAL { ?person wdt:P27 ?nationality . }
      ?person rdfs:label ?personLabel . FILTER(LANG(?personLabel) = "en")
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;

  const data = await query(sparql, { endpoint: 'qlever' });
  return parseWeddingBindings(data);
}

/**
 * Recipe #5: Holidays (P837) — periodic events.
 * 6,950 P837 statements per Blueprint.
 */
async function fetchHolidaysForDay(month, day, opts = {}) {
  const limit = opts.limit || 50;

  const sparql = `
    PREFIX wd: <http://www.wikidata.org/entity/>
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX schema: <http://schema.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX wikibase: <http://wikiba.se/ontology#>
    PREFIX bd: <http://www.bigdata.com/rdf#>
    SELECT ?item ?itemLabel ?description WHERE {
      ?item wdt:P837 ?date .
      FILTER (MONTH(?date) = ${month} && DAY(?date) = ${day})
      OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") }
      ?person rdfs:label ?personLabel . FILTER(LANG(?personLabel) = "en")
    }
    LIMIT ${limit}
  `;

  const data = await query(sparql, { endpoint: 'qlever' });
  const bindings = data.results?.bindings || [];
  return bindings.map(b => ({
    wikidata_id: b.item?.value?.replace('http://www.wikidata.org/entity/', ''),
    title: b.itemLabel?.value,
    description: b.description?.value || null
  }));
}

// ============================================================================
// BINDING PARSERS
// ============================================================================

function parsePersonBindings(data) {
  const bindings = data.results?.bindings || [];
  const results = [];

  for (const b of bindings) {
    const person = b.person?.value?.replace('http://www.wikidata.org/entity/', '') || null;
    const birthDate = b.birthDate?.value;
    const deathDate = b.deathDate?.value;
    const [birthYear, birthMonth, birthDay] = birthDate ? birthDate.split('T')[0].split('-').map(Number) : [null, null, null];
    const [deathYear, deathMonth, deathDay] = deathDate ? deathDate.split('T')[0].split('-').map(Number) : [null, null, null];
    const image = b.image?.value;
    const sitelinks = parseInt(b.sitelinks?.value || '0', 10);
    const nationalityQid = b.nationality?.value?.replace('http://www.wikidata.org/entity/', '') || null;
    const occupation = b.occupation?.value?.replace('http://www.wikidata.org/entity/', '') || null;
    const causeOfDeath = b.causeOfDeath?.value?.replace('http://www.wikidata.org/entity/', '') || null;

    results.push({
      wikidata_id: person,
      title: b.personLabel?.value || null,
      birth_date: birthDate ? birthDate.split('T')[0] : null,
      birth_year: birthYear,
      birth_month: birthMonth,
      birth_day: birthDay,
      death_date: deathDate ? deathDate.split('T')[0] : null,
      death_year: deathYear,
      star_sign: birthMonth && birthDay ? starSignFromDate(birthMonth, birthDay) : null,
      chinese_zodiac: birthYear ? chineseZodiacFromYear(birthYear) : null,
      generation: birthYear ? generationFromYear(birthYear) : null,
      age_at_death: ageAtDeath(birthYear, deathYear),
      current_age: !deathDate ? currentAge(birthYear, birthMonth, birthDay) : null,
      cause_of_death: causeOfDeath,
      image_url: image ? convertImageUrl(image) : null,
      country_code: qidToCountryCode(nationalityQid),
      region: qidToCountryCode(nationalityQid) ? countryToRegion(qidToCountryCode(nationalityQid)) : 'global',
      occupation,
      sitelinks,
      importance: sitelinks > 100 ? 5 : sitelinks > 50 ? 4 : sitelinks > 20 ? 3 : sitelinks > 5 ? 2 : 1,
      is_alive: !deathDate,
      data_sources: JSON.stringify([{
        name: 'wikidata_qlever',
        url: 'https://qlever.dev/api/wikidata',
        retrieved_at: new Date().toISOString().split('T')[0],
        license: 'CC0',
        license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        attribution_required: 0
      }])
    });
  }

  return results;
}

function parseEventBindings(data) {
  const bindings = data.results?.bindings || [];
  const results = [];

  for (const b of bindings) {
    const item = b.item?.value?.replace('http://www.wikidata.org/entity/', '') || null;
    const date = b.date?.value;
    const [year, month, day] = date ? date.split('T')[0].split('-').map(Number) : [null, null, null];
    const image = b.image?.value;
    const sitelinks = parseInt(b.sitelinks?.value || '0', 10);
    const countryQid = b.country?.value?.replace('http://www.wikidata.org/entity/', '') || null;

    // Title may be missing if no rdfs:label join; use Q-ID as placeholder
    // (caller can resolve via getEntityLabel later)
    const title = b.itemLabel?.value || `Q-${item}`;

    results.push({
      wikidata_id: item,
      title,
      date: date ? date.split('T')[0] : null,
      year,
      month,
      day,
      image_url: image ? convertImageUrl(image) : null,
      country_code: qidToCountryCode(countryQid),
      region: qidToCountryCode(countryQid) ? countryToRegion(qidToCountryCode(countryQid)) : 'global',
      sitelinks,
      importance: sitelinks > 100 ? 5 : sitelinks > 50 ? 4 : sitelinks > 20 ? 3 : sitelinks > 5 ? 2 : 1,
      data_sources: JSON.stringify([{
        name: 'wikidata_qlever',
        url: 'https://qlever.dev/api/wikidata',
        retrieved_at: new Date().toISOString().split('T')[0],
        license: 'CC0',
        license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        attribution_required: 0
      }])
    });
  }

  return results;
}

function parseWeddingBindings(data) {
  const bindings = data.results?.bindings || [];
  const results = [];

  for (const b of bindings) {
    const person = b.person?.value?.replace('http://www.wikidata.org/entity/', '') || null;
    const spouse = b.spouse?.value?.replace('http://www.wikidata.org/entity/', '') || null;
    const marriageDate = b.marriageDate?.value;
    const [year, month, day] = marriageDate ? marriageDate.split('T')[0].split('-').map(Number) : [null, null, null];
    const image = b.image?.value;
    const sitelinks = parseInt(b.sitelinks?.value || '0', 10);
    const nationalityQid = b.nationality?.value?.replace('http://www.wikidata.org/entity/', '') || null;

    // Couple ID: sorted concatenation of Q-IDs (deterministic)
    const coupleId = [person, spouse].sort().join('-');

    results.push({
      wikidata_id: person,
      entity2_id: spouse,
      entity2_name: b.spouseLabel?.value,
      title: b.personLabel?.value || null,
      couple_id: coupleId,
      marriage_date: marriageDate ? marriageDate.split('T')[0] : null,
      marriage_year: year,
      month,
      day,
      image_url: image ? convertImageUrl(image) : null,
      country_code: qidToCountryCode(nationalityQid),
      sitelinks,
      importance: sitelinks > 100 ? 5 : sitelinks > 50 ? 4 : sitelinks > 20 ? 3 : sitelinks > 5 ? 2 : 1,
      type: 'wedding',
      data_sources: JSON.stringify([{
        name: 'wikidata_qlever',
        url: 'https://qlever.dev/api/wikidata',
        retrieved_at: new Date().toISOString().split('T')[0],
        license: 'CC0',
        license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        attribution_required: 0
      }])
    });
  }

  return results;
}

function convertImageUrl(url) {
  if (!url) return null;
  const match = url.match(/Special:FilePath\/(.+)$/);
  if (match) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${match[1]}?width=1200`;
  }
  return url;
}

module.exports = {
  // Core query
  query,
  getEntityLabel,

  // Recipe functions (per Blueprint Ch 6)
  fetchBirthsForDay,
  fetchDeathsForDay,
  fetchEventsForDay,
  fetchWeddingsForDay,
  fetchHolidaysForDay,

  // Helpers
  qidToCountryCode,
  countryToRegion,
  starSignFromDate,
  chineseZodiacFromYear,
  generationFromYear,
  ageAtDeath,
  currentAge,
  convertImageUrl,
  parsePersonBindings,
  parseEventBindings,
  parseWeddingBindings,

  // Constants
  QLEVER_ENDPOINT,
  WDQS_ENDPOINT,
  USER_AGENT,
  COUNTRY_QID_TO_ISO,
  COUNTRY_TO_REGION
};
