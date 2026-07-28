// Screenshot script using playwright
const { chromium } = require('playwright');

(async () => {
  const url = 'https://tdp-landing-dev.nsura2029.workers.dev/world-time/united-states/';
  const out = '/workspace/dateandtime-live/.worktrees/feat-world-time-hub/phase-15-usa-top100.png';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log('Saved to', out);
})();
