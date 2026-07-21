/**
 * DBpedia SPARQL Connector (inbound_links)
 *
 * Per Blueprint Ch 5: DBpedia gives us inbound-link counts as the
 * third notability signal (sitelinks + pageviews + inbound_links).
 *
 * URL: https://dbpedia.org/sparql
 * Query pattern: SELECT (COUNT(?s) AS ?count) WHERE { ?s dbo:wikiPageWikiLink <URI> }
 *
 * License: CC BY-SA 3.0 (Wikipedia-derived)
 * https://creativecommons.org/licenses/by-sa/3.0/
 */

const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql';
const USER_AGENT = 'DateAndTime-Live/1.0 (https://dateandtime.live; contact@dateandtime.live)';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const TIMEOUT_MS = 60_000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function query(sparql, opts = {}) {
  const retries = opts.retries ?? MAX_RETRIES;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(DBPEDIA_ENDPOINT, {
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
      if (res.status === 404) return null;
      if (res.status === 429 || res.status === 503) {
        const wait = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[dbpedia] ${res.status}, retry in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`DBpedia HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[dbpedia] query failed: ${err.message}`);
        return null;
      }
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
  return null;
}

/**
 * Get the number of Wikipedia articles that link TO this entity.
 * @param {string} dbpediaUri - e.g. "http://dbpedia.org/resource/Apollo_11"
 * @returns {Promise<number|null>}
 */
async function getInboundLinks(dbpediaUri) {
  const sparql = `
    SELECT (COUNT(?s) AS ?count) WHERE {
      ?s dbo:wikiPageWikiLink <${dbpediaUri}> .
    }
  `;
  const data = await query(sparql);
  if (!data?.results?.bindings?.[0]?.count) return null;
  return parseInt(data.results.bindings[0].count.value, 10);
}

/**
 * Get the number of Wikipedia articles linked FROM this entity (outbound).
 * @param {string} dbpediaUri
 * @returns {Promise<number|null>}
 */
async function getOutboundLinks(dbpediaUri) {
  const sparql = `
    SELECT (COUNT(?o) AS ?count) WHERE {
      <${dbpediaUri}> dbo:wikiPageWikiLink ?o .
    }
  `;
  const data = await query(sparql);
  if (!data?.results?.bindings?.[0]?.count) return null;
  return parseInt(data.results.bindings[0].count.value, 10);
}

/**
 * Convert a Wikipedia article title to a DBpedia URI.
 * @param {string} title - e.g. "Apollo 11"
 * @returns {string} e.g. "http://dbpedia.org/resource/Apollo_11"
 */
function titleToDbpediaUri(title) {
  return `http://dbpedia.org/resource/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

/**
 * Get inbound links for a batch of titles.
 * @param {string[]} titles
 * @returns {Promise<object>} {title → count|null}
 */
async function getInboundLinksBatch(titles) {
  const result = {};
  let i = 0;
  for (const title of titles) {
    i++;
    if (i % 50 === 0) {
      console.log(`[dbpedia] ${i}/${titles.length}`);
    }
    try {
      const uri = titleToDbpediaUri(title);
      result[title] = await getInboundLinks(uri);
    } catch (err) {
      console.warn(`[dbpedia] ${title}: ${err.message}`);
      result[title] = null;
    }
    await sleep(300);  // Throttle
  }
  return result;
}

module.exports = {
  query,
  getInboundLinks,
  getOutboundLinks,
  getInboundLinksBatch,
  titleToDbpediaUri,
  DBPEDIA_ENDPOINT,
  USER_AGENT
};
