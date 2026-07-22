#!/usr/bin/env node
/* Fetch the next 100 cities to build (top by population, excluding existing 10) */
const https = require('https');

const API = process.env.API || 'https://api.dateandtime.live';
const EXISTING = new Set([5128581, 5368361, 2643743, 1850147, 2147714, 1275339, 3448439, 2988507, 292223, 1880252, 4174757]);

const N_CITIES = parseInt(process.env.N || '100', 10);  // default 100, override with N=1000

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Disambiguate city slugs to handle same-name cities in different countries
// Examples: hyderabad-in, hyderabad-pk, valencia-es, valencia-ve
function disambiguateSlug(c, seenSlugs) {
  const base = slugify(c.asciiName || c.name);
  // If the base slug is unique, use it
  if (!seenSlugs.has(base)) {
    seenSlugs.add(base);
    return base;
  }
  // Conflict: add country code suffix
  const withCountry = `${base}-${c.countryCode.toLowerCase()}`;
  if (!seenSlugs.has(withCountry)) {
    seenSlugs.add(withCountry);
    return withCountry;
  }
  // Still conflict (e.g., 2 cities in same country with same name):
  // add state code if available, else population rank
  let withState = withCountry;
  if (c.stateCode) {
    withState = `${base}-${c.stateCode.toLowerCase()}`;
    if (!seenSlugs.has(withState)) {
      seenSlugs.add(withState);
      return withState;
    }
  }
  // Fall back to ID-based disambiguation
  withState = `${base}-${c.id}`;
  seenSlugs.add(withState);
  return withState;
}

(async () => {
  const cities = [];
  const seenSlugs = new Set();
  for (let offset = 0; offset < 5000 && cities.length < N_CITIES; offset += 200) {
    const r = await fetchJson(`${API}/api/v1/cities?limit=200&offset=${offset}`);
    const list = r.data.cities;
    for (const c of list) {
      if (EXISTING.has(c.id)) continue;
      const slug = disambiguateSlug(c, seenSlugs);
      cities.push({ id: c.id, slug, code: c.countryCode.toLowerCase() });
      if (cities.length >= N_CITIES) break;
    }
  }
  // Log any disambiguated slugs
  const disambiguated = cities.filter(c => c.slug.includes('-in') || c.slug.includes('-pk') || c.slug.includes('-es') || c.slug.includes('-ve') || c.slug.includes('-cn'));
  if (disambiguated.length > 0) {
    console.error(`# ${disambiguated.length} disambiguated slugs:`);
    disambiguated.forEach(c => console.error(`#   ${c.slug} (id ${c.id}, ${c.code})`));
  }
  console.log(JSON.stringify(cities, null, 2));
})();
