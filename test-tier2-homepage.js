// Test the new Tier 2 + Tier 3 sections render and the JS doesn't crash
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync("index.html", "utf8");

// Mock window.DTData since this is offline
const mockDT = `
window.DTData = {
  getHolidaysToday: async () => null,
  getHolidaysUpcoming: async () => null,
  getHolidaysForYear: async () => [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-01-19", name: "Martin Luther King Jr. Day" },
    { date: "2026-02-16", name: "Presidents' Day" },
    { date: "2026-05-25", name: "Memorial Day" },
    { date: "2026-07-04", name: "Independence Day" },
    { date: "2026-09-07", name: "Labor Day" },
    { date: "2026-11-26", name: "Thanksgiving" },
    { date: "2026-12-25", name: "Christmas Day" }
  ],
  getOnThisDay: async () => ({ events: [{ year: 1969, title: "Apollo 11 lands on the Moon", description: "First crewed Moon landing", subcategory: "space" }] }),
  getDSTUpcoming: async () => null,
  getSun: async () => ({ sunrise: "2026-07-21T09:41:00.000Z", sunset: "2026-07-22T00:23:00.000Z", daylight_hours: 14.7 }),
  getPersonToday: async () => ({ persons: [{ name: "Ernest Hemingway", birth_year: 1899, death_year: 1961, profession: "Writer", country: "US", slug: "ernest-hemingway", image_url: null }] }),
  getYearTimeline: async () => ({ events: [{ year: 2026, month: 1, title: "Test event January" }] }),
  computeLongWeekends: (holidays, opts) => {
    // Mock: return 3 long weekends
    return [
      { start: "2026-05-23", end: "2026-05-25", days: 3, name: "Memorial Day Weekend", anchor: "2026-05-25" },
      { start: "2026-07-04", end: "2026-07-06", days: 3, name: "Independence Day Weekend", anchor: "2026-07-04" },
      { start: "2026-11-26", end: "2026-11-29", days: 4, name: "Thanksgiving", anchor: "2026-11-26" }
    ];
  },
  $: (s) => document.querySelector(s),
  $$: (s) => Array.from(document.querySelectorAll(s)),
  esc: (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  fmtDateRange: (a, b) => a + " — " + b
};
`;

const dom = new JSDOM(html, {
  runScripts: "outside-only",
  resources: "usable",
  url: "https://tdp-landing-dev.nsura2029.workers.dev/",
  pretendToBeVisual: true
});

const { window } = dom;
const { document } = window;

// Inject mock DTData BEFORE the inline scripts run
window.eval(mockDT);

// Now manually trigger the inline scripts
const inlineScripts = document.querySelectorAll("script:not([src])");
console.log(`Found ${inlineScripts.length} inline scripts`);

// Run each inline script
for (const script of inlineScripts) {
  try {
    window.eval(script.textContent);
  } catch (e) {
    console.log(`Script error: ${e.message}`);
  }
}

// Wait for async ops to settle
setTimeout(() => {
  console.log("\n=== Section presence ===");
  const expected = ["hero", "clock", "search", "favorites", "today-on-earth", "explore", "kbc", "snapshot", "lwf", "dyk", "bd", "cbd", "deaths", "yt", "onthisday-section", "faq"];
  let pass = 0, fail = 0;
  for (const s of expected) {
    const found = document.querySelector(`[class*="section--${s}"]`);
    if (found) { console.log(`  ✓ section--${s}`); pass++; }
    else { console.log(`  ✗ section--${s} MISSING`); fail++; }
  }
  console.log(`\n${pass} pass, ${fail} fail`);

  console.log("\n=== Chip cloud check ===");
  const chips = document.querySelectorAll(".kb-chip");
  console.log(`  ${chips.length} chips found (expected 12)`);

  console.log("\n=== Snapshot cards ===");
  const cards = document.querySelectorAll(".snapshot-card");
  console.log(`  ${cards.length} cards found (expected 4)`);

  console.log("\n=== LWF select ===");
  const sel = document.querySelector("#lwf-country");
  console.log(`  ${sel ? "found" : "MISSING"}, ${sel ? sel.options.length : 0} options`);

  console.log("\n=== API helper loaded? ===");
  console.log(`  window.DTData: ${window.DTData ? "OK" : "MISSING"}`);

  process.exit(0);
}, 1000);
