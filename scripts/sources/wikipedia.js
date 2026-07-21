/**
 * Wikipedia REST API Connector
 *
 * Uses the Wikipedia REST API v1 to fetch article summaries, full text,
 * and metadata. Free, no auth required.
 *
 * https://en.wikipedia.org/api/rest_v1/
 */

const WIKIPEDIA_API_BASE = 'https://en.wikipedia.org/api/rest_v1';
const USER_AGENT = 'dateandtime.live/1.0 (https://dateandtime.live)';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Get article summary.
 * @param {string} title - Wikipedia article title (e.g. "Apollo 11")
 * @returns {Promise<object>}
 */
async function getSummary(title) {
  if (!title) return null;
  
  const url = `${WIKIPEDIA_API_BASE}/page/summary/${encodeURIComponent(title)}`;
  return await fetchJson(url);
}

/**
 * Get full article HTML.
 * @param {string} title
 * @returns {Promise<string>} HTML
 */
async function getHtml(title) {
  if (!title) return null;
  
  const url = `${WIKIPEDIA_API_BASE}/page/html/${encodeURIComponent(title)}`;
  return await fetchText(url);
}

/**
 * Get article as mobile-sections (lighter than full HTML).
 * @param {string} title
 * @returns {Promise<object>}
 */
async function getMobileSections(title) {
  if (!title) return null;
  
  const url = `${WIKIPEDIA_API_BASE}/page/mobile-sections/${encodeURIComponent(title)}`;
  return await fetchJson(url);
}

/**
 * Get the "On this day" feed for a specific month + day.
 * @param {string} type - 'events' | 'births' | 'deaths' | 'holidays' | 'selected'
 * @param {number} month - 1-12
 * @param {number} day - 1-31
 * @returns {Promise<object>}
 */
async function getOnThisDay(type, month, day) {
  if (!['events', 'births', 'deaths', 'holidays', 'selected'].includes(type)) {
    throw new Error(`Invalid type: ${type}`);
  }
  
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const url = `${WIKIPEDIA_API_BASE}/feed/onthisday/${type}/${mm}/${dd}`;
  return await fetchJson(url);
}

/**
 * Get all "On this day" types for a day.
 * @param {number} month
 * @param {number} day
 * @returns {Promise<{events, births, deaths, holidays, selected}>}
 */
async function getOnThisDayAll(month, day) {
  const [events, births, deaths, holidays, selected] = await Promise.all([
    getOnThisDay('events', month, day).catch(() => null),
    getOnThisDay('births', month, day).catch(() => null),
    getOnThisDay('deaths', month, day).catch(() => null),
    getOnThisDay('holidays', month, day).catch(() => null),
    getOnThisDay('selected', month, day).catch(() => null)
  ]);
  
  return { events, births, deaths, holidays, selected };
}

/**
 * Fetch and parse the "On this day" events for a day.
 * Returns normalized entries ready for our schema.
 * @param {number} month
 * @param {number} day
 * @returns {Promise<{events: object[], births: object[], deaths: object[], holidays: object[]}>}
 */
async function fetchOnThisDayEntries(month, day) {
  const data = await getOnThisDayAll(month, day);
  
  const normalize = (item, type) => {
    const year = item.year || 0;
    const text = item.text || '';
    const pages = item.pages || [];
    
    // First page typically has the main image
    const firstPage = pages[0] || {};
    const imageUrl = firstPage.thumbnail?.source;
    
    // Wikipedia URL
    const wikiUrl = firstPage.content_urls?.desktop?.page;
    
    return {
      title: text.split('—')[0].trim().slice(0, 200),  // Take the title part
      description: text,
      year,
      month,
      day,
      wikipedia_url: wikiUrl,
      image_url: imageUrl,
      image_alt: text.slice(0, 200),
      type,
      category: typeToCategory(type),
      importance: pages.length > 1 ? 3 : 2,  // Approximate
      data_sources: JSON.stringify([{ name: 'wikipedia', url: wikiUrl, retrieved_at: new Date().toISOString() }])
    };
  };
  
  return {
    events: (data.events?.events || []).map(e => normalize(e, 'event')),
    births: (data.births?.births || []).map(b => normalize(b, 'birth')),
    deaths: (data.deaths?.deaths || []).map(d => normalize(d, 'death')),
    holidays: (data.holidays?.holidays || []).map(h => normalize(h, 'event'))
  };
}

/**
 * Map Wikipedia "On this day" type to our category.
 */
function typeToCategory(type) {
  const map = {
    'event': 'events',
    'birth': 'births',
    'death': 'deaths',
    'wedding': 'events',
    'divorce': 'events',
    'bizarre': 'events'
  };
  return map[type] || 'events';
}

/**
 * Search Wikipedia for an article by query.
 * @param {string} query
 * @returns {Promise<Array>}
 */
async function search(query, limit = 10) {
  if (!query) return [];
  
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&format=json`;
  const data = await fetchJson(url);
  
  if (!data || !Array.isArray(data)) return [];
  
  // opensearch returns [query, [titles], [descriptions], [urls]]
  const [, titles, descriptions, urls] = data;
  if (!titles || !urls) return [];
  
  return titles.map((title, i) => ({
    title,
    description: descriptions?.[i],
    url: urls?.[i]
  }));
}

/**
 * Get the Wikipedia article for a Wikipedia URL.
 * @param {string} wikipediaUrl
 * @returns {Promise<string|null>} article title
 */
function extractTitle(wikipediaUrl) {
  if (!wikipediaUrl) return null;
  const match = wikipediaUrl.match(/\/wiki\/(.+?)(?:#|$|\?)/);
  if (!match) return null;
  return decodeURIComponent(match[1]).replace(/_/g, ' ');
}

/**
 * Get full article data for a Wikipedia URL.
 * @param {string} wikipediaUrl
 * @returns {Promise<object|null>}
 */
async function getArticleFromUrl(wikipediaUrl) {
  const title = extractTitle(wikipediaUrl);
  if (!title) return null;
  return await getSummary(title);
}

/**
 * Get plain text extract for a title.
 * @param {string} title
 * @returns {Promise<string|null>}
 */
async function getExtract(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&format=json`;
  const data = await fetchJson(url);
  if (!data?.query?.pages) return null;
  const pages = Object.values(data.query.pages);
  return pages[0]?.extract || null;
}

/**
 * Generic JSON fetch with retries.
 */
async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, opts);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn(`JSON parse failed for ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Generic text fetch with retries.
 */
async function fetchText(url, opts = {}) {
  const retries = opts.retries ?? MAX_RETRIES;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT }
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        if (res.status === 429) {
          const wait = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await sleep(wait);
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`Fetch failed for ${url}: ${err.message}`);
        return null;
      }
      const wait = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(wait);
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  getSummary,
  getHtml,
  getMobileSections,
  getOnThisDay,
  getOnThisDayAll,
  fetchOnThisDayEntries,
  search,
  extractTitle,
  getArticleFromUrl,
  getExtract,
  typeToCategory
};
