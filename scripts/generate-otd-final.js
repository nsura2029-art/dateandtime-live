/**
 * Master Pipeline Runner
 *
 * Single command to run the entire Phase 1-4 data pipeline.
 * Per Blueprint Ch 9 (90-day plan).
 *
 * Usage:
 *   node scripts/generate-otd-final.js              # full pipeline
 *   node scripts/generate-otd-final.js --skip-fetch  # use existing data
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TMP_DIR = process.env.TMP_DIR || '/tmp/otd-data-final';
const WEDDINGS_DIR = process.env.WEDDINGS_DIR || '/tmp/otd-weddings';
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/tmp/otd-final';

function runStep(name, cmd) {
  console.log(`\n[STEP] ${name}`);
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    throw err;
  }
}

function main() {
  const args = process.argv.slice(2);
  const skipFetch = args.includes('--skip-fetch');
  const skipWeddings = args.includes('--skip-weddings');
  const skipReports = args.includes('--skip-reports');

  console.log('========================================');
  console.log('🛠️  OTD FULL DATA PIPELINE');
  console.log('========================================');
  console.log(`Per Blueprint Ch 9 (90-day plan)`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('');

  const startTime = Date.now();

  // Phase 1: Fetch
  if (!skipFetch) {
    runStep(
      'Phase 1: Fetch 365-day batch (all sources)',
      `node scripts/fetch-otd-batch.js --all-365 --save-to-file --output-dir ${TMP_DIR} --max-per-day 30 --no-improve`
    );
  }

  // Phase 1: Weddings (parallel, separate)
  if (!skipWeddings) {
    runStep(
      'Phase 2: Fetch 414K weddings (separate)',
      `node scripts/fetch-weddings.js`
    );
  }

  // Phase 2-4: Reports
  if (!skipReports) {
    runStep(
      'Phase 2-4: Generate all derived data + reports',
      `node scripts/generate-otd-reports.js --input ${TMP_DIR}/dates --output ${OUTPUT_DIR}`
    );
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n========================================');
  console.log(`✅ COMPLETE in ${duration} min`);
  console.log('========================================');
  console.log(`Output: ${OUTPUT_DIR}/`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
