/**
 * Build on-this-day HTML pages from a data file
 *
 * Usage:
 *   node scripts/build-otd-from-data.js --input content/otd/dates/top-5-dates.json --output onthisday/
 *   node scripts/build-otd-from-data.js --input content/otd/dates/all-365.json --output onthisday/ --all-dates
 *
 * Generates:
 *   - /onthisday/index.html (today's view with all sections)
 *   - /onthisday/?month=X&day=Y (per-date view)
 *   - /onthisday/[slug].html (per-entry detail page)
 *   - /onthisday/category/[cat]/index.html (per-category)
 *   - /onthisday/country/[cca2]/index.html (per-country)
 */

const fs = require('fs');
const path = require('path');

const SITE_NAME = 'dateandtime.live';
const SITE_URL = 'https://dateandtime.live';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    input: null,
    output: 'onthisday',
    today: null,
    allDates: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--input' && next) { opts.input = next; i++; }
    else if (arg === '--output' && next) { opts.output = next; i++; }
    else if (arg === '--today' && next) { opts.today = next; i++; }
    else if (arg === '--all-dates') { opts.allDates = true; }
  }
  return opts;
}

function monthName(month) {
  const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                 'July', 'August', 'September', 'October', 'November', 'December'];
  return names[month];
}

/**
 * Group entries by date and type
 */
function groupByDate(entries) {
  const grouped = {};
  for (const e of entries) {
    const key = `${e.month}-${e.day}`;
    if (!grouped[key]) grouped[key] = { events: [], births: [], deaths: [], weddings: [], divorces: [], bizarre: [], all: [] };
    const type = e.type || 'event';
    const groupKey = type === 'wedding' ? 'weddings' : type === 'divorce' ? 'divorces' : type === 'bizarre' ? 'bizarre' : type + 's';
    if (grouped[key][groupKey]) {
      grouped[key][groupKey].push(e);
    } else {
      grouped[key].events.push(e);
    }
    grouped[key].all.push(e);
  }
  return grouped;
}

/**
 * Generate a slug for an entry
 */
function slugify(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/**
 * Render the per-date HTML page
 */
function renderDatePage(month, day, entries, opts) {
  const date = new Date(2026, month - 1, day);
  const dateLabel = `${monthName(month)} ${day}`;
  const today = new Date();
  const isToday = today.getMonth() + 1 === month && today.getDate() === day;
  
  // Group by type
  const byType = {
    events: entries.filter(e => e.type === 'event').sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 10),
    births: entries.filter(e => e.type === 'birth').sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 8),
    deaths: entries.filter(e => e.type === 'death').sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 5)
  };
  
  // Build featured event
  const featured = byType.events[0];
  
  // Build "X years ago" callouts for top events
  const callouts = byType.events
    .filter(e => e.year && e.importance >= 3)
    .slice(0, 4)
    .map(e => {
      const yearsAgo = today.getFullYear() - e.year;
      if (yearsAgo < 1) return null;
      return { ...e, yearsAgo, text: `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago` };
    })
    .filter(Boolean);
  
  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `On This Day - ${dateLabel}`,
    "description": `Historical events, famous birthdays, and notable deaths on ${dateLabel}`,
    "url": `${SITE_URL}/onthisday/?month=${month}&day=${day}`,
    "isPartOf": { "@type": "WebSite", "name": SITE_NAME, "url": SITE_URL }
  };
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>On This Day - ${dateLabel} | ${SITE_NAME}</title>
<meta name="description" content="What happened on ${dateLabel} in history? Discover famous events, birthdays, and deaths. ${byType.events.length} events, ${byType.births.length} births, ${byType.deaths.length} deaths." />
<link rel="canonical" href="${SITE_URL}/onthisday/?month=${month}&day=${day}" />
<meta property="og:title" content="On This Day - ${dateLabel}" />
<meta property="og:description" content="Historical events, famous birthdays, and notable deaths on ${dateLabel}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${SITE_URL}/onthisday/?month=${month}&day=${day}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="stylesheet" href="/src/site-shell.css" />
<link rel="stylesheet" href="/onthisday/otd-page.css" />
</head>
<body>
<header class="site-header">
  <div class="container">
    <a href="/" class="logo">${SITE_NAME}</a>
    <nav class="main-nav">
      <a href="/world-time/">World time</a>
      <a href="/time-zones/">Time zones</a>
      <a href="/onthisday/" class="active">On this day</a>
      <a href="/news/">News</a>
    </nav>
  </div>
</header>

<main class="otd-page">
  <section class="otd-hero">
    <div class="container">
      <p class="eyebrow">${isToday ? '📅 TODAY' : '📅 ON THIS DAY'}</p>
      <h1>${dateLabel}</h1>
      <p class="hero-sub">${byType.events.length} historical events · ${byType.births.length} famous birthdays · ${byType.deaths.length} notable deaths</p>
    </div>
  </section>
  
  <div class="container otd-grid">
    ${featured ? renderFeatured(featured, month, day) : ''}
    
    <section class="otd-section">
      <h2>📅 Historical Events</h2>
      <div class="otd-events">
        ${byType.events.map(e => renderEventCard(e, month, day)).join('\n')}
      </div>
    </section>
    
    ${callouts.length > 0 ? `
    <section class="otd-section">
      <h2>⏳ This Day in History</h2>
      <div class="otd-callouts">
        ${callouts.map(c => renderCallout(c)).join('\n')}
      </div>
    </section>
    ` : ''}
    
    <section class="otd-section">
      <h2>🎂 Famous Birthdays</h2>
      <div class="otd-people-grid">
        ${byType.births.map(e => renderPersonCard(e, 'birth')).join('\n')}
      </div>
    </section>
    
    <section class="otd-section">
      <h2>⚰️ Notable Deaths</h2>
      <div class="otd-people-grid">
        ${byType.deaths.map(e => renderPersonCard(e, 'death')).join('\n')}
      </div>
    </section>
  </div>
</main>

<footer class="page-footer">
  <div class="container">
    <p>${SITE_NAME} · A better way to explore history</p>
  </div>
</footer>
</body>
</html>`;
}

function renderFeatured(event, month, day) {
  return `
    <section class="otd-featured">
      <div class="otd-featured-image">
        ${event.image_url ? `<img src="${escapeHtml(event.image_url)}" alt="${escapeHtml(event.image_alt || event.title)}" loading="lazy" />` : '<div class="placeholder">📅</div>'}
      </div>
      <div class="otd-featured-content">
        <p class="year">${event.year}</p>
        <h2><a href="/onthisday/${month}-${day}/${slugify(event.title)}.html">${escapeHtml(event.title)}</a></h2>
        <p>${escapeHtml(event.description || '')}</p>
        ${event.wikipedia_url ? `<a href="${escapeHtml(event.wikipedia_url)}" class="wiki-link" target="_blank" rel="noopener">Wikipedia →</a>` : ''}
      </div>
    </section>
  `;
}

function renderEventCard(event, month, day) {
  return `
    <article class="otd-event-card">
      ${event.image_url ? `<div class="otd-event-image"><img src="${escapeHtml(event.image_url)}" alt="${escapeHtml(event.image_alt || event.title)}" loading="lazy" /></div>` : '<div class="otd-event-image placeholder"></div>'}
      <div class="otd-event-content">
        <span class="otd-year">${event.year}</span>
        <h3><a href="/onthisday/${month}-${day}/${slugify(event.title)}.html">${escapeHtml(event.title)}</a></h3>
        <p>${escapeHtml(truncate(event.description || '', 200))}</p>
        ${event.wikipedia_url ? `<a href="${escapeHtml(event.wikipedia_url)}" target="_blank" rel="noopener" class="wiki-link">Wikipedia →</a>` : ''}
      </div>
    </article>
  `;
}

function renderCallout(callout) {
  return `
    <div class="otd-callout">
      <span class="otd-callout-text">${callout.text}</span>
      <a href="/onthisday/${callout.month}-${callout.day}/${slugify(callout.title)}.html">
        <h4>${escapeHtml(callout.title)}</h4>
        <p>${escapeHtml(truncate(callout.description || '', 120))}</p>
      </a>
    </div>
  `;
}

function renderPersonCard(person, type) {
  const age = person.year ? new Date().getFullYear() - person.year : null;
  const ageStr = type === 'birth' && age ? `${age} years old today` : '';
  const initials = (person.title || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  
  return `
    <article class="otd-person-card">
      <div class="otd-person-avatar">${initials || (type === 'birth' ? '🎂' : '⚰️')}</div>
      <div class="otd-person-info">
        <h4><a href="/onthisday/${person.month}-${person.day}/${slugify(person.title)}.html">${escapeHtml(person.title)}</a></h4>
        <p class="otd-year">${person.year}${ageStr ? ` · ${ageStr}` : ''}</p>
        ${person.description ? `<p>${escapeHtml(truncate(person.description, 100))}</p>` : ''}
      </div>
    </article>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(str, max) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max).trim() + '…';
}

function main() {
  const opts = parseArgs();
  
  if (!opts.input) {
    console.error('Usage: node scripts/build-otd-from-data.js --input <file> [--output <dir>]');
    process.exit(1);
  }
  
  if (!fs.existsSync(opts.input)) {
    console.error(`Input file not found: ${opts.input}`);
    process.exit(1);
  }
  
  console.log(`📂 Loading entries from ${opts.input}...`);
  const entries = JSON.parse(fs.readFileSync(opts.input, 'utf8'));
  console.log(`  ${entries.length} entries loaded`);
  
  const grouped = groupByDate(entries);
  const dateKeys = Object.keys(grouped).sort((a, b) => {
    const [am, ad] = a.split('-').map(Number);
    const [bm, bd] = b.split('-').map(Number);
    return am - bm || ad - bd;
  });
  
  console.log(`  ${dateKeys.length} unique dates found`);
  
  const outputDir = opts.output;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  let totalGenerated = 0;
  
  for (const key of dateKeys) {
    const [month, day] = key.split('-').map(Number);
    const dateEntries = grouped[key].all;
    
    // Generate main page for this date
    const html = renderDatePage(month, day, dateEntries, opts);
    const dateDir = path.join(outputDir, `${month}-${String(day).padStart(2, '0')}`);
    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(dateDir, 'index.html'), html);
    totalGenerated++;
    
    // Generate per-entry pages
    for (const entry of dateEntries) {
      const slug = slugify(entry.title);
      if (!slug) continue;
      const entryHtml = renderEntryPage(entry);
      fs.writeFileSync(path.join(dateDir, `${slug}.html`), entryHtml);
    }
  }
  
  console.log(`\n✅ Generated ${totalGenerated} date pages`);
  console.log(`📁 Output: ${outputDir}/`);
  
  // Generate index of all dates
  const indexHtml = renderIndexPage(grouped);
  fs.writeFileSync(path.join(outputDir, 'index-all.html'), indexHtml);
  console.log(`📄 Index: ${outputDir}/index-all.html`);
}

function renderEntryPage(entry) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": entry.type === 'birth' ? "Person" : entry.type === 'death' ? "Person" : "Event",
    "name": entry.title,
    "description": entry.description,
    "datePublished": `${entry.year}-${String(entry.month).padStart(2, '0')}-${String(entry.day).padStart(2, '0')}`
  };
  
  if (entry.wikipedia_url) {
    jsonLd.sameAs = entry.wikipedia_url;
  }
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(entry.title)} (${entry.year}) | ${SITE_NAME}</title>
<meta name="description" content="${escapeHtml(truncate(entry.description || '', 160))}" />
<link rel="canonical" href="${SITE_URL}/onthisday/${entry.month}-${entry.day}/${slugify(entry.title)}.html" />
<meta property="og:title" content="${escapeHtml(entry.title)}" />
<meta property="og:description" content="${escapeHtml(truncate(entry.description || '', 160))}" />
<meta property="og:type" content="article" />
${entry.image_url ? `<meta property="og:image" content="${escapeHtml(entry.image_url)}" />` : ''}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="stylesheet" href="/src/site-shell.css" />
<link rel="stylesheet" href="/onthisday/otd-detail.css" />
</head>
<body>
<header class="site-header">
  <div class="container">
    <a href="/" class="logo">${SITE_NAME}</a>
    <nav class="main-nav">
      <a href="/world-time/">World time</a>
      <a href="/time-zones/">Time zones</a>
      <a href="/onthisday/" class="active">On this day</a>
      <a href="/news/">News</a>
    </nav>
  </div>
</header>

<main class="otd-detail">
  <div class="container">
    <nav class="breadcrumbs">
      <a href="/">Home</a> › <a href="/onthisday/">On this day</a> › <a href="/onthisday/?month=${entry.month}&day=${entry.day}">${monthName(entry.month)} ${entry.day}</a> › <span>${escapeHtml(truncate(entry.title, 50))}</span>
    </nav>
    
    <article class="otd-entry">
      <header class="otd-entry-header">
        <span class="otd-entry-year">${entry.year}</span>
        <h1>${escapeHtml(entry.title)}</h1>
        ${entry.country_code ? `<p class="otd-entry-meta">📍 ${entry.country_code}</p>` : ''}
      </header>
      
      ${entry.image_url ? `
        <div class="otd-entry-image">
          <img src="${escapeHtml(entry.image_url)}" alt="${escapeHtml(entry.image_alt || entry.title)}" />
          ${entry.image_credit ? `<p class="image-credit">${escapeHtml(entry.image_credit)}</p>` : ''}
        </div>
      ` : ''}
      
      <div class="otd-entry-body">
        <p class="otd-entry-description">${escapeHtml(entry.description || '')}</p>
        
        ${entry.long_description && entry.long_description !== entry.description ? `
          <p>${escapeHtml(entry.long_description)}</p>
        ` : ''}
        
        ${entry.wikipedia_url ? `
          <p><a href="${escapeHtml(entry.wikipedia_url)}" target="_blank" rel="noopener" class="btn-wiki">Read more on Wikipedia →</a></p>
        ` : ''}
      </div>
      
      ${entry.faq_questions ? renderFaq(entry.faq_questions) : ''}
    </article>
  </div>
</main>

<footer class="page-footer">
  <div class="container">
    <p>${SITE_NAME} · A better way to explore history</p>
  </div>
</footer>
</body>
</html>`;
}

function renderFaq(faqJson) {
  let faq = [];
  try { faq = typeof faqJson === 'string' ? JSON.parse(faqJson) : faqJson; } catch {}
  if (!Array.isArray(faq) || faq.length === 0) return '';
  
  return `
    <section class="otd-entry-faq">
      <h2>Frequently Asked Questions</h2>
      ${faq.map(item => `
        <details>
          <summary>${escapeHtml(item.q)}</summary>
          <p>${escapeHtml(item.a)}</p>
        </details>
      `).join('\n')}
    </section>
  `;
}

function renderIndexPage(grouped) {
  const dateKeys = Object.keys(grouped).sort((a, b) => {
    const [am, ad] = a.split('-').map(Number);
    const [bm, bd] = b.split('-').map(Number);
    return am - bm || ad - bd;
  });
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>On This Day - All Dates | ${SITE_NAME}</title>
<style>
body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 2rem; max-width: 1200px; margin: 0 auto; }
h1 { color: #5b4aaf; }
.date-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 2rem; }
.date-card { padding: 1rem; background: #f5f3ff; border-radius: 8px; text-decoration: none; color: inherit; }
.date-card:hover { background: #ede9fe; }
.date-card .count { font-size: 0.875rem; color: #6b7280; }
</style>
</head>
<body>
<h1>On This Day - All Dates</h1>
<p>Browse historical events, birthdays, and deaths for any day of the year.</p>
<div class="date-grid">
${dateKeys.map(key => {
  const [m, d] = key.split('-').map(Number);
  const entries = grouped[key].all;
  return `<a class="date-card" href="/onthisday/${m}-${String(d).padStart(2, '0')}/">
    <strong>${monthName(m)} ${d}</strong>
    <div class="count">${entries.length} entries</div>
  </a>`;
}).join('\n')}
</div>
</body>
</html>`;
}

if (require.main === module) {
  main();
}

module.exports = { main, renderDatePage, renderEntryPage, slugify };
