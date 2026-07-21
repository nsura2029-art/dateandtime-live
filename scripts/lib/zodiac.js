/**
 * Zodiac/generation data library
 *
 * Per Blueprint Ch 7 (T11: zodiac pages): group top people by sign and generation.
 *
 * Source: Blueprint Ch 7 (T11)
 */

const fs = require('fs');
const path = require('path');

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const GENERATIONS = [
  'Lost', 'Greatest', 'Silent', 'Boomer', 'Gen X', 'Millennial', 'Gen Z', 'Gen Alpha'
];

/**
 * Group people by star sign.
 * @param {object[]} persons
 * @returns {object} { [sign]: [persons] }
 */
function groupBySign(persons) {
  const groups = {};
  for (const sign of ZODIAC_SIGNS) groups[sign] = [];
  groups['unknown'] = [];

  for (const p of persons) {
    const sign = p.star_sign || 'unknown';
    if (groups[sign]) groups[sign].push(p);
    else groups['unknown'].push(p);
  }

  // Sort each by notability
  for (const sign of Object.keys(groups)) {
    groups[sign].sort((a, b) => (b.notability_score || 0) - (a.notability_score || 0));
  }
  return groups;
}

/**
 * Group people by Chinese zodiac.
 */
function groupByChineseZodiac(persons) {
  const groups = {};
  for (const sign of ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig']) {
    groups[sign] = [];
  }
  groups['unknown'] = [];

  for (const p of persons) {
    const sign = p.chinese_zodiac || 'unknown';
    if (groups[sign]) groups[sign].push(p);
    else groups['unknown'].push(p);
  }

  for (const sign of Object.keys(groups)) {
    groups[sign].sort((a, b) => (b.notability_score || 0) - (a.notability_score || 0));
  }
  return groups;
}

/**
 * Group people by generation.
 */
function groupByGeneration(persons) {
  const groups = {};
  for (const gen of GENERATIONS) groups[gen] = [];

  for (const p of persons) {
    const gen = p.generation || 'unknown';
    if (groups[gen]) groups[gen].push(p);
    else (groups['unknown'] = groups['unknown'] || []).push(p);
  }

  for (const gen of Object.keys(groups)) {
    groups[gen].sort((a, b) => (b.notability_score || 0) - (a.notability_score || 0));
  }
  return groups;
}

/**
 * Save all groupings to disk.
 * @param {object[]} persons
 * @param {string} outputDir
 */
function saveZodiacIndex(persons, outputDir = '/tmp/otd-zodiac') {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const western = groupBySign(persons);
  const chinese = groupByChineseZodiac(persons);
  const generations = groupByGeneration(persons);

  fs.writeFileSync(path.join(outputDir, 'western-zodiac.json'), JSON.stringify(western, null, 0));
  fs.writeFileSync(path.join(outputDir, 'chinese-zodiac.json'), JSON.stringify(chinese, null, 0));
  fs.writeFileSync(path.join(outputDir, 'generations.json'), JSON.stringify(generations, null, 0));

  return {
    western: Object.fromEntries(Object.entries(western).map(([k, v]) => [k, v.length])),
    chinese: Object.fromEntries(Object.entries(chinese).map(([k, v]) => [k, v.length])),
    generations: Object.fromEntries(Object.entries(generations).map(([k, v]) => [k, v.length]))
  };
}

module.exports = {
  ZODIAC_SIGNS,
  GENERATIONS,
  groupBySign,
  groupByChineseZodiac,
  groupByGeneration,
  saveZodiacIndex
};
