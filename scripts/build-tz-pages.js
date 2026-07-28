#!/usr/bin/env node
/**
 * Build static pages for the 11 US time zone abbreviations (EST, EDT, CST, CDT,
 * MST, MDT, PST, PDT, AKST, AKDT, HST).
 *
 * Reads:
 *   - content/time-zones/{abbr}.md (markdown with frontmatter + body)
 *   - data/tz-abbr-map.json (abbreviation → IANA + cities + states)
 *   - /api/v1/dst/upcoming?tz={iana} (live DST history for the year strip)
 *
 * Outputs:
 *   - time/zones/{abbr}/index.html (one per abbreviation)
 *
 * Each page is a long-form article (~800-1200 words) + 5-6 live data widgets:
 *   - Hero (live clock + offset + DST badge)
 *   - "Major cities" (top 5-10 with live clocks)
 *   - DST year strip (12 cells colored by current abbreviation)
 *   - DST change history (next 5 + past 5)
 *   - "Compare to other zones" (5 quick links)
 *   - FAQ (4-5 questions for JSON-LD)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content/time-zones');
const DATA_FILE = path.join(ROOT, 'data/tz-abbr-map.json');
const OUT_DIR = path.join(ROOT, 'time/zones');

const API_BASE = 'https://datetime-api-dev.nsura2029.workers.dev';

// ---- Load abbreviation map ----
const tzMap = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const abbrs = tzMap.abbrs;

// ---- Helpers ----
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function parseFrontmatter(md) {
  // Match: ---\nkey: value\n---\n
  const match = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('No frontmatter found');
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { frontmatter: fm, body: match[2] };
}

function markdownToHtml(md) {
  // Very simple Markdown parser (no external dep). Handles:
  //   # H1 (only one expected, in body)
  //   ## H2
  //   ### H3
  //   **bold**
  //   [text](url)
  //   - list items
  //   tables (| col | col |)
  //   blank line = paragraph break
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let inTable = false;
  let tableRows = [];
  let para = [];

  function flushPara() {
    if (para.length === 0) return;
    const text = para.join(' ').trim();
    if (text) {
      html += `<p>${formatInline(text)}</p>\n`;
    }
    para = [];
  }
  function flushList() {
    if (inList) {
      html += '</ul>\n';
      inList = false;
    }
  }
  function flushTable() {
    if (inTable && tableRows.length) {
      const header = tableRows[0];
      const rows = tableRows.slice(2); // skip separator row
      html += '<table class="tz-table">\n<thead><tr>';
      header.forEach(c => html += `<th>${c.trim()}</th>`);
      html += '</tr></thead>\n<tbody>';
      rows.forEach(row => {
        html += '<tr>';
        row.forEach(c => html += `<td>${formatInline(c.trim())}</td>`);
        html += '</tr>';
      });
      html += '</tbody></table>\n';
      tableRows = [];
      inTable = false;
    }
  }
  function formatInline(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
        if (u.startsWith('http')) return `<a href="${u}" rel="noopener">${t}</a>`;
        return `<a href="${u}">${t}</a>`;
      });
  }

  for (const line of lines) {
    if (line.startsWith('# ')) {
      flushPara(); flushList(); flushTable();
      // h1 already in title, skip in body
      continue;
    } else if (line.startsWith('## ')) {
      flushPara(); flushList(); flushTable();
      html += `<h2>${formatInline(line.slice(3))}</h2>\n`;
    } else if (line.startsWith('### ')) {
      flushPara(); flushList(); flushTable();
      html += `<h3>${formatInline(line.slice(4))}</h3>\n`;
    } else if (line.startsWith('| ')) {
      flushPara(); flushList();
      const cells = line.split('|').slice(1, -1);
      if (!inTable) inTable = true;
      tableRows.push(cells);
    } else if (line.startsWith('- ')) {
      flushPara(); flushTable();
      if (!inList) { html += '<ul>\n'; inList = true; }
      html += `<li>${formatInline(line.slice(2))}</li>\n`;
    } else if (line.trim() === '') {
      flushPara(); flushList(); flushTable();
    } else {
      flushList(); flushTable();
      para.push(line);
    }
  }
  flushPara(); flushList(); flushTable();
  return html;
}

// ---- Build page template ----
function buildPage({ abbr, data, bodyHtml, dstHistory, sunData }) {
  const isDst = data.isDst;
  const observesDst = data.observesDst;
  const iana = data.iana;
  const color = data.color;
  const offset = data.offset;
  const majorCities = data.majorCities;
  const related = tzMap.related[abbr] || [];

  // FAQ items for JSON-LD
  const faqRegex = /\*\*Q:\s*([^*]+)\?\*\*\s*\n\s*A:\s*([^\n]+(?:\n(?!\*\*Q)[^\n]+)*)/g;
  const faqs = [];
  let m;
  while ((m = faqRegex.exec(bodyHtml)) !== null) {
    faqs.push({
      question: m[1].trim(),
      answer: m[2].replace(/<[^>]+>/g, '').trim()
    });
  }

  // DST year strip
  const yearStrip = buildYearStrip(dstHistory, abbr);

  // DST change history
  const dstChangesHtml = buildDstChanges(dstHistory, abbr);

  // Major cities with live clocks
  const citiesHtml = majorCities.map(city => `
    <div class="tz-city-card">
      <div class="tz-city-name">
        <a href="/world-time/united-states/${city.slug}/">${escapeHtml(city.name)}</a>
        <span class="tz-city-state">${escapeHtml(city.state)}</span>
      </div>
      <div class="tz-city-clock mono" data-iana="${iana}" data-label="${escapeAttr(city.name)}">--:--:--</div>
      <div class="tz-city-meta">${city.population.toLocaleString()} people</div>
    </div>
  `).join('');

  // Related zones
  const relatedHtml = related.filter(r => r !== abbr && abbrs[r]).map(r => {
    const rd = abbrs[r];
    return `<a class="tz-related-pill tz-related-pill--${rd.color}" href="/time/zones/${r.toLowerCase()}/">
      <strong>${r}</strong>
      <span>${rd.offset} · ${rd.name.replace(/ Standard| Daylight/g, '')}</span>
    </a>`;
  }).join('');

  // Build HTML
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(data.longName)} (${abbr}) — ${escapeHtml(offset)} · dateandtime.live</title>
<meta name="description" content="${escapeHtml(data.summary)}" />
<meta name="theme-color" content="#5b4aaf" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="canonical" href="https://dateandtime.live/time/zones/${abbr.toLowerCase()}/" />
<meta property="og:title" content="${escapeHtml(data.longName)} (${abbr}) — ${escapeHtml(offset)}" />
<meta property="og:description" content="${escapeHtml(data.summary)}" />
<meta property="og:url" content="https://dateandtime.live/time/zones/${abbr.toLowerCase()}/" />
<meta property="og:type" content="og:type" />

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/src/site-shell.css?v=3" />
<link rel="stylesheet" href="/src/tz-hub.css?v=23" />

<style>
.tz-page { max-width: 1240px; margin: 0 auto; padding: 0 1.5rem 4rem; }
.tz-page-hero {
  text-align: center;
  padding: 3rem 1.5rem 2.5rem;
  background: var(--tz-bg);
  border-bottom: 1px solid var(--tz-border-soft);
  margin-bottom: 2.5rem;
}
.tz-page-hero .tz-page-eyebrow {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  background: var(--tz-primary-soft);
  color: var(--tz-primary);
  margin-bottom: 0.5rem;
}
.tz-page-hero h1 {
  font-size: clamp(2.5rem, 1.5rem + 3vw, 4rem);
  font-weight: 800;
  letter-spacing: -0.025em;
  margin: 0.5rem 0;
  color: var(--tz-fg);
}
.tz-page-hero .tz-page-iana {
  color: var(--tz-fg-soft);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9375rem;
  margin: 0.25rem 0 1.5rem;
}
.tz-page-clock {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: var(--tz-primary-soft);
  border: 1px solid color-mix(in srgb, var(--tz-primary) 25%, transparent);
  border-radius: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--tz-primary);
}
.tz-page-clock .ampm {
  font-size: 1rem;
  color: var(--tz-primary-soft);
  font-weight: 700;
  background: var(--tz-primary);
  padding: 0.125rem 0.5rem;
  border-radius: 6px;
  margin-left: 0.5rem;
}
.tz-page-meta {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1.25rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
  color: var(--tz-fg-soft);
}
.tz-page-meta .pill {
  background: var(--tz-primary-soft);
  color: var(--tz-primary);
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-weight: 600;
}
.tz-page-meta .pill.dst-yes { background: var(--tz-secondary-soft, #fff3d9); color: #b08a18; }
.tz-page-meta .pill.dst-no { background: #fdecec; color: #b22b2b; }

.tz-section { padding: 2.5rem 0; border-bottom: 1px solid var(--tz-border-soft); }
.tz-section:last-child { border-bottom: 0; }
.tz-section-header {
  text-align: center;
  margin-bottom: 1.5rem;
  max-width: 56rem;
  margin-left: auto;
  margin-right: auto;
}
.tz-section-header h2 {
  font-size: clamp(1.5rem, 1.2rem + 1vw, 1.875rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 0.5rem;
  color: var(--tz-fg);
}
.tz-section-header p {
  color: var(--tz-fg-soft);
  margin: 0;
}

.tz-body {
  max-width: 760px;
  margin: 0 auto;
}
.tz-body h2 {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.015em;
  margin: 2.5rem 0 0.75rem;
  color: var(--tz-fg);
}
.tz-body p { margin: 0 0 1rem; line-height: 1.7; }
.tz-body strong { color: var(--tz-fg); font-weight: 700; }
.tz-body ul { padding-left: 1.5rem; }
.tz-body li { margin-bottom: 0.5rem; line-height: 1.6; }
.tz-body a { color: var(--tz-primary); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }

.tz-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.875rem;
}
.tz-table th, .tz-table td {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--tz-border-soft);
  text-align: left;
}
.tz-table th { background: var(--tz-primary-soft); font-weight: 700; }
.tz-table tr:nth-child(even) { background: var(--tz-bg-soft); }

.tz-year-strip {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 2px;
  background: var(--tz-border-soft);
  border-radius: 8px;
  overflow: hidden;
  margin: 0.5rem 0 1rem;
}
.tz-year-cell {
  padding: 0.5rem 0.25rem;
  text-align: center;
  font-size: 0.6875rem;
  background: var(--tz-bg);
  color: var(--tz-fg-soft);
  position: relative;
}
.tz-year-cell.standard { background: color-mix(in srgb, var(--tz-primary) 12%, white); color: var(--tz-primary); font-weight: 700; }
.tz-year-cell.daylight { background: #fff3d9; color: #b08a18; font-weight: 700; }
.tz-year-cell.no-dst { background: var(--tz-bg-soft); }
.tz-year-cell .month { display: block; font-size: 0.625rem; }
.tz-year-cell .abbr { display: block; font-weight: 800; font-size: 0.75rem; }
.tz-year-cell .offset { display: block; font-size: 0.625rem; opacity: 0.7; }
.tz-year-cell.current { box-shadow: inset 0 0 0 2px var(--tz-primary); }

.tz-cities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
  max-width: 880px;
  margin: 0 auto;
}
.tz-city-card {
  padding: 1rem;
  background: var(--tz-bg);
  border: 1px solid var(--tz-border-soft);
  border-radius: 10px;
  text-align: center;
}
.tz-city-name { font-weight: 700; }
.tz-city-name a { color: var(--tz-fg); text-decoration: none; }
.tz-city-name a:hover { color: var(--tz-primary); }
.tz-city-state { color: var(--tz-fg-soft); font-size: 0.8125rem; margin-left: 0.25rem; }
.tz-city-clock { font-size: 1.25rem; font-weight: 800; color: var(--tz-primary); margin: 0.5rem 0 0.25rem; }
.tz-city-meta { font-size: 0.6875rem; color: var(--tz-fg-soft); }

.tz-dst-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  max-width: 880px;
  margin: 0 auto;
}
@media (max-width: 700px) { .tz-dst-grid { grid-template-columns: 1fr; } }
.tz-dst-col h4 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--tz-fg-soft);
  margin: 0 0 0.5rem;
}
.tz-dst-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--tz-bg-soft);
  border-radius: 6px;
  margin-bottom: 0.375rem;
  font-size: 0.875rem;
}
.tz-dst-row.next { background: color-mix(in srgb, var(--tz-primary) 12%, white); border: 1px solid var(--tz-primary); font-weight: 700; }
.tz-dst-row .date { color: var(--tz-fg); }
.tz-dst-row .change { color: var(--tz-fg-soft); font-size: 0.8125rem; }

.tz-related {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 720px;
  margin: 0 auto;
}
.tz-related-pill {
  display: inline-flex;
  flex-direction: column;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  text-decoration: none;
  background: var(--tz-bg-soft);
  border: 1px solid var(--tz-border-soft);
  transition: all 0.15s;
}
.tz-related-pill:hover {
  border-color: var(--tz-primary);
  background: var(--tz-primary-soft);
}
.tz-related-pill strong {
  font-size: 1.125rem;
  font-weight: 800;
  color: var(--tz-primary);
  display: block;
}
.tz-related-pill span {
  font-size: 0.75rem;
  color: var(--tz-fg-soft);
  margin-top: 0.125rem;
}

.tz-cta {
  background: linear-gradient(135deg, var(--tz-primary-soft) 0%, color-mix(in srgb, var(--tz-primary) 8%, white) 100%);
  border: 1px solid var(--tz-primary);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  margin-top: 3rem;
}
.tz-cta h3 { margin: 0 0 0.5rem; }
.tz-cta p { color: var(--tz-fg-soft); margin: 0 0 1rem; }
.tz-cta a {
  display: inline-block;
  padding: 0.625rem 1.25rem;
  background: var(--tz-primary);
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 700;
  margin: 0 0.25rem;
}
</style>

<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: `${data.longName} (${abbr})`,
  description: data.summary,
  url: `https://dateandtime.live/time/zones/${abbr.toLowerCase()}/`,
  mainEntity: {
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer }
    }))
  }
}, null, 2)}
</script>
</head>
<body>

<header class="site-header">
  <a class="site-logo" href="/">
    <span class="logo-icon">T</span>
    <span class="logo-text">dateandtime.<span class="logo-live">live</span></span>
  </a>
  <nav class="site-nav">
    <a href="/today/" class="nav-link">Today</a>
    <a href="/holidays/" class="nav-link">Holidays</a>
    <a href="/on-this-day/" class="nav-link">On this day</a>
    <a href="/world-time/meeting/" class="nav-link">Meeting finder</a>
    <a href="/world-time/" class="nav-link active">World time</a>
    <a href="/world-clock/timezone/" class="nav-link">Timezone</a>
    <a href="/news/" class="nav-link">News</a>
  </nav>
  <div class="site-actions">
    <button data-theme-btn="light" class="theme-toggle" aria-label="Switch theme">🌗</button>
  </div>
</header>

<main class="tz-page">

  <section class="tz-page-hero">
    <span class="tz-page-eyebrow">Time zone · UTC ${escapeHtml(offset)}</span>
    <h1>${escapeHtml(data.longName)} (${abbr})</h1>
    <div class="tz-page-iana">${escapeHtml(iana)}</div>
    <div class="tz-page-clock" id="tzPageClock" data-iana="${escapeAttr(iana)}">
      <span class="time-hm">--:--</span>
      <span class="time-sec">:--</span>
      <span class="ampm">${isDst ? 'DST' : 'STD'}</span>
    </div>
    <div class="tz-page-meta">
      <span><strong>UTC ${escapeHtml(offset)}</strong></span>
      <span class="pill ${observesDst ? 'dst-yes' : 'dst-no'}">${observesDst ? (isDst ? 'Daylight saving in effect' : 'Standard time (DST ends Nov 1)') : 'No DST observed'}</span>
      <span><strong>${majorCities.length}</strong> major cities</span>
    </div>
  </section>

  <!-- Major cities (live clocks) -->
  <section class="tz-section">
    <header class="tz-section-header">
      <h2>Current time in major ${abbr} cities</h2>
      <p>Live local time in the largest cities using ${escapeHtml(data.name)}. All clocks update every second.</p>
    </header>
    <div class="tz-cities-grid">
      ${citiesHtml}
    </div>
  </section>

  <!-- DST behavior -->
  ${observesDst ? `
  <section class="tz-section">
    <header class="tz-section-header">
      <h2>${abbr} DST schedule</h2>
      <p>When does ${abbr} start and end? Here's the year at a glance and the next 5 clock changes.</p>
    </header>
    ${yearStrip}
    ${dstChangesHtml}
  </section>
  ` : `
  <section class="tz-section">
    <header class="tz-section-header">
      <h2>${abbr} does not observe DST</h2>
      <p>${escapeHtml(data.name)} is in effect year-round in this time zone. Clocks do not change.</p>
    </header>
  </section>
  `}

  <!-- Article body -->
  <section class="tz-section">
    <header class="tz-section-header">
      <h2>About ${escapeHtml(data.name)}</h2>
    </header>
    <div class="tz-body">
      ${bodyHtml}
    </div>
  </section>

  <!-- Related zones -->
  <section class="tz-section">
    <header class="tz-section-header">
      <h2>Compare to other time zones</h2>
      <p>Quick links to other US and global time zone abbreviations.</p>
    </header>
    <div class="tz-related">
      ${relatedHtml}
    </div>
  </section>

  <!-- CTA -->
  <div class="tz-cta">
    <h3>Need to schedule across time zones?</h3>
    <p>Try our meeting planner — find a time that works for everyone.</p>
    <a href="/world-time/meeting/?cities=5128581">Plan a meeting</a>
    <a href="/world-time/" style="background: var(--tz-bg); color: var(--tz-primary); border: 1px solid var(--tz-primary);">Browse all cities</a>
  </div>

</main>

<footer class="site-footer">
  <div class="container">
    <p>© 2026 dateandtime.live · Live time in 33,945 cities · Data: <a href="/topics/time-zones/">timeanddatepro</a></p>
  </div>
</footer>

<script src="/src/site-shell.js" defer></script>
<script>
// Live clock — updates every second for the hero + all city cards
(function() {
  function updateClocks() {
    const now = new Date();
    // Hero clock
    const hero = document.getElementById('tzPageClock');
    if (hero) {
      try {
        const iana = hero.dataset.iana;
        const fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: iana,
          hour: 'numeric', minute: '2-digit', second: '2-digit',
          hour12: true
        });
        const parts = fmt.formatToParts(now);
        const hm = parts.find(p => p.type === 'hour').value + ':' + parts.find(p => p.type === 'minute').value;
        const sec = parts.find(p => p.type === 'second').value;
        hero.querySelector('.time-hm').textContent = hm;
        hero.querySelector('.time-sec').textContent = ':' + sec;
      } catch(e) {}
    }
    // City cards
    document.querySelectorAll('.tz-city-clock').forEach(el => {
      try {
        const iana = el.dataset.iana;
        const fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: iana,
          hour: 'numeric', minute: '2-digit', second: '2-digit',
          hour12: true
        });
        el.textContent = fmt.format(now);
      } catch(e) {}
    });
  }
  updateClocks();
  setInterval(updateClocks, 1000);
})();
</script>

</body>
</html>`;
}

function buildYearStrip(history, abbr) {
  // Build 12-cell strip showing which abbreviation is in effect per month
  const currentYear = new Date().getUTCFullYear();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getUTCMonth();
  
  // If no DST, all 12 cells are the same
  if (!history || !history.all || history.all.length === 0) {
    return `<div class="tz-year-strip">${months.map((m, i) => `
      <div class="tz-year-cell ${i === currentMonth ? 'current' : ''}">
        <span class="month">${m}</span>
        <span class="abbr">${abbr}</span>
        <span class="offset">no DST</span>
      </div>
    `).join('')}</div>`;
  }
  
  // For each month, determine if standard or daylight
  return `<div class="tz-year-strip">${months.map((m, i) => {
    // Find transitions in this year
    const monthDate = `${currentYear}-${String(i+1).padStart(2,'0')}-15`;
    let cellAbbr = abbr === 'EDT' || abbr === 'CDT' || abbr === 'MDT' || abbr === 'PDT' || abbr === 'AKDT' ? 
      abbr.replace('DT', 'ST') : 
      abbr.replace('ST', 'DT');
    let isDaylight = false;
    
    // Walk through transitions in chronological order, find state at monthDate
    const sorted = [...history.all].sort((a,b) => a.date.localeCompare(b.date));
    for (const t of sorted) {
      if (t.date <= monthDate) {
        if (t.direction === 'forward') {
          // Switched to daylight
          cellAbbr = abbr.replace('ST', 'DT').replace('DT', 'DT');
          isDaylight = true;
        } else {
          // Switched back to standard
          cellAbbr = abbr.replace('DT', 'ST').replace('ST', 'ST');
          isDaylight = false;
        }
      }
    }
    
    const cellClass = isDaylight ? 'daylight' : 'standard';
    return `<div class="tz-year-cell ${cellClass} ${i === currentMonth ? 'current' : ''}">
      <span class="month">${m}</span>
      <span class="abbr">${cellAbbr}</span>
      <span class="offset">${isDaylight ? '+1h' : 'std'}</span>
    </div>`;
  }).join('')}</div>`;
}

function buildDstChanges(history, abbr) {
  if (!history || (!history.past?.length && !history.future?.length)) {
    return '<p style="text-align: center; color: var(--tz-fg-soft);">No DST data available for this timezone.</p>';
  }
  
  const pastHtml = (history.past || []).map(t => `
    <div class="tz-dst-row">
      <span class="date">${formatDate(t.date)} · ${t.year}</span>
      <span class="change">${t.direction === 'forward' ? '+1h (forward)' : '−1h (back)'}</span>
    </div>
  `).join('');
  
  const futureHtml = (history.future || []).map((t, i) => `
    <div class="tz-dst-row${i === 0 ? ' next' : ''}">
      <span class="date">${formatDate(t.date)} · ${t.year}${i === 0 ? ' (next)' : ''}</span>
      <span class="change">${t.direction === 'forward' ? '+1h (forward)' : '−1h (back)'}</span>
    </div>
  `).join('');
  
  return `<div class="tz-dst-grid">
    <div class="tz-dst-col">
      <h4>Past 5 changes</h4>
      ${pastHtml || '<p style="color: var(--tz-fg-soft); font-size: 0.875rem;">No past data available</p>'}
    </div>
    <div class="tz-dst-col">
      <h4>Next 5 changes</h4>
      ${futureHtml || '<p style="color: var(--tz-fg-soft); font-size: 0.875rem;">No future data available</p>'}
    </div>
  </div>`;
}

function formatDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ---- Fetch DST history for each abbreviation ----
async function fetchDstHistory(iana) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/dst/upcoming?tz=${encodeURIComponent(iana)}`);
    const json = await res.json();
    if (json.success) return json.data;
  } catch (e) {
    console.warn(`DST fetch failed for ${iana}:`, e.message);
  }
  return null;
}

// ---- Main build loop ----
async function build() {
  console.log(`Building ${Object.keys(abbrs).length} TZ pages...`);
  
  for (const abbr of Object.keys(abbrs)) {
    const data = abbrs[abbr];
    const articlePath = path.join(CONTENT_DIR, `${abbr.toLowerCase()}.md`);
    if (!fs.existsSync(articlePath)) {
      console.warn(`  ⚠ ${abbr}: no article at ${articlePath}, skipping`);
      continue;
    }
    
    const md = fs.readFileSync(articlePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(md);
    const bodyHtml = markdownToHtml(body);
    
    // Fetch DST history
    const dstData = await fetchDstHistory(data.iana);
    const dstHistory = dstData?.history || null;
    
    // Build page
    const html = buildPage({ abbr, data, bodyHtml, dstHistory, sunData: null });
    
    // Write
    const outDir = path.join(OUT_DIR, abbr.toLowerCase());
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    console.log(`  ✓ ${abbr} → time/zones/${abbr.toLowerCase()}/index.html`);
  }
  
  console.log('Done.');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
