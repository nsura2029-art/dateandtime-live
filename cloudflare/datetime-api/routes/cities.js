/**
 * City-related routes (cities/nearby, cities/:id, cities/:id/climate)
 *
 * GET /api/v1/cities/nearby?lat=&lon=&limit=&country=
 *   Returns N cities near the given lat/lon, ordered by haversine distance.
 *   Used for "Cities near X" section + browser geolocation "near me".
 *
 * GET /api/v1/cities/:id
 *   Full city record by ID.
 *
 * GET /api/v1/cities/:id/climate
 *   12-month climate data (avg high/low temp, rainfall, daylight).
 *
 * All responses cacheable at edge (5min for nearby, 1h for stable data).
 */

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400',
  'Content-Type': 'application/json; charset=utf-8'
};

const SHORT_CACHE = {
  'Cache-Control': 'public, max-age=300, s-maxage=600',
  'Content-Type': 'application/json; charset=utf-8'
};

/**
 * Haversine distance in km (computed in SQL via formula below for speed).
 * Note: SQLite/D1 doesn't support POWER(), so we use multiplication.
 * Formula: 6371 * 2 * ASIN(SQRT(sin²(dlat/2) + cos(lat1)*cos(lat2)*sin²(dlon/2)))
 */
const HAVERSINE_SQL = `
  6371 * 2 * ASIN(SQRT(
    SIN((RADIANS(? - latitude) / 2)) * SIN((RADIANS(? - latitude) / 2)) +
    COS(RADIANS(latitude)) * COS(RADIANS(?)) *
    SIN((RADIANS(? - longitude) / 2)) * SIN((RADIANS(? - longitude) / 2))
  ))
`;

/**
 * GET /api/v1/cities/nearby
 *
 * Query params:
 *   lat (required)  - latitude
 *   lon (required)  - longitude
 *   limit           - number of results (default 6, max 50)
 *   country         - ISO 3166-1 alpha-2 filter (optional)
 *   radius          - max distance in km (optional, default no limit)
 *   minPopulation   - min population filter (optional, default 0)
 */
async function handleCitiesNearby(env, request) {
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '6', 10), 50);
  const country = (url.searchParams.get('country') || '').toUpperCase();
  const radius = parseFloat(url.searchParams.get('radius') || '0');
  const minPop = parseInt(url.searchParams.get('minPopulation') || '0', 10);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'BAD_PARAMS', message: 'lat and lon are required (lat: -90 to 90, lon: -180 to 180)' }
    }), { status: 400, headers: CACHE_HEADERS });
  }

  if (!env.OTD_DB) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'NO_DB', message: 'Database not available' }
    }), { status: 503, headers: CACHE_HEADERS });
  }

  try {
    // Build query: lat/lon are passed 5 times each (5 SIN/COS refs in formula)
    const params = [lat, lat, lat, lon, lon];
    let where = 'WHERE 1=1';
    if (country) {
      where += ' AND c.country = ?';
      params.push(country);
    }
    if (minPop > 0) {
      where += ' AND c.population >= ?';
      params.push(minPop);
    }

    const sql = `
      SELECT
        c.id, c.name, c.ascii_name, c.country, c.state_code,
        c.latitude, c.longitude, c.tz, c.population, c.is_capital,
        co.name AS country_name,
        ${HAVERSINE_SQL} AS distance_km
      FROM cities c
      LEFT JOIN countries co ON co.iso2 = c.country
      ${where}
      ORDER BY distance_km ASC
      LIMIT ?
    `;
    params.push(limit);

    const result = await env.OTD_DB.prepare(sql).bind(...params).all();
    let cities = (result.results || []).map(c => ({
      id: c.id,
      name: c.name,
      asciiName: c.ascii_name,
      countryCode: c.country,
      countryName: c.country_name,
      stateCode: c.state_code,
      latitude: c.latitude,
      longitude: c.longitude,
      timezone: c.tz,
      population: c.population,
      isCapital: !!c.is_capital,
      distance_km: Math.round((c.distance_km || 0) * 10) / 10
    }));

    // Optional radius filter (post-query, since SQL is simpler without it)
    if (radius > 0) {
      cities = cities.filter(c => c.distance_km <= radius);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        origin: { lat, lon },
        radius_km: radius || null,
        country: country || null,
        cities,
        count: cities.length
      },
      attribution: {
        text: 'City data from GeoNames (CC BY 4.0). Distance computed via Haversine formula.',
        geonames: 'https://www.geonames.org/',
        license: 'https://creativecommons.org/licenses/by/4.0/'
      }
    }, null, 2), { headers: SHORT_CACHE });
  } catch (err) {
    console.error('cities/nearby error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'QUERY_FAILED', message: err.message }
    }), { status: 500, headers: CACHE_HEADERS });
  }
}

/**
 * GET /api/v1/cities/:id
 * Returns a single city record by ID.
 */
async function handleCityById(env, idStr) {
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id <= 0) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'BAD_ID', message: 'Invalid city ID' }
    }), { status: 400, headers: CACHE_HEADERS });
  }

  if (!env.OTD_DB) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'NO_DB', message: 'Database not available' }
    }), { status: 503, headers: CACHE_HEADERS });
  }

  try {
    const result = await env.OTD_DB.prepare(`
      SELECT * FROM cities WHERE id = ? LIMIT 1
    `).bind(id).all();

    if (!result.results || result.results.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: `No city with id ${id}` }
      }), { status: 404, headers: CACHE_HEADERS });
    }

    return new Response(JSON.stringify({
      success: true,
      data: result.results[0]
    }, null, 2), { headers: CACHE_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'QUERY_FAILED', message: err.message }
    }), { status: 500, headers: CACHE_HEADERS });
  }
}

/**
 * GET /api/v1/cities/:id/climate
 * Returns 12-month climate data + seasons for a city.
 */
async function handleCityClimate(env, idStr) {
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id <= 0) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'BAD_ID', message: 'Invalid city ID' }
    }), { status: 400, headers: CACHE_HEADERS });
  }

  if (!env.OTD_DB) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'NO_DB', message: 'Database not available' }
    }), { status: 503, headers: CACHE_HEADERS });
  }

  try {
    const cityResult = await env.OTD_DB.prepare(`
      SELECT id, name, country AS countryCode, latitude, longitude FROM cities WHERE id = ? LIMIT 1
    `).bind(id).all();
    if (!cityResult.results || cityResult.results.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: `No city with id ${id}` }
      }), { status: 404, headers: CACHE_HEADERS });
    }

    // Try to fetch climate (may not exist on dev D1)
    let climate = [];
    let seasons = [];
    try {
      const climateStmt = env.OTD_DB.prepare(`SELECT * FROM climate_summaries WHERE city_id = ? ORDER BY month ASC`);
      const climateResult = await climateStmt.bind(id).all();
      climate = (climateResult && climateResult.results) || [];
    } catch (e) { console.warn('climate_summaries not available:', e.message); }

    try {
      const seasonsStmt = env.OTD_DB.prepare(`SELECT * FROM seasons WHERE city_id = ? ORDER BY start_month ASC`);
      const seasonsResult = await seasonsStmt.bind(id).all();
      seasons = (seasonsResult && seasonsResult.results) || [];
    } catch (e) { console.warn('seasons not available:', e.message); }

    return new Response(JSON.stringify({
      success: true,
      data: {
        city: cityResult.results[0],
        climate,
        seasons,
        count: climate.length,
        note: climate.length === 0 ? 'Climate data not loaded in this environment' : null
      }
    }, null, 2), { headers: CACHE_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'QUERY_FAILED', message: err.message }
    }), { status: 500, headers: CACHE_HEADERS });
  }
}

// =============================================================================
// /api/v1/cities/popular
// =============================================================================

/**
 * Build the regional-indicator flag emoji for a 2-letter country code.
 * "US" → 🇺🇸, "GB" → 🇬🇧, "JP" → 🇯🇵
 * Uses Unicode regional indicator symbols (U+1F1E6 = 'A' .. U+1F1FF = 'Z').
 * No mapping table needed — derives from the letter char codes.
 */
function flagEmojiFor(cca2) {
  if (!cca2 || cca2.length !== 2) return '';
  const codeA = 0x1F1E6;
  const c0 = cca2.charCodeAt(0);
  const c1 = cca2.charCodeAt(1);
  if (c0 < 65 || c0 > 90 || c1 < 65 || c1 > 90) return '';
  return String.fromCodePoint(codeA + (c0 - 65), codeA + (c1 - 65));
}

/**
 * Build a basic slug from a city name.
 * "São Paulo" → "sao-paulo", "New York City" → "new-york-city".
 * The build script does more sophisticated slug disambiguation; this is the
 * fallback for the 33K cities we haven't pre-built yet.
 */
function slugify(name) {
  if (!name) return null;
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build the canonical city-page path from country code + slug.
 * /world-time/{cca2-lowercase}/{slug}/
 * If no slug is provided, we slugify the city name as a fallback.
 * The build script does more sophisticated slug disambiguation; this is
 * a best-effort path for the 33K cities we haven't pre-built yet.
 */
function cityPathFor(cca2, slug, name) {
  if (!cca2) return null;
  const finalSlug = slug || slugify(name);
  if (!finalSlug) return null;
  return `/world-time/${cca2.toLowerCase()}/${finalSlug}/`;
}

// In-process cache for the popular-cities response so we don't hammer the
// upstream API on every request. Cloudflare Workers are single-isolate per
// region so this stays warm across requests.
const popularCache = {
  cities: null,
  countries: null, // cca2 -> {continent, name, ...}
  fetchedAt: 0,
  TTL_MS: 60 * 60 * 1000 // 1 hour
};

async function fetchProdCities() {
  // Pull the top ~2,000 cities by population from the prod API.
  // (The prod /api/v1/cities endpoint ignores ?sort=, so we sort client-side.)
  // 2,000 is well under the prod max (it returned 33,945 unfiltered).
  const r = await fetch('https://api.dateandtime.live/api/v1/cities?limit=2000', {
    headers: { 'Accept': 'application/json' }
  });
  if (!r.ok) throw new Error('cities upstream ' + r.status);
  const j = await r.json();
  const data = j.data || {};
  return Array.isArray(data.cities) ? data.cities : [];
}

async function fetchProdCountries() {
  // Map: cca2 -> { name, continent, capital, ... }
  // The prod API's `continent` field is null for all countries, so we derive
  // it from `unRegion` (e.g. "Americas") and `unSubregion` (e.g. "South America").
  const r = await fetch('https://api.dateandtime.live/api/v1/countries?limit=300', {
    headers: { 'Accept': 'application/json' }
  });
  if (!r.ok) throw new Error('countries upstream ' + r.status);
  const j = await r.json();
  const list = (j.data && j.data.countries) || [];
  const map = {};
  for (const c of list) {
    if (!c || !c.cca2) continue;
    map[c.cca2.toUpperCase()] = {
      ...c,
      // Derive 2-letter continent code (AF, AS, EU, NA, OC, SA, AN) from unRegion + unSubregion.
      // Standard list — matches the 7-continent model.
      continent: deriveContinent(c.unRegion, c.unSubregion)
    };
  }
  return map;
}

function deriveContinent(unRegion, unSubregion) {
  if (!unRegion) return null;
  if (unRegion === 'Africa') return 'AF';
  if (unRegion === 'Asia') return 'AS';
  if (unRegion === 'Europe') return 'EU';
  if (unRegion === 'Oceania') return 'OC';
  if (unRegion === 'Antarctic') return 'AN';
  if (unRegion === 'Americas') {
    // Split the Americas: North America (NA) vs South America (SA).
    // unSubregion values: "Northern America", "South America", "Caribbean",
    // "Central America", "South America" — only the last one is SA.
    if (unSubregion === 'South America') return 'SA';
    return 'NA';
  }
  return null;
}

async function getPopularData() {
  const now = Date.now();
  if (popularCache.cities && popularCache.countries && (now - popularCache.fetchedAt) < popularCache.TTL_MS) {
    return { cities: popularCache.cities, countries: popularCache.countries };
  }
  const [cities, countries] = await Promise.all([fetchProdCities(), fetchProdCountries()]);
  popularCache.cities = cities;
  popularCache.countries = countries;
  popularCache.fetchedAt = now;
  return { cities, countries };
}

function scoreCity(c) {
  // Composite "popularity" score: population + capital bonus + alias count bonus
  // (aliases = how many alternate names the city has, proxy for search volume)
  const pop = Number(c.population) || 0;
  const capitalBonus = c.isCapital ? 1e9 : 0;
  const aliasBonus = ((c.aliases && c.aliases.length) || 0) * 1e6;
  return pop + capitalBonus + aliasBonus;
}

/**
 * GET /api/v1/cities/popular
 *
 * Returns the curated top-popular cities from the prod API, with:
 *   - `flagEmoji` computed from cca2
 *   - `path` = canonical /world-time/{country}/{slug}/
 *   - `continent` looked up from the country record
 *   - `slug` taken from the city record (already disambiguated upstream)
 *
 * Filterable by continent, isCapital, country.
 * Sortable by population (default, weighted), name, country.
 */
async function handleCitiesPopular(request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1), 500);
  const continent = (url.searchParams.get('continent') || '').toUpperCase();
  const country = (url.searchParams.get('country') || '').toUpperCase();
  const isCapital = url.searchParams.get('isCapital') === '1';
  const sort = (url.searchParams.get('sort') || 'population').toLowerCase();

  try {
    const { cities, countries } = await getPopularData();

    // Enrich + filter
    let enriched = cities.map(c => {
      const cca2 = (c.countryCode || '').toUpperCase();
      const countryInfo = countries[cca2] || null;
      return {
        id: c.id,
        name: c.name,
        asciiName: c.asciiName,
        slug: c.slug || null, // may be null if not in our 911 pre-built list
        countryCode: cca2,
        countryName: c.countryName || (countryInfo && countryInfo.name) || null,
        continent: countryInfo ? countryInfo.continent : null,
        stateCode: c.stateCode || null,
        latitude: c.latitude,
        longitude: c.longitude,
        timezone: c.timezone,
        population: c.population,
        isCapital: !!c.isCapital,
        featureCode: c.featureCode,
        aliases: c.aliases || [],
        flagEmoji: flagEmojiFor(cca2),
        path: cityPathFor(cca2, c.slug, c.asciiName || c.name)
      };
    });

    if (continent) enriched = enriched.filter(c => c.continent === continent);
    if (country) enriched = enriched.filter(c => c.countryCode === country);
    if (isCapital) enriched = enriched.filter(c => c.isCapital);

    // Sort
    if (sort === 'name') {
      enriched.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'country') {
      enriched.sort((a, b) =>
        (a.countryName || '').localeCompare(b.countryName || '') ||
        a.name.localeCompare(b.name)
      );
    } else {
      // 'population' (default) — weighted by capital + aliases
      enriched.sort((a, b) => scoreCity(b) - scoreCity(a));
    }

    const sliced = enriched.slice(0, limit);

    return new Response(JSON.stringify({
      success: true,
      data: {
        cities: sliced,
        count: sliced.length,
        total: enriched.length,
        total_unfiltered: cities.length,
        filters: { continent: continent || null, country: country || null, isCapital },
        sort
      },
      meta: {
        generated_at: new Date().toISOString(),
        source: 'prod-api-proxy',
        cache_ttl_seconds: 3600
      }
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, s-maxage=3600'
      }
    });
  } catch (err) {
    console.error('cities/popular error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'UPSTREAM_FAILED', message: err.message || String(err) }
    }, null, 2), {
      status: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function handle(env, path, request) {
  // /api/v1/cities/nearby
  const nearbyMatch = path.match(/^\/api\/v1\/cities\/nearby$/);
  if (nearbyMatch) {
    return handleCitiesNearby(env, request);
  }

  // /api/v1/cities/popular
  // Fetches the top popular cities (sorted, filtered, enriched with flagEmoji + path).
  // Powers the /world-time/ hub's 5-col alphabetical grid.
  //   Query params:
  //     limit       - max cities to return (default 200, max 500)
  //     continent   - filter by continent code: AF, AS, EU, NA, OC, SA, AN
  //     isCapital   - "1" to only include capital cities
  //     sort        - "population" (default, weighted) | "name" | "country"
  //     country     - filter by ISO 3166-1 alpha-2 (e.g. "US", "JP")
  const popularMatch = path.match(/^\/api\/v1\/cities\/popular$/);
  if (popularMatch) {
    return handleCitiesPopular(request);
  }

  // /api/v1/cities/:id/climate
  const climateMatch = path.match(/^\/api\/v1\/cities\/(\d+)\/climate$/);
  if (climateMatch) {
    return handleCityClimate(env, climateMatch[1]);
  }

  // /api/v1/cities/:id
  const cityMatch = path.match(/^\/api\/v1\/cities\/(\d+)$/);
  if (cityMatch) {
    return handleCityById(env, cityMatch[1]);
  }

  return null;
}
