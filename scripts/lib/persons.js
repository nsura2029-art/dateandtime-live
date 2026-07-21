/**
 * Person data library
 *
 * Per Blueprint Ch 6 (entities table) + Ch 7 (T5: person pages, T6: birthday-twin):
 *   Extract person entities from onthisday rows + add star_sign, chinese_zodiac,
 *   generation, age_at_death, current_age, cause_of_death, profession[].
 *
 * Output: top 50K people indexed by (month, day) for birthday-twin tool.
 *
 * Source: Blueprint Ch 6 (entities) + Ch 7 (T5, T6)
 */

const fs = require('fs');
const path = require('path');
const {
  starSignFromDate,
  chineseZodiacFromYear,
  generationFromYear,
  ageAtDeath,
  currentAge
} = require('../sources/wikidata');

/**
 * Extract person entities from a list of onthisday entries.
 * @param {object[]} entries - rows from onthisday
 * @returns {object[]} unique person entities with enrichment
 */
function extractPersons(entries) {
  const byWikidataId = new Map();
  const byName = new Map();

  for (const e of entries) {
    if (e.type !== 'birth' && e.type !== 'death') continue;

    // Person identifier
    const pid = e.wikidata_id || e.wikipedia_title || e.title;
    if (!pid) continue;

    const key = e.wikidata_id || `name:${e.title.toLowerCase()}`;
    if (byWikidataId.has(key)) {
      // Merge with existing
      const existing = byWikidataId.get(key);
      if (e.type === 'birth' && !existing.birth_date) {
        existing.birth_date = formatDate(e.year, e.month, e.day);
        existing.birth_year = e.year;
        existing.birth_month = e.month;
        existing.birth_day = e.day;
      }
      if (e.type === 'death' && !existing.death_date) {
        existing.death_date = formatDate(e.year, e.month, e.day);
        existing.death_year = e.year;
        existing.death_month = e.month;
        existing.death_day = e.day;
      }
    } else {
      byWikidataId.set(key, {
        wikidata_id: e.wikidata_id,
        label: e.title,
        description: e.description,
        entity_type: 'person',
        birth_date: e.type === 'birth' ? formatDate(e.year, e.month, e.day) : null,
        birth_year: e.type === 'birth' ? e.year : null,
        birth_month: e.type === 'birth' ? e.month : null,
        birth_day: e.type === 'birth' ? e.day : null,
        death_date: e.type === 'death' ? formatDate(e.year, e.month, e.day) : null,
        death_year: e.type === 'death' ? e.year : null,
        death_month: e.type === 'death' ? e.month : null,
        death_day: e.type === 'death' ? e.day : null,
        country_code: e.country_code,
        region: e.region,
        profession: e.profession ? safeJsonParse(e.profession, []) : [],
        sitelinks: e.sitelinks || 0,
        avg_daily_views: e.pageviews_30d_avg || 0,
        inbound_links: e.inbound_links || 0,
        notability_score: e.rank_score || 0,
        image_url: e.image_url,
        image_license: e.image_license,
        wikipedia_url: e.wikipedia_url,
        wikipedia_title: e.wikipedia_title,
        is_alive: e.type === 'birth' ? 1 : 0
      });
    }
  }

  // Compute enrichment fields
  const persons = [...byWikidataId.values()].map(p => {
    if (p.birth_month && p.birth_day) {
      p.star_sign = starSignFromDate(p.birth_month, p.birth_day);
    }
    if (p.birth_year) {
      p.chinese_zodiac = chineseZodiacFromYear(p.birth_year);
      p.generation = generationFromYear(p.birth_year);
    }
    if (p.birth_year && p.death_year) {
      p.age_at_death = ageAtDeath(p.birth_year, p.death_year);
    }
    if (p.birth_year && !p.death_year) {
      p.current_age = currentAge(p.birth_year, p.birth_month, p.birth_day);
    }
    return p;
  });

  return persons;
}

/**
 * Group persons by (month, day) for the birthday-twin tool.
 * @param {object[]} persons
 * @returns {Map<string, object[]>}
 */
function groupByBirthday(persons) {
  const groups = new Map();
  for (const p of persons) {
    if (!p.birth_month || !p.birth_day) continue;
    const key = `${String(p.birth_month).padStart(2, '0')}-${String(p.birth_day).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  // Sort each group by notability desc
  for (const [key, list] of groups) {
    list.sort((a, b) => (b.notability_score || 0) - (a.notability_score || 0));
  }
  return groups;
}

/**
 * Build a complete birthday-twin index.
 * @param {object[]} persons
 * @returns {object} { MM-DD: [persons sorted by notability] }
 */
function buildBirthdayTwinIndex(persons) {
  const groups = groupByBirthday(persons);
  const result = {};
  for (const [key, list] of groups) {
    result[key] = list.slice(0, 50);  // top 50 per day
  }
  return result;
}

function formatDate(year, month, day) {
  if (!year) return null;
  const m = String(month || 1).padStart(2, '0');
  const d = String(day || 1).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function safeJsonParse(s, fallback) {
  if (!s) return fallback;
  try {
    return JSON.parse(s);
  } catch (e) {
    return fallback;
  }
}

module.exports = {
  extractPersons,
  groupByBirthday,
  buildBirthdayTwinIndex
};
