#!/usr/bin/env node
/**
 * Build country and state pages.
 *
 * Each generated page is a static HTML file that:
 * 1. Auto-detects its country/state from the URL path (via pre-baked
 *    page config in the HTML)
 * 2. Reuses /src/world-time-cities.js (which already supports ?country
 *    and ?state URL params + a configurable page size)
 * 3. Has the same Hero + Filter + Cards + Tools sections as the hub
 *
 * The "page config" is a tiny <script> that sets:
 *   - window.__PAGE_INITIAL = 20
 *   - window.__PAGE_STEP    = 20
 *   - window.__COUNTRY_CCA2 = "US"
 *   - window.__STATE_CODE   = "06" (only on state pages)
 * These are read by a small auto-init script that's inlined at the
 * top of every page.
 *
 * Usage:
 *   node scripts/build-country-state-pages.js                # all countries (250)
 *   node scripts/build-country-state-pages.js --country US    # US only
 *   node scripts/build-country-state-pages.js --countries US,CN,IN,GB  # list
 */

const fs = require('fs');
const path = require('path');
const { buildHeader, buildFooter } = require('./site-chrome.js');

// Load US state metadata (used to bake the real per-state city count into
// the state page hero, e.g. "26 Washington cities" instead of a placeholder).
let STATE_META = {};
try {
  // state-meta.js exports a `const STATE_META = { ... };` literal.
  // Eval it in a sandboxed context to extract the object.
  const src = fs.readFileSync(path.join(__dirname, 'state-meta.js'), 'utf8');
  const m = src.match(/const\s+STATE_META\s*=\s*(\{[\s\S]*?\});/);
  if (m) {
    STATE_META = (new Function(`return (${m[1]});`))();
  }
} catch (e) {
  // Non-fatal: state pages will fall back to a placeholder city count.
  console.warn('Could not load state-meta.js:', e.message);
}

// ============================================================================
// Lookups
// ============================================================================

const CC2_SLUG = JSON.parse(fs.readFileSync(path.join(__dirname, 'cc2-country-slug.json'), 'utf-8'));
const SLUG2_CC = Object.fromEntries(Object.entries(CC2_SLUG).map(([k, v]) => [v, k]));

// States: "CC|admin1_code|name|native" per line
const STATE_LINES = fs.readFileSync(path.join(__dirname, 'state-lookup.txt'), 'utf-8')
  .split('\n').filter(Boolean);
const STATE_BY_CC = {};  // CC -> [{code, name, slug}]
const STATE_BY_CC_SLUG = {};  // CC -> {stateSlug: code}
for (const line of STATE_LINES) {
  const [cc, code, name, native] = line.split('|');
  if (!STATE_BY_CC[cc]) STATE_BY_CC[cc] = [];
  const s = { code, name, slug: slugify(name) };
  STATE_BY_CC[cc].push(s);
  if (!STATE_BY_CC_SLUG[cc]) STATE_BY_CC_SLUG[cc] = {};
  STATE_BY_CC_SLUG[cc][s.slug] = code;
}

function slugify(s) {
  return (s || '').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Hardcoded country names (top 100 — covers 99% of users)
const COUNTRY_NAMES = {
  US: 'United States', CA: 'Canada', MX: 'Mexico', BR: 'Brazil', AR: 'Argentina',
  CL: 'Chile', CO: 'Colombia', PE: 'Peru', VE: 'Venezuela',
  GB: 'United Kingdom', IE: 'Ireland', FR: 'France', DE: 'Germany', ES: 'Spain',
  IT: 'Italy', PT: 'Portugal', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland',
  AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
  PL: 'Poland', CZ: 'Czech Republic', SK: 'Slovakia', HU: 'Hungary', RO: 'Romania',
  BG: 'Bulgaria', GR: 'Greece', UA: 'Ukraine', RU: 'Russia', BY: 'Belarus',
  TR: 'Türkiye',
  CN: 'China', JP: 'Japan', KR: 'South Korea', IN: 'India', PK: 'Pakistan',
  BD: 'Bangladesh', ID: 'Indonesia', TH: 'Thailand', VN: 'Vietnam',
  PH: 'Philippines', MY: 'Malaysia', SG: 'Singapore', MM: 'Myanmar', KH: 'Cambodia',
  LA: 'Laos', NP: 'Nepal', LK: 'Sri Lanka', TW: 'Taiwan', HK: 'Hong Kong',
  MO: 'Macao', MN: 'Mongolia', AF: 'Afghanistan', KZ: 'Kazakhstan', UZ: 'Uzbekistan',
  AE: 'United Arab Emirates', SA: 'Saudi Arabia', IL: 'Israel', EG: 'Egypt', IR: 'Iran',
  IQ: 'Iraq', JO: 'Jordan', LB: 'Lebanon', SY: 'Syria', YE: 'Yemen', KW: 'Kuwait',
  QA: 'Qatar', BH: 'Bahrain', OM: 'Oman',
  ZA: 'South Africa', NG: 'Nigeria', KE: 'Kenya', ET: 'Ethiopia', EG_: 'Egypt',
  GH: 'Ghana', TZ: 'Tanzania', UG: 'Uganda', DZ: 'Algeria', MA: 'Morocco', TN: 'Tunisia',
  LY: 'Libya', SD: 'Sudan', AO: 'Angola', MZ: 'Mozambique', ZM: 'Zambia', ZW: 'Zimbabwe',
  AU: 'Australia', NZ: 'New Zealand', FJ: 'Fiji', PG: 'Papua New Guinea',
  WS: 'Samoa', TO: 'Tonga', VU: 'Vanuatu', SB: 'Solomon Islands',
  // Less-common but still named
  AD: 'Andorra', AL: 'Albania', AM: 'Armenia', AZ: 'Azerbaijan', BA: 'Bosnia and Herzegovina',
  BB: 'Barbados', BD_: 'Bangladesh', BG_: 'Bulgaria', BH_: 'Bahrain', BJ: 'Benin',
  BN: 'Brunei', BO: 'Bolivia', BS: 'Bahamas', BT: 'Bhutan', BW: 'Botswana', BZ: 'Belize',
  CG: 'Congo', CI: "Côte d'Ivoire", CM: 'Cameroon', CR: 'Costa Rica', CU: 'Cuba',
  CV: 'Cape Verde', CW: 'Curaçao', CY: 'Cyprus', DJ: 'Djibouti', DM: 'Dominica',
  DO: 'Dominican Republic', EC: 'Ecuador', EE: 'Estonia', ER: 'Eritrea', FO: 'Faroe Islands',
  GA: 'Gabon', GD: 'Grenada', GE: 'Georgia', GF: 'French Guiana', GH_: 'Ghana',
  GI: 'Gibraltar', GL: 'Greenland', GM: 'Gambia', GN: 'Guinea', GQ: 'Equatorial Guinea',
  GT: 'Guatemala', GU: 'Guam', GW: 'Guinea-Bissau', GY: 'Guyana', HN: 'Honduras',
  HR: 'Croatia', HT: 'Haiti', IS: 'Iceland', JM: 'Jamaica', KE_: 'Kenya', KG: 'Kyrgyzstan',
  KI: 'Kiribati', KM: 'Comoros', KN: 'Saint Kitts and Nevis', KP: 'North Korea',
  KW_: 'Kuwait', KY: 'Cayman Islands', LA_: 'Laos', LB_: 'Lebanon', LC: 'Saint Lucia',
  LI: 'Liechtenstein', LR: 'Liberia', LS: 'Lesotho', LT: 'Lithuania', LU: 'Luxembourg',
  LV: 'Latvia', LY_: 'Libya', MA_: 'Morocco', MC: 'Monaco', MD: 'Moldova',
  ME: 'Montenegro', MG: 'Madagascar', MH: 'Marshall Islands', MK: 'North Macedonia',
  ML: 'Mali', MM_: 'Myanmar', MN_: 'Mongolia', MR: 'Mauritania', MT: 'Malta',
  MU: 'Mauritius', MV: 'Maldives', MW: 'Malawi', MX_: 'Mexico', MZ_: 'Mozambique',
  NA: 'Namibia', NC: 'New Caledonia', NE: 'Niger', NF: 'Norfolk Island', NG_: 'Nigeria',
  NI: 'Nicaragua', NL_: 'Netherlands', NO_: 'Norway', NP_: 'Nepal', NR: 'Nauru',
  OM_: 'Oman', PA: 'Panama', PE_: 'Peru', PF: 'French Polynesia', PG_: 'Papua New Guinea',
  PH_: 'Philippines', PK_: 'Pakistan', PL_: 'Poland', PR: 'Puerto Rico', PS: 'Palestine',
  PT_: 'Portugal', PW: 'Palau', PY: 'Paraguay', QA_: 'Qatar', RO_: 'Romania',
  RS: 'Serbia', RU_: 'Russia', RW: 'Rwanda', SA_: 'Saudi Arabia', SB_: 'Solomon Islands',
  SC: 'Seychelles', SD_: 'Sudan', SE_: 'Sweden', SG_: 'Singapore', SI: 'Slovenia',
  SK_: 'Slovakia', SL: 'Sierra Leone', SM: 'San Marino', SN: 'Senegal', SO: 'Somalia',
  SR: 'Suriname', SS: 'South Sudan', ST: 'São Tomé and Príncipe', SV: 'El Salvador',
  SY_: 'Syria', SZ: 'Eswatini', TC: 'Turks and Caicos Islands', TD: 'Chad', TG: 'Togo',
  TH_: 'Thailand', TJ: 'Tajikistan', TK: 'Tokelau', TL: 'Timor-Leste', TM: 'Turkmenistan',
  TN_: 'Tunisia', TO_: 'Tonga', TR_: 'Türkiye', TT: 'Trinidad and Tobago', TV: 'Tuvalu',
  TW_: 'Taiwan', TZ_: 'Tanzania', UA_: 'Ukraine', UG_: 'Uganda', UY: 'Uruguay',
  UZ_: 'Uzbekistan', VA: 'Vatican City', VC: 'Saint Vincent and the Grenadines',
  VE_: 'Venezuela', VG: 'British Virgin Islands', VI: 'U.S. Virgin Islands',
  VN_: 'Vietnam', VU_: 'Vanuatu', WF: 'Wallis and Futuna', WS_: 'Samoa', XK: 'Kosovo',
  YE_: 'Yemen', YT: 'Mayotte', ZA_: 'South Africa', ZM_: 'Zambia', ZW_: 'Zimbabwe'
};

// Fallback
function countryName(cca2) {
  return COUNTRY_NAMES[cca2] || cca2;
}

// ============================================================================
// Page config (set per page by the build script)
// ============================================================================

// Per-country minPopulation (set on the country page; affects the city list).
// This is intentionally per-country because small countries (Liechtenstein,
// Vatican, etc.) have zero 40K+ cities. US is the only country using 40,000
// for now — all 51 states have at least one 40K+ city, ensuring every state
// appears in the city grid. Other countries default to 0 (no filter).
// See docs/strategy/city-population-thresholds.md for the rationale.
const MIN_POPULATION = {
  US: 40000,   // 1,246 cities across 51 states
};
function minPopulationFor(cca2) {
  return MIN_POPULATION[cca2] || 0;
}

// Per-country pre-baked city total. Used by the JS to show the right
// count when the API doesn't return a filtered total. Currently only US
// (40K+ threshold = 1,246 cities).
const CITY_TOTAL = {
  US: 1246,
};
function cityTotalFor(cca2) {
  return CITY_TOTAL[cca2] || 0;
}

function autoInitScript(cca2, stateCode, stateSlug, stateName, countryName, countrySlug, states) {
  // For US country page, also include the STATE_META lookup so the rich
  // state cards (with image, timezone, capital, live clock) can render.
  let metaScript = '';
  if (cca2 === 'US' && !stateCode) {
    try {
      const metaSrc = fs.readFileSync(path.join(__dirname, 'state-meta.js'), 'utf8');
      metaScript = `<script>${metaSrc}\nwindow.__STATE_META = STATE_META;</script>`;
    } catch (e) {
      console.warn('Could not load state-meta.js:', e.message);
    }
  }
  return `
<script>
  // Page config (set by the build script)
  window.__PAGE_INITIAL  = 100;
  window.__PAGE_STEP     = 100;
  window.__MIN_POPULATION = ${minPopulationFor(cca2)};
  window.__CITY_TOTAL    = ${cityTotalFor(cca2)};
  window.__COUNTRY_CCA2 = ${JSON.stringify(cca2)};
  window.__STATE_CODE   = ${JSON.stringify(stateCode)};
  window.__COUNTRY_NAME = ${JSON.stringify(countryName)};
  window.__COUNTRY_SLUG = ${JSON.stringify(countrySlug)};
  window.__STATE_SLUG   = ${JSON.stringify(stateSlug)};
  window.__STATE_NAME   = ${JSON.stringify(stateName)};
  window.__STATES       = ${JSON.stringify(states || [])};
</script>
${metaScript}`;
}

// ============================================================================
// HTML templates
// ============================================================================

function buildPage({ cca2, countryName, countrySlug, stateCode, stateSlug, stateName, cityCount, stateCount, states = [] }) {
  const isState = !!stateCode;
  const isCountry = !isState && !!cca2;

  const title = isState
    ? `${stateName}, ${countryName} — Current Time & Cities | dateandtime.live`
    : `${countryName} — Current Time & All Cities | dateandtime.live`;

  const description = isState
    ? `Live current time in ${stateName}, ${countryName}. ${cityCount} cities. Real-time updates, weather, holidays, and more.`
    : `Live current time in ${countryName}. ${cityCount} cities across ${stateCount} states. Real-time updates every second.`;

  const heroH1 = isState
    ? `${stateName}, ${countryName}`
    : `${countryName}`;

  const heroSub = isState
    ? `Live time in cities across the state. Real-time updates every second.`
    : `Live time in <strong>${cityCount} ${countryName} cities</strong> across <strong>${stateCount} states</strong>. Real-time updates every second.`;

  const sectionH2 = isState
    ? `All cities in ${stateName}`
    : `All ${countryName} cities`;

  const sectionSub = isState
    ? `Click any city for its full time zone, weather, holidays, and more. Live local time updates every second.`
    : `Click any city for its full time zone, weather, holidays, and more. Live local time updates every second. The green dot means it's live.`;

  const searchPlaceholder = isState
    ? `Search cities in ${stateName}…`
    : `Search ${countryName} cities…`;

  const breadcrumbLast = isState ? `${stateName}` : `${countryName}`;
  const breadcrumbLastUrl = isState ? `${countrySlug}/${stateSlug}/` : `${countrySlug}/`;

  const stateGridSection = isState ? '' : `
  <section class="wt-hub-section wt-states-section">
    <div class="container">
      <h2>Browse ${countryName} by state</h2>
      <p class="tz-section-sub">Pick a state to see all cities in that state.</p>
      <div class="wt-state-grid" id="wt-state-grid">
        <!-- Populated by JS -->
      </div>
    </div>
  </section>`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="#5b4aaf" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="canonical" href="https://dateandtime.live/world-time/${breadcrumbLastUrl}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/src/world-time.css" />
  <link rel="stylesheet" href="/src/site-shell.css?v=3" />
  <link rel="stylesheet" href="/src/tz-hub.css?v=23" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${escapeHtml(title)}",
    "description": "${escapeHtml(description)}",
    "url": "https://dateandtime.live/world-time/${breadcrumbLastUrl}"
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://dateandtime.live/" },
      { "@type": "ListItem", "position": 2, "name": "World Time", "item": "https://dateandtime.live/world-time/" },
      { "@type": "ListItem", "position": 3, "name": "${escapeHtml(countryName)}", "item": "https://dateandtime.live/world-time/${countrySlug}/" }${isState ? `,
      { "@type": "ListItem", "position": 4, "name": "${escapeHtml(stateName)}", "item": "https://dateandtime.live/world-time/${countrySlug}/${stateSlug}/" }` : ''}
    ]
  }
  </script>
</head>
<body class="shell-page">
${buildHeader(
  isState ? `/world-time/${countrySlug}/state/${stateSlug}/` : `/world-time/${countrySlug}/`,
  isCountry ? { slug: countrySlug, name: countryName, href: `/world-time/${countrySlug}/` } : null
)}

<nav class="breadcrumb" aria-label="Breadcrumb">
  <div class="container">
    <a href="/">Home</a>
    <span class="bc-sep" aria-hidden="true">›</span>
    <a href="/world-time/">World Time</a>
    <span class="bc-sep" aria-hidden="true">›</span>
    <a href="/world-time/${countrySlug}/">${escapeHtml(countryName)}</a>${isState ? `
    <span class="bc-sep" aria-hidden="true">›</span>
    <span aria-current="page">${escapeHtml(stateName)}</span>` : `
    <span class="bc-sep" aria-hidden="true">›</span>
    <span aria-current="page">${escapeHtml(countryName)}</span>`}
  </div>
</nav>

<main class="tz-hub">
  <section class="tz-hero">
    <div class="container">
      <p class="page-hero-eyebrow">${isState ? 'State · ' + escapeHtml(cca2) : 'Country · ' + escapeHtml(cca2)}</p>
      <h1>${escapeHtml(heroH1)}</h1>
      <p class="tz-subtitle">${heroSub}</p>
    </div>
  </section>

  <section class="wt-hub-section" id="all-cities">
    <div class="container">
      <div class="wt-hub-header">
        <h2>${escapeHtml(sectionH2)}</h2>
        <span class="wt-hub-count" id="wt-count">—</span>
      </div>
      <p class="tz-section-sub">${escapeHtml(sectionSub)}</p>

      <div class="wt-filter-bar">
        <div class="wt-filter-bar-top">
          <div class="wt-search">
            <svg class="wt-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" id="wt-search-input" class="wt-search-input" placeholder="${escapeHtml(searchPlaceholder)}" autocomplete="off" spellcheck="false" />
            <button type="button" class="wt-search-clear" id="wt-search-clear" aria-label="Clear search" hidden>×</button>
          </div>
          <label class="wt-sort-wrap">
            <span class="wt-sort-label">Sort:</span>
            <select id="wt-sort-select" class="wt-sort-select">
              <option value="popular">Popular</option>
              <option value="all">All cities</option>
              <option value="name">City A–Z</option>
              ${!stateCode ? '<option value="state">By state</option>' : ''}
            </select>
          </label>
        </div>
      </div>

      <div class="wt-result-bar">
        <span class="wt-result-count" id="wt-result-count">—</span>
        <span class="wt-loading" id="wt-loading" hidden>
          <span class="wt-spinner" aria-hidden="true"></span> Loading…
        </span>
      </div>

      <div class="wt-card-grid" id="wt-card-grid" data-section="cities" aria-busy="false">
        <!-- Populated by JS -->
      </div>

      <div class="wt-load-more-row">
        <button class="wt-load-more" id="wt-load-more" hidden>
          Load more <span data-section-remaining>0</span> ↓
        </button>
        <span class="wt-page-info" id="wt-page-info" hidden>Page 1</span>
      </div>
    </div>
  </section>
  ${stateGridSection}
  <section class="wt-hub-section">
    <div class="container">
      <h2>World Time Tools</h2>
      <div class="tz-tools-grid">
        <a href="/world-time/meeting/" class="tz-tool-card">
          <span class="tz-tool-icon">📅</span>
          <h3>Meeting Planner</h3>
          <p>Find meeting times that work for everyone across cities. Drag-select a time slot to see the local time in every city.</p>
        </a>
        <a href="/world-time/event/" class="tz-tool-card">
          <span class="tz-tool-icon">📣</span>
          <h3>Event Time Announcer</h3>
          <p>Show local times for a global event. Get a shareable link like "When is 8pm in your time?" for your event.</p>
        </a>
        <a href="/time-zones/converter/" class="tz-tool-card">
          <span class="tz-tool-icon">🔄</span>
          <h3>Time Zone Converter</h3>
          <p>Calculate the exact time difference between any two cities. Same drag-select timeline as the Meeting Planner.</p>
        </a>
        <a href="/time-zones/" class="tz-tool-card">
          <span class="tz-tool-icon">🌐</span>
          <h3>Time Zones</h3>
          <p>Browse all 408 time zones, learn about UTC, DST, and how time zones work worldwide.</p>
        </a>
      </div>
    </div>
  </section>
</main>

${buildFooter(
  isState ? `${stateName}, ${countryName} — current times & DST` : `${countryName} — all cities & time zones`
)}

<script src="/src/site-shell.js" defer></script>
${autoInitScript(cca2, stateCode, stateSlug, stateName, countryName, countrySlug, states)}
<script src="/src/world-time-cities.js" defer></script>
</body>
</html>
`;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ============================================================================
// Build entry
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const onlyCountry = (args.find(a => a.startsWith('--country=')) || '').split('=')[1];
  const countriesArg = (args.find(a => a.startsWith('--countries=')) || '').split('=')[1];

  let countriesToBuild = Object.keys(CC2_SLUG);
  if (onlyCountry) {
    countriesToBuild = [onlyCountry.toUpperCase()];
  } else if (countriesArg) {
    countriesToBuild = countriesArg.split(',').map(s => s.trim().toUpperCase());
  }

  // For the city count, we need to query the API. As a quick estimate, we
  // use a hardcoded count for top countries and ~30 for the rest.
  // For US we use the 40,000+ population threshold (matches what's in the
  // city list): 1,246 cities across 51 states.
  // In production, this should query /api/v1/cities?country=XX&minPopulation=XX
  const KNOWN_COUNTS = {
    US: 1246, CN: 142, IN: 39, ID: 13, BR: 12, PK: 11, MX: 10, JP: 10, TR: 10,
    NG: 8, KR: 7, VN: 7, RU: 6, IQ: 6, IR: 6, DE: 7, GB: 5, FR: 4, IT: 4,
    CA: 4, AU: 6, NZ: 1
  };

  let totalCountries = 0;
  let totalStates = 0;
  for (const cca2 of countriesToBuild) {
    const countrySlug = CC2_SLUG[cca2];
    if (!countrySlug) continue;
    const cName = countryName(cca2);
    const states = STATE_BY_CC[cca2] || [];
    const cityCount = KNOWN_COUNTS[cca2] || '~30';

    // 1. Country page
    const countryDir = path.join(__dirname, '..', 'world-time', countrySlug);
    fs.mkdirSync(countryDir, { recursive: true });
    const countryHtml = buildPage({
      cca2, countryName: cName, countrySlug,
      stateCode: null, stateSlug: null, stateName: null,
      states: states,
      cityCount, stateCount: states.length
    });
    fs.writeFileSync(path.join(countryDir, 'index.html'), countryHtml);
    totalCountries++;

    // 2. State pages
    // URL pattern: /world-time/{country}/state/{state}/
    // Namespaced to avoid collisions with city slugs
    // (e.g. /washington/ would be both the US capital city AND the state of Washington)
    for (const s of states) {
      const stateDir = path.join(countryDir, 'state', s.slug);
      fs.mkdirSync(stateDir, { recursive: true });
      // Use the same minPopulation threshold as the country page so the
      // city count matches what users see in the grid.
      let sc = cca2 === 'US' ? (STATE_META[s.code] || {}).cityCount : null;
      if (sc == null) {
        // Fallback: small countries default to all-cities, no filter.
        // For now use the raw count from the states lookup if available.
        sc = s.cityCount || 10;
      }
      const stateHtml = buildPage({
        cca2, countryName: cName, countrySlug,
        stateCode: s.code, stateSlug: s.slug, stateName: s.name,
        cityCount: sc, stateCount: states.length
      });
      fs.writeFileSync(path.join(stateDir, 'index.html'), stateHtml);
      totalStates++;
    }

    if (onlyCountry) {
      console.log(`Built /world-time/${countrySlug}/ + ${states.length} state pages`);
    }
  }

  console.log(`Total: ${totalCountries} country pages, ${totalStates} state pages`);
}

if (require.main === module) main();
