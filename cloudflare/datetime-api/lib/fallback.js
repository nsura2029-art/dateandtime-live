/**
 * JSON file fallback for dev environments
 *
 * When D1 isn't available (local dev, before migration applied),
 * read the per-date JSON files produced by the main batch.
 *
 * File locations (per Blueprint Ch 9):
 *   /tmp/otd-data-final/dates/MM-DD.json   — main batch (Wikipedia + 2 mirrors + Wikidata)
 *   /tmp/otd-weddings/by-date/MM-DD.json   — wedding pull (Wikidata)
 *   /tmp/otd-final/persons-top-50k.json    — top 50K persons
 *   /tmp/otd-final/categories/.../MM-DD.json — category×date
 *
 * Used by all route files when env.OTD_DB is not bound.
 */

import { promises as fs } from 'fs';
import { parseOTDRow, parseEntityRow } from './d1.js';

const DEFAULT_DIRS = {
  dates: '/tmp/otd-data-final/dates',
  weddings: '/tmp/otd-weddings/by-date',
  persons: '/tmp/otd-final/persons-top-50k.json',
  categories: '/tmp/otd-final/categories'
};

/**
 * Load all entries for a (month, day) from the per-date JSON files.
 * Combines main batch + weddings for a unified response.
 * @param {number} month
 * @param {number} day
 * @param {object} [env] - optional env with OVERRIDE paths
 */
export async function loadOTDFromFiles(month, day, env = {}) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const dateKey = `${mm}-${dd}`;

  const datesDir = env.OTD_DATES_DIR || DEFAULT_DIRS.dates;
  const weddingsDir = env.OTD_WEDDINGS_DIR || DEFAULT_DIRS.weddings;

  const all = [];

  // Main batch
  try {
    const content = await fs.readFile(`${datesDir}/${dateKey}.json`, 'utf-8');
    const entries = JSON.parse(content);
    all.push(...entries.map(parseOTDRow));
  } catch (e) {
    // File not found or unreadable
  }

  // Weddings
  try {
    const content = await fs.readFile(`${weddingsDir}/${dateKey}.json`, 'utf-8');
    const weddings = JSON.parse(content);
    for (const w of weddings) {
      all.push(parseOTDRow({
        ...w,
        type: w.type || 'wedding',
        month: w.month || month,
        day: w.day || day
      }));
    }
  } catch (e) {
    // no weddings for this date
  }

  return all;
}

/**
 * Load a single entity by slug or wikidata ID.
 * @param {string} idOrSlug
 * @param {object} [env]
 * @returns {Promise<object|null>}
 */
export async function loadEntityFromFile(idOrSlug, env = {}) {
  const personsFile = env.OTD_PERSONS_FILE || DEFAULT_DIRS.persons;
  try {
    const content = await fs.readFile(personsFile, 'utf-8');
    const persons = JSON.parse(content);

    // Match by Q-ID or by slug
    const qid = idOrSlug.match(/^Q\d+$/i)?.[0];
    const slug = idOrSlug.toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');

    const match = persons.find(p => {
      if (qid && p.wikidata_id === qid) return true;
      if (p.label && p.label.toLowerCase().replace(/[^a-z0-9]/g, '_') === slug) return true;
      if (p.enwiki_title && p.enwiki_title.toLowerCase() === slug) return true;
      // Last-name only match: "einstein" → "Albert Einstein" (label contains slug)
      if (p.label && p.label.toLowerCase().split(/\s+/).includes(slug.replace(/_/g, ' '))) return true;
      if (p.label && slug.replace(/_/g, ' ').split(/\s+/).some(part => p.label.toLowerCase().includes(part))) return true;
      return false;
    });

    return match ? parseEntityRow({
      ...match,
      // Map top-level fields to entity table columns
      entity_id: match.wikidata_id || match.id,
      label: match.label,
      description: match.description,
      entity_type: 'person',
      enwiki_title: match.wikipedia_title || match.wikipediaTitle,
      birth_date: match.birth_date,
      death_date: match.death_date,
      birth_year: match.birth_year,
      death_year: match.death_year,
      country_code: match.country_code,
      profession: match.profession ? JSON.stringify(match.profession) : '[]',
      star_sign: match.star_sign,
      chinese_zodiac: match.chinese_zodiac,
      generation: match.generation,
      cause_of_death: match.cause_of_death,
      age_at_death: match.age_at_death,
      current_age: match.current_age,
      gender: match.gender,
      image_url: match.image_url,
      image_license: match.image_license,
      image_artist: match.image_credit || match.image_artist,
      image_license_url: match.image_license_url,
      avg_daily_views: match.pageviews_30d_avg,
      notability_score: match.rank_score,
      sitelinks: match.sitelinks,
      inbound_links: match.inbound_links,
      data_sources: match.data_sources ? JSON.stringify(match.data_sources) : '[]',
      languages_spoken: '[]',
      awards: '[]',
      related_entities: '[]'
    }) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Load all OTD entries mentioning a specific entity.
 * @param {string} wikidataId
 * @param {object} [env]
 * @returns {Promise<object[]>}
 */
export async function loadEntriesForEntityFromFiles(wikidataId, env = {}) {
  const datesDir = env.OTD_DATES_DIR || DEFAULT_DIRS.dates;
  const results = [];

  try {
    const files = await fs.readdir(datesDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await fs.readFile(`${datesDir}/${file}`, 'utf-8');
        const entries = JSON.parse(content);
        for (const e of entries) {
          if (e.wikidata_id === wikidataId || e.entity2_id === wikidataId) {
            results.push(parseOTDRow(e));
          }
        }
      } catch (err) {
        // skip file
      }
    }
  } catch (e) {
    // dir not found
  }

  return results.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
}

/**
 * Load persons born on a specific (month, day) from persons JSON.
 * @param {number} month
 * @param {number} day
 * @param {object} opts - {limit, env}
 * @returns {Promise<object[]>}
 */
export async function loadBornOnFromFiles(month, day, opts = {}) {
  const { limit = 50, env = {} } = opts;
  const personsFile = env.OTD_PERSONS_FILE || DEFAULT_DIRS.persons;

  try {
    const content = await fs.readFile(personsFile, 'utf-8');
    const persons = JSON.parse(content);

    return persons
      .filter(p => p.birth_month === month && p.birth_day === day)
      .sort((a, b) => (b.notability_score || 0) - (a.notability_score || 0))
      .slice(0, limit)
      .map(p => parseEntityRow({
        ...p,
        entity_id: p.wikidata_id || p.id,
        label: p.label,
        description: p.description,
        entity_type: 'person',
        enwiki_title: p.wikipedia_title || p.wikipediaTitle,
        birth_date: p.birth_date,
        death_date: p.death_date,
        birth_year: p.birth_year,
        death_year: p.death_year,
        country_code: p.country_code,
        profession: p.profession ? JSON.stringify(p.profession) : '[]',
        star_sign: p.star_sign,
        chinese_zodiac: p.chinese_zodiac,
        generation: p.generation,
        cause_of_death: p.cause_of_death,
        age_at_death: p.age_at_death,
        current_age: p.current_age,
        image_url: p.image_url,
        image_license: p.image_license,
        image_artist: p.image_credit,
        avg_daily_views: p.pageviews_30d_avg,
        notability_score: p.rank_score,
        sitelinks: p.sitelinks,
        inbound_links: p.inbound_links,
        data_sources: p.data_sources ? JSON.stringify(p.data_sources) : '[]',
        languages_spoken: '[]',
        awards: '[]',
        related_entities: '[]'
      }));
  } catch (e) {
    return [];
  }
}

/**
 * Detect whether file fallback is available (vs D1).
 */
export function useFileFallback(env = {}) {
  return !env.OTD_DB;
}
