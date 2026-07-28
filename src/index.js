// Worker entry — serves the static assets, injects Cloudflare's
// IP-geolocation data into HTML pages for SSR, and runs cookie consent
// + JSON-LD injection server-side.
//
// On every HTML request we:
//   1. Inject window.__location (IP geolocation) before the first <script>
//   2. Inject window.__initialTime (server-rendered time in user's tz)
//   3. Inject window.__consentRegion + window.__hasConsent (cookie state)
//   4. Replace the H1 placeholder with the actual city
//   5. Update <title> with city + region
//   6. Inject the cookie consent banner HTML before </body>
//   7. Inject JSON-LD <script> tags in <head> if HTML doesn't already have them
//
// Also exposes same-origin proxies for /v1/* so the page can call
// api.dateandtime.live via the same origin (CORS workaround for dev).
//
// Plus a /api/time/now endpoint so the page can compute real clock-drift
// without depending on the prod API.
// In-memory cache of the cities list so we don't re-fetch it on every
// page load. The DB changes rarely, so a 5-min TTL is fine.
let citiesCache = { at: 0, data: null };
const CITIES_TTL_MS = 5 * 60 * 1000;

// Per-country cities cache for coming-soon page enrichment. Key: cca2 (e.g. "CO")
// Value: { at, cities: [{id, name, asciiName, countryCode, timezone, latitude, longitude, population}] }
// TTL: 1 day (the city list per country is essentially static).
const COUNTRY_CITIES_CACHE = {};
const COUNTRY_CITIES_TTL_MS = 24 * 60 * 60 * 1000;

// Top 10 US cities for "browse our most popular" section. Hardcoded so we
// don't add API latency to the coming-soon page.
const TOP_US_CITIES = [
  { name: "New York City", slug: "new-york", state: "NY" },
  { name: "Los Angeles",   slug: "los-angeles", state: "CA" },
  { name: "Chicago",       slug: "chicago", state: "IL" },
  { name: "Houston",       slug: "houston", state: "TX" },
  { name: "Phoenix",       slug: "phoenix", state: "AZ" },
  { name: "Philadelphia",  slug: "philadelphia", state: "PA" },
  { name: "San Antonio",   slug: "san-antonio", state: "TX" },
  { name: "San Diego",     slug: "san-diego", state: "CA" },
  { name: "Dallas",        slug: "dallas", state: "TX" },
  { name: "Austin",        slug: "austin", state: "TX" }
];

// US states for the grid. Same as the country page, hardcoded.
const US_STATES_GRID = [
  { code: "AL", name: "Alabama", slug: "alabama" },
  { code: "AK", name: "Alaska", slug: "alaska" },
  { code: "AZ", name: "Arizona", slug: "arizona" },
  { code: "AR", name: "Arkansas", slug: "arkansas" },
  { code: "CA", name: "California", slug: "california" },
  { code: "CO", name: "Colorado", slug: "colorado" },
  { code: "CT", name: "Connecticut", slug: "connecticut" },
  { code: "DE", name: "Delaware", slug: "delaware" },
  { code: "FL", name: "Florida", slug: "florida" },
  { code: "GA", name: "Georgia", slug: "georgia" },
  { code: "HI", name: "Hawaii", slug: "hawaii" },
  { code: "ID", name: "Idaho", slug: "idaho" },
  { code: "IL", name: "Illinois", slug: "illinois" },
  { code: "IN", name: "Indiana", slug: "indiana" },
  { code: "IA", name: "Iowa", slug: "iowa" },
  { code: "KS", name: "Kansas", slug: "kansas" },
  { code: "KY", name: "Kentucky", slug: "kentucky" },
  { code: "LA", name: "Louisiana", slug: "louisiana" },
  { code: "ME", name: "Maine", slug: "maine" },
  { code: "MD", name: "Maryland", slug: "maryland" },
  { code: "MA", name: "Massachusetts", slug: "massachusetts" },
  { code: "MI", name: "Michigan", slug: "michigan" },
  { code: "MN", name: "Minnesota", slug: "minnesota" },
  { code: "MS", name: "Mississippi", slug: "mississippi" },
  { code: "MO", name: "Missouri", slug: "missouri" },
  { code: "MT", name: "Montana", slug: "montana" },
  { code: "NE", name: "Nebraska", slug: "nebraska" },
  { code: "NV", name: "Nevada", slug: "nevada" },
  { code: "NH", name: "New Hampshire", slug: "new-hampshire" },
  { code: "NJ", name: "New Jersey", slug: "new-jersey" },
  { code: "NM", name: "New Mexico", slug: "new-mexico" },
  { code: "NY", name: "New York", slug: "new-york" },
  { code: "NC", name: "North Carolina", slug: "north-carolina" },
  { code: "ND", name: "North Dakota", slug: "north-dakota" },
  { code: "OH", name: "Ohio", slug: "ohio" },
  { code: "OK", name: "Oklahoma", slug: "oklahoma" },
  { code: "OR", name: "Oregon", slug: "oregon" },
  { code: "PA", name: "Pennsylvania", slug: "pennsylvania" },
  { code: "RI", name: "Rhode Island", slug: "rhode-island" },
  { code: "SC", name: "South Carolina", slug: "south-carolina" },
  { code: "SD", name: "South Dakota", slug: "south-dakota" },
  { code: "TN", name: "Tennessee", slug: "tennessee" },
  { code: "TX", name: "Texas", slug: "texas" },
  { code: "UT", name: "Utah", slug: "utah" },
  { code: "VT", name: "Vermont", slug: "vermont" },
  { code: "VA", name: "Virginia", slug: "virginia" },
  { code: "WA", name: "Washington", slug: "washington" },
  { code: "WV", name: "West Virginia", slug: "west-virginia" },
  { code: "WI", name: "Wisconsin", slug: "wisconsin" },
  { code: "WY", name: "Wyoming", slug: "wyoming" },
  { code: "DC", name: "District of Columbia", slug: "district-of-columbia" }
];

// Common country cca2 -> IANA timezone map. Used as a fallback when we can't
// look up the city's exact tz. For coming-soon pages, this gives us a
// reasonable "live time" for the country even when the API lookup misses.
const COUNTRY_DEFAULT_TZ = {
  US: "America/New_York", CA: "America/Toronto", MX: "America/Mexico_City",
  GB: "Europe/London", IE: "Europe/Dublin", FR: "Europe/Paris", DE: "Europe/Berlin",
  ES: "Europe/Madrid", IT: "Europe/Rome", NL: "Europe/Amsterdam", BE: "Europe/Brussels",
  CH: "Europe/Zurich", AT: "Europe/Vienna", PT: "Europe/Lisbon", GR: "Europe/Athens",
  PL: "Europe/Warsaw", SE: "Europe/Stockholm", NO: "Europe/Oslo", DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki", RU: "Europe/Moscow", UA: "Europe/Kyiv", TR: "Europe/Istanbul",
  JP: "Asia/Tokyo", CN: "Asia/Shanghai", KR: "Asia/Seoul", IN: "Asia/Kolkata",
  PK: "Asia/Karachi", BD: "Asia/Dhaka", ID: "Asia/Jakarta", TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh", PH: "Asia/Manila", MY: "Asia/Kuala_Lumpur", SG: "Asia/Singapore",
  HK: "Asia/Hong_Kong", TW: "Asia/Taipei", AE: "Asia/Dubai", SA: "Asia/Riyadh",
  IL: "Asia/Jerusalem", EG: "Africa/Cairo", ZA: "Africa/Johannesburg", NG: "Africa/Lagos",
  KE: "Africa/Nairobi", MA: "Africa/Casablanca", ET: "Africa/Addis_Ababa", GH: "Africa/Accra",
  BR: "America/Sao_Paulo", AR: "America/Argentina/Buenos_Aires", CL: "America/Santiago",
  CO: "America/Bogota", PE: "America/Lima", VE: "America/Caracas", UY: "America/Montevideo",
  AU: "Australia/Sydney", NZ: "Pacific/Auckland", FJ: "Pacific/Fiji"
};

// Slug to country mapping for 301 redirects from the legacy /world-time/city/{slug}/
// path to the canonical /world-time/{country-name-slug}/{slug}/. Generated at build time
// from scripts/build-city-pages.js (911 entries, compact string).
// Format: "slug,cca2|slug,cca2|..." - parsed at runtime to avoid
// wrangler build errors on a large JS object literal.
import { SLUG_DATA } from './slug-data.js';
const SLUG_TO_COUNTRY = (() => {
  const m = {};
  for (const pair of SLUG_DATA.split('|')) {
    const i = pair.indexOf(',');
    if (i > 0) m[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return m;
})();

// cca2 -> country-name-slug mapping (e.g. "US" -> "united-states") for the
// second URL hop: /world-time/{cca2}/{slug}/ -> /world-time/{country-name}/{slug}/.
// Auto-generated from /api/v1/countries (242 entries, compact string).
// Format: "CC,slug|CC,slug|..." - parsed at runtime.
import { CC2_COUNTRY_SLUG } from './cc2-country-slug.js';
import { LEGACY_STATE_MAP } from './legacy-state-map.js';
const CCA2_TO_COUNTRY_SLUG = (() => {
  const m = {};
  if (CC2_COUNTRY_SLUG && typeof CC2_COUNTRY_SLUG === 'string') {
    for (const pair of CC2_COUNTRY_SLUG.split('|')) {
      const i = pair.indexOf(',');
      if (i > 0) m[pair.slice(0, i).toUpperCase()] = pair.slice(i + 1);
    }
  }
  return m;
})();

async function getCities() {
  const now = Date.now();
  if (citiesCache.data && (now - citiesCache.at) < CITIES_TTL_MS) return citiesCache.data;
  const r = await fetch("https://api.dateandtime.live/api/v1/cities?limit=500", { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error("cities upstream " + r.status);
  const j = await r.json();
  const data = j.data || j;
  citiesCache = { at: now, data: Array.isArray(data) ? data : (data.cities || []) };
  return citiesCache.data;
}

// Fetch all cities for one country (used by the coming-soon page to enrich
// with live time, flag, lat/lon, etc.). Cached per-cca2 in memory for 1 day.
async function getCountryCities(cca2, request) {
  if (!cca2) return null;
  cca2 = cca2.toUpperCase();
  const now = Date.now();
  const hit = COUNTRY_CITIES_CACHE[cca2];
  if (hit && (now - hit.at) < COUNTRY_CITIES_TTL_MS) return hit.cities;
  const base = request ? getUpstreamBase(request) : "https://api.dateandtime.live";
  const url = `${base}/api/v1/cities/all?country=${cca2}`;
  try {
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!r.ok) return null;
    const j = await r.json();
    const cities = (j.data && j.data.cities) || [];
    COUNTRY_CITIES_CACHE[cca2] = { at: now, cities };
    return cities;
  } catch (e) {
    return null;
  }
}

// Convert city asciiName to URL slug (matches the convention used by all our
// build scripts). asciiName "New York City" -> slug "new-york-city".
function cityAsciiNameToSlug(asciiName) {
  if (!asciiName) return "";
  return String(asciiName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Find a city in a list by its URL slug. Returns the city object or null.
function findCityBySlug(cities, slug) {
  if (!cities || !slug) return null;
  for (const c of cities) {
    if (cityAsciiNameToSlug(c.asciiName || c.name) === slug) return c;
  }
  return null;
}

// Minimal HTML-escape helper (used by the coming-soon page to render
// user-supplied / API-derived strings safely).
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lng || b.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function findNearest(cities, lat, lon) {
  if (!cities || !cities.length || lat == null || lon == null) return null;
  let best = null, bestD = Infinity;
  for (const c of cities) {
    if (c.latitude == null || c.longitude == null) continue;
    const d = haversineKm({ lat, lng: lon }, { lat: c.latitude, lon: c.longitude });
    if (d < bestD) { bestD = d; best = c; }
  }
  return best ? { city: best, distanceKm: bestD } : null;
}

// Humanize a slug: "san-francisco" -> "San Francisco"
function humanizeSlug(slug) {
  if (!slug) return "";
  return slug
    .split("-")
    .map(w => w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// Display-name lookup for cities whose ASCII slugs lose their diacritics.
// Slugs must remain ASCII-only for clean URLs (SEO + readability), but the
// humanized title should show the proper Unicode: "medell-n" → "Medellín",
// not "Medell N". This is a curated list of well-known cities that benefit
// from diacritics; new entries can be added here without code changes.
const CITY_DISPLAY_NAMES = {
  // Spanish/Portuguese diacritics
  "medell-n": "Medellín",
  "bogot-": "Bogotá",
  "bogota": "Bogotá",
  "cartagena": "Cartagena",
  "cali": "Cali",
  "panam-": "Panamá",
  "panama-city": "Panama City",
  "lima": "Lima",
  "quito": "Quito",
  "santiago": "Santiago",
  "valpara-so": "Valparaíso",
  "valparaiso": "Valparaíso",
  "asunci-n": "Asunción",
  "sao-paulo": "São Paulo",
  "s-o-paulo": "São Paulo",
  "so-paulo": "São Paulo",
  "sao-luis": "São Luís",
  "sao-goncalo": "São Gonçalo",
  "sao-gon-alo": "São Gonçalo",
  "sao-bernardo-do-campo": "São Bernardo do Campo",
  "sao-jose-do-rio-preto": "São José do Rio Preto",
  "sao-jose-dos-campos": "São José dos Campos",
  "sao-vicente": "São Vicente",
  "sao-caetano-do-sul": "São Caetano do Sul",
  "sao-joao-de-meriti": "São João de Meriti",
  "joao-pessoa": "João Pessoa",
  "belem": "Belém",
  "bel-em": "Belém",
  "bel-n": "Belén",
  "sao-bernardo-do-campo": "São Bernardo do Campo",
  "rio-de-janeiro": "Rio de Janeiro",
  "bel-horizonte": "Belo Horizonte",
  "belo-horizonte": "Belo Horizonte",
  "bras-lia": "Brasília",
  "sao-tom-de-bras-lia": "São Tomé de Brasília",
  "goi-nia": "Goiânia",
  "goiania": "Goiânia",
  "curitiba": "Curitiba",
  "s-o-lu-s": "São Luís",
  "macei-": "Maceió",
  "maceio": "Maceió",
  "cuiab-": "Cuiabá",
  "cuiaba": "Cuiabá",
  "porto-alegre": "Porto Alegre",
  "recife": "Recife",
  "manaus": "Manaus",
  "bel-n": "Belén",
  "san-juan": "San Juan",
  // French diacritics
  "montr-al": "Montréal",
  "montreal": "Montréal",
  "qu-bec": "Québec",
  "quebec": "Québec",
  "havana": "La Habana",
  "la-habana": "La Habana",
  "c-te": "Côte",
  "c-te-d-ivoire": "Côte d'Ivoire",
  "abidjan": "Abidjan",
  "libreville": "Libreville",
  "brazzaville": "Brazzaville",
  "kinchasa": "Kinshasa",
  "kinshasa": "Kinshasa",
  // German
  "m-nchen": "München",
  "munchen": "München",
  "n- rnberg": "Nürnberg",
  "nurnberg": "Nürnberg",
  "k-ln": "Köln",
  "koln": "Köln",
  "frankfurt-am-main": "Frankfurt am Main",
  // Italian
  "roma": "Roma",
  "milano": "Milano",
  "napoli": "Napoli",
  "torino": "Torino",
  "palermo": "Palermo",
  "venezia": "Venezia",
  "firenze": "Firenze",
  "bologna": "Bologna",
  "verona": "Verona",
  "genova": "Genova",
  "reggio-calabria": "Reggio Calabria",
  "reggio-emilia": "Reggio Emilia",
  "trieste": "Trieste",
  "cagliari": "Cagliari",
  // Nordic
  "k-benhavn": "København",
  "kobenhavn": "København",
  "copenhagen": "Copenhagen",
  "g-teborg": "Göteborg",
  "goteborg": "Göteborg",
  "gothenburg": "Gothenburg",
  "reykjav-k": "Reykjavík",
  "reykjavik": "Reykjavík",
  "stokkh-ms": "Stockholm",
  "stockholm": "Stockholm",
  // Eastern European
  "praha": "Praha",
  "prague": "Praha",
  "warszawa": "Warszawa",
  "warsaw": "Warsaw",
  "krak-w": "Kraków",
  "krakow": "Kraków",
  "gda-sk": "Gdańsk",
  "gdansk": "Gdańsk",
  "wroc-aw": "Wrocław",
  "wroclaw": "Wrocław",
  "ł-d": "Łódź",
  "budapest": "Budapest",
  "bucuresti": "București",
  "bucharest": "București",
  "timisoara": "Timișoara",
  "cluj-napoca": "Cluj-Napoca",
  "ia-i": "Iași",
  "iasi": "Iași",
  "t-rgu-mure": "Târgu Mureș",
  "belgrade": "Belgrade",
  "beograd": "Beograd",
  "zagreb": "Zagreb",
  "ljubljana": "Ljubljana",
  "bratislava": "Bratislava",
  // Greek / Cyrillic
  "ath-na": "Athína",
  "athens": "Athens",
  "thessalon-ki": "Thessaloníki",
  "thessaloniki": "Thessaloníki",
  "sofia": "Sofia",
  "minsk": "Minsk",
  "k-yiv": "Kyiv",
  "kyiv": "Kyiv",
  "kiev": "Kyiv",
  "kharkiv": "Kharkiv",
  "lviv": "Lviv",
  "odessa": "Odesa",
  // Asian
  "t-ky-": "Tōkyō",
  "tokyo": "Tokyo",
  "-saka": "Ōsaka",
  "osaka": "Osaka",
  "ky-to": "Kyōto",
  "kyoto": "Kyoto",
  "k-be": "Kōbe",
  "kobe": "Kobe",
  "hiroshima": "Hiroshima",
  "nagoya": "Nagoya",
  "sapporo": "Sapporo",
  "fukuoka": "Fukuoka",
  "sendai": "Sendai",
  "beijing": "Beijing",
  "shanghai": "Shanghai",
  "guangzhou": "Guangzhou",
  "shenzhen": "Shenzhen",
  "chengdu": "Chengdu",
  "hangzhou": "Hangzhou",
  "xian": "Xi'an",
  "hong-kong": "Hong Kong",
  "taipei": "Taipei",
  "kaohsiung": "Kaohsiung",
  "bangkok": "Bangkok",
  "singapore": "Singapore",
  "kuala-lumpur": "Kuala Lumpur",
  "jakarta": "Jakarta",
  "manila": "Manila",
  "hanoi": "Hanoi",
  "ho-chi-minh-city": "Ho Chi Minh City",
  "saigon": "Saigon",
  // Middle East
  "al-quahira": "Al-Qāhirah",
  "cairo": "Cairo",
  "al-qahirah": "Al-Qāhirah",
  "tehran": "Tehran",
  "esfah-n": "Eşfahān",
  "isfahan": "Isfahan",
  // Turkish
  "istanbul": "İstanbul",
  "izmir": "İzmir",
  // Other common ones
  "z-rich": "Zürich",
  "zurich": "Zürich",
  "gen-ve": "Genève",
  "geneva": "Geneva",
  "m-nster": "Münster",
  "m-nster-bezirk": "Münster",
};

// Get a city display name from a slug, falling back to humanizeSlug.
function cityDisplayName(slug) {
  if (!slug) return "";
  if (CITY_DISPLAY_NAMES[slug]) return CITY_DISPLAY_NAMES[slug];
  // Try a few transformations: maybe the slug dropped a diacritic character
  // that we want to add back via the lookup
  return humanizeSlug(slug);
}

// "Coming Soon" page for city URLs that don't have a pre-built static page.
// We pre-build 911 cities; the DB has 33,945. When a user visits an unmapped
// city, serve this page with: live time in the user's tz (we don't know
// the city's tz yet), 3 feedback CTAs, and 6 contextual backlinks.
async function generateComingSoonPage(countrySlug, citySlug, request) {
  const cityName = cityDisplayName(citySlug);
  const countryName = humanizeSlug(countrySlug);
  const countryUrl = `/world-time/${countrySlug}/`;
  const cca2 = (SLUG_TO_COUNTRY[citySlug] || "").toUpperCase()
              || (CCA2_TO_COUNTRY_SLUG && Object.entries(CCA2_TO_COUNTRY_SLUG).find(([,s]) => s === countrySlug)?.[0])
              || "";

  // Try to enrich the page with real city data from the API.
  let cityData = null;
  let similarCities = [];  // other cities in the same country
  if (cca2) {
    const all = await getCountryCities(cca2, request);
    if (all) {
      cityData = findCityBySlug(all, citySlug);
      // Pick 5 nearby cities (same country, highest population, excluding this one)
      similarCities = all
        .filter(c => c.id !== (cityData && cityData.id))
        .sort((a, b) => (b.population || 0) - (a.population || 0))
        .slice(0, 5);
    }
  }
  const ianaTz = (cityData && cityData.timezone) || COUNTRY_DEFAULT_TZ[cca2] || "UTC";
  const cca2Lower = (cca2 || "").toLowerCase();
  const flagUrl = cca2 ? `https://flagcdn.com/w80/${cca2Lower}.png` : "";
  const pop = (cityData && cityData.population) || 0;
  const lat = (cityData && cityData.latitude) || null;
  const lon = (cityData && cityData.longitude) || null;
  const popStr = pop > 0 ? new Intl.NumberFormat("en-US").format(pop) : null;
  // Sanity-check the IANA tz before using it (Intl throws on bad input)
  let safeTz = "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: ianaTz }); safeTz = ianaTz; } catch (e) {}

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${cityName}, ${countryName} — Current Time | dateandtime.live</title>
  <meta name="description" content="${cityData ? 'Live current time, time zone, and weather for ' + cityName + ', ' + countryName + '. Population ' + popStr + ' (' + ianaTz + ').' : 'Live time, time zone, and weather for ' + cityName + ', ' + countryName + '. Coming soon to dateandtime.live.'}">
  <meta name="robots" content="index, follow">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="canonical" href="https://dateandtime.live/world-time/${countrySlug}/${citySlug}/">
  <link rel="stylesheet" href="/src/site-shell.css?v=5" />
  <link rel="stylesheet" href="/src/tz-hub.css?v=23" />
  <style>
    .coming-soon { max-width: 1240px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
    .cs-hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 2rem 1.75rem 1.75rem; background: var(--color-card-bg); border: 1px solid var(--color-border); border-radius: 16px; margin-bottom: 2.5rem; }
    .cs-hero-info { display: flex; flex-direction: column; align-items: center; width: 100%; }
    .cs-hero-info h1 { font-size: clamp(1.875rem, 4vw, 2.5rem); margin: 0.5rem auto; line-height: 1.1; text-align: center; max-width: 56rem; }
    .cs-hero-info .cs-country { font-size: 1rem; color: var(--color-foreground-soft); margin: 0.25rem auto 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap; }
    .cs-hero-info .cs-country a { color: var(--color-foreground-soft); }
    .cs-hero-info .cs-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem 1.25rem; font-size: 0.875rem; color: var(--color-foreground-soft); margin: 1rem auto 0; }
    .cs-hero-info .cs-meta strong { color: var(--color-foreground); font-weight: 600; }
    .cs-badge { display: inline-block; background: linear-gradient(135deg, #7866d4 0%, #ff7a59 100%); color: white; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .cs-hero-clock { text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border-soft); width: 100%; }
    .cs-hero-clock-time { font-family: var(--font-mono); font-size: clamp(2.25rem, 4vw, 3rem); font-weight: 700; color: var(--color-primary); line-height: 1; letter-spacing: -0.02em; }
    .cs-hero-clock-date { font-size: 0.875rem; color: var(--color-foreground-soft); margin-top: 0.5rem; }
    .cs-hero-clock-tz { font-size: 0.75rem; color: var(--color-muted); margin-top: 0.25rem; font-family: var(--font-mono); }
    .cs-hero-clock-tz .pill { display: inline-block; background: var(--color-primary-soft); color: var(--color-primary); padding: 0.125rem 0.5rem; border-radius: 6px; margin-left: 0.5rem; font-weight: 600; }
    .cs-flag { width: 56px; height: 38px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); object-fit: cover; }
    .cs-section { margin: 3rem 0; }
    .cs-section h2 { font-size: 1.375rem; font-weight: 700; margin: 0 auto 1rem; letter-spacing: -0.01em; text-align: center; max-width: 56rem; }
    .cs-section-desc { color: var(--color-foreground-soft); margin: -0.5rem auto 1.25rem; font-size: 0.9375rem; text-align: center; max-width: 42rem; }
    .cs-section > p { text-align: center; max-width: 42rem; margin-left: auto; margin-right: auto; }
    .cs-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.875rem; }
    .cs-link-card { display: block; padding: 1rem 1.125rem; border: 1px solid var(--color-border-soft); border-radius: 10px; text-decoration: none; color: var(--color-foreground); transition: all 200ms; background: var(--color-card-bg); }
    .cs-link-card:hover { border-color: var(--color-primary); transform: translateY(-1px); text-decoration: none; box-shadow: 0 4px 12px rgba(120,102,212,0.08); }
    .cs-link-card .cs-card-label { display: inline-block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-primary); font-weight: 700; margin-bottom: 0.375rem; }
    .cs-link-card .cs-card-title { display: block; font-size: 0.9375rem; font-weight: 600; line-height: 1.3; }
    .cs-link-card .cs-card-sub { display: block; font-size: 0.8125rem; color: var(--color-foreground-soft); margin-top: 0.25rem; line-height: 1.4; }
    .cs-states-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 0.5rem; }
    .cs-state-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.75rem 0.5rem; border: 1px solid var(--color-border-soft); border-radius: 8px; text-decoration: none; color: var(--color-foreground); font-size: 0.75rem; font-weight: 600; transition: all 150ms; }
    .cs-state-tile:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-soft); text-decoration: none; }
    .cs-state-tile .cs-state-code { font-size: 0.875rem; font-weight: 700; margin-bottom: 0.125rem; }
    .cs-context-row { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; font-size: 0.875rem; color: var(--color-foreground-soft); padding: 1rem 1.25rem; background: var(--color-card-bg); border: 1px solid var(--color-border-soft); border-radius: 10px; }
    .cs-context-row strong { color: var(--color-foreground); font-weight: 600; }
    .cs-context-row a { color: var(--color-primary); }
    .cs-similar-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.625rem; }
    .cs-similar-card { display: flex; justify-content: space-between; align-items: center; padding: 0.625rem 0.875rem; border: 1px solid var(--color-border-soft); border-radius: 8px; text-decoration: none; color: var(--color-foreground); font-size: 0.875rem; transition: all 150ms; }
    .cs-similar-card:hover { border-color: var(--color-primary); text-decoration: none; }
    .cs-similar-card .pop { font-size: 0.75rem; color: var(--color-muted); font-weight: 500; }
    .cs-feedback-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .cs-feedback-card { padding: 1.125rem; background: var(--color-card-bg); border: 1px solid var(--color-border); border-radius: 10px; text-decoration: none; color: var(--color-foreground); transition: all 200ms; }
    .cs-feedback-card:hover { border-color: var(--color-primary); transform: translateY(-2px); text-decoration: none; }
    .cs-feedback-card .icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .cs-feedback-card h3 { font-size: 0.9375rem; font-weight: 700; margin: 0 0 0.25rem; }
    .cs-feedback-card p { font-size: 0.8125rem; color: var(--color-foreground-soft); margin: 0; line-height: 1.4; }
    @media (max-width: 640px) {
      .cs-hero { padding: 1.5rem; }
      .cs-hero-clock { text-align: center; }
      .cs-states-grid { grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); }
    }
  </style>
</head>
<body class="shell-page">
  <header class="site-header">
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
            <div class="dropdown-divider"></div>
            <div class="dropdown-section-label">Learn</div>
            <a href="/world-time/about/" class="dropdown-item" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon world" aria-hidden="true">💡</span>What is a World Clock?</span>
              <span class="dropdown-desc">How live world clocks work</span>
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
            <a href="/time-zones/in/" class="dropdown-item" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">🗺️</span>Time Zones in [Country]</span>
              <span class="dropdown-desc">All countries and their zones</span>
            </a>
            <div class="dropdown-divider"></div>
            <div class="dropdown-section-label">Learn</div>
            <a href="/time-zones/what-is/" class="dropdown-item" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">💡</span>What is a Time Zone?</span>
              <span class="dropdown-desc">UTC, offsets, and the prime meridian</span>
            </a>
            <a href="/time-zones/dst/" class="dropdown-item" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">⏰</span>Daylight Saving Time</span>
              <span class="dropdown-desc">Spring forward, fall back</span>
            </a>
            <a href="/time-zones/utc/" class="dropdown-item" role="menuitem">
              <span class="dropdown-title"><span class="dropdown-icon tz" aria-hidden="true">🛰️</span>UTC &amp; GMT</span>
              <span class="dropdown-desc">The world's time standard</span>
            </a>
          </div>
        </div>
        <a href="/news/" class="nav-link">News</a>
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
      <a href="/time-zones/in/" class="mobile-nav-link mobile-nav-sub">Time Zones in [Country]</a>
      <a href="/time-zones/what-is/" class="mobile-nav-link mobile-nav-sub">What is a Time Zone?</a>
      <a href="/time-zones/dst/" class="mobile-nav-link mobile-nav-sub">Daylight Saving Time</a>
      <a href="/news/" class="mobile-nav-link">News</a>
    </nav>
  </aside>

  <!-- Today bar removed 2026-07-28 — was overlapping site header; breadcrumb
       is now sticky instead. -->

  <main class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/world-time/">World time</a></li>
        <li><a href="/world-time/${countrySlug}/">${countryName}</a></li>
        <li aria-current="page">${cityName}</li>
      </ol>
    </nav>

    <div class="coming-soon">
      <div class="cs-hero">
        <div class="cs-hero-info">
          <span class="cs-badge">${cityData ? 'Live data ready' : 'Coming soon'}</span>
          <h1>${cityName}, ${countryName}</h1>
          <div class="cs-country">${flagUrl ? `<img class="cs-flag" src="${flagUrl}" alt="${countryName} flag" width="56" height="38" loading="lazy" />` : ''} <a href="${countryUrl}">${countryName}</a> · <span>${ianaTz}</span></div>
          <div class="cs-meta">
            ${popStr ? `<span>👥 <strong>${popStr}</strong> people</span>` : ''}
            ${lat != null ? `<span>📍 <strong>${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}</strong></span>` : ''}
            <span>🕐 <strong>${ianaTz}</strong></span>
          </div>
        </div>
        <div class="cs-hero-clock">
          <div class="cs-hero-clock-time" id="cs-clock-time" data-tz="${safeTz}">--:--:--</div>
          <div class="cs-hero-clock-date" id="cs-clock-date">—</div>
          <div class="cs-hero-clock-tz" id="cs-clock-tz">${ianaTz} <span class="pill" id="cs-clock-offset">UTC</span></div>
        </div>
      </div>

      <script>
        (function() {
          var TZ = "${safeTz}";
          var timeEl = document.getElementById('cs-clock-time');
          var dateEl = document.getElementById('cs-clock-date');
          var offEl  = document.getElementById('cs-clock-offset');
          if (!timeEl) return;
          function tick() {
            try {
              var now = new Date();
              var t = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
              var d = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(now);
              timeEl.textContent = t;
              if (dateEl) dateEl.textContent = d;
              var dtf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' });
              var parts = dtf.formatToParts(now);
              for (var i = 0; i < parts.length; i++) {
                if (parts[i].type === 'timeZoneName') {
                  if (offEl) offEl.textContent = parts[i].value;
                  break;
                }
              }
            } catch (e) { timeEl.textContent = '--:--:--'; }
          }
          tick();
          setInterval(tick, 1000);
        })();
      </script>

      <div class="cs-section">
        <h2>About ${cityName}</h2>
        <div class="cs-context-row">
          <span><strong>Country:</strong> <a href="${countryUrl}">${countryName}</a>${cca2 ? ` (${cca2})` : ''}</span>
          <span><strong>Time zone:</strong> ${ianaTz}</span>
          ${lat != null ? `<span><strong>Coordinates:</strong> ${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}</span>` : ''}
          ${popStr ? `<span><strong>Population:</strong> ${popStr}</span>` : ''}
        </div>
      </div>

      ${similarCities.length ? `
      <div class="cs-section">
        <h2>Other major cities in ${countryName}</h2>
        <p class="cs-section-desc">Compare time across ${countryName}'s biggest cities.</p>
        <div class="cs-similar-list">
          ${similarCities.map(c => {
            const slug = cityAsciiNameToSlug(c.asciiName || c.name);
            return `<a href="/world-time/${countrySlug}/${slug}/" class="cs-similar-card">
              <span>${escapeHtml(c.name || c.asciiName || '')}</span>
              <span class="pop">${(c.population || 0) > 0 ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(c.population) : ''}</span>
            </a>`;
          }).join('')}
        </div>
      </div>` : ''}

      <div class="cs-section">
        <h2>Time tools</h2>
        <p class="cs-section-desc">Use these tools with ${cityName} pre-filled.</p>
        <div class="cs-card-grid">
          <a href="/world-time/meeting/?cities=${encodeURIComponent(cityName)}" class="cs-link-card">
            <span class="cs-card-label">Tool</span>
            <span class="cs-card-title">Meeting Planner</span>
            <span class="cs-card-sub">Find times that work for everyone across cities.</span>
          </a>
          <a href="/time-zones/converter/?from=${encodeURIComponent(ianaTz)}" class="cs-link-card">
            <span class="cs-card-label">Tool</span>
            <span class="cs-card-title">Time Zone Converter</span>
            <span class="cs-card-sub">Compare ${ianaTz} with any other zone.</span>
          </a>
          <a href="/world-time/event/?time=20:00&city=${encodeURIComponent(cityName)}" class="cs-link-card">
            <span class="cs-card-label">Tool</span>
            <span class="cs-card-title">Event Time Announcer</span>
            <span class="cs-card-sub">Show local times for a global event.</span>
          </a>
          <a href="/time-zones/dst/?tz=${encodeURIComponent(ianaTz)}" class="cs-link-card">
            <span class="cs-card-label">Learn</span>
            <span class="cs-card-title">DST in ${countryName}</span>
            <span class="cs-card-sub">Current offset, next change, full rules.</span>
          </a>
        </div>
      </div>

      <div class="cs-section">
        <h2>Today &amp; history</h2>
        <p class="cs-section-desc">What's happening today, in history, and in ${countryName}.</p>
        <div class="cs-card-grid">
          <a href="/" class="cs-link-card">
            <span class="cs-card-label">Today</span>
            <span class="cs-card-title">What day is it?</span>
            <span class="cs-card-sub">Today's date, day length, week number.</span>
          </a>
          <a href="/onthisday/" class="cs-link-card">
            <span class="cs-card-label">On this day</span>
            <span class="cs-card-title">Historical events today</span>
            <span class="cs-card-sub">50 curated events from history.</span>
          </a>
          <a href="/holidays/${cca2Lower}/" class="cs-link-card">
            <span class="cs-card-label">Holidays</span>
            <span class="cs-card-title">${countryName} public holidays</span>
            <span class="cs-card-sub">Full year calendar with long-weekend finder.</span>
          </a>
          <a href="/news/timezone/" class="cs-link-card">
            <span class="cs-card-label">News</span>
            <span class="cs-card-title">Latest time zone news</span>
            <span class="cs-card-sub">DST changes, leap seconds, calendar shifts.</span>
          </a>
        </div>
      </div>

      <div class="cs-section">
        <h2>Learn about time zones</h2>
        <div class="cs-card-grid">
          <a href="/time-zones/what-is/" class="cs-link-card">
            <span class="cs-card-label">Learn</span>
            <span class="cs-card-title">What is a time zone?</span>
            <span class="cs-card-sub">UTC offsets and the prime meridian.</span>
          </a>
          <a href="/time-zones/dst/" class="cs-link-card">
            <span class="cs-card-label">Learn</span>
            <span class="cs-card-title">Daylight Saving Time</span>
            <span class="cs-card-sub">Spring forward, fall back — who does it?</span>
          </a>
          <a href="/time-zones/utc/" class="cs-link-card">
            <span class="cs-card-label">Learn</span>
            <span class="cs-card-title">UTC &amp; GMT</span>
            <span class="cs-card-sub">The world's time standard.</span>
          </a>
          <a href="/news/2026/07/history-of-timekeeping/" class="cs-link-card">
            <span class="cs-card-label">Story</span>
            <span class="cs-card-title">The history of timekeeping</span>
            <span class="cs-card-sub">From sundials to atomic clocks.</span>
          </a>
        </div>
      </div>

      <div class="cs-section">
        <h2>Popular US cities</h2>
        <p class="cs-section-desc">Our deepest coverage is the United States. These are the most-watched cities.</p>
        <div class="cs-card-grid">
          ${TOP_US_CITIES.map(c => `
          <a href="/world-time/united-states/${c.slug}/" class="cs-link-card">
            <span class="cs-card-label">${c.state}</span>
            <span class="cs-card-title">${c.name}</span>
            <span class="cs-card-sub">Live time, weather, holidays.</span>
          </a>`).join('')}
        </div>
      </div>

      <div class="cs-section">
        <h2>Browse all 50 US states</h2>
        <p class="cs-section-desc">Pick a state to see all its cities, current times, and DST rules.</p>
        <div class="cs-states-grid">
          ${US_STATES_GRID.map(s => `
          <a href="/world-time/united-states/state/${s.slug}/" class="cs-state-tile">
            <span class="cs-state-code">${s.code}</span>
            <span>${s.name}</span>
          </a>`).join('')}
        </div>
      </div>

      <div class="cs-section">
        <h2>Help us build this page</h2>
        <p class="cs-section-desc">If you live in or have visited ${cityName}, we'd love to hear from you.</p>
        <div class="cs-feedback-grid">
          <a href="/feedback/?type=city&city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(countryName)}" class="cs-feedback-card">
            <div class="icon">📍</div>
            <h3>Suggest the city</h3>
            <p>Tell us the exact coordinates and time zone of ${cityName}.</p>
          </a>
          <a href="/feedback/?type=info&city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(countryName)}" class="cs-feedback-card">
            <div class="icon">ℹ️</div>
            <h3>Tell us more</h3>
            <p>Share history, alternate names, or local facts.</p>
          </a>
          <a href="/feedback/?type=notify&city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(countryName)}" class="cs-feedback-card">
            <div class="icon">🔔</div>
            <h3>Notify me</h3>
            <p>Get an email when this page goes live.</p>
          </a>
        </div>
      </div>
    </div>

    <section class="continue-strip" aria-label="Continue your journey">
      <h2 class="continue-strip-title">Continue your journey</h2>
      <div class="continue-strip-grid">
        <a class="continue-strip-card" href="/world-time/">
          <span class="continue-strip-icon" aria-hidden="true">🌐</span>
          <span class="continue-strip-card-title">World Time Hub</span>
          <span class="continue-strip-card-sub">Browse 33,945 cities by region &amp; country</span>
        </a>
        <a class="continue-strip-card" href="/time-zones/">
          <span class="continue-strip-icon" aria-hidden="true">🕐</span>
          <span class="continue-strip-card-title">All Time Zones</span>
          <span class="continue-strip-card-sub">408 IANA zones, UTC offsets, DST rules</span>
        </a>
        <a class="continue-strip-card" href="/world-time/meeting/">
          <span class="continue-strip-icon" aria-hidden="true">📅</span>
          <span class="continue-strip-card-title">Meeting Planner</span>
          <span class="continue-strip-card-sub">Find times that work for everyone</span>
        </a>
        <a class="continue-strip-card" href="/news/">
          <span class="continue-strip-icon" aria-hidden="true">📰</span>
          <span class="continue-strip-card-title">News &amp; Editorial</span>
          <span class="continue-strip-card-sub">Time, time zones, astronomy, calendars</span>
        </a>
      </div>
    </section>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="site-footer-inner">
      <nav class="site-footer-nav" aria-label="Site links">
        <a href="/">Home</a>
        <a href="/holidays/">Holidays</a>
        <a href="/onthisday/">On this day</a>
        <a href="/about/">About</a>
        <a href="/editorial-policy/">Editorial policy</a>
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        <a href="mailto:hello@dateandtime.live">Contact</a>
        <a href="/sitemap.xml">Sitemap</a>
      </nav>
      <p class="site-footer-meta">
        © 2026 dateandtime.live — ${cityName}, ${countryName} ·
        33,945 cities · 408 time zones · 1,600+ holidays ·
        Data: <a href="/editorial-policy/">IANA · GeoNames · Nager.Date · Wikipedia</a>
      </p>
      <p class="site-footer-meta">
        <a href="#" data-action="do-not-sell">Do Not Sell or Share My Personal Information</a> (CCPA)
      </p>
    </div>
  </footer>
  <script src="/src/site-shell.js" defer></script>
  <script>
    // Today bar removed 2026-07-28 — no element to update. The live clock
    // in the hero (where applicable) shows current time.
  </script>
</body>
</html>`;
}


// ===== Cookie consent helpers =====
const COOKIE_NAME = "cookie_consent";
const COOKIE_VERSION = 1;

const GDPR_COUNTRIES = new Set([
  // EU 27
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
  // UK
  "GB","UK",
  // Brazil (LGPD)
  "BR",
  // Canada (Quebec Law 25 + federal PIPEDA)
  "CA"
]);

function parseConsentCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    const v = JSON.parse(decodeURIComponent(match[1]));
    if (v && v.v === COOKIE_VERSION) return v;
  } catch (e) {}
  return null;
}

function consentRegion(country) {
  if (!country) return "OTHER";
  if (GDPR_COUNTRIES.has(country)) return "GDPR";
  return "OTHER";
}

// ===== Google Consent Mode v2 =====
// https://developers.google.com/tag-platform/security/guides/consent
// For EEA/UK: deny all by default. For other regions: grant by default.
// This MUST be set before any Google tag loads (AdSense, GA4, etc.).
function buildGtagConsentScript(region) {
  const isGDPR = region === "GDPR";
  const defaults = isGDPR
    ? { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", wait_for_update: 500 }
    : { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", wait_for_update: 500 };
  // dataLayer + gtag() stub + consent default + ads_data_redaction
  // (ads_data_redaction ensures IP addresses are removed from Google hits
  //  when ad_user_data is denied, for cookieless pings)
  return `<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', ${JSON.stringify(defaults)});
  gtag('set', 'ads_data_redaction', true);
</script>`;
}

// ===== Initial time helper (SSR) =====
function getInitialTime(timezone) {
  try {
    const tz = timezone || "UTC";
    return {
      iso: new Date().toISOString(),
      unix_ms: Date.now(),
      formatted: new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(new Date())
    };
  } catch (e) {
    return { iso: new Date().toISOString(), unix_ms: Date.now(), formatted: new Date().toUTCString() };
  }
}

// ===== HTML escaping =====
function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ===== Cookie banner HTML =====
function buildCookieBannerHTML(region) {
  const isGDPR = region === "GDPR";
  const intro = isGDPR
    ? "Under GDPR/CCPA, we need your consent before non-essential cookies. We use essential cookies to keep the clock working. Analytics and ads are opt-in."
    : "We use essential cookies to keep the clock working. Analytics and ads are opt-in.";
  return `
<div id="cookie-banner" class="cookie-banner is-hidden" role="dialog" aria-label="Cookie preferences" aria-live="polite">
  <div class="cookie-banner-inner">
    <div class="cookie-banner-content">
      <p class="cookie-banner-eyebrow">🍪 Cookies</p>
      <p class="cookie-banner-text">${intro} <a href="/privacy/">Privacy</a> · <a href="#" data-action="show-customize">Customize</a></p>
    </div>
    <div class="cookie-banner-actions">
      <button class="cookie-btn cookie-btn-secondary" data-consent="essential" type="button">Essential only</button>
      <button class="cookie-btn cookie-btn-primary" data-consent="all" type="button">Accept all</button>
    </div>
  </div>
  <div id="cookie-customize" class="cookie-customize is-hidden">
    <h3>Customize</h3>
    <label class="cookie-cat">
      <input type="checkbox" data-category="essential" checked disabled>
      <span><strong>Essential</strong> — required for the site to work (theme, location, preferences). Always on.</span>
    </label>
    <label class="cookie-cat">
      <input type="checkbox" data-category="analytics">
      <span><strong>Analytics</strong> — help us understand which features are useful. Not enabled by default.</span>
    </label>
    <label class="cookie-cat">
      <input type="checkbox" data-category="advertising">
      <span><strong>Advertising</strong> — allows non-intrusive ads. Keeps the site free.</span>
    </label>
    <button class="cookie-btn cookie-btn-primary" data-consent="save" type="button">Save preferences</button>
  </div>
</div>
<link rel="stylesheet" href="/src/cookie-consent.css">
<script src="/src/cookie-consent.js" defer></script>
`;
}

// ===== JSON-LD helpers (for pages that don't already have it) =====
const JSON_LD_HOME = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": "dateandtime.live",
      "url": "https://dateandtime.live/",
      "description": "Live, accurate time for any city in the world. IANA time zones, UTC offsets, DST status, sunrise & sunset, holidays, and business hours — all in one place.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": "https://dateandtime.live/?q={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "SoftwareApplication",
      "name": "dateandtime.live",
      "url": "https://dateandtime.live/",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any (web)",
      "browserRequirements": "Requires JavaScript",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
      "description": "Free world clock + time zone + holiday browser for 33,945 cities worldwide."
    }
  ]
};

const FAQ_HOME = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "What time is it in [city]?",
      "acceptedAnswer": { "@type": "Answer", "text": "Our site auto-detects your city and shows the current time, plus you can search any of 33,945 cities worldwide. The clock updates every second and shows the IANA time zone, UTC offset, and DST status." } },
    { "@type": "Question", "name": "How do I find the time difference between two cities?",
      "acceptedAnswer": { "@type": "Answer", "text": "Add both cities to your favorites rail. Click one to show its time in the big clock; the other stays visible in the rail. The offset between them is shown in each card." } },
    { "@type": "Question", "name": "Is this site free?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. dateandtime.live is free to use, with no signup required. We don't sell your data. Optional advertising keeps the site free (only shown if you opt in to advertising cookies)." } },
    { "@type": "Question", "name": "How accurate is the time shown?",
      "acceptedAnswer": { "@type": "Answer", "text": "The time is computed in your browser using the JavaScript Intl.DateTimeFormat API, which uses the IANA Time Zone Database. We cross-check against our server time to within ~50ms (network round-trip). For safety-critical timing, consult an official source." } },
    { "@type": "Question", "name": "Does this site work offline?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes, after the first visit. We use Cloudflare's edge cache and have minimal JS dependencies, so the page loads fast even on slow networks." } },
    { "@type": "Question", "name": "Can I use this for commercial purposes?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. You may use the site for personal or commercial purposes. The data is sourced from public-domain and open-license sources (IANA, GeoNames, Nager.Date, Wikipedia). See our Editorial Policy for details." } },
    { "@type": "Question", "name": "Do you have data for my country?",
      "acceptedAnswer": { "@type": "Answer", "text": "We cover 33,945 cities in 242 countries and territories, 408 IANA time zones, and 1,600+ public holidays across 39 countries. If something is missing, use the feedback button and we'll add it." } },
    { "@type": "Question", "name": "How do I report an error?",
      "acceptedAnswer": { "@type": "Answer", "text": "Click the feedback button at the bottom-right of any page, or email hello@dateandtime.live. We aim to fix critical errors within 7 days." } }
  ]
};

function buildHomeJsonLd() {
  return `<script type="application/ld+json">${JSON.stringify(JSON_LD_HOME)}</script>
<script type="application/ld+json">${JSON.stringify(FAQ_HOME)}</script>`;
}

// ===== SSR injection =====
function injectSSR(html, location, initialTime, consent, region) {
  let out = html;

  // 1. Inject window.__location + __initialTime + __consentRegion + __hasConsent
  //    BEFORE the first <script> tag.
  //    NOTE: only inject __hasConsent if we have a real cookie. Otherwise set
  //    to null so cookie-consent.js shows the banner on first visit.
  const hasConsentValue = consent ? JSON.stringify(consent) : "null";
  const ssrGlobals = `<script>window.__location=${JSON.stringify(location)};window.__initialTime=${JSON.stringify(initialTime)};window.__consentRegion=${JSON.stringify(region)};window.__hasConsent=${hasConsentValue};<\/script>`;

  // 1a. Inject Google Consent Mode v2 default (BEFORE any Google tag).
  //     For EEA/UK: deny by default. For other regions: grant.
  //     When we add AdSense/GA4 later, they'll read this consent state
  //     and either fire (granted) or send cookieless pings (denied).
  const gtagConsent = buildGtagConsentScript(region);

  if (out.includes("<script>")) {
    out = out.replace(/<script>/, ssrGlobals + gtagConsent + "<script>");
  } else {
    out = out.replace(/<\/head>/, ssrGlobals + gtagConsent + "</head>");
  }

  // 2. Replace the H1 placeholder with the actual city
  if (location.city) {
    out = out.replace(
      /<span class="greeting-city" id="greeting-city">[^<]*<\/span>/,
      `<span class="greeting-city" id="greeting-city">${esc(location.city)}</span>`
    );
  }

  // 3. Update <title> if we know the city AND it's the home page
  //    (don't overwrite titles on /world-time/, /holidays/, etc.)
  if (location.city && out.includes('id="greeting-city"')) {
    const newTitle = location.regionCode
      ? `Current Time in ${esc(location.city)}, ${esc(location.regionCode)} | dateandtime.live`
      : `Current Time in ${esc(location.city)} | dateandtime.live`;
    out = out.replace(
      /<title>[^<]*<\/title>/,
      `<title>${newTitle}</title>`
    );
  }

  // 4. Inject JSON-LD on the home page (only if not already present)
  if (out.includes('id="greeting-city"') && !out.includes('"@type":"WebSite"')) {
    out = out.replace(/<\/head>/, buildHomeJsonLd() + "</head>");
  }

  // 5. Inject cookie consent banner before </body>
  if (!out.includes('id="cookie-banner"')) {
    out = out.replace(/<\/body>/, buildCookieBannerHTML(region) + "</body>");
  }

  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Same-origin proxies (dev domains need this to bypass CORS):
    //   /api/cities          -> /api/v1/cities
    //   /api/countries       -> /api/v1/countries
    //   /api/holidays/today  -> /api/v1/holidays/today
    //   /api/holidays        -> /api/v1/holidays
    //   /api/onthisday       -> /api/v1/onthisday
    //   /api/dst/upcoming    -> /api/v1/dst/upcoming
    //   /api/cities/:id/climate -> /api/v1/cities/:id/climate
    //   /api/cities/:id/aliases -> /api/v1/cities/:id/aliases
    //   /api/countries/:cca2/working-hours -> /api/v1/countries/:cca2/working-hours
    //   /api/countries/:cca2/cities -> /api/v1/countries/:cca2/cities
    //   /api/admin/data-quality -> /api/v1/admin/data-quality
    //   /api/feedback/top    -> /api/v1/feedback/top
    //   /api/search          -> /api/v2/search
    if (url.pathname === "/api/cities") {
      return proxySimple(request, url, "/api/v1/cities");
    }
    if (url.pathname === "/api/countries") {
      return proxySimple(request, url, "/api/v1/countries");
    }
    if (url.pathname === "/api/holidays/today") {
      return proxySimple(request, url, "/api/v1/holidays/today");
    }
    if (url.pathname === "/api/holidays") {
      return proxySimple(request, url, "/api/v1/holidays");
    }
    if (url.pathname === "/api/holidays/upcoming") {
      return proxySimple(request, url, "/api/v1/holidays/upcoming");
    }
    if (url.pathname === "/api/onthisday") {
      return proxySimple(request, url, "/api/v1/onthisday");
    }
    if (url.pathname === "/api/dst/upcoming") {
      return proxySimple(request, url, "/api/v1/dst/upcoming");
    }
    if (url.pathname === "/api/search") {
      return proxySimple(request, url, "/api/v2/search");
    }
    if (url.pathname === "/api/admin/data-quality") {
      return proxySimple(request, url, "/api/v1/admin/data-quality");
    }
    if (url.pathname === "/api/feedback/top") {
      return proxySimple(request, url, "/api/v1/feedback/top");
    }
    const cityClimateMatch = url.pathname.match(/^\/api\/cities\/(\d+)\/climate$/);
    if (cityClimateMatch) {
      return proxySimple(request, url, `/api/v1/cities/${cityClimateMatch[1]}/climate`);
    }
    const cityAliasesMatch = url.pathname.match(/^\/api\/cities\/(\d+)\/aliases$/);
    if (cityAliasesMatch) {
      return proxySimple(request, url, `/api/v1/cities/${cityAliasesMatch[1]}/aliases`);
    }
    const workingHoursMatch = url.pathname.match(/^\/api\/countries\/([A-Z]{2})\/working-hours$/i);
    if (workingHoursMatch) {
      return proxySimple(request, url, `/api/v1/countries/${workingHoursMatch[1].toUpperCase()}/working-hours`);
    }
    const countryCitiesMatch = url.pathname.match(/^\/api\/countries\/([A-Z]{2})\/cities$/i);
    if (countryCitiesMatch) {
      return proxySimple(request, url, `/api/v1/countries/${countryCitiesMatch[1].toUpperCase()}/cities`);
    }
    // POST /api/feedback/:id/vote  (body forwarded, only POST allowed)
    const voteMatch = url.pathname.match(/^\/api\/feedback\/(\d+)\/vote$/);
    if (voteMatch) {
      return proxyPost(request, url, `/api/v1/feedback/${voteMatch[1]}/vote`);
    }
    // POST /api/feedback  (create new feedback)
    if (url.pathname === "/api/feedback" && request.method === "POST") {
      return proxyPost(request, url, "/api/v1/feedback");
    }
    // GET /api/feedback (admin list)
    if (url.pathname === "/api/feedback" && request.method === "GET") {
      return proxySimple(request, url, "/api/v1/feedback");
    }

    // Local time source: /api/time/now returns the worker's current time so
    // the page can compute a real clock-drift + round-trip-accuracy without
    // depending on the (still-empty) /v1/time/now endpoint on the prod API.
    if (url.pathname === "/api/time/now") {
      const t = Date.now();
      return new Response(JSON.stringify({
        data: { iso: new Date(t).toISOString(), unix_ms: t, tz: "UTC" }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "cache-control": "no-store"
        }
      });
    }

    // Redirect /home → / (the home page IS the default landing now)
    if (url.pathname === "/home" || url.pathname === "/home/") {
      return new Response(null, { status: 301, headers: { Location: "/" + url.search } });
    }

    // Redirect /meeting/ → /world-time/meeting/ (canonical URL is under world-time/)
    if (url.pathname === "/meeting" || url.pathname === "/meeting/") {
      return new Response(null, { status: 301, headers: { Location: "/world-time/meeting/" + url.search } });
    }

    // Per-event detail pages: /onthisday/event/{slug}/
    // The template is a single static file at /onthisday/event/index.html
    // and the JS reads the slug from window.location.pathname.
    // CF Pages' env.ASSETS.fetch returns a 307 redirect for /foo/index.html →
    // /foo/; we need to follow the redirect and return the body as 200.
    const eventPageMatch = url.pathname.match(/^\/onthisday\/event\/[^/]+\/?$/);
    if (eventPageMatch) {
      const templateReq = new Request(new URL("/onthisday/event/index.html", request.url), request);
      const r = await env.ASSETS.fetch(templateReq);
      // If the asset returned a 307/301 redirect to a clean URL, return the body as 200.
      if (r.status === 307 || r.status === 301) {
        const finalUrl = new URL(r.headers.get("location") || "/onthisday/event/", request.url);
        const final = await env.ASSETS.fetch(new Request(finalUrl, request));
        if (final.ok) {
          const body = await final.text();
          return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
        }
      }
      return r;
    }

    // Per-person detail pages: /person/{slug}/
    const personPageMatch = url.pathname.match(/^\/person\/[^/]+\/?$/);
    if (personPageMatch) {
      const templateReq = new Request(new URL("/person/index.html", request.url), request);
      const r = await env.ASSETS.fetch(templateReq);
      if (r.status === 307 || r.status === 301) {
        const finalUrl = new URL(r.headers.get("location") || "/person/", request.url);
        const final = await env.ASSETS.fetch(new Request(finalUrl, request));
        if (final.ok) {
          const body = await final.text();
          return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
        }
      }
      return r;
    }

    // City page preview files: /city-page-preview/{slug}.html
    // (Templates A, B, C, D + comparison)
    // CF Pages' env.ASSETS.fetch returns 307 to clean URL; we follow internally.
    const cityPreviewMatch = url.pathname.match(/^\/city-page-preview\/[^/]+\.html$/);
    if (cityPreviewMatch) {
      const cleanUrl = new URL(url.pathname.replace(/\.html$/, "/"), request.url).toString();
      const r = await env.ASSETS.fetch(cleanUrl);
      if (r.ok) {
        const body = await r.text();
        return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return new Response("Asset not found: " + r.status, { status: 500 });
    }

    // City pages: /world-time/city/{slug}/...
    // (LEGACY path v1 — migrated to /world-time/{country-name-slug}/{slug}/.)
    //
    // We issue a 301 redirect to the canonical new path. For the 911 pre-built
    // cities, SLUG_TO_COUNTRY has the slug -> cca2 mapping. For unknown slugs
    // (the 33K we haven't pre-built yet), the redirect lands on a 404 in the
    // new path.
    const legacyCityMatch = url.pathname.match(/^\/world-time\/city\/([^/]+)(\/.*)?\/?$/);
    if (legacyCityMatch) {
      const slug = legacyCityMatch[1];
      const tail = legacyCityMatch[2] || '/';
      const cca2 = SLUG_TO_COUNTRY[slug];
      if (cca2) {
        // SLUG_TO_COUNTRY keys are lowercase ("us", "gb", ...), but the
        // CCA2_TO_COUNTRY_SLUG map is built with uppercase keys for
        // human-friendly comparison. Look up both forms.
        const countrySlug = CCA2_TO_COUNTRY_SLUG[cca2.toUpperCase()] || CCA2_TO_COUNTRY_SLUG[cca2] || cca2;
        // If the request has a sub-page tail (e.g. /time/, /facts/, /weather/)
        // and the canonical new path doesn't have those sub-page files, the
        // chain would end in a 404. The new city pages are single-file with all
        // sections inline, so we redirect sub-page requests to the parent city
        // page (with a 301) and let the page's own in-page navigation handle
        // the section anchor.
        const cleanTail = tail && tail !== '/' && tail !== '' ? tail : '/';
        // Whitelist of legacy sub-page tails that we know were never built as
        // separate files. Any other tail would 404 anyway, so we normalize
        // them to the parent page.
        const subPageTails = ['/time/', '/time', '/facts/', '/facts', '/weather/', '/weather', '/map/', '/map'];
        const isSubPage = subPageTails.includes(cleanTail);
        const newPath = isSubPage
          ? `/world-time/${countrySlug}/${slug}/`
          : `/world-time/${countrySlug}/${slug}${cleanTail === '/' ? '/' : cleanTail}`;
        return new Response(null, { status: 301, headers: { Location: newPath } });
      }
      // Unknown slug: fall through and try the legacy asset (so we don't 404
      // the user's link if the city was built before this migration but the
      // slug map doesn't have it).
      const templateReq = new Request(new URL(url.pathname.replace(/\/?$/, '/') + "index.html", request.url).toString());
      const r = await env.ASSETS.fetch(templateReq);
      if (r.ok) {
        const body = await r.text();
        return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return new Response("City page not found: " + slug, { status: 404 });
    }

    // City pages: /world-time/{cca2}/{slug}/...
    // (LEGACY path v2 — migrated to /world-time/{country-name-slug}/{slug}/ on
    // 2026-07-25.) The new path uses the human-readable country name (e.g.
    // "united-states") instead of the cca2 code ("us").
    const cca2CityMatch = url.pathname.match(/^\/world-time\/([a-z]{2})\/([^/]+)(\/.*)?\/?$/i);
    if (cca2CityMatch) {
      const cca2 = cca2CityMatch[1].toUpperCase();
      const slug = cca2CityMatch[2];
      const tail = cca2CityMatch[3] || '/';
      const countrySlug = CCA2_TO_COUNTRY_SLUG[cca2];
      if (countrySlug) {
        // Same sub-page tail handling as legacyCityMatch above.
        const cleanTail = tail && tail !== '/' && tail !== '' ? tail : '/';
        const subPageTails = ['/time/', '/time', '/facts/', '/facts', '/weather/', '/weather', '/map/', '/map'];
        const isSubPage = subPageTails.includes(cleanTail);
        const newPath = isSubPage
          ? `/world-time/${countrySlug}/${slug}/`
          : `/world-time/${countrySlug}/${slug}${cleanTail === '/' ? '/' : cleanTail}`;
        return new Response(null, { status: 301, headers: { Location: newPath } });
      }
      // Unknown cca2: fall through to ASSETS
    }

    // State pages: /world-time/{country-name-slug}/{state-slug}/
    // (LEGACY — migrated to /world-time/{country-name-slug}/state/{state-slug}/
    // on 2026-07-25.) This pattern was the original state page URL but
    // collided with city slugs (e.g. /united-states/washington/ would be
    // both the city AND the state of Washington).
    const legacyStateMatch = url.pathname.match(/^\/world-time\/([a-z][a-z-]+)\/([a-z][a-z-]+)(\/.*)?\/?$/);
    if (legacyStateMatch) {
      const countrySlug = legacyStateMatch[1];
      const stateSlug = legacyStateMatch[2];
      const tail = legacyStateMatch[3] || '/';
      // SKIP if this slug is a city (e.g. /united-states/washington/ is the
      // city Washington D.C., not the state of Washington). SLUG_TO_COUNTRY
      // is the parsed 911-entry city→cca2 map from SLUG_DATA.
      const isCity = SLUG_TO_COUNTRY[stateSlug] !== undefined;
      if (!isCity && LEGACY_STATE_MAP && LEGACY_STATE_MAP[`${countrySlug}|${stateSlug}`]) {
        const cleanTail = tail && tail !== '/' && tail !== '' ? tail : '/';
        const newPath = cleanTail === '/'
          ? `/world-time/${countrySlug}/state/${stateSlug}/`
          : `/world-time/${countrySlug}/state/${stateSlug}${cleanTail}`;
        return new Response(null, { status: 301, headers: { Location: newPath } });
      }
      // Not a state (it's a city page) — fall through to ASSETS
    }

    // City pages: /world-time/{country-slug}/{city-slug}/
    // If the static HTML doesn't exist (we only pre-build 911 cities; the DB
    // has 33,945), serve a "coming soon" page with live time, educational
    // links, and a feedback form so users can suggest we add the city.
    const comingSoonMatch = url.pathname.match(/^\/world-time\/([a-z][a-z0-9-]+)\/([a-z][a-z0-9-]+)\/?$/);
    if (comingSoonMatch) {
      const countrySlug = comingSoonMatch[1];
      const citySlug = comingSoonMatch[2];
      // Try the static asset. CF Pages returns 200 with HTML for both
      // existing and non-existing files (the 404 body for missing ones
      // is small ~8KB; existing pages are 30-50KB). Use body length
      // to distinguish: a real city page is >20KB; a 404 body is <12KB.
      let cityCheck;
      try {
        cityCheck = await env.ASSETS.fetch(
          new Request(url.origin + `/world-time/${countrySlug}/${citySlug}/`)
        );
        // Read the body to check the size.
        const buf = await cityCheck.arrayBuffer();
        if (buf.byteLength < 12000) {
          // Likely a 404 fallback page. Serve coming-soon.
          try {
            return new Response(await generateComingSoonPage(countrySlug, citySlug, request), {
              status: 200,
              headers: { "content-type": "text/html; charset=utf-8" }
            });
          } catch (e) {
            return new Response("Coming-soon error: " + e.message, { status: 500 });
          }
        }
      } catch (e) {
        // Error fetching — fall through to default asset serving.
      }
    }

    // Get the asset (HTML or other) from the [assets] binding.
    const response = await env.ASSETS.fetch(request);

    // Only inject for HTML responses.
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

    // Build the location object from Cloudflare's IP data.
    const cf = request.cf || {};
    const lat = parseFloat(cf.latitude);
    const lon = parseFloat(cf.longitude);
    const location = {
      city: cf.city || "",
      region: cf.region || "",                // e.g. "Florida"
      regionCode: cf.regionCode || "",        // e.g. "FL"
      country: cf.country || "",              // ISO-2, e.g. "US"
      countryName: "",
      latitude: isFinite(lat) ? lat : null,
      longitude: isFinite(lon) ? lon : null,
      timezone: cf.timezone || "",             // IANA, e.g. "America/New_York"
      nearest: null                            // populated below
    };

    // Resolve "nearest city in our DB" via the cached /v1/cities list.
    try {
      const cities = await getCities();
      const n = findNearest(cities, location.latitude, location.longitude);
      if (n && n.city) {
        location.nearest = {
          name: n.city.name,
          country: n.city.countryName || n.city.country || "",
          state_code: n.city.stateCode || n.city.state_code || "",
          tz: n.city.timezone || n.city.tz || "",
          distanceKm: Math.round(n.distanceKm * 10) / 10
        };
      }
    } catch (e) { /* tolerate upstream errors */ }

    // Parse cookie consent
    const consent = parseConsentCookie(request.headers.get("cookie"));
    const region = consentRegion(location.country);
    const initialTime = getInitialTime(location.timezone);

    // Inject SSR globals + cookie banner + JSON-LD
    const html = await response.text();
    const injected = injectSSR(html, location, initialTime, consent, region);

    return new Response(injected, { headers: response.headers });
  }
};

function getUpstreamBase(request) {
  // Use dev API for the dev Worker, prod API for prod. Detected by host.
  const host = new URL(request.url).hostname;
  if (host === "tdp-landing-dev.nsura2029.workers.dev" || host.endsWith(".dev.")) {
    return "https://dev.api.dateandtime.live";
  }
  return "https://api.dateandtime.live";
}

async function proxySimple(request, url, upstreamPath) {
  const base = getUpstreamBase(request);
  const upstream = `${base}${upstreamPath}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;
  try {
    const r = await fetch(upstream, { headers: { "Accept": "application/json" } });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=300"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "upstream_unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
    });
  }
}

async function proxyPost(request, url, upstreamPath) {
  const base = getUpstreamBase(request);
  const upstream = `${base}${upstreamPath}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;
  let body;
  try { body = await request.text(); } catch (e) {}
  try {
    const r = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: body || "{}"
    });
    const respBody = await r.text();
    return new Response(respBody, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "upstream_unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
    });
  }
}
