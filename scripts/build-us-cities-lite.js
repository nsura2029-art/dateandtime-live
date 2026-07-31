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

// Format latitude/longitude as degrees/minutes/seconds (DMS) for display
// e.g. 27.94752 → "27°56'51"N
function formatDMS(coord, type) {
  if (coord == null) return '—';
  const abs = Math.abs(coord);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.floor((mFloat - m) * 60);
  const suffix = type === 'lat' ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"${suffix}`;
}

// State landmark image labels — per the user's spec, the carousel shows 5
// state-specific landmark images. Labels are short, descriptive, paired with
// a pin icon overlay (matches the example in pic3).
const STATE_LANDMARKS = {
  'alabama':      ['Alabama State Capitol', 'Gulf Shores Beaches', 'Vulcan Statue, Birmingham', 'Lookout Mountain', 'Birmingham Skyline'],
  'alaska':       ['Alaska State Capitol', 'Denali National Park', 'Anchorage Skyline', 'Glacier Bay', 'Northern Lights'],
  'arizona':      ['Arizona State Capitol', 'Grand Canyon', 'Phoenix Skyline', 'Monument Valley', 'Sedona Red Rocks'],
  'arkansas':     ['Arkansas State Capitol', 'Hot Springs', 'Little Rock Skyline', 'Crater of Diamonds', 'Ozark Mountains'],
  'california':   ['California State Capitol', 'Big Sur Coast', 'Los Angeles Skyline', 'Golden Gate Bridge', 'Yosemite Valley'],
  'colorado':     ['Colorado State Capitol', 'Rocky Mountain NP', 'Denver Skyline', 'Great Sand Dunes', 'Maroon Bells'],
  'connecticut':  ['Connecticut State Capitol', 'Mystic Seaport', 'Hartford Skyline', 'Yale University', 'Litchfield Hills'],
  'delaware':     ['Delaware State Capitol', 'Cape Henlopen', 'Wilmington Skyline', 'Rehoboth Beach', 'Brandywine Valley'],
  'florida':      ['Florida State Capitol', 'Everglades', 'Jacksonville Skyline', 'Key West Sunset', 'Sanibel Island'],
  'georgia':      ['Georgia State Capitol', 'Savannah Squares', 'Atlanta Skyline', 'Stone Mountain', 'Okefenokee Swamp'],
  'hawaii':       ['Hawaii State Capitol', 'Na Pali Coast', 'Honolulu Skyline', 'Waikiki Beach', 'Haleakala Volcano'],
  'idaho':        ['Idaho State Capitol', 'Sawtooth Mountains', 'Boise Skyline', 'Craters of the Moon', 'Shoshone Falls'],
  'illinois':     ['Illinois State Capitol', 'Starved Rock', 'Chicago Skyline', 'Lincoln Memorial', 'Chicago Riverwalk'],
  'indiana':      ['Indiana State Capitol', 'Indiana Dunes', 'Indianapolis Motor Speedway', 'Indianapolis Skyline', 'Brown County'],
  'iowa':         ['Iowa State Capitol', 'Field of Dreams', 'Des Moines Skyline', 'Amana Colonies', 'Iowa Farmland'],
  'kansas':       ['Kansas State Capitol', 'Flint Hills', 'Wichita Skyline', 'Tallgrass Prairie', 'Monument Rocks'],
  'kentucky':     ['Kentucky State Capitol', 'Mammoth Cave', 'Churchill Downs', 'Louisville Skyline', 'Red River Gorge'],
  'louisiana':    ['Louisiana State Capitol', 'French Quarter', 'New Orleans Skyline', 'Atchafalaya Swamp', 'Bourbon Street'],
  'maine':        ['Maine State Capitol', 'Acadia NP', 'Portland Harbor', 'Portland Head Light', 'Bar Harbor'],
  'maryland':     ['Maryland State House', 'Assateague Island', 'Baltimore Inner Harbor', 'US Naval Academy', 'Chesapeake Bay'],
  'massachusetts':['Massachusetts State House', 'Cape Cod', 'Boston Skyline', 'Fenway Park', 'Freedom Trail'],
  'michigan':     ['Michigan State Capitol', 'Mackinac Island', 'Detroit Skyline', 'Sleeping Bear Dunes', 'Pictured Rocks'],
  'minnesota':    ['Minnesota State Capitol', 'Boundary Waters', 'Minneapolis Skyline', 'Mall of America', 'Split Rock Light'],
  'mississippi':  ['Mississippi State Capitol', 'Natchez Trace', 'Jackson Skyline', 'Vicksburg', 'Gulf Coast'],
  'missouri':     ['Missouri State Capitol', 'Gateway Arch', 'Kansas City Skyline', 'Ozark Rivers', 'Silver Dollar City'],
  'montana':      ['Montana State Capitol', 'Glacier NP', 'Billings Skyline', 'Flathead Lake', 'Big Sky Resort'],
  'nebraska':     ['Nebraska State Capitol', 'Sandhills', 'Omaha Skyline', 'Henry Doorly Zoo', 'Chimney Rock'],
  'nevada':       ['Nevada State Capitol', 'Valley of Fire', 'Las Vegas Strip', 'Lake Tahoe', 'Red Rock Canyon'],
  'new-hampshire':['New Hampshire State House', 'Mount Washington', 'Manchester Skyline', 'Kancamagus Hwy', 'NH Autumn'],
  'new-jersey':   ['New Jersey State House', 'Delaware Water Gap', 'Newark Skyline', 'Atlantic City', 'Cape May'],
  'new-mexico':   ['New Mexico Roundhouse', 'White Sands', 'Albuquerque Skyline', 'Carlsbad Caverns', 'Taos Pueblo'],
  'new-york':     ['New York State Capitol', 'Niagara Falls', 'Manhattan Skyline', 'Statue of Liberty', 'Adirondacks'],
  'north-carolina':['NC State Capitol', 'Cape Hatteras', 'Charlotte Skyline', 'Biltmore Estate', 'Smoky Mountains'],
  'north-dakota': ['North Dakota State Capitol', 'Theodore Roosevelt NP', 'Fargo Skyline', 'Painted Canyon', 'Maah Daah Hey'],
  'ohio':         ['Ohio Statehouse', 'Cedar Point', 'Columbus Skyline', 'Cincinnati Skyline', 'Hocking Hills'],
  'oklahoma':     ['Oklahoma State Capitol', 'Wichita Mountains', 'OKC Skyline', 'National Cowboy Museum', 'Tulsa Skyline'],
  'oregon':       ['Oregon State Capitol', 'Crater Lake', 'Portland Skyline', 'Multnomah Falls', 'Mount Hood'],
  'pennsylvania': ['Pennsylvania State Capitol', 'PA Grand Canyon', 'Philadelphia Skyline', 'Independence Hall', 'Gettysburg'],
  'rhode-island': ['Rhode Island State House', 'Block Island', 'Providence Skyline', 'Cliff Walk', 'The Breakers'],
  'south-carolina':['SC State House', 'Hilton Head', 'Charleston Skyline', 'Rainbow Row', 'Magnolia Plantation'],
  'south-dakota': ['South Dakota State Capitol', 'Mount Rushmore', 'Sioux Falls Skyline', 'Crazy Horse', 'Badlands NP'],
  'tennessee':    ['Tennessee State Capitol', 'Great Smoky Mountains', 'Nashville Skyline', 'Graceland', 'Dollywood'],
  'texas':        ['Texas State Capitol', 'Big Bend', 'Houston Skyline', 'San Antonio River Walk', 'Hill Country'],
  'utah':         ['Utah State Capitol', 'Zion NP', 'Salt Lake City Skyline', 'Arches NP', 'Bryce Canyon'],
  'vermont':      ['Vermont State House', 'Stowe Mountain', 'Burlington Waterfront', 'Route 100', 'Shelburne Farms'],
  'virginia':     ['Virginia State Capitol', 'Shenandoah NP', 'Virginia Beach', 'Colonial Williamsburg', 'Blue Ridge Pkwy'],
  'washington':   ['Washington State Capitol', 'Mount Rainier', 'Seattle Skyline', 'Space Needle', 'San Juan Islands'],
  'west-virginia':['WV State Capitol', 'New River Gorge', 'Charleston Skyline', 'Harpers Ferry', 'Blackwater Falls'],
  'wisconsin':    ['Wisconsin State Capitol', 'Door County', 'Milwaukee Skyline', 'Taliesin', 'Apostle Islands'],
  'wyoming':      ['Wyoming State Capitol', 'Yellowstone', 'Cheyenne Skyline', 'Grand Teton', 'Devils Tower'],
};

// Pre-load state image list to avoid per-city file existence checks
function getStateCarousel(stateSlug) {
  const labels = STATE_LANDMARKS[stateSlug];
  if (!labels) return null;
  const images = [];
  for (let i = 1; i <= 5; i++) {
    images.push({
      url: `/world-time/state-images/${stateSlug}-${i}.jpg`,
      label: labels[i - 1],
    });
  }
  return images;
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
// Mark each city with its index in the source list (used to detect
// duplicates that share the same id but have different stateCode/lat/lon).
for (let i = 0; i < buildList.length; i++) {
  buildList[i].sourceIndex = i;
}
for (const c of buildList) {
  // Disambiguate by sourceIndex: if this isn't the most-popular Phoenix/etc.,
  // the slugOwner.id will equal c.id (because the build data is deduped by id),
  // so we need a stable identity. sourceIndex is always unique.
  if (slugOwner[c.slug].sourceIndex !== c.sourceIndex) {
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

// US time zones that DO observe DST (most of the US, except AZ + HI)
const US_NO_DST = new Set([
  'America/Phoenix',     // Arizona (except Navajo Nation)
  'America/Adak',        // ... actually Adak does observe DST, skip
  'Pacific/Honolulu',    // Hawaii
  'America/Sitka',       // ... skip
]);
function hasDST(iana) {
  // US-only check. Phoenix (Arizona) and Honolulu (Hawaii) don't observe DST.
  if (US_NO_DST.has(iana)) return false;
  // All other US zones (Eastern, Central, Mountain non-AZ, Pacific, Alaska)
  // observe DST.
  return true;
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

  // Today bar removed 2026-07-28 — no need to pre-compute today bar data.
  const tzEncoded = encodeURIComponent(c.timezone);

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

  // Build the state-landmark carousel HTML for this city's state.
  // For MVP, we just use the 5 images in order (1-5). When the JS loads
  // it will shuffle them for randomness within a session (so the order
  // varies between page loads).
  const carouselItems = getStateCarousel(c.stateSlug) || [];
  const carouselHtml = carouselItems.map((it, idx) =>
    `<img class="city-carousel-img${idx === 0 ? ' active' : ''}" src="${it.url}" alt="${it.label}" data-label="${it.label}" data-idx="${idx}" loading="${idx === 0 ? 'eager' : 'lazy'}" />`
  ).join('\n          ');
  const carouselLabels = carouselItems.map(it => it.label);

  // HTML template (lite version)
  const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<!-- Theme bootstrap: read saved preference from localStorage and apply BEFORE
     CSS paints, so users with a saved "light" preference don't see a dark
     flash. Defaults to "dark" if no preference is saved. -->
<script>
(function(){
  try {
    var t = localStorage.getItem("tdl-theme") || localStorage.getItem("tdp-theme");
    if (!t) t = (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
  } catch(e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
</script>
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
<link rel="stylesheet" href="/src/site-shell.css?v=15" />
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

    <!-- Today bar removed 2026-07-28 — was overlapping site header; user wants
         only the breadcrumb as persistent nav. Schedule a meeting is now in
         the hero CTA / city page Tools tab. -->

    <!-- Hero: Live clock -->
    <!-- 2-column hero: clock + data table (left) | state landmark carousel (right) -->
    <section class="city-hero" data-tz="${c.timezone}" data-lat="${c.latitude}" data-lon="${c.longitude}">
      <div class="city-hero-grid">
        <!-- LEFT: live clock + digital time + data table -->
        <div class="city-clock-block">
          <!-- H1 + location on one row, centered (per user feedback 2026-07-28) -->
          <div class="city-hero-title-row">
            <h1>Current time in ${c.name}</h1>
            <div class="city-hero-loc">
              <span class="state">${stateName}</span> · <span class="country">United States</span>
            </div>
          </div>
          <div class="city-clock-row">
            <!-- Analog clock with hardcoded colors so it's visible in both light and dark mode -->
            <svg class="city-clock-face" viewBox="0 0 200 200" id="cityClockFace" data-tz="${c.timezone}" aria-label="Analog clock">
              <circle cx="100" cy="100" r="95" fill="#f4f2fb" stroke="#cdc8e0" stroke-width="2" />
              <g id="clockTicks"></g>
              <line id="clockHour" x1="100" y1="100" x2="100" y2="55" stroke="#1f1a3a" stroke-width="4" stroke-linecap="round" />
              <line id="clockMinute" x1="100" y1="100" x2="100" y2="35" stroke="#1f1a3a" stroke-width="3" stroke-linecap="round" />
              <line id="clockSecond" x1="100" y1="100" x2="100" y2="25" stroke="#5b4aaf" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="100" cy="100" r="4" fill="#1f1a3a" />
            </svg>
            <div class="city-time-block">
              <!-- Time format: HH.MM.SS.MS — 2-digit hours/min/sec/ms, dots as separators, 24-hour -->
              <div class="city-time-digits" id="cityClock" data-tz="${c.timezone}">
                <span class="time-hm">--.--.--</span>
                <span class="time-sec">.--</span>
                <span class="time-ampm"></span>
              </div>
              <div class="time-date" id="cityDate">--</div>
              <!-- Fullscreen link removed per user feedback 2026-07-28 -->
            </div>
          </div>
          <!-- Data table — Country/State/Coordinates/Elevation/Currency/Languages/Code -->
          <table class="city-data-table" aria-label="City facts">
            <tbody>
              <tr><th>Country:</th><td><a href="${countryLink}">United States</a></td></tr>
              <tr><th>State:</th><td><a href="${stateLink}">${stateName} (${c.stateCode})</a></td></tr>
              <tr><th>Lat/Long:</th><td>${formatDMS(c.latitude, 'lat')} / ${formatDMS(c.longitude, 'lon')}</td></tr>
              <tr><th>Elevation:</th><td>${c.elevation != null ? c.elevation + ' m' : '—'}</td></tr>
              <tr><th>Currency:</th><td>United States Dollar (USD)</td></tr>
              <tr><th>Languages:</th><td>English</td></tr>
              <tr><th>Country Code:</th><td>+1</td></tr>
            </tbody>
          </table>
          <div class="city-hero-meta">
            <span class="meta-item"><strong>IANA:</strong> ${c.timezone}</span>
            <span class="meta-item" id="utcOffset">UTC --</span>
            <span class="meta-item" id="dstStatus">—</span>
            <span class="meta-item" id="tzAbbr">—</span>
            <a class="meta-item meta-item--link" href="/time/zones/${getTzAbbr(c.timezone).toLowerCase()}/" id="tzPageLink" style="display: none;">About <span id="tzAbbrText">${getTzAbbr(c.timezone)}</span> →</a>
          </div>
        </div>

        <!-- RIGHT: state landmark carousel (5 images, auto-advance) -->
        <div class="city-carousel" id="cityCarousel" data-state="${c.stateSlug}">
          <div class="city-carousel-images" id="carouselImages">
${carouselHtml}
          </div>
          <div class="city-carousel-caption" id="carouselCaption">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
            <span id="carouselCaptionText">${carouselLabels[0]}</span>
          </div>
          <div class="city-carousel-nav">
            <button class="city-carousel-prev" id="carouselPrev" aria-label="Previous image">‹</button>
            <button class="city-carousel-next" id="carouselNext" aria-label="Next image">›</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Centered city search bar (under hero, for jumping to any US city) -->
    <section class="city-search-bar">
      <label class="city-search-label" for="citySearchInput">Search 33,945 cities worldwide</label>
      <div class="city-search-wrap">
        <svg class="city-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="search" id="citySearchInput" class="city-search-input" placeholder="Type a city name (e.g. Madrid, Tokyo, Rio de Janeiro)…" autocomplete="off" />
        <div class="city-search-results" id="citySearchResults" hidden></div>
      </div>
    </section>

    <!-- Quick facts (KEEP for now, may merge with data table later) -->
    <section class="city-facts" hidden>
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

    <!-- TABS NAV (sticky below breadcrumb, 7 sections, scroll-margin-top: 116px = 56 header + 60 tabs) -->
    <nav class="city-tabs" id="cityTabs" role="tablist" aria-label="City page sections">
      <a href="#time-zone" class="city-tab active" data-tab="time-zone" role="tab" aria-selected="true">
        <span class="city-tab-icon">🌐</span>
        <span class="city-tab-label">Time Zone</span>
      </a>
      <a href="#dst" class="city-tab" data-tab="dst" role="tab">
        <span class="city-tab-icon">🔄</span>
        <span class="city-tab-label">DST Changes</span>
      </a>
      <a href="#weather" class="city-tab" data-tab="weather" role="tab">
        <span class="city-tab-icon">☀️</span>
        <span class="city-tab-label">Weather</span>
      </a>
      <a href="#sun-moon" class="city-tab" data-tab="sun-moon" role="tab">
        <span class="city-tab-icon">🌙</span>
        <span class="city-tab-label">Sun & Moon</span>
      </a>
      <a href="#holidays" class="city-tab" data-tab="holidays" role="tab">
        <span class="city-tab-icon">🎉</span>
        <span class="city-tab-label">Holidays</span>
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

    <!-- Time Zone tab (default, always visible) -->
    <section class="city-section" id="pane-time-zone" data-pane="time-zone">
      <h2>🌐 Time Zone in ${c.name}</h2>

      <!-- Definition list — 4 rows matching the timeanddate.com pattern:
           Current TZ / Next change / Current offset / Same time as... -->
      <dl class="tz-info-list">
        <div class="tz-info-row">
          <dt>Current:</dt>
          <dd id="tzCurrent">${getTzAbbr(c.timezone)} — loading…</dd>
        </div>
        <div class="tz-info-row">
          <dt>Next Change:</dt>
          <dd id="tzNextChange">Loading next DST change…</dd>
        </div>
        <div class="tz-info-row">
          <dt>Current Offset:</dt>
          <dd id="tzCurrentOffset">UTC ${getTzOffset(c.timezone)}</dd>
        </div>
        <div class="tz-info-row">
          <dt>Same time as:</dt>
          <dd id="tzSameTime">Loading nearby same-time cities…</dd>
        </div>
      </dl>

      <p class="tz-info-meta">IANA: <code>${c.timezone}</code> · <a href="/time/zones/${getTzAbbr(c.timezone).toLowerCase()}/" class="tz-page-link">About ${getTzAbbr(c.timezone)} →</a></p>

      <!-- Year strip — color-coded months showing DST vs Standard time.
           Populated by JS from /api/v1/dst/upcoming?tz=... data. -->
      <h3>${new Date().getFullYear()} Time Zones — ${c.name}</h3>
      <div class="year-strip" id="yearStrip" data-tz="${c.timezone}" data-year="${new Date().getFullYear()}">
        <div class="year-strip-grid">
          <div class="year-month" data-month="1"><span>Jan</span></div>
          <div class="year-month" data-month="2"><span>Feb</span></div>
          <div class="year-month" data-month="3"><span>Mar</span></div>
          <div class="year-month" data-month="4"><span>Apr</span></div>
          <div class="year-month" data-month="5"><span>May</span></div>
          <div class="year-month" data-month="6"><span>Jun</span></div>
          <div class="year-month" data-month="7"><span>Jul</span></div>
          <div class="year-month" data-month="8"><span>Aug</span></div>
          <div class="year-month" data-month="9"><span>Sep</span></div>
          <div class="year-month" data-month="10"><span>Oct</span></div>
          <div class="year-month" data-month="11"><span>Nov</span></div>
          <div class="year-month" data-month="12"><span>Dec</span></div>
        </div>
        <div class="year-strip-legend">
          <span class="year-strip-legend-item standard"><span class="year-strip-swatch standard"></span>${getTzAbbr(c.timezone).replace('D', 'S')} (Standard)</span>
          <span class="year-strip-legend-item daylight"><span class="year-strip-swatch daylight"></span>${getTzAbbr(c.timezone).replace('S', 'D')} (Daylight)</span>
        </div>
      </div>
      <p class="year-strip-caption">The graph above illustrates clock changes in ${c.name} during ${new Date().getFullYear()}.</p>

      <!-- DST changes table — same shape as timeanddate.com's "Time Changes" table -->
      <h3>Time Changes in ${c.name} Over the Years</h3>
      <p class="year-strip-caption">Daylight Saving Time (DST) changes do not necessarily occur on the same date every year.</p>
      <div class="dst-table-wrap">
        <table class="dst-table" id="tzDstTable" data-tz="${c.timezone}">
          <thead>
            <tr><th>Year</th><th>Date &amp; Time</th><th>Abbreviation</th><th>Time Change</th><th>Offset After</th></tr>
          </thead>
          <tbody><tr><td colspan="5" class="city-page-loading">Loading DST history…</td></tr></tbody>
        </table>
      </div>
      <p class="year-strip-caption"><a href="?year=2027#time-zone" id="tzYearLink">View all years →</a></p>

      <!-- TZ-specific news — shown if there are articles tagged with this IANA tz -->
      <h3>📰 ${getTzAbbr(c.timezone)} News</h3>
      <div class="tz-news" id="tzNews" data-tz="${c.timezone}">
        <p class="city-page-loading">Loading time zone news…</p>
      </div>

      <!-- Climate (lat-based estimate) -->
      <h3>🌡 ${c.name} climate year-round</h3>
      <div class="climate-chart" id="climateChart" data-climate='${climateStr}'></div>
      <p class="climate-note">Estimated from latitude (${c.latitude.toFixed(2)}°${c.latitude >= 0 ? 'N' : 'S'}). Actual values vary by elevation, ocean currents, and local geography.</p>
    </section>

    <!-- DST tab — shows the same year strip + history but focused view -->
    <section class="city-section" id="pane-dst" data-pane="dst" hidden>
      <h2>🔄 Daylight Saving Time in ${c.name}</h2>
      <p id="dstDescription">Loading DST schedule for ${c.name}…</p>
      <div class="dst-year-strip" id="dstYearStrip"></div>
      <h3>📅 Recent and upcoming clock changes</h3>
      <div class="dst-history" id="dstHistory"><p class="city-page-loading">Loading 5-year history…</p></div>
    </section>

    <!-- Weather tab -->
    <section class="city-section" id="pane-weather" data-pane="weather" hidden>
      <h2>☀️ 7-day weather forecast — ${c.name}</h2>
      <div class="weather-grid" id="weatherGrid" data-lat="${c.latitude}" data-lon="${c.longitude}" data-tz="${c.timezone}">
        <p class="city-page-loading">Loading 7-day forecast…</p>
      </div>
      <p class="weather-source">Forecast data: <a href="https://open-meteo.com/" rel="noopener" target="_blank">Open-Meteo</a> (CC BY 4.0)</p>
    </section>

    <!-- Sun times tab -->
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

    <!-- Climate (lives inside time-zone pane — geographic context) — REMOVED, now in time-zone above -->

    <!-- Cities near (new section using /cities/{id}/nearby API) -->
    <div id="pane-dst-nearby" data-pane="dst" hidden></div>

    <!-- More to explore — REMOVED, was duplicating Time/General tab data; replaced by section in continue-strip -->

    <!-- Holidays tab — real data from /api/v1/holidays endpoint -->
    <section class="city-section" id="pane-holidays" data-pane="holidays" hidden>
      <h2>🎉 US Holidays in ${new Date().getFullYear()}</h2>
      <p class="holidays-note">Federal public holidays observed in the United States. Data from Nager.Date API.</p>
      <div class="holidays-grid" id="holidaysGrid" data-country="US">
        <p class="city-page-loading">Loading 2026 holidays…</p>
      </div>
      <p class="holidays-source">Source: <a href="https://date.nager.at/" rel="noopener" target="_blank">Nager.Date</a> (CC BY 4.0)</p>
    </section>

    <!-- Tools tab -->
    <section class="city-section" id="pane-tools" data-pane="tools" hidden>
      <h2>🛠 Tools for ${c.name}</h2>
      <div class="tools-grid">
        <a href="/world-time/meeting/?cities=${c.id}" class="tool-link">
          <span class="tool-icon">📅</span>
          <span class="tool-title">Meeting planner</span>
          <span class="tool-desc">Find overlap with ${c.name}</span>
        </a>
        <a href="/time-zones/converter/?from=${c.timezone}" class="tool-link">
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
        <a href="/world-time/united-states/state/${c.stateSlug || ''}/" class="tool-link">
          <span class="tool-icon">🏛</span>
          <span class="tool-title">All ${stateName} cities</span>
          <span class="tool-desc">Browse by state</span>
        </a>
        <a href="/world-time/united-states/" class="tool-link">
          <span class="tool-icon">🇺🇸</span>
          <span class="tool-title">All US cities</span>
          <span class="tool-desc">15,994 cities in 52 states</span>
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

  <!-- Continue your journey strip — REMOVED 2026-07-29. Was duplicating the
       6-card strip that site-shell.js auto-injects on every page. Now we
       rely on the JS-injected version (richer, 6 cards instead of 3). -->

  ${buildFooter(`Current time in ${c.name}, ${stateName}, United States (${c.timezone})`)}

  <script src="/src/site-shell.js" defer></script>
  <script>window.IANA_TO_ABBR = ${JSON.stringify(IANA_TO_ABBR)};</script>
  <script>
  // Live clock for the city — uses Intl.DateTimeFormat with the city's IANA tz
  (function() {
    // Today bar removed 2026-07-28 — no DOM element to update. The live
    // clock in the hero (below) is the source of truth for time display.

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
        // Format: HH.MM.SS.MS — 2-digit hours/minutes/seconds, then 2-digit
        // fractional seconds (centiseconds) from the LOCAL ms value. We use
        // 24-hour time and dots as separators, per user spec 2026-07-28.
        var fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        var parts = fmt.formatToParts(now);
        var h = '', m = '', s = '';
        for (var p of parts) {
          if (p.type === 'hour') h = p.value;
          else if (p.type === 'minute') m = p.value;
          else if (p.type === 'second') s = p.value;
        }
        // 2-digit ms (centiseconds): take first 2 digits of getMilliseconds()
        var cs = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
        // time-hm holds "HH.MM.SS" and time-sec holds ".MS" (2 digits)
        // so they appear on one line: "06.26.11.45"
        clock.querySelector('.time-hm').textContent = h + '.' + m + '.' + s;
        clock.querySelector('.time-sec').textContent = '.' + cs;
        clock.querySelector('.time-ampm').textContent = '';

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
    // Initial paint, then a fast rAF loop for smooth sub-second updates.
    // We use rAF (60fps) so the .MS sub-seconds (centiseconds) tick smoothly,
    // not once per second like setInterval would. Throttled to ~30fps to be
    // gentle on battery; the eye can't distinguish 30fps sub-second animation.
    update();
    var lastTick = 0;
    function tickRAF(ts) {
      // Throttle to ~30fps: only re-render if 33ms passed
      if (ts - lastTick >= 33) {
        lastTick = ts;
        update();
      }
      requestAnimationFrame(tickRAF);
    }
    requestAnimationFrame(tickRAF);

    // ====================================================================
    // ANALOG CLOCK FACE — draws tick marks + updates hour/minute/second
    // hands via requestAnimationFrame for ms-precise motion.
    // ====================================================================
    (function() {
      var face = document.getElementById('cityClockFace');
      if (!face) return;
      var ticksG = document.getElementById('clockTicks');
      var hourHand = document.getElementById('clockHour');
      var minHand = document.getElementById('clockMinute');
      var secHand = document.getElementById('clockSecond');
      // Draw 12 hour ticks + 60 minute ticks
      if (ticksG) {
        var html = '';
        for (var i = 0; i < 60; i++) {
          var angle = i * 6 - 90; // -90 to start at 12 o'clock
          var rad = angle * Math.PI / 180;
          var isHour = i % 5 === 0;
          var inner = isHour ? 78 : 84;
          var outer = 90;
          var x1 = 100 + Math.cos(rad) * inner;
          var y1 = 100 + Math.sin(rad) * inner;
          var x2 = 100 + Math.cos(rad) * outer;
          var y2 = 100 + Math.sin(rad) * outer;
          var w = isHour ? 2.5 : 1;
          // Hardcoded colors so clock is visible in both light and dark mode
          html += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#1f1a3a" stroke-width="' + w + '" stroke-linecap="round" />';
        }
        // Hour numbers (optional, subtle)
        var numHtml = '';
        var nums = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        for (var j = 0; j < 12; j++) {
          var nAngle = j * 30 - 90;
          var nRad = nAngle * Math.PI / 180;
          var nx = 100 + Math.cos(nRad) * 70;
          var ny = 100 + Math.sin(nRad) * 70 + 4; // +4 for vertical centering
          numHtml += '<text x="' + nx.toFixed(1) + '" y="' + ny.toFixed(1) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="600" fill="#1f1a3a">' + nums[j] + '</text>';
        }
        ticksG.innerHTML = html + numHtml;
      }
      function tickClock() {
        var now = new Date();
        // Get hour, minute, second in the city's timezone
        // 2-digit hours for the analog clock
        var fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        var parts = fmt.formatToParts(now);
        var h = 0, m = 0, s = 0, ms = now.getMilliseconds();
        for (var p of parts) {
          if (p.type === 'hour') h = parseInt(p.value, 10) % 12;
          else if (p.type === 'minute') m = parseInt(p.value, 10);
          else if (p.type === 'second') s = parseInt(p.value, 10);
        }
        // Hour hand: 30 deg per hour + 0.5 deg per minute
        var hourAngle = (h * 30) + (m * 0.5);
        var minAngle = (m * 6) + (s * 0.1);
        var secAngle = (s * 6) + (ms * 0.006);
        if (hourHand) hourHand.setAttribute('transform', 'rotate(' + hourAngle.toFixed(2) + ' 100 100)');
        if (minHand) minHand.setAttribute('transform', 'rotate(' + minAngle.toFixed(2) + ' 100 100)');
        if (secHand) secHand.setAttribute('transform', 'rotate(' + secAngle.toFixed(2) + ' 100 100)');
        requestAnimationFrame(tickClock);
      }
      requestAnimationFrame(tickClock);
    })();

    // ====================================================================
    // STATE LANDMARK CAROUSEL — auto-advance every 6s, pause on hover,
    // prev/next buttons, sync caption with active image. Images are
    // pre-rendered into the DOM; we just toggle .active on them.
    // ====================================================================
    (function() {
      var carousel = document.getElementById('cityCarousel');
      if (!carousel) return;
      var imgs = carousel.querySelectorAll('.city-carousel-img');
      var captionEl = document.getElementById('carouselCaptionText');
      var prevBtn = document.getElementById('carouselPrev');
      var nextBtn = document.getElementById('carouselNext');
      if (imgs.length < 2) return;
      var current = 0;
      var autoplay = null;

      function show(idx) {
        imgs.forEach(function(img, i) {
          if (i === idx) img.classList.add('active');
          else img.classList.remove('active');
        });
        if (captionEl) captionEl.textContent = imgs[idx].getAttribute('data-label') || '';
        current = idx;
      }
      function next() { show((current + 1) % imgs.length); }
      function prev() { show((current - 1 + imgs.length) % imgs.length); }

      // Shuffle initial order (deterministic by city.id so it's stable
      // across page loads for a given city)
      try {
        var order = [0, 1, 2, 3, 4];
        var seed = parseInt(hero.getAttribute('data-lat').replace('.', '').slice(0, 6), 10) || 0;
        for (var k = order.length - 1; k > 0; k--) {
          seed = (seed * 9301 + 49297) % 233280;
          var j = seed % (k + 1);
          var tmp = order[k]; order[k] = order[j]; order[j] = tmp;
        }
        // Re-order DOM
        var parent = document.getElementById('carouselImages');
        for (var n = 0; n < order.length; n++) {
          parent.appendChild(imgs[order[n]]);
        }
        // Re-collect imgs in new order
        imgs = parent.querySelectorAll('.city-carousel-img');
        show(0);
      } catch (e) { /* keep original order on error */ }

      // Autoplay
      function startAutoplay() {
        stopAutoplay();
        autoplay = setInterval(next, 6000);
      }
      function stopAutoplay() {
        if (autoplay) { clearInterval(autoplay); autoplay = null; }
      }
      startAutoplay();
      carousel.addEventListener('mouseenter', stopAutoplay);
      carousel.addEventListener('mouseleave', startAutoplay);
      // Touch support: tap toggles
      carousel.addEventListener('touchstart', stopAutoplay, { passive: true });
      carousel.addEventListener('touchend', function() { setTimeout(startAutoplay, 3000); });

      if (prevBtn) prevBtn.addEventListener('click', function() { prev(); startAutoplay(); });
      if (nextBtn) nextBtn.addEventListener('click', function() { next(); startAutoplay(); });
    })();

    // ====================================================================
    // CITY SEARCH BAR — fetches /data/global-cities-search.json + cc2-country-slug.json
    // on focus (once), then filters in-memory as the user types. Top 5 matches
    // shown as a dropdown; click navigates to the city page (US → /world-time/united-states/,
    // other → /world-time/{country-slug}/ which becomes the coming-soon page).
    // ====================================================================
    (function() {
      var input = document.getElementById('citySearchInput');
      var results = document.getElementById('citySearchResults');
      if (!input || !results) return;
      var cities = null;
      var countrySlug = null;
      var citiesLoading = null;

      function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function(c) {
          return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
        });
      }
      function buildHref(m) {
        if (m.c === 'US') return '/world-time/united-states/' + m.s + '/';
        var cslug = countrySlug && countrySlug[m.c];
        if (cslug) return '/world-time/' + cslug + '/' + m.s + '/';
        return '/world-time/';
      }
      function loadCities() {
        if (cities) return Promise.resolve(cities);
        if (citiesLoading) return citiesLoading;
        citiesLoading = Promise.all([
          fetch('/data/global-cities-search.json').then(function(r) { return r.json(); }).catch(function() { return []; }),
          fetch('/data/cc2-country-slug.json').then(function(r) { return r.json(); }).catch(function() { return {}; })
        ]).then(function(arr) {
          cities = arr[0] || [];
          countrySlug = arr[1] || {};
          return cities;
        });
        return citiesLoading;
      }
      function search(q) {
        if (!q || q.length < 2) return [];
        var qLower = q.toLowerCase();
        var matches = [];
        // Exact prefix match first, then substring match
        for (var i = 0; i < cities.length && matches.length < 8; i++) {
          var c = cities[i];
          var n = (c.n || '').toLowerCase();
          if (n.indexOf(qLower) === 0) {
            matches.push(c);
          }
        }
        if (matches.length < 5) {
          for (var j = 0; j < cities.length && matches.length < 8; j++) {
            var n2 = (cities[j].n || '').toLowerCase();
            if (n2.indexOf(qLower) > 0 && n2.indexOf(qLower) !== -1) {
              matches.push(cities[j]);
            }
          }
        }
        return matches.slice(0, 5);
      }
      function render(matches) {
        if (!matches.length) {
          results.innerHTML = '<div class="city-search-empty">No matches. Try another city.</div>';
          results.hidden = false;
          return;
        }
        results.innerHTML = matches.map(function(m) {
          var meta = (m.cn || '') + (m.sc ? ' · ' + m.sc : '') + (m.p ? ' · ' + m.p : '');
          return '<a class="city-search-result" href="' + buildHref(m) + '">'
            + '<span class="city-search-result-name">' + escapeHtml(m.n) + '</span>'
            + '<span class="city-search-result-meta">' + escapeHtml(meta) + '</span>'
            + '</a>';
        }).join('');
        results.hidden = false;
      }
      input.addEventListener('focus', loadCities);
      input.addEventListener('input', function() {
        var q = input.value.trim();
        if (q.length < 2) { results.hidden = true; return; }
        loadCities().then(function() { render(search(q)); });
      });
      // Close on outside click
      document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !results.contains(e.target)) {
          results.hidden = true;
        }
      });
      // Keyboard nav: Esc to close, Enter to go to first match
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { results.hidden = true; input.blur(); }
        if (e.key === 'Enter') {
          var first = results.querySelector('.city-search-result');
          if (first) { window.location.href = first.getAttribute('href'); }
        }
      });
    })();

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
        if (tabId === 'holidays') loadHolidays();
        if (tabId === 'time-zone') loadTimeZoneData();
      }
      // Update URL hash without scroll
      if (history.replaceState) {
        history.replaceState(null, '', '#' + tabId);
      }
      // Scroll the target pane into view, accounting for the sticky chrome
      // (header 56px + breadcrumb ~0 + tabs nav ~48px = ~110px headroom).
      // Use scrollIntoView with -120px block offset (handled by CSS
      // scroll-margin-top on .city-section). The browser handles the math.
      var pane = document.querySelector('[data-pane="' + tabId + '"]');
      if (pane) {
        // Slight delay so the display change is visible before scroll
        setTimeout(function() {
          pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
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
        // Default: time-zone tab is visible. Load its data immediately
        // so the year strip + DST table + same-time cities populate
        // without requiring the user to click the tab.
        loadTimeZoneData();
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initFromHash);
    } else {
      initFromHash();
    }

    // Lazy load: holidays — fetch from /api/v1/holidays?country=US&year=YYYY
    function loadHolidays() {
      var target = document.getElementById('holidaysGrid');
      if (!target || target.getAttribute('data-loaded')) return;
      target.setAttribute('data-loaded', '1');
      var year = new Date().getFullYear();
      var country = target.getAttribute('data-country') || 'US';
      fetch('https://datetime-api-dev.nsura2029.workers.dev/api/v1/holidays?country=' + country + '&year=' + year)
        .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function(json) {
          if (!json.success) throw new Error('API error');
          var holidays = (json.data && json.data.holidays) || [];
          if (holidays.length === 0) {
            target.innerHTML = '<p class="holidays-empty">No holidays found for ' + country + ' in ' + year + '.</p>';
            return;
          }
          var today = new Date().toISOString().slice(0, 10);
          var html = '<div class="holidays-list">';
          holidays.forEach(function(h) {
            var isPast = h.date < today;
            var isToday = h.date === today;
            var isFederal = h.type === 'public_holiday';
            html += '<div class="holiday-row' + (isPast ? ' is-past' : '') + (isToday ? ' is-today' : '') + '">';
            html += '<div class="holiday-date">';
            html += '<div class="holiday-day">' + h.date.slice(8, 10) + '</div>';
            html += '<div class="holiday-month">' + new Date(h.date).toLocaleString('en-US', { month: 'short' }) + '</div>';
            html += '</div>';
            html += '<div class="holiday-info">';
            html += '<div class="holiday-name">' + h.name;
            if (isFederal) html += ' <span class="holiday-badge">Federal</span>';
            if (isToday) html += ' <span class="holiday-badge holiday-badge--today">Today</span>';
            html += '</div>';
            html += '<div class="holiday-meta">';
            html += '<span class="holiday-dayname">' + new Date(h.date + 'T12:00:00').toLocaleString('en-US', { weekday: 'long' }) + '</span>';
            if (h.religion && h.religion !== 'secular') html += ' · ' + h.religion;
            html += '</div>';
            html += '</div>';
            html += '<div class="holiday-when">' + (isPast ? '<span class="holiday-past-tag">Passed</span>' : '<span class="holiday-countdown" data-date="' + h.date + '"></span>') + '</div>';
            html += '</div>';
          });
          html += '</div>';
          target.innerHTML = html;
          // Compute "in X days" for upcoming
          document.querySelectorAll('.holiday-countdown').forEach(function(el) {
            var target = el.getAttribute('data-date');
            var days = Math.ceil((new Date(target) - new Date(today)) / (1000 * 60 * 60 * 24));
            if (days === 0) el.textContent = 'Today';
            else if (days === 1) el.textContent = 'Tomorrow';
            else if (days < 30) el.textContent = 'in ' + days + ' days';
            else if (days < 60) el.textContent = 'in ' + Math.round(days / 7) + ' weeks';
            else el.textContent = 'in ' + Math.round(days / 30) + ' months';
          });
        })
        .catch(function() {
          target.innerHTML = '<p class="holidays-empty">Could not load holidays. <a href="/holidays/?country=' + country + '">View all US holidays →</a></p>';
        });
    }

    // Lazy load: news
    function loadNews() {
      var target = document.getElementById('newsContent');
      if (!target) return;
      fetch('https://datetime-api-dev.nsura2029.workers.dev/api/v1/cities/' + cityId + '/news?limit=3')
        .then(function(r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function(json) {
          if (!json.success) throw new Error('API error');
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
          // City not in D1 (404) or other error — show graceful fallback
          // with link to the full news index so users can still browse.
          target.innerHTML = '<p style="color: var(--color-muted, #8a869c); padding: 1.5rem 0; text-align: center;">Personalized news for ${c.name} is not available yet. <a href="/news/" style="color: var(--color-link, #6d28d9); font-weight: 600;">Browse all news articles →</a></p>';
        });
    }

    // Lazy load: Time Zone tab data — populates the year strip, DST
    // history table, "Same time as..." cities, and TZ news. Uses a
    // single /api/v1/dst/upcoming fetch + parallel /cities/{id}/nearby
    // and /news?tz= fetches for maximum data, minimum round-trips.
    function loadTimeZoneData() {
      if (loadedPanes['time-zone']) return;
      loadedPanes['time-zone'] = true;

      var tzCurrent = document.getElementById('tzCurrent');
      var tzNextChange = document.getElementById('tzNextChange');
      var tzCurrentOffset = document.getElementById('tzCurrentOffset');
      var tzSameTime = document.getElementById('tzSameTime');
      var yearStrip = document.getElementById('yearStrip');
      var dstTable = document.getElementById('tzDstTable');
      var tzNews = document.getElementById('tzNews');

      var baseAbbr = (window.IANA_TO_ABBR && window.IANA_TO_ABBR[iana]) || 'STD';
      var dstAbbr = baseAbbr.replace('ST', 'DT');
      var stdAbbr = baseAbbr.replace('DT', 'ST');

      // 1) Fetch DST data — drives year strip + history table + next change
      fetch('https://datetime-api-dev.nsura2029.workers.dev/api/v1/dst/upcoming?tz=' + encodeURIComponent(iana))
        .then(function(r) { return r.json(); })
        .then(function(json) {
          if (!json.success || !json.data) return;
          var data = json.data;
          var history = data.history || {};
          var all = (history.all || []).slice().sort(function(a, b) {
            return a.date.localeCompare(b.date);
          });
          var future = history.future || [];
          var dstObserved = !!data.dstObserved;

          // ===== Update the 4-row info card =====
          if (tzCurrent) {
            // Live TZ abbr from Intl
            try {
              var now = new Date();
              var liveFmt = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'short' });
              var liveAbbr = '';
              liveFmt.formatToParts(now).forEach(function(p) {
                if (p.type === 'timeZoneName') liveAbbr = p.value;
              });
              var tzLink = '/time/zones/' + (liveAbbr || baseAbbr).toLowerCase() + '/';
              tzCurrent.innerHTML = '<a href="' + tzLink + '">' + (liveAbbr || baseAbbr) + '</a> — ' + (liveAbbr && liveAbbr.indexOf('D') > -1 ? 'Daylight Time' : 'Standard Time');
            } catch (e) {
              tzCurrent.textContent = baseAbbr + ' — current time zone';
            }
          }
          if (tzNextChange && future[0]) {
            var n = future[0];
            var isDst = n.direction === 'forward';
            var targetAbbr = isDst ? dstAbbr : stdAbbr;
            var tzLink2 = '/time/zones/' + targetAbbr.toLowerCase() + '/';
            var dateObj = new Date(n.date + 'T12:00:00');
            var dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            tzNextChange.innerHTML = '<a href="' + tzLink2 + '">' + targetAbbr + '</a> — on <strong>' + dateStr + '</strong> (' + (isDst ? '+1h' : '−1h') + ' at 2:00 am)';
          } else if (tzNextChange) {
            tzNextChange.innerHTML = dstObserved ? 'No upcoming changes' : '<em>DST is not observed in this zone</em>';
          }
          if (tzCurrentOffset) {
            // Live UTC offset
            try {
              var offFmt = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'shortOffset' });
              var liveOff = '';
              offFmt.formatToParts(new Date()).forEach(function(p) {
                if (p.type === 'timeZoneName') liveOff = p.value.replace('GMT', '');
              });
              tzCurrentOffset.innerHTML = 'UTC/GMT ' + (liveOff || getTzOffset(iana)) + ' hours';
            } catch (e) {
              tzCurrentOffset.textContent = 'UTC ' + getTzOffset(iana);
            }
          }

          // ===== Build year strip (12 months, color-coded) =====
          if (yearStrip) {
            var months = yearStrip.querySelectorAll('.year-month');
            var isDstActive = false;
            // Start: is DST active right now? (we need to check this month)
            var currentMonth = new Date().getMonth();
            // First, determine the baseline state at the start of the year
            // If a DST start happened before Jan 1, isDstActive = true
            all.forEach(function(t) {
              if (t.date <= new Date().getFullYear() + '-01-01') {
                isDstActive = t.direction === 'forward';
              }
            });
            months.forEach(function(m, i) {
              var monthNum = i + 1;
              var monthDate = new Date().getFullYear() + '-' + String(monthNum).padStart(2, '0') + '-15';
              // Check if any transition in this month changed the state
              all.forEach(function(t) {
                var tMonth = parseInt(t.date.slice(5, 7), 10);
                if (tMonth === monthNum && t.date.slice(0, 4) == new Date().getFullYear()) {
                  // The transition happens in this month. For visual purposes,
                  // we mark the whole month as the state AFTER the transition.
                  isDstActive = t.direction === 'forward';
                }
              });
              if (dstObserved && isDstActive) {
                m.classList.add('daylight');
              } else {
                m.classList.remove('daylight');
              }
            });
          }

          // ===== Build DST history table =====
          if (dstTable) {
            var tbody = dstTable.querySelector('tbody');
            if (!dstObserved || all.length === 0) {
              tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: var(--color-muted, #6b6580);"><strong>' + baseAbbr + '</strong> does not observe Daylight Saving Time — clocks stay the same all year.</td></tr>';
            } else {
              // Show 5 years: 2 past + current/next + 2 future
              var allSorted = all.slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
              var rowsHtml = '';
              var nextDate = future[0] ? future[0].date : null;
              allSorted.forEach(function(t) {
                var d = new Date(t.date + 'T02:00:00');
                var dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                var timeStr = 'at 2:00 am';
                var isNext = t.date === nextDate;
                var isDst = t.direction === 'forward';
                var fromAbbr = isDst ? stdAbbr : dstAbbr;
                var toAbbr = isDst ? dstAbbr : stdAbbr;
                var changeStr = (isDst ? '+1 hour (DST start)' : '−1 hour (DST end)');
                var dirClass = isDst ? 'direction-forward' : 'direction-back';
                var offsetAfter = isDst ? n2off(t.offsetAfter) : n2off(t.offsetAfter);
                rowsHtml += '<tr' + (isNext ? ' class="next"' : '') + '>';
                rowsHtml += '<td>' + (t.date ? t.date.slice(0, 4) : '') + '</td>';
                rowsHtml += '<td>' + dateStr + ' ' + timeStr + (isNext ? ' <span style="color: var(--color-primary, #5b4aaf); font-weight: 700;">← next</span>' : '') + '</td>';
                rowsHtml += '<td class="abbr-change">' + fromAbbr + ' <span class="arrow">→</span> ' + toAbbr + '</td>';
                rowsHtml += '<td class="' + dirClass + '">' + changeStr + '</td>';
                rowsHtml += '<td class="mono">UTC' + offsetAfter + '</td>';
                rowsHtml += '</tr>';
              });
              tbody.innerHTML = rowsHtml;
            }
          }
        })
        .catch(function(e) { /* ignore — defaults remain */ });

      // 2) "Same time as..." — fetch nearby cities in the same TZ
      // Use a more direct approach: query the cities API for major cities in
      // the same IANA timezone, sorted by population. Falls back to the
      // /cities/{id}/nearby endpoint if needed.
      if (tzSameTime) {
        // Build a list of major US cities in common timezones as a static fallback
        var SAME_TZ_MAJOR = {
          'America/New_York':   ['New York', 'Boston', 'Philadelphia', 'Atlanta', 'Miami', 'Toronto'],
          'America/Chicago':    ['Chicago', 'Houston', 'Dallas', 'San Antonio', 'Austin', 'Minneapolis'],
          'America/Denver':     ['Denver', 'Salt Lake City', 'Phoenix', 'Albuquerque', 'Cheyenne'],
          'America/Los_Angeles':['Los Angeles', 'San Francisco', 'Seattle', 'Portland', 'Las Vegas', 'San Diego'],
          'America/Phoenix':    ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale'],
          'Pacific/Honolulu':   ['Honolulu', 'Hilo', 'Kailua', 'Pearl City'],
          'America/Anchorage':  ['Anchorage', 'Fairbanks', 'Juneau'],
          'America/Adak':       ['Adak'],
          'America/Boise':      ['Boise', 'Reno'],
          'America/Detroit':    ['Detroit', 'Indianapolis'],
          'America/Kentucky/Louisville': ['Louisville', 'Frankfort'],
          'America/Indiana/Indianapolis': ['Indianapolis', 'Fort Wayne']
        };
        var sameList = SAME_TZ_MAJOR[iana] || [];

        // Try to use the actual /cities/{id}/nearby endpoint as the
        // primary source (real data, always accurate)
        fetch('https://datetime-api-dev.nsura2029.workers.dev/api/v1/cities/' + cityId + '/nearby?limit=3')
          .then(function(r) { return r.json(); })
          .then(function(json) {
            if (json.success && json.data && json.data.nearby) {
              var nearbySame = (json.data.nearby || []).filter(function(n) { return n.timezone === iana; });
              var html = '';
              if (nearbySame.length > 0) {
                html = '<strong>' + nearbySame[0].name + '</strong> (' + nearbySame[0].distanceKm.toFixed(1) + ' km away)';
                if (nearbySame.length > 1) {
                  html += '<br><span style="color: var(--color-muted, #6b6580); font-size: 0.875rem;">Also same time: ';
                  html += nearbySame.slice(1, 4).map(function(n) { return '<a href="/world-time/united-states/' + slugify(n.name) + '/">' + n.name + '</a>'; }).join(', ');
                  html += '</span>';
                }
              } else if (sameList.length > 0) {
                // Fallback to major cities list
                html = '<strong>' + sameList[0] + '</strong>';
                if (sameList.length > 1) {
                  html += '<br><span style="color: var(--color-muted, #6b6580); font-size: 0.875rem;">Also same time: ';
                  html += sameList.slice(1, 5).join(', ');
                  html += '</span>';
                }
              } else {
                html = '<em>No major city in this time zone in our database</em>';
              }
              tzSameTime.innerHTML = html;
            }
          })
          .catch(function() {
            // Fallback to static list
            if (sameList.length > 0) {
              tzSameTime.innerHTML = '<strong>' + sameList[0] + '</strong>' +
                (sameList.length > 1 ? '<br><span style="color: var(--color-muted, #6b6580); font-size: 0.875rem;">Also same time: ' + sameList.slice(1, 5).join(', ') + '</span>' : '');
            } else {
              tzSameTime.innerHTML = '<em>Same UTC offset</em>';
            }
          });
      }

      // 3) TZ news — fetch country-filtered news from the existing endpoint,
      //    then client-side filter for "time" category which is TZ-relevant.
      //    (Future: add ?tz= param to /api/v1/news for true TZ-specific
      //    filtering once we have a TZ tag on each article.)
      if (tzNews) {
        fetch('https://datetime-api-dev.nsura2029.workers.dev/api/v1/cities/' + cityId + '/news?limit=10')
          .then(function(r) { return r.json(); })
          .then(function(json) {
            if (!json.success || !json.data) return;
            // Filter for "time" category (TZ-specific articles) first,
            // fall back to any article if none found.
            var articles = (json.data.articles || []).filter(function(a) {
              return a.category === 'time' || a.category === 'tz';
            });
            if (articles.length === 0) articles = (json.data.articles || []).slice(0, 3);
            if (articles.length === 0) {
              tzNews.innerHTML = '<p class="tz-news-empty">No time-zone-specific news yet. <a href="/news/time/">Browse all time zone news →</a></p>';
              return;
            }
            var html = '<div class="tz-news-list">';
            articles.forEach(function(a) {
              var icon = a.category === 'time' ? '⏰' : '📰';
              html += '<a class="tz-news-item" href="' + a.url + '">';
              html += '<span class="tz-news-item-icon">' + icon + '</span>';
              html += '<span class="tz-news-item-text">';
              html += '<div class="tz-news-item-title">' + a.title + '</div>';
              html += '<div class="tz-news-item-meta">' + (a.category || 'time') + ' · ' + (a.published || '') + '</div>';
              html += '</span></a>';
            });
            html += '</div>';
            tzNews.innerHTML = html;
          })
          .catch(function() {
            tzNews.innerHTML = '<p class="tz-news-empty">News temporarily unavailable.</p>';
          });
      }
    }

    function n2off(s) {
      // "−04:00" → "-4h", "+00:00" → "0h", etc.
      if (!s) return '?';
      var m = s.match(/([+-]?)(\d+):(\d+)/);
      if (!m) return s;
      var sign = m[1] === '+' ? '+' : (m[1] === '-' ? '-' : '');
      var h = parseInt(m[2], 10);
      var mm = parseInt(m[3], 10);
      if (mm === 0) return sign + h + 'h';
      return sign + h + ':' + (mm < 10 ? '0' + mm : mm) + 'h';
    }

    // Lazy load: DST (year strip + history)
    function loadDst() {
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
