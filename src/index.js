// Worker entry — serves the static assets AND injects Cloudflare's
// IP-geolocation data into HTML pages so the landing can auto-detect
// the user's city, state, and country without a third-party API call.
//
// Also exposes a same-origin proxy for /v1/cities so the page can
// load the 190-city list without tripping CORS (the prod API at
// api.dateandtime.live only sends Access-Control-Allow-Origin for
// https://dateandtime.live, not for *.workers.dev dev domains).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Same-origin proxy: /api/cities -> https://api.dateandtime.live/v1/cities
    if (url.pathname === "/api/cities") {
      return proxyCities(request, url);
    }

    // Get the asset (HTML or other) from the [assets] binding.
    const response = await env.ASSETS.fetch(request);

    // Only inject for HTML responses — no point string-replacing JSON / CSS / images.
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

    // Build the location object from Cloudflare's IP data.
    const cf = request.cf || {};
    const location = {
      city: cf.city || "",
      region: cf.region || "",
      regionCode: cf.regionCode || "",
      country: cf.country || "",
      countryName: "",
      latitude: typeof cf.latitude === "string" ? cf.latitude : "",
      longitude: typeof cf.longitude === "string" ? cf.longitude : "",
      timezone: cf.timezone || ""
    };

    // Inject the location as a global BEFORE the first <script>.
    const html = await response.text();
    const injected = html.replace(
      /<script>/,
      `<script>window.__location=${JSON.stringify(location)};<\/script><script>`
    );

    return new Response(injected, { headers: response.headers });
  }
};

async function proxyCities(request, url) {
  // Forward the query string (limit, q, etc.) to the prod API.
  const upstream = `https://api.dateandtime.live/v1/cities?${url.searchParams.toString()}`;
  try {
    const r = await fetch(upstream, { headers: { "Accept": "application/json" } });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") || "application/json",
        // Allow any origin (since the page is the only consumer)
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
