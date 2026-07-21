/**
 * Days-since/until data library
 *
 * Per Blueprint Ch 7 (T7: days-since/until engine):
 *   For each notable event, compute the days since / until.
 *   Used for "X days since Y" type queries.
 *
 * Per Blueprint Ch 7 + howlongagogo.com #1 at DR 56: this is a winnable
 * segment with 1-15K searches per query across thousands of variants.
 *
 * Source: Blueprint Ch 7 (T7) + Insight #5 (birthday bump)
 */

const fs = require('fs');
const path = require('path');

/**
 * Build a days-since/until index from a list of entries.
 * @param {object[]} entries
 * @param {Date} [now] - reference date (default: today)
 * @returns {object[]} array of {date, title, type, daysSince, daysUntil, ...}
 */
function buildDaysSinceIndex(entries, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return entries
    .filter(e => e.year && e.year >= 1500 && e.year <= 2030 && e.month && e.day)
    .filter(e => e.rank_score && e.rank_score >= 60)  // only notable+
    .map(e => {
      const eventDate = new Date(e.year, e.month - 1, e.day);
      const daysSince = Math.floor((today - eventDate) / 86400000);
      const daysUntil = -daysSince;
      return {
        date: `${e.year}-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`,
        title: e.title,
        type: e.type,
        wikipedia_url: e.wikipedia_url,
        rank_score: e.rank_score,
        daysSince,
        daysUntil,
        anniversary: `${e.year} (${daysSince} years ago)`,
        isAnniversary: e.month === today.getMonth() + 1 && e.day === today.getDate(),
        isMilestone: isMilestone(daysSince)
      };
    })
    .sort((a, b) => b.rank_score - a.rank_score);
}

/**
 * Detect milestone anniversaries (25, 50, 75, 100, 150, 200, 250, 500, 1000 years).
 */
function isMilestone(daysSince) {
  if (daysSince < 0) return false;
  const years = daysSince / 365.25;
  const rounded = Math.round(years);
  const milestones = [10, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];
  return milestones.some(m => Math.abs(rounded - m) === 0);
}

/**
 * Save the index to disk (slim, sorted by rank).
 * @param {object[]} index
 * @param {string} outputPath
 */
function saveDaysSinceIndex(index, outputPath = '/tmp/otd-days-since-index.json') {
  // Keep only top 5,000 by rank_score for the slim file
  const slim = index.slice(0, 5000);
  fs.writeFileSync(outputPath, JSON.stringify(slim, null, 0));
  return slim.length;
}

module.exports = { buildDaysSinceIndex, saveDaysSinceIndex, isMilestone };
