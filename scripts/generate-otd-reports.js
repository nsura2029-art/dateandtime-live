/**
 * Phase 2/3/4 Report Generator
 *
 * After the main batch runs, this script generates all derived data + reports.
 * Single command, runs the rest of the pipeline.
 *
 * Usage:
 *   node scripts/generate-otd-reports.js
 *   node scripts/generate-otd-reports.js --input /tmp/otd-data-final/dates/ --output /tmp/otd-final/
 */

const fs = require('fs');
const path = require('path');

const { extractPersons, buildBirthdayTwinIndex } = require('./lib/persons');
const { buildCategoryDate, saveCategoryDate } = require('./lib/category-date');
const { buildYearPages, saveYearPages } = require('./lib/year-pages');
const { buildDaysSinceIndex, saveDaysSinceIndex } = require('./lib/days-since');
const { saveZodiacIndex } = require('./lib/zodiac');
const { buildHolidayYears } = require('./lib/holiday-year');
const { saveNationalDays } = require('./lib/national-days');
const { buildAllDigests, saveDigests } = require('./lib/widget-digest');
const { computeWouldBeAges, saveWouldBeAges } = require('./lib/would-be-age');
const { buildAttributionText, generateFAQs } = require('./lib/attribution');
const { markVerified } = require('./lib/dedup');

const INPUT_DIR = process.env.INPUT_DIR || '/tmp/otd-data-final/dates';
const WEDDINGS_DIR = process.env.WEDDINGS_DIR || '/tmp/otd-weddings/by-date';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/tmp/otd-final';

async function main() {
  console.log('========================================');
  console.log('📊 OTD REPORT GENERATOR');
  console.log('========================================');
  console.log(`Input: ${INPUT_DIR}`);
  console.log(`Weddings: ${WEDDINGS_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Input dir not found: ${INPUT_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const startTime = Date.now();

  // ---- Load all entries ----
  console.log('\n[1/12] Loading entries...');
  const allEntries = [];
  const dateFiles = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.json'));
  for (const file of dateFiles) {
    try {
      const content = fs.readFileSync(path.join(INPUT_DIR, file), 'utf-8');
      const entries = JSON.parse(content);
      allEntries.push(...entries);
    } catch (e) {
      console.warn(`  ${file}: ${e.message}`);
    }
  }
  console.log(`  Loaded ${allEntries.length} entries from ${dateFiles.length} dates`);

  // ---- Load weddings if available ----
  let allWeddings = [];
  if (fs.existsSync(WEDDINGS_DIR)) {
    console.log('\n[2/12] Loading weddings...');
    const weddingFiles = fs.readdirSync(WEDDINGS_DIR).filter(f => f.endsWith('.json'));
    for (const file of weddingFiles) {
      try {
        const content = fs.readFileSync(path.join(WEDDINGS_DIR, file), 'utf-8');
        const weddings = JSON.parse(content);
        allWeddings.push(...weddings);
      } catch (e) { /* skip */ }
    }
    allEntries.push(...allWeddings.map(w => ({ ...w, type: 'wedding' })));
    console.log(`  Loaded ${allWeddings.length} weddings`);
  }

  // ---- Persons ----
  console.log('\n[3/12] Extracting persons...');
  const persons = extractPersons(allEntries);
  console.log(`  ${persons.length} unique persons`);

  const top50k = persons
    .sort((a, b) => (b.notability_score || 0) - (a.notability_score || 0))
    .slice(0, 50_000);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'persons-top-50k.json'), JSON.stringify(top50k, null, 0));

  // ---- Birthday-twin ----
  console.log('\n[4/12] Building birthday-twin index...');
  const birthdayIndex = buildBirthdayTwinIndex(persons);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'birthday-twin.json'), JSON.stringify(birthdayIndex, null, 0));
  console.log(`  ${Object.keys(birthdayIndex).length} dates`);

  // ---- Category×date ----
  console.log('\n[5/12] Building category×date...');
  const catData = buildCategoryDate(allEntries);
  saveCategoryDate(catData, path.join(OUTPUT_DIR, 'categories'));

  // ---- Year pages ----
  console.log('\n[6/12] Building year pages...');
  const yearData = buildYearPages(allEntries);
  saveYearPages(yearData, path.join(OUTPUT_DIR, 'years'));

  // ---- Days-since ----
  console.log('\n[7/12] Building days-since index...');
  const daysIndex = buildDaysSinceIndex(allEntries);
  saveDaysSinceIndex(daysIndex, path.join(OUTPUT_DIR, 'days-since-index.json'));

  // ---- Zodiac/generation ----
  console.log('\n[8/12] Building zodiac/generation...');
  saveZodiacIndex(persons, path.join(OUTPUT_DIR, 'zodiac'));

  // ---- Holiday-year ----
  console.log('\n[9/12] Building holiday-year...');
  const currentYear = new Date().getFullYear();
  const holidayYears = buildHolidayYears(currentYear, currentYear + 3);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'holiday-years.json'), JSON.stringify(holidayYears, null, 0));

  // ---- National days ----
  console.log('\n[10/12] Saving national days...');
  saveNationalDays(path.join(OUTPUT_DIR, 'national-days'));

  // ---- Widget digests ----
  console.log('\n[11/12] Building widget digests...');
  const digests = buildAllDigests(allEntries, 5);
  saveDigests(digests, path.join(OUTPUT_DIR, 'widget-digests'));

  // ---- Would-be ages ----
  console.log('\n[12/12] Computing would-be ages...');
  const wouldBe = computeWouldBeAges(persons);
  saveWouldBeAges(wouldBe, path.join(OUTPUT_DIR, 'would-be-ages.json'));

  // ---- Verification report ----
  console.log('\n[BONUS] Cross-source verification report...');
  const verified = allEntries.filter(e => e.verified === 1);
  const review = allEntries.filter(e => e.verified !== 1);
  const verification = {
    generated_at: new Date().toISOString(),
    total_entries: allEntries.length,
    verified_count: verified.length,
    verified_pct: ((verified.length / allEntries.length) * 100).toFixed(1),
    review_count: review.length,
    review_pct: ((review.length / allEntries.length) * 100).toFixed(1),
    by_source: countBySource(allEntries),
    by_type: countByType(allEntries),
    by_language: countByLanguage(allEntries)
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'verification-report.json'), JSON.stringify(verification, null, 2));
  console.log(`  Verified: ${verification.verified_pct}% (${verified.length}), Review: ${verification.review_pct}% (${review.length})`);

  // ---- FAQ + attribution samples ----
  console.log('\n[BONUS] Generating sample FAQ + attribution...');
  const sample = allEntries.slice(0, 5).map(e => ({
    title: e.title,
    faqs: generateFAQs(e),
    attribution: buildAttributionText(['wikipedia_feed', 'wikidata_qlever'])
  }));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sample-faqs.json'), JSON.stringify(sample, null, 2));

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n========================================');
  console.log('✅ ALL REPORTS GENERATED');
  console.log('========================================');
  console.log(`Duration: ${duration}s`);
  console.log(`Output: ${OUTPUT_DIR}/`);
  console.log('\nFiles:');
  for (const f of fs.readdirSync(OUTPUT_DIR)) {
    const stat = fs.statSync(path.join(OUTPUT_DIR, f));
    console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  }
}

function countBySource(entries) {
  const counts = {};
  for (const e of entries) {
    try {
      const sources = JSON.parse(e.verified_in || '[]');
      for (const s of sources) {
        counts[s] = (counts[s] || 0) + 1;
      }
    } catch (err) { /* skip */ }
  }
  return counts;
}

function countByType(entries) {
  const counts = {};
  for (const e of entries) {
    counts[e.type] = (counts[e.type] || 0) + 1;
  }
  return counts;
}

function countByLanguage(entries) {
  const counts = {};
  for (const e of entries) {
    counts[e.language || 'unknown'] = (counts[e.language || 'unknown'] || 0) + 1;
  }
  return counts;
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
