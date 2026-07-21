/**
 * Category×Date data library
 *
 * Per Blueprint Ch 7 (T3: category×date pages) + Ch 6 (12-category taxonomy):
 *   For each (month, day), group events by category.
 *   Categories: battles, disasters, politics, science, sports, arts, music,
 *                literature, technology, religion, exploration, crime
 *
 * Output: content/otd/categories/{category}/{MM-DD}.json
 *
 * Source: Blueprint Ch 7 (T3) + Ch 6 (category taxonomy)
 */

const fs = require('fs');
const path = require('path');

// Category keywords (used to classify entries without explicit category)
const CATEGORY_KEYWORDS = {
  battles: ['war', 'battle', 'siege', 'invasion', 'military', 'army', 'troops', 'combat'],
  disasters: ['earthquake', 'flood', 'hurricane', 'tornado', 'tsunami', 'volcanic', 'eruption', 'disaster', 'fire'],
  politics: ['election', 'president', 'prime minister', 'parliament', 'congress', 'treaty', 'independence', 'revolt', 'revolution', 'reform'],
  science: ['discovery', 'experiment', 'physics', 'chemistry', 'biology', 'medicine', 'nobel', 'telescope', 'laboratory'],
  science_space: ['space', 'astronaut', 'rocket', 'satellite', 'moon', 'mars', 'orbit', 'nasa', 'spacecraft', 'launch'],
  sports: ['olympic', 'championship', 'tournament', 'match', 'race', 'athlete', 'football', 'soccer', 'basketball', 'baseball'],
  arts: ['painter', 'sculptor', 'artist', 'gallery', 'exhibition', 'museum', 'architecture'],
  music: ['musician', 'composer', 'singer', 'song', 'album', 'concert', 'symphony', 'opera', 'band'],
  film: ['film', 'movie', 'cinema', 'director', 'actor', 'actress', 'hollywood'],
  literature: ['novel', 'poet', 'book', 'author', 'writer', 'literature', 'publish', 'novelist'],
  technology: ['computer', 'software', 'internet', 'invention', 'patent', 'engineer', 'phone', 'telegraph'],
  religion: ['pope', 'church', 'bishop', 'saint', 'monk', 'monastery', 'cathedral', 'religious', 'christmas', 'easter'],
  exploration: ['expedition', 'explore', 'discover', 'voyage', 'summit', 'first to', 'pioneer'],
  crime: ['murder', 'assassination', 'robbery', 'trial', 'prison', 'verdict', 'sentence']
};

const CATEGORY_LIST = Object.keys(CATEGORY_KEYWORDS);

/**
 * Classify an entry into one or more categories based on text matching.
 * @param {object} entry
 * @returns {string[]} matching category slugs
 */
function classify(entry) {
  const text = `${entry.title || ''} ${entry.description || ''} ${(entry.search_keywords || '').slice(0, 200)}`.toLowerCase();
  const matched = [];

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      matched.push(cat);
    }
  }

  return matched.length > 0 ? matched : ['general'];
}

/**
 * Build category×date data from a list of entries.
 * @param {object[]} entries
 * @returns {object} { [category]: { [MM-DD]: [entries] } }
 */
function buildCategoryDate(entries) {
  const result = {};
  for (const cat of CATEGORY_LIST) {
    result[cat] = {};
  }
  result.general = {};

  for (const e of entries) {
    if (e.type !== 'event') continue;
    if (!e.month || !e.day) continue;

    const dateKey = `${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`;
    const cats = classify(e);

    for (const cat of cats) {
      if (!result[cat][dateKey]) result[cat][dateKey] = [];
      result[cat][dateKey].push({
        title: e.title,
        description: e.description,
        year: e.year,
        wikipedia_url: e.wikipedia_url,
        wikidata_id: e.wikidata_id,
        image_url: e.image_url,
        importance: e.importance || 1,
        rank_score: e.rank_score || 0
      });
    }
  }

  return result;
}

/**
 * Persist category×date data to disk.
 * @param {object} categoryData
 * @param {string} outputDir
 */
function saveCategoryDate(categoryData, outputDir = '/tmp/otd-categories') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const summary = {};
  for (const cat of Object.keys(categoryData)) {
    const catDir = path.join(outputDir, cat);
    if (!fs.existsSync(catDir)) {
      fs.mkdirSync(catDir, { recursive: true });
    }
    const dates = categoryData[cat];
    summary[cat] = Object.keys(dates).length;
    for (const [dateKey, entries] of Object.entries(dates)) {
      if (entries.length === 0) continue;
      const filename = path.join(catDir, `${dateKey}.json`);
      fs.writeFileSync(filename, JSON.stringify(entries, null, 0));
    }
  }

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

module.exports = {
  CATEGORY_LIST,
  CATEGORY_KEYWORDS,
  classify,
  buildCategoryDate,
  saveCategoryDate
};
