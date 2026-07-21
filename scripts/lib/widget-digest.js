/**
 * Widget data digest library
 *
 * Per Blueprint Prompt D (embeddable widget):
 *   Pre-generate canonical daily digest for all 366 dates.
 *   Top 5 events + 5 births + 5 deaths by notability per day.
 *   Used by embeddable widget (free + white-label tiers).
 *
 * Source: Blueprint Ch 8 (widget digest) + Prompt D
 */

const fs = require('fs');
const path = require('path');

/**
 * Build a widget digest for a single (month, day).
 * @param {object[]} entries
 * @param {number} month
 * @param {number} day
 * @param {number} [limit=5] - top N per type
 * @returns {object}
 */
function buildDigest(entries, month, day, limit = 5) {
  const dateKey = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayEntries = entries.filter(e => e.month === month && e.day === day);

  const top = (type) => dayEntries
    .filter(e => e.type === type)
    .sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0))
    .slice(0, limit)
    .map(stripHeavy);

  return {
    date: dateKey,
    generated_at: new Date().toISOString().split('T')[0],
    events: top('event'),
    births: top('birth'),
    deaths: top('death'),
    holidays: top('holiday'),
    weddings: top('wedding'),
    total_for_day: dayEntries.length
  };
}

/**
 * Build all 366 digests.
 * @param {object[]} allEntries
 * @param {number} limit
 * @returns {Map<string, object>}
 */
function buildAllDigests(allEntries, limit = 5) {
  const digests = new Map();
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      digests.set(key, buildDigest(allEntries, month, day, limit));
    }
  }
  return digests;
}

/**
 * Save digests to disk (one file per date).
 * @param {Map<string, object>} digests
 * @param {string} outputDir
 */
function saveDigests(digests, outputDir = '/tmp/otd-widget-digests') {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  for (const [key, digest] of digests) {
    fs.writeFileSync(path.join(outputDir, `${key}.json`), JSON.stringify(digest, null, 0));
  }
  return digests.size;
}

/**
 * Strip heavy fields for the slim widget digest.
 * Widget cards only need title, year, image, link.
 */
function stripHeavy(entry) {
  return {
    title: entry.title,
    year: entry.year,
    type: entry.type,
    wikipedia_url: entry.wikipedia_url,
    image_url: entry.image_url,
    rank_score: entry.rank_score || 0
  };
}

module.exports = { buildDigest, buildAllDigests, saveDigests };
