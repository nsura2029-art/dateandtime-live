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

// "Coming Soon" page for city URLs that don't have a pre-built static page.
// We pre-build 911 cities; the DB has 33,945. When a user visits an unmapped
// city, serve this page with: live time in the user's tz (we don't know
// the city's tz yet), 3 feedback CTAs, and 6 contextual backlinks.
function generateComingSoonPage(countrySlug, citySlug) {
  const cityName = humanizeSlug(citySlug);
  const countryName = humanizeSlug(countrySlug);
  const countryUrl = `/world-time/${countrySlug}/`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${cityName}, ${countryName} — Current Time | dateandtime.live</title>
  <meta name="description" content="Live time, time zone, and weather for ${cityName}, ${countryName}. Coming soon to dateandtime.live.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://dateandtime.live/world-time/${countrySlug}/${citySlug}/">
  <link rel="stylesheet" href="/src/site-shell.css">
  <link rel="stylesheet" href="/src/tz-hub.css">
  <style>
    .coming-soon { max-width: 720px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
    .coming-soon h1 { font-size: clamp(2rem, 5vw, 3rem); margin-bottom: 0.5rem; }
    .coming-soon .badge { display: inline-block; background: linear-gradient(135deg, #7866d4 0%, #ff7a59 100%); color: white; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.5rem; }
    .coming-soon .lede { font-size: 1.125rem; color: var(--color-foreground-soft); margin-bottom: 2rem; line-height: 1.6; }
    .coming-soon .live-time { font-family: var(--font-mono); font-size: 2.5rem; font-weight: 700; color: var(--color-primary); padding: 1.5rem; background: var(--color-card-bg); border: 1px solid var(--color-border); border-radius: 12px; text-align: center; margin-bottom: 2rem; }
    .coming-soon .feedback-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .coming-soon .feedback-card { padding: 1.25rem; background: var(--color-card-bg); border: 1px solid var(--color-border); border-radius: 10px; text-decoration: none; color: var(--color-foreground); transition: border-color 200ms, transform 200ms; }
    .coming-soon .feedback-card:hover { border-color: var(--color-primary); transform: translateY(-2px); text-decoration: none; }
    .coming-soon .feedback-card .icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .coming-soon .feedback-card h3 { font-size: 0.9375rem; font-weight: 700; margin: 0 0 0.25rem; }
    .coming-soon .feedback-card p { font-size: 0.8125rem; color: var(--color-foreground-soft); margin: 0; line-height: 1.4; }
    .coming-soon .links-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin: 1.5rem 0; }
    .coming-soon .link-card { padding: 0.75rem 1rem; border: 1px solid var(--color-border-soft); border-radius: 8px; text-decoration: none; color: var(--color-foreground-soft); font-size: 0.875rem; }
    .coming-soon .link-card:hover { border-color: var(--color-primary); color: var(--color-primary); text-decoration: none; }
    .coming-soon .link-card .label { display: block; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); margin-bottom: 0.125rem; }
    .coming-soon .country-link { display: inline-block; margin-top: 2rem; padding: 0.75rem 1.5rem; background: var(--color-primary); color: white; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .coming-soon .country-link:hover { background: var(--color-primary-dark); text-decoration: none; }
    [data-theme="dark"] .coming-soon .live-time { color: #b3a8ff; }
  </style>
</head>
<body class="shell-page">
  <header class="site-header">
    <div class="site-header-inner">
      <a href="/" class="site-logo">
        <span class="logo-mark" aria-hidden="true">T</span>
        <span class="logo-text"><span class="logo-text-domain">dateandtime</span><span class="logo-text-tld">.live</span></span>
      </a>
      <nav class="nav-main" aria-label="Main">
        <a href="/" class="nav-link">Today</a>
        <a href="/holidays/" class="nav-link">Holidays</a>
        <a href="/onthisday/" class="nav-link">On this day</a>
        <a href="/meeting/" class="nav-link">Meeting finder</a>
        <a href="/world-time/" class="nav-link nav-active">World time</a>
        <a href="/time-zones/" class="nav-link">Timezone</a>
        <a href="/news/" class="nav-link">News</a>
      </nav>
    </div>
  </header>

  <main class="coming-soon">
    <div class="badge">Coming Soon</div>
    <h1>${cityName}, ${countryName}</h1>
    <p class="lede">We're building the full time zone page for <strong>${cityName}</strong>. The static page isn't ready yet, but here's what we have so far — plus a few ways you can help.</p>

    <div class="live-time" id="live-time">--:--:--</div>
    <script>
      // Show the user's current time as a placeholder. The live city-specific
      // clock will be added once the city is in our DB.
      (function() {
        const el = document.getElementById('live-time');
        if (!el) return;
        const tick = () => {
          const now = new Date();
          const fmt = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
          });
          el.textContent = fmt.format(now);
        };
        tick();
        setInterval(tick, 1000);
      })();
    </script>

    <h2 style="margin-top:2rem;font-size:1.125rem;">Help us build this page</h2>
    <div class="feedback-grid">
      <a href="/feedback/?type=city&city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(countryName)}" class="feedback-card">
        <div class="icon">📍</div>
        <h3>Suggest the city</h3>
        <p>Tell us the exact coordinates and time zone of ${cityName}.</p>
      </a>
      <a href="/feedback/?type=info&city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(countryName)}" class="feedback-card">
        <div class="icon">ℹ️</div>
        <h3>Tell us more</h3>
        <p>Share history, alternate names, or local facts.</p>
      </a>
      <a href="/feedback/?type=notify&city=${encodeURIComponent(cityName)}&country=${encodeURIComponent(countryName)}" class="feedback-card">
        <div class="icon">🔔</div>
        <h3>Notify me</h3>
        <p>Get an email when this page goes live.</p>
      </a>
    </div>

    <h2 style="margin-top:2rem;font-size:1.125rem;">While you wait, learn about time zones</h2>
    <div class="links-grid">
      <a href="/time-zones/what-is/" class="link-card"><span class="label">Learn</span>What is a time zone?</a>
      <a href="/time-zones/dst/" class="link-card"><span class="label">Learn</span>Daylight Saving Time</a>
      <a href="/time-zones/converter/" class="link-card"><span class="label">Tool</span>Time Zone Converter</a>
      <a href="/time-zones/utc/" class="link-card"><span class="label">Learn</span>UTC & GMT</a>
      <a href="/meeting/" class="link-card"><span class="label">Tool</span>Meeting Planner</a>
      <a href="/globe/" class="link-card"><span class="label">Tool</span>World Clock Globe</a>
    </div>

    <h2 style="margin-top:2rem;font-size:1.125rem;">Today, on this day, and holidays</h2>
    <div class="links-grid">
      <a href="/" class="link-card"><span class="label">Today</span>What day is it?</a>
      <a href="/onthisday/" class="link-card"><span class="label">On this day</span>Historical events today</a>
      <a href="/holidays/${countrySlug}/" class="link-card"><span class="label">Holidays</span>${countryName} public holidays</a>
      <a href="/news/timezone/" class="link-card"><span class="label">News</span>Latest time zone news</a>
      <a href="/news/astronomy/" class="link-card"><span class="label">News</span>Astronomy & celestial events</a>
      <a href="/news/calendar/" class="link-card"><span class="label">News</span>Calendar changes</a>
    </div>

    <a href="${countryUrl}" class="country-link">Browse all ${countryName} cities →</a>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="site-footer-inner">
      <p>© 2026 <a href="/">dateandtime.live</a> · 33,945 cities · 408 time zones · 1,600+ holidays · Data: <a href="https://www.iana.org/time-zones">IANA</a> · <a href="https://www.geonames.org/">GeoNames</a> · <a href="https://date.nager.at/">Nager.Date</a></p>
      <nav class="site-footer-nav" aria-label="Site links">
        <a href="/">Home</a>
        <a href="/holidays/">Holidays</a>
        <a href="/onthisday/">On this day</a>
        <a href="/world-time/">World time</a>
        <a href="/time-zones/">Time zones</a>
        <a href="/news/">News</a>
        <a href="/meeting/">Meeting</a>
      </nav>
    </div>
  </footer>
  <script src="/src/site-shell.js" defer></script>
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
          return new Response(generateComingSoonPage(countrySlug, citySlug), {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" }
          });
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
