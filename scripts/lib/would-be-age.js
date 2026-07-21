/**
 * "X would be N today" data library
 *
 * Per Blueprint Ch 7 (T7 + T9: anniversary math):
 *   For each deceased celebrity, compute would-be age as of today.
 *   Used for the "would-be-N-today" widget on the today page.
 *
 * Source: Blueprint Ch 7 (T7) + Insight #5 (birthday bump)
 */

/**
 * Compute would-be ages for deceased persons as of today.
 * @param {object[]} persons - with birth_year, death_year (if dead)
 * @param {Date} [today] - reference date (default: now)
 * @returns {object[]} sorted by would-be age DESC
 */
function computeWouldBeAges(persons, today = new Date()) {
  const deceased = persons.filter(p => p.birth_year && p.death_year);
  const year = today.getFullYear();

  return deceased
    .map(p => {
      const wouldBe = year - p.birth_year;
      return {
        wikidata_id: p.wikidata_id,
        label: p.label,
        description: p.description,
        birth_year: p.birth_year,
        death_year: p.death_year,
        would_be_age: wouldBe,
        years_since_death: year - p.death_year,
        image_url: p.image_url,
        wikipedia_url: p.wikipedia_url
      };
    })
    .filter(p => p.would_be_age > 0 && p.would_be_age < 200)
    .sort((a, b) => b.would_be_age - a.would_be_age);
}

/**
 * Save the would-be-ages index.
 * @param {object[]} items
 * @param {string} outputPath
 */
function saveWouldBeAges(items, outputPath = '/tmp/otd-would-be-ages.json') {
  const fs = require('fs');
  const top = items.slice(0, 1000);
  fs.writeFileSync(outputPath, JSON.stringify(top, null, 0));
  return top.length;
}

module.exports = { computeWouldBeAges, saveWouldBeAges };
