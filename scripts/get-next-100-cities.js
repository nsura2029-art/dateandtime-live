#!/usr/bin/env node
/* Fetch the next 100 cities to build (top by population, excluding existing 10) */
const https = require('https');

const API = process.env.API || 'https://api.dateandtime.live';
const EXISTING = new Set([5128581, 5368361, 2643743, 1850147, 2147714, 1275339, 3448439, 2988507, 292223, 1880252]);

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

(async () => {
  const cities = [];
  for (let offset = 0; offset < 2000 && cities.length < 100; offset += 200) {
    const r = await fetchJson(`${API}/api/v1/cities?limit=200&offset=${offset}`);
    const list = r.data.cities;
    for (const c of list) {
      if (EXISTING.has(c.id)) continue;
      const slug = slugify(c.asciiName || c.name);
      cities.push({ id: c.id, slug, code: c.countryCode.toLowerCase() });
      if (cities.length >= 100) break;
    }
  }
  console.log(JSON.stringify(cities, null, 2));
})();
