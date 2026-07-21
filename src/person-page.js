/**
 * Per-person detail page client
 * URL: /person/{slug}
 *   /person/Einstein
 *   /person/Q937
 *   /person/albert-einstein
 * Calls: GET /api/v1/person/{slug}
 *
 * Static HTML shell, hydrated by this script. Falls back to JSON if the
 * API isn't available (dev / pre-deploy).
 */

(function() {
  'use strict';

  // ----- Slug detection -----
  function getSlugFromURL() {
    const m = window.location.pathname.match(/\/person\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : null;
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

  const ZODIAC_EMOJI = {
    aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋', leo: '♌', virgo: '♍',
    libra: '♎', scorpio: '♏', sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓'
  };
  const CHINESE_EMOJI = {
    rat: '🐀', ox: '🐂', tiger: '🐅', rabbit: '🐇', dragon: '🐉', snake: '🐍',
    horse: '🐎', goat: '🐐', monkey: '🐒', rooster: '🐓', dog: '🐕', pig: '🐖'
  };

  // ----- Render: error state -----
  function renderError(message, hint) {
    $('#prs-content').innerHTML = `
      <div class="prs-state">
        <div class="prs-state-error">
          <h2>Person not found</h2>
          <p>${escapeHTML(message)}</p>
          ${hint ? `<p style="margin-top: 0.5rem; font-size: 0.9rem;">${escapeHTML(hint)}</p>` : ''}
          <p style="margin-top: 1rem;">
            <a href="/onthisday/born/">Browse famous birthdays →</a>
          </p>
        </div>
      </div>
    `;
    document.title = 'Person not found | dateandtime.live';
  }

  // ----- Render: loading state -----
  function renderLoading() {
    $('#prs-content').innerHTML = `
      <div class="prs-state">
        <div class="prs-state-spinner"></div>
        <p>Loading person…</p>
      </div>
    `;
  }

  // ----- Render: full person page -----
  function renderPerson(p) {
    const isDeceased = p.deathDate || p.deathYear;
    const lifespan = p.birthYear && p.deathYear
      ? `${p.birthYear} – ${p.deathYear} (${p.deathYear - p.birthYear} years)`
      : p.birthYear
        ? `Born ${p.birthYear}`
        : '';

    // Title
    document.title = `${p.label} | dateandtime.live`;

    // Hero
    const portrait = p.image?.url
      ? `<img src="${escapeHTML(p.image.url)}" alt="${escapeHTML(p.label)}" loading="eager" />`
      : `<span class="prs-portrait-fallback">${escapeHTML((p.label || '?').charAt(0))}</span>`;

    const heroImageCredit = p.image?.credit
      ? `<p class="prs-image-credit" style="color: rgba(255,255,255,0.75); font-size: 0.75rem; margin: 0.5rem 0 0 0; text-align: center;">Image: ${escapeHTML(p.image.credit)} · <a href="https://creativecommons.org/licenses/by-sa/4.0/" style="color: #fff;" target="_blank" rel="noopener">CC BY-SA 4.0</a></p>`
      : '';

    // Render the hero (which includes the breadcrumb) first
    $('#prs-hero').innerHTML = `
      <div class="container">
        <p class="prs-breadcrumb" id="prs-breadcrumb">
          <a href="/">Home</a> ·
          <a href="/onthisday/">On this day</a> ·
          <a href="/onthisday/born/">Birthdays</a> ·
          <span>${escapeHTML(p.label)}</span>
        </p>
        <div class="prs-hero-grid">
          <div>
            <div class="prs-portrait">${portrait}</div>
            ${heroImageCredit}
          </div>
          <div>
            <p class="prs-eyebrow">👤 ${isDeceased ? 'Notable person' : 'Living person'}</p>
            <h1>${escapeHTML(p.label)}</h1>
            <div class="prs-meta">
              ${lifespan ? `<span><span class="prs-life-years">${escapeHTML(lifespan)}</span></span>` : ''}
              ${p.countryCode ? `<span><strong>From</strong> ${escapeHTML(p.countryCode)}</span>` : ''}
              ${Array.isArray(p.profession) && p.profession.length ? `<span><strong>${escapeHTML(p.profession.slice(0, 2).join(' · '))}</strong></span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    // Brief description
    const briefHTML = p.briefDescription || p.description
      ? `<p class="prs-brief">${escapeHTML(p.briefDescription || p.description)}</p>`
      : '';

    // Long description
    const longHTML = p.longDescription && p.longDescription !== p.briefDescription
      ? `<p class="prs-long" style="margin-top: 1rem;">${escapeHTML(p.longDescription)}</p>`
      : '';

    // Profession chips
    let profHTML = '';
    if (Array.isArray(p.profession) && p.profession.length) {
      profHTML = `
        <div class="prs-card">
          <h2><span class="ico">💼</span> Profession</h2>
          <ul class="prs-chips">
            ${p.profession.map(x => `<li>${escapeHTML(x)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Zodiac / star sign
    let zodiacHTML = '';
    if (p.starSign || p.chineseZodiac) {
      const se = ZODIAC_EMOJI[p.starSign?.toLowerCase()] || '✨';
      const ce = CHINESE_EMOJI[p.chineseZodiac?.toLowerCase()] || '🐉';
      zodiacHTML = `
        <div class="prs-card">
          <h2><span class="ico">✨</span> Zodiac</h2>
          <div class="prs-zodiac">
            ${p.starSign ? `<div class="prs-zodiac-tile">
              <div class="prs-zodiac-emoji">${se}</div>
              <div class="prs-zodiac-name">${escapeHTML(p.starSign)}</div>
              <div class="prs-zodiac-sub">Western sign</div>
            </div>` : ''}
            ${p.chineseZodiac ? `<div class="prs-zodiac-tile">
              <div class="prs-zodiac-emoji">${ce}</div>
              <div class="prs-zodiac-name">${escapeHTML(p.chineseZodiac)}</div>
              <div class="prs-zodiac-sub">Chinese zodiac</div>
            </div>` : ''}
          </div>
        </div>
      `;
    }

    // OTD entries
    let otdHTML = '';
    const otdEntries = p.onthisdayEntries || [];
    if (otdEntries.length) {
      otdHTML = `
        <div class="prs-card">
          <h2><span class="ico">📅</span> On this day — related events</h2>
          <ul class="prs-otd">
            ${otdEntries.slice(0, 8).map(e => `
              <li>
                ${e.image?.url ? `<img class="prs-otd-img" src="${escapeHTML(e.image.url)}" alt="" loading="lazy" />` : ''}
                <div>
                  <span class="prs-otd-type">${escapeHTML(e.type || 'event')}</span>
                  <span class="prs-otd-year">${e.year ? new Date(e.year, 0).getFullYear() : ''}</span>
                </div>
                <div class="prs-otd-title">${escapeHTML(e.title || e.description || '').slice(0, 120)}</div>
                ${e.wikipediaUrl ? `<a class="prs-otd-link" href="${escapeHTML(e.wikipediaUrl)}" target="_blank" rel="noopener">Wikipedia →</a>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    // Main content
    $('#prs-content').innerHTML = `
      <div class="prs-grid">
        <div class="prs-main-col">
          <div class="prs-card">
            ${briefHTML}
            ${longHTML}
            <div class="prs-attribution">
              ${escapeHTML(p.attribution?.text || 'Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0.')}<br>
              <a href="${escapeHTML(p.attribution?.textUrl || 'https://creativecommons.org/licenses/by-sa/4.0/')}" target="_blank" rel="noopener">CC BY-SA 4.0</a>
              ${p.knowledgeGraphLinks?.wikipedia ? ` · <a href="${escapeHTML(p.knowledgeGraphLinks.wikipedia)}" target="_blank" rel="noopener">Read full article on Wikipedia</a>` : ''}
            </div>
          </div>
          ${profHTML}
          ${zodiacHTML}
          ${otdHTML}
        </div>
        <aside class="prs-sidebar">
          <div class="prs-card">
            <h2><span class="ico">📊</span> At a glance</h2>
            ${p.birthDate ? `<div class="prs-info-row"><span class="prs-info-label">Born</span><span class="prs-info-value">${escapeHTML(p.birthDate)}</span></div>` : ''}
            ${p.deathDate ? `<div class="prs-info-row"><span class="prs-info-label">Died</span><span class="prs-info-value">${escapeHTML(p.deathDate)}</span></div>` : ''}
            ${p.ageAtDeath ? `<div class="prs-info-row"><span class="prs-info-label">Age at death</span><span class="prs-info-value">${p.ageAtDeath}</span></div>` : ''}
            ${p.currentAge ? `<div class="prs-info-row"><span class="prs-info-label">Current age</span><span class="prs-info-value">${p.currentAge}</span></div>` : ''}
            ${p.generation ? `<div class="prs-info-row"><span class="prs-info-label">Generation</span><span class="prs-info-value">${escapeHTML(p.generation.replace(/_/g, ' '))}</span></div>` : ''}
            ${p.causeOfDeath ? `<div class="prs-info-row"><span class="prs-info-label">Cause of death</span><span class="prs-info-value">${escapeHTML(p.causeOfDeath)}</span></div>` : ''}
            ${p.countryCode ? `<div class="prs-info-row"><span class="prs-info-label">Country</span><span class="prs-info-value"><a href="/time-zones/in/${p.countryCode.toLowerCase()}/">${escapeHTML(p.countryCode)}</a></span></div>` : ''}
            ${p.notabilityScore ? `<div class="prs-info-row"><span class="prs-info-label">Notability</span><span class="prs-info-value">${p.notabilityScore}/100</span></div>` : ''}
            ${p.sitelinks ? `<div class="prs-info-row"><span class="prs-info-label">Sitelinks</span><span class="prs-info-value">${p.sitelinks}</span></div>` : ''}
          </div>
          ${p.knowledgeGraphLinks && Object.keys(p.knowledgeGraphLinks).length ? `
            <div class="prs-card">
              <h2><span class="ico">🕸️</span> Knowledge graph</h2>
              <ul class="prs-kg-list">
                ${p.knowledgeGraphLinks.wikidata ? `<li><a href="${escapeHTML(p.knowledgeGraphLinks.wikidata)}" target="_blank" rel="noopener">Wikidata</a></li>` : ''}
                ${p.knowledgeGraphLinks.wikipedia ? `<li><a href="${escapeHTML(p.knowledgeGraphLinks.wikipedia)}" target="_blank" rel="noopener">Wikipedia</a></li>` : ''}
                ${p.knowledgeGraphLinks.bornOnPage ? `<li><a href="${escapeHTML(p.knowledgeGraphLinks.bornOnPage)}">Born on</a></li>` : ''}
                ${p.knowledgeGraphLinks.diedOnPage ? `<li><a href="${escapeHTML(p.knowledgeGraphLinks.diedOnPage)}">Died on</a></li>` : ''}
                ${p.knowledgeGraphLinks.profile ? `<li><a href="${escapeHTML(p.knowledgeGraphLinks.profile)}">Profile</a></li>` : ''}
              </ul>
            </div>
          ` : ''}
        </aside>
      </div>
    `;

    injectJSONLD(p);
  }

  function injectJSONLD(p) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      'name': p.label,
      'description': p.briefDescription || p.description,
      'image': p.image?.url,
      'url': `https://dateandtime.live/person/${p.id}/`,
      'birthDate': p.birthDate,
      'deathDate': p.deathDate,
      'nationality': p.countryCode ? {
        '@type': 'Country',
        'name': p.countryCode
      } : undefined,
      'jobTitle': Array.isArray(p.profession) ? p.profession[0] : undefined,
      'knowsAbout': Array.isArray(p.profession) ? p.profession : undefined,
      'isPartOf': {
        '@type': 'WebSite',
        'name': 'dateandtime.live',
        'url': 'https://dateandtime.live'
      },
      'sameAs': [
        p.knowledgeGraphLinks?.wikidata,
        p.knowledgeGraphLinks?.wikipedia
      ].filter(Boolean),
      'citation': p.sources?.map(s => s.url).filter(Boolean) || []
    };
    Object.keys(schema).forEach(k => schema[k] === undefined && delete schema[k]);
    Object.keys(schema).forEach(k => Array.isArray(schema[k]) && schema[k].length === 0 && delete schema[k]);

    const existing = document.querySelector('script[type="application/ld+json"][data-source="person-api"]');
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.source = 'person-api';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }

  // ----- API call -----
  async function fetchPerson(slug) {
    const apiBase = (window.__API_BASE__ || 'https://api.dateandtime.live') + '/api/v1';
    const url = `${apiBase}/person/${encodeURIComponent(slug)}`;

    try {
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        credentials: 'omit'
      });

      if (resp.status === 404) {
        const fromFile = await tryFileFallback(slug);
        if (fromFile) return fromFile;
        renderError(
          `No person matches slug "${slug}"`,
          'Try a Wikidata Q-ID (Q937), name (einstein), or full-name slug (albert-einstein)'
        );
        return null;
      }

      if (!resp.ok) {
        const fromFile = await tryFileFallback(slug);
        if (fromFile) return fromFile;
        renderError(`API error: ${resp.status}`, `Slug: ${slug}`);
        return null;
      }

      return await resp.json();
    } catch (err) {
      console.warn('API call failed, trying file fallback:', err);
      const fromFile = await tryFileFallback(slug);
      if (fromFile) return fromFile;
      renderError(
        'Network error — could not load person',
        `Slug: ${slug}. Try refreshing or check your connection.`
      );
      return null;
    }
  }

  // ----- File fallback -----
  async function tryFileFallback(slug) {
    if (!window.__FALLBACK_PERSONS_FILE__) return null;
    try {
      const resp = await fetch(window.__FALLBACK_PERSONS_FILE__);
      if (!resp.ok) return null;
      const persons = await resp.json();
      const qid = slug.match(/^Q\d+$/i)?.[0];
      const slugLower = slug.toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
      const match = persons.find(p => {
        if (qid && p.wikidata_id === qid) return true;
        if (p.label && p.label.toLowerCase().replace(/[^a-z0-9]/g, '_') === slugLower) return true;
        if (p.wikipedia_title && p.wikipedia_title.toLowerCase() === slugLower) return true;
        if (p.label && p.label.toLowerCase().split(/\s+/).includes(slugLower.replace(/_/g, ' '))) return true;
        if (p.label && slugLower.split('_').some(part => p.label.toLowerCase().includes(part))) return true;
        return false;
      });
      if (!match) return null;
      return normalizePerson(match, slug);
    } catch (e) {
      return null;
    }
  }

  function normalizePerson(p, slug) {
    return {
      id: p.wikidata_id,
      label: p.label,
      description: p.description,
      briefDescription: p.description,
      longDescription: p.knownFor || null,
      entityType: 'person',
      wikidataId: p.wikidata_id,
      wikipediaTitle: p.wikipedia_title,
      birthDate: p.birth_date,
      deathDate: p.death_date,
      birthYear: p.birth_year,
      deathYear: p.death_year,
      countryCode: p.country_code,
      profession: Array.isArray(p.profession) ? p.profession : (p.profession ? [p.profession] : []),
      starSign: p.star_sign,
      chineseZodiac: p.chinese_zodiac,
      generation: p.generation,
      causeOfDeath: p.cause_of_death,
      ageAtDeath: p.age_at_death,
      currentAge: p.current_age,
      image: p.image_url ? {
        url: p.image_url,
        license: p.image_license,
        credit: p.image_credit
      } : null,
      sitelinks: p.sitelinks,
      notabilityScore: p.notability_score || p.rank_score,
      onthisdayEntries: [],
      knowledgeGraphLinks: {
        wikidata: p.wikidata_id ? `https://www.wikidata.org/wiki/${p.wikidata_id}` : null,
        wikipedia: p.wikipedia_title ? `https://en.wikipedia.org/wiki/${p.wikipedia_title}` : null,
        bornOnPage: p.birth_month && p.birth_day
          ? `https://dateandtime.live/onthisday/born/${String(p.birth_month).padStart(2,'0')}-${String(p.birth_day).padStart(2,'0')}/`
          : null,
        diedOnPage: p.death_month && p.death_day
          ? `https://dateandtime.live/onthisday/died/${String(p.death_month).padStart(2,'0')}-${String(p.death_day).padStart(2,'0')}/`
          : null,
        profile: `https://dateandtime.live/person/${slug}/`
      },
      sources: [],
      attribution: {
        text: 'Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0.',
        textUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        textUrlLabel: 'CC BY-SA 4.0'
      }
    };
  }

  // ----- Bootstrap -----
  async function init() {
    const slug = getSlugFromURL();
    if (!slug) {
      renderError('No person slug in URL', 'Expected: /person/{slug}');
      return;
    }

    renderLoading();

    const person = await fetchPerson(slug);
    if (person) {
      renderPerson(person);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
