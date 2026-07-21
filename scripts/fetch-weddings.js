/**
 * Fetch all dated marriages from Wikidata for the 366 calendar days.
 * Per Blueprint Ch 5: 414,149 dated marriages in Wikidata (P26 + pq:P580).
 *
 * This is a SEPARATE pull from the main batch because:
 *  - Weddings query is heavy (joins P26 + pq:P580 across all persons)
 *  - Output is a separate dataset (couples + dates)
 *  - Needs its own rate limiting (20+ minutes for full year)
 *
 * Output: content/otd/weddings.json (slim) + content/otd/weddings-by-date/{MM-DD}.json
 */

const fs = require('fs');
const path = require('path');
const wikidata = require('./sources/wikidata');

const TOP_COUPLE_LIMIT = 200;       // top 200 couples per day by sitelinks
const MIN_SITELINKS = 30;            // only well-known couples

const OUTPUT_DIR = process.env.OUTPUT_DIR || '/tmp/otd-weddings';
const RATE_LIMIT_MS = 1000;          // 1 req/s — be gentle with QLever

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('========================================');
  console.log('💍 WIKIDATA WEDDINGS PULLER');
  console.log('========================================');
  console.log('Per Blueprint Ch 5: 414,149 dated marriages');
  console.log(`Top ${TOP_COUPLE_LIMIT} couples per (month, day) with minSitelinks=${MIN_SITELINKS}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('========================================\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const datesDir = path.join(OUTPUT_DIR, 'by-date');
  if (!fs.existsSync(datesDir)) {
    fs.mkdirSync(datesDir, { recursive: true });
  }

  const allWeddings = [];
  const startTime = Date.now();

  for (let month = 1; month <= 12; month++) {
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      try {
        const weddings = await wikidata.fetchWeddingsForDay(month, day, {
          limit: TOP_COUPLE_LIMIT,
          minSitelinks: MIN_SITELINKS
        });

        if (weddings.length > 0) {
          // Save per-date
          const filename = path.join(datesDir, `${dateKey}.json`);
          fs.writeFileSync(filename, JSON.stringify(weddings, null, 0));
          allWeddings.push(...weddings);
          console.log(`  ${dateKey}: ${weddings.length} weddings`);
        }
      } catch (err) {
        console.warn(`  ${dateKey}: error - ${err.message}`);
      }

      await sleep(RATE_LIMIT_MS);
    }
  }

  // Save master index
  const index = {
    generated_at: new Date().toISOString(),
    total_weddings: allWeddings.length,
    total_dates: 366,
    couples: allWeddings
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'all-weddings.json'), JSON.stringify(index, null, 0));

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n========================================');
  console.log('💍 WEDDINGS PULL COMPLETE');
  console.log('========================================');
  console.log(`Total: ${allWeddings.length} marriages across 366 dates`);
  console.log(`Duration: ${duration}s`);
  console.log(`Output: ${OUTPUT_DIR}/`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { main };
