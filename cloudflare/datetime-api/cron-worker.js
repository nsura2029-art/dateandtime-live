/**
 * Cloudflare Cron Worker for On This Day Pipeline
 *
 * Runs on Cloudflare Workers with Cron Triggers. Three schedules:
 *
 *   - Daily 03:00 UTC:   Re-validate today's images, re-fetch if broken
 *   - Weekly Sun 04:00:  Refresh upcoming 7 days from all sources
 *   - Monthly 1st 05:00: Re-validate all entries' images, refresh stale descriptions
 *
 * This worker uses the same libraries as the Node.js scripts, but bundled
 * for Cloudflare Workers runtime.
 *
 * Deployment:
 *   wrangler deploy --name otd-cron-worker
 *
 * Required bindings (in wrangler.toml):
 *   - DB: D1 database
 *   - R2: R2 bucket for image storage
 *   - API_BASE: Environment variable with the API base URL
 */

// Inlined libraries (Workers don't easily support require())
// Each library is duplicated here with minimal Workers-compatible code

// ============================================================================
// IMAGE FALLBACK (5-tier) — Workers-compatible version
// ============================================================================

async function getImageForEntry(entry, opts = {}) {
  if (!entry) return null;
  
  // Tier 1: Try Wikidata
  if (entry.wikidata_id || (entry.external_id && entry.external_id.startsWith('Q'))) {
    const wikidataId = entry.wikidata_id || entry.external_id;
    const img = await getWikidataImage(wikidataId);
    if (img) return { ...img, alt: generateAltText(entry), tier: 1 };
  }
  
  // Tier 2: Try Wikipedia
  if (entry.wikipedia_url) {
    const img = await getWikipediaImage(entry.wikipedia_url);
    if (img) return { ...img, alt: generateAltText(entry), tier: 2 };
  }
  
  // Tier 3: Try Commons search
  const commonsQuery = entry.title + (entry.year ? ' ' + entry.year : '');
  const img3 = await getCommonsImage(commonsQuery);
  if (img3) return { ...img3, alt: generateAltText(entry), tier: 3 };
  
  // Tier 4: External (NASA, Smithsonian) - skipped in Worker to save time
  
  // Tier 5: Generated placeholder
  if (opts.skipGenerated) return null;
  return { ...getGeneratedPlaceholder(entry), alt: generateAltText(entry), tier: 5 };
}

async function getWikidataImage(wikidataId) {
  if (!wikidataId) return null;
  const sparql = `SELECT ?image WHERE { wd:${wikidataId} wdt:P18 ?image . } LIMIT 1`;
  try {
    const res = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: {
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'dateandtime.live/1.0'
      },
      body: 'query=' + encodeURIComponent(sparql)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const binding = data.results?.bindings?.[0];
    if (!binding) return null;
    return {
      url: binding.image.value,
      source: 'wikidata',
      source_url: binding.image.value,
      license: 'unknown',
      credit: 'Wikimedia Commons'
    };
  } catch {
    return null;
  }
}

async function getWikipediaImage(wikipediaUrl) {
  if (!wikipediaUrl) return null;
  const match = wikipediaUrl.match(/\/wiki\/(.+?)(?:#|$|\?)/);
  if (!match) return null;
  const title = decodeURIComponent(match[1]).replace(/_/g, ' ');
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': 'dateandtime.live/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const imageUrl = data.originalimage?.source || data.thumbnail?.source;
    if (!imageUrl) return null;
    return {
      url: imageUrl,
      source: 'wikipedia',
      source_url: data.content_urls?.desktop?.page || wikipediaUrl,
      license: 'CC-BY-SA',
      credit: 'Wikipedia'
    };
  } catch {
    return null;
  }
}

async function getCommonsImage(query) {
  if (!query) return null;
  try {
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=1`,
      { headers: { 'User-Agent': 'dateandtime.live/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.query?.search || [];
    if (results.length === 0) return null;
    const filename = results[0].title.replace('File:', '');
    const infoRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url|size&format=json`,
      { headers: { 'User-Agent': 'dateandtime.live/1.0' } }
    );
    if (!infoRes.ok) return null;
    const infoData = await infoRes.json();
    const page = Object.values(infoData.query?.pages || {})[0];
    if (!page?.imageinfo?.[0]) return null;
    const info = page.imageinfo[0];
    if ((info.width || 0) < 600 || (info.height || 0) < 400) return null;
    return {
      url: info.thumburl || info.url,
      source: 'commons',
      source_url: info.descriptionurl,
      license: 'CC-BY-SA',
      credit: 'Wikimedia Commons',
      width: info.width,
      height: info.height,
      fileSize: info.size
    };
  } catch {
    return null;
  }
}

function getGeneratedPlaceholder(entry) {
  const { title = 'Historical Event', year = '', subcategory = '', type = 'event' } = entry;
  const categoryKey = subcategory || type;
  
  const gradients = {
    event: { from: '#5b4aaf', to: '#7c3aed' },
    birth: { from: '#059669', to: '#10b981' },
    death: { from: '#4b5563', to: '#374151' },
    wedding: { from: '#ec4899', to: '#f472b6' },
    divorce: { from: '#dc2626', to: '#f87171' },
    bizarre: { from: '#f59e0b', to: '#fbbf24' },
    science: { from: '#0891b2', to: '#06b6d4' },
    space: { from: '#312e81', to: '#6366f1' },
    war: { from: '#7c2d12', to: '#9a3412' },
    politics: { from: '#991b1b', to: '#dc2626' },
    sports: { from: '#ea580c', to: '#fb923c' },
    music: { from: '#a21caf', to: '#d946ef' },
    film: { from: '#be185d', to: '#ec4899' },
    tech: { from: '#1e40af', to: '#3b82f6' },
    finance: { from: '#166534', to: '#22c55e' },
    health: { from: '#0d9488', to: '#14b8a6' }
  };
  
  const gradient = gradients[categoryKey] || gradients.event;
  
  const emojis = {
    event: '📅', birth: '🎂', death: '⚰️', wedding: '💍', divorce: '💔',
    bizarre: '🎭', science: '🔬', space: '🚀', war: '⚔️', politics: '🏛️',
    sports: '🏆', music: '🎵', film: '🎬', tech: '💻', finance: '💰',
    health: '🏥'
  };
  const emoji = emojis[categoryKey] || emojis[type] || '📅';
  
  const safeTitle = (title || '').slice(0, 50)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient.from}"/>
      <stop offset="100%" stop-color="${gradient.to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <text x="600" y="320" font-size="220" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="600" y="540" font-family="ui-sans-serif, system-ui" font-size="48" font-weight="700" text-anchor="middle" fill="white">${safeTitle}</text>
  ${year ? `<text x="600" y="610" font-family="ui-sans-serif, system-ui" font-size="36" text-anchor="middle" fill="rgba(255,255,255,0.85)">${year}</text>` : ''}
  <text x="600" y="740" font-family="ui-sans-serif, system-ui" font-size="20" text-anchor="middle" fill="rgba(255,255,255,0.6)">dateandtime.live</text>
</svg>`;
  
  return {
    url: 'data:image/svg+xml;base64,' + btoa(svg),
    source: 'generated',
    license: 'generated',
    credit: 'dateandtime.live',
    width: 1200,
    height: 800,
    placeholder: true
  };
}

function generateAltText(entry) {
  const parts = [];
  if (entry.title) parts.push(entry.title);
  if (entry.year) parts.push(`(${entry.year})`);
  if (entry.country_code) parts.push(`[${entry.country_code}]`);
  return parts.join(' ').slice(0, 200);
}

// ============================================================================
// VALIDATION (lightweight, Workers-compatible)
// ============================================================================

async function validateImageUrl(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return false;
    const contentLength = parseInt(res.headers.get('content-length') || '0');
    if (contentLength > 0 && contentLength < 15000) return false;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// MAIN WORKER HANDLER
// ============================================================================

export default {
  // HTTP handler for manual triggers / health checks
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    if (url.pathname === '/trigger/daily') {
      ctx.waitUntil(runDailyMaintenance(env));
      return new Response('Daily maintenance triggered', { status: 202 });
    }
    
    if (url.pathname === '/trigger/weekly') {
      ctx.waitUntil(runWeeklyMaintenance(env));
      return new Response('Weekly maintenance triggered', { status: 202 });
    }
    
    if (url.pathname === '/trigger/monthly') {
      ctx.waitUntil(runMonthlyMaintenance(env));
      return new Response('Monthly maintenance triggered', { status: 202 });
    }
    
    if (url.pathname === '/trigger/improve') {
      const target = url.searchParams.get('id');
      if (target) {
        ctx.waitUntil(improveEntry(env, parseInt(target)));
        return new Response(`Improvement triggered for entry ${target}`, { status: 202 });
      }
      return new Response('Missing id parameter', { status: 400 });
    }
    
    return new Response('Not found', { status: 404 });
  },
  
  // Cron Triggers
  async scheduled(event, env, ctx) {
    const cron = event.cron;
    const utcHour = new Date(event.scheduledTime).getUTCHours();
    const utcDay = new Date(event.scheduledTime).getUTCDay();  // 0=Sun
    const utcDate = new Date(event.scheduledTime).getUTCDate();
    
    console.log(`Cron triggered: ${cron} at ${new Date(event.scheduledTime).toISOString()}`);
    
    // Daily at 03:00 UTC
    if (utcHour === 3) {
      ctx.waitUntil(runDailyMaintenance(env));
    }
    // Weekly Sunday at 04:00 UTC
    else if (utcHour === 4 && utcDay === 0) {
      ctx.waitUntil(runWeeklyMaintenance(env));
    }
    // Monthly 1st at 05:00 UTC
    else if (utcHour === 5 && utcDate === 1) {
      ctx.waitUntil(runMonthlyMaintenance(env));
    }
  }
};

/**
 * Daily maintenance: re-validate today's images, refresh today's data
 */
async function runDailyMaintenance(env) {
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  
  console.log(`[Daily] Validating images for ${month}-${day}...`);
  
  try {
    // 1. Re-validate all images for today's date
    const { results } = await env.DB.prepare(
      'SELECT id, title, image_url, image_status FROM onthisday WHERE month = ? AND day = ? AND image_url IS NOT NULL AND image_status != ?'
    ).bind(month, day, 'generated').all();
    
    let revalidated = 0, broken = 0, fixed = 0;
    
    for (const entry of results || []) {
      revalidated++;
      const isValid = await validateImageUrl(entry.image_url);
      if (!isValid) {
        broken++;
        // Try to fetch a new image
        const fullEntry = await env.DB.prepare('SELECT * FROM onthisday WHERE id = ?').bind(entry.id).first();
        if (fullEntry) {
          const newImage = await getImageForEntry(fullEntry);
          if (newImage && newImage.url && newImage.source !== 'generated') {
            await env.DB.prepare(
              'UPDATE onthisday SET image_url = ?, image_status = ?, image_license = ?, image_credit = ?, image_last_checked = ? WHERE id = ?'
            ).bind(
              newImage.url,
              newImage.source,
              newImage.license || null,
              newImage.credit || null,
              new Date().toISOString(),
              entry.id
            ).run();
            fixed++;
          } else {
            // Mark as failed
            await env.DB.prepare(
              'UPDATE onthisday SET image_status = ?, image_last_checked = ? WHERE id = ?'
            ).bind('failed', new Date().toISOString(), entry.id).run();
          }
        }
      } else {
        // Update last_checked
        await env.DB.prepare(
          'UPDATE onthisday SET image_last_checked = ? WHERE id = ?'
        ).bind(new Date().toISOString(), entry.id).run();
      }
    }
    
    console.log(`[Daily] ${revalidated} revalidated, ${broken} broken, ${fixed} fixed`);
    
    // 2. Update image_last_checked for the date
    await env.DB.prepare(
      'UPDATE onthisday SET image_last_checked = ? WHERE month = ? AND day = ? AND image_url IS NOT NULL'
    ).bind(new Date().toISOString(), month, day).run();
    
  } catch (err) {
    console.error('[Daily] Error:', err.message);
  }
}

/**
 * Weekly maintenance: refresh upcoming 7 days
 */
async function runWeeklyMaintenance(env) {
  console.log('[Weekly] Refreshing upcoming 7 days...');
  
  const today = new Date();
  let totalImproved = 0;
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    
    try {
      // Find entries with low quality score and try to improve them
      const { results } = await env.DB.prepare(
        'SELECT * FROM onthisday WHERE month = ? AND day = ? AND quality_score < 70 LIMIT 50'
      ).bind(month, day).all();
      
      for (const entry of results || []) {
        const improved = await improveEntryInWorker(env, entry);
        if (improved) totalImproved++;
      }
    } catch (err) {
      console.error(`[Weekly] Error for ${month}-${day}:`, err.message);
    }
  }
  
  console.log(`[Weekly] Improved ${totalImproved} entries`);
}

/**
 * Monthly maintenance: re-validate all images, re-score all entries
 */
async function runMonthlyMaintenance(env) {
  console.log('[Monthly] Re-validating all images...');
  
  try {
    // Get all entries with images that haven't been checked in 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { results } = await env.DB.prepare(
      'SELECT id, image_url FROM onthisday WHERE image_url IS NOT NULL AND image_status != ? AND (image_last_checked IS NULL OR image_last_checked < ?)'
    ).bind('generated', thirtyDaysAgo.toISOString()).all();
    
    let revalidated = 0, broken = 0;
    
    for (const entry of results || []) {
      revalidated++;
      const isValid = await validateImageUrl(entry.image_url);
      if (!isValid) {
        broken++;
        await env.DB.prepare(
          'UPDATE onthisday SET image_status = ? WHERE id = ?'
        ).bind('failed', entry.id).run();
      } else {
        await env.DB.prepare(
          'UPDATE onthisday SET image_last_checked = ? WHERE id = ?'
        ).bind(new Date().toISOString(), entry.id).run();
      }
    }
    
    console.log(`[Monthly] ${revalidated} revalidated, ${broken} broken`);
    
    // Generate quality report
    await generateQualityReport(env);
  } catch (err) {
    console.error('[Monthly] Error:', err.message);
  }
}

/**
 * Improve a single entry (called from cron or HTTP trigger)
 */
async function improveEntry(env, id) {
  const entry = await env.DB.prepare('SELECT * FROM onthisday WHERE id = ?').bind(id).first();
  if (!entry) {
    console.error(`[Improve] Entry ${id} not found`);
    return;
  }
  const improved = await improveEntryInWorker(env, entry);
  console.log(`[Improve] Entry ${id}: ${improved ? 'improved' : 'no changes'}`);
}

/**
 * Improve a single entry's missing fields.
 * Inlined version of the Node.js improveEntry, Workers-compatible.
 */
async function improveEntryInWorker(env, entry) {
  let changed = false;
  const updates = [];
  const params = [];
  
  // 1. Missing image
  if (!entry.image_url || entry.image_status === 'missing' || entry.image_status === 'failed') {
    const image = await getImageForEntry(entry);
    if (image && image.url && image.source !== 'generated') {
      updates.push('image_url = ?', 'image_status = ?', 'image_license = ?', 'image_credit = ?', 'image_alt = ?', 'image_last_checked = ?');
      params.push(image.url, image.source, image.license || null, image.credit || null, image.alt, new Date().toISOString());
      changed = true;
    }
  }
  
  // 2. Missing long_description — fetch from Wikipedia if we have a URL
  if ((!entry.long_description || entry.long_description.length < 200) && entry.wikipedia_url) {
    const match = entry.wikipedia_url.match(/\/wiki\/(.+?)(?:#|$|\?)/);
    if (match) {
      const title = decodeURIComponent(match[1]).replace(/_/g, ' ');
      try {
        const res = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
          { headers: { 'User-Agent': 'dateandtime.live/1.0' } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.extract) {
            updates.push('long_description = ?');
            params.push(data.extract.slice(0, 3000));
            changed = true;
          }
        }
      } catch {}
    }
  }
  
  // 3. Add Wikipedia to data_sources if not present
  let dataSources = [];
  try { dataSources = JSON.parse(entry.data_sources || '[]'); } catch {}
  if (entry.wikipedia_url && !dataSources.find(s => s.url === entry.wikipedia_url)) {
    dataSources.push({ name: 'wikipedia', url: entry.wikipedia_url, retrieved_at: new Date().toISOString() });
    updates.push('data_sources = ?');
    params.push(JSON.stringify(dataSources));
    changed = true;
  }
  
  // 4. Recalculate quality_score
  if (changed) {
    const newScore = calculateQualityScore({ ...entry, image_url: updates[0] === 'image_url = ?' ? params[0] : entry.image_url });
    updates.push('quality_score = ?', 'updated_at = ?');
    params.push(newScore, new Date().toISOString());
    
    // Apply update
    const sql = `UPDATE onthisday SET ${updates.join(', ')} WHERE id = ?`;
    params.push(entry.id);
    await env.DB.prepare(sql).bind(...params).run();
    
    return true;
  }
  
  return false;
}

/**
 * Calculate quality score (lightweight version for Workers)
 */
function calculateQualityScore(entry) {
  let score = 0;
  if (entry.image_url) score += 15;
  if (entry.long_description && entry.long_description.length >= 200) score += 15;
  if (entry.description && entry.description.length >= 50) score += 10;
  if (entry.wikipedia_url) score += 10;
  
  let sources = 0;
  try { sources = JSON.parse(entry.data_sources || '[]').length; } catch {}
  if (sources >= 2) score += 5;
  
  if (entry.country_code) score += 10;
  if (entry.category) score += 5;
  
  let peopleCount = 0;
  try { peopleCount = JSON.parse(entry.people_mentioned || '[]').length; } catch {}
  if (peopleCount >= 3) score += 10;
  
  let kwCount = 0;
  try { kwCount = JSON.parse(entry.search_keywords || '[]').length; } catch {}
  if (kwCount >= 5) score += 5;
  
  let tagCount = 0;
  try { tagCount = JSON.parse(entry.tags || '[]').length; } catch {}
  if (tagCount >= 3) score += 5;
  
  // Freshness
  if (entry.updated_at) {
    const updated = new Date(entry.updated_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (updated > thirtyDaysAgo) score += 5;
  }
  
  return Math.min(100, score);
}

/**
 * Generate a quality report and store it in the database
 */
async function generateQualityReport(env) {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM onthisday').all();
    const entries = results || [];
    
    let gold = 0, silver = 0, bronze = 0, blocked = 0;
    let missingImages = 0, missingDescriptions = 0, missingWiki = 0;
    let totalScore = 0;
    
    for (const entry of entries) {
      const score = calculateQualityScore(entry);
      totalScore += score;
      if (score >= 90) gold++;
      else if (score >= 70) silver++;
      else if (score >= 50) bronze++;
      else blocked++;
      
      if (!entry.image_url) missingImages++;
      if (!entry.description || entry.description.length < 50) missingDescriptions++;
      if (!entry.wikipedia_url) missingWiki++;
    }
    
    const report = {
      total: entries.length,
      by_tier: { gold, silver, bronze, blocked },
      avg_score: entries.length > 0 ? Math.round(totalScore / entries.length) : 0,
      missing_images: missingImages,
      missing_descriptions: missingDescriptions,
      missing_wikipedia: missingWiki,
      generated_at: new Date().toISOString()
    };
    
    await env.DB.prepare(
      'INSERT INTO otd_quality_reports (total_entries, gold_count, silver_count, bronze_count, blocked_count, missing_images, missing_descriptions, missing_wiki, avg_score, report_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      report.total,
      report.by_tier.gold,
      report.by_tier.silver,
      report.by_tier.bronze,
      report.by_tier.blocked,
      report.missing_images,
      report.missing_descriptions,
      report.missing_wiki,
      report.avg_score,
      JSON.stringify(report)
    ).run();
    
    console.log(`[Quality Report] ${report.total} entries, avg ${report.avg_score}/100, ${gold} gold / ${silver} silver / ${bronze} bronze / ${blocked} blocked`);
  } catch (err) {
    console.error('[Quality Report] Error:', err.message);
  }
}
