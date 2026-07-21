/**
 * Wikidata SPARQL Connector
 *
 * Queries Wikidata for events, births, and deaths on a specific date.
 * Uses SPARQL endpoint at https://query.wikidata.org/sparql
 *
 * Handles batching, retries, and rate limiting.
 */

const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'dateandtime.live/1.0 (https://dateandtime.live; contact@dateandtime.live)';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const TIMEOUT_MS = 60000;

/**
 * Execute a SPARQL query against Wikidata.
 * @param {string} sparql
 * @param {object} opts - { timeout, retries }
 * @returns {Promise<object>} SPARQL JSON results
 */
async function query(sparql, opts = {}) {
  const timeout = opts.timeout || TIMEOUT_MS;
  const retries = opts.retries ?? MAX_RETRIES;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const res = await fetch(WIKIDATA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Accept': 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT
        },
        body: 'query=' + encodeURIComponent(sparql),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        if (res.status === 429 || res.status === 503) {
          // Rate limited — wait and retry
          const wait = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`  ⚠️  Rate limited (${res.status}), retrying in ${wait}ms (attempt ${attempt}/${retries})`);
          await sleep(wait);
          continue;
        }
        throw new Error(`SPARQL query failed: ${res.status} ${res.statusText}`);
      }
      
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`  ⚠️  Query failed (${err.message}), retrying in ${wait}ms (attempt ${attempt}/${retries})`);
      await sleep(wait);
    }
  }
}

/**
 * Fetch historical events for a given month + day.
 * @param {number} month - 1-12
 * @param {number} day - 1-31
 * @param {object} opts - { limit, yearStart, yearEnd }
 * @returns {Promise<object[]>}
 */
async function fetchEventsForDay(month, day, opts = {}) {
  const limit = opts.limit || 200;
  const yearStart = opts.yearStart || -3000;
  const yearEnd = opts.yearEnd || new Date().getFullYear();
  
  const sparql = `
    SELECT ?item ?itemLabel ?itemDescription ?date ?image ?country ?countryLabel ?sitelinks WHERE {
      ?item wdt:P31/wdt:P279* wd:Q1656682 .
      ?item wdt:P585 ?date .
      ?item wdt:P576 ?endDate . FILTER (?endDate >= ?date)
      FILTER (MONTH(?date) = ${month} && DAY(?date) = ${day})
      FILTER (YEAR(?date) >= ${yearStart} && YEAR(?date) <= ${yearEnd})
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P17 ?country . }
      OPTIONAL { ?item wikibase:sitelinks ?sitelinks . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;
  
  const data = await query(sparql);
  return parseBindings(data, {
    wikidata_id: 'item',
    title: 'itemLabel',
    description: 'itemDescription',
    date: 'date',
    image_url: 'image',
    country_code: 'country',  // Will need conversion from Q-ID
    sitelinks: 'sitelinks'
  });
}

/**
 * Fetch notable births for a given month + day.
 * @param {number} month
 * @param {number} day
 * @param {object} opts - { limit, yearStart, yearEnd, minImportance }
 * @returns {Promise<object[]>}
 */
async function fetchBirthsForDay(month, day, opts = {}) {
  const limit = opts.limit || 100;
  const yearStart = opts.yearStart || 1500;
  const yearEnd = opts.yearEnd || new Date().getFullYear();
  const minImportance = opts.minImportance || 1;  // sitelinks threshold
  
  const sparql = `
    SELECT ?person ?personLabel ?personDescription ?birthDate ?deathDate ?image ?nationality ?nationalityLabel ?occupation ?occupationLabel ?sitelinks WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P569 ?birthDate .
      FILTER (MONTH(?birthDate) = ${month} && DAY(?birthDate) = ${day})
      FILTER (YEAR(?birthDate) >= ${yearStart} && YEAR(?birthDate) <= ${yearEnd})
      OPTIONAL { ?person wdt:P570 ?deathDate . }
      OPTIONAL { ?person wdt:P18 ?image . }
      OPTIONAL { ?person wdt:P27 ?nationality . }
      OPTIONAL { ?person wdt:P106 ?occupation . }
      OPTIONAL { ?person wikibase:sitelinks ?sitelinks . }
      FILTER (?sitelinks >= ${minImportance})
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;
  
  const data = await query(sparql);
  return parseBindings(data, {
    wikidata_id: 'person',
    title: 'personLabel',
    description: 'personDescription',
    date: 'birthDate',
    death_date: 'deathDate',
    image_url: 'image',
    nationality: 'nationalityLabel',
    occupation: 'occupationLabel',
    sitelinks: 'sitelinks'
  });
}

/**
 * Fetch notable deaths for a given month + day.
 * @param {number} month
 * @param {number} day
 * @param {object} opts
 * @returns {Promise<object[]>}
 */
async function fetchDeathsForDay(month, day, opts = {}) {
  const limit = opts.limit || 100;
  const yearStart = opts.yearStart || 1500;
  const yearEnd = opts.yearEnd || new Date().getFullYear();
  const minImportance = opts.minImportance || 1;
  
  const sparql = `
    SELECT ?person ?personLabel ?personDescription ?birthDate ?deathDate ?image ?nationality ?nationalityLabel ?occupation ?occupationLabel ?sitelinks WHERE {
      ?person wdt:P31 wd:Q5 .
      ?person wdt:P570 ?deathDate .
      FILTER (MONTH(?deathDate) = ${month} && DAY(?deathDate) = ${day})
      FILTER (YEAR(?deathDate) >= ${yearStart} && YEAR(?deathDate) <= ${yearEnd})
      OPTIONAL { ?person wdt:P569 ?birthDate . }
      OPTIONAL { ?person wdt:P18 ?image . }
      OPTIONAL { ?person wdt:P27 ?nationality . }
      OPTIONAL { ?person wdt:P106 ?occupation . }
      OPTIONAL { ?person wikibase:sitelinks ?sitelinks . }
      FILTER (?sitelinks >= ${minImportance})
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}
  `;
  
  const data = await query(sparql);
  return parseBindings(data, {
    wikidata_id: 'person',
    title: 'personLabel',
    description: 'personDescription',
    date: 'deathDate',
    birth_date: 'birthDate',
    image_url: 'image',
    nationality: 'nationalityLabel',
    occupation: 'occupationLabel',
    sitelinks: 'sitelinks'
  });
}

/**
 * Convert Wikidata Q-ID country to ISO 3166-1 alpha-2 code.
 * Uses a built-in lookup table for the top 250 countries.
 */
const COUNTRY_QID_TO_ISO = {
  'Q30': 'US', 'Q145': 'GB', 'Q148': 'CN', 'Q17': 'JP', 'Q20': 'NO',
  'Q183': 'DE', 'Q142': 'FR', 'Q38': 'IT', 'Q29': 'ES', 'Q31': 'BE',
  'Q55': 'NL', 'Q39': 'CH', 'Q40': 'AT', 'Q45': 'PT', 'Q218': 'RO',
  'Q36': 'HU', 'Q213': 'CZ', 'Q214': 'SK', 'Q221': 'MD', 'Q212': 'UA',
  'Q159': 'RU', 'Q184': 'BY', 'Q191': 'EE', 'Q20': 'NO', 'Q34': 'SE',
  'Q35': 'DK', 'Q33': 'FI', 'Q211': 'LV', 'Q37': 'LT', 'Q215': 'PL',
  'Q219': 'BG', 'Q224': 'GR', 'Q229': 'CY', 'Q41': 'AD', 'Q228': 'ME',
  'Q236': 'AT', // duplicate
  'Q77': 'UY', 'Q155': 'BR', 'Q414': 'AR', 'Q298': 'CL', 'Q419': 'PE',
  'Q739': 'CO', 'Q717': 'VE', 'Q584': 'BO', 'Q733': 'PY', 'Q77': 'UY',
  'Q750': 'BO',
  'Q96': 'MX', 'Q77': 'BO', 'Q586': 'PA', 'Q792': 'GT', 'Q774': 'HN',
  'Q800': 'NI', 'Q810': 'CR', 'Q804': 'PA',
  'Q117': 'EG', 'Q114': 'KE', 'Q258': 'ZA', 'Q916': 'NG', 'Q79': 'EG',
  'Q1022': 'ET', 'Q948': 'TZ', 'Q924': 'TZ', 'Q262': 'DZ', 'Q1027': 'MA',
  'Q43': 'TR', 'Q794': 'IR', 'Q668': 'IN', 'Q881': 'PK', 'Q902': 'BD',
  'Q869': 'TH', 'Q252': 'ID', 'Q928': 'PH', 'Q334': 'SG', 'Q884': 'KR',
  'Q865': 'TW', 'Q424': 'KH', 'Q236': 'HK',
  'Q408': 'AU', 'Q664': 'NZ', 'Q691': 'PG', 'Q712': 'FJ',
  'Q878': 'AE', 'Q398': 'BH', 'Q656': 'QA', 'Q817': 'KW', 'Q382': 'SA',
  'Q219060': 'IL', 'Q801': 'LB', 'Q810': 'JO', 'Q878': 'OM',
  'Q1011': 'NA', 'Q258': 'ZA', 'Q953': 'ZW', 'Q1032': 'NE', 'Q1007': 'ML',
  'Q1008': 'ML',
  'Q1027': 'MA', 'Q1028': 'MA',
  'Q232': 'AZ', 'Q230': 'GE', 'Q399': 'AM', 'Q574': 'TM', 'Q863': 'UZ',
  'Q232': 'KZ', 'Q711': 'MN', 'Q884': 'KP'
};

function qidToCountryCode(qid) {
  if (!qid) return null;
  const id = qid.replace('http://www.wikidata.org/entity/', '');
  return COUNTRY_QID_TO_ISO[id] || null;
}

/**
 * Look up ISO code for a country name.
 * Used as fallback when we have a country name but not a Q-ID.
 */
const COUNTRY_NAME_TO_ISO = {
  'United States': 'US', 'United Kingdom': 'GB', 'Great Britain': 'GB',
  'China': 'CN', 'Japan': 'JP', 'Germany': 'DE', 'France': 'FR',
  'Italy': 'IT', 'Spain': 'ES', 'Belgium': 'BE', 'Netherlands': 'NL',
  'Switzerland': 'CH', 'Austria': 'AT', 'Portugal': 'PT', 'Romania': 'RO',
  'Hungary': 'HU', 'Czech Republic': 'CZ', 'Slovakia': 'SK', 'Ukraine': 'UA',
  'Russia': 'RU', 'Sweden': 'SE', 'Denmark': 'DK', 'Finland': 'FI',
  'Poland': 'PL', 'Bulgaria': 'BG', 'Greece': 'GR', 'Cyprus': 'CY',
  'Brazil': 'BR', 'Argentina': 'AR', 'Chile': 'CL', 'Peru': 'PE',
  'Colombia': 'CO', 'Venezuela': 'VE', 'Mexico': 'MX', 'Cuba': 'CU',
  'Egypt': 'EG', 'South Africa': 'ZA', 'Nigeria': 'NG', 'Kenya': 'KE',
  'Turkey': 'TR', 'Iran': 'IR', 'India': 'IN', 'Pakistan': 'PK',
  'Bangladesh': 'BD', 'Thailand': 'TH', 'Indonesia': 'ID', 'Philippines': 'PH',
  'Singapore': 'SG', 'South Korea': 'KR', 'North Korea': 'KP', 'Taiwan': 'TW',
  'Australia': 'AU', 'New Zealand': 'NZ', 'Israel': 'IL', 'Saudi Arabia': 'SA',
  'United Arab Emirates': 'AE', 'Qatar': 'QA', 'Kuwait': 'KW', 'Lebanon': 'LB',
  'Jordan': 'JO', 'Morocco': 'MA', 'Algeria': 'DZ', 'Ethiopia': 'ET',
  'Tanzania': 'TZ', 'Mongolia': 'MN', 'Kazakhstan': 'KZ', 'Uzbekistan': 'UZ',
  'Vietnam': 'VN', 'Malaysia': 'MY', 'Myanmar': 'MM', 'Cambodia': 'KH',
  'Hong Kong': 'HK', 'Iceland': 'IS', 'Ireland': 'IE', 'Norway': 'NO',
  'Luxembourg': 'LU', 'Monaco': 'MC', 'Liechtenstein': 'LI', 'Malta': 'MT'
};

function countryNameToIso(name) {
  if (!name) return null;
  return COUNTRY_NAME_TO_ISO[name] || null;
}

/**
 * Determine region from country code.
 */
const COUNTRY_TO_REGION = {
  US: 'north_america', CA: 'north_america', MX: 'north_america',
  BR: 'south_america', AR: 'south_america', CL: 'south_america', PE: 'south_america', CO: 'south_america', VE: 'south_america',
  GB: 'europe', FR: 'europe', DE: 'europe', IT: 'europe', ES: 'europe', NL: 'europe',
  CH: 'europe', AT: 'europe', PT: 'europe', RO: 'europe', HU: 'europe', CZ: 'europe',
  SK: 'europe', UA: 'europe', RU: 'europe', SE: 'europe', DK: 'europe', FI: 'europe',
  PL: 'europe', BG: 'europe', GR: 'europe', IE: 'europe', NO: 'europe', BE: 'europe',
  CN: 'asia', JP: 'asia', IN: 'asia', KR: 'asia', KP: 'asia', TW: 'asia', HK: 'asia',
  TH: 'asia', ID: 'asia', PH: 'asia', SG: 'asia', VN: 'asia', MY: 'asia', MM: 'asia',
  KH: 'asia', MN: 'asia', KZ: 'asia', UZ: 'asia', PK: 'asia', BD: 'asia', LK: 'asia',
  AE: 'middle_east', SA: 'middle_east', IR: 'middle_east', IL: 'middle_east',
  QA: 'middle_east', KW: 'middle_east', LB: 'middle_east', JO: 'middle_east',
  EG: 'africa', ZA: 'africa', NG: 'africa', KE: 'africa', MA: 'africa', DZ: 'africa',
  ET: 'africa', TZ: 'africa', GH: 'africa',
  AU: 'oceania', NZ: 'oceania', PG: 'oceania', FJ: 'oceania'
};

function countryToRegion(countryCode) {
  return COUNTRY_TO_REGION[countryCode] || 'global';
}

/**
 * Parse SPARQL JSON bindings into a flat array of objects.
 * @param {object} data - SPARQL JSON response
 * @param {object} fieldMap - { ourField: sparqlField }
 * @returns {object[]}
 */
function parseBindings(data, fieldMap) {
  const bindings = data.results?.bindings || [];
  const results = [];
  
  for (const binding of bindings) {
    const row = {};
    for (const [ourField, sparqlField] of Object.entries(fieldMap)) {
      const value = binding[sparqlField]?.value;
      if (value === undefined) continue;
      
      // Convert based on type
      if (sparqlField === 'item' || sparqlField === 'person') {
        row[ourField] = value.replace('http://www.wikidata.org/entity/', '');
      } else if (sparqlField === 'date' || sparqlField === 'birthDate' || sparqlField === 'deathDate' || sparqlField === 'endDate') {
        // ISO datetime → just keep the date part
        row[ourField] = value.split('T')[0];
        // Also extract year/month/day
        const [y, m, d] = row[ourField].split('-').map(Number);
        row.year = y;
        row.month = m;
        row.day = d;
      } else if (sparqlField === 'country' || sparqlField === 'nationality') {
        const qid = value.replace('http://www.wikidata.org/entity/', '');
        row[ourField + '_qid'] = qid;
        row[ourField + '_code'] = qidToCountryCode(qid);
      } else if (sparqlField === 'image') {
        // Convert Wikimedia file URL to a usable thumbnail URL
        row[ourField] = convertImageUrl(value);
      } else if (sparqlField === 'sitelinks') {
        row[ourField] = parseInt(value);
      } else {
        row[ourField] = value;
      }
    }
    
    // Derive country_code from nationality if not set
    if (!row.country_code && row.nationality_code) {
      row.country_code = row.nationality_code;
    }
    
    // Derive region from country
    if (row.country_code) {
      row.region = countryToRegion(row.country_code);
    }
    
    // Calculate importance from sitelinks
    if (row.sitelinks !== undefined) {
      row.importance = row.sitelinks > 100 ? 5 : row.sitelinks > 50 ? 4 : row.sitelinks > 20 ? 3 : row.sitelinks > 5 ? 2 : 1;
    }
    
    results.push(row);
  }
  
  return results;
}

/**
 * Convert a Wikimedia file URL to a thumbnail URL.
 */
function convertImageUrl(url) {
  if (!url) return null;
  // Special:FilePath URLs
  const match = url.match(/Special:FilePath\/(.+)$/);
  if (match) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${match[1]}?width=1200`;
  }
  // upload.wikimedia.org URLs
  if (url.includes('upload.wikimedia.org')) {
    return url;
  }
  return url;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  query,
  fetchEventsForDay,
  fetchBirthsForDay,
  fetchDeathsForDay,
  qidToCountryCode,
  countryNameToIso,
  countryToRegion,
  parseBindings,
  convertImageUrl,
  // Constants
  WIKIDATA_ENDPOINT,
  COUNTRY_QID_TO_ISO,
  COUNTRY_NAME_TO_ISO,
  COUNTRY_TO_REGION
};
