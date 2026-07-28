#!/usr/bin/env node
/* Lite city page builder — no API calls per city, all data inline.
 * Builds ~16,000 US city pages using only the dataset (cities-us-build.json).
 * Each page is self-contained, ~25-30 KB.
 * Live data (time, weather, sun) computed client-side via JS.
 *
 * URL pattern: /world-time/{country-slug}/{city-slug}/
 * Output: world-time/{country-slug}/{city-slug}/index.html
 */
const fs = require('fs');
const path = require('path');
const { buildHeader, buildFooter } = require('./site-chrome.js');

// Slugify function (kept simple, matches existing conventions)
function slugify(name) {
  if (!name) return '';
  let s = String(name).toLowerCase();
  s = s.replace(/['']/g, '').replace(/\./g, '');
  s = s.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, '-');
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Population formatting
function formatPop(pop) {
  if (pop >= 1e9) return (pop / 1e9).toFixed(1) + 'B';
  if (pop >= 1e6) return (pop / 1e6).toFixed(1) + 'M';
  if (pop >= 1e3) return (pop / 1e3).toFixed(0) + 'K';
  return String(pop);
}

// Read the build list
const buildList = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'cities-us-build.json'),
  'utf8'
));
console.log(`Loaded ${buildList.length} US cities to build`);

// Pre-compute slug collisions: for cities with the same slug, the most-popular
// one keeps the bare slug, the rest get a state-code suffix.
// e.g. newport-ri, newport-ky, newport-or (newport, RI keeps "newport")

// Manual slug overrides: for well-known cities that the dataset miscategorizes
// (e.g. GeoNames calls "New York City" a separate city, but our URL convention
// uses /new-york/ as the canonical slug to match the legacy 911-city build).
const SLUG_OVERRIDES = {
  "new-york-city": "new-york",
};

for (const c of buildList) {
  if (SLUG_OVERRIDES[c.slug]) {
    c.slug = SLUG_OVERRIDES[c.slug];
  }
}

const slugOwner = {};  // slug -> city (the canonical one)
for (const c of buildList) {
  if (!slugOwner[c.slug] || c.population > slugOwner[c.slug].population) {
    slugOwner[c.slug] = c;
  }
}
for (const c of buildList) {
  if (slugOwner[c.slug].id !== c.id) {
    // Disambiguate: append state code
    c.canonicalSlug = c.slug;
    c.slug = c.slug + '-' + (c.stateCode || '').toLowerCase();
  } else {
    c.canonicalSlug = c.slug;
  }
}
const collisions = buildList.filter(c => c.canonicalSlug !== c.slug).length;
console.log(`Slug collisions resolved: ${collisions} cities got state-code suffix`);

// Pre-compute the big-cities pool (pop >= 50K) once — used for "More to explore"
const bigCitiesPool = buildList
  .filter(x => x.population >= 50000)
  .sort((a, b) => b.population - a.population);
const bigUSPool = buildList
  .filter(x => x.population >= 500000)
  .sort((a, b) => b.population - a.population);
console.log(`Big cities pool (>=50K): ${bigCitiesPool.length}, major cities (>=500K): ${bigUSPool.length}`);

// Build the "More to explore" list with disambiguated slugs
// (the bigUSPool may have slug collisions for major cities too)
const moreToExploreUS = bigUSPool.slice(0, 6).map(x => ({
  name: x.name,
  slug: x.slug,  // already disambiguated above
  pop: x.population,
  state: x.stateCode
}));

// Map IANA timezone → our 11 US timezone abbreviations
const IANA_TO_ABBR = {
  'America/New_York': 'EST',
  'America/Chicago': 'CST',
  'America/Denver': 'MST',
  'America/Phoenix': 'MST',
  'America/Los_Angeles': 'PST',
  'America/Anchorage': 'AKST',
  'America/Juneau': 'AKST',
  'America/Sitka': 'AKST',
  'America/Nome': 'AKST',
  'America/Yakutat': 'AKST',
  'America/Metlakatla': 'AKST',
  'America/Adak': 'HST',
  'Pacific/Honolulu': 'HST',
  'America/Indiana/Indianapolis': 'EST',
  'America/Indiana/Marengo': 'EST',
  'America/Indiana/Petersburg': 'EST',
  'America/Indiana/Vevay': 'EST',
  'America/Indiana/Vincennes': 'EST',
  'America/Indiana/Winamac': 'EST',
  'America/Indiana/Knox': 'CST',
  'America/Indiana/Tell_City': 'CST',
  'America/Kentucky/Louisville': 'EST',
  'America/Kentucky/Monticello': 'EST',
  'America/Detroit': 'EST',
  'America/Menominee': 'CST',
  'America/Boise': 'MST',
  'America/North_Dakota/Beulah': 'CST',
  'America/North_Dakota/Center': 'CST',
  'America/North_Dakota/New_Salem': 'CST',
};

function getTzAbbr(iana) {
  return IANA_TO_ABBR[iana] || 'UTC';
}

// Static timezone offset map (US zones)
const IANA_TO_OFFSET = {
  'America/New_York': '-5',
  'America/Chicago': '-6',
  'America/Denver': '-7',
  'America/Phoenix': '-7',
  'America/Los_Angeles': '-8',
  'America/Anchorage': '-9',
  'America/Adak': '-10',
  'Pacific/Honolulu': '-10',
  'America/Indiana/Indianapolis': '-5',
  'America/Indiana/Knox': '-6',
  'America/Kentucky/Louisville': '-5',
  'America/Detroit': '-5',
  'America/Menominee': '-6',
  'America/Boise': '-7',
};

function getTzOffset(iana) {
  return IANA_TO_OFFSET[iana] || '0';
}

// Climate estimate by lat (simplified)
function estimateClimate(lat) {
  const absLat = Math.abs(lat);
  const isNorth = lat >= 0;
  const isTropical = absLat < 23.5;
  const isPolar = absLat > 60;
  const peakHigh = isTropical ? 31 : isPolar ? 8 : 28 - 0.4 * Math.max(0, absLat - 20);
  const winterHigh = isTropical ? 30 : isPolar ? -20 : peakHigh - 12 - 0.3 * (absLat - 20);
  const peakDay = isNorth ? 196 : 15;
  return Array.from({ length: 12 }, (_, i) => {
    const monthStartDay = i * 30 + 15;
    const avgHighC = (peakHigh + winterHigh) / 2 + (peakHigh - winterHigh) / 2 * Math.cos((monthStartDay - peakDay) * Math.PI / 180);
    return {
      month: i + 1,
      avg_high_c: Math.round(avgHighC * 10) / 10,
      avg_low_c: Math.round((avgHighC - 10) * 10) / 10,
      avg_mean_c: Math.round((avgHighC - 5) * 10) / 10
    };
  });
}

// Build a single page
function buildPage(c) {
  const climate = estimateClimate(c.latitude);
  const climateStr = JSON.stringify(climate);

  // Capital-style today bar data (caller-side compute)
  // The today bar shows the local time + city; for the lite template we
  // pre-compute placeholder text that JS will replace with the live time.
  const tzEncoded = encodeURIComponent(c.timezone);
  const todayBarTimeId = 'todayBarTime';

  // Top 6 closest big cities (pop >= 50K) from the pre-computed pool
  const nearby = bigCitiesPool
    .filter(x => x.id !== c.id)
    .map(x => ({ ...x, distance: haversineKm(c.latitude, c.longitude, x.latitude, x.longitude) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);

  // State name + country name
  const stateName = c.stateName || c.stateCode;
  const stateLink = `/world-time/united-states/state/${c.stateSlug}/`;
  const countryLink = `/world-time/united-states/`;
  const flagUrl = 'https://flagcdn.com/w40/us.png';
  // Canonical URL: use the disambiguated slug
  const canonicalUrl = `https://dateandtime.live/world-time/united-states/${c.slug}/`;

  // Build a list of big US cities as "more to explore" cross-links (top 6 by pop)
  const moreToExplore = moreToExploreUS;

  // HTML template (lite version)
  const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Current time in ${c.name}, ${stateName} — dateandtime.live</title>
<meta name="description" content="Current local time in ${c.name}, ${stateName}, United States. Sunrise & sunset, 7-day weather forecast, DST status, and nearby cities. Population: ${formatPop(c.population)}." />
<link rel="canonical" href="${canonicalUrl}" />
<meta property="og:title" content="Time in ${c.name}, ${stateName} | dateandtime.live" />
<meta property="og:description" content="Current local time, weather, and time zone info for ${c.name} (${formatPop(c.population)})." />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonicalUrl}" />
<meta property="og:image" content="https://flagcdn.com/w160/us.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/src/site-shell.css?v=4" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Place","name":"${c.name}","address":{"@type":"PostalAddress","addressRegion":"${c.stateCode}","addressCountry":"US"},"geo":{"@type":"GeoCoordinates","latitude":${c.latitude},"longitude":${c.longitude}},"timeZone":"${c.timezone}","url":"${canonicalUrl}","population":{"@type":"QuantitativeValue","value":${c.population}}}</script>
</head>
<body class="shell-page">
  ${buildHeader('/world-time/united-states/')}

  <main class="container">
    <!-- Breadcrumb -->
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/world-time/">World time</a></li>
        <li><a href="${countryLink}">United States</a></li>
        <li><a href="${stateLink}">${stateName}</a></li>
        <li aria-current="page">${c.name}</li>
      </ol>
    </nav>

    <!-- Today bar (sticky under site header) -->
    <div class="today-bar">
      <div class="container today-bar-inner">
        <span class="today-bar-time" id="${todayBarTimeId}" data-tz="${c.timezone}">--:--</span>
        <span class="today-bar-city">in ${c.name}, ${stateName}</span>
        <a href="/world-time/meeting/?cities=${c.id}" class="today-bar-link">Schedule a meeting →</a>
      </div>
    </div>

    <!-- Hero: Live clock -->
    <section class="city-hero" data-tz="${c.timezone}" data-lat="${c.latitude}" data-lon="${c.longitude}">
      <div class="city-hero-flag">
        <img src="${flagUrl}" alt="US flag" width="40" height="30" loading="lazy" />
      </div>
      <h1>Current time in ${c.name}</h1>
      <div class="city-hero-loc">
        <span class="state">${stateName}</span> · <span class="country">United States</span>
      </div>
      <div class="city-hero-clock" id="cityClock" data-tz="${c.timezone}">
        <span class="time-hm">--:--</span>
        <span class="time-sec">--</span>
        <span class="time-ampm"></span>
        <span class="time-date" id="cityDate">--</span>
      </div>
      <div class="city-hero-meta">
        <span class="meta-item"><strong>IANA:</strong> ${c.timezone}</span>
        <span class="meta-item" id="utcOffset">UTC --</span>
        <span class="meta-item" id="dstStatus">—</span>
        <span class="meta-item" id="tzAbbr">—</span>
        <a class="meta-item meta-item--link" href="/time/zones/${getTzAbbr(c.timezone).toLowerCase()}/" id="tzPageLink" style="display: none;">About <span id="tzAbbrText">${getTzAbbr(c.timezone)}</span> →</a>
      </div>
    </section>

    <!-- Quick facts -->
    <section class="city-facts">
      <div class="fact">
        <div class="fact-label">Population</div>
        <div class="fact-value">${formatPop(c.population)}</div>
      </div>
      <div class="fact">
        <div class="fact-label">State</div>
        <div class="fact-value"><a href="${stateLink}">${stateName}</a></div>
      </div>
      <div class="fact">
        <div class="fact-label">Country</div>
        <div class="fact-value"><a href="${countryLink}">United States</a></div>
      </div>
      <div class="fact">
        <div class="fact-label">Coordinates</div>
        <div class="fact-value mono">${c.latitude.toFixed(3)}, ${c.longitude.toFixed(3)}</div>
      </div>
    </section>

    <!-- TABS NAV (sticky below today bar) -->
    <nav class="city-tabs" id="cityTabs" role="tablist" aria-label="City page sections">
      <a href="#time-general" class="city-tab active" data-tab="time-general" role="tab">
        <span class="city-tab-icon">⏰</span>
        <span class="city-tab-label">Time/General</span>
      </a>
      <a href="#weather" class="city-tab" data-tab="weather" role="tab">
        <span class="city-tab-icon">☀️</span>
        <span class="city-tab-label">Weather</span>
      </a>
      <a href="#time-zone" class="city-tab" data-tab="time-zone" role="tab">
        <span class="city-tab-icon">🌐</span>
        <span class="city-tab-label">Time Zone</span>
      </a>
      <a href="#dst" class="city-tab" data-tab="dst" role="tab">
        <span class="city-tab-icon">🔄</span>
        <span class="city-tab-label">DST</span>
      </a>
      <a href="#sun-moon" class="city-tab" data-tab="sun-moon" role="tab">
        <span class="city-tab-icon">🌙</span>
        <span class="city-tab-label">Sun & Moon</span>
      </a>
      <a href="#news" class="city-tab" data-tab="news" role="tab">
        <span class="city-tab-icon">📰</span>
        <span class="city-tab-label">News</span>
      </a>
      <a href="#tools" class="city-tab" data-tab="tools" role="tab">
        <span class="city-tab-icon">🛠</span>
        <span class="city-tab-label">Tools</span>
      </a>
    </nav>

    <!-- TAB PANES: 2-column layout (main + sidebar) -->
    <div class="city-tab-layout">
    <div class="city-tab-main">

    <!-- Time/General tab (default, always visible) -->
    <section class="city-section" id="pane-time-general" data-pane="time-general">
      <h2>📍 Time & Location</h2>
      <div class="city-fact-grid">
        <div class="city-fact-card">
          <div class="city-fact-label">Population</div>
          <div class="city-fact-value">${c.population.toLocaleString()}</div>
        </div>
        <div class="city-fact-card">
          <div class="city-fact-label">State</div>
          <div class="city-fact-value"><a href="/world-time/united-states/state/${c.stateSlug || ''}/">${c.stateName || ''}</a></div>
        </div>
        <div class="city-fact-card">
          <div class="city-fact-label">Country</div>
          <div class="city-fact-value"><a href="/world-time/${c.countrySlug || 'united-states'}/">United States</a></div>
        </div>
        <div class="city-fact-card">
          <div class="city-fact-label">Coordinates</div>
          <div class="city-fact-value mono">${c.latitude.toFixed(3)}, ${c.longitude.toFixed(3)}</div>
        </div>
      </div>
    </section>

    <!-- Sun times -->
    <section class="city-section" id="pane-sun-moon" data-pane="sun-moon" hidden>
      <h2>🌅 Sunrise & sunset in ${c.name}</h2>
      <div class="sun-grid">
        <div class="sun-card">
          <div class="sun-icon">🌅</div>
          <div class="sun-label">Sunrise</div>
          <div class="sun-time mono" id="sunriseTime">—</div>
        </div>
        <div class="sun-card">
          <div class="sun-icon">☀️</div>
          <div class="sun-label">Solar noon</div>
          <div class="sun-time mono" id="solarNoonTime">—</div>
        </div>
        <div class="sun-card">
          <div class="sun-icon">🌇</div>
          <div class="sun-label">Sunset</div>
          <div class="sun-time mono" id="sunsetTime">—</div>
        </div>
        <div class="sun-card">
          <div class="sun-icon">🌌</div>
          <div class="sun-label">Day length</div>
          <div class="sun-time mono" id="dayLength">—</div>
        </div>
      </div>
    </section>

    <!-- Weather tab -->
    <section class="city-section" id="pane-weather" data-pane="weather" hidden>
      <h2>🌤 7-day weather forecast — ${c.name}</h2>
      <div class="weather-grid" id="weatherGrid" data-lat="${c.latitude}" data-lon="${c.longitude}" data-tz="${c.timezone}">
        <p class="city-page-loading">Loading 7-day forecast…</p>
      </div>
      <p class="weather-source">Forecast data: <a href="https://open-meteo.com/" rel="noopener" target="_blank">Open-Meteo</a> (CC BY 4.0)</p>
    </section>

    <!-- Climate (lives inside time-zone pane — geographic context) -->
    <section class="city-section" id="pane-time-zone" data-pane="time-zone" hidden>
      <h2>🌐 Time Zone in ${c.name}</h2>
      <p>${c.name} is in the <strong>${getTzAbbr(c.timezone)}</strong> zone. IANA: <code>${c.timezone}</code>. <a href="/time/zones/${getTzAbbr(c.timezone).toLowerCase()}/" class="tz-page-link">About ${getTzAbbr(c.timezone)} →</a></p>

      <h2>🌡 ${c.name} climate year-round</h2>
      <div class="climate-chart" id="climateChart" data-climate='${climateStr}'></div>
      <p class="climate-note">Estimated from latitude (${c.latitude.toFixed(2)}°${c.latitude >= 0 ? 'N' : 'S'}). Actual values vary by elevation, ocean currents, and local geography.</p>
    </section>

    <!-- Cities near (new section using /cities/{id}/nearby API) -->
    <div id="pane-dst-nearby" data-pane="dst" hidden></div>

    <!-- More to explore — keeps existing static list, also exposed in Time/General tab -->
    <section class="city-section" data-pane="time-general">
      <h2>🏙 More to explore</h2>
      <div class="explore-grid">
${moreToExplore.map(x => `        <a href="/world-time/united-states/${x.slug}/" class="explore-link">
          <span class="label">${x.name}</span>
          <span class="meta">${x.state} · ${formatPop(x.pop)}</span>
        </a>`).join('\n')}
      </div>
    </section>

    <!-- Tools tab -->
    <section class="city-section" id="pane-tools" data-pane="tools" hidden>
      <h2>🛠 Tools for ${c.name}</h2>
      <div class="tools-grid">
        <a href="/world-time/meeting/" class="tool-link">
          <span class="tool-icon">📅</span>
          <span class="tool-title">Meeting planner</span>
          <span class="tool-desc">Find overlap with ${c.name}</span>
        </a>
        <a href="/time-zones/converter/" class="tool-link">
          <span class="tool-icon">🔄</span>
          <span class="tool-title">Time zone converter</span>
          <span class="tool-desc">Convert time to/from ${c.name}</span>
        </a>
        <a href="/holidays/?country=US" class="tool-link">
          <span class="tool-icon">🎉</span>
          <span class="tool-title">US holidays</span>
          <span class="tool-desc">Federal + state holidays</span>
        </a>
        <a href="/onthisday/" class="tool-link">
          <span class="tool-icon">📜</span>
          <span class="tool-title">On this day</span>
          <span class="tool-desc">Historical events</span>
        </a>
        <a href="/world-time/united-states/" class="tool-link">
          <span class="tool-icon">🇺🇸</span>
          <span class="tool-title">All US cities</span>
          <span class="tool-desc">15,994 cities in 52 states</span>
        </a>
        <a href="${stateLink}" class="tool-link">
          <span class="tool-icon">🏛</span>
          <span class="tool-title">All ${stateName} cities</span>
          <span class="tool-desc">Browse by state</span>
        </a>
      </div>
    </section>


    <!-- News tab (lazy-loaded via /api/v1/cities/{id}/news) -->
    <section class="city-section" id="pane-news" data-pane="news" hidden>
      <h2>📰 News about United States</h2>
      <div id="newsContent">
        <p class="city-page-loading">Loading news…</p>
      </div>
    </section>

    </div><!-- /city-tab-main -->

    <!-- Sidebar with 5 widgets (no ads) -->
    <aside class="city-sidebar">
      <div class="sidebar-widget sidebar-widget--primary">
        <h4>🌐 Current time zone</h4>
        <div class="sidebar-widget-value" id="sidebarTzAbbr">${getTzAbbr(c.timezone)}</div>
        <div class="sidebar-widget-meta" id="sidebarTzOffset">UTC ${getTzOffset(c.timezone)}</div>
        <a class="sidebar-widget-link" href="/time/zones/${getTzAbbr(c.timezone).toLowerCase()}/">About ${getTzAbbr(c.timezone)} →</a>
      </div>

      <div class="sidebar-widget">
        <h4>🔄 Next clock change</h4>
        <div class="sidebar-widget-value" id="sidebarNextChange">—</div>
        <div class="sidebar-widget-meta" id="sidebarNextChangeMeta">Loading…</div>
        <a class="sidebar-widget-link" href="#dst">View DST schedule →</a>
      </div>

      <div class="sidebar-widget">
        <h4>📍 Compare with…</h4>
        <div class="sidebar-chips">
          <a class="sidebar-chip" href="/world-time/united-states/new-york/" data-compare="5128581">🗽 NYC</a>
          <a class="sidebar-chip" href="/world-time/united-states/los-angeles/" data-compare="5368361">🌉 LA</a>
          <a class="sidebar-chip" href="/world-time/united-states/chicago/" data-compare="4887398">🏙 Chicago</a>
          <a class="sidebar-chip" href="/world-time/united-states/denver/" data-compare="5419384">🏔 Denver</a>
        </div>
      </div>

      <div class="sidebar-widget sidebar-widget--cta">
        <h4>📧 DST email alerts</h4>
        <p>Get an email 7 days before every clock change in your area.</p>
        <input type="email" id="dstEmailInput" placeholder="you@email.com" />
        <button id="dstEmailSubmit">Subscribe</button>
        <div class="sidebar-widget-meta" id="dstEmailResult"></div>
      </div>

      <div class="sidebar-widget">
        <h4>🏠 Set as home</h4>
        <p>Personalize the page to show time diff from ${c.name}.</p>
        <button id="setHomeBtn">Set ${c.name} as my home</button>
        <div class="sidebar-widget-meta" id="setHomeResult"></div>
      </div>
    </aside>

    </div><!-- /city-tab-layout -->
  </main>

  <!-- Continue your journey strip -->
  <section class="continue-strip">
    <div class="container continue-strip-inner">
      <h2>Continue your journey</h2>
      <div class="continue-strip-grid">
        <a class="continue-strip-card" href="/world-time/">
          <span class="continue-strip-icon">🕐</span>
          <div>
            <div class="continue-strip-title">World time</div>
            <div class="continue-strip-sub">Live clock for 15,994 US cities + 33,945 worldwide</div>
          </div>
        </a>
        <a class="continue-strip-card" href="/holidays/">
          <span class="continue-strip-icon">🎉</span>
          <div>
            <div class="continue-strip-title">US holidays</div>
            <div class="continue-strip-sub">Federal + state holidays, long weekends</div>
          </div>
        </a>
        <a class="continue-strip-card" href="/world-time/meeting/?cities=${c.id}">
          <span class="continue-strip-icon">📅</span>
          <div>
            <div class="continue-strip-title">Meeting planner</div>
            <div class="continue-strip-sub">Find overlap with ${c.name}</div>
          </div>
        </a>
      </div>
    </div>
  </section>

  ${buildFooter(`Current time in ${c.name}, ${stateName}, United States (${c.timezone})`)}

  <script src="/src/site-shell.js" defer></script>
  <script>window.IANA_TO_ABBR = ${JSON.stringify(IANA_TO_ABBR)};</script>
  <script>
  // Live clock for the city — uses Intl.DateTimeFormat with the city's IANA tz
  (function() {
    // Today bar time
    var tbTime = document.getElementById('${todayBarTimeId}');
    if (tbTime) {
      function updateTodayBar() {
        try {
          var tz = tbTime.getAttribute('data-tz');
          var fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
          tbTime.textContent = fmt.format(new Date());
        } catch (e) {}
      }
      updateTodayBar();
      setInterval(updateTodayBar, 1000);
    }

    var hero = document.querySelector('.city-hero');
    var clock = document.getElementById('cityClock');
    var dateEl = document.getElementById('cityDate');
    var offsetEl = document.getElementById('utcOffset');
    var dstEl = document.getElementById('dstStatus');
    var abbrEl = document.getElementById('tzAbbr');
    var tzLinkEl = document.getElementById('tzPageLink');
    if (!hero || !clock) return;
    var tz = hero.getAttribute('data-tz');
    var lat = parseFloat(hero.getAttribute('data-lat'));
    var lon = parseFloat(hero.getAttribute('data-lon'));

    // Static abbreviation from IANA → US TZ abbr (e.g. EST, EDT, CST...)
    var staticAbbr = (window.IANA_TO_ABBR && window.IANA_TO_ABBR[tz]) || null;

    function update() {
      try {
        var now = new Date();
        var fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
        var parts = fmt.formatToParts(now);
        var h = '', m = '', s = '', ampm = '';
        for (var p of parts) {
          if (p.type === 'hour') h = p.value;
          else if (p.type === 'minute') m = p.value;
          else if (p.type === 'second') s = p.value;
          else if (p.type === 'dayPeriod') ampm = p.value;
        }
        clock.querySelector('.time-hm').textContent = h + ':' + m;
        clock.querySelector('.time-sec').textContent = s;
        clock.querySelector('.time-ampm').textContent = ampm;

        var dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        dateEl.textContent = dateFmt.format(now);

        // UTC offset
        var offFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
        var offParts = offFmt.formatToParts(now);
        for (var op of offParts) {
          if (op.type === 'timeZoneName') {
            offsetEl.textContent = 'UTC ' + op.value.replace('GMT', '');
          }
        }

        // DST check: compare Jan 1 vs Jul 1
        var janOff = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date(now.getFullYear(), 0, 1));
        var julOff = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date(now.getFullYear(), 6, 1));
        var jOff = janOff.find(function(p) { return p.type === 'timeZoneName'; }).value;
        var lOff = julOff.find(function(p) { return p.type === 'timeZoneName'; }).value;
        var dstObserved = jOff !== lOff;
        if (dstObserved) {
          dstEl.textContent = 'DST observed';
        } else {
          dstEl.textContent = 'No DST';
        }

        // Try to get the live abbreviation (e.g. "EDT" for America/New_York in summer)
        var abbrFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' });
        var abbrParts = abbrFmt.formatToParts(now);
        var liveAbbr = '';
        for (var ap of abbrParts) {
          if (ap.type === 'timeZoneName') liveAbbr = ap.value;
        }
        if (abbrEl) {
          abbrEl.textContent = liveAbbr || staticAbbr || '';
        }
        // Show "About {abbr} →" link
        if (tzLinkEl && liveAbbr && IANA_TO_ABBR && IANA_TO_ABBR[tz]) {
          var currentAbbr = IANA_TO_ABBR[tz];
          // If DST is in effect and we have a daylight version, prefer that
          if (dstObserved && (currentAbbr === 'EST' || currentAbbr === 'CST' || currentAbbr === 'MST' || currentAbbr === 'PST' || currentAbbr === 'AKST')) {
            currentAbbr = currentAbbr.replace('ST', 'DT');
          }
          tzLinkEl.href = '/time/zones/' + currentAbbr.toLowerCase() + '/';
          tzLinkEl.style.display = '';
          var abbrTextEl = document.getElementById('tzAbbrText');
          if (abbrTextEl) abbrTextEl.textContent = currentAbbr;
        }

        // Update sidebar TZ widget with live abbr + offset
        var sidebarAbbr = document.getElementById('sidebarTzAbbr');
        var sidebarOffset = document.getElementById('sidebarTzOffset');
        if (sidebarAbbr) sidebarAbbr.textContent = liveAbbr || sidebarAbbr.textContent;
        if (sidebarOffset) {
          // Compute current UTC offset from Intl
          var liveOffsetFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
          var liveOffsetParts = liveOffsetFmt.formatToParts(now);
          for (var lop of liveOffsetParts) {
            if (lop.type === 'timeZoneName') {
              sidebarOffset.textContent = 'UTC ' + lop.value.replace('GMT', '');
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
    update();
    setInterval(update, 1000);

    // Sunrise / sunset (NOAA solar calculator, simplified)
    function calcSun(lat, lon, when) {
      var rad = Math.PI / 180;
      var dayOfYear = Math.floor((when - new Date(when.getFullYear(), 0, 0)) / 86400000);
      var decl = 23.45 * Math.sin(rad * (360 / 365) * (dayOfYear - 81));
      var latRad = lat * rad;
      var declRad = decl * rad;
      var cosH = -Math.tan(latRad) * Math.tan(declRad);
      if (cosH > 1) return null; // polar night
      if (cosH < -1) return null; // midnight sun
      var H = Math.acos(cosH) / rad;
      // Solar noon (UTC, in hours)
      var noonUTC = 12 - lon / 15;
      var sunriseUTC = noonUTC - H / 15;
      var sunsetUTC = noonUTC + H / 15;

      // Convert to local time in tz
      function utcToLocal(utcHours) {
        var d = new Date(when);
        d.setUTCHours(Math.floor(utcHours));
        d.setUTCMinutes(Math.floor((utcHours - Math.floor(utcHours)) * 60));
        d.setUTCSeconds(0);
        return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
      }
      return {
        sunrise: utcToLocal(sunriseUTC),
        solarNoon: utcToLocal(noonUTC),
        sunset: utcToLocal(sunsetUTC),
        dayLength: (H * 2 / 15)  // in hours
      };
    }
    var sun = calcSun(lat, lon, new Date());
    if (sun) {
      document.getElementById('sunriseTime').textContent = sun.sunrise;
      document.getElementById('solarNoonTime').textContent = sun.solarNoon;
      document.getElementById('sunsetTime').textContent = sun.sunset;
      var hrs = Math.floor(sun.dayLength);
      var mins = Math.round((sun.dayLength - hrs) * 60);
      document.getElementById('dayLength').textContent = hrs + 'h ' + mins + 'm';
    }

    // 7-day weather (Open-Meteo)
    var wGrid = document.getElementById('weatherGrid');
    if (wGrid) {
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max' +
        '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=' + encodeURIComponent(tz) + '&forecast_days=7';
      fetch(url).then(function(r) { return r.json(); }).then(function(d) {
        if (!d.daily) return;
        var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var WMO = { 0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️', 45: '🌫', 48: '🌫', 51: '🌦', 53: '🌦', 55: '🌧', 61: '🌦', 63: '🌧', 65: '🌧', 71: '🌨', 73: '❄️', 75: '❄️', 77: '🌨', 80: '🌦', 81: '🌧', 82: '⛈', 85: '🌨', 86: '❄️', 95: '⛈', 96: '⛈', 99: '⛈' };
        var html = '';
        for (var i = 0; i < d.daily.time.length; i++) {
          var dt = new Date(d.daily.time[i] + 'T12:00:00');
          var code = d.daily.weather_code[i];
          var hi = Math.round(d.daily.temperature_2m_max[i]);
          var lo = Math.round(d.daily.temperature_2m_min[i]);
          var dayName = i === 0 ? 'Today' : days[dt.getDay()];
          html += '<div class="weather-day">';
          html += '<div class="day">' + dayName + '</div>';
          html += '<div class="icon">' + (WMO[code] || '🌤') + '</div>';
          html += '<div class="hi">' + hi + '°</div>';
          html += '<div class="lo">' + lo + '°</div>';
          html += '</div>';
        }
        wGrid.innerHTML = html;
        wGrid.classList.add('weather-loaded');
      }).catch(function() {
        wGrid.innerHTML = '<p>Weather data unavailable.</p>';
      });
    }

    // Climate chart (simple bar chart from lat-based estimate)
    var cc = document.getElementById('climateChart');
    if (cc) {
      var climate = JSON.parse(cc.getAttribute('data-climate'));
      var maxT = Math.max.apply(null, climate.map(function(m) { return m.avg_high_c; }));
      var minT = Math.min.apply(null, climate.map(function(m) { return m.avg_low_c; }));
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var ch = '<div class="climate-bars">';
      for (var i = 0; i < climate.length; i++) {
        var hi = ((climate[i].avg_high_c - minT) / (maxT - minT)) * 100;
        var lo = ((climate[i].avg_low_c - minT) / (maxT - minT)) * 100;
        ch += '<div class="climate-bar">';
        ch += '<div class="bar-track"><div class="bar-fill bar-hi" style="height:' + hi + '%" title="' + climate[i].avg_high_c + '°C"></div>';
        ch += '<div class="bar-fill bar-lo" style="height:' + lo + '%" title="' + climate[i].avg_low_c + '°C"></div></div>';
        ch += '<div class="bar-label">' + months[i] + '</div>';
        ch += '<div class="bar-temp">' + Math.round(climate[i].avg_high_c) + '°</div>';
        ch += '</div>';
      }
      ch += '</div>';
      cc.innerHTML = ch;
    }
  })();
  </script>

  <script>
  // City page v2: Tabs + URL hash + lazy load
  (function() {
    var cityId = ${c.id};
    var iana = ${JSON.stringify(c.timezone)};
    var tabs = document.querySelectorAll('.city-tab');
    var panes = document.querySelectorAll('[data-pane]');
    var loadedPanes = {};

    function showTab(tabId) {
      // Update active state
      tabs.forEach(function(t) {
        t.classList.toggle('active', t.dataset.tab === tabId);
      });
      panes.forEach(function(p) {
        if (p.dataset.pane === tabId) {
          p.removeAttribute('hidden');
        } else {
          p.setAttribute('hidden', '');
        }
      });
      // Lazy-load tab content if not yet loaded
      if (!loadedPanes[tabId]) {
        loadedPanes[tabId] = true;
        if (tabId === 'news') loadNews();
        if (tabId === 'dst') loadDst();
      }
      // Update URL hash without scroll
      if (history.replaceState) {
        history.replaceState(null, '', '#' + tabId);
      }
      // Smooth scroll to tabs nav (account for sticky nav height)
      var nav = document.getElementById('cityTabs');
      if (nav) {
        var rect = nav.getBoundingClientRect();
        if (rect.top < 60 || rect.top > 200) {
          // Scroll so tabs nav is just below the today bar
          var navTop = rect.top + window.scrollY - 50;
          window.scrollTo({ top: navTop, behavior: 'smooth' });
        }
      }
    }

    tabs.forEach(function(tab) {
      tab.addEventListener('click', function(e) {
        e.preventDefault();
        showTab(tab.dataset.tab);
      });
    });

    // On page load, restore tab from URL hash
    function initFromHash() {
      var hash = (location.hash || '').replace('#', '');
      var validIds = Array.from(tabs).map(function(t) { return t.dataset.tab; });
      if (hash && validIds.indexOf(hash) !== -1) {
        showTab(hash);
      } else {
        // Default: time-general is already visible (the only non-hidden pane)
        loadedPanes['time-general'] = true;
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initFromHash);
    } else {
      initFromHash();
    }

    // Lazy load: news
    function loadNews() {
      var target = document.getElementById('newsContent');
      if (!target) return;
      fetch('https://datetime-api-dev.nsura2029.workers.dev/api/v1/cities/' + cityId + '/news?limit=3')
        .then(function(r) { return r.json(); })
        .then(function(json) {
          if (!json.success) return;
          var articles = json.data.articles || [];
          if (articles.length === 0) {
            target.innerHTML = '<p style="color: var(--color-muted, #8a869c);">No news articles available yet.</p>';
            return;
          }
          var html = '<div class="news-grid">';
          articles.forEach(function(a) {
            html += '<a class="news-card" href="' + a.url + '">';
            html += '<div class="news-card-cat">' + a.category + '</div>';
            html += '<div class="news-card-title">' + a.title + '</div>';
            html += '<div class="news-card-excerpt">' + a.excerpt + '</div>';
            html += '</a>';
          });
          html += '</div>';
          target.innerHTML = html;
        })
        .catch(function() {
          target.innerHTML = '<p style="color: var(--color-muted, #8a869c);">News unavailable.</p>';
        });
    }

    // Lazy load: DST (year strip + history)
    function loadDst() {
      // DST year strip
      fetch('https://datetime-api-dev.nsura2029.workers.dev/api/v1/dst/upcoming?tz=' + encodeURIComponent(iana))
        .then(function(r) { return r.json(); })
        .then(function(json) {
          if (!json.success || !json.data.history) return;
          var history = json.data.history;
          var all = history.all || [];
          var past = history.past || [];
          var future = history.future || [];

          // Build year strip (12 cells, Jan-Dec)
          var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          var curMonth = new Date().getUTCMonth();
          var baseAbbr = (window.IANA_TO_ABBR && window.IANA_TO_ABBR[iana]) || 'STD';
          var isDstObserved = all.length > 0;
          var sorted = all.slice().sort(function(a,b) { return a.date.localeCompare(b.date); });
          var stripHtml = '<div class="dst-year-strip">';
          months.forEach(function(m, i) {
            var monthDate = new Date().getUTCFullYear() + '-' + String(i+1).padStart(2,'0') + '-15';
            var cellAbbr = baseAbbr;
            var isDaylight = false;
            sorted.forEach(function(t) {
              if (t.date <= monthDate) {
                if (t.direction === 'forward') { cellAbbr = baseAbbr.replace('ST','DT'); isDaylight = true; }
                else { cellAbbr = baseAbbr.replace('DT','ST'); isDaylight = false; }
              }
            });
            if (!isDstObserved) cellAbbr = baseAbbr;
            var cls = (isDstObserved && isDaylight) ? 'daylight' : 'standard';
            stripHtml += '<div class="dst-year-cell ' + cls + (i === curMonth ? ' current' : '') + '">';
            stripHtml += '<span class="m">' + m + '</span>';
            stripHtml += '<span class="a">' + cellAbbr + '</span>';
            stripHtml += '</div>';
          });
          stripHtml += '</div>';

          // Build history table
          var tableHtml = '<div class="dst-history"><h3>Recent & upcoming changes</h3><table>';
          tableHtml += '<thead><tr><th>Date</th><th>Change</th><th>Direction</th></tr></thead><tbody>';
          past.slice(0, 3).forEach(function(t) {
            tableHtml += '<tr><td>' + t.date + '</td><td>' + (t.type === 'spring_forward' ? 'STD → DT' : 'DT → STD') + '</td><td>' + (t.direction === 'forward' ? '+1h' : '−1h') + '</td></tr>';
          });
          future.slice(0, 5).forEach(function(t, i) {
            tableHtml += '<tr class="' + (i === 0 ? 'next' : '') + '"><td>' + t.date + (i === 0 ? ' (next)' : '') + '</td><td>' + (t.type === 'spring_forward' ? 'STD → DT' : 'DT → STD') + '</td><td>' + (t.direction === 'forward' ? '+1h' : '−1h') + '</td></tr>';
          });
          tableHtml += '</tbody></table></div>';

          // Find the DST pane and inject
          var pane = document.getElementById('pane-dst-nearby');
          if (pane) {
            pane.removeAttribute('hidden');
            pane.innerHTML = '<h2>🔄 DST in United States</h2>' + stripHtml + tableHtml +
              '<p style="margin-top: 1rem;"><a href="/news/2026/07/daylight-saving-time-history/" class="news-link">Read the full history of DST →</a></p>';
          }

          // Update sidebar
          var nextEl = document.getElementById('sidebarNextChange');
          var nextMetaEl = document.getElementById('sidebarNextChangeMeta');
          if (nextEl && future[0]) {
            var n = future[0];
            nextEl.textContent = n.date;
            nextMetaEl.textContent = (n.direction === 'forward' ? '+1h forward' : '−1h back') + ' at 2:00 am';
          } else if (nextEl) {
            nextEl.textContent = 'No upcoming';
            nextMetaEl.textContent = 'No DST in this zone';
          }
        });
    }

    // Sidebar: Set as home
    var setHomeBtn = document.getElementById('setHomeBtn');
    if (setHomeBtn) {
      setHomeBtn.addEventListener('click', function() {
        try {
          localStorage.setItem('homeCity', JSON.stringify({ id: cityId, name: ${JSON.stringify(c.name)} }));
          document.getElementById('setHomeResult').textContent = '✓ Set! Time diff will show on all city pages.';
        } catch (e) {
          document.getElementById('setHomeResult').textContent = 'Browser blocked. Try a different browser.';
        }
      });
    }

    // Sidebar: Email signup (DST alerts) — stub for now, logs to console
    var emailBtn = document.getElementById('dstEmailSubmit');
    if (emailBtn) {
      emailBtn.addEventListener('click', function() {
        var input = document.getElementById('dstEmailInput');
        var email = (input.value || '').trim();
        if (!email || !email.includes('@')) {
          document.getElementById('dstEmailResult').textContent = 'Please enter a valid email.';
          return;
        }
        // TODO: POST to /api/v1/feedback (once email infra is set up)
        // For now, store in localStorage as "would have subscribed"
        try {
          var subs = JSON.parse(localStorage.getItem('dstEmailSubscriptions') || '[]');
          subs.push({ email: email, cityId: cityId, timestamp: Date.now() });
          localStorage.setItem('dstEmailSubscriptions', JSON.stringify(subs));
        } catch (e) {}
        document.getElementById('dstEmailResult').textContent = "✓ Saved! We'll email you 7 days before the next clock change.";
        input.value = '';
      });
    }
  })();
  </script>
`;

  return html;
}

// Main: build all cities
(async () => {
  const CONCURRENCY = parseInt(process.env.CONCURRENCY || '10', 10);
  console.log(`Concurrency: ${CONCURRENCY}`);

  // Output base
  const BASE = path.join(process.cwd(), 'world-time', 'united-states');
  fs.mkdirSync(BASE, { recursive: true });

  let ok = 0;
  let failed = 0;
  let totalBytes = 0;
  const startTime = Date.now();

  // Group by state for per-state folder structure (optional)
  // For now, write all to /world-time/united-states/{city-slug}/index.html
  // (matches existing pattern)
  for (let i = 0; i < buildList.length; i += CONCURRENCY) {
    const batch = buildList.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(c => {
      try {
        const html = buildPage(c);
        const outDir = path.join(BASE, c.slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), html);
        ok++;
        totalBytes += html.length;
        return true;
      } catch (e) {
        failed++;
        console.error(`Failed ${c.slug}: ${e.message}`);
        return false;
      }
    }));
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r  Progress: ${ok + failed}/${buildList.length} (ok=${ok}, failed=${failed}, ${elapsed}s, ${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n${ok}/${buildList.length} city pages built in ${totalTime}s.`);
  console.log(`Total HTML output: ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);
  console.log(`Average per page: ${(totalBytes / ok / 1024).toFixed(1)}KB`);
})();
