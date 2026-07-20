#!/usr/bin/env node
/* Generate per-country time zone pages
 * URL: /time-zones/in/{country-code}/
 * Pattern: Home / Time Zones / Time Zones in [Country]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const API = process.env.API || 'https://dev.api.dateandtime.live';
const TOP_COUNTRIES = [
  'US', 'GB', 'IN', 'CA', 'AU', 'DE', 'FR', 'JP', 'CN', 'BR',
  'RU', 'IT', 'ES', 'MX', 'KR', 'ID', 'TR', 'SA', 'ZA', 'AR',
  'EG', 'NG', 'PK', 'BD', 'PH', 'TH', 'VN', 'MY', 'SG', 'HK',
  'TW', 'NZ', 'IE', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK',
  'FI', 'PL', 'CZ', 'GR', 'PT', 'IL', 'AE', 'QA', 'KW', 'CL',
  'CO', 'PE', 'VE', 'CR', 'PA', 'DO', 'JM', 'BS', 'IS', 'LU',
  'MT', 'CY', 'EE', 'LV', 'LT', 'UA', 'BY', 'RO', 'BG', 'HR',
  'RS', 'SI', 'SK', 'HU', 'GE', 'AM', 'AZ', 'KZ', 'UZ', 'TM',
  'KG', 'TJ', 'AF', 'IR', 'IQ', 'JO', 'LB', 'SY', 'YE', 'OM',
  'BH', 'MM', 'KH', 'LA', 'BN', 'MN', 'NP', 'BT', 'LK', 'MV',
  'MA', 'DZ', 'TN', 'LY', 'SD', 'ET', 'KE', 'TZ', 'UG', 'GH',
  'SN', 'CI', 'CM', 'AO', 'MZ', 'ZW', 'ZM', 'BW', 'NA', 'MG',
  'MU', 'RE', 'TT', 'BB', 'JM', 'BS', 'CU', 'HT', 'DO', 'PR',
  'GT', 'HN', 'SV', 'NI', 'BZ', 'MX', 'PA', 'CO', 'VE', 'EC',
  'BO', 'PY', 'UY', 'GF', 'SR', 'GY', 'FK', 'GS'
];

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    https.get(API + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error for ${path}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const cca2ToFlag = (cca2) => {
  // Convert ISO 3166-1 alpha-2 to flag emoji using regional indicator symbols
  if (!cca2 || cca2.length !== 2) return '🌐';
  const codePoints = cca2.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

function headerHtml(activePath) {
  return `<header class="site-header">
  <div class="container header-row">
    <a href="/" class="logo" aria-label="dateandtime.live home">
      <span class="logo-mark">T</span>
      <span class="logo-text">dateandtime.live</span>
    </a>
    <nav class="nav-main" aria-label="Main">
      <a href="#" class="nav-link" title="Today page — coming soon"><span class="now-dot" aria-hidden="true"></span>Today</a>
      <a href="/holidays/" class="nav-link">Holidays</a>
      <a href="/onthisday/" class="nav-link">On this day</a>
      <a href="/world-time/meeting/" class="nav-link">Meeting finder</a>
      <div class="nav-item has-dropdown">
        <button class="nav-link nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false">
          <span class="nav-icon" aria-hidden="true">\uD83D\uDD50</span>World time
          <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="nav-dropdown" role="menu">
          <a href="/world-time/" class="dropdown-item" role="menuitem"><span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">\uD83D\uDD50</span>The World Clock</span><span class="dropdown-desc">Live current time in 33,945 cities</span></a>
          <a href="/world-time/meeting/" class="dropdown-item" role="menuitem"><span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">\uD83D\uDCC5</span>Meeting Planner</span><span class="dropdown-desc">Find meeting times across time zones</span></a>
          <a href="/world-time/event/" class="dropdown-item" role="menuitem"><span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">\uD83D\uDCE3</span>Event Time Announcer</span><span class="dropdown-desc">Show local times for a global event</span></a>
        </div>
      </div>
      <div class="nav-item has-dropdown">
        <button class="nav-link nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false">
          <span class="nav-icon" aria-hidden="true">\uD83C\uDF10</span>Timezone
          <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="nav-dropdown" role="menu">
          <a href="/time-zones/" class="dropdown-item" role="menuitem"><span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">\uD83C\uDF10</span>Time Zones</span><span class="dropdown-desc">Browse all 408 time zones</span></a>
          <a href="/time-zones/converter/" class="dropdown-item" role="menuitem"><span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">\uD83D\uDD04</span>Time Zone Converter</span><span class="dropdown-desc">Time difference calculator</span></a>
          <a href="/time-zones/in/" class="dropdown-item ${activePath === '/time-zones/in/' ? 'is-active' : ''}" role="menuitem" ${activePath === '/time-zones/in/' ? 'aria-current="page"' : ''}><span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">\uD83D\uDDFA\uFE0F</span>Time Zones in [Country]</span><span class="dropdown-desc">All countries and their zones</span></a>
          <div class="dropdown-divider"></div>
          <div class="dropdown-section-label">Learn</div>
          <a href="/time-zones/what-is/" class="dropdown-item" role="menuitem"><span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">\uD83D\uDCA1</span>What is a Time Zone?</span><span class="dropdown-desc">UTC, offsets, and the prime meridian</span></a>
          <a href="/time-zones/dst/" class="dropdown-item" role="menuitem"><span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">\u23F0</span>Daylight Saving Time</span><span class="dropdown-desc">Spring forward, fall back</span></a>
          <a href="/time-zones/utc/" class="dropdown-item" role="menuitem"><span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">\uD83D\uDEF0\uFE0F</span>UTC &amp; GMT</span><span class="dropdown-desc">The world's time standard</span></a>
        </div>
      </div>
      <a href="#" class="nav-link">Blog</a>
    </nav>
    <div class="header-actions">
      <div class="theme-toggle" role="group" aria-label="Theme">
        <button data-theme-btn="light" aria-pressed="true" aria-label="Light mode" title="Light mode">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>
        <button data-theme-btn="dark" aria-pressed="false" aria-label="Dark mode" title="Dark mode">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
      <button class="nav-toggle" data-nav-toggle aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">
        <span class="nav-toggle-icon" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </button>
    </div>
  </div>
</header>`;
}

function mobileNavHtml(countryName, cca2Lower) {
  return `<aside class="mobile-nav" id="mobile-nav" data-mobile-nav aria-label="Mobile navigation" hidden>
  <div class="mobile-nav-header">
    <a href="/" class="mobile-nav-logo" aria-label="dateandtime.live home">
      <span class="logo-mark">T</span>
      <span class="logo-text">dateandtime.live</span>
    </a>
    <button class="mobile-nav-close" data-nav-close aria-label="Close menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <nav class="mobile-nav-list" aria-label="Mobile main">
    <a href="#" class="mobile-nav-link" title="Today page — coming soon"><span class="now-dot" aria-hidden="true"></span>Today</a>
    <a href="/holidays/" class="mobile-nav-link">Holidays</a>
    <a href="/onthisday/" class="mobile-nav-link">On this day</a>
    <a href="/world-time/meeting/" class="mobile-nav-link">Meeting finder</a>
    <div class="mobile-nav-section">World time</div>
    <a href="/world-time/" class="mobile-nav-link mobile-nav-sub">The World Clock</a>
    <a href="/world-time/meeting/" class="mobile-nav-link mobile-nav-sub">Meeting Planner</a>
    <div class="mobile-nav-section">Timezone</div>
    <a href="/time-zones/" class="mobile-nav-link mobile-nav-sub">Time Zones</a>
    <a href="/time-zones/converter/" class="mobile-nav-link mobile-nav-sub">Time Zone Converter</a>
    <a href="/time-zones/in/${cca2Lower || ''}/" class="mobile-nav-link mobile-nav-sub is-active" aria-current="page">Time Zones in ${countryName || '[Country]'}</a>
    <a href="/time-zones/what-is/" class="mobile-nav-link mobile-nav-sub">What is a Time Zone?</a>
    <a href="/time-zones/dst/" class="mobile-nav-link mobile-nav-sub">Daylight Saving Time</a>
    <a href="/time-zones/utc/" class="mobile-nav-link mobile-nav-sub">UTC &amp; GMT</a>
    <a href="#" class="mobile-nav-link">Blog</a>
  </nav>
</aside>
<div class="mobile-nav-backdrop" data-nav-backdrop hidden></div>`;
}

function generatePage(country, cities, timezones) {
  const tzList = timezones.map(tz => `
    <tr>
      <td><code>${tz.iana}</code></td>
      <td><strong>${tz.currentAbbreviation}</strong></td>
      <td><code>${tz.currentOffset}</code></td>
      <td>${tz.isDst ? '✓ Yes' : '— No'}</td>
    </tr>
  `).join('');

  // Pick top 10 cities by population
  const topCities = cities
    .filter(c => c.population && c.population > 0)
    .sort((a, b) => (b.population || 0) - (a.population || 0))
    .slice(0, 10);

  // Capital city
  const capital = cities.find(c => c.isCapital) || cities[0];
  const capitalPop = capital?.population ? capital.population.toLocaleString() : '—';
  const totalPop = cities.reduce((sum, c) => sum + (c.population || 0), 0).toLocaleString();

  // Current time in capital (server-side at build time, client refreshes)
  const now = new Date();
  let capTime = '—';
  let capOffset = '';
  if (capital) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: capital.timezone, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
      capTime = fmt.format(now);
      const off = timezones.find(t => t.iana === capital.timezone);
      if (off) capOffset = off.currentOffset;
    } catch (e) {}
  }

  const langNames = (country.languages || []).map(l => l.name).join(', ') || '—';
  const continent = country.continent || '—';
  const unRegion = country.unRegion || '—';
  const area = country.areaKm2 ? country.areaKm2.toLocaleString() + ' km²' : '—';
  const capitalName = country.capital || '—';
  const officialName = country.officialName || country.name;
  const cca2 = country.code;
  const cca3 = country.cca3 || '—';
  const phone = country.phoneCode || '—';
  const currency = (country.currencies || []).map(c => `${c.name} (${c.symbol || c.code})`).join(', ') || '—';
  const unMember = country.unMember ? 'Yes' : 'No';
  const landlocked = country.landlocked ? 'Yes' : 'No';
  const independent = country.independent ? 'Yes' : 'No';

  const flag = cca2ToFlag(cca2);
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Time Zones in ${country.name} ${new Date().getFullYear()} \u2014 Current Time & DST | dateandtime.live</title>
  <meta name="description" content="Complete guide to time zones in ${country.name}. ${timezones.length} time zone${timezones.length !== 1 ? 's' : ''} used, current time in ${capitalName}, DST rules, and live clock for major cities. ${cities.length} cities tracked." />
  <meta name="theme-color" content="#5b4aaf" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="canonical" href="https://dateandtime.live/time-zones/in/${cca2.toLowerCase()}/" />
  <meta property="og:title" content="Time Zones in ${country.name}" />
  <meta property="og:description" content="${timezones.length} time zone${timezones.length !== 1 ? 's' : ''} used in ${country.name}. Current time in ${capitalName} and all major cities." />
  <meta property="og:url" content="https://dateandtime.live/time-zones/in/${cca2.toLowerCase()}/" />
  <meta property="og:type" content="article" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/src/site-shell.css" />
  <link rel="stylesheet" href="/src/tz-hub.css" />
  <link rel="stylesheet" href="/src/edu-page.css" />
  <link rel="stylesheet" href="/src/country-page.css" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Time Zones in ${country.name}",
    "description": "Complete guide to time zones in ${country.name}. Current time, DST rules, and live clock for major cities.",
    "author": { "@type": "Organization", "name": "dateandtime.live" },
    "publisher": { "@type": "Organization", "name": "dateandtime.live" },
    "datePublished": "${new Date().toISOString().slice(0, 10)}",
    "dateModified": "${new Date().toISOString().slice(0, 10)}",
    "mainEntityOfPage": "https://dateandtime.live/time-zones/in/${cca2.toLowerCase()}/"
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://dateandtime.live/" },
      { "@type": "ListItem", "position": 2, "name": "Time Zones", "item": "https://dateandtime.live/time-zones/" },
      { "@type": "ListItem", "position": 3, "name": "Time Zones in ${country.name}", "item": "https://dateandtime.live/time-zones/in/${cca2.toLowerCase()}/" }
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      { "@type": "Question", "name": "How many time zones does ${country.name} have?", "acceptedAnswer": { "@type": "Answer", "text": "${country.name} uses ${timezones.length} time zone${timezones.length !== 1 ? 's' : ''}: ${timezones.map(t => t.iana).join(', ')}. The primary time zone is ${timezones[0]?.iana || '—'} (${timezones[0]?.currentAbbreviation || ''}, ${timezones[0]?.currentOffset || ''})." } },
      { "@type": "Question", "name": "What is the current time in ${capitalName}?", "acceptedAnswer": { "@type": "Answer", "text": "The current time in ${capitalName}, the capital of ${country.name}, is approximately ${capTime} (${capOffset}). ${capitalName} is in the ${timezones[0]?.iana || ''} time zone." } },
      { "@type": "Question", "name": "Does ${country.name} observe Daylight Saving Time (DST)?", "acceptedAnswer": { "@type": "Answer", "text": "${timezones.some(t => t.isDst) ? 'Yes, parts of ' + country.name + ' observe DST. Check the time zones table below for which zones currently have DST active.' : 'No, ' + country.name + ' does not observe Daylight Saving Time. The country stays on a single UTC offset year-round.'}" } }
    ]
  }
  </script>
  <script src="/src/site-shell.js" defer></script>
  <script src="/src/country-clock.js" defer></script>
</head>
<body class="shell-page">
${headerHtml('/time-zones/in/' + cca2.toLowerCase() + '/')}

<nav class="breadcrumb" aria-label="Breadcrumb">
  <div class="container">
    <a href="/">Home</a>
    <span class="bc-sep" aria-hidden="true">/</span>
    <a href="/time-zones/">Time Zones</a>
    <span class="bc-sep" aria-hidden="true">/</span>
    <span aria-current="page">Time Zones in ${country.name}</span>
  </div>
</nav>

<main class="tz-hub edu-page country-page">
  <article class="container">
    <header class="edu-header country-header">
      <p class="edu-eyebrow"><span class="country-flag" aria-hidden="true">${flag}</span> ${continent} \u00B7 ${unRegion}</p>
      <h1>Time Zones in ${country.name}</h1>
      <p class="edu-subtitle">${timezones.length} time zone${timezones.length !== 1 ? 's' : ''} used across ${cities.length} cities. Current time in <strong>${capitalName}</strong> is <strong data-live-tz="${capital?.timezone}" class="live-cap-time">${capTime}</strong> (${capOffset}).</p>
      <div class="country-quick-stats">
        <div class="stat"><span class="stat-label">Capital</span><span class="stat-value">${capitalName}</span></div>
        <div class="stat"><span class="stat-label">Population</span><span class="stat-value">${totalPop}</span></div>
        <div class="stat"><span class="stat-label">Area</span><span class="stat-value">${area}</span></div>
        <div class="stat"><span class="stat-label">Time zones</span><span class="stat-value">${timezones.length}</span></div>
      </div>
    </header>

    <div class="edu-content">
      <h2>Current time in major cities</h2>
      <p>Live local time, updated every second. The list is sorted by population.</p>
      <div class="country-clock-grid" data-country-code="${cca2}">
        ${topCities.map(c => `
          <div class="country-clock-card" data-tz="${c.timezone}">
            <div class="country-clock-name">${c.name}${c.isCapital ? ' <span class="capital-badge">Capital</span>' : ''}</div>
            <div class="country-clock-time-row">
              <span class="live-dot"></span>
              <span class="country-clock-time" data-clock-tz="${c.timezone}">--:--:--</span>
              <span class="country-clock-period" data-period-tz="${c.timezone}"></span>
            </div>
            <div class="country-clock-meta">
              <span data-date-tz="${c.timezone}">--</span>
              <span class="country-clock-offset" data-offset-tz="${c.timezone}"></span>
            </div>
            ${c.population ? `<div class="country-clock-pop">Pop. ${c.population.toLocaleString()}</div>` : ''}
          </div>
        `).join('')}
      </div>

      <h2>Time zones used in ${country.name}</h2>
      <p>${country.name} officially uses ${timezones.length} time zone${timezones.length !== 1 ? 's' : ''}. Each IANA zone tracks the full history of DST rules for that region.</p>
      <div class="edu-table-wrap">
        <table class="edu-table">
          <thead>
            <tr><th>IANA Identifier</th><th>Abbreviation</th><th>UTC Offset</th><th>DST Active</th></tr>
          </thead>
          <tbody>
            ${tzList}
          </tbody>
        </table>
      </div>

      <h2>About ${country.name}</h2>
      <p><strong>${officialName}</strong>${country.independent ? '' : ' (a dependent territory)'} is located in ${continent} (${unRegion}). The country spans ${area} and has a population of approximately ${totalPop} across ${cities.length} tracked cities.</p>
      <ul>
        <li><strong>Country codes:</strong> ${cca2} (ISO 3166-1 alpha-2), ${cca3} (alpha-3)</li>
        <li><strong>Capital:</strong> ${capitalName}</li>
        <li><strong>Phone code:</strong> ${phone}</li>
        <li><strong>Currency:</strong> ${currency}</li>
        <li><strong>Languages:</strong> ${langNames}</li>
        <li><strong>UN member:</strong> ${unMember}</li>
        <li><strong>Landlocked:</strong> ${landlocked}</li>
      </ul>

      <h2>Convert time from ${country.name}</h2>
      <p>Use our <a href="/time-zones/converter/"><strong>Time Zone Converter</strong></a> to calculate the exact time difference between ${capitalName} and any other city or time zone worldwide. The converter handles DST automatically and supports any date in the past or future.</p>
      <p>Or open the <a href="/world-time/meeting/"><strong>Meeting Planner</strong></a> to drag-select a time slot and see the local time in ${capitalName} alongside any other cities you add.</p>

      <h2>Browse all time zones in ${country.name}</h2>
      <p>Looking for a specific city? The full list of ${cities.length} cities in ${country.name} is available via our <a href="/world-time/meeting/?cities=">Meeting Planner</a> — search by city name, or browse the time zones table above to find a city's IANA identifier.</p>
    </div>

    <section class="tz-faq edu-faq">
      <h2>Frequently Asked Questions</h2>
      <div class="tz-faq-list">
        <details>
          <summary>How many time zones does ${country.name} have?</summary>
          <p>${country.name} uses ${timezones.length} time zone${timezones.length !== 1 ? 's' : ''}: ${timezones.map(t => t.iana).join(', ')}. The primary time zone is ${timezones[0]?.iana || '—'} (${timezones[0]?.currentAbbreviation || ''}, ${timezones[0]?.currentOffset || ''}).</p>
        </details>
        <details>
          <summary>What is the current time in ${capitalName}?</summary>
          <p>The current time in ${capitalName}, the capital of ${country.name}, is approximately <strong>${capTime}</strong> (${capOffset}). ${capitalName} is in the ${timezones[0]?.iana || ''} time zone. Use our <a href="/world-time/meeting/?cities=">live world clock</a> to see the current time in any city.</p>
        </details>
        <details>
          <summary>Does ${country.name} observe Daylight Saving Time (DST)?</summary>
          <p>${timezones.some(t => t.isDst) ? 'Parts of ' + country.name + ' observe DST. The current DST status for each zone is shown in the time zones table above. Read our <a href="/time-zones/dst/">DST guide</a> for details on how clock changes work.' : 'No, ' + country.name + ' does not observe Daylight Saving Time. The country stays on a single UTC offset year-round.'}</p>
        </details>
      </div>
    </section>

    <aside class="wt-related">
      <h2>Related Time Zone Tools</h2>
      <div class="wt-related-grid">
        <a href="/time-zones/converter/?cities=" class="wt-related-card"><span class="wt-related-icon" aria-hidden="true">\uD83D\uDD04</span><span class="wt-related-title">Time Zone Converter</span><span class="wt-related-desc">Convert ${capitalName} time to any other city</span></a>
        <a href="/world-time/meeting/?cities=" class="wt-related-card"><span class="wt-related-icon" aria-hidden="true">\uD83D\uDCC5</span><span class="wt-related-title">Meeting Planner</span><span class="wt-related-desc">Plan meetings across ${country.name} and beyond</span></a>
        <a href="/time-zones/dst/" class="wt-related-card"><span class="wt-related-icon" aria-hidden="true">\u23F0</span><span class="wt-related-title">Daylight Saving Time</span><span class="wt-related-desc">DST rules and 2026 dates by country</span></a>
        <a href="/time-zones/" class="wt-related-card"><span class="wt-related-icon" aria-hidden="true">\uD83C\uDF10</span><span class="wt-related-title">All Time Zones</span><span class="wt-related-desc">Browse all 408 time zones worldwide</span></a>
      </div>
    </aside>
  </article>
</main>

<footer class="page-footer">
  <div class="container">
    <p class="page-footer-meta">\u00A9 ${new Date().getFullYear()} dateandtime.live \u00B7 33,945 cities \u00B7 408 time zones \u00B7 1,600+ holidays \u00B7 Data: <a href="https://www.iana.org/time-zones" rel="noopener">IANA</a> \u00B7 <a href="https://www.geonames.org/" rel="noopener">GeoNames</a> \u00B7 <a href="https://date.nager.at/" rel="noopener">Nager.Date</a> \u00B7 <a href="https://www.wikipedia.org/" rel="noopener">Wikipedia</a></p>
    <p class="page-footer-meta"><a href="#" data-action="do-not-sell">Do Not Sell or Share My Personal Information</a> (CCPA)</p>
  </div>
</footer>

${mobileNavHtml(country.name, cca2.toLowerCase())}
</body>
</html>
`;
}

async function buildCountry(cca2) {
  try {
    console.log(`Building ${cca2}...`);
    const [countryRes, citiesRes] = await Promise.all([
      fetchJson(`/api/v1/countries/${cca2}`),
      fetchJson(`/api/v1/cities?country=${cca2}&limit=10000`)
    ]);
    if (!countryRes.success || !citiesRes.success) {
      console.log(`  \u26A0\uFE0F Skipping ${cca2}: API error`);
      return false;
    }
    const country = countryRes.data.country || countryRes.data;
    const cities = citiesRes.data.cities || [];
    // Get timezones for these cities
    const tzSet = new Set();
    cities.forEach(c => { if (c.timezone) tzSet.add(c.timezone); });
    const tzs = [];
    for (const iana of tzSet) {
      try {
        const tzRes = await fetchJson(`/api/v1/timezones/${encodeURIComponent(iana)}`);
        if (tzRes.success && tzRes.data && tzRes.data.timezone) {
          tzs.push(tzRes.data.timezone);
        }
      } catch (e) { /* skip */ }
    }
    tzs.sort((a, b) => a.iana.localeCompare(b.iana));

    const html = generatePage(country, cities, tzs);
    const dir = path.join(__dirname, '..', 'time-zones', 'in', cca2.toLowerCase());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    console.log(`  \u2713 ${cca2} (${country.name}): ${cities.length} cities, ${tzs.length} time zones`);
    return true;
  } catch (e) {
    console.log(`  \u2717 ${cca2}: ${e.message}`);
    return false;
  }
}

async function main() {
  let success = 0;
  let failed = 0;
  // Process in batches of 10 to avoid overwhelming the API
  for (let i = 0; i < TOP_COUNTRIES.length; i += 10) {
    const batch = TOP_COUNTRIES.slice(i, i + 10);
    const results = await Promise.all(batch.map(buildCountry));
    results.forEach(r => r ? success++ : failed++);
    // Small delay between batches
    if (i + 10 < TOP_COUNTRIES.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log(`\nDone: ${success} succeeded, ${failed} failed, ${TOP_COUNTRIES.length} total`);
}

main().catch(e => { console.error(e); process.exit(1); });
