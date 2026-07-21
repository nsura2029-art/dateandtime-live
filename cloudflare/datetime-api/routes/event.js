/**
 * Event API routes
 *
 * Per Blueprint Ch 7 (per-event OTD detail pages):
 *   GET /api/v1/onthisday/event/{slug}         per-event detail
 *   GET /api/v1/onthisday/event/{slug}/related related events
 *
 * Response shape locked (per user 2026-07-20):
 *   { title, year, type, month, day, briefDescription, longDescription,
 *     keyPeople, keyFacts, faqQuestions, image, citations, sources,
 *     relatedEvents, knowledgeGraphLinks }
 */

import { queryOTD, attributionBlock, CACHE_HEADERS } from '../lib/d1.js';
import { useFileFallback } from '../lib/fallback.js';

const EVENT_CACHE = { ...CACHE_HEADERS };

/**
 * Slug → OTD entry lookup.
 * For file-fallback mode, we search the entire /tmp/otd-data-final/dates/
 * for the entry matching the slug (year-type-title).
 * For D1 mode, we use the wikidata_id or wikipedia_title column.
 */
async function findEntryBySlug(env, slug) {
  // Try wikidata_id first
  if (/^Q\d+$/i.test(slug)) {
    const sql = `SELECT * FROM onthisday WHERE wikidata_id = ? LIMIT 1`;
    const result = await env.OTD_DB.prepare(sql).bind(slug).first();
    if (result) return result;
  }

  // Try wikipedia_title (URL-friendly form)
  const wikiTitle = slug.replace(/-/g, '_');
  const sql = `SELECT * FROM onthisday WHERE LOWER(wikipedia_title) = ? OR LOWER(REPLACE(wikipedia_title, '_', '-')) = ? LIMIT 1`;
  const result = await env.OTD_DB.prepare(sql).bind(wikiTitle.toLowerCase(), slug.toLowerCase()).first();
  if (result) return result;

  // Try matching by year+title
  const yearMatch = slug.match(/^(\d{4})-/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const titleSlug = slug.replace(/^\d{4}-/, '').toLowerCase();
    const sql2 = `
      SELECT * FROM onthisday
      WHERE year = ?
      ORDER BY rank_score DESC
      LIMIT 50
    `;
    const result2 = await env.OTD_DB.prepare(sql2).bind(year).all();
    const matches = (result2.results || []).filter(r => {
      const rSlug = (r.title || '').toLowerCase().replace(/[^\w]+/g, '-');
      return rSlug === titleSlug || rSlug.includes(titleSlug);
    });
    if (matches[0]) return matches[0];
  }

  return null;
}

/**
 * File-fallback version: scan all date files for the slug.
 */
async function findEntryBySlugFromFiles(env, slug) {
  const datesDir = env.OTD_DATES_DIR || '/tmp/otd-data-final/dates';
  const fs = await import('fs/promises');

  // Try wikidata_id
  if (/^Q\d+$/i.test(slug)) {
    try {
      const files = await fs.readdir(datesDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const content = await fs.readFile(`${datesDir}/${file}`, 'utf-8');
        const entries = JSON.parse(content);
        const match = entries.find(e => e.wikidata_id === slug);
        if (match) return match;
      }
    } catch (e) {}
  }

  // Try year-title pattern
  const yearMatch = slug.match(/^(\d{4})-(.+)$/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const titleSlug = yearMatch[2].toLowerCase();
    try {
      const files = await fs.readdir(datesDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const content = await fs.readFile(`${datesDir}/${file}`, 'utf-8');
        const entries = JSON.parse(content);
        const match = entries.find(e => {
          if (e.year !== year) return false;
          const eSlug = slugify(e.title);
          return eSlug === titleSlug || eSlug.includes(titleSlug) || titleSlug.includes(eSlug);
        });
        if (match) return match;
      }
    } catch (e) {}
  }

  // Try by title only (return first match)
  const titleSlug = slug.toLowerCase();
  try {
    const files = await fs.readdir(datesDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const content = await fs.readFile(`${datesDir}/${file}`, 'utf-8');
      const entries = JSON.parse(content);
      const match = entries.find(e => {
        const eSlug = slugify(e.title);
        return eSlug === titleSlug || eSlug.includes(titleSlug) || titleSlug.includes(eSlug);
      });
      if (match) return match;
    }
  } catch (e) {}

  return null;
}

/**
 * GET /api/v1/onthisday/event/{slug}
 * Per-event detail. Slug examples:
 *   Q11631                (Wikidata Q-ID for Apollo 11)
 *   Apollo_11             (Wikipedia title)
 *   1969-apollo-11        (year-title, recommended for SEO)
 *   moon-landing-1969     (any order)
 */
export async function handleEvent(env, slug) {
  if (!slug) {
    return json({ error: 'Missing event slug' }, 400, EVENT_CACHE);
  }

  let entry = null;
  if (useFileFallback(env)) {
    entry = await findEntryBySlugFromFiles(env, slug);
  } else {
    entry = await findEntryBySlug(env, slug);
  }

  if (!entry) {
    return json({
      error: 'Event not found',
      slug,
      hint: 'Try a Wikidata Q-ID (Q11631), Wikipedia title (Apollo_11), or year-title (1969-apollo-11)'
    }, 404, EVENT_CACHE);
  }

  // Find related events (same wikidata_id, different years OR same category, same date)
  const related = await findRelatedEvents(env, entry);

  const response = {
    id: entry.id,
    title: entry.title,
    type: entry.type,
    year: entry.year,
    month: entry.month,
    day: entry.day,
    yearPrecision: entry.year_precision || 'day',

    // Description
    briefDescription: entry.description,
    longDescription: entry.long_description,

    // Structured content
    keyPeople: tryJson(entry.people_mentioned, []),
    keyFacts: tryJson(entry.key_facts, []),
    faqQuestions: tryJson(entry.faq_questions, []),

    // Image with attribution
    image: entry.image_url ? {
      url: entry.image_url,
      license: entry.image_license,
      credit: entry.image_credit,
      width: entry.image_width,
      height: entry.image_height,
      sourceUrl: entry.image_source_url
    } : null,

    // Entity references
    wikidataId: entry.wikidata_id,
    wikipediaUrl: entry.wikipedia_url,
    wikipediaTitle: entry.wikipedia_title,
    countryCode: entry.country_code,
    region: entry.region,

    // For weddings
    entity2Id: entry.entity2_id,
    entity2Name: entry.entity2_name,
    coupleId: entry.couple_id,

    // Anniversary math
    anniversaryDate: entry.anniversary_date,
    yearsAgo: entry.year ? new Date().getFullYear() - entry.year : null,
    isAnniversaryToday: entry.is_anniversary_today === 1,

    // Notability
    rankScore: entry.rank_score || 0,
    importance: entry.importance,

    // SEO
    searchKeywords: tryJson(entry.search_keywords, []),
    tags: tryJson(entry.tags, []),

    // Provenance
    sources: tryJson(entry.data_sources, []),
    verifiedIn: tryJson(entry.verified_in, []),
    verified: entry.verified === 1,

    // Related content
    relatedEvents: related,

    // Knowledge Graph links
    knowledgeGraphLinks: {
      wikidata: entry.wikidata_id ? `https://www.wikidata.org/wiki/${entry.wikidata_id}` : null,
      wikipedia: entry.wikipedia_url,
      date: entry.month && entry.day ? `https://dateandtime.live/onthisday/by-date/${pad2(entry.month)}-${pad2(entry.day)}/` : null,
      country: entry.country_code ? `https://dateandtime.live/time-zones/in/${entry.country_code.toLowerCase()}/` : null
    },

    attribution: attributionBlock()
  };

  return json(response, 200, EVENT_CACHE);
}

/**
 * GET /api/v1/onthisday/event/{slug}/related
 * All events related to this one (same person, same year, same country, etc.)
 */
export async function handleEventRelated(env, slug) {
  if (!slug) {
    return json({ error: 'Missing event slug' }, 400, EVENT_CACHE);
  }

  let entry = null;
  if (useFileFallback(env)) {
    entry = await findEntryBySlugFromFiles(env, slug);
  } else {
    entry = await findEntryBySlug(env, slug);
  }

  if (!entry) {
    return json({ error: 'Event not found' }, 404, EVENT_CACHE);
  }

  const related = await findRelatedEvents(env, entry);
  return json({
    event: { title: entry.title, year: entry.year, month: entry.month, day: entry.day },
    total: related.length,
    related
  }, 200, EVENT_CACHE);
}

/**
 * Find related events: same date, same year, same wikidata entity, etc.
 */
async function findRelatedEvents(env, entry) {
  const related = [];

  // Same date (different years)
  if (entry.month && entry.day) {
    let sameDate = [];
    if (useFileFallback(env)) {
      const fs = await import('fs/promises');
      try {
        const dateKey = `${pad2(entry.month)}-${pad2(entry.day)}`;
        const content = await fs.readFile(`${env.OTD_DATES_DIR || '/tmp/otd-data-final/dates'}/${dateKey}.json`, 'utf-8');
        sameDate = JSON.parse(content);
      } catch (e) {}
    } else {
      const result = await env.OTD_DB.prepare(`
        SELECT * FROM onthisday
        WHERE month = ? AND day = ? AND year != ?
        ORDER BY rank_score DESC LIMIT 10
      `).bind(entry.month, entry.day, entry.year || 0).all();
      sameDate = result.results || [];
    }
    for (const e of sameDate.slice(0, 5)) {
      related.push({
        relation: 'same-date-different-year',
        title: e.title,
        year: e.year,
        type: e.type,
        wikipediaUrl: e.wikipedia_url
      });
    }
  }

  // Same year (different dates)
  if (entry.year) {
    let sameYear = [];
    if (useFileFallback(env)) {
      const fs = await import('fs/promises');
      try {
        const files = await fs.readdir(env.OTD_DATES_DIR || '/tmp/otd-data-final/dates');
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          const content = await fs.readFile(`${env.OTD_DATES_DIR || '/tmp/otd-data-final/dates'}/${file}`, 'utf-8');
          const entries = JSON.parse(content);
          sameYear.push(...entries.filter(e => e.year === entry.year && e.title !== entry.title));
        }
      } catch (e) {}
    } else {
      const result = await env.OTD_DB.prepare(`
        SELECT * FROM onthisday
        WHERE year = ? AND NOT (month = ? AND day = ?)
        ORDER BY rank_score DESC LIMIT 10
      `).bind(entry.year, entry.month, entry.day).all();
      sameYear = result.results || [];
    }
    for (const e of sameYear.slice(0, 3)) {
      related.push({
        relation: 'same-year-different-date',
        title: e.title,
        month: e.month,
        day: e.day,
        type: e.type,
        wikipediaUrl: e.wikipedia_url
      });
    }
  }

  // Same Wikidata entity (different events by same person)
  if (entry.wikidata_id) {
    let sameEntity = [];
    if (useFileFallback(env)) {
      const fs = await import('fs/promises');
      try {
        const files = await fs.readdir(env.OTD_DATES_DIR || '/tmp/otd-data-final/dates');
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          const content = await fs.readFile(`${env.OTD_DATES_DIR || '/tmp/otd-data-final/dates'}/${file}`, 'utf-8');
          const entries = JSON.parse(content);
          sameEntity.push(...entries.filter(e =>
            e.wikidata_id === entry.wikidata_id &&
            e.title !== entry.title
          ));
        }
      } catch (e) {}
    } else {
      const result = await env.OTD_DB.prepare(`
        SELECT * FROM onthisday
        WHERE (wikidata_id = ? OR entity2_id = ?)
        AND title != ?
        ORDER BY rank_score DESC LIMIT 5
      `).bind(entry.wikidata_id, entry.wikidata_id, entry.title).all();
      sameEntity = result.results || [];
    }
    for (const e of sameEntity.slice(0, 3)) {
      related.push({
        relation: 'same-entity',
        title: e.title,
        year: e.year,
        type: e.type,
        wikipediaUrl: e.wikipedia_url
      });
    }
  }

  return related;
}

/**
 * Route registration
 */
export async function handle(env, path, request) {
  // GET /api/v1/onthisday/event/{slug}/related
  let m = path.match(/^\/api\/v1\/onthisday\/event\/([^/]+)\/related$/);
  if (m) {
    return handleEventRelated(env, m[1]);
  }

  // GET /api/v1/onthisday/event/{slug}
  m = path.match(/^\/api\/v1\/onthisday\/event\/([^/]+)$/);
  if (m) {
    return handleEvent(env, m[1]);
  }

  return null;
}

// ============================================================================
// Utilities
// ============================================================================

function json(data, status = 200, headers = EVENT_CACHE) {
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

function pad2(n) { return String(n).padStart(2, '0'); }

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim();
}

function tryJson(s, fallback) {
  if (!s) return fallback;
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}
