/**
 * Per-row source provenance library
 *
 * Per Blueprint Ch 6 + Risk #1: every row needs provenance.
 * Per-row CC BY-SA attribution is mandatory.
 *
 * Schema: data_sources JSON array per row:
 *   [{name, url, retrieved_at, license, license_url, attribution_required}, ...]
 *
 * For images: Commons extmetadata returns LicenseShortName, Artist, AttributionRequired.
 *
 * Source: Blueprint Ch 6 (image pipeline) + Risk #1 (CC BY-SA share-alike)
 */

// ============================================================================
// License registry (mirrors otd_sources table in migration 011)
// ============================================================================

const LICENSE_REGISTRY = {
  'wikipedia_feed': {
    name: 'Wikimedia Feed API',
    license: 'CC BY-SA 4.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution_required: 1
  },
  'wikipedia_rest': {
    name: 'Wikipedia REST API (legacy)',
    license: 'CC BY-SA 4.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution_required: 1
  },
  'wikidata_qlever': {
    name: 'Wikidata QLever mirror',
    license: 'CC0',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution_required: 0
  },
  'wikidata_wdqs': {
    name: 'Wikidata Query Service',
    license: 'CC0',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution_required: 0
  },
  'byabbe': {
    name: 'byabbe.se on-this-day',
    license: 'CC BY-SA 4.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution_required: 1
  },
  'muffinlabs': {
    name: 'Muffin Labs history.muffinlabs.com',
    license: 'CC BY-SA 4.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution_required: 1
  },
  'nager_date': {
    name: 'Nager.Date Public Holidays',
    license: 'free-to-use',
    license_url: 'https://date.nager.at/Api',
    attribution_required: 0
  },
  'openholidays': {
    name: 'OpenHolidays API',
    license: 'free-to-use',
    license_url: 'https://openholidaysapi.org',
    attribution_required: 0
  },
  'checkiday': {
    name: 'Checkiday National Day API',
    license: 'free-with-attribution',
    license_url: 'https://apilayer.com/marketplace/checkiday-api',
    attribution_required: 1
  },
  'pageviews': {
    name: 'Wikimedia Pageviews API',
    license: 'CC BY-SA 4.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution_required: 1
  },
  'dbpedia': {
    name: 'DBpedia SPARQL endpoint',
    license: 'CC BY-SA 3.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/3.0/',
    attribution_required: 1
  },
  'commons_api': {
    name: 'Wikimedia Commons API',
    license: 'varies',
    license_url: 'https://commons.wikimedia.org/wiki/Commons:Licensing',
    attribution_required: 1
  }
};

// ============================================================================
// Source URL builders
// ============================================================================

function buildSourceUrl(sourceName, month, day, lang = 'en', year = null) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  switch (sourceName) {
    case 'wikipedia_feed':
      return `https://api.wikimedia.org/feed/v1/wikipedia/${lang}/onthisday/all/${mm}/${dd}`;
    case 'wikipedia_rest':
      return `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm}/${dd}`;
    case 'byabbe':
      return `https://byabbe.se/on-this-day/${month}/${day}/events.json`;
    case 'muffinlabs':
      return `https://history.muffinlabs.com/date/${month}/${day}`;
    case 'nager_date':
      return year ? `https://date.nager.at/api/v3/PublicHolidays/${year}/US` : null;
    case 'day_page': {
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return `https://en.wikipedia.org/wiki/${monthNames[month - 1]}_${day}`;
    }
    case 'pageviews':
      return `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/all-agents/{title}/daily/{start}/{end}`;
    case 'wikidata_qlever':
      return `https://qlever.dev/api/wikidata`;
    case 'wikidata_wdqs':
      return `https://query.wikidata.org/sparql`;
    case 'commons_api':
      return `https://commons.wikimedia.org/w/api.php`;
    default:
      return null;
  }
}

// ============================================================================
// data_sources array builder
// ============================================================================

/**
 * Build a single source provenance record.
 * @param {string} sourceName - Key in LICENSE_REGISTRY
 * @param {string} url
 * @param {string} [retrievedAt] - ISO date
 * @returns {object}
 */
function buildSourceRecord(sourceName, url, retrievedAt = null) {
  const license = LICENSE_REGISTRY[sourceName] || {
    license: 'unknown',
    license_url: null,
    attribution_required: 0
  };
  return {
    name: sourceName,
    label: license.name,
    url: url || buildSourceUrl(sourceName, null, null),
    retrieved_at: retrievedAt || new Date().toISOString().split('T')[0],
    license: license.license,
    license_url: license.license_url,
    attribution_required: license.attribution_required
  };
}

/**
 * Build a complete data_sources JSON array for a row.
 * @param {string[]} sourceNames - source keys
 * @param {string[]} [urls] - optional custom URLs per source
 * @param {string} [retrievedAt] - ISO date
 * @returns {string} JSON string
 */
function buildDataSources(sourceNames, urls = [], retrievedAt = null) {
  if (!Array.isArray(sourceNames)) sourceNames = [sourceNames];
  const records = sourceNames.map((name, i) =>
    buildSourceRecord(name, urls[i], retrievedAt)
  );
  return JSON.stringify(records);
}

// ============================================================================
// Image provenance (Commons extmetadata)
// ============================================================================

/**
 * Parse Commons extmetadata response into a clean image provenance object.
 * @param {object} extmetadata
 * @returns {object}
 */
function parseCommonsExtMetadata(extmetadata) {
  if (!extmetadata) return null;

  return {
    image_license: extmetadata.LicenseShortName?.value || null,
    image_credit: extmetadata.Artist?.value || null,
    image_source_url: extmetadata.LicenseUrl?.value || null,
    image_license_url: extmetadata.LicenseUrl?.value || null,
    image_attribution_required: extmetadata.AttributionRequired?.value === 'true' ? 1 : 0
  };
}

/**
 * Build a Commons extmetadata API URL for a file.
 * @param {string} filename - e.g. "Apollo 11.jpg"
 * @returns {string}
 */
function commonsExtMetadataUrl(filename) {
  const f = encodeURIComponent(`File:${filename}`);
  return `https://commons.wikimedia.org/w/api.php?action=query&titles=${f}&prop=imageinfo&iiprop=extmetadata%7Curl%7Csize&iiurlwidth=1200&format=json`;
}

// ============================================================================
// Fair-use thumbnail detection (per Blueprint Ch 6)
// ============================================================================

const FAIR_USE_PATH_PREFIXES = [
  '/wikipedia/en/',   // English Wikipedia fair-use
];

/**
 * Check if a URL is a fair-use thumbnail (must NOT be hotlinked per Blueprint Ch 6).
 * @param {string} url
 * @returns {boolean}
 */
function isFairUseUrl(url) {
  if (!url) return false;
  return FAIR_USE_PATH_PREFIXES.some(prefix => url.includes(prefix));
}

/**
 * Filter out fair-use URLs from a thumbnail list.
 * @param {string[]} urls
 * @returns {string[]}
 */
function filterFairUse(urls) {
  if (!Array.isArray(urls)) return [];
  return urls.filter(u => !isFairUseUrl(u));
}

// ============================================================================
// Attribution string builder (for HTML footers)
// ============================================================================

/**
 * Build the standard CC BY-SA attribution string for the page footer.
 * Per Blueprint Ch 6 (image pipeline) + Ch 7 (page templates).
 * @param {string[]} sourceNames
 * @returns {string}
 */
function buildAttributionString(sourceNames) {
  if (!Array.isArray(sourceNames)) sourceNames = [sourceNames];

  // Group sources by license
  const groups = {};
  for (const name of sourceNames) {
    const license = LICENSE_REGISTRY[name];
    if (!license) continue;
    const key = `${license.license}|${license.license_url}`;
    if (!groups[key]) groups[key] = { license: license.license, license_url: license.license_url, sources: [] };
    groups[key].sources.push(license.name);
  }

  const parts = Object.values(groups).map(g => {
    const sourceList = [...new Set(g.sources)].join(' and ');
    return `Text from ${sourceList}, licensed under <a href="${g.license_url}" rel="license">${g.license}</a>`;
  });

  return parts.join('; ');
}

/**
 * Build a JSON-LD attribution block for the page.
 * @param {object} entry
 * @returns {object}
 */
function buildAttributionJsonLd(entry) {
  const sources = entry.data_sources ? JSON.parse(entry.data_sources) : [];
  return {
    '@type': 'CreativeWork',
    'isBasedOn': sources.map(s => ({
      '@type': 'CreativeWork',
      'name': s.label || s.name,
      'url': s.url,
      'license': s.license,
      'licenseUrl': s.license_url
    }))
  };
}

module.exports = {
  LICENSE_REGISTRY,
  buildSourceUrl,
  buildSourceRecord,
  buildDataSources,
  parseCommonsExtMetadata,
  commonsExtMetadataUrl,
  isFairUseUrl,
  filterFairUse,
  buildAttributionString,
  buildAttributionJsonLd
};
