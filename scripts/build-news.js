#!/usr/bin/env node
/**
 * Build news articles from Markdown + YAML frontmatter.
 *
 * Input:  content/news/*.md
 * Output: news/<year>/<month>/<slug>/index.html
 *         news/index.html (latest 10)
 *         news/astronomy/index.html (category)
 *         news/timezone/index.html  (category)
 *         news/calendar/index.html  (category)
 *         news/rss.xml
 *         topics/<tag>/index.html (per-tag topic pages)
 *         updates sitemap.xml
 *
 * Usage:  node scripts/build-news.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'news');
const NEWS_DIR = path.join(ROOT, 'news');
const TOPICS_DIR = path.join(ROOT, 'topics');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const BASE_URL = 'https://dateandtime.live';

// ----------------------- helpers -----------------------

function readArticles() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`No content directory at ${CONTENT_DIR}`);
    return [];
  }
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  const articles = files.map(f => parseArticle(path.join(CONTENT_DIR, f)));
  return articles.sort((a, b) => b.published.localeCompare(a.published));
}

function parseArticle(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`Invalid article format (missing frontmatter): ${filepath}`);
  }
  const [, fmBody, body] = match;
  const fm = {};
  fmBody.split('\n').forEach(line => {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (val.startsWith('[') && val.endsWith(']')) {
        fm[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      } else {
        fm[key] = val;
      }
    }
  });
  return {
    title: fm.title,
    slug: fm.slug,
    category: fm.category,
    tags: fm.tags || [],
    published: fm.published,
    updated: fm.updated || fm.published,
    excerpt: fm.excerpt || '',
    heroAlt: fm.hero_alt || '',
    body: body.trim(),
    sourceFile: path.basename(filepath)
  };
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function isoToYearMonth(iso) {
  return iso.slice(0, 7); // "2026-07"
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(md) {
  // Very simple markdown -> HTML
  // Handles: headings, bold, italic, code, links, lists, tables, paragraphs
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Table
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s\-:|]+\|/)) {
      const tableLines = [line];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(renderTable(tableLines));
      continue;
    }
    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inlineMd(h[2])}</h${level}>`);
      i++;
      continue;
    }
    // Lists
    if (line.match(/^[-*]\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push(`<li>${inlineMd(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (line.match(/^\d+\.\s+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }
    // Paragraph (consume until blank)
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^(#{1,6}\s|[-*]\s|\d+\.\s|\|)/)) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inlineMd(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

function renderTable(lines) {
  // Skip the separator line (row 1)
  const headerCells = lines[0].split('|').slice(1, -1).map(c => c.trim());
  const bodyRows = lines.slice(2).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
  let html = '<table><thead><tr>';
  headerCells.forEach(c => { html += `<th>${inlineMd(c)}</th>`; });
  html += '</tr></thead><tbody>';
  bodyRows.forEach(row => {
    html += '<tr>';
    row.forEach(c => { html += `<td>${inlineMd(c)}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function inlineMd(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      // External link: open in new tab
      if (url.startsWith('http')) {
        return `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
      }
      return `<a href="${url}">${text}</a>`;
    });
}

function categoryLabel(cat) {
  return { astronomy: 'Astronomy', timezone: 'Time Zone', calendar: 'Calendar' }[cat] || cat;
}

function categoryEmoji(cat) {
  return { astronomy: '🌌', timezone: '🌐', calendar: '📅' }[cat] || '📰';
}

function categoryColor(cat) {
  return {
    astronomy: '#7c3aed',
    timezone: '#0ea5e9',
    calendar: '#f59e0b'
  }[cat] || '#5b4aaf';
}

function slugToDate(slug) {
  // Extract date from filename pattern YYYY-MM-DD-slug.md
  const m = slug.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { year: m[1], month: m[2], day: m[3] };
  return null;
}

// ----------------------- templates -----------------------

const CSS_NEWS = `
.news-page { max-width: 760px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
.news-eyebrow { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; color: white; }
.news-title { font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 800; letter-spacing: -0.022em; line-height: 1.2; margin: 0.75rem 0 0.5rem; color: var(--color-foreground, #1f1a3a); }
.news-meta { color: var(--color-muted, #77718f); font-size: 0.875rem; margin: 0 0 1.5rem; display: flex; flex-wrap: wrap; gap: 0.75rem; }
.news-excerpt { font-size: 1.1rem; color: var(--color-foreground-soft, #4a4569); font-weight: 500; line-height: 1.5; margin: 0 0 1.5rem; padding: 1rem 1.25rem; border-left: 3px solid var(--color-primary, #5b4aaf); background: var(--color-background-soft, #faf8ff); border-radius: 0 8px 8px 0; }
.news-body { font-size: 1rem; line-height: 1.7; color: var(--color-foreground, #1f1a3a); }
.news-body h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 0.75rem; }
.news-body h3 { font-size: 1.2rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
.news-body p { margin: 0 0 1rem; }
.news-body ul, .news-body ol { margin: 0 0 1rem 1.5rem; }
.news-body li { margin: 0 0 0.4rem; }
.news-body table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
.news-body th, .news-body td { padding: 0.6rem 0.8rem; text-align: left; border-bottom: 1px solid var(--color-border, rgba(92,74,175,0.16)); }
.news-body th { background: var(--color-background-soft, #faf8ff); font-weight: 700; }
.news-body code { background: var(--color-background-soft, #faf8ff); padding: 1px 6px; border-radius: 4px; font-size: 0.9em; }
.news-body a { color: var(--color-primary, #5b4aaf); text-decoration: none; font-weight: 500; }
.news-body a:hover { text-decoration: underline; }
.news-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 2rem 0 1rem; }
.news-tag { display: inline-block; padding: 4px 12px; background: var(--color-background-soft, #faf8ff); color: var(--color-primary, #5b4aaf); border-radius: 999px; font-size: 0.75rem; font-weight: 600; text-decoration: none; }
.news-tag:hover { background: var(--color-primary, #5b4aaf); color: white; }
.news-related { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--color-border-soft, rgba(92,74,175,0.08)); }
.news-related h3 { font-size: 1rem; font-weight: 700; margin: 0 0 1rem; }
.news-related-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
.news-related-card { display: block; padding: 1rem; border: 1px solid var(--color-border-soft, rgba(92,74,175,0.08)); border-radius: 8px; text-decoration: none; color: inherit; transition: transform 150ms, box-shadow 150ms; }
.news-related-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(92,74,175,0.12); }
.news-related-card .news-related-cat { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary, #5b4aaf); }
.news-related-card .news-related-title { font-size: 0.95rem; font-weight: 600; margin: 0.4rem 0; line-height: 1.3; }
.news-related-card .news-related-date { font-size: 0.75rem; color: var(--color-muted, #77718f); }

.news-index-hero { padding: 2.5rem 0 1.5rem; text-align: center; }
.news-index-hero h1 { font-size: clamp(2rem, 4vw, 3rem); font-weight: 800; margin: 0 0 0.5rem; letter-spacing: -0.025em; }
.news-index-hero p { font-size: 1.05rem; color: var(--color-foreground-soft, #4a4569); max-width: 640px; margin: 0 auto; }
.news-tabs { display: flex; justify-content: center; gap: 0.5rem; margin: 1.5rem 0 2rem; flex-wrap: wrap; }
.news-tab { padding: 0.5rem 1rem; border-radius: 999px; border: 1px solid var(--color-border, rgba(92,74,175,0.16)); color: var(--color-foreground, #1f1a3a); text-decoration: none; font-size: 0.875rem; font-weight: 600; }
.news-tab.is-active, .news-tab:hover { background: var(--color-primary, #5b4aaf); color: white; border-color: var(--color-primary, #5b4aaf); }
.news-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; margin: 1.5rem 0; }
.news-card { display: flex; flex-direction: column; padding: 1.25rem; border: 1px solid var(--color-border-soft, rgba(92,74,175,0.08)); border-radius: 12px; background: var(--color-background, white); transition: transform 150ms, box-shadow 150ms; }
.news-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(92,74,175,0.12); }
.news-card .news-related-cat { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: white; align-self: flex-start; }
.news-card .news-related-title { font-size: 1.05rem; font-weight: 700; margin: 0.6rem 0 0.4rem; line-height: 1.3; }
.news-card .news-related-title a { color: inherit; text-decoration: none; }
.news-card .news-related-title a:hover { color: var(--color-primary, #5b4aaf); }
.news-card .news-excerpt-mini { color: var(--color-foreground-soft, #4a4569); font-size: 0.9rem; line-height: 1.5; margin: 0 0 0.75rem; }
.news-card .news-related-date { font-size: 0.75rem; color: var(--color-muted, #77718f); }
.news-feed-link { text-align: center; margin: 2rem 0 0; font-size: 0.875rem; color: var(--color-muted, #77718f); }
.news-feed-link a { color: var(--color-primary, #5b4aaf); }
[data-theme="dark"] .news-card { background: var(--color-background, #0f0820); }
[data-theme="dark"] .news-body th { background: var(--color-background-soft, #16092e); }
`;

const HEADER = (active, bodyClass) => `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
  <meta name="theme-color" content="#5b4aaf" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="canonical" href="{canonical}" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:type" content="og:type" />
  {extra_head}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/src/site-shell.css" />
  {extra_css}
  <style>${CSS_NEWS}</style>
</head>
<body class="shell-page">
{header}

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <div class="container">
    <ol>
      <li><a href="/">Home</a></li>
      <li><a href="/news/">News</a></li>{breadcrumb_tail}
    </ol>
  </div>
</nav>

<main class="container">
{body}
</main>

{schemas}

<footer class="site-footer">
  <div class="site-footer-inner">
    <nav class="page-footer-nav" aria-label="Footer">
      <a href="/">Home</a>
      <a href="/holidays/">Holidays</a>
      <a href="/onthisday/">On this day</a>
      <a href="/about/">About</a>
      <a href="/editorial-policy/">Editorial policy</a>
      <a href="/privacy/">Privacy</a>
      <a href="/terms/">Terms</a>
      <a href="/contact/">Contact</a>
      <a href="/sitemap.xml">Sitemap</a>
    </nav>
    <p class="page-footer-meta">© 2026 dateandtime.live · 33,945 cities · 408 time zones · 1,600+ holidays</p>
  </div>
</footer>

</body>
</html>`;

function buildSiteHeader(active) {
  const isNews = active === 'news';
  return `<header class="site-header">
  <div class="container header-row">
    <a href="/" class="logo" aria-label="dateandtime.live home">
      <span class="logo-mark">T</span>
      <span class="logo-text"><span class="logo-text-domain">dateandtime</span><span class="logo-text-tld">.live</span></span>
    </a>
    <nav class="nav-main" aria-label="Main">
      <a href="#" class="nav-link" title="Today page — coming soon"><span class="now-dot" aria-hidden="true"></span>Today</a>
      <a href="/holidays/" class="nav-link">Holidays</a>
      <a href="/onthisday/" class="nav-link">On this day</a>
      <a href="/world-time/meeting/" class="nav-link">Meeting finder</a>
      <div class="nav-item has-dropdown">
        <button class="nav-link nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false">
          <span class="nav-icon" aria-hidden="true">🕐</span>World time
          <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="nav-dropdown" role="menu">
          <a href="/world-time/" class="dropdown-item" role="menuitem">
            <span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">🕐</span>The World Clock</span>
            <span class="dropdown-desc">Live current time in 33,945 cities</span>
          </a>
          <a href="/world-time/meeting/" class="dropdown-item" role="menuitem">
            <span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">📅</span>Meeting Planner</span>
            <span class="dropdown-desc">Find meeting times across time zones</span>
          </a>
          <a href="/world-time/event/" class="dropdown-item" role="menuitem">
            <span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">📣</span>Event Time Announcer</span>
            <span class="dropdown-desc">Show local times for a global event</span>
          </a>
        </div>
      </div>
      <div class="nav-item has-dropdown">
        <button class="nav-link nav-dropdown-toggle" aria-haspopup="true" aria-expanded="false">
          <span class="nav-icon" aria-hidden="true">🌐</span>Timezone
          <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="nav-dropdown" role="menu">
          <a href="/time-zones/" class="dropdown-item" role="menuitem">
            <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">🌐</span>Time Zones</span>
            <span class="dropdown-desc">Browse all 408 time zones</span>
          </a>
          <a href="/time-zones/converter/" class="dropdown-item" role="menuitem">
            <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">🔄</span>Time Zone Converter</span>
            <span class="dropdown-desc">Time difference calculator</span>
          </a>
          <a href="/time-zones/dst/" class="dropdown-item" role="menuitem">
            <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">⏰</span>Daylight Saving Time</span>
            <span class="dropdown-desc">How DST works and when it changes in 2026</span>
          </a>
          <a href="/time-zones/utc/" class="dropdown-item" role="menuitem">
            <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">🕓</span>UTC &amp; GMT</span>
            <span class="dropdown-desc">The world's time standard explained</span>
          </a>
          <a href="/time-zones/what-is/" class="dropdown-item" role="menuitem">
            <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">💡</span>What is a Time Zone?</span>
            <span class="dropdown-desc">How offsets, UTC, and the prime meridian work</span>
          </a>
        </div>
      </div>
      <a href="/news/" class="nav-link"${isNews ? ' aria-current="page"' : ''}>News</a>
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
</header>
<div class="mobile-nav-backdrop" data-nav-backdrop hidden></div>
<aside class="mobile-nav" id="mobile-nav" data-mobile-nav aria-label="Mobile navigation" hidden>
  <div class="mobile-nav-header">
    <a href="/" class="mobile-nav-logo" aria-label="dateandtime.live home">
      <span class="logo-mark">T</span>
      <span class="logo-text"><span class="logo-text-domain">dateandtime</span><span class="logo-text-tld">.live</span></span>
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
    <a href="/world-time/event/" class="mobile-nav-link mobile-nav-sub">Event Time Announcer</a>
    <div class="mobile-nav-section">Timezone</div>
    <a href="/time-zones/" class="mobile-nav-link mobile-nav-sub">Time Zones</a>
    <a href="/time-zones/converter/" class="mobile-nav-link mobile-nav-sub">Time Zone Converter</a>
    <a href="/time-zones/dst/" class="mobile-nav-link mobile-nav-sub">Daylight Saving Time</a>
    <a href="/time-zones/utc/" class="mobile-nav-link mobile-nav-sub">UTC &amp; GMT</a>
    <a href="/time-zones/what-is/" class="mobile-nav-link mobile-nav-sub">What is a Time Zone?</a>
    <a href="/news/" class="mobile-nav-link${isNews ? ' is-active' : ''}"${isNews ? ' aria-current="page"' : ''}>News</a>
  </nav>
</aside>`;
}

const SITE_SHELL_JS = `<script src="/src/site-shell.js"></script>`;

// ----------------------- builders -----------------------

function articleUrl(article) {
  const dt = slugToDate(article.sourceFile);
  if (dt) return `/news/${dt.year}/${dt.month}/${article.slug}/`;
  return `/news/${article.slug}/`;
}

function articleCanonical(article) {
  return `${BASE_URL}${articleUrl(article)}`;
}

function buildArticleHtml(article, allArticles) {
  const bodyHtml = markdownToHtml(article.body);
  const dt = slugToDate(article.sourceFile);
  const articleDir = dt
    ? path.join(NEWS_DIR, dt.year, dt.month, article.slug)
    : path.join(NEWS_DIR, article.slug);

  // Related articles: same category or overlapping tags
  const related = allArticles
    .filter(a => a.slug !== article.slug)
    .map(a => {
      let score = 0;
      if (a.category === article.category) score += 3;
      score += a.tags.filter(t => article.tags.includes(t)).length;
      return { a, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.a);

  const tagsHtml = article.tags.map(t =>
    `<a href="/topics/${t}/" class="news-tag">${escapeHtml(t)}</a>`
  ).join('');

  const relatedHtml = related.length > 0 ? `
<section class="news-related">
  <h3>Related articles</h3>
  <div class="news-related-grid">
    ${related.map(a => `
      <a href="${articleUrl(a)}" class="news-related-card">
        <span class="news-related-cat" style="background: ${categoryColor(a.category)}">${categoryEmoji(a.category)} ${categoryLabel(a.category)}</span>
        <div class="news-related-title">${escapeHtml(a.title)}</div>
        <div class="news-related-date">${formatDate(a.published)}</div>
      </a>
    `).join('')}
  </div>
</section>` : '';

  const breadcrumbTail = dt
    ? `<li><a href="/news/${dt.year}/${dt.month}/">${dt.year} ${new Date(dt.year, parseInt(dt.month) - 1).toLocaleString('en-US', { month: 'long' })}</a></li>
       <li><span aria-current="page">${escapeHtml(article.title)}</span></li>`
    : `<li><span aria-current="page">${escapeHtml(article.title)}</span></li>`;

  const articleSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title,
    "datePublished": article.published,
    "dateModified": article.updated,
    "description": article.excerpt,
    "image": `${BASE_URL}/favicon.svg`,
    "articleSection": categoryLabel(article.category),
    "keywords": article.tags.join(', '),
    "mainEntityOfPage": { "@type": "WebPage", "@id": articleCanonical(article) },
    "publisher": {
      "@type": "Organization",
      "name": "dateandtime.live",
      "logo": { "@type": "ImageObject", "url": `${BASE_URL}/favicon.svg` }
    }
  }, null, 2);

  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": BASE_URL },
      { "@type": "ListItem", "position": 2, "name": "News", "item": `${BASE_URL}/news/` },
      ...(dt ? [{ "@type": "ListItem", "position": 3, "name": `${dt.year}`, "item": `${BASE_URL}/news/${dt.year}/` }] : []),
      { "@type": "ListItem", "position": dt ? 4 : 3, "name": article.title, "item": articleCanonical(article) }
    ]
  }, null, 2);

  const body = `
<article class="news-page">
  <p class="news-eyebrow" style="background: ${categoryColor(article.category)}">${categoryEmoji(article.category)} ${categoryLabel(article.category)}</p>
  <h1 class="news-title">${escapeHtml(article.title)}</h1>
  <p class="news-meta">
    <span>📅 Published ${formatDate(article.published)}</span>
    ${article.updated !== article.published ? `<span>🔄 Updated ${formatDate(article.updated)}</span>` : ''}
    <span>⏱ ${Math.max(1, Math.round(article.body.split(/\s+/).length / 200))} min read</span>
  </p>
  <p class="news-excerpt">${escapeHtml(article.excerpt)}</p>
  <div class="news-body">
${bodyHtml}
  </div>
  <div class="news-tags">${tagsHtml}</div>
  ${relatedHtml}
</article>`;

  const html = HEADER()
    .replace('{title}', escapeHtml(article.title) + ' | dateandtime.live')
    .replace('{description}', escapeHtml(article.excerpt))
    .replace('{canonical}', articleCanonical(article))
    .replace('{og:type}', 'article')
    .replace('{extra_head}', `<meta property="article:published_time" content="${article.published}" />
    <meta property="article:modified_time" content="${article.updated}" />
    <meta property="article:section" content="${categoryLabel(article.category)}" />
    <meta property="article:tag" content="${article.tags.join('" /><meta property="article:tag" content="')}" />`)
    .replace('{extra_css}', '')
    .replace('{header}', buildSiteHeader('news'))
    .replace('{breadcrumb_tail}', breadcrumbTail)
    .replace('{body}', body)
    .replace('{schemas}', `<script type="application/ld+json">${articleSchema}</script>
<script type="application/ld+json">${breadcrumbSchema}</script>
${SITE_SHELL_JS}`);

  fs.mkdirSync(articleDir, { recursive: true });
  fs.writeFileSync(path.join(articleDir, 'index.html'), html);
  console.log(`  ✓ ${articleUrl(article)}`);
}

function buildIndexHtml(articles) {
  const recent = articles.slice(0, 12);
  const cards = recent.map(a => `
    <article class="news-card">
      <span class="news-related-cat" style="background: ${categoryColor(a.category)}">${categoryEmoji(a.category)} ${categoryLabel(a.category)}</span>
      <h2 class="news-related-title"><a href="${articleUrl(a)}">${escapeHtml(a.title)}</a></h2>
      <p class="news-excerpt-mini">${escapeHtml(a.excerpt)}</p>
      <div class="news-related-date">${formatDate(a.published)}</div>
    </article>
  `).join('');

  const body = `
<section class="news-index-hero">
  <p class="eyebrow" style="display:inline-flex;align-items:center;gap:.4rem;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--color-primary,#5b4aaf) 10%,transparent);color:var(--color-primary,#5b4aaf);">📰 News Hub</p>
  <h1>News &amp; Editorial</h1>
  <p>The latest on time zones, daylight saving, calendars, holidays, and astronomy — published every 2–3 days. Updated ${formatDate(articles[0].published)}.</p>
  <nav class="news-tabs" aria-label="Categories">
    <a href="/news/" class="news-tab is-active">All News</a>
    <a href="/news/astronomy/" class="news-tab">🌌 Astronomy</a>
    <a href="/news/timezone/" class="news-tab">🌐 Time Zone</a>
    <a href="/news/calendar/" class="news-tab">📅 Calendar</a>
  </nav>
</section>
<section>
  <h2 style="font-size:1.25rem;font-weight:700;margin:0 0 1rem;">Latest articles</h2>
  <div class="news-grid">${cards}</div>
</section>
<p class="news-feed-link">Subscribe via <a href="/news/rss.xml">RSS</a> · New articles added every 2–3 days</p>`;

  const html = HEADER()
    .replace('{title}', 'News & Editorial | dateandtime.live')
    .replace('{description}', 'The latest news on time zones, daylight saving, calendars, holidays, and astronomy from dateandtime.live.')
    .replace('{canonical}', `${BASE_URL}/news/`)
    .replace('{og:type}', 'website')
    .replace('{extra_head}', '')
    .replace('{extra_css}', '')
    .replace('{header}', buildSiteHeader('news'))
    .replace('{breadcrumb_tail}', `<li><span aria-current="page">News</span></li>`)
    .replace('{body}', body)
    .replace('{schemas}', `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "News & Editorial",
      "url": `${BASE_URL}/news/`,
      "description": "News on time zones, DST, calendars, holidays, and astronomy."
    }, null, 2)}</script>
${SITE_SHELL_JS}`);

  fs.mkdirSync(NEWS_DIR, { recursive: true });
  fs.writeFileSync(path.join(NEWS_DIR, 'index.html'), html);
  console.log(`  ✓ /news/`);
}

function buildCategoryHtml(articles, cat) {
  const filtered = articles.filter(a => a.category === cat);
  if (filtered.length === 0) return;
  const cards = filtered.map(a => `
    <article class="news-card">
      <h2 class="news-related-title"><a href="${articleUrl(a)}">${escapeHtml(a.title)}</a></h2>
      <p class="news-excerpt-mini">${escapeHtml(a.excerpt)}</p>
      <div class="news-related-date">${formatDate(a.published)}</div>
    </article>
  `).join('');

  const body = `
<section class="news-index-hero">
  <p class="eyebrow" style="display:inline-flex;align-items:center;gap:.4rem;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:${categoryColor(cat)};color:white;">${categoryEmoji(cat)} ${categoryLabel(cat)} News</p>
  <h1>${categoryLabel(cat)} News</h1>
  <p>${filtered.length} article${filtered.length === 1 ? '' : 's'} about ${categoryLabel(cat).toLowerCase()} — from DST changes and time zone updates to eclipses and astronomical events.</p>
  <nav class="news-tabs" aria-label="Categories">
    <a href="/news/" class="news-tab">All News</a>
    <a href="/news/astronomy/" class="news-tab${cat === 'astronomy' ? ' is-active' : ''}">🌌 Astronomy</a>
    <a href="/news/timezone/" class="news-tab${cat === 'timezone' ? ' is-active' : ''}">🌐 Time Zone</a>
    <a href="/news/calendar/" class="news-tab${cat === 'calendar' ? ' is-active' : ''}">📅 Calendar</a>
  </nav>
</section>
<div class="news-grid">${cards}</div>`;

  const html = HEADER()
    .replace('{title}', `${categoryLabel(cat)} News | dateandtime.live`)
    .replace('{description}', `Latest ${categoryLabel(cat).toLowerCase()} news and editorial from dateandtime.live.`)
    .replace('{canonical}', `${BASE_URL}/news/${cat}/`)
    .replace('{og:type}', 'website')
    .replace('{extra_head}', '')
    .replace('{extra_css}', '')
    .replace('{header}', buildSiteHeader('news'))
    .replace('{breadcrumb_tail}', `<li><a href="/news/">News</a></li><li><span aria-current="page">${categoryLabel(cat)}</span></li>`)
    .replace('{body}', body)
    .replace('{schemas}', SITE_SHELL_JS);

  const dir = path.join(NEWS_DIR, cat);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`  ✓ /news/${cat}/`);
}

function buildTopicHtml(articles, tag) {
  const filtered = articles.filter(a => a.tags.includes(tag));
  if (filtered.length === 0) return;
  const cards = filtered.map(a => `
    <article class="news-card">
      <span class="news-related-cat" style="background: ${categoryColor(a.category)}">${categoryEmoji(a.category)} ${categoryLabel(a.category)}</span>
      <h2 class="news-related-title"><a href="${articleUrl(a)}">${escapeHtml(a.title)}</a></h2>
      <p class="news-excerpt-mini">${escapeHtml(a.excerpt)}</p>
      <div class="news-related-date">${formatDate(a.published)}</div>
    </article>
  `).join('');

  const body = `
<section class="news-index-hero">
  <p class="eyebrow" style="display:inline-flex;align-items:center;gap:.4rem;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:color-mix(in srgb,var(--color-primary,#5b4aaf) 10%,transparent);color:var(--color-primary,#5b4aaf);">🏷 Topic</p>
  <h1>#${escapeHtml(tag)}</h1>
  <p>${filtered.length} article${filtered.length === 1 ? '' : 's'} tagged "${escapeHtml(tag)}".</p>
  <nav class="news-tabs" aria-label="Categories">
    <a href="/news/" class="news-tab">← All News</a>
  </nav>
</section>
<div class="news-grid">${cards}</div>`;

  const html = HEADER()
    .replace('{title}', `#${tag} — News & Editorial | dateandtime.live`)
    .replace('{description}', `Articles tagged ${tag} from dateandtime.live.`)
    .replace('{canonical}', `${BASE_URL}/topics/${tag}/`)
    .replace('{og:type}', 'website')
    .replace('{extra_head}', '')
    .replace('{extra_css}', '')
    .replace('{header}', buildSiteHeader('news'))
    .replace('{breadcrumb_tail}', `<li><a href="/news/">News</a></li><li><span aria-current="page">#${escapeHtml(tag)}</span></li>`)
    .replace('{body}', body)
    .replace('{schemas}', SITE_SHELL_JS);

  const dir = path.join(TOPICS_DIR, tag);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`  ✓ /topics/${tag}/`);
}

function buildRss(articles) {
  const items = articles.slice(0, 20).map(a => `
    <item>
      <title>${escapeHtml(a.title)}</title>
      <link>${articleCanonical(a)}</link>
      <guid isPermaLink="true">${articleCanonical(a)}</guid>
      <pubDate>${new Date(a.published).toUTCString()}</pubDate>
      <description>${escapeHtml(a.excerpt)}</description>
      <category>${categoryLabel(a.category)}</category>
    </item>`).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>dateandtime.live News &amp; Editorial</title>
    <link>${BASE_URL}/news/</link>
    <description>Latest news on time zones, DST, calendars, holidays, and astronomy.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(NEWS_DIR, 'rss.xml'), rss);
  console.log(`  ✓ /news/rss.xml`);
}

function updateSitemap(articles) {
  if (!fs.existsSync(SITEMAP_PATH)) return;
  let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
  // Remove old news URLs
  sitemap = sitemap.replace(/<url>\s*<loc>https:\/\/dateandtime\.live\/news\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
  // Add new news URLs before </urlset>
  const newUrls = articles.map(a => {
    const dt = slugToDate(a.sourceFile);
    const lastmod = a.updated;
    const priority = dt && dt.year === new Date().getFullYear().toString() ? '0.7' : '0.5';
    return `  <url>
    <loc>${articleCanonical(a)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');
  // Add the news index page too
  const newsIndex = `  <url>
    <loc>${BASE_URL}/news/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
  // Also add category pages
  const cats = ['astronomy', 'timezone', 'calendar'];
  const catUrls = cats.map(c => `  <url>
    <loc>${BASE_URL}/news/${c}/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');
  sitemap = sitemap.replace('</urlset>', `${newsIndex}\n${catUrls}\n${newUrls}\n</urlset>`);
  fs.writeFileSync(SITEMAP_PATH, sitemap);
  console.log(`  ✓ sitemap.xml updated with ${articles.length} news URLs`);
}

// ----------------------- main -----------------------

console.log('📰 Building news section...\n');

const articles = readArticles();
console.log(`Found ${articles.length} article${articles.length === 1 ? '' : 's'}\n`);

if (articles.length === 0) {
  console.log('No articles found. Add Markdown files to content/news/');
  process.exit(0);
}

console.log('Building individual articles:');
articles.forEach(a => buildArticleHtml(a, articles));

console.log('\nBuilding index pages:');
buildIndexHtml(articles);
['astronomy', 'timezone', 'calendar'].forEach(cat => buildCategoryHtml(articles, cat));

console.log('\nBuilding topic pages:');
const allTags = new Set();
articles.forEach(a => a.tags.forEach(t => allTags.add(t)));
allTags.forEach(tag => buildTopicHtml(articles, tag));

console.log('\nBuilding RSS feed:');
buildRss(articles);

console.log('\nUpdating sitemap:');
updateSitemap(articles);

console.log(`\n✅ Done! ${articles.length} articles, ${allTags.size} topics, 3 category pages.`);
