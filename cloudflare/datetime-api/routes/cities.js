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

export async function handle(env, path, request) {
  // /api/v1/cities/nearby
  const nearbyMatch = path.match(/^\/api\/v1\/cities\/nearby$/);
  if (nearbyMatch) {
    return handleCitiesNearby(env, request);
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
