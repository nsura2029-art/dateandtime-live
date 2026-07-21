/**
 * CC BY-SA attribution helpers + FAQ schema blocks
 *
 * Per Blueprint Ch 6 (image pipeline) + Ch 7 (FAQ for PAA/AIO) + Risk #1 (CC BY-SA):
 *   - Per-page attribution string (text + image)
 *   - JSON-LD schema for FAQPage (PAA + AIO citation potential)
 *   - Per-image credit + license
 *
 * Source: Blueprint Risk #1 + Ch 7 (FAQ for PAA/AIO citation)
 */

/**
 * Build the standard CC BY-SA 4.0 attribution footer text.
 * @param {string[]} sourceNames
 * @returns {string} HTML-safe attribution string
 */
function buildAttributionText(sourceNames) {
  if (!Array.isArray(sourceNames)) sourceNames = [sourceNames];

  const groups = new Map();
  for (const name of sourceNames) {
    const license = require('./provenance').LICENSE_REGISTRY[name];
    if (!license) continue;
    const key = license.license;
    if (!groups.has(key)) {
      groups.set(key, { license: license.license, url: license.license_url, sources: [] });
    }
    groups.get(key).sources.push(license.name);
  }

  const parts = [];
  for (const g of groups.values()) {
    const uniqueSources = [...new Set(g.sources)];
    parts.push(
      `Text from ${uniqueSources.join(' and ')}, ` +
      `licensed under <a href="${g.url}" rel="license">${g.license}</a>`
    );
  }

  return parts.join('; ');
}

/**
 * Build a single image attribution block (HTML).
 * @param {object} image
 * @returns {string} HTML
 */
function buildImageAttribution(image) {
  if (!image) return '';
  const license = image.license || 'unknown';
  const credit = image.artist || image.credit || 'Wikimedia Commons';
  const url = image.url || '#';
  return `<a href="${url}" target="_blank" rel="noopener">${credit}</a> (<a href="${image.license_url || '#'}" target="_blank" rel="noopener">${license}</a>)`;
}

/**
 * Build JSON-LD for an article (used as page-level metadata).
 * Per Blueprint Ch 7: Article + FAQPage schema for PAA + AIO citation.
 * @param {object} entry - {title, description, date, sourceUrl, ...}
 * @param {string} language
 * @returns {object}
 */
function buildArticleJsonLd(entry, language = 'en') {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: entry.title,
    description: entry.description,
    datePublished: entry.date || new Date().toISOString(),
    inLanguage: language,
    author: { '@type': 'Organization', name: 'dateandtime.live' },
    publisher: { '@type': 'Organization', name: 'dateandtime.live' },
    isBasedOn: entry.data_sources ? safeJsonParse(entry.data_sources, []).map(s => ({
      '@type': 'CreativeWork',
      name: s.label || s.name,
      url: s.url,
      license: s.license,
      licenseUrl: s.license_url
    })) : []
  };
}

/**
 * Build JSON-LD FAQPage block (for PAA + AIO citation).
 * @param {Array<{q, a}>} faqs
 * @returns {object}
 */
function buildFaqJsonLd(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q || f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a || f.answer
      }
    }))
  };
}

/**
 * Generate FAQ pairs from an onthisday entry.
 * Heuristic: 3-5 Q&A per entry based on type + fields.
 * @param {object} entry
 * @returns {object[]}
 */
function generateFAQs(entry) {
  if (!entry) return [];

  const faqs = [];

  // Type-specific
  if (entry.type === 'event') {
    faqs.push({
      q: `What happened on ${entry.month}/${entry.day}/${entry.year}?`,
      a: entry.description || entry.title
    });
  } else if (entry.type === 'birth') {
    faqs.push({
      q: `When was ${entry.title} born?`,
      a: `${entry.title} was born on ${entry.month}/${entry.day}/${entry.year}. ${entry.description || ''}`
    });
    if (entry.star_sign) {
      faqs.push({
        q: `What is ${entry.title}'s zodiac sign?`,
        a: `${entry.title}'s zodiac sign is ${entry.star_sign}.`
      });
    }
    if (entry.chinese_zodiac) {
      faqs.push({
        q: `What is ${entry.title}'s Chinese zodiac?`,
        a: `${entry.title} was born in the Year of the ${entry.chinese_zodiac}.`
      });
    }
  } else if (entry.type === 'death') {
    faqs.push({
      q: `When did ${entry.title} die?`,
      a: `${entry.title} died on ${entry.month}/${entry.day}/${entry.year}. ${entry.description || ''}`
    });
    if (entry.age_at_death) {
      faqs.push({
        q: `How old was ${entry.title} when they died?`,
        a: `${entry.title} was ${entry.age_at_death} years old when they died.`
      });
    }
  } else if (entry.type === 'wedding') {
    faqs.push({
      q: `When did ${entry.title} marry ${entry.entity2_name || 'their spouse'}?`,
      a: `${entry.title} and ${entry.entity2_name || 'their spouse'} were married on ${entry.month}/${entry.day}/${entry.year}.`
    });
  } else if (entry.type === 'holiday') {
    faqs.push({
      q: `What is observed on ${entry.month}/${entry.day}?`,
      a: entry.description || entry.title
    });
  }

  // Year-only precision flag
  if (entry.year_precision === 'year') {
    faqs.push({
      q: `What year did this event occur?`,
      a: `This event is recorded as occurring in ${entry.year} (year-only precision).`
    });
  }

  return faqs.slice(0, 5);  // cap at 5 per entry
}

/**
 * Build a complete ItemList JSON-LD for a date page.
 * @param {object[]} entries
 * @param {string} dateLabel
 * @returns {object}
 */
function buildItemListJsonLd(entries, dateLabel) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `On This Day — ${dateLabel}`,
    numberOfItems: entries.length,
    itemListElement: entries.slice(0, 50).map((entry, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': entry.type === 'event' ? 'Event' : (entry.type === 'birth' || entry.type === 'death' ? 'Person' : 'Thing'),
        name: entry.title,
        description: entry.description,
        url: entry.wikipedia_url
      }
    }))
  };
}

function safeJsonParse(s, fallback) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

module.exports = {
  buildAttributionText,
  buildImageAttribution,
  buildArticleJsonLd,
  buildFaqJsonLd,
  generateFAQs,
  buildItemListJsonLd
};
