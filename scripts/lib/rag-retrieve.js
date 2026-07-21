/**
 * RAG retrieval layer
 *
 * Per Blueprint Ch 8 (RAG architecture, Prompt E stage 1-3):
 *   1. Deterministic date/entity parser (regex + dateparser + entity linker)
 *   2. SQL retrieval (query on_this_day JOIN entities by parsed keys)
 *   3. FTS5 fallback for fuzzy entity name search
 *   4. Cap ~30 rows per retrieval
 *   5. Refusal string when empty
 *
 * NO LLM cost at this stage. This is the retrieval half of the RAG pipeline.
 *
 * Source: Blueprint Ch 8 (RAG architecture) + Risk #2 (hallucination mitigation)
 */

// Refusal string (per Blueprint Prompt E stage 5)
const REFUSAL_STRING = "I can only answer from our verified database.";

const DATE_PATTERNS = [
  // "July 19", "jul 19", "Jul 19th"
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
  // "7/19", "07-19"
  /\b(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?\b/,
  // "1969-07-20" ISO
  /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/
];

const MONTH_MAP = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
};

/**
 * Stage 1: Deterministic parse.
 * Returns {month, day, year, entity, intent} or null.
 * The LLM never parses dates — this is the deterministic, hallucination-free path.
 */
function parseQuery(query) {
  if (!query || typeof query !== 'string') return null;

  const result = { month: null, day: null, year: null, entity: null, intent: null };

  // Try ISO date first (most specific)
  let m = query.match(DATE_PATTERNS[2]);
  if (m) {
    result.year = parseInt(m[1], 10);
    result.month = parseInt(m[2], 10);
    result.day = parseInt(m[3], 10);
  }

  // Month name + day
  if (!result.month) {
    m = query.match(DATE_PATTERNS[0]);
    if (m) {
      result.month = MONTH_MAP[m[1].toLowerCase()];
      result.day = parseInt(m[2], 10);
    }
  }

  // Numeric M/D or M/D/Y
  if (!result.month) {
    m = query.match(DATE_PATTERNS[1]);
    if (m) {
      result.month = parseInt(m[1], 10);
      result.day = parseInt(m[2], 10);
      if (m[3]) result.year = parseInt(m[3], 10);
    }
  }

  // Intent detection
  const lower = query.toLowerCase();
  if (/what happened|on this day|history|event|anniversary/i.test(lower)) {
    result.intent = 'events';
  } else if (/born|birthday|famous people|born on/i.test(lower)) {
    result.intent = 'births';
  } else if (/died|death|passed away/i.test(lower)) {
    result.intent = 'deaths';
  } else if (/married|wedding|spouse/i.test(lower)) {
    result.intent = 'weddings';
  } else if (/holiday|observance|national day/i.test(lower)) {
    result.intent = 'holidays';
  } else {
    result.intent = 'all';
  }

  // Entity extraction (very simple: longest capitalized word group)
  const entityMatch = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/);
  if (entityMatch) {
    result.entity = entityMatch[0];
  }

  return result;
}

/**
 * Stage 2: SQL-style retrieval.
 * Given parsed (month, day, year, entity), return matching rows from a passed-in entries array.
 * @param {object} parsed - result from parseQuery
 * @param {object[]} entries - array of onthisday rows
 * @param {object} [opts] - {limit, minRankScore}
 * @returns {object[]} matching records (cap 30)
 */
function retrieve(parsed, entries, opts = {}) {
  const limit = opts.limit ?? 30;
  const minRankScore = opts.minRankScore ?? 0;

  if (!parsed || (!parsed.month && !parsed.entity)) return [];

  let matches = entries;

  if (parsed.month) matches = matches.filter(e => e.month === parsed.month);
  if (parsed.day) matches = matches.filter(e => e.day === parsed.day);
  if (parsed.year) matches = matches.filter(e => e.year === parsed.year);
  if (parsed.entity) {
    const e = parsed.entity.toLowerCase();
    matches = matches.filter(m =>
      (m.title || '').toLowerCase().includes(e) ||
      (m.description || '').toLowerCase().includes(e)
    );
  }
  if (parsed.intent && parsed.intent !== 'all') {
    matches = matches.filter(m => m.type === parsed.intent.slice(0, -1));  // events → event
  }
  if (minRankScore > 0) {
    matches = matches.filter(m => (m.rank_score || 0) >= minRankScore);
  }

  // Sort by rank_score DESC
  matches.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));

  return matches.slice(0, limit);
}

/**
 * Stage 3: Answer cache key.
 * Cache key = normalized intent + parameters.
 * Per Blueprint Prompt E: target ≥90% cache hit rate on canonical queries.
 */
function cacheKey(parsed) {
  return [
    parsed.intent || 'all',
    parsed.month || 'any',
    parsed.day || 'any',
    parsed.year || 'any',
    (parsed.entity || '').toLowerCase().replace(/\s+/g, '_').slice(0, 30)
  ].join('|');
}

/**
 * Stage 4: Refusal check.
 * Returns the refusal string if no records found.
 */
function refusalIfEmpty(records) {
  if (!records || records.length === 0) {
    return { refused: true, message: REFUSAL_STRING };
  }
  return { refused: false, message: null, records };
}

module.exports = {
  REFUSAL_STRING,
  parseQuery,
  retrieve,
  cacheKey,
  refusalIfEmpty
};
