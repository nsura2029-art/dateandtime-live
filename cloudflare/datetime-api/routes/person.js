/**
 * Person API routes
 *
 * Per Blueprint Ch 7 (T5 person pages, T6 birthday-twin):
 *   GET /api/v1/person/{slug}              per-person detail (image, brief desc, all data)
 *   GET /api/v1/person/today              today's birthdays (top N)
 *   GET /api/v1/person/born/{MM-DD}       birthday-twin (top N per date)
 *   GET /api/v1/person/{slug}/onthisday   all OTD entries mentioning this person
 *
 * Response shape locked (per user 2026-07-20):
 *   { name, wikidataId, birthDate, deathDate, starSign, chineseZodiac, generation,
 *     ageAtDeath, currentAge, causeOfDeath, profession, countryCode, country,
 *     image: {url, license, credit, artist, dimensions},
 *     briefDescription, longDescription,
 *     relatedEvents, onthisdayEntries, sources, citations, knowledgeGraphLinks }
 */

import { queryEntity, getEntriesForEntity, attributionBlock, CACHE_HEADERS, TODAY_CACHE_HEADERS } from '../lib/d1.js';
import { loadEntityFromFile, loadEntriesForEntityFromFiles, loadBornOnFromFiles, useFileFallback } from '../lib/fallback.js';

const PERSON_CACHE = { ...CACHE_HEADERS };
const TODAY_CACHE = { ...TODAY_CACHE_HEADERS };

/**
 * GET /api/v1/person/{slug}
 * Per-person detail page. Slug can be a Wikidata Q-ID ("Q937")
 * or a Wikipedia-style title ("Einstein", "albert_einstein", "Brian_May").
 */
export async function handlePerson(env, slug) {
  if (!slug) {
    return json({ error: 'Missing person slug' }, 400, PERSON_CACHE);
  }

  let person = null;
  let onthisdayEntries = [];

  if (useFileFallback(env)) {
    person = await loadEntityFromFile(slug, env);
    if (person) {
      onthisdayEntries = await loadEntriesForEntityFromFiles(person.id, env);
    }
  } else {
    // D1 path
    person = await queryEntity(env.OTD_DB, {
      id: /^Q\d+$/i.test(slug) ? slug : null,
      slug: !/^Q\d+$/i.test(slug) ? slug : null,
      type: 'person',
      minSitelinks: 0,
      limit: 1
    });
    if (person) {
      onthisdayEntries = await getEntriesForEntity(env.OTD_DB, person.id);
    }
  }

  if (!person) {
    return json({
      error: 'Person not found',
      slug,
      hint: 'Try a Wikidata Q-ID (Q937) or a name (einstein, brian_may)'
    }, 404, PERSON_CACHE);
  }

  // Build the response with Knowledge Graph links
  const response = {
    ...person,
    briefDescription: person.description,        // 1-2 sentence bio
    longDescription: person.knownFor,            // Detailed bio (when available)
    onthisdayEntries: onthisdayEntries.slice(0, 50).map(e => ({
      type: e.type,
      year: e.year,
      month: e.month,
      day: e.day,
      title: e.title,
      description: e.description,
      wikipediaUrl: e.wikipediaUrl,
      image: e.image
    })),
    knowledgeGraphLinks: {
      wikidata: person.wikidataId ? `https://www.wikidata.org/wiki/${person.wikidataId}` : null,
      wikipedia: person.wikipediaTitle ? `https://en.wikipedia.org/wiki/${person.wikipediaTitle}` : null,
      bornOnPage: person.birthMonth && person.birthDay
        ? `https://dateandtime.live/onthisday/born/${pad2(person.birthMonth)}-${pad2(person.birthDay)}/`
        : null,
      diedOnPage: person.deathMonth && person.deathDay
        ? `https://dateandtime.live/onthisday/died/${pad2(person.deathMonth)}-${pad2(person.deathDay)}/`
        : null,
      // Person URL on our site (TBD: when person pages are built)
      profile: `https://dateandtime.live/person/${slugify(person.label)}/`
    },
    // Sources for the bio (CC BY-SA attribution)
    sources: person.sources || [
      {
        name: 'wikidata_qlever',
        url: person.wikidataId ? `https://www.wikidata.org/wiki/${person.wikidataId}` : null,
        license: 'CC0',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/'
      },
      {
        name: 'wikipedia',
        url: person.wikipediaTitle ? `https://en.wikipedia.org/wiki/${person.wikipediaTitle}` : null,
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
      }
    ],
    attribution: attributionBlock()
  };

  return json(response, 200, PERSON_CACHE);
}

/**
 * GET /api/v1/person/today?date=MM-DD&limit=5
 * Today's birthdays — top N famous people born on this date.
 * If date is omitted, uses today (UTC).
 */
export async function handleTodaysBirthdays(env, request) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '5', 10);
  const dateParam = url.searchParams.get('date');   // MM-DD
  const countryCode = url.searchParams.get('country');  // optional filter

  const { month, day } = parseMonthDay(dateParam, new Date());

  let persons = [];

  if (useFileFallback(env)) {
    persons = await loadBornOnFromFiles(month, day, { limit, env });
  } else {
    // D1: find persons born on this (month, day)
    const sql = `
      SELECT * FROM otd_entities
      WHERE birth_month = ? AND birth_day = ?
        AND entity_type = 'person'
      ORDER BY notability_score DESC
      LIMIT ?
    `;
    const result = await env.OTD_DB.prepare(sql).bind(month, day, Math.min(limit, 50)).all();
    persons = (result.results || []).map(row => ({
      // re-map D1 row to public JSON (similar to fallback.js)
      id: row.entity_id,
      label: row.label,
      description: row.description,
      wikidataId: row.wikidata_id,
      birthDate: row.birth_date,
      birthYear: row.birth_year,
      deathDate: row.death_date,
      deathYear: row.death_year,
      countryCode: row.country_code,
      profession: tryJson(row.profession, []),
      starSign: row.star_sign,
      chineseZodiac: row.chinese_zodiac,
      generation: row.generation,
      ageAtDeath: row.age_at_death,
      currentAge: row.current_age,
      image: row.image_url ? {
        url: row.image_url,
        license: row.image_license,
        credit: row.image_artist
      } : null,
      notabilityScore: row.notability_score,
      sitelinks: row.sitelinks,
      knowledgeGraphLinks: {
        wikidata: row.wikidata_id ? `https://www.wikidata.org/wiki/${row.wikidata_id}` : null,
        wikipedia: row.enwiki_title ? `https://en.wikipedia.org/wiki/${row.enwiki_title}` : null,
        bornOnPage: `https://dateandtime.live/onthisday/born/${pad2(month)}-${pad2(day)}/`,
        profile: row.wikidata_id ? `https://dateandtime.live/person/${slugify(row.label)}/` : null
      }
    }));

    if (countryCode) {
      persons = persons.filter(p => p.countryCode === countryCode);
    }
  }

  return json({
    date: `${pad2(month)}-${pad2(day)}`,
    month,
    day,
    total: persons.length,
    persons: persons.slice(0, limit).map(p => ({
      id: p.id || p.wikidataId,
      label: p.label,
      birthYear: p.birthYear,
      deathYear: p.deathYear,
      countryCode: p.countryCode,
      profession: p.profession,
      starSign: p.starSign,
      chineseZodiac: p.chineseZodiac,
      generation: p.generation,
      ageAtDeath: p.ageAtDeath,
      currentAge: p.currentAge,
      image: p.image,
      briefDescription: p.description,
      knowledgeGraphLinks: p.knowledgeGraphLinks,
      wikipediaUrl: p.wikipediaUrl || (p.id ? `https://en.wikipedia.org/wiki/${p.id}` : null)
    })),
    attribution: attributionBlock()
  }, 200, TODAY_CACHE);
}

/**
 * GET /api/v1/person/born/{MM-DD}?limit=50
 * Birthday-twin tool data — top N famous people born on a given (month, day).
 * Used by the "if you were born on this day" tool.
 */
export async function handleBirthdayTwin(env, mmdd, request) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  const match = mmdd.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return json({ error: 'Invalid date format. Use MM-DD' }, 400, PERSON_CACHE);
  }
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);

  let persons = [];

  if (useFileFallback(env)) {
    persons = await loadBornOnFromFiles(month, day, { limit, env });
  } else {
    const sql = `
      SELECT * FROM otd_entities
      WHERE birth_month = ? AND birth_day = ?
        AND entity_type = 'person'
      ORDER BY notability_score DESC
      LIMIT ?
    `;
    const result = await env.OTD_DB.prepare(sql).bind(month, day, Math.min(limit, 100)).all();
    persons = result.results || [];
  }

  return json({
    date: mmdd,
    month,
    day,
    total: persons.length,
    persons: persons.slice(0, limit).map(p => ({
      id: p.entity_id || p.id,
      wikidataId: p.wikidata_id || p.wikidataId,
      label: p.label,
      birthYear: p.birth_year || p.birthYear,
      deathYear: p.death_year || p.deathYear,
      countryCode: p.country_code || p.countryCode,
      profession: tryJson(p.profession, []),
      starSign: p.star_sign || p.starSign,
      chineseZodiac: p.chinese_zodiac || p.chineseZodiac,
      generation: p.generation,
      image: p.image_url ? {
        url: p.image_url,
        license: p.image_license,
        credit: p.image_artist
      } : (p.image || null),
      knowledgeGraphLinks: {
        wikidata: (p.wikidata_id || p.wikidataId) ? `https://www.wikidata.org/wiki/${p.wikidata_id || p.wikidataId}` : null,
        wikipedia: (p.enwiki_title || p.wikipediaTitle) ? `https://en.wikipedia.org/wiki/${p.enwiki_title || p.wikipediaTitle}` : null
      }
    })),
    attribution: attributionBlock()
  }, 200, PERSON_CACHE);
}

/**
 * GET /api/v1/person/{slug}/onthisday
 * All onthisday entries that mention this person.
 */
export async function handlePersonOnThisDay(env, slug) {
  if (!slug) {
    return json({ error: 'Missing person slug' }, 400, PERSON_CACHE);
  }

  // First find the entity
  let person = null;
  if (useFileFallback(env)) {
    person = await loadEntityFromFile(slug, env);
  } else {
    person = await queryEntity(env.OTD_DB, {
      id: /^Q\d+$/i.test(slug) ? slug : null,
      slug: !/^Q\d+$/i.test(slug) ? slug : null,
      type: 'person',
      limit: 1
    });
  }

  if (!person) {
    return json({ error: 'Person not found' }, 404, PERSON_CACHE);
  }

  let entries = [];
  if (useFileFallback(env)) {
    entries = await loadEntriesForEntityFromFiles(person.id, env);
  } else {
    const sql = `
      SELECT * FROM onthisday
      WHERE wikidata_id = ? OR entity2_id = ?
      ORDER BY rank_score DESC, year DESC
      LIMIT 200
    `;
    const result = await env.OTD_DB.prepare(sql).bind(person.id, person.id).all();
    entries = result.results || [];
  }

  return json({
    person: {
      id: person.id,
      label: person.label,
      wikidataId: person.id,
      birthDate: person.birthDate,
      deathDate: person.deathDate
    },
    total: entries.length,
    entries: entries.map(e => ({
      type: e.type,
      year: e.year,
      month: e.month,
      day: e.day,
      title: e.title,
      description: e.description,
      wikipediaUrl: e.wikipediaUrl || e.wikipedia_url,
      image: e.image
    })),
    attribution: attributionBlock()
  }, 200, PERSON_CACHE);
}

// ============================================================================
// Route registration
// ============================================================================

/**
 * Main router for /api/v1/person/*
 * Returns null if no route matched.
 */
export async function handle(env, path, request) {
  // GET /api/v1/person/today
  if (path === '/api/v1/person/today') {
    return handleTodaysBirthdays(env, request);
  }

  // GET /api/v1/person/born/{MM-DD}
  let m = path.match(/^\/api\/v1\/person\/born\/(\d{1,2}-\d{1,2})$/);
  if (m) {
    return handleBirthdayTwin(env, m[1], request);
  }

  // GET /api/v1/person/{slug}/onthisday
  m = path.match(/^\/api\/v1\/person\/([^/]+)\/onthisday$/);
  if (m) {
    return handlePersonOnThisDay(env, m[1]);
  }

  // GET /api/v1/person/{slug}
  m = path.match(/^\/api\/v1\/person\/([^/]+)$/);
  if (m) {
    return handlePerson(env, m[1]);
  }

  return null;
}

// ============================================================================
// Utilities
// ============================================================================

function json(data, status = 200, headers = CACHE_HEADERS) {
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

function pad2(n) { return String(n).padStart(2, '0'); }

function slugify(label) {
  if (!label) return '';
  return String(label).toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function parseMonthDay(param, fallback) {
  if (param) {
    const m = param.match(/^(\d{1,2})-(\d{1,2})$/);
    if (m) return { month: parseInt(m[1], 10), day: parseInt(m[2], 10) };
  }
  return { month: fallback.getUTCMonth() + 1, day: fallback.getUTCDate() };
}

function tryJson(s, fallback) {
  if (!s) return fallback;
  if (typeof s === 'object') return s;  // already parsed
  try { return JSON.parse(s); } catch (e) { return fallback; }
}
