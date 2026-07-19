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

    // Redirect /home → / (the home page IS the default landing now)
    if (url.pathname === "/home" || url.pathname === "/home/") {
      return Response.redirect(new URL("/" + url.search), 301);
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
