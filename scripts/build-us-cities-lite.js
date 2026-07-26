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

// Pre-compute the big-cities pool (pop >= 50K) once — used for "More to explore"
const bigCitiesPool = buildList
  .filter(x => x.population >= 50000)
  .sort((a, b) => b.population - a.population);
const bigUSPool = buildList
  .filter(x => x.population >= 500000)
  .sort((a, b) => b.population - a.population);
console.log(`Big cities pool (>=50K): ${bigCitiesPool.length}, major cities (>=500K): ${bigUSPool.length}`);

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
  const canonicalUrl = `https://dateandtime.live/world-time/united-states/${c.slug}/`;

  // Build a list of big US cities as "more to explore" cross-links (top 6 by pop)
  const moreToExplore = bigUSPool.slice(0, 6).map(x => ({
    name: x.name,
    slug: x.slug,
    pop: x.population,
    state: x.stateCode
  }));

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
<link rel="stylesheet" href="/src/site-shell.css" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Place","name":"${c.name}","address":{"@type":"PostalAddress","addressRegion":"${c.stateCode}","addressCountry":"US"},"geo":{"@type":"GeoCoordinates","latitude":${c.latitude},"longitude":${c.longitude}},"timeZone":"${c.timezone}","url":"${canonicalUrl}","population":{"@type":"QuantitativeValue","value":${c.population}}}</script>
</head>
<body class="shell-page">
  <header class="site-header">
    <div class="container header-row">
      <a href="/" class="logo" aria-label="dateandtime.live home">
        <span class="logo-mark">T</span>
        <span class="logo-text"><span class="logo-text-domain">dateandtime</span><span class="logo-text-tld">.live</span></span>
      </a>
      <nav class="nav-main" aria-label="Main">
        <a href="/" class="nav-link"><span class="now-dot" aria-hidden="true"></span>Today</a>
        <a href="/holidays/" class="nav-link">Holidays</a>
        <a href="/onthisday/" class="nav-link">On this day</a>
        <a href="/world-time/meeting/" class="nav-link">Meeting</a>
        <a href="/world-time/" class="nav-link active">World time</a>
      </nav>
      <div class="header-actions">
        <button class="theme-toggle" data-theme-btn="light" aria-label="Light mode" aria-pressed="true">☀️</button>
        <button class="theme-toggle" data-theme-btn="dark" aria-label="Dark mode" aria-pressed="false">🌙</button>
      </div>
    </div>
  </header>

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

    <!-- Sun times -->
    <section class="city-section">
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

    <!-- 7-day weather -->
    <section class="city-section">
      <h2>🌤 7-day weather forecast — ${c.name}</h2>
      <div class="weather-grid" id="weatherGrid" data-lat="${c.latitude}" data-lon="${c.longitude}" data-tz="${c.timezone}">
        <p class="city-page-loading">Loading 7-day forecast…</p>
      </div>
      <p class="weather-source">Forecast data: <a href="https://open-meteo.com/" rel="noopener" target="_blank">Open-Meteo</a> (CC BY 4.0)</p>
    </section>

    <!-- Climate year-round -->
    <section class="city-section">
      <h2>🌡 ${c.name} climate year-round</h2>
      <div class="climate-chart" id="climateChart" data-climate='${climateStr}'></div>
      <p class="climate-note">Estimated from latitude (${c.latitude.toFixed(2)}°${c.latitude >= 0 ? 'N' : 'S'}). Actual values vary by elevation, ocean currents, and local geography.</p>
    </section>

    <!-- More US cities -->
    <section class="city-section">
      <h2>🏙 More to explore</h2>
      <div class="explore-grid">
${moreToExplore.map(x => `        <a href="/world-time/united-states/${x.slug}/" class="explore-link">
          <span class="label">${x.name}</span>
          <span class="meta">${x.state} · ${formatPop(x.pop)}</span>
        </a>`).join('\n')}
      </div>
    </section>

    <!-- Cross-links to relevant tools -->
    <section class="city-section">
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
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>dateandtime.live — Current time in ${c.name}, ${stateName}, United States (${c.timezone})</p>
      <p>Data: GeoNames (CC BY 4.0) · Open-Meteo (CC BY 4.0) · IANA Time Zone Database</p>
      <p><a href="/about/">About</a> · <a href="/editorial-policy/">Editorial Policy</a> · <a href="/contact/">Contact</a></p>
    </div>
  </footer>

  <script src="/src/site-shell.js" defer></script>
  <script>
  // Live clock for the city — uses Intl.DateTimeFormat with the city's IANA tz
  (function() {
    var hero = document.querySelector('.city-hero');
    var clock = document.getElementById('cityClock');
    var dateEl = document.getElementById('cityDate');
    var offsetEl = document.getElementById('utcOffset');
    var dstEl = document.getElementById('dstStatus');
    if (!hero || !clock) return;
    var tz = hero.getAttribute('data-tz');
    var lat = parseFloat(hero.getAttribute('data-lat'));
    var lon = parseFloat(hero.getAttribute('data-lon'));

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
        if (jOff === lOff) {
          dstEl.textContent = 'No DST';
        } else {
          dstEl.textContent = 'DST observed';
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
</body>
</html>`;

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
