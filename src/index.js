// Worker entry — serves the static assets AND injects Cloudflare's
// IP-geolocation data into HTML pages so the landing can auto-detect
// the user's city, state, and country without a third-party API call.
//
// Also exposes same-origin proxies for /v1/cities and /v1/famous so
// the page can load city data without tripping CORS (the prod API at
// api.dateandtime.live only sends Access-Control-Allow-Origin for
// https://dateandtime.live, not for *.workers.dev dev domains).
//
// On every HTML request we also call /v1/cities server-side to find
// the city in our database that is closest to the user's lat/lon —
// that gives us a higher-confidence "near X" city for the live-location
// pill (e.g. "Wesley Chapel (near Tampa)" even when the user's
// hometown is too small to be a famous city in the DB).

// In-memory cache of the cities list so we don't re-fetch it on every
// page load. The DB changes rarely, so a 5-min TTL is fine.
let citiesCache = { at: 0, data: null };
const CITIES_TTL_MS = 5 * 60 * 1000;

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Same-origin proxy: /api/cities -> https://api.dateandtime.live/api/v1/cities
    if (url.pathname === "/api/cities") {
      return proxySimple(request, url, "/api/v1/cities");
    }

    // Local time source: /api/time/now returns the worker's current time so
    // the page can compute a real clock-drift + round-trip-accuracy without
    // depending on the (still-empty) /v1/time/now endpoint on the prod API.
    // Both the page and the worker run on the same machine in Cloudflare's
    // edge, so the drift is essentially the network round-trip.
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

    // Inject the location as a global BEFORE the first <script>.
    const html = await response.text();
    const injected = html.replace(
      /<script>/,
      `<script>window.__location=${JSON.stringify(location)};<\/script><script>`
    );

    return new Response(injected, { headers: response.headers });
  }
};

async function proxySimple(request, url, upstreamPath) {
  const upstream = `https://api.dateandtime.live${upstreamPath}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;
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
