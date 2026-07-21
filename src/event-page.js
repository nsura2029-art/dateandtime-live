/**
 * Per-event detail page client
 * URL: /onthisday/event/{slug}
 *   /onthisday/event/Apollo_11
 *   /onthisday/event/Q11631
 *   /onthisday/event/1969-apollo-11
 * Calls: GET /api/v1/onthisday/event/{slug}
 *
 * Static HTML shell, hydrated by this script. Falls back to per-date JSON
 * if the API isn't available (dev / pre-deploy).
 */

(function() {
  'use strict';

  // ----- Slug detection -----
  // URL pattern: /onthisday/event/{slug}/  or  /onthisday/event/{slug}
  function getSlugFromURL() {
    const m = window.location.pathname.match(/\/onthisday\/event\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // ----- Date extraction from "1969-apollo-11" slugs -----
  function getDateHint(slug) {
    const m = slug.match(/^(\d{4})-(.+)$/);
    if (m) return { year: parseInt(m[1], 10), titleSlug: m[2] };
    return null;
  }

  // ----- DOM helpers -----
  function $(sel) { return document.querySelector(sel); }
  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function formatMonth(month) {
    return ['January','February','March','April','May','June','July','August','September','October','November','December'][month - 1] || '';
  }
  function formatDate(month, day) {
    return month && day ? `${formatMonth(month)} ${day}` : '';
  }

  // ----- Render: error state -----
  function renderError(message, hint) {
    $('#evt-content').innerHTML = `
      <div class="evt-state">
        <div class="evt-state-error">
          <h2>Event not found</h2>
          <p>${escapeHTML(message)}</p>
          ${hint ? `<p style="margin-top: 0.5rem; font-size: 0.9rem;">${escapeHTML(hint)}</p>` : ''}
          <p style="margin-top: 1rem;">
            <a href="/onthisday/">Browse all dates →</a>
          </p>
        </div>
      </div>
    `;
    document.title = 'Event not found | dateandtime.live';
  }

  // ----- Render: loading state -----
  function renderLoading() {
    $('#evt-content').innerHTML = `
      <div class="evt-state">
        <div class="evt-state-spinner"></div>
        <p>Loading event…</p>
      </div>
    `;
  }

  // ----- Render: full event page -----
  function renderEvent(e) {
    const isWedding = e.type === 'wedding';
    const isBirth = e.type === 'birth';
    const isDeath = e.type === 'death';
    const isAnniversary = e.isAnniversaryToday;
    const yearsAgo = e.yearsAgo;

    // Title
    document.title = `${e.title} (${e.year}) | dateandtime.live`;

    // Hero (includes breadcrumb — render the whole hero first)
    const typeLabel = {
      event: 'Historical event',
      birth: 'Famous birthday',
      death: 'Notable death',
      wedding: 'Wedding',
      holiday: 'Holiday',
      anniversary: 'Anniversary'
    }[e.type] || e.type;
    const eyebrowText = isAnniversary ? `🎉 ${yearsAgo} years ago today` : `📅 ${typeLabel}`;

    let regionText = '';
    if (e.countryCode) {
      regionText = ` · ${e.countryCode}`;
      if (e.region) regionText += `, ${e.region}`;
    }

    $('#evt-hero').innerHTML = `
      <div class="container">
        <p class="evt-breadcrumb" id="evt-breadcrumb">
          <a href="/">Home</a> ·
          <a href="/onthisday/">On this day</a> ·
          <a href="${e.knowledgeGraphLinks?.date || '/onthisday/'}">${formatDate(e.month, e.day)}</a> ·
          <span>Event</span>
        </p>
        <p class="evt-eyebrow">${eyebrowText}</p>
        <h1>${escapeHTML(e.title)}</h1>
        <div class="evt-meta">
          <span><span class="evt-year-chip">${e.year}</span></span>
          <span><strong>${formatDate(e.month, e.day)}</strong>${regionText}</span>
          ${e.yearsAgo ? `<span>${e.yearsAgo} years ago</span>` : ''}
        </div>
      </div>
    `;

    // Image
    let imageHTML = '';
    if (e.image && e.image.url) {
      const alt = e.image.alt || e.title;
      const credit = e.image.credit || '';
      const license = e.image.license || 'CC BY-SA 4.0';
      imageHTML = `
        <div class="evt-featured-image">
          <img src="${escapeHTML(e.image.url)}" alt="${escapeHTML(alt)}" loading="eager" />
        </div>
        <p class="evt-image-credit">
          ${credit ? `Image: ${escapeHTML(credit)} · ` : ''}
          <a href="${escapeHTML(e.wikipediaUrl || '#')}" target="_blank" rel="noopener">Wikipedia</a>
          · ${escapeHTML(license)}
        </p>
      `;
    }

    // Brief description
    const briefHTML = e.briefDescription
      ? `<p class="evt-brief">${escapeHTML(e.briefDescription)}</p>`
      : '';

    // Long description
    const longHTML = e.longDescription
      ? `<p class="evt-long">${escapeHTML(e.longDescription)}</p>`
      : '';

    // Key people
    let peopleHTML = '';
    if (e.keyPeople && e.keyPeople.length) {
      peopleHTML = `
        <div class="evt-card">
          <h2><span class="ico">👤</span> Key people</h2>
          <ul class="evt-people">
            ${e.keyPeople.map(p => `<li>${escapeHTML(p)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Key facts
    let factsHTML = '';
    if (e.keyFacts && e.keyFacts.length) {
      factsHTML = `
        <div class="evt-card">
          <h2><span class="ico">💡</span> Key facts</h2>
          <ul class="evt-facts">
            ${e.keyFacts.map(f => `<li>${escapeHTML(f)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // FAQ
    let faqHTML = '';
    if (e.faqQuestions && e.faqQuestions.length) {
      faqHTML = `
        <div class="evt-card">
          <h2><span class="ico">❓</span> Frequently asked questions</h2>
          <ul class="evt-faq">
            ${e.faqQuestions.map(q => `<li><div class="evt-faq-q">${escapeHTML(q)}</div></li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Related events
    let relatedHTML = '';
    if (e.relatedEvents && e.relatedEvents.length) {
      relatedHTML = `
        <div class="evt-card">
          <h2><span class="ico">🔗</span> Related events</h2>
          <div class="evt-related">
            ${e.relatedEvents.slice(0, 5).map(r => {
              const when = r.year ? `${r.year}` :
                          (r.month && r.day ? `${formatDate(r.month, r.day)}` : '');
              return `
                <a class="evt-related-item" href="${escapeHTML(r.wikipediaUrl || '#')}" target="_blank" rel="noopener">
                  <span class="relation">${escapeHTML(r.relation.replace(/-/g, ' '))}</span>
                  <span class="title">${escapeHTML(r.title)}</span>
                  ${when ? `<span class="when">${escapeHTML(when)}</span>` : ''}
                </a>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Main content
    $('#evt-content').innerHTML = `
      <div class="evt-grid">
        <div class="evt-main-col">
          <div class="evt-card">
            ${imageHTML}
            ${briefHTML}
            ${longHTML}
            <div class="evt-attribution">
              ${escapeHTML(e.attribution?.text || 'Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0.')}<br>
              <a href="${escapeHTML(e.attribution?.textUrl || 'https://creativecommons.org/licenses/by-sa/4.0/')}" target="_blank" rel="noopener">${escapeHTML(e.attribution?.textUrlLabel || 'CC BY-SA 4.0')}</a>
              ${e.wikipediaUrl ? ` · <a href="${escapeHTML(e.wikipediaUrl)}" target="_blank" rel="noopener">Read full article on Wikipedia</a>` : ''}
            </div>
          </div>
          ${peopleHTML}
          ${factsHTML}
          ${faqHTML}
        </div>
        <aside class="evt-sidebar">
          <div class="evt-card">
            <h2><span class="ico">📊</span> At a glance</h2>
            <div class="evt-info-row">
              <span class="evt-info-label">Date</span>
              <span class="evt-info-value">${formatDate(e.month, e.day)}, ${e.year}</span>
            </div>
            <div class="evt-info-row">
              <span class="evt-info-label">Type</span>
              <span class="evt-info-value">${escapeHTML(typeLabel)}</span>
            </div>
            ${e.countryCode ? `<div class="evt-info-row">
              <span class="evt-info-label">Country</span>
              <span class="evt-info-value"><a href="/time-zones/in/${e.countryCode.toLowerCase()}/">${escapeHTML(e.countryCode)}</a></span>
            </div>` : ''}
            ${e.rankScore ? `<div class="evt-info-row">
              <span class="evt-info-label">Notability</span>
              <span class="evt-info-value">${e.rankScore}/100</span>
            </div>` : ''}
            ${e.verified ? `<div class="evt-info-row">
              <span class="evt-info-label">Verified</span>
              <span class="evt-info-value">✓ Multi-source</span>
            </div>` : ''}
          </div>
          ${e.knowledgeGraphLinks && Object.keys(e.knowledgeGraphLinks).length ? `
            <div class="evt-card">
              <h2><span class="ico">🕸️</span> Knowledge graph</h2>
              <ul class="evt-kg-list">
                ${e.knowledgeGraphLinks.wikidata ? `<li><a href="${escapeHTML(e.knowledgeGraphLinks.wikidata)}" target="_blank" rel="noopener">Wikidata</a></li>` : ''}
                ${e.knowledgeGraphLinks.wikipedia ? `<li><a href="${escapeHTML(e.knowledgeGraphLinks.wikipedia)}" target="_blank" rel="noopener">Wikipedia</a></li>` : ''}
                ${e.knowledgeGraphLinks.date ? `<li><a href="${escapeHTML(e.knowledgeGraphLinks.date)}">Date page</a></li>` : ''}
                ${e.knowledgeGraphLinks.country ? `<li><a href="${escapeHTML(e.knowledgeGraphLinks.country)}">Country</a></li>` : ''}
              </ul>
            </div>
          ` : ''}
          ${relatedHTML}
        </aside>
      </div>
    `;

    // JSON-LD (Article schema for SEO)
    injectJSONLD(e);
  }

  function injectJSONLD(e) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': e.title,
      'datePublished': `${e.year}-${String(e.month).padStart(2,'0')}-${String(e.day).padStart(2,'0')}`,
      'description': e.briefDescription || `${e.title} (${e.year})`,
      'image': e.image?.url,
      'author': {
        '@type': 'Organization',
        'name': 'dateandtime.live'
      },
      'publisher': {
        '@type': 'Organization',
        'name': 'dateandtime.live',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://dateandtime.live/logo.png'
        }
      },
      'isPartOf': {
        '@type': 'WebSite',
        'name': 'dateandtime.live',
        'url': 'https://dateandtime.live'
      },
      'about': e.knowledgeGraphLinks?.wikidata ? {
        '@type': 'Thing',
        'identifier': e.knowledgeGraphLinks.wikidata
      } : undefined,
      'citation': e.sources?.map(s => s.url).filter(Boolean) || []
    };

    // Remove undefined fields
    Object.keys(schema).forEach(k => schema[k] === undefined && delete schema[k]);

    // Replace any existing JSON-LD
    const existing = document.querySelector('script[type="application/ld+json"][data-source="event-api"]');
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.source = 'event-api';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }

  // ----- API call -----
  async function fetchEvent(slug) {
    // Determine API base
    const apiBase = (window.__API_BASE__ || 'https://api.dateandtime.live') + '/api/v1';
    const url = `${apiBase}/onthisday/event/${encodeURIComponent(slug)}`;

    try {
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        credentials: 'omit'
      });

      if (resp.status === 404) {
        // Try fallback: lookup in per-date files
        const fromFile = await tryFileFallback(slug);
        if (fromFile) return fromFile;
        const err = await resp.json().catch(() => ({}));
        renderError(
          err.error || `No event matches slug "${slug}"`,
          'Try a Wikidata Q-ID (Q11631), Wikipedia title (Apollo_11), or year-title (1969-apollo-11)'
        );
        return null;
      }

      if (!resp.ok) {
        const fromFile = await tryFileFallback(slug);
        if (fromFile) return fromFile;
        renderError(`API error: ${resp.status}`, `Slug: ${slug}`);
        return null;
      }

      const data = await resp.json();
      return data;
    } catch (err) {
      console.warn('API call failed, trying file fallback:', err);
      const fromFile = await tryFileFallback(slug);
      if (fromFile) return fromFile;
      renderError(
        'Network error — could not load event',
        `Slug: ${slug}. Try refreshing or check your connection.`
      );
      return null;
    }
  }

  // ----- File fallback: scan per-date JSON files for the slug -----
  async function tryFileFallback(slug) {
    if (!window.__FALLBACK_DATES_DIR__) return null;
    try {
      const datesDir = window.__FALLBACK_DATES_DIR__;
      // We don't know the date from the slug (year-title would give us year, not month/day).
      // For dev fallback we scan all 366 files — only on failure, with caching.
      const cache = window.__DATE_FILES_CACHE__ || (window.__DATE_FILES_CACHE__ = {});
      let files = cache._files;
      if (!files) {
        // Build a list of all MM-DD.json files we know about
        files = [];
        for (let m = 1; m <= 12; m++) {
          for (let d = 1; d <= 31; d++) {
            const mm = String(m).padStart(2, '0');
            const dd = String(d).padStart(2, '0');
            // Validate day-of-month
            const test = new Date(2024, m - 1, d);
            if (test.getMonth() === m - 1) {
              files.push(`${mm}-${dd}`);
            }
          }
        }
        cache._files = files;
      }

      const hint = getDateHint(slug);
      const slugLower = slug.toLowerCase().replace(/-/g, ' ');

      for (const dateKey of files) {
        if (window.__LOADED_FILES__ && window.__LOADED_FILES__[dateKey]) {
          // Already loaded this date — skip
          continue;
        }
        try {
          const resp = await fetch(`${datesDir}/${dateKey}.json`);
          if (!resp.ok) continue;
          const entries = await resp.json();
          if (!window.__LOADED_FILES__) window.__LOADED_FILES__ = {};
          window.__LOADED_FILES__[dateKey] = entries;

          // Search this file for a match
          for (const entry of entries) {
            if (matchesEntry(entry, slug, hint)) {
              return normalizeEntry(entry, slug);
            }
          }
        } catch (e) {
          // skip file
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function matchesEntry(entry, slug, hint) {
    // Q-ID match
    if (/^Q\d+$/i.test(slug) && entry.wikidata_id === slug) return true;
    // Wikipedia title match
    if (entry.wikipedia_title && entry.wikipedia_title.toLowerCase() === slug.replace(/-/g, '_')) return true;
    // Year-title match
    if (hint && entry.year === hint.year) {
      const eSlug = (entry.title || '').toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      if (eSlug === hint.titleSlug || eSlug.includes(hint.titleSlug) || hint.titleSlug.includes(eSlug)) return true;
    }
    // Fuzzy title match
    const eSlug = (entry.title || '').toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    const sSlug = slug.toLowerCase().replace(/-/g, '-');
    if (eSlug === sSlug || eSlug.includes(sSlug) || sSlug.includes(eSlug)) return true;
    return false;
  }

  function normalizeEntry(e, slug) {
    // Convert raw entry to API-style response
    return {
      title: e.title,
      type: e.type,
      year: e.year,
      month: e.month,
      day: e.day,
      yearPrecision: 'day',
      briefDescription: e.description,
      longDescription: null,
      keyPeople: safeArray(e.people_mentioned),
      keyFacts: safeArray(e.key_facts),
      faqQuestions: safeArray(e.faq_questions),
      image: e.image_url ? {
        url: e.image_url,
        license: e.image_license,
        credit: e.image_credit,
        sourceUrl: e.wikipedia_url
      } : null,
      wikidataId: e.wikidata_id,
      wikipediaUrl: e.wikipedia_url,
      wikipediaTitle: e.wikipedia_title,
      countryCode: e.country_code,
      region: e.region,
      yearsAgo: e.year ? new Date().getFullYear() - e.year : null,
      isAnniversaryToday: false,
      rankScore: e.rank_score || 0,
      sources: safeArray(e.data_sources),
      verified: e.verified === 1,
      relatedEvents: [],
      knowledgeGraphLinks: {
        wikidata: e.wikidata_id ? `https://www.wikidata.org/wiki/${e.wikidata_id}` : null,
        wikipedia: e.wikipedia_url,
        date: e.month && e.day ? `https://dateandtime.live/onthisday/by-date/${String(e.month).padStart(2,'0')}-${String(e.day).padStart(2,'0')}/` : null,
        country: e.country_code ? `https://dateandtime.live/time-zones/in/${e.country_code.toLowerCase()}/` : null
      },
      attribution: {
        text: 'Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0.',
        textUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        textUrlLabel: 'CC BY-SA 4.0'
      }
    };
  }

  function safeArray(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch (e) { return []; }
    }
    return [];
  }

  // ----- Bootstrap -----
  async function init() {
    const slug = getSlugFromURL();
    if (!slug) {
      renderError('No event slug in URL', 'Expected: /onthisday/event/{slug}');
      return;
    }

    renderLoading();

    const event = await fetchEvent(slug);
    if (event) {
      renderEvent(event);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
