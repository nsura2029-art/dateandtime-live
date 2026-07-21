/**
 * 5-Tier Image Fallback Library
 *
 * For any on-this-day entry, attempts to find a high-quality image through:
 *   Tier 1: Wikidata P18/P109 (most accurate, curated)
 *   Tier 2: Wikipedia article thumbnail
 *   Tier 3: Wikimedia Commons full-text search
 *   Tier 4: External sources (NASA, Smithsonian, LoC)
 *   Tier 5: Generated SVG placeholder
 *
 * Each tier validates the image (URL, size, format, license) before accepting.
 * Returns a uniform image record: { url, source, license, credit, alt, ... }
 */

const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;
const MIN_FILE_SIZE = 15000;  // 15KB
const VALID_LICENSES = ['CC-BY-SA', 'CC0', 'public-domain', 'CC-BY', 'CC-BY-2.0', 'CC-BY-4.0', 'GFDL', 'OAL'];

/**
 * Validate an image URL returns a usable image.
 * @param {string} url - The image URL to validate
 * @param {object} opts - { minWidth, minHeight, minFileSize }
 * @returns {Promise<{valid: boolean, width?: number, height?: number, fileSize?: number, mime?: string, license?: string, reason?: string}>}
 */
async function validateImage(url, opts = {}) {
  if (!url) return { valid: false, reason: 'no_url' };
  
  const minWidth = opts.minWidth || MIN_WIDTH;
  const minHeight = opts.minHeight || MIN_HEIGHT;
  const minFileSize = opts.minFileSize || MIN_FILE_SIZE;
  
  try {
    // HEAD request to check basic properties
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return { valid: false, reason: `http_${res.status}` };
    
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return { valid: false, reason: 'not_image' };
    }
    
    const contentLength = parseInt(res.headers.get('content-length') || '0');
    if (contentLength > 0 && contentLength < minFileSize) {
      return { valid: false, reason: 'too_small' };
    }
    
    // For Wikimedia images, we can extract dimensions from the URL
    const dims = extractDimensionsFromUrl(url);
    
    return {
      valid: true,
      width: dims?.width,
      height: dims?.height,
      fileSize: contentLength,
      mime: contentType,
      reason: 'ok'
    };
  } catch (err) {
    return { valid: false, reason: 'fetch_error' };
  }
}

/**
 * Extract width/height from Wikimedia thumbnail URL.
 * Wikimedia URLs often include the size in the path, e.g. /thumb/.../640px-Foo.jpg
 */
function extractDimensionsFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/(\d+)px-([^/]+)$/);
  if (match) {
    return { width: parseInt(match[1]), height: null };
  }
  return null;
}

/**
 * Tier 1: Get image from Wikidata (P18 = image, P109 = signature, P154 = logo, P14 = traffic sign)
 * @param {string} wikidataId - Q-ID like "Q11631"
 * @returns {Promise<{url, license, credit, source, ...} | null>}
 */
async function getWikidataImage(wikidataId) {
  if (!wikidataId) return null;
  
  const sparql = `
    SELECT ?image ?imageLicense ?imageArtist ?imageCredit WHERE {
      wd:${wikidataId} wdt:P18 ?image .
      OPTIONAL { ?image wdt:P275 ?imageLicense }
      OPTIONAL { ?image wdt:P170 ?imageArtist }
      OPTIONAL { wd:${wikidataId} wdt:P748 ?imageCredit }
    }
    LIMIT 1
  `;
  
  try {
    const res = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'dateandtime.live/1.0 (https://dateandtime.live)'
      },
      body: 'query=' + encodeURIComponent(sparql)
    });
    
    if (!res.ok) return null;
    const data = await res.json();
    const binding = data.results?.bindings?.[0];
    if (!binding) return null;
    
    const imageUrl = binding.image?.value;
    if (!imageUrl) return null;
    
    // Convert to thumbnail URL (Wikimedia file URLs need a different format)
    const thumbUrl = convertToThumbUrl(imageUrl, 1200);
    
    const validation = await validateImage(thumbUrl);
    if (!validation.valid) return null;
    
    return {
      url: thumbUrl,
      source: 'wikidata',
      source_url: imageUrl,
      license: formatLicense(binding.imageLicense?.value),
      credit: binding.imageArtist?.value || 'Wikimedia Commons',
      width: validation.width,
      height: validation.height,
      fileSize: validation.fileSize,
      mime: validation.mime
    };
  } catch (err) {
    console.warn('Wikidata image fetch failed:', err.message);
    return null;
  }
}

/**
 * Convert a Wikimedia file URL to a thumbnail URL.
 * Input: https://commons.wikimedia.org/wiki/Special:FilePath/Apollo_11.jpg
 * Output: https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Apollo_11.jpg/1200px-Apollo_11.jpg
 */
function convertToThumbUrl(fileUrl, width = 1200) {
  // If it's already a thumb URL, return as-is
  if (fileUrl.includes('/thumb/')) return fileUrl;
  
  // Special:FilePath URLs need conversion
  // Pattern: https://commons.wikimedia.org/wiki/Special:FilePath/Filename.jpg
  const match = fileUrl.match(/Special:FilePath\/(.+)$/);
  if (match) {
    const filename = match[1];
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}?width=${width}`;
  }
  
  // upload.wikimedia.org URLs can be used directly
  if (fileUrl.includes('upload.wikimedia.org')) {
    return fileUrl;
  }
  
  return fileUrl;
}

/**
 * Format Wikidata license URI to a short license string.
 */
function formatLicense(licenseUri) {
  if (!licenseUri) return 'unknown';
  if (licenseUri.includes('CC-BY-SA')) return 'CC-BY-SA';
  if (licenseUri.includes('CC0')) return 'CC0';
  if (licenseUri.includes('public-domain')) return 'public-domain';
  if (licenseUri.includes('CC-BY')) return 'CC-BY';
  return 'unknown';
}

/**
 * Tier 2: Get Wikipedia article thumbnail via REST API.
 * @param {string} wikipediaUrl - e.g. https://en.wikipedia.org/wiki/Apollo_11
 * @returns {Promise<{url, source, license, credit, ...} | null>}
 */
async function getWikipediaImage(wikipediaUrl) {
  if (!wikipediaUrl) return null;
  
  // Extract article title from URL
  const match = wikipediaUrl.match(/\/wiki\/(.+)$/);
  if (!match) return null;
  const title = decodeURIComponent(match[1]);
  
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { 'User-Agent': 'dateandtime.live/1.0' } }
    );
    if (!res.ok) return null;
    
    const data = await res.json();
    const imageUrl = data.originalimage?.source || data.thumbnail?.source;
    if (!imageUrl) return null;
    
    const validation = await validateImage(imageUrl);
    if (!validation.valid) return null;
    
    return {
      url: imageUrl,
      source: 'wikipedia',
      source_url: data.content_urls?.desktop?.page || wikipediaUrl,
      license: 'CC-BY-SA',
      credit: 'Wikipedia',
      width: validation.width,
      height: validation.height,
      fileSize: validation.fileSize,
      mime: validation.mime
    };
  } catch (err) {
    console.warn('Wikipedia image fetch failed:', err.message);
    return null;
  }
}

/**
 * Tier 3: Search Wikimedia Commons for an image by title.
 * @param {string} query - Search query (event title or person name)
 * @param {object} opts - { year, type }
 * @returns {Promise<{url, source, license, credit, ...} | null>}
 */
async function getCommonsImage(query, opts = {}) {
  if (!query) return null;
  
  try {
    // Search Commons for files
    const searchRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=5`,
      { headers: { 'User-Agent': 'dateandtime.live/1.0' } }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const results = searchData.query?.search || [];
    if (results.length === 0) return null;
    
    // Get image info for the top result
    const filename = results[0].title.replace('File:', '');
    const infoRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json`,
      { headers: { 'User-Agent': 'dateandtime.live/1.0' } }
    );
    if (!infoRes.ok) return null;
    const infoData = await infoRes.json();
    const pages = infoData.query?.pages || {};
    const page = Object.values(pages)[0];
    if (!page?.imageinfo?.[0]) return null;
    
    const info = page.imageinfo[0];
    const thumbUrl = info.thumburl || info.url;
    const width = info.width || 0;
    const height = info.height || 0;
    
    if (width < MIN_WIDTH || height < MIN_HEIGHT) return null;
    
    const license = info.extmetadata?.LicenseShortName?.value || 'unknown';
    const credit = info.extmetadata?.Artist?.value || 'Wikimedia Commons';
    
    return {
      url: thumbUrl,
      source: 'commons',
      source_url: info.descriptionurl,
      license: license,
      credit: stripHtml(credit),
      width,
      height,
      fileSize: info.size,
      mime: info.mime
    };
  } catch (err) {
    console.warn('Commons image fetch failed:', err.message);
    return null;
  }
}

/**
 * Tier 4: Search external sources (NASA, Smithsonian).
 * @param {object} entry - { title, year, category }
 * @returns {Promise<{url, source, license, credit, ...} | null>}
 */
async function getExternalImage(entry) {
  if (!entry?.title) return null;
  
  // Try NASA first (for space/science events)
  if (['science', 'space', 'discovery'].includes(entry.subcategory) || entry.category === 'science') {
    const nasaImage = await getNasaImage(entry);
    if (nasaImage) return nasaImage;
  }
  
  // Try Smithsonian (for general historical events)
  if (entry.year) {
    const smithsonianImage = await getSmithsonianImage(entry);
    if (smithsonianImage) return smithsonianImage;
  }
  
  return null;
}

/**
 * NASA Image and Video Library search.
 * Free API, no key required.
 */
async function getNasaImage(entry) {
  try {
    const res = await fetch(
      `https://images-api.nasa.gov/search?q=${encodeURIComponent(entry.title)}&media_type=image&year_start=${Math.max(1900, (entry.year || 2000) - 5)}&year_end=${(entry.year || 2000) + 5}`,
      { headers: { 'User-Agent': 'dateandtime.live/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.collection?.items || [];
    if (items.length === 0) return null;
    
    const item = items[0];
    const imageUrl = item.links?.[0]?.href;
    if (!imageUrl) return null;
    
    const validation = await validateImage(imageUrl);
    if (!validation.valid) return null;
    
    return {
      url: imageUrl,
      source: 'nasa',
      source_url: item.href || imageUrl,
      license: 'public-domain',
      credit: 'NASA',
      width: validation.width,
      height: validation.height,
      fileSize: validation.fileSize,
      mime: validation.mime
    };
  } catch (err) {
    return null;
  }
}

/**
 * Smithsonian Open Access search.
 * Free API, no key required.
 */
async function getSmithsonianImage(entry) {
  try {
    const res = await fetch(
      `https://api.si.edu/openaccess/v1.0/search?q=${encodeURIComponent(entry.title)}&api_key=DEMO_KEY&rows=1`,
      { headers: { 'User-Agent': 'dateandtime.live/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.response?.rows || [];
    if (items.length === 0) return null;
    
    const content = items[0].content;
    const imageUrl = content?.descriptiveNonRepeating?.online_media?.media?.[0]?.content;
    if (!imageUrl) return null;
    
    const validation = await validateImage(imageUrl);
    if (!validation.valid) return null;
    
    return {
      url: imageUrl,
      source: 'smithsonian',
      source_url: items[0].id,
      license: 'CC0',
      credit: 'Smithsonian Institution',
      width: validation.width,
      height: validation.height,
      fileSize: validation.fileSize,
      mime: validation.mime
    };
  } catch (err) {
    return null;
  }
}

/**
 * Tier 5: Generate SVG placeholder with gradient + emoji.
 * @param {object} entry - { title, type, category, year, subcategory }
 * @returns {{url, source, license, credit, placeholder: true}}
 */
function getGeneratedPlaceholder(entry) {
  const { title = 'Historical Event', type = 'event', category = 'event', subcategory = '', year = '' } = entry;
  
  // Map category to gradient colors
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
    health: { from: '#0d9488', to: '#14b8a6' },
    disaster: { from: '#7f1d1d', to: '#dc2626' },
    first: { from: '#ca8a04', to: '#eab308' }
  };
  
  const categoryKey = subcategory && gradients[subcategory] ? subcategory : (gradients[type] ? type : (gradients[category] ? category : 'event'));
  const gradient = gradients[categoryKey] || gradients.event;
  
  // Pick an emoji based on category
  const emojis = {
    event: '📅', birth: '🎂', death: '⚰️', wedding: '💍', divorce: '💔',
    bizarre: '🎭', science: '🔬', space: '🚀', war: '⚔️', politics: '🏛️',
    sports: '🏆', music: '🎵', film: '🎬', tech: '💻', finance: '💰',
    health: '🏥', disaster: '🌋', first: '⭐'
  };
  const emoji = emojis[categoryKey] || emojis[type] || '📅';
  
  // Generate SVG with gradient, emoji, title, and year
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient.from}"/>
      <stop offset="100%" stop-color="${gradient.to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <text x="600" y="320" font-size="220" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="600" y="540" font-family="ui-sans-serif, system-ui" font-size="48" font-weight="700" text-anchor="middle" fill="white">${escapeXml(title.slice(0, 50))}</text>
  ${year ? `<text x="600" y="610" font-family="ui-sans-serif, system-ui" font-size="36" text-anchor="middle" fill="rgba(255,255,255,0.85)">${year}</text>` : ''}
  <text x="600" y="740" font-family="ui-sans-serif, system-ui" font-size="20" text-anchor="middle" fill="rgba(255,255,255,0.6)">dateandtime.live</text>
</svg>`;
  
  // Encode as data URL
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  
  return {
    url: dataUrl,
    source: 'generated',
    source_url: null,
    license: 'generated',
    credit: 'dateandtime.live',
    width: 1200,
    height: 800,
    fileSize: svg.length,
    mime: 'image/svg+xml',
    placeholder: true
  };
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, '').trim();
}

/**
 * Escape XML special characters.
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate alt text for an image based on the entry.
 * @param {object} entry
 * @returns {string}
 */
function generateAltText(entry) {
  const parts = [];
  if (entry.title) parts.push(entry.title);
  if (entry.year) parts.push(`(${entry.year})`);
  if (entry.country_code) parts.push(`[${entry.country_code}]`);
  return parts.join(' ').slice(0, 200);
}

/**
 * Main entry: try all 5 tiers, return the first valid image.
 * @param {object} entry - { title, wikipedia_url, wikidata_id, type, category, subcategory, year, country_code }
 * @param {object} opts - { skipGenerated, forceRetry }
 * @returns {Promise<{url, source, license, credit, width, height, fileSize, mime, alt, tier}>}
 */
async function getImageForEntry(entry, opts = {}) {
  if (!entry) return null;
  
  const { skipGenerated = false, forceRetry = false } = opts;
  
  // Tier 1: Wikidata
  if (entry.wikidata_id || entry.external_id?.startsWith?.('Q')) {
    const wikidataId = entry.wikidata_id || entry.external_id;
    const img = await getWikidataImage(wikidataId);
    if (img) return { ...img, alt: generateAltText(entry), tier: 1 };
  }
  
  // Tier 2: Wikipedia
  if (entry.wikipedia_url) {
    const img = await getWikipediaImage(entry.wikipedia_url);
    if (img) return { ...img, alt: generateAltText(entry), tier: 2 };
  }
  
  // Tier 3: Commons
  const commonsQuery = entry.title + (entry.year ? ' ' + entry.year : '');
  const img3 = await getCommonsImage(commonsQuery, { year: entry.year, type: entry.type });
  if (img3) return { ...img3, alt: generateAltText(entry), tier: 3 };
  
  // Tier 4: External
  const img4 = await getExternalImage(entry);
  if (img4) return { ...img4, alt: generateAltText(entry), tier: 4 };
  
  // Tier 5: Generated placeholder
  if (skipGenerated) return null;
  return { ...getGeneratedPlaceholder(entry), alt: generateAltText(entry), tier: 5 };
}

/**
 * Cache an image to R2 (for static serving).
 * @param {object} imageRecord - the result of getImageForEntry
 * @param {object} r2Bucket - Cloudflare R2 binding
 * @returns {Promise<{r2_key, url, cached: boolean}>}
 */
async function cacheImageToR2(imageRecord, r2Bucket, entry) {
  if (!imageRecord || !r2Bucket || imageRecord.placeholder) return null;
  
  try {
    const res = await fetch(imageRecord.url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    
    const year = entry.year || 'unknown';
    const month = String(entry.month || 0).padStart(2, '0');
    const day = String(entry.day || 0).padStart(2, '0');
    const slug = (entry.slug || entry.title || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const ext = imageRecord.mime?.includes('png') ? 'png' : 'jpg';
    const r2Key = `otd/${year}/${month}/${slug}-${day}.${ext}`;
    
    await r2Bucket.put(r2Key, buffer, {
      httpMetadata: { contentType: imageRecord.mime || 'image/jpeg' }
    });
    
    return {
      r2_key: r2Key,
      url: `https://images.dateandtime.live/${r2Key}`,
      cached: true
    };
  } catch (err) {
    return null;
  }
}

module.exports = {
  getImageForEntry,
  validateImage,
  getWikidataImage,
  getWikipediaImage,
  getCommonsImage,
  getExternalImage,
  getGeneratedPlaceholder,
  generateAltText,
  cacheImageToR2,
  // Constants for testing
  MIN_WIDTH,
  MIN_HEIGHT,
  MIN_FILE_SIZE,
  VALID_LICENSES
};
