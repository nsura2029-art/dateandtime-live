// Worker entry — serves the static assets AND injects Cloudflare's
// IP-geolocation data into HTML pages so the landing can auto-detect
// the user's city, state, and country without a third-party API call.
//
// Cloudflare's `request.cf` is populated from the incoming IP and is
// far more accurate (and faster) than client-side geolocation. We
// forward a small subset to the page as `window.__location`.
export default {
  async fetch(request, env) {
    // Get the asset (HTML or other) from the [assets] binding.
    const response = await env.ASSETS.fetch(request);

    // Only inject for HTML responses — no point string-replacing JSON / CSS / images.
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

    // Build the location object from Cloudflare's IP data.
    // Falls back to empty strings if cf data is missing.
    const cf = request.cf || {};
    const location = {
      city: cf.city || "",
      region: cf.region || "",            // e.g. "Florida"
      regionCode: cf.regionCode || "",    // e.g. "FL"
      country: cf.country || "",          // ISO-2, e.g. "US"
      countryName: "",                    // resolved client-side via Intl.DisplayNames
      latitude: typeof cf.latitude === "string" ? cf.latitude : "",
      longitude: typeof cf.longitude === "string" ? cf.longitude : "",
      timezone: cf.timezone || ""         // IANA, e.g. "America/New_York"
    };

    // Inject the location as a global BEFORE the first <script>.
    // The page reads it as window.__location.
    const html = await response.text();
    const injected = html.replace(
      /<script>/,
      `<script>window.__location=${JSON.stringify(location)};<\/script><script>`
    );

    return new Response(injected, {
      headers: response.headers
    });
  }
};
