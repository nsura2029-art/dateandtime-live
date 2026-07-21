/**
 * Main Batch Orchestrator for On This Day
 *
 * Pipeline:
 *   1. Fetch raw entries from all sources (Wikidata, Wikipedia, Nager, TMDB, MusicBrainz)
 *   2. Normalize into our schema
 *   3. Validate against schema rules
 *   4. Check for duplicates against existing data
 *   5. Auto-improve (fill missing fields)
 *   6. Calculate quality score
 *   7. Push to API
 *
 * Usage:
 *   node scripts/fetch-otd-batch.js --month 7 --day 20
 *   node scripts/fetch-otd-batch.js --date 2026-07-20
 *   node scripts/fetch-otd-batch.js --range 2026-07-20 2026-07-27
 *   node scripts/fetch-otd-batch.js --top-dates
 *   node scripts/fetch-otd-batch.js --all-365
 *
 * Options:
 *   --api-base <url>     API base URL (default: https://dev.api.dateandtime.live)
 *   --no-images          Skip image fetching (faster)
 *   --no-improve         Skip auto-improvement
 *   --dry-run            Don't push to API
 *   --verbose            Show detailed output
 *   --max-per-day <n>    Max entries per day per type (default: 20)
 */

const API_BASE = process.env.API_BASE || 'https://dev.api.dateandtime.live';
const USER_AGENT = 'dateandtime.live/1.0';

const wikidata = require('./sources/wikidata');
const wikipedia = require('./sources/wikipedia');
const { scoreEntry, generateReport, printReport } = require('./lib/quality-scorer');
const { validateEntry, findDuplicate, batchValidate } = require('./lib/validation');
const { improveBatch } = require('./lib/auto-improve');

// Top 50 high-search dates (curated based on search volume and user interest)
const TOP_50_DATES = [
  [1, 1],   // New Year's Day
  [1, 15],  // Martin Luther King Jr. Day
  [1, 27],  // Holocaust Remembrance Day
  [2, 2],   // Groundhog Day
  [2, 14],  // Valentine's Day
  [2, 19],  // I Have a Dream (varies)
  [2, 24],  // Flag Day Mexico
  [3, 8],   // International Women's Day
  [3, 14],  // Pi Day / Einstein birthday
  [3, 17],  // St Patrick's Day
  [3, 20],  // Spring equinox (varies)
  [4, 1],   // April Fools' Day
  [4, 15],  // Tax Day US
  [4, 22],  // Earth Day
  [4, 23],  // St George's Day
  [5, 1],   // May Day / Labor Day
  [5, 4],   // Star Wars Day
  [5, 8],   // VE Day
  [5, 9],   // Europe Day
  [5, 11],  // End of WWII Europe
  [5, 12],  // International Nurses Day
  [5, 14],  // Anniversary of Israeli independence
  [5, 29],  // Mount Everest summit
  [6, 6],   // D-Day
  [6, 21],  // Summer solstice (varies)
  [7, 4],   // Independence Day US
  [7, 14],  // Bastille Day
  [7, 20],  // Moon landing
  [8, 6],   // Hiroshima
  [8, 9],   // Nagasaki
  [8, 15],  // India Independence Day
  [8, 19],  // Afghan independence
  [9, 1],   // WWII start
  [9, 11],  // 9/11
  [9, 16],  // Mexican Independence Day
  [9, 17],  // Constitution Day US
  [10, 1],  // China National Day
  [10, 3],  // German Unity Day
  [10, 9],  // Leif Erikson Day
  [10, 12], // Columbus Day (varies)
  [10, 24], // United Nations Day
  [10, 31], // Halloween
  [11, 1],  // All Saints' Day
  [11, 2],  // Day of the Dead
  [11, 11], // Veterans Day / Armistice
  [11, 22], // JFK assassination
  [11, 25], // Thanksgiving (varies)
  [12, 7],  // Pearl Harbor
  [12, 10], // Human Rights Day
  [12, 25], // Christmas
  [12, 31]  // New Year's Eve
];

/**
 * Parse command-line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    month: null,
    day: null,
    date: null,
    range: null,
    topDates: false,
    all365: false,
    apiBase: API_BASE,
    noImages: false,
    noImprove: false,
    dryRun: false,
    saveToFile: false,
    outputDir: '/tmp/otd-data',
    verbose: false,
    maxPerDay: 20
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    if (arg === '--month' && next) { opts.month = parseInt(next); i++; }
    else if (arg === '--day' && next) { opts.day = parseInt(next); i++; }
    else if (arg === '--date' && next) { opts.date = next; i++; }
    else if (arg === '--range' && next && args[i + 2]) { 
      opts.range = [next, args[i + 2]]; 
      i += 2; 
    }
    else if (arg === '--top-dates') { opts.topDates = true; }
    else if (arg === '--all-365') { opts.all365 = true; }
    else if (arg === '--api-base' && next) { opts.apiBase = next; i++; }
    else if (arg === '--no-images') { opts.noImages = true; }
    else if (arg === '--no-improve') { opts.noImprove = true; }
    else if (arg === '--dry-run') { opts.dryRun = true; }
    else if (arg === '--save-to-file') { opts.saveToFile = true; }
    else if (arg === '--output-dir' && next) { opts.outputDir = next; i++; }
    else if (arg === '--verbose') { opts.verbose = true; }
    else if (arg === '--max-per-day' && next) { opts.maxPerDay = parseInt(next); i++; }
  }
  
  return opts;
}

/**
 * Build a list of (month, day) tuples to process.
 */
function buildDateList(opts) {
  const dates = [];
  
  if (opts.month && opts.day) {
    dates.push([opts.month, opts.day]);
  } else if (opts.date) {
    const [y, m, d] = opts.date.split('-').map(Number);
    dates.push([m, d]);
  } else if (opts.range) {
    const [start, end] = opts.range.map(d => new Date(d));
    const current = new Date(start);
    while (current <= end) {
      dates.push([current.getMonth() + 1, current.getDate()]);
      current.setDate(current.getDate() + 1);
    }
  } else if (opts.topDates) {
    dates.push(...TOP_50_DATES);
  } else if (opts.all365) {
    for (let m = 1; m <= 12; m++) {
      const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
      for (let d = 1; d <= daysInMonth; d++) {
        dates.push([m, d]);
      }
    }
  } else {
    // Default: today
    const today = new Date();
    dates.push([today.getMonth() + 1, today.getDate()]);
  }
  
  return dates;
}

/**
 * Fetch all entries for a (month, day) tuple from all sources.
 */
async function fetchAllSourcesForDay(month, day, opts) {
  console.log(`\n📅 Fetching data for ${monthName(month)} ${day}...`);
  
  const allEntries = [];
  
  // 1. Wikidata (events, births, deaths)
  try {
    if (opts.verbose) console.log('  → Querying Wikidata...');
    const [events, births, deaths] = await Promise.all([
      wikidata.fetchEventsForDay(month, day, { limit: opts.maxPerDay }),
      wikidata.fetchBirthsForDay(month, day, { limit: opts.maxPerDay }),
      wikidata.fetchDeathsForDay(month, day, { limit: opts.maxPerDay })
    ]);
    
    for (const event of events) {
      allEntries.push({
        ...event,
        type: 'event',
        category: 'events',
        wikipedia_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(event.title?.replace(/ /g, '_') || '')}`,
        data_sources: JSON.stringify([{ name: 'wikidata', retrieved_at: new Date().toISOString() }])
      });
    }
    
    for (const birth of births) {
      allEntries.push({
        ...birth,
        type: 'birth',
        category: 'births',
        wikipedia_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(birth.title?.replace(/ /g, '_') || '')}`
      });
    }
    
    for (const death of deaths) {
      allEntries.push({
        ...death,
        type: 'death',
        category: 'deaths',
        wikipedia_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(death.title?.replace(/ /g, '_') || '')}`
      });
    }
    
    if (opts.verbose) {
      console.log(`    Found ${events.length} events, ${births.length} births, ${deaths.length} deaths`);
    }
  } catch (err) {
    console.warn(`  ⚠️  Wikidata failed: ${err.message}`);
  }
  
  // 2. Wikipedia "On this day" feed (different selection)
  try {
    if (opts.verbose) console.log('  → Querying Wikipedia...');
    const data = await wikipedia.fetchOnThisDayEntries(month, day);
    // Merge — Wikipedia's curated list often has different entries than raw Wikidata
    for (const e of data.events) {
      allEntries.push({ ...e, data_sources: JSON.stringify([{ name: 'wikipedia', url: e.wikipedia_url, retrieved_at: new Date().toISOString() }]) });
    }
    for (const b of data.births) {
      allEntries.push({ ...b, type: 'birth', category: 'births' });
    }
    for (const d of data.deaths) {
      allEntries.push({ ...d, type: 'death', category: 'deaths' });
    }
    for (const h of data.holidays) {
      allEntries.push({ ...h, type: 'event', category: 'events' });
    }
    if (opts.verbose) {
      console.log(`    Found ${data.events.length} curated events, ${data.births.length} births, ${data.deaths.length} deaths, ${data.holidays.length} holidays`);
    }
  } catch (err) {
    console.warn(`  ⚠️  Wikipedia failed: ${err.message}`);
  }
  
  return allEntries;
}

/**
 * Deduplicate entries within the batch.
 */
function dedupeBatch(entries) {
  const seen = new Set();
  const unique = [];
  
  for (const entry of entries) {
    // Create a key for dedup
    const key = `${entry.month}-${entry.day}-${entry.year}-${(entry.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  
  return unique;
}

/**
 * Push entries to the API. Falls back to saving to a file if API doesn't support POST.
 */
async function pushToApi(entries, opts) {
  if (opts.dryRun) {
    console.log(`  [DRY RUN] Would push ${entries.length} entries to ${opts.apiBase}`);
    return { pushed: entries.length, failed: 0 };
  }
  
  if (opts.saveToFile) {
    return await saveToFile(entries, opts);
  }
  
  const results = { pushed: 0, failed: 0, errors: [] };
  const batchSize = 10;
  
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (entry) => {
        try {
          const res = await fetch(`${opts.apiBase}/api/v1/onthisday`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': USER_AGENT
            },
            body: JSON.stringify(entry)
          });
          if (!res.ok) {
            results.errors.push({ title: entry.title, status: res.status, text: await res.text().catch(() => '') });
            return false;
          }
          return true;
        } catch (err) {
          results.errors.push({ title: entry.title, error: err.message });
          return false;
        }
      })
    );
    
    for (const ok of batchResults) {
      if (ok) results.pushed++;
      else results.failed++;
    }
  }
  
  return results;
}

/**
 * Save entries to a JSON file.
 */
async function saveToFile(entries, opts) {
  const fs = require('fs');
  const path = require('path');
  
  const outputDir = opts.outputDir || '/tmp/otd-data';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(outputDir, `otd-${timestamp}.json`);
  
  fs.writeFileSync(filename, JSON.stringify(entries, null, 2));
  
  // Also write a "latest" file for easy access
  const latestFile = path.join(outputDir, 'otd-latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(entries, null, 2));
  
  console.log(`  💾 Saved ${entries.length} entries to ${filename}`);
  
  return { pushed: entries.length, failed: 0, file: filename };
}

/**
 * Main.
 */
async function main() {
  const opts = parseArgs();
  const dates = buildDateList(opts);
  
  console.log('========================================');
  console.log('🚀 ON-THIS-DAY BATCH FETCHER');
  console.log('========================================');
  console.log(`Mode: ${opts.topDates ? 'top 50 dates' : opts.all365 ? 'all 365 days' : opts.range ? `range ${opts.range[0]} to ${opts.range[1]}` : 'single date'}`);
  console.log(`Dates to process: ${dates.length}`);
  console.log(`API: ${opts.apiBase}`);
  console.log(`Options: ${JSON.stringify({ noImages: opts.noImages, noImprove: opts.noImprove, dryRun: opts.dryRun, verbose: opts.verbose, maxPerDay: opts.maxPerDay })}`);
  console.log('========================================');
  
  const allResults = [];
  const startTime = Date.now();
  
  for (const [month, day] of dates) {
    try {
      // 1. Fetch from all sources
      let entries = await fetchAllSourcesForDay(month, day, opts);
      
      // 2. Dedupe within batch
      entries = dedupeBatch(entries);
      
      if (entries.length === 0) {
        console.log(`  No entries found for ${monthName(month)} ${day}`);
        continue;
      }
      
      console.log(`  → ${entries.length} unique entries after dedup`);
      
      // 3. Validate
      const { valid, invalid } = batchValidate(entries);
      if (invalid.length > 0 && opts.verbose) {
        console.log(`  ⚠️  ${invalid.length} entries failed validation:`);
        for (const { entry, result } of invalid.slice(0, 3)) {
          for (const err of result.errors.slice(0, 2)) {
            console.log(`     - ${err.field}: ${err.message}`);
          }
        }
      }
      
      // 4. Auto-improve (if not skipped)
      let improved = valid;
      if (!opts.noImprove && valid.length > 0) {
        if (opts.verbose) console.log(`  → Auto-improving ${valid.length} entries...`);
        const improveResult = await improveBatch(valid, { 
          skipImageFetch: opts.noImages,
          concurrency: 3
        });
        improved = improveResult.improved.map(r => r.improved || r);
        if (opts.verbose) {
          console.log(`    ${improveResult.stats.improved} improved, +${improveResult.stats.score_gained} total score`);
        }
      }
      
      // 5. Quality scoring
      const scored = improved.map(e => ({
        ...e,
        ...scoreEntry(e),
        quality_breakdown: JSON.stringify(scoreEntry(e).breakdown)
      }));
      
      // 6. Push to API
      if (opts.verbose) console.log(`  → Pushing to API...`);
      const pushResult = await pushToApi(scored, opts);
      console.log(`  ✓ Pushed ${pushResult.pushed}/${scored.length} (${pushResult.failed} failed)`);
      
      allResults.push(...scored);
    } catch (err) {
      console.error(`  ✗ Failed for ${monthName(month)} ${day}: ${err.message}`);
    }
    
    // Rate limit between days
    if (dates.length > 1) {
      await sleep(500);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n========================================');
  console.log('📊 BATCH COMPLETE');
  console.log('========================================');
  console.log(`Total entries processed: ${allResults.length}`);
  console.log(`Duration: ${duration}s`);
  
  if (allResults.length > 0) {
    const report = generateReport(allResults);
    printReport(report);
  }
}

function monthName(month) {
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                 'July', 'August', 'September', 'October', 'November', 'December'];
  return names[month] || '';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  main,
  parseArgs,
  buildDateList,
  fetchAllSourcesForDay,
  dedupeBatch,
  pushToApi,
  TOP_50_DATES
};
