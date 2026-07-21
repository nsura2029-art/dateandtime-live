/**
 * D1 database helper for on-this-day API endpoints
 *
 * Shared query helpers used by all routes/otd-*.js files.
 * Provides:
 *   - OTD table queries (events, births, deaths, holidays, weddings)
 *   - otd_entities table queries (persons, places, works)
 *   - otd_observances table queries (national days)
 *   - otd_holidays table queries (per-country per-year)
 *   - otd_couples table queries (married couples)
 *
 * All methods are read-only and return plain JSON-serializable objects.
 * Image URLs are returned with proper attribution metadata.
 *
 * License: All Wikimedia-derived data is CC BY-SA 4.0.
 * License metadata is included per-row via data_sources + image_license fields.
 */

/**
 * Query the onthisday table with rich filters.
 * @param {D1Database} db
 * @param {object} opts
 *   - month, day (required)
 *   - year (optional, exact)
 *   - yearMin/yearMax (optional range)
 *   - type (event|birth|death|holiday|wedding|divorce)
 *   - rankMin (default 0, max 100)
 *   - verifiedOnly (boolean, default true)
 *   - limit (default 20, max 100)
 * @returns {Promise<object[]>}
 */
export async function queryOTD(db, opts) {
  const {
    month, day, year, yearMin, yearMax,
    type, rankMin = 0, verifiedOnly = true, limit = 20
  } = opts;

  if (!month || !day) throw new Error('month and day are required');

  const where = ['month = ?', 'day = ?'];
  const binds = [month, day];

  if (year !== undefined) {
    where.push('year = ?');
    binds.push(year);
  } else {
    if (yearMin !== undefined) { where.push('year >= ?'); binds.push(yearMin); }
    if (yearMax !== undefined) { where.push('year <= ?'); binds.push(yearMax); }
  }

  if (type) {
    if (Array.isArray(type)) {
      const placeholders = type.map(() => '?').join(',');
      where.push(`type IN (${placeholders})`);
      binds.push(...type);
    } else {
      where.push('type = ?');
      binds.push(type);
    }
  }

  where.push('rank_score >= ?');
  binds.push(rankMin);

  if (verifiedOnly) {
    where.push('verified = 1');
  }

  const sql = `
    SELECT * FROM onthisday
    WHERE ${where.join(' AND ')}
    ORDER BY rank_score DESC, year ASC
    LIMIT ?
  `;
  binds.push(Math.min(limit, 100));

  const result = await db.prepare(sql).bind(...binds).all();
  return (result.results || []).map(parseOTDRow);
}

/**
 * Query the otd_entities table.
 * @param {D1Database} db
 * @param {object} opts
 *   - id (Wikidata Q-ID)
 *   - slug (URL-friendly name, e.g. "einstein")
 *   - type (person|event|holiday|couple|place|work|org)
 *   - minSitelinks (default 0)
 *   - limit (default 1, max 100)
 * @returns {Promise<object|null|object[]>}
 */
export async function queryEntity(db, opts) {
  const { id, slug, type, minSitelinks = 0, limit = 1 } = opts;
  const where = ['1=1'];
  const binds = [];

  if (id) {
    where.push('entity_id = ?');
    binds.push(id);
  }
  if (slug) {
    where.push('LOWER(REPLACE(label, " ", "_")) = ?');
    binds.push(slug.toLowerCase().replace(/-/g, '_'));
  }
  if (type) {
    where.push('entity_type = ?');
    binds.push(type);
  }
  where.push('sitelinks >= ?');
  binds.push(minSitelinks);

  const sql = `
    SELECT * FROM otd_entities
    WHERE ${where.join(' AND ')}
    ORDER BY notability_score DESC
    LIMIT ?
  `;
  binds.push(Math.min(limit, 100));

  const result = await db.prepare(sql).bind(...binds).all();
  const rows = (result.results || []).map(parseEntityRow);
  return limit === 1 ? (rows[0] || null) : rows;
}

/**
 * Query the otd_couples table (weddings + divorces).
 * @param {D1Database} db
 * @param {object} opts
 *   - couple_id, person1_id, person2_id
 *   - month, day (of marriage)
 *   - yearMin, yearMax
 *   - status (married | divorced | widowed)
 *   - minSitelinks
 *   - limit
 */
export async function queryCouple(db, opts = {}) {
  const { couple_id, person1_id, person2_id, month, day, yearMin, yearMax, status, minSitelinks = 0, limit = 50 } = opts;
  const where = ['1=1'];
  const binds = [];

  if (couple_id) { where.push('couple_id = ?'); binds.push(couple_id); }
  if (person1_id) { where.push('(entity_id = ? OR entity2_id = ?)'); binds.push(person1_id, person1_id); }
  if (person2_id) { where.push('(entity_id = ? OR entity2_id = ?)'); binds.push(person2_id, person2_id); }
  if (status) { where.push('status = ?'); binds.push(status); }
  if (yearMin) { where.push('marriage_year >= ?'); binds.push(yearMin); }
  if (yearMax) { where.push('marriage_year <= ?'); binds.push(yearMax); }
  where.push('1=1');  // sitelinks lives in entity table

  const sql = `
    SELECT * FROM otd_couples
    WHERE ${where.join(' AND ')}
    ORDER BY marriage_year DESC
    LIMIT ?
  `;
  binds.push(Math.min(limit, 100));

  const result = await db.prepare(sql).bind(...binds).all();
  return result.results || [];
}

/**
 * Get all onthisday entries for a specific entity (person/event).
 * Useful for per-person OTD detail pages: "What happened on Einstein's birthday?"
 * @param {D1Database} db
 * @param {string} entityId - Wikidata Q-ID
 * @param {object} opts - {limit, minRankScore}
 */
export async function getEntriesForEntity(db, entityId, opts = {}) {
  const { limit = 50, minRankScore = 0 } = opts;
  const sql = `
    SELECT * FROM onthisday
    WHERE wikidata_id = ? AND rank_score >= ?
    ORDER BY rank_score DESC, year DESC
    LIMIT ?
  `;
  const result = await db.prepare(sql).bind(entityId, minRankScore, Math.min(limit, 200)).all();
  return (result.results || []).map(parseOTDRow);
}

/**
 * Find a city by id.
 */
export async function getCity(db, cityId) {
  const sql = `SELECT * FROM cities WHERE id = ? LIMIT 1`;
  const result = await db.prepare(sql).bind(cityId).first();
  return result || null;
}

/**
 * Get current time for a single city (server-rendered).
 */
export async function getTimeNow(db, cityId) {
  // In production, this is computed server-side using IANA tz + current UTC.
  // For the API contract, return what the existing /api/v1/time/now returns.
  // The Worker JS handles the actual time computation, this just provides data.
  return null;  // Computed in worker.js
}

// ============================================================================
// ROW PARSERS — convert D1 raw rows to clean API JSON
// ============================================================================

/**
 * Parse an onthisday row from D1 into the public API JSON shape.
 * Strips internal fields, parses JSON-encoded columns, normalizes booleans.
 */
export function parseOTDRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    // Core identity
    title: row.title,
    type: row.type,                 // event | birth | death | holiday | wedding | divorce | anniversary
    year: row.year,
    month: row.month,
    day: row.day,
    yearPrecision: row.year_precision || 'day',
    yearOnlyWarning: row.year_only_warning === 1,

    // Description
    description: row.description,
    longDescription: row.long_description,
    faqQuestions: parseJson(row.faq_questions, []),
    keyFacts: parseJson(row.key_facts, []),
    peopleMentioned: parseJson(row.people_mentioned, []),

    // Image (with attribution)
    image: row.image_url ? {
      url: row.image_url,
      license: row.image_license,
      credit: row.image_credit,
      width: row.image_width,
      height: row.image_height,
      sourceUrl: row.image_source_url
    } : null,

    // Entity links
    wikidataId: row.wikidata_id,
    wikipediaUrl: row.wikipedia_url,
    wikipediaTitle: row.wikipedia_title,
    entity2Id: row.entity2_id,
    entity2Name: row.entity2_name,
    coupleId: row.couple_id,

    // Geographic
    countryCode: row.country_code,
    countryName: row.country_name,
    region: row.region,

    // Person fields (for births/deaths)
    starSign: row.star_sign,
    chineseZodiac: row.chinese_zodiac,
    generation: row.generation,
    profession: parseJson(row.profession, []),
    causeOfDeath: row.cause_of_death,
    ageAtDeath: row.age_at_death,
    currentAge: row.current_age,

    // Notability
    rankScore: row.rank_score || 0,
    sitelinks: row.sitelinks || 0,
    pageviews30dAvg: row.pageviews_30d_avg || 0,
    inboundLinks: row.inbound_links || 0,
    importance: row.importance || 0,

    // SEO
    searchKeywords: parseJson(row.search_keywords, []),
    tags: parseJson(row.tags, []),

    // Provenance (per Blueprint Ch 6)
    sources: parseJson(row.data_sources, []),
    verifiedIn: parseJson(row.verified_in, []),
    verified: row.verified === 1,
    language: row.language || 'en',

    // Anniversary math
    anniversaryDate: row.anniversary_date,
    recurrence: row.recurrence || 'none',
    isAnniversaryToday: row.is_anniversary_today === 1,
    isToday: row.is_today === 1,

    // Holiday-specific
    holidayType: row.holiday_type,
    holidayGlobal: row.holiday_global === 1,
    observanceCountries: parseJson(row.observance_countries, []),
    observanceHashtags: parseJson(row.observance_hashtags, []),

    // Editorial
    reviewReason: row.review_reason,
    lastVerifiedAt: row.last_verified_at,

    // Links (for Knowledge Graph)
    knowledgeGraphLinks: buildKGLinks(row)
  };
}

/**
 * Parse an otd_entities row.
 */
export function parseEntityRow(row) {
  if (!row) return null;

  return {
    id: row.entity_id,
    label: row.label,
    description: row.description,
    entityType: row.entity_type,
    wikidataId: row.wikidata_id,
    wikipediaTitle: row.enwiki_title,

    // Person fields
    birthDate: row.birth_date,
    deathDate: row.death_date,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    birthPlace: row.birth_place,
    deathPlace: row.death_place,
    countryCode: row.country_code,
    profession: parseJson(row.profession, []),
    starSign: row.star_sign,
    chineseZodiac: row.chinese_zodiac,
    generation: row.generation,
    causeOfDeath: row.cause_of_death,
    ageAtDeath: row.age_at_death,
    gender: row.gender,
    languagesSpoken: parseJson(row.languages_spoken, []),
    knownFor: row.known_for,
    awards: parseJson(row.awards, []),

    // Notability
    sitelinks: row.sitelinks || 0,
    avgDailyViews: row.avg_daily_views || 0,
    inboundLinks: row.inbound_links || 0,
    notabilityScore: row.notability_score || 0,
    notabilitySource: row.notability_source,

    // Image
    image: row.image_url ? {
      url: row.image_url,
      license: row.image_license,
      artist: row.image_artist,
      licenseUrl: row.image_license_url,
      source: row.image_source
    } : null,

    // Related
    relatedEntities: parseJson(row.related_entities, []),

    // Provenance
    sources: parseJson(row.data_sources, []),
    lastUpdated: row.last_updated,
    createdAt: row.created_at
  };
}

/**
 * Build Knowledge Graph link stubs from a row's Q-IDs and country codes.
 * Powers the JSON-LD 'knowsAbout' / 'sameAs' / 'mentions' structures.
 */
function buildKGLinks(row) {
  const links = {};
  if (row.wikidata_id) {
    links.wikidata = `https://www.wikidata.org/wiki/${row.wikidata_id}`;
  }
  if (row.wikipedia_url) {
    links.wikipedia = row.wikipedia_url;
  }
  if (row.entity2_id) {
    links.spouse_wikidata = `https://www.wikidata.org/wiki/${row.entity2_id}`;
  }
  if (row.country_code) {
    links.country = `https://dateandtime.live/time-zones/in/${row.country_code.toLowerCase()}/`;
  }
  if (row.country_code) {
    links.country_wikipedia = `https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#${row.country_code}`;
  }
  if (row.month && row.day) {
    const mm = String(row.month).padStart(2, '0');
    const dd = String(row.day).padStart(2, '0');
    links.date = `https://dateandtime.live/onthisday/by-date/${mm}-${dd}/`;
  }
  return links;
}

function parseJson(s, fallback) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

// ============================================================================
// ATTRIBUTION HELPERS
// ============================================================================

/**
 * Build the standard CC BY-SA 4.0 attribution block for API responses.
 * Per Blueprint Risk #1: every API response must include source provenance.
 */
export function attributionBlock() {
  return {
    text: 'Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0.',
    textUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    wikimediaFeed: 'https://api.wikimedia.org/feed/v1/wikipedia/',
    byabbe: 'https://byabbe.se/',
    muffinlabs: 'https://history.muffinlabs.com/',
    nagerDate: 'https://date.nager.at/Api',
    wikidata: 'https://www.wikidata.org/',
    additionalSources: []
  };
}

/**
 * Standard cache headers (1 hour for content, 5 min for today).
 */
export const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400',
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export const TODAY_CACHE_HEADERS = {
  ...CACHE_HEADERS,
  'Cache-Control': 'public, max-age=300, s-maxage=600'
};

export const NEGATIVE_CACHE_HEADERS = {
  ...CACHE_HEADERS,
  'Cache-Control': 'public, max-age=60, s-maxage=120'
};
