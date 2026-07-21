/**
 * Year-page data library
 *
 * Per Blueprint Ch 7 (T4: year pages): for each year (~150, 1875-2025),
 * aggregate events + births + deaths + culture stats.
 *
 * Output: content/otd/years/{year}.json
 *
 * Source: Blueprint Ch 7 (T4)
 */

const fs = require('fs');
const path = require('path');

/**
 * Build year-page data from a list of entries.
 * @param {object[]} entries
 * @returns {object} { [year]: { events, births, deaths, stats } }
 */
function buildYearPages(entries) {
  const years = new Map();

  for (const e of entries) {
    if (!e.year || e.year < 1500 || e.year > 2030) continue;

    if (!years.has(e.year)) {
      years.set(e.year, {
        year: e.year,
        events: [],
        births: [],
        deaths: [],
        weddings: [],
        holidays: []
      });
    }
    const bucket = years.get(e.year);
    if (e.type === 'event') bucket.events.push(e);
    else if (e.type === 'birth') bucket.births.push(e);
    else if (e.type === 'death') bucket.deaths.push(e);
    else if (e.type === 'wedding') bucket.weddings.push(e);
    else if (e.type === 'holiday') bucket.holidays.push(e);
  }

  // Compute stats + sort
  for (const [year, data] of years) {
    data.stats = {
      eventCount: data.events.length,
      birthCount: data.births.length,
      deathCount: data.deaths.length,
      weddingCount: data.weddings.length,
      holidayCount: data.holidays.length,
      avgImportance: avg(data, 'importance'),
      maxRankScore: max(data, 'rank_score')
    };
    // Sort by notability desc
    data.events.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
    data.births.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
    data.deaths.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
  }

  return Object.fromEntries(years);
}

/**
 * Save year pages to disk.
 * @param {object} yearData
 * @param {string} outputDir
 */
function saveYearPages(yearData, outputDir = '/tmp/otd-years') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  for (const [year, data] of Object.entries(yearData)) {
    fs.writeFileSync(path.join(outputDir, `${year}.json`), JSON.stringify(data, null, 0));
  }
  return Object.keys(yearData).length;
}

function avg(arr, key) {
  const items = arr.flatMap(b => b.events || []).concat(arr.flatMap(b => b.births || [])).concat(arr.flatMap(b => b.deaths || []));
  if (items.length === 0) return 0;
  return items.reduce((sum, e) => sum + (e[key] || 0), 0) / items.length;
}

function max(arr, key) {
  const items = arr.flatMap(b => b.events || []).concat(arr.flatMap(b => b.births || [])).concat(arr.flatMap(b => b.deaths || []));
  if (items.length === 0) return 0;
  return Math.max(...items.map(e => e[key] || 0));
}

module.exports = { buildYearPages, saveYearPages };
