/**
 * Auto-Improve Pipeline
 *
 * Given an entry with missing fields, automatically fill them in
 * using the source connectors. Tracks what was improved and why.
 *
 * Improvement strategies (in priority order):
 *   1. Missing image    → run 5-tier image fallback
 *   2. Missing desc     → fetch from Wikipedia extract
 *   3. Missing long_desc → expand from short description
 *   4. Missing country  → derive from Wikipedia/Wikidata
 *   5. Missing key_people → extract from article
 *   6. Missing importance → calculate from sitelinks
 *   7. Missing keywords → generate from title + description
 *   8. Missing alt text → generate from title + year
 *   9. Missing faq      → generate from available data
 *  10. Missing key_facts → extract from description
 */

const { getImageForEntry } = require('./image-fallback');
const { scoreEntry } = require('./quality-scorer');
const wikipedia = require('../sources/wikipedia');
const { countryNameToIso, countryToRegion } = require('../sources/wikidata');

const IMPROVEMENT_LOG_LIMIT = 20;  // Keep only the last 20 improvement entries

/**
 * Auto-improve an entry. Returns the improved entry and a log of changes.
 * @param {object} entry
 * @param {object} opts - { skipImageFetch, forceImprove, sourceConnectors }
 * @returns {Promise<{improved: object, log: Array, scoreBefore: number, scoreAfter: number}>}
 */
async function improveEntry(entry, opts = {}) {
  if (!entry) return null;
  
  const scoreBefore = scoreEntry(entry).score;
  const improved = { ...entry };
  const log = [];
  
  // Initialize log arrays if missing
  improved.improvement_log = safeJsonArray(improved.improvement_log);
  improved.data_sources = safeJsonArray(improved.data_sources);
  improved.search_keywords = safeJsonArray(improved.search_keywords);
  improved.tags = safeJsonArray(improved.tags);
  improved.faq_questions = safeJsonArray(improved.faq_questions);
  improved.key_facts = safeJsonArray(improved.key_facts);
  improved.people_mentioned = safeJsonArray(improved.people_mentioned);
  
  const now = new Date().toISOString();
  
  // Track improvement count
  improved.improvement_attempts = (improved.improvement_attempts || 0) + 1;
  
  // 1. Missing image — run 5-tier fallback
  if (!opts.skipImageFetch && (!improved.image_url || improved.image_status === 'missing' || improved.image_status === 'failed')) {
    try {
      const image = await getImageForEntry(improved);
      if (image && image.url) {
        const oldStatus = improved.image_status || 'missing';
        improved.image_url = image.url;
        improved.image_status = image.source;
        improved.image_license = image.license;
        improved.image_credit = image.credit;
        improved.image_width = image.width;
        improved.image_height = image.height;
        improved.image_alt = image.alt || generateAltText(improved);
        improved.image_source_url = image.source_url;
        improved.image_last_checked = now;
        improved.image_variants = JSON.stringify({
          thumb: image.url,
          medium: image.url,
          large: image.url,
          hero: image.url
        });
        log.push({
          field: 'image_url',
          from: oldStatus,
          to: image.source,
          tier: image.tier
        });
        
        // Add to data_sources
        if (image.source_url && !improved.data_sources.find(s => s.url === image.source_url)) {
          improved.data_sources.push({
            name: image.source,
            url: image.source_url,
            retrieved_at: now
          });
        }
      }
    } catch (err) {
      console.warn(`  Image fetch failed for "${improved.title}": ${err.message}`);
    }
  }
  
  // 2. Missing description — fetch from Wikipedia
  if ((!improved.description || improved.description.length < 50) && improved.wikipedia_url) {
    try {
      const article = await wikipedia.getArticleFromUrl(improved.wikipedia_url);
      if (article?.extract) {
        const oldDesc = improved.description;
        improved.description = article.extract.slice(0, 1500);
        log.push({ field: 'description', from: oldDesc ? 'short' : 'missing', to: 'wikipedia' });
      }
    } catch (err) {
      console.warn(`  Wikipedia fetch failed for "${improved.title}": ${err.message}`);
    }
  }
  
  // 3. Missing long_description — expand from short
  if (!improved.long_description && improved.description) {
    if (improved.description.length >= 200) {
      improved.long_description = improved.description;
    } else {
      // Pad with related context
      improved.long_description = `${improved.description} This event is part of ${improved.year} historical record.`;
    }
    log.push({ field: 'long_description', from: 'missing', to: 'derived' });
  }
  
  // 4. Missing country — derive
  if (!improved.country_code) {
    const country = extractCountryFromText(improved.description || improved.title || '');
    if (country) {
      improved.country_code = country;
      improved.region = countryToRegion(country);
      log.push({ field: 'country_code', from: 'missing', to: country });
    }
  }
  
  // 5. Missing key_people — extract from description
  if ((!improved.people_mentioned || improved.people_mentioned.length === 0) && improved.description) {
    const people = extractPeopleFromText(improved.description);
    if (people.length > 0) {
      improved.people_mentioned = people;
      log.push({ field: 'people_mentioned', from: 'missing', to: `extracted_${people.length}` });
    }
  }
  
  // 6. Missing importance — calculate from description length and existing data
  if (!improved.importance || improved.importance < 1) {
    const descLen = (improved.description || '').length;
    const hasWiki = !!improved.wikipedia_url;
    const hasImage = !!improved.image_url;
    let score = 1;
    if (descLen > 200) score++;
    if (descLen > 500) score++;
    if (hasWiki) score++;
    if (hasImage) score++;
    improved.importance = Math.min(5, score);
    log.push({ field: 'importance', from: 'missing', to: score });
  }
  
  // 7. Missing search_keywords — generate
  if ((!improved.search_keywords || improved.search_keywords.length === 0) && improved.title) {
    improved.search_keywords = generateSearchKeywords(improved);
    log.push({ field: 'search_keywords', from: 'missing', to: `generated_${improved.search_keywords.length}` });
  }
  
  // 8. Missing alt text — generate
  if (improved.image_url && !improved.image_alt) {
    improved.image_alt = generateAltText(improved);
    log.push({ field: 'image_alt', from: 'missing', to: 'generated' });
  }
  
  // 9. Missing FAQ — generate
  if ((!improved.faq_questions || improved.faq_questions.length === 0) && improved.title) {
    improved.faq_questions = generateFAQ(improved);
    log.push({ field: 'faq_questions', from: 'missing', to: `generated_${improved.faq_questions.length}` });
  }
  
  // 10. Missing key_facts — extract
  if ((!improved.key_facts || improved.key_facts.length === 0) && improved.description) {
    improved.key_facts = extractKeyFacts(improved);
    if (improved.key_facts.length > 0) {
      log.push({ field: 'key_facts', from: 'missing', to: `extracted_${improved.key_facts.length}` });
    }
  }
  
  // Update metadata
  if (log.length > 0) {
    improved.updated_at = now;
    improved.improvement_log.unshift(...log.map(l => ({ ...l, date: now })));
    if (improved.improvement_log.length > IMPROVEMENT_LOG_LIMIT) {
      improved.improvement_log = improved.improvement_log.slice(0, IMPROVEMENT_LOG_LIMIT);
    }
  }
  
  // Serialize JSON fields back
  improved.improvement_log = JSON.stringify(improved.improvement_log);
  improved.data_sources = JSON.stringify(improved.data_sources);
  improved.search_keywords = JSON.stringify(improved.search_keywords);
  improved.tags = JSON.stringify(improved.tags);
  improved.faq_questions = JSON.stringify(improved.faq_questions);
  improved.key_facts = JSON.stringify(improved.key_facts);
  improved.people_mentioned = JSON.stringify(improved.people_mentioned);
  
  // Calculate new score
  const scoreAfter = scoreEntry(improved).score;
  
  return {
    improved,
    log,
    scoreBefore,
    scoreAfter
  };
}

/**
 * Auto-improve multiple entries in batch.
 * @param {object[]} entries
 * @param {object} opts
 * @returns {Promise<{improved: object[], stats: object}>}
 */
async function improveBatch(entries, opts = {}) {
  const concurrency = opts.concurrency || 5;
  const results = [];
  const stats = {
    total: entries.length,
    improved: 0,
    unchanged: 0,
    failed: 0,
    score_gained: 0,
    fields_filled: {}
  };
  
  // Process in chunks for concurrency control
  for (let i = 0; i < entries.length; i += concurrency) {
    const chunk = entries.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (entry) => {
        try {
          const result = await improveEntry(entry, opts);
          if (result.log.length > 0) {
            stats.improved++;
            stats.score_gained += (result.scoreAfter - result.scoreBefore);
            for (const change of result.log) {
              stats.fields_filled[change.field] = (stats.fields_filled[change.field] || 0) + 1;
            }
          } else {
            stats.unchanged++;
          }
          return result;
        } catch (err) {
          console.warn(`Improve failed for "${entry.title}": ${err.message}`);
          stats.failed++;
          return null;
        }
      })
    );
    results.push(...chunkResults.filter(Boolean));
  }
  
  return { improved: results.map(r => r.improved), stats };
}

// ============================================================================
// Helper functions
// ============================================================================

function safeJsonArray(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    const parsed = JSON.parse(field);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function generateAltText(entry) {
  const parts = [];
  if (entry.title) parts.push(entry.title);
  if (entry.year) parts.push(`(${entry.year})`);
  if (entry.country_code) parts.push(`[${entry.country_code}]`);
  return parts.join(' ').slice(0, 200);
}

function extractCountryFromText(text) {
  if (!text) return null;
  // Common country names in English
  const countries = [
    { name: 'United States', code: 'US' },
    { name: 'USA', code: 'US' },
    { name: 'America', code: 'US' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'Britain', code: 'GB' },
    { name: 'England', code: 'GB' },
    { name: 'France', code: 'FR' },
    { name: 'Germany', code: 'DE' },
    { name: 'Japan', code: 'JP' },
    { name: 'China', code: 'CN' },
    { name: 'Russia', code: 'RU' },
    { name: 'Soviet Union', code: 'RU' },
    { name: 'Italy', code: 'IT' },
    { name: 'Spain', code: 'ES' },
    { name: 'India', code: 'IN' },
    { name: 'Canada', code: 'CA' },
    { name: 'Australia', code: 'AU' },
    { name: 'Brazil', code: 'BR' },
    { name: 'Mexico', code: 'MX' },
    { name: 'Korea', code: 'KR' },
    { name: 'South Korea', code: 'KR' },
    { name: 'North Korea', code: 'KP' },
    { name: 'Israel', code: 'IL' },
    { name: 'Egypt', code: 'EG' },
    { name: 'South Africa', code: 'ZA' },
    { name: 'Argentina', code: 'AR' },
    { name: 'Chile', code: 'CL' },
    { name: 'Iran', code: 'IR' },
    { name: 'Iraq', code: 'IQ' },
    { name: 'Turkey', code: 'TR' },
    { name: 'Greece', code: 'GR' },
    { name: 'Poland', code: 'PL' },
    { name: 'Netherlands', code: 'NL' },
    { name: 'Belgium', code: 'BE' },
    { name: 'Sweden', code: 'SE' },
    { name: 'Norway', code: 'NO' },
    { name: 'Denmark', code: 'DK' },
    { name: 'Finland', code: 'FI' },
    { name: 'Switzerland', code: 'CH' },
    { name: 'Austria', code: 'AT' },
    { name: 'Portugal', code: 'PT' },
    { name: 'Ireland', code: 'IE' },
    { name: 'Iceland', code: 'IS' },
    { name: 'Cuba', code: 'CU' },
    { name: 'Jamaica', code: 'JM' },
    { name: 'Nigeria', code: 'NG' },
    { name: 'Kenya', code: 'KE' },
    { name: 'Pakistan', code: 'PK' },
    { name: 'Vietnam', code: 'VN' },
    { name: 'Thailand', code: 'TH' },
    { name: 'Indonesia', code: 'ID' },
    { name: 'Philippines', code: 'PH' },
    { name: 'Singapore', code: 'SG' },
    { name: 'Taiwan', code: 'TW' },
    { name: 'Hong Kong', code: 'HK' },
    { name: 'New Zealand', code: 'NZ' }
  ];
  
  for (const country of countries) {
    const regex = new RegExp(`\\b${country.name}\\b`, 'i');
    if (regex.test(text)) return country.code;
  }
  return null;
}

/**
 * Extract people names from text. Looks for capitalized word sequences.
 * @param {string} text
 * @returns {Array<{name, role}>}
 */
function extractPeopleFromText(text) {
  if (!text) return [];
  
  // Look for patterns like "X was born", "X founded", "X (YEAR-YEAR)"
  const people = [];
  
  // Find capitalized name patterns
  const nameRegex = /\b([A-Z][a-z]+ (?:[A-Z][a-z]+\.? )?(?:[A-Z][a-z]+))/g;
  const matches = text.match(nameRegex) || [];
  
  // Dedupe and limit
  const seen = new Set();
  for (const match of matches) {
    if (seen.has(match) || match.length < 5) continue;
    seen.add(match);
    people.push({ name: match, role: 'mentioned' });
    if (people.length >= 5) break;
  }
  
  return people;
}

/**
 * Generate search keywords for an entry.
 * @param {object} entry
 * @returns {string[]}
 */
function generateSearchKeywords(entry) {
  const keywords = new Set();
  
  // Title words (3+ chars)
  if (entry.title) {
    const words = entry.title.split(/\s+/);
    for (const word of words) {
      const cleaned = word.toLowerCase().replace(/[^\w]/g, '');
      if (cleaned.length >= 3) keywords.add(cleaned);
    }
    // Add the full title as a keyword
    keywords.add(entry.title.toLowerCase());
  }
  
  // Year-based queries
  if (entry.year) {
    keywords.add(`${entry.title} ${entry.year}`);
    keywords.add(`what happened on ${monthName(entry.month)} ${entry.day} ${entry.year}`);
    if (entry.country_code) {
      keywords.add(`${entry.title} ${entry.country_code}`);
    }
  }
  
  // Date-based queries
  if (entry.month && entry.day) {
    keywords.add(`${monthName(entry.month)} ${entry.day} history`);
    keywords.add(`this day in history ${monthName(entry.month)} ${entry.day}`);
    keywords.add(`famous events on ${monthName(entry.month)} ${entry.day}`);
  }
  
  // Type-based
  if (entry.type === 'birth') {
    keywords.add(`famous birthdays ${monthName(entry.month)} ${entry.day}`);
  } else if (entry.type === 'death') {
    keywords.add(`famous deaths ${monthName(entry.month)} ${entry.day}`);
  }
  
  return Array.from(keywords).slice(0, 20);
}

/**
 * Generate FAQ Q&A pairs from entry data.
 * @param {object} entry
 * @returns {Array<{q, a}>}
 */
function generateFAQ(entry) {
  const faq = [];
  
  if (entry.type === 'birth' && entry.year) {
    faq.push({
      q: `When was ${entry.title} born?`,
      a: `${entry.title} was born on ${monthName(entry.month)} ${entry.day}, ${entry.year}.`
    });
  }
  
  if (entry.type === 'death' && entry.year) {
    faq.push({
      q: `When did ${entry.title} die?`,
      a: `${entry.title} died on ${monthName(entry.month)} ${entry.day}, ${entry.year}.`
    });
  }
  
  if (entry.type === 'event' && entry.year) {
    faq.push({
      q: `What happened on ${monthName(entry.month)} ${entry.day}, ${entry.year}?`,
      a: entry.description ? entry.description.slice(0, 300) : `On this day in ${entry.year}, ${entry.title}.`
    });
  }
  
  // Always add general "what happened" question
  if (entry.month && entry.day) {
    faq.push({
      q: `What happened on ${monthName(entry.month)} ${entry.day} in history?`,
      a: entry.description ? entry.description.slice(0, 300) : `${entry.title} occurred on this date.`
    });
  }
  
  return faq;
}

/**
 * Extract key facts from description.
 * @param {object} entry
 * @returns {string[]}
 */
function extractKeyFacts(entry) {
  const facts = [];
  
  if (!entry.description) return facts;
  
  // Split into sentences
  const sentences = entry.description.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // Take the most informative sentences (longer = more info usually)
  const sorted = sentences
    .map(s => ({ text: s.trim(), len: s.length }))
    .sort((a, b) => b.len - a.len)
    .slice(0, 3);
  
  for (const s of sorted) {
    facts.push(s.text.slice(0, 200));
  }
  
  return facts;
}

function monthName(month) {
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                 'July', 'August', 'September', 'October', 'November', 'December'];
  return names[month] || '';
}

module.exports = {
  improveEntry,
  improveBatch,
  generateAltText,
  extractCountryFromText,
  extractPeopleFromText,
  generateSearchKeywords,
  generateFAQ,
  extractKeyFacts
};
