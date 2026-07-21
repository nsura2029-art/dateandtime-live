/**
 * Wikipedia Day-Article Parser (recency backfill)
 *
 * Per Blueprint Prompt A: the Wikimedia Feed API's `events` list silently
 * excludes the last ~2 years. To fill that gap, we parse the wikitext of
 * the corresponding Wikipedia day article (e.g. "July_20") via the
 * MediaWiki parse API, then extract entries from the "Events" section.
 *
 * Per Blueprint Insight #7: pre-1582 Julian dates need careful handling,
 * and year-only precision should be flagged (not surfaced as Jan 1 birthdays).
 *
 * URL: https://en.wikipedia.org/w/api.php?action=parse&page=July_20&prop=wikitext&format=json
 *
 * License: CC BY-SA 4.0
 */

const MEDIAWIKI_API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'DateAndTime-Live/1.0 (https://dateandtime.live; contact@dateandtime.live)';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const TIMEOUT_MS = 60_000;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
        const wait = retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`MediaWiki HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[day-page] fetch failed: ${err.message}`);
        return null;
      }
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
  return null;
}

/**
 * Get the section list for a day article.
 * @param {string} title - e.g. "July_20"
 * @returns {Promise<Array<{index, toclevel, line, anchor}>|null>}
 */
async function getSections(title) {
  const url = `${MEDIAWIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json`;
  const data = await fetchJson(url);
  return data?.parse?.sections || null;
}

/**
 * Get the wikitext of a specific section.
 * @param {string} title
 * @param {number} sectionIndex - 0-based section index
 * @returns {Promise<string|null>}
 */
async function getSectionWikitext(title, sectionIndex) {
  const url = `${MEDIAWIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&section=${sectionIndex}&format=json`;
  const data = await fetchJson(url);
  return data?.parse?.wikitext?.['*'] || null;
}

/**
 * Get the full wikitext of a day article.
 * @param {string} title
 * @returns {Promise<string|null>}
 */
async function getArticleWikitext(title) {
  const url = `${MEDIAWIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json`;
  const data = await fetchJson(url);
  return data?.parse?.wikitext?.['*'] || null;
}

/**
 * Get the page title for a (month, day).
 * @param {number} month - 1-12
 * @param {number} day - 1-31
 * @returns {string} e.g. "July_20"
 */
function getPageTitle(month, day) {
  return `${MONTH_NAMES[month - 1]}_${day}`;
}

/**
 * Parse wikitext lines from a Wikipedia "Events" section.
 * Typical format:
 *   {{dts|2024|format=dmy}} &ndash; Some event description. {{sfn|Source|Year}}
 *   * 2024 &ndash; Some event. {{sfn|...}}
 *   * 2024-01-15 &ndash; Event.
 *
 * Returns array of {year, yearPrecision, text, raw}
 */
function parseEventsSection(wikitext) {
  if (!wikitext) return [];

  const events = [];
  // Split by newlines
  const lines = wikitext.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('{{')) continue;

    // Pattern 1: {{dts|YYYY|format=dmy}} (template)
    let m = trimmed.match(/\{\{dts\|(\d{4})\|format=dmy\}\}\s*[—–-]+\s*(.+)/);
    if (m) {
      const text = stripWikitext(m[2]);
      events.push({
        year: parseInt(m[1], 10),
        yearPrecision: 'day',
        text: cleanText(text),
        raw: trimmed
      });
      continue;
    }

    // Pattern 2: * YYYY-MM-DD – text  (must come BEFORE pattern 3 to avoid mis-match)
    m = trimmed.match(/^\*+\s*(\d{4})-(\d{2})-(\d{2})\s*[—–-]+\s*(.+)/);
    if (m) {
      const text = stripWikitext(m[4]);
      events.push({
        year: parseInt(m[1], 10),
        month: parseInt(m[2], 10),
        day: parseInt(m[3], 10),
        yearPrecision: 'day',
        text: cleanText(text),
        raw: trimmed
      });
      continue;
    }

    // Pattern 3: * YYYY – text
    m = trimmed.match(/^\*+\s*(\d{4})\s*[—–-]+\s*(.+)/);
    if (m) {
      const text = stripWikitext(m[2]);
      events.push({
        year: parseInt(m[1], 10),
        yearPrecision: 'day',
        text: cleanText(text),
        raw: trimmed
      });
      continue;
    }

    // Pattern 4: * YYYY BC (BCE)
    m = trimmed.match(/^\*+\s*(\d{1,4})\s*BC\s*[—–-]+\s*(.+)/i);
    if (m) {
      const text = stripWikitext(m[2]);
      events.push({
        year: -parseInt(m[1], 10),
        yearPrecision: 'day',
        text: cleanText(text),
        raw: trimmed
      });
      continue;
    }

    // Pattern 5: bare year (no preceding dash) — year-only precision
    m = trimmed.match(/^\*+\s*(\d{4})\s+(.*)/);
    if (m && m[2].length > 10) {  // reasonable text length
      const text = stripWikitext(m[2]);
      events.push({
        year: parseInt(m[1], 10),
        yearPrecision: 'year',  // ⚠️ Flag: year-only, do NOT infer Jan 1
        text: cleanText(text),
        raw: trimmed,
        yearOnlyWarning: true
      });
    }
  }

  return events;
}

/**
 * Strip MediaWiki templates, links, and HTML.
 */
function stripWikitext(text) {
  return text
    .replace(/\{\{[^}]+\}\}/g, '')  // templates
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')  // [[link|display]] → display
    .replace(/\[\[([^\]]+)\]\]/g, '$1')  // [[link]] → link
    .replace(/<[^>]+>/g, '')  // HTML
    .replace(/'''([^']+)'''/g, '$1')  // bold
    .replace(/''([^']+)''/g, '$1')   // italic
    .trim();
}

function cleanText(text) {
  // Normalize dashes
  return text
    .replace(/\s+/g, ' ')
    .replace(/&ndash;|&mdash;/g, '—')
    .trim();
}

/**
 * Fetch events from a day-article, parsed from wikitext.
 * This is the recency backfill that fills the 2-year gap in the Wikimedia feed.
 *
 * @param {number} month
 * @param {number} day
 * @param {object} opts - { yearStart, yearEnd }
 * @returns {Promise<{events: object[], source: 'day_page', wikipedia_url: string, sections: Array}>}
 */
async function fetchEvents(month, day, opts = {}) {
  const title = getPageTitle(month, day);
  const yearStart = opts.yearStart || 2024;  // Default: backfill last 2 years
  const yearEnd = opts.yearEnd || new Date().getFullYear() + 1;

  // Get sections first to find the Events section
  const sections = await getSections(title);
  if (!sections) return { events: [], source: 'day_page', wikipedia_url: null, sections: [] };

  // Find Events section
  const eventsSection = sections.find(s =>
    s.line && /events/i.test(s.line) && /toclevel_1|toclevel_2/.test(s.toclevel + '')
  );

  if (!eventsSection) {
    console.warn(`[day-page] No Events section found in ${title}`);
    return { events: [], source: 'day_page', wikipedia_url: null, sections };
  }

  // Fetch the Events section wikitext
  const wikitext = await getSectionWikitext(title, eventsSection.index);
  if (!wikitext) {
    return { events: [], source: 'day_page', wikipedia_url: null, sections };
  }

  // Parse the wikitext
  const allEvents = parseEventsSection(wikitext);

  // Filter to year range (recency backfill)
  const filteredEvents = allEvents.filter(e => {
    if (!e.year) return false;
    return e.year >= yearStart && e.year <= yearEnd;
  });

  return {
    events: filteredEvents,
    source: 'day_page',
    wikipedia_url: `https://en.wikipedia.org/wiki/${title}`,
    sections,
    allCount: allEvents.length,
    filteredCount: filteredEvents.length
  };
}

/**
 * Normalize a day-page event to our onthisday schema (011-compatible).
 */
function normalizeEvent(event, month, day) {
  return {
    title: event.text.split(/[.?!]/)[0].slice(0, 200),
    description: event.text,
    year: event.year,
    month,
    day,
    type: 'event',
    category: 'events',
    importance: 3,  // recency backfill: assume medium importance
    year_precision: event.yearPrecision,
    year_only_warning: event.yearOnlyWarning ? 1 : 0,
    wikipedia_url: `https://en.wikipedia.org/wiki/${getPageTitle(month, day)}`,
    wikidata_id: null,
    image_url: null,
    image_status: 'missing',
    language: 'en',
    data_sources: JSON.stringify([{
      name: 'day_page',
      url: `https://en.wikipedia.org/wiki/${getPageTitle(month, day)}`,
      retrieved_at: new Date().toISOString().split('T')[0],
      license: 'CC BY-SA 4.0',
      license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attribution_required: 1
    }]),
    verified_in: JSON.stringify(['day_page']),
    verified: 0
  };
}

/**
 * Full pipeline: fetch + normalize + filter.
 * @param {number} month
 * @param {number} day
 * @param {object} opts
 * @returns {Promise<{events: object[], source: 'day_page', wikipedia_url: string}>}
 */
async function fetchOnThisDayEntries(month, day, opts = {}) {
  const data = await fetchEvents(month, day, opts);
  return {
    events: data.events.map(e => normalizeEvent(e, month, day)),
    source: 'day_page',
    wikipedia_url: data.wikipedia_url
  };
}

module.exports = {
  getSections,
  getSectionWikitext,
  getArticleWikitext,
  getPageTitle,
  parseEventsSection,
  fetchEvents,
  fetchOnThisDayEntries,
  normalizeEvent,
  stripWikitext,
  USER_AGENT
};
