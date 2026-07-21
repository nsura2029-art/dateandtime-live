/**
 * API Worker handler for POST /api/v1/onthisday
 *
 * Receives batch entries from the data pipeline and inserts them
 * into the D1 database. Includes:
 *   - Schema validation
 *   - Duplicate detection (by month + day + year + title)
 *   - Quality score calculation
 *   - Quality tier assignment
 *
 * This handler should be added to the existing timeanddatepro
 * API Worker. The handler accepts POST requests with a JSON body
 * containing a single entry.
 *
 * To add to an existing Worker, copy the POST handler and the
 * helper functions (calculateQualityScore, normalizeEntry, etc.)
 *
 * Route: POST /api/v1/onthisday
 * Body: {
 *   month: 1-12,
 *   day: 1-31,
 *   year: number,
 *   title: string,
 *   description: string,
 *   long_description?: string,
 *   wikipedia_url?: string,
 *   image_url?: string,
 *   image_alt?: string,
 *   type: 'event' | 'birth' | 'death' | 'wedding' | 'divorce' | 'bizarre',
 *   category: 'events' | 'births' | 'deaths' | 'politics' | 'science' | 'sports' | 'music' | 'film' | 'tech' | 'finance' | 'currency' | 'health',
 *   subcategory?: string,
 *   importance: 1-5,
 *   country_code?: string,
 *   country_codes?: string[],
 *   region?: string,
 *   search_keywords?: string[],
 *   tags?: string[],
 *   faq_questions?: Array<{q, a}>,
 *   key_facts?: string[],
 *   people_mentioned?: Array<{name, role, wiki_url?}>,
 *   image_status?: string,
 *   image_license?: string,
 *   image_credit?: string,
 *   image_source_url?: string,
 *   image_width?: number,
 *   image_height?: number,
 *   data_sources?: Array<{name, url, retrieved_at}>,
 *   external_id?: string  // Wikidata Q-ID
 * }
 *
 * Response:
 *   201: { success: true, id: number, quality_score: number, quality_tier: string }
 *   400: { success: false, error: { code: 'VALIDATION_ERROR', message: '...' } }
 *   409: { success: false, error: { code: 'DUPLICATE', message: '...', existing_id: number } }
 *   500: { success: false, error: { code: 'INTERNAL', message: '...' } }
 */

// ============================================================================
// VALIDATION
// ============================================================================

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return { valid: false, error: 'Entry must be an object' };
  }

  // Required fields
  if (typeof entry.month !== 'number' || entry.month < 1 || entry.month > 12) {
    return { valid: false, error: 'month must be 1-12' };
  }
  if (typeof entry.day !== 'number' || entry.day < 1 || entry.day > 31) {
    return { valid: false, error: 'day must be 1-31' };
  }
  if (typeof entry.year !== 'number' || entry.year < -3000 || entry.year > 2100) {
    return { valid: false, error: 'year must be between -3000 and 2100' };
  }
  if (typeof entry.title !== 'string' || entry.title.length < 5 || entry.title.length > 200) {
    return { valid: false, error: 'title must be 5-200 characters' };
  }
  if (typeof entry.description !== 'string' || entry.description.length < 50) {
    return { valid: false, error: 'description must be at least 50 characters' };
  }

  // Valid types
  const validTypes = ['event', 'birth', 'death', 'wedding', 'divorce', 'bizarre'];
  if (!validTypes.includes(entry.type)) {
    return { valid: false, error: `type must be one of: ${validTypes.join(', ')}` };
  }

  // Valid categories
  const validCategories = ['events', 'births', 'deaths', 'politics', 'science', 'sports', 'music', 'film', 'tech', 'finance', 'currency', 'health'];
  if (!validCategories.includes(entry.category)) {
    return { valid: false, error: `category must be one of: ${validCategories.join(', ')}` };
  }

  // Importance
  if (typeof entry.importance !== 'number' || entry.importance < 1 || entry.importance > 5) {
    return { valid: false, error: 'importance must be 1-5' };
  }

  // Optional fields validation
  if (entry.image_url && typeof entry.image_url !== 'string') {
    return { valid: false, error: 'image_url must be a string' };
  }
  if (entry.wikipedia_url && typeof entry.wikipedia_url !== 'string') {
    return { valid: false, error: 'wikipedia_url must be a string' };
  }

  return { valid: true };
}

// ============================================================================
// QUALITY SCORE
// ============================================================================

function calculateQualityScore(entry) {
  let score = 0;

  // Image (15)
  if (entry.image_url) score += 15;

  // Long description (15)
  const longDesc = entry.long_description || entry.description;
  if (longDesc && longDesc.length >= 200) {
    score += 15;
  } else if (longDesc && longDesc.length >= 50) {
    score += 7;
  }

  // Short description (10)
  if (entry.description && entry.description.length >= 50) {
    score += 10;
  }

  // Wikipedia URL (10)
  if (entry.wikipedia_url) score += 10;

  // Data sources (5)
  let sources = 0;
  if (Array.isArray(entry.data_sources)) sources = entry.data_sources.length;
  else if (typeof entry.data_sources === 'string') {
    try { sources = JSON.parse(entry.data_sources).length; } catch {}
  }
  if (sources >= 2) score += 5;
  else if (sources >= 1) score += 2;

  // Country (10)
  if (entry.country_code || (Array.isArray(entry.country_codes) && entry.country_codes.length > 0)) {
    score += 10;
  }

  // Category (5)
  if (entry.category) score += 5;

  // People (10)
  let peopleCount = 0;
  if (Array.isArray(entry.people_mentioned)) peopleCount = entry.people_mentioned.length;
  else if (typeof entry.people_mentioned === 'string') {
    try { peopleCount = JSON.parse(entry.people_mentioned).length; } catch {}
  }
  if (peopleCount >= 3) score += 10;
  else if (peopleCount >= 1) score += Math.floor(peopleCount * 10 / 3);

  // Keywords (5)
  let kwCount = 0;
  if (Array.isArray(entry.search_keywords)) kwCount = entry.search_keywords.length;
  else if (typeof entry.search_keywords === 'string') {
    try { kwCount = JSON.parse(entry.search_keywords).length; } catch {}
  }
  if (kwCount >= 5) score += 5;

  // Tags (5)
  let tagCount = 0;
  if (Array.isArray(entry.tags)) tagCount = entry.tags.length;
  else if (typeof entry.tags === 'string') {
    try { tagCount = JSON.parse(entry.tags).length; } catch {}
  }
  if (tagCount >= 3) score += 5;

  // Freshness (5) — assume new = fresh
  score += 5;

  return Math.min(100, score);
}

function getQualityTier(score) {
  if (score >= 90) return 'gold';
  if (score >= 70) return 'silver';
  if (score >= 50) return 'bronze';
  return 'blocked';
}

// ============================================================================
// NORMALIZE
// ============================================================================

function normalizeEntry(entry) {
  return {
    month: entry.month,
    day: entry.day,
    year: entry.year,
    title: entry.title,
    description: entry.description,
    long_description: entry.long_description || null,
    type: entry.type,
    category: entry.category,
    subcategory: entry.subcategory || null,
    importance: entry.importance,
    country_code: entry.country_code || null,
    country_codes: Array.isArray(entry.country_codes) ? JSON.stringify(entry.country_codes) : (entry.country_codes || null),
    region: entry.region || 'global',
    wikipedia_url: entry.wikipedia_url || null,
    source_url: entry.source_url || entry.wikipedia_url || null,
    image_url: entry.image_url || null,
    image_alt: entry.image_alt || null,
    image_status: entry.image_status || (entry.image_url ? 'wikipedia' : 'missing'),
    image_license: entry.image_license || null,
    image_credit: entry.image_credit || null,
    image_source_url: entry.image_source_url || null,
    image_width: entry.image_width || null,
    image_height: entry.image_height || null,
    image_last_checked: entry.image_last_checked || new Date().toISOString(),
    search_keywords: typeof entry.search_keywords === 'string' ? entry.search_keywords : JSON.stringify(entry.search_keywords || []),
    tags: typeof entry.tags === 'string' ? entry.tags : JSON.stringify(entry.tags || []),
    faq_questions: typeof entry.faq_questions === 'string' ? entry.faq_questions : JSON.stringify(entry.faq_questions || []),
    key_facts: typeof entry.key_facts === 'string' ? entry.key_facts : JSON.stringify(entry.key_facts || []),
    people_mentioned: typeof entry.people_mentioned === 'string' ? entry.people_mentioned : JSON.stringify(entry.people_mentioned || []),
    data_sources: typeof entry.data_sources === 'string' ? entry.data_sources : JSON.stringify(entry.data_sources || []),
    user_intents: typeof entry.user_intents === 'string' ? entry.user_intents : JSON.stringify(entry.user_intents || []),
    external_id: entry.external_id || null,
    sentiment: entry.sentiment || 'neutral',
    related_event_ids: typeof entry.related_event_ids === 'string' ? entry.related_event_ids : JSON.stringify(entry.related_event_ids || [])
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function onPostOnthisday(request, env) {
  // 1. Parse body
  let entry;
  try {
    entry = await request.json();
  } catch {
    return jsonResponse(400, { success: false, error: { code: 'INVALID_JSON', message: 'Body must be valid JSON' } });
  }

  // 2. Validate
  const validation = validateEntry(entry);
  if (!validation.valid) {
    return jsonResponse(400, { success: false, error: { code: 'VALIDATION_ERROR', message: validation.error } });
  }

  // 3. Check for duplicates
  const dup = await env.DB.prepare(`
    SELECT id FROM onthisday
    WHERE month = ? AND day = ? AND year = ? AND LOWER(title) = LOWER(?)
    LIMIT 1
  `).bind(entry.month, entry.day, entry.year, entry.title).first();

  if (dup) {
    return jsonResponse(409, {
      success: false,
      error: {
        code: 'DUPLICATE',
        message: 'An entry with this date + year + title already exists',
        existing_id: dup.id
      }
    });
  }

  // 4. Normalize
  const normalized = normalizeEntry(entry);

  // 5. Calculate quality
  const quality_score = calculateQualityScore(entry);
  const quality_tier = getQualityTier(quality_score);
  const quality_breakdown = JSON.stringify({
    has_image: entry.image_url ? 15 : 0,
    has_long_desc: (entry.long_description || entry.description || '').length >= 200 ? 15 : 0,
    has_short_desc: (entry.description || '').length >= 50 ? 10 : 0,
    has_wiki: entry.wikipedia_url ? 10 : 0,
    has_country: (entry.country_code || (entry.country_codes && entry.country_codes.length)) ? 10 : 0,
    has_category: entry.category ? 5 : 0,
    has_people: (() => {
      const p = typeof entry.people_mentioned === 'string' ? JSON.parse(entry.people_mentioned || '[]') : (entry.people_mentioned || []);
      return p.length >= 3 ? 10 : 0;
    })(),
    has_keywords: (() => {
      const k = typeof entry.search_keywords === 'string' ? JSON.parse(entry.search_keywords || '[]') : (entry.search_keywords || []);
      return k.length >= 5 ? 5 : 0;
    })(),
    has_tags: (() => {
      const t = typeof entry.tags === 'string' ? JSON.parse(entry.tags || '[]') : (entry.tags || []);
      return t.length >= 3 ? 5 : 0;
    })(),
    has_sources: (() => {
      const s = typeof entry.data_sources === 'string' ? JSON.parse(entry.data_sources || '[]') : (entry.data_sources || []);
      return s.length >= 2 ? 5 : 0;
    })()
  });

  // 6. Insert
  try {
    const result = await env.DB.prepare(`
      INSERT INTO onthisday (
        month, day, year, title, description, long_description, type, category, subcategory,
        importance, country_code, country_codes, region, wikipedia_url, source_url,
        image_url, image_alt, image_status, image_license, image_credit, image_source_url,
        image_width, image_height, image_last_checked,
        search_keywords, tags, faq_questions, key_facts, people_mentioned,
        data_sources, user_intents, external_id, sentiment, related_event_ids,
        quality_score, quality_tier, quality_breakdown,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).bind(
      normalized.month, normalized.day, normalized.year, normalized.title,
      normalized.description, normalized.long_description, normalized.type, normalized.category, normalized.subcategory,
      normalized.importance, normalized.country_code, normalized.country_codes, normalized.region,
      normalized.wikipedia_url, normalized.source_url,
      normalized.image_url, normalized.image_alt, normalized.image_status, normalized.image_license,
      normalized.image_credit, normalized.image_source_url, normalized.image_width, normalized.image_height,
      normalized.image_last_checked,
      normalized.search_keywords, normalized.tags, normalized.faq_questions, normalized.key_facts,
      normalized.people_mentioned, normalized.data_sources, normalized.user_intents, normalized.external_id,
      normalized.sentiment, normalized.related_event_ids,
      quality_score, quality_tier, quality_breakdown
    ).run();

    return jsonResponse(201, {
      success: true,
      id: result.meta?.last_row_id,
      quality_score,
      quality_tier
    });
  } catch (err) {
    return jsonResponse(500, {
      success: false,
      error: { code: 'INTERNAL', message: err.message }
    });
  }
}

// Batch handler — accepts an array of entries
export async function onPostOnthisdayBatch(request, env) {
  let entries;
  try {
    entries = await request.json();
  } catch {
    return jsonResponse(400, { success: false, error: { code: 'INVALID_JSON', message: 'Body must be valid JSON array' } });
  }

  if (!Array.isArray(entries)) {
    return jsonResponse(400, { success: false, error: { code: 'INVALID_FORMAT', message: 'Body must be an array' } });
  }

  const results = {
    total: entries.length,
    inserted: 0,
    duplicates: 0,
    invalid: 0,
    errors: 0,
    details: []
  };

  for (const entry of entries) {
    const validation = validateEntry(entry);
    if (!validation.valid) {
      results.invalid++;
      results.details.push({ title: entry.title, status: 'invalid', error: validation.error });
      continue;
    }

    const dup = await env.DB.prepare(`
      SELECT id FROM onthisday
      WHERE month = ? AND day = ? AND year = ? AND LOWER(title) = LOWER(?)
      LIMIT 1
    `).bind(entry.month, entry.day, entry.year, entry.title).first();

    if (dup) {
      results.duplicates++;
      results.details.push({ title: entry.title, status: 'duplicate', existing_id: dup.id });
      continue;
    }

    const normalized = normalizeEntry(entry);
    const quality_score = calculateQualityScore(entry);
    const quality_tier = getQualityTier(quality_score);

    try {
      const result = await env.DB.prepare(`
        INSERT INTO onthisday (
          month, day, year, title, description, long_description, type, category, subcategory,
          importance, country_code, country_codes, region, wikipedia_url, source_url,
          image_url, image_alt, image_status, image_license, image_credit, image_source_url,
          image_width, image_height, image_last_checked,
          search_keywords, tags, faq_questions, key_facts, people_mentioned,
          data_sources, user_intents, external_id, sentiment, related_event_ids,
          quality_score, quality_tier,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).bind(
        normalized.month, normalized.day, normalized.year, normalized.title,
        normalized.description, normalized.long_description, normalized.type, normalized.category, normalized.subcategory,
        normalized.importance, normalized.country_code, normalized.country_codes, normalized.region,
        normalized.wikipedia_url, normalized.source_url,
        normalized.image_url, normalized.image_alt, normalized.image_status, normalized.image_license,
        normalized.image_credit, normalized.image_source_url, normalized.image_width, normalized.image_height,
        normalized.image_last_checked,
        normalized.search_keywords, normalized.tags, normalized.faq_questions, normalized.key_facts,
        normalized.people_mentioned, normalized.data_sources, normalized.user_intents, normalized.external_id,
        normalized.sentiment, normalized.related_event_ids,
        quality_score, quality_tier
      ).run();

      results.inserted++;
      results.details.push({ title: entry.title, status: 'inserted', id: result.meta?.last_row_id, quality_score, quality_tier });
    } catch (err) {
      results.errors++;
      results.details.push({ title: entry.title, status: 'error', error: err.message });
    }
  }

  return jsonResponse(200, { success: true, ...results });
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

// ============================================================================
// ROUTING — add to your existing API Worker
// ============================================================================

/*
// Add these to your existing timeanddatepro API Worker fetch handler:

// In your fetch() handler, add:
if (url.pathname === '/api/v1/onthisday' && request.method === 'POST') {
  return onPostOnthisday(request, env);
}

if (url.pathname === '/api/v1/onthisday/batch' && request.method === 'POST') {
  return onPostOnthisdayBatch(request, env);
}

if (url.pathname === '/api/v1/onthisday' && request.method === 'OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

*/
