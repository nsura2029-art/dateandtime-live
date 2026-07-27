/* dateandtime.live -- World Time hub: city grid (server-side)
 *
 * Powers the /world-time/ page. Renders a paginated card grid of
 * 33,945+ cities, with continent / sub-region / search / sort filters.
 *
 * Every state change triggers a fresh API call to
 * /api/v1/cities/popular — there's no client-side cache or pre-fetch
 * of the full city list. The API has its own 1h edge cache so this is
 * cheap. Client responsibilities are: debouncing search, aborting
 * in-flight requests, rendering the response, syncing URL state.
 *
 * URL state (all optional, ?-prefixed, omit if at default):
 *   continent  = all | africa | asia | europe | namerica | samerica | oceania
 *   region     = <sub-region slug, only meaningful when continent != all>
 *   sort       = popular | name | country
 *   q          = <search string, URL-encoded>
 *   p          = <page number, 1-based; default 1>
 *
 * Render: 5-col card grid (responsive 2/3/4/5). Page 1 shows 8 cards,
 * each Load more appends 15 more (3 rows on 5-col desktop).
 *
 * Live:   per-card clock updates every requestAnimationFrame
 *         using Intl.DateTimeFormat (no API calls).
 */
(function () {
  "use strict";

  const API_BASE = "https://datetime-api-dev.nsura2029.workers.dev";
  // Initial page size and Load-more step.
  // - Hub page: 100 + 100 (default; overrides via window.__PAGE_INITIAL / __PAGE_STEP)
  // - Country pages: 100 + 100 (build script sets these explicitly)
  // - State pages: 100 + 100 (build script sets these explicitly)
  const INITIAL_VISIBLE = (typeof window !== 'undefined' && window.__PAGE_INITIAL) || 100; // page 1
  const PAGE_STEP = (typeof window !== 'undefined' && window.__PAGE_STEP) || 100;        // each subsequent page
  const SEARCH_DEBOUNCE_MS = 250;

  // =============== Inline SVG icons (24×24, single path, currentColor) ===============
  // Kept inline so the filter bar can render with no extra HTTP request and
  // the icon inherits the pill's text color via `currentColor`. Defined BEFORE
  // the CONTINENTS array because CONTINENTS references them as values.
  const ICON_GRID = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
  const ICON_AFRICA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L8 7 L9 13 L7 17 L10 22 L14 22 L17 17 L15 13 L16 7 Z"/><path d="M12 8 L12 16"/></svg>';
  const ICON_ASIA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4 L20 4 L20 10 L13 10 L13 14 L20 14 L20 20 L4 20 L4 14 L11 14 L11 10 L4 10 Z"/></svg>';
  const ICON_EUROPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12 L21 12 M12 3 L16 8 L16 16 L12 21 M12 3 L8 8 L8 16 L12 21"/></svg>';
  const ICON_NAMERICA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18 L3 6 L9 4 L13 6 L17 5 L21 8 L20 14 L17 18 L13 19 L9 18 L6 20 Z"/><path d="M9 4 L9 18"/></svg>';
  const ICON_SAMERICA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3 L18 5 L20 9 L21 14 L18 19 L14 21 L10 19 L8 14 L9 9 L11 5 Z"/><path d="M14 9 L18 13"/></svg>';
  const ICON_OCEANIA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 C5 8, 7 12, 9 10 S13 8, 15 10 S19 12, 21 10"/><path d="M3 16 C5 14, 7 18, 9 16 S13 14, 15 16 S19 18, 21 16"/><circle cx="12" cy="5" r="1.2" fill="currentColor"/></svg>';
  // Africa sub-regions
  const ICON_DESERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18 L7 14 L10 16 L13 11 L17 15 L21 12"/><circle cx="19" cy="6" r="2.5"/></svg>';
  const ICON_TREE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L6 12 L9 12 L5 18 L19 18 L15 12 L18 12 Z"/><path d="M12 18 L12 22"/></svg>';
  const ICON_RIVER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 C7 9, 9 5, 12 7 S17 9, 21 7"/><path d="M3 13 C7 15, 9 11, 12 13 S17 15, 21 13"/><path d="M3 19 C7 21, 9 17, 12 19 S17 21, 21 19"/></svg>';
  const ICON_MOUNTAIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19 L8 11 L12 15 L16 8 L21 19 Z"/><circle cx="17" cy="6" r="1.5" fill="currentColor"/></svg>';
  const ICON_DIAMOND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4 L18 4 L22 10 L12 22 L2 10 Z"/><path d="M2 10 L22 10 M6 4 L12 10 L18 4"/></svg>';
  // Asia sub-regions
  const ICON_TEMPLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 L21 10 L20 21 L4 21 Z"/><path d="M3 10 L12 3 L21 10"/><path d="M8 14 L8 18 M12 14 L12 18 M16 14 L16 18"/></svg>';
  const ICON_PALM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22 L12 12"/><path d="M12 12 C9 11, 5 11, 3 12 C5 9, 9 9, 12 12 Z"/><path d="M12 12 C15 11, 19 11, 21 12 C19 9, 15 9, 12 12 Z"/><path d="M12 12 C10 9, 10 5, 12 3 C14 5, 14 9, 12 12 Z"/></svg>';
  const ICON_LOTUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21 C7 18, 4 13, 6 8 C8 11, 10 12, 12 12 C14 12, 16 11, 18 8 C20 13, 17 18, 12 21 Z"/><path d="M12 12 L12 3 M9 8 L12 10 L15 8"/></svg>';
  const ICON_STEPPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20 L22 20"/><path d="M3 17 C5 15, 7 17, 9 16 S13 14, 15 16 S19 18, 21 16"/><path d="M5 12 L8 9 L11 11 L14 8 L17 10 L20 7"/><circle cx="19" cy="4" r="1.5"/></svg>';
  const ICON_DOME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21 L4 13 C4 7, 20 7, 20 13 L20 21 Z"/><path d="M2 21 L22 21"/><circle cx="12" cy="6" r="1" fill="currentColor"/></svg>';
  // Europe sub-regions
  const ICON_CASTLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 L3 21 L21 21 L21 10 M3 10 L6 10 L6 7 L9 7 L9 10 L12 10 L12 7 L15 7 L15 10 L18 10 L18 7 L21 7 L21 10"/><path d="M10 21 L10 14 L14 14 L14 21"/></svg>';
  const ICON_VIKING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13 C5 8, 8 5, 12 5 C16 5, 19 8, 19 13 L19 17 L5 17 Z"/><path d="M8 13 L8 11 M12 13 L12 11 M16 13 L16 11"/><path d="M3 19 L21 19"/><path d="M5 17 L5 19 M19 17 L19 19"/></svg>';
  const ICON_OLIVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22 L12 14"/><path d="M12 14 C9 12, 7 9, 8 6 C10 7, 11 10, 12 14 Z"/><path d="M12 14 C15 12, 17 9, 16 6 C14 7, 13 10, 12 14 Z"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="18" cy="6" r="1" fill="currentColor"/></svg>';
  const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7 L12 12 L16 14"/></svg>';
  const ICON_BRIDGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18 C7 12, 17 12, 22 18"/><path d="M2 18 L22 18"/><path d="M6 18 L6 14 M10 18 L10 13 M14 18 L14 13 M18 18 L18 14"/></svg>';
  const ICON_ONION = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 C8 7, 6 12, 8 18 C10 21, 14 21, 16 18 C18 12, 16 7, 12 3 Z"/><path d="M12 8 L12 21"/></svg>';
  // Oceania sub-regions
  const ICON_KANGAROO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22 L8 16 C8 13, 11 11, 14 11 L17 7 C18 5, 16 3, 14 5 L11 9 C8 9, 6 11, 5 14 L4 18 L7 22 Z"/><path d="M11 14 L13 14"/></svg>';
  const ICON_WAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12 C4 8, 8 8, 10 12 S16 16, 18 12 S22 8, 22 8"/><path d="M2 18 C4 14, 8 14, 10 18 S16 22, 18 18 S22 14, 22 14"/></svg>';
  const ICON_CORAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21 C3 16, 6 14, 7 11 C8 14, 10 14, 11 11 C12 14, 14 14, 15 11 C16 14, 18 14, 19 11 C20 14, 21 16, 21 21 Z"/><circle cx="12" cy="6" r="2"/></svg>';
  const ICON_TIKI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4 L16 4 L17 8 L19 14 L17 20 L7 20 L5 14 L7 8 Z"/><circle cx="10" cy="11" r="1" fill="currentColor"/><circle cx="14" cy="11" r="1" fill="currentColor"/><path d="M9 16 L15 16"/></svg>';
  // Americas sub-regions
  const ICON_STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L14 9 L20 9 L15 13 L17 19 L12 15 L7 19 L9 13 L4 9 L10 9 Z"/></svg>';
  const ICON_PYRAMID = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L22 21 L2 21 Z"/><path d="M8 21 L12 13 L16 21"/></svg>';

  // Region metadata. region code → URL/API value, label, icon,
  // and sub-region list (slugs that the API understands for that region).
  // Sub-region slugs match the API's `?region=` param. Sorted alphabetically
  // by label so the user can scan top-to-bottom.
  //
  // Each region + sub-region gets a unique inline SVG icon (24×24, single
  // path, currentColor) instead of a generic globe emoji — helps the user
  // recognize regions at a glance and adds visual variety to the filter bar.
  const CONTINENTS = [
    { code: "africa",   api: "AF",  label: "Africa",     icon: ICON_AFRICA, regions: [
      { slug: "northern-africa",   label: "Northern Africa",  icon: ICON_DESERT },
      { slug: "western-africa",    label: "Western Africa",   icon: ICON_TREE },
      { slug: "middle-africa",     label: "Middle Africa",    icon: ICON_RIVER },
      { slug: "eastern-africa",    label: "Eastern Africa",   icon: ICON_MOUNTAIN },
      { slug: "southern-africa",   label: "Southern Africa",  icon: ICON_DIAMOND }
    ] },
    { code: "all",      api: null, label: "All",        icon: ICON_GRID, regions: [] },
    { code: "asia",     api: "AS",  label: "Asia",       icon: ICON_ASIA, regions: [
      { slug: "eastern-asia",       label: "Eastern Asia",       icon: ICON_TEMPLE },
      { slug: "south-eastern-asia", label: "South-Eastern Asia", icon: ICON_PALM },
      { slug: "southern-asia",      label: "Southern Asia",      icon: ICON_LOTUS },
      { slug: "central-asia",       label: "Central Asia",       icon: ICON_STEPPE },
      { slug: "western-asia",       label: "Western Asia",       icon: ICON_DOME }
    ] },
    { code: "europe",   api: "EU",  label: "Europe",     icon: ICON_EUROPE, regions: [
      { slug: "western-europe",    label: "Western Europe",    icon: ICON_CASTLE },
      { slug: "northern-europe",   label: "Northern Europe",   icon: ICON_VIKING },
      { slug: "southern-europe",   label: "Southern Europe",   icon: ICON_OLIVE },
      { slug: "central-europe",    label: "Central Europe",    icon: ICON_CLOCK },
      { slug: "southeast-europe",  label: "Southeast Europe",  icon: ICON_BRIDGE },
      { slug: "eastern-europe",    label: "Eastern Europe",    icon: ICON_ONION }
    ] },
    { code: "namerica", api: "NA",  label: "N. America", icon: ICON_NAMERICA, regions: [
      { slug: "north-america",     label: "Northern America",  icon: ICON_STAR },
      { slug: "central-america",   label: "Central America",   icon: ICON_PYRAMID },
      { slug: "caribbean",         label: "Caribbean",         icon: ICON_PALM }
    ] },
    { code: "oceania",  api: "OC",  label: "Oceania",    icon: ICON_OCEANIA, regions: [
      { slug: "australia-and-new-zealand", label: "Australia & NZ", icon: ICON_KANGAROO },
      { slug: "melanesia",         label: "Melanesia",         icon: ICON_WAVE },
      { slug: "micronesia",        label: "Micronesia",        icon: ICON_CORAL },
      { slug: "polynesia",         label: "Polynesia",         icon: ICON_TIKI }
    ] },
    { code: "samerica", api: "SA",  label: "S. America", icon: ICON_SAMERICA, regions: [
      { slug: "south-america",     label: "South America",     icon: ICON_TREE }
    ] }
  ];

  // Sort options for the city grid.
  //   "all"      — single alphabetical list (no grouping). Default on hub page.
  //   "popular"  — popularity-weighted (default on country/state pages).
  //   "name"     — alphabetical by city name.
  //   "state"    — group by state, then alphabetical within each (US-only).
  const SORTS = [
    { code: "popular", label: "Popular" },
    { code: "all",     label: "All cities" },
    { code: "name",    label: "City A–Z" },
    { code: "state",   label: "By state" }
  ];

  // =============== State ===============

  // Cache for countries by sub-region slug, populated lazily as the user
  // drills down. Key: "region:{slug}" → array of {cca2, name, flagEmoji}.
  // Cache for states by country, populated lazily.
  // Key: "country:{cca2}" → array of {code, name}.
  const countryCache = Object.create(null);
  const stateCache = Object.create(null);

  const state = {
    continent: "all",
    region: null,
    sort: "popular",
    q: "",
    page: 1,
    country: null,        // ISO 3166-1 alpha-2 (set on country/state pages)
    stateCode: null,      // admin1 code (set on state pages)
    cities: [],          // accumulated across Load more clicks
    total: 0,            // API's reported total (for current filter set)
    loading: false,
    aborter: null
  };

  // =============== Date / time helpers (client-only, for live clocks) ===============

  function fmtTimeWithMs(tz, date) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
      }).formatToParts(date);
      const h = parts.find(p => p.type === "hour")?.value || "00";
      const m = parts.find(p => p.type === "minute")?.value || "00";
      const s = parts.find(p => p.type === "second")?.value || "00";
      const ms = String(date.getMilliseconds()).padStart(3, "0").slice(0, 2);
      return `${h}:${m}:${s}.${ms}`;
    } catch (e) { return "--:--:--.--"; }
  }

  function getDateInTz(tz, date) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false
      }).formatToParts(date);
      const get = type => parts.find(p => p.type === type)?.value;
      return {
        year: parseInt(get("year") || "0", 10),
        month: parseInt(get("month") || "0", 10),
        day: parseInt(get("day") || "0", 10),
        hour: parseInt(get("hour") || "0", 10),
        minute: parseInt(get("minute") || "0", 10),
        weekday: get("weekday") || ""
      };
    } catch (e) { return null; }
  }

  function getUserTzDate() {
    return getDateInTz(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date());
  }

  function dayLabel(targetDate) {
    if (!targetDate) return "";
    const user = getUserTzDate();
    if (!user) return "";
    const userKey = `${user.year}-${String(user.month).padStart(2, "0")}-${String(user.day).padStart(2, "0")}`;
    const targetKey = `${targetDate.year}-${String(targetDate.month).padStart(2, "0")}-${String(targetDate.day).padStart(2, "0")}`;
    if (targetKey === userKey) return "today";
    const userD = Date.UTC(user.year, user.month - 1, user.day);
    const targetD = Date.UTC(targetDate.year, targetDate.month - 1, targetDate.day);
    const diff = Math.round((targetD - userD) / 86400000);
    if (diff === 1) return "tomorrow";
    if (diff === -1) return "yesterday";
    if (diff > 1) return `+${diff} d`;
    if (diff < -1) return `${diff} d`;
    return "";
  }

  function offsetPill(tz, date) {
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const userOff = getTzOffsetMinutes(userTz, date);
      const targetOff = getTzOffsetMinutes(tz, date);
      const diffH = Math.round((targetOff - userOff) / 60);
      if (diffH === 0) return { text: "same", isPositive: false, isNegative: false, isNeutral: true };
      const sign = diffH > 0 ? "+" : "";
      return { text: `${sign}${diffH} H`, isPositive: diffH > 0, isNegative: diffH < 0, isNeutral: false };
    } catch (e) {
      return { text: "—", isPositive: false, isNegative: false, isNeutral: true };
    }
  }

  function getTzOffsetMinutes(tz, date) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, timeZoneName: "shortOffset"
      }).formatToParts(date);
      const off = parts.find(p => p.type === "timeZoneName")?.value || "GMT";
      const m = off.match(/GMT([+\-])(\d{1,2})(?::(\d{2}))?/);
      if (!m) return 0;
      const sign = m[1] === "-" ? -1 : 1;
      const h = parseInt(m[2] || "0", 10);
      const mm = parseInt(m[3] || "0", 10);
      return sign * (h * 60 + mm);
    } catch (e) { return 0; }
  }

  // =============== Data fetching (server-side, every state change) ===============

  function buildApiUrl() {
    const cont = CONTINENTS.find(c => c.code === state.continent);
    const params = new URLSearchParams();
    if (cont && cont.api) params.set("continent", cont.api);
    if (state.region) params.set("region", state.region);
    if (state.country) params.set("country", state.country);
    // Country + state pages use /api/v1/cities (returns up to 1,000 cities
    // per country, sorted by population). /popular only has 35 US cities in
    // its curated top-1000 set, which is too few for country pages.
    if (state.country) {
      // For state pages: /cities doesn't support the state param, so we use
      // /all to get all country cities, then filter by state client-side
      // (this matches the state page's own fetchAllCountryCities flow).
      if (state.stateCode) {
        return `${API_BASE}/api/v1/cities/all?country=${encodeURIComponent(state.country)}`;
      }
      // Per-country minPopulation (set by the build script via window.__MIN_POPULATION).
      // US uses 40,000 to cover all 51 states; small countries use 0.
      const minPop = (typeof window !== 'undefined' && window.__MIN_POPULATION) || 0;
      if (minPop > 0) params.set("minPopulation", String(minPop));
      // Country page: paginate via offset.
      const offset = state.page === 1 ? 0 : (INITIAL_VISIBLE + (state.page - 2) * PAGE_STEP);
      const limit = state.page === 1 ? INITIAL_VISIBLE : PAGE_STEP;
      params.set("offset", String(offset));
      params.set("limit", String(limit));
      return `${API_BASE}/api/v1/cities?${params}`;
    }
    if (state.sort && state.sort !== "popular") params.set("sort", state.sort);
    if (state.q) params.set("q", state.q);
    // Pagination: page 1 → INITIAL_VISIBLE; page N>1 → PAGE_STEP starting after the accumulated count
    const offset = state.page === 1 ? 0 : (INITIAL_VISIBLE + (state.page - 2) * PAGE_STEP);
    const limit = state.page === 1 ? INITIAL_VISIBLE : PAGE_STEP;
    params.set("offset", String(offset));
    params.set("limit", String(limit));
    return `${API_BASE}/api/v1/cities/popular?${params}`;
  }

  // Like buildApiUrl but lets the caller pin the page (used during init
  // when we need to fetch pages 1..N sequentially to repopulate from a URL
  // like ?p=3).
  function buildApiUrlForPage(p) {
    const cont = CONTINENTS.find(c => c.code === state.continent);
    const params = new URLSearchParams();
    if (cont && cont.api) params.set("continent", cont.api);
    if (state.region) params.set("region", state.region);
    if (state.country) params.set("country", state.country);
    if (state.country) {
      if (state.stateCode) {
        params.set("limit", "1000");
      } else {
        const minPop = (typeof window !== 'undefined' && window.__MIN_POPULATION) || 0;
        if (minPop > 0) params.set("minPopulation", String(minPop));
        const offset = p === 1 ? 0 : (INITIAL_VISIBLE + (p - 2) * PAGE_STEP);
        const limit = p === 1 ? INITIAL_VISIBLE : PAGE_STEP;
        params.set("offset", String(offset));
        params.set("limit", String(limit));
      }
      return `${API_BASE}/api/v1/cities?${params}`;
    }
    if (state.sort && state.sort !== "popular") params.set("sort", state.sort);
    if (state.q) params.set("q", state.q);
    const offset = p === 1 ? 0 : (INITIAL_VISIBLE + (p - 2) * PAGE_STEP);
    const limit = p === 1 ? INITIAL_VISIBLE : PAGE_STEP;
    params.set("offset", String(offset));
    params.set("limit", String(limit));
    return `${API_BASE}/api/v1/cities/popular?${params}`;
  }

  // Fetch all US cities in a single call via the dev-only /api/v1/cities/all
  // endpoint (which itself paginates the prod /cities endpoint to bypass
  // its 1,000-result cap). Used on state pages so we can find every city
  // in the state, not just the top 1,000 globally.
  // Returns a flat array of cities.
  async function fetchAllCountryCities(signal) {
    const cca2 = state.country;
    if (!cca2) return [];
    const url = `${API_BASE}/api/v1/cities/all?country=${encodeURIComponent(cca2)}`;
    const r = await fetch(url, { signal, headers: { "Accept": "application/json" } });
    if (!r.ok) {
      console.error("fetchAllCountryCities: failed", r.status);
      return [];
    }
    const j = await r.json();
    if (!j.success) return [];
    return (j.data && j.data.cities) || [];
  }

  async function fetchPage({ append = false } = {}) {
    if (state.aborter) {
      try { state.aborter.abort(); } catch (e) {}
    }
    state.aborter = new AbortController();
    state.loading = true;
    setLoadingUI(true);

    try {
      let list = [];
      let data = {};
      if (state.stateCode && state.country) {
        // State pages: fetch all US cities across multiple pages, then filter
        // by state + minPop client-side. The /cities endpoint's 1,000-result
        // cap would otherwise hide medium-population cities in the state
        // (e.g. AR has 10 cities with pop >= 40K but only 8 are in the
        // top-1,000 globally).
        const all = await fetchAllCountryCities(state.aborter.signal);
        const sc = state.stateCode;
        list = all.filter(c => (c.stateCode || c.state_code) === sc);
        const minPop = (typeof window !== 'undefined' && window.__MIN_POPULATION) || 0;
        if (minPop > 0) {
          list = list.filter(c => (c.population || 0) >= minPop);
        }
      } else {
        const r = await fetch(buildApiUrl(), {
          signal: state.aborter.signal,
          headers: { "Accept": "application/json" }
        });
        if (!r.ok) throw new Error("popular upstream " + r.status);
        const j = await r.json();
        data = j.data || {};
        list = data.cities || [];
      }
      state.total = state.stateCode ? list.length : (data?.total != null ? data.total : list.length);
      // Some /api/v1/cities responses include a "total" that doesn't reflect
      // the server-side minPopulation filter. When the filter is on AND the
      // build script pre-baked a __CITY_TOTAL, trust that one instead.
      // Only applies to country pages — state pages must use the actual
      // filtered count (DC has 2 cities, not 1,246).
      if (state.country && !state.stateCode && (window.__MIN_POPULATION || 0) > 0 && window.__CITY_TOTAL) {
        state.total = window.__CITY_TOTAL;
      }

      if (append) {
        // Append, dedup by id
        const seen = new Set(state.cities.map(c => c.id));
        for (const c of list) if (!seen.has(c.id)) state.cities.push(c);
      } else {
        state.cities = list;
      }

      // "By state" sort: group by state name (alphabetical), then by city
      // name within each state. State code → name lookup uses window.__STATES
      // (set by the build script). Falls back to the raw state code.
      if (state.sort === "state") {
        const stateNameBy = new Map();
        for (const s of (window.__STATES || [])) {
          if (s && s.code) stateNameBy.set(s.code, s.name);
        }
        const stateNameOf = (c) => stateNameBy.get(c.stateCode || c.state_code) || (c.stateCode || c.state_code) || "ZZZ";
        state.cities.sort((a, b) => {
          const sa = stateNameOf(a);
          const sb = stateNameOf(b);
          return sa.localeCompare(sb) || a.name.localeCompare(b.name);
        });
      } else if (state.sort === "name") {
        state.cities.sort((a, b) => a.name.localeCompare(b.name));
      } else if (state.sort === "all") {
        // All cities: single alphabetical list (no grouping).
        state.cities.sort((a, b) => a.name.localeCompare(b.name));
      }
      // "popular" sort: leave server's order intact (popularity-weighted).

      renderGrid();
      updateLoadMoreUI();
      updateResultCountUI();
      // Fire event so schema emit can pick up the visible list
      window.__popularCities = state.cities;
      window.dispatchEvent(new CustomEvent("tdl-popular-cities-loaded", { detail: { count: state.cities.length, total: state.total } }));
    } catch (err) {
      if (err.name === "AbortError") return; // user moved on
      console.error("world-time-cities: failed to fetch", err);
    } finally {
      state.loading = false;
      setLoadingUI(false);
    }
  }

  function setLoadingUI(on) {
    const grid = el("wt-card-grid");
    const loadingEl = el("wt-loading");
    if (grid) grid.setAttribute("aria-busy", on ? "true" : "false");
    if (loadingEl) loadingEl.hidden = !on;
  }

  // =============== State change handlers ===============

  function setContinent(code) {
    if (state.continent === code) return;
    state.continent = code;
    state.region = null;     // reset region when continent changes
    state.country = null;    // reset country when continent changes
    state.stateCode = null;  // reset state when continent changes
    state.page = 1;
    state.cities = [];
    state.total = 0;          // reset total too so the Load more text is correct
    renderContinentPills(); renderRegionPills(); renderCountryPills(); renderStateSelect();
    updateLoadMoreUI();
    updateResultCountUI();
    pushUrl();
    fetchPage({ append: false });
  }

  function setRegion(slug) {
    if (state.region === slug) return;
    state.region = slug || null;
    state.country = null;    // reset country when region changes
    state.stateCode = null;  // reset state when region changes
    state.page = 1;
    state.cities = [];
    state.total = 0;
    renderRegionPills();
    renderCountryPills();
    renderStateSelect();
    updateLoadMoreUI();
    updateResultCountUI();
    pushUrl();
    fetchPage({ append: false });
  }

  // =============== Country cascade ===============
  // When a sub-region is selected, fetch its countries and render as pills.
  // Cached in countryCache so repeat selections are instant.

  function setCountry(cca2) {
    if (state.country === cca2) return;
    state.country = cca2 || null;
    state.stateCode = null;  // reset state when country changes
    state.page = 1;
    state.cities = [];
    state.total = 0;
    renderCountryPills();
    renderStateSelect();
    updateLoadMoreUI();
    updateResultCountUI();
    pushUrl();
    fetchPage({ append: false });
  }

  function setStateCode(code) {
    if (state.stateCode === code) return;
    state.stateCode = code || null;
    state.page = 1;
    state.cities = [];
    state.total = 0;
    renderStateSelect();
    updateLoadMoreUI();
    updateResultCountUI();
    pushUrl();
    fetchPage({ append: false });
  }

  async function fetchCountriesForRegion(slug) {
    const cacheKey = "region:" + slug;
    if (countryCache[cacheKey]) return countryCache[cacheKey];
    // Map region slug → UN sub-region name (case-sensitive, must match API)
    const SUBREGION_NAMES = {
      "northern-africa": "Northern Africa", "western-africa": "Western Africa",
      "middle-africa": "Middle Africa", "eastern-africa": "Eastern Africa",
      "southern-africa": "Southern Africa",
      "eastern-asia": "Eastern Asia", "south-eastern-asia": "South-Eastern Asia",
      "southern-asia": "Southern Asia", "central-asia": "Central Asia",
      "western-asia": "Western Asia",
      "western-europe": "Western Europe", "northern-europe": "Northern Europe",
      "southern-europe": "Southern Europe", "central-europe": "Central Europe",
      "southeast-europe": "Southeast Europe", "eastern-europe": "Eastern Europe",
      "north-america": "Northern America", "central-america": "Central America",
      "caribbean": "Caribbean",
      "south-america": "South America",
      "australia-and-new-zealand": "Australia and New Zealand",
      "melanesia": "Melanesia", "micronesia": "Micronesia", "polynesia": "Polynesia"
    };
    const subregionName = SUBREGION_NAMES[slug];
    if (!subregionName) return [];
    try {
      const r = await fetch(`${API_BASE}/v1/countries?limit=300`);
      const j = await r.json();
      const all = (j.data && j.data.countries) || [];
      const list = all
        .filter(c => c.unSubregion === subregionName)
        .map(c => ({
          cca2: c.cca2,
          name: c.name,
          flagEmoji: c.flagEmoji || "",
          slug: c.countrySlug || (c.name || "").toLowerCase().replace(/[^a-z0-9]+/g, '-')
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      countryCache[cacheKey] = list;
      return list;
    } catch (e) {
      console.warn("fetchCountriesForRegion failed", e);
      return [];
    }
  }

  async function renderCountryPills() {
    const host = el("wt-country-pills");
    const row = el("wt-country-row");
    if (!host || !row) return;
    if (!state.region || state.region === "all") {
      row.hidden = true;
      host.innerHTML = "";
      return;
    }
    row.hidden = false;
    host.innerHTML = '<span class="wt-cascading-loading">Loading countries…</span>';
    const countries = await fetchCountriesForRegion(state.region);
    if (!countries.length) {
      host.innerHTML = '<span class="wt-empty">No countries in this sub-region.</span>';
      return;
    }
    // Highlight active country
    host.innerHTML = countries.map(c => {
      const active = state.country === c.cca2 ? " is-active" : "";
      const flag = c.flagEmoji || "";
      return `<button type="button" class="wt-pill wt-pill-country${active}" data-country="${c.cca2}"><span class="wt-pill-flag">${flag}</span><span class="wt-pill-label">${escapeHtml(c.name)}</span></button>`;
    }).join("");
    host.querySelectorAll(".wt-pill").forEach(btn => {
      btn.addEventListener("click", () => setCountry(btn.dataset.country));
    });
  }

  // =============== State cascade ===============
  // When a country is selected, fetch its states and render as a scrollable
  // dropdown. Uses native <select size="6"> for accessibility + native scrollbar.

  async function fetchStatesForCountry(cca2) {
    const cacheKey = "country:" + cca2;
    if (stateCache[cacheKey]) return stateCache[cacheKey];
    try {
      const r = await fetch(`${API_BASE}/v1/countries/${cca2}/states`);
      const j = await r.json();
      const list = (j.data && j.data.states) || [];
      const sorted = list
        .map(s => ({ code: s.code, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      stateCache[cacheKey] = sorted;
      return sorted;
    } catch (e) {
      console.warn("fetchStatesForCountry failed", e);
      return [];
    }
  }

  async function renderStateSelect() {
    const host = el("wt-state-select-wrap");
    const row = el("wt-state-row");
    if (!host || !row) return;
    if (!state.country) {
      row.hidden = true;
      host.innerHTML = "";
      return;
    }
    row.hidden = false;
    host.innerHTML = '<span class="wt-cascading-loading">Loading states…</span>';
    const states = await fetchStatesForCountry(state.country);
    if (!states.length) {
      host.innerHTML = '<span class="wt-empty">No states in this country.</span>';
      return;
    }
    // Build a scrollable dropdown (size=6) so the scrollbar is visible.
    let html = `<label class="wt-state-label">State: <select id="wt-state-select" class="wt-state-select" size="6" aria-label="Filter by state">`;
    html += `<option value="">All states</option>`;
    for (const s of states) {
      const sel = state.stateCode === s.code ? " selected" : "";
      html += `<option value="${s.code}"${sel}>${escapeHtml(s.name)}</option>`;
    }
    html += `</select></label>`;
    html += `<button type="button" class="wt-pill wt-pill-clear" data-clear-state>× Clear</button>`;
    host.innerHTML = html;
    const sel = el("wt-state-select");
    if (sel) {
      sel.addEventListener("change", () => setStateCode(sel.value || null));
    }
    const clearBtn = host.querySelector("[data-clear-state]");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => setStateCode(null));
    }
  }

  function setSort(code) {
    if (state.sort === code) return;
    state.sort = code;
    state.page = 1;
    state.cities = [];
    state.total = 0;
    updateLoadMoreUI();
    updateResultCountUI();
    pushUrl();
    fetchPage({ append: false });
  }

  function setQuery(q) {
    state.q = (q || "").trim();
    state.page = 1;
    state.cities = [];
    state.total = 0;
    updateLoadMoreUI();
    updateResultCountUI();
    pushUrl();
    fetchPage({ append: false });
  }

  function loadMore() {
    if (state.loading) return;
    if (state.cities.length >= state.total) return;
    if (state.total === 0) return;  // not loaded yet
    state.page += 1;
    pushUrl();
    fetchPage({ append: true });
  }

  // =============== URL state ===============

  function pushUrl() {
    const params = new URLSearchParams();
    if (state.continent !== "all") params.set("continent", state.continent);
    if (state.region) params.set("region", state.region);
    if (state.sort !== "popular") params.set("sort", state.sort);
    if (state.q) params.set("q", state.q);
    if (state.page > 1) params.set("p", String(state.page));
    const qs = params.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    try { window.history.replaceState(null, "", url); } catch (e) {}
  }

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    const continent = params.get("continent") || "all";
    const validCont = CONTINENTS.find(c => c.code === continent);
    if (validCont) state.continent = continent;

    const region = params.get("region") || null;
    if (region) {
      const cont = CONTINENTS.find(c => c.code === state.continent);
      if (cont && cont.regions.find(r => r.slug === region)) {
        state.region = region;
      }
    }

    // Per-page init (set by the country/state page builder)
    if (window.__COUNTRY_CCA2) state.country = window.__COUNTRY_CCA2;
    if (window.__STATE_CODE) state.stateCode = window.__STATE_CODE;
    // URL params take precedence
    const countryParam = params.get("country");
    if (countryParam) state.country = countryParam.toUpperCase();
    const stateParam = params.get("state");
    if (stateParam) state.stateCode = stateParam;

    const sort = params.get("sort") || "popular";
    if (SORTS.find(s => s.code === sort)) state.sort = sort;

    state.q = params.get("q") || "";
    state.page = Math.max(1, parseInt(params.get("p") || "1", 10) || 1);
  }

  // =============== Rendering ===============

  function el(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  }

  function renderContinentPills() {
    const host = el("wt-continent-pills");
    if (!host) return;
    host.innerHTML = CONTINENTS.map(c => {
      const active = state.continent === c.code ? " is-active" : "";
      return `<button type="button" class="wt-pill${active}" data-continent="${c.code}"><span class="wt-pill-icon" aria-hidden="true">${c.icon}</span><span class="wt-pill-label">${c.label}</span></button>`;
    }).join("");
    host.querySelectorAll(".wt-pill").forEach(btn => {
      btn.addEventListener("click", () => setContinent(btn.dataset.continent));
    });
  }

  // Renders the "Browse {Country} by state" tile grid on the country page.
  // Pulls state list from window.__STATES (set by the build script).
  // For US, each tile is a rich card with image + timezone + live clock.
  function renderStateGrid() {
    const host = el("wt-state-grid");
    if (!host) return;
    const states = window.__STATES || [];
    if (!states.length) {
      host.innerHTML = `<p class="wt-empty">No states available.</p>`;
      return;
    }
    // Per-state enrichment: timezone, capital, city count, population.
    // The lookup table is on window.__STATE_META (set by the build script)
    // and is keyed by state code (e.g. "CA", "NY").
    const meta = window.__STATE_META || {};
    host.innerHTML = states.map(s => {
      const m = meta[s.code] || {};
      const slug = s.slug || (s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const tz = m.timezone || 'UTC';
      const capital = m.capital || '';
      const cityCount = m.cityCount || 0;
      const population = m.population || 0;
      const image = m.image || slug; // falls back to slug-based filename
      return `
        <a href="/world-time/${window.__COUNTRY_SLUG}/state/${slug}/" class="wt-state-tile" data-tz="${tz}">
          <div class="wt-state-tile-img-wrap" data-state-code="${escapeHtml(s.code)}">
            <img class="wt-state-tile-img" src="/assets/states/${image}.webp" alt="${escapeHtml(s.name)}" loading="lazy" width="400" height="225" decoding="async" onerror="this.onerror=null;this.classList.add('wt-img-failed');this.parentElement.classList.add('wt-img-failed')" />
            <span class="wt-state-tile-tz" title="Time zone">${escapeHtml(m.tzLabel || '')}</span>
          </div>
          <div class="wt-state-tile-body">
            <h3 class="wt-state-tile-name">${escapeHtml(s.name)}</h3>
            <div class="wt-state-tile-stats">
              <span class="wt-state-tile-cities">${cityCount} cities</span>
              ${population > 0 ? `<span class="wt-state-tile-pop">${formatPop(population)}</span>` : ''}
            </div>
            ${capital ? `<div class="wt-state-tile-capital">Capital: ${escapeHtml(capital)}</div>` : ''}
            <div class="wt-state-tile-clock" data-clock-tz="${tz}">--:--:--</div>
          </div>
        </a>
      `;
    }).join("");
    // Start live clocks for the state tiles.
    startStateClocks();
  }

  // Format population: 1.2M, 456K, 7.8K
  function formatPop(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
    return String(n);
  }

  // Live clocks for the state tile grid. Updates every second.
  let _stateClockTimer = null;
  function startStateClocks() {
    if (_stateClockTimer) clearInterval(_stateClockTimer);
    function tick() {
      const tiles = document.querySelectorAll('.wt-state-tile-clock');
      tiles.forEach(t => {
        const tz = t.getAttribute('data-clock-tz');
        if (!tz) return;
        try {
          const now = new Date();
          const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
          });
          t.textContent = fmt.format(now);
        } catch (e) { /* tz not supported, leave placeholder */ }
      });
    }
    tick();
    _stateClockTimer = setInterval(tick, 1000);
  }

  function renderRegionPills() {
    const host = el("wt-region-pills");
    const row = el("wt-region-row");
    if (!host || !row) return;
    const cont = CONTINENTS.find(c => c.code === state.continent);
    const regions = (cont && cont.regions) || [];
    if (!regions.length) {
      row.hidden = true;
      host.innerHTML = "";
      return;
    }
    row.hidden = false;
    host.innerHTML = regions.map(r => {
      const active = state.region === r.slug ? " is-active" : "";
      return `<button type="button" class="wt-pill wt-pill-sub${active}" data-region="${r.slug}"><span class="wt-pill-icon" aria-hidden="true">${r.icon}</span><span class="wt-pill-label">${r.label}</span></button>`;
    }).join("");
    host.querySelectorAll(".wt-pill").forEach(btn => {
      btn.addEventListener("click", () => setRegion(btn.dataset.region));
    });
  }

  // Slugify a city name the same way the build script does. Used as a fallback
  // for the city-card link when the API doesn't return `path` (e.g. on state
  // pages where the data comes from /api/v1/cities instead of /popular).
  function slugifyCityName(name) {
    return (name || "")
      .toLowerCase()
      .replace(/['\u2018\u2019]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildCityPath(c) {
    if (c.path) return c.path;
    // The /api/v1/cities endpoint (used on state pages) doesn't enrich with
    // path/countrySlug/slug, so build it from the name + window globals.
    const countrySlug =
      c.countrySlug ||
      (window.__COUNTRY_SLUG) ||
      (c.countryCode ? c.countryCode.toLowerCase() : "");
    const citySlug = c.slug || slugifyCityName(c.name || c.asciiName);
    if (!countrySlug || !citySlug) return "#";
    return `/world-time/${countrySlug}/${citySlug}/`;
  }

  function renderCard(c) {
    const safeName = escapeHtml(c.name);
    const safeCountry = escapeHtml(c.countryName || "");
    const safeTz = escapeHtml(c.timezone || "");
    const cca2 = (c.countryCode || "").toLowerCase();
    const flagEmoji = c.flagEmoji || "";
    const flagUrl = cca2 ? `https://flagcdn.com/w40/${cca2}.png` : "";
    const path = buildCityPath(c);
    // Show the state name on city cards (only on country pages, not state
    // pages where the state is already in the URL). Looks up the friendly
    // state name from window.__STATES (set by the build script).
    let stateNameHtml = "";
    if (state.country && !state.stateCode) {
      const sc = c.stateCode || c.state_code;
      if (sc) {
        const meta = window.__STATE_META || {};
        const stateMeta = meta[sc];
        if (stateMeta) {
          stateNameHtml = `<span class="wt-card-state">${escapeHtml(stateMeta.name || sc)}</span>`;
        } else {
          // Fallback: 2-letter state code
          stateNameHtml = `<span class="wt-card-state">${escapeHtml(sc)}</span>`;
        }
      }
    }
    return `
      <article class="wt-card" data-tz="${c.timezone || ""}" data-id="${c.id}" data-path="${path}">
        <a class="wt-card-link" href="${path}" aria-label="Open ${safeName} time zone page">
          ${flagUrl ? `<img class="wt-card-flag" src="${flagUrl}" alt="${flagEmoji || safeCountry}" loading="lazy" width="30" height="20" decoding="async" onerror="this.onerror=null;this.style.display='none';this.insertAdjacentText('afterend','${flagEmoji}')" />` : ""}
          <div class="wt-card-head">
            <span class="wt-live-pulse" aria-hidden="true"></span>
            <span class="wt-card-name">${safeName}</span>
            ${stateNameHtml}
          </div>
          <div class="wt-card-time" data-clock-tz="${c.timezone || ""}">--:--:--.--</div>
          <div class="wt-card-meta">
            <span class="wt-card-tz" title="${safeTz}">${safeTz}</span>
            <div class="wt-card-meta-row">
              <span class="wt-card-day" data-day-tz="${c.timezone || ""}">—</span>
              <span class="wt-card-pill" data-pill-tz="${c.timezone || ""}">—</span>
            </div>
          </div>
        </a>
      </article>
    `;
  }

  function renderGrid() {
    const grid = el("wt-card-grid");
    if (!grid) return;
    if (!state.cities.length) {
      grid.innerHTML = `<p class="wt-empty">No cities match the current filters. <button type="button" class="wt-link-btn" id="wt-reset">Reset filters</button></p>`;
      const reset = el("wt-reset");
      if (reset) reset.addEventListener("click", () => resetAll());
      return;
    }
    // "By state" sort: render state-name section headers between groups.
    if (state.sort === "state") {
      const stateNameBy = new Map();
      for (const s of (window.__STATES || [])) {
        if (s && s.code) stateNameBy.set(s.code, s.name);
      }
      const stateNameOf = (c) => stateNameBy.get(c.stateCode || c.state_code) || (c.stateCode || c.state_code) || "Other";
      const parts = [];
      let lastState = null;
      for (const c of state.cities) {
        const s = stateNameOf(c);
        if (s !== lastState) {
          parts.push(`<h3 class="wt-state-group-header">${escapeHtml(s)}</h3>`);
          lastState = s;
        }
        parts.push(renderCard(c));
      }
      grid.innerHTML = parts.join("");
    } else {
      grid.innerHTML = state.cities.map(renderCard).join("");
    }
  }

  function updateLoadMoreUI() {
    const btn = el("wt-load-more");
    const info = el("wt-page-info");
    if (!btn) return;
    const shown = state.cities.length;
    const total = state.total;
    const remaining = Math.max(0, total - shown);
    // Hide the button when the remainder is small enough that another
    // "Load more" click would be annoying (a one or two city gap). The
    // result counter still shows the full total.
    if (remaining > 10) {
      btn.hidden = false;
      const rem = btn.querySelector("[data-section-remaining]");
      if (rem) rem.textContent = `(${remaining} more)`;
    } else {
      btn.hidden = true;
    }
    if (info) {
      info.hidden = false;
      info.textContent = `Page ${state.page} · ${shown.toLocaleString()} of ${total.toLocaleString()}`;
    }
  }

  function updateResultCountUI() {
    const count = el("wt-count");
    if (count) count.textContent = state.total > 0 ? `${state.total.toLocaleString()} cities` : "—";
    const rc = el("wt-result-count");
    if (rc) {
      if (state.total === 0) {
        rc.textContent = "No matches";
      } else {
        rc.textContent = `Showing ${state.cities.length.toLocaleString()} of ${state.total.toLocaleString()} cities`;
      }
    }
  }

  function resetAll() {
    state.continent = "all";
    state.region = null;
    state.sort = "popular";
    state.q = "";
    state.page = 1;
    state.cities = [];
    const searchInput = el("wt-search-input");
    if (searchInput) searchInput.value = "";
    const sortSelect = el("wt-sort-select");
    if (sortSelect) sortSelect.value = "popular";
    const clear = el("wt-search-clear");
    if (clear) clear.hidden = true;
    renderContinentPills(); renderRegionPills(); renderCountryPills(); renderStateSelect();
    pushUrl();
    fetchPage({ append: false });
  }

  // =============== Live clock updates (client-side, ~60fps) ===============

  let rafId = null;
  function tick() {
    const now = new Date();
    document.querySelectorAll("[data-clock-tz]").forEach(el => {
      const tz = el.dataset.clockTz;
      if (!tz) return;
      el.textContent = fmtTimeWithMs(tz, now);
    });
    document.querySelectorAll("[data-day-tz]").forEach(el => {
      const tz = el.dataset.dayTz;
      if (!tz) return;
      const d = getDateInTz(tz, now);
      el.textContent = dayLabel(d);
    });
    document.querySelectorAll("[data-pill-tz]").forEach(el => {
      const tz = el.dataset.pillTz;
      if (!tz) return;
      const p = offsetPill(tz, now);
      el.textContent = p.text;
      el.className = "wt-card-pill" + (p.isPositive ? " is-positive" : "") + (p.isNegative ? " is-negative" : "") + (p.isNeutral ? " is-neutral" : "");
    });
    rafId = requestAnimationFrame(tick);
  }

  // =============== Event wiring ===============

  function wireSearch() {
    const input = el("wt-search-input");
    const clear = el("wt-search-clear");
    if (!input) return;
    let t = null;
    input.addEventListener("input", () => {
      const v = input.value;
      if (clear) clear.hidden = !v;
      if (t) clearTimeout(t);
      t = setTimeout(() => setQuery(v), SEARCH_DEBOUNCE_MS);
    });
    // Trigger immediately on Enter
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (t) { clearTimeout(t); t = null; }
        setQuery(input.value);
      }
    });
    if (clear) {
      clear.addEventListener("click", () => {
        input.value = "";
        clear.hidden = true;
        if (t) { clearTimeout(t); t = null; }
        setQuery("");
        input.focus();
      });
    }
  }

  function wireSort() {
    const sel = el("wt-sort-select");
    if (!sel) return;
    sel.addEventListener("change", () => setSort(sel.value));
  }

  function wireLoadMore() {
    const btn = el("wt-load-more");
    if (!btn) return;
    btn.addEventListener("click", loadMore);
  }

  function wireCloseButtons() {
    // No-op: the close button was removed from the card per the design
    // update. Kept as a stub in case we want to add a different interaction
    // (e.g. favorite-toggle) in the future.
  }

  // =============== Boot ===============

  async function init() {
    const grid = el("wt-card-grid");
    if (!grid) return; // not the /world-time/ page

    readUrl();
    // Sync the controls with the URL state
    const searchInput = el("wt-search-input");
    if (searchInput) searchInput.value = state.q;
    const clear = el("wt-search-clear");
    if (clear) clear.hidden = !state.q;
    const sortSel = el("wt-sort-select");
    if (sortSel) sortSel.value = state.sort;

    renderContinentPills(); renderRegionPills(); renderCountryPills(); renderStateSelect();
    renderStateGrid();
    wireSearch();
    wireSort();
    wireLoadMore();
    wireCloseButtons();
    tick();
    // If the URL asks for page > 1, we need to fetch pages 1..N sequentially
    // so the user sees the full accumulated list (initial 8 + (p-1)*15 more).
    if (state.page > 1) {
      for (let p = 1; p <= state.page; p++) {
        const before = state.cities.length;
        await fetchPagesUpTo(p, { append: p > 1 });
        if (state.cities.length === before) break; // no more results
      }
    } else {
      fetchPage({ append: false });
    }
  }

  // Fetch with an explicit page number (doesn't mutate state.page). Used only
  // during init when we need to repopulate from a URL like ?p=3.
  async function fetchPagesUpTo(p, { append = false } = {}) {
    if (state.aborter) {
      try { state.aborter.abort(); } catch (e) {}
    }
    state.aborter = new AbortController();
    state.loading = true;
    setLoadingUI(true);
    try {
      let list = [];
      let data = {};
      if (state.stateCode && state.country) {
        // Same multi-page fetch as fetchPage for state pages.
        const all = await fetchAllCountryCities(state.aborter.signal);
        const sc = state.stateCode;
        list = all.filter(c => (c.stateCode || c.state_code) === sc);
        const minPop = (typeof window !== 'undefined' && window.__MIN_POPULATION) || 0;
        if (minPop > 0) {
          list = list.filter(c => (c.population || 0) >= minPop);
        }
      } else {
        const r = await fetch(buildApiUrlForPage(p), {
          signal: state.aborter.signal,
          headers: { "Accept": "application/json" }
        });
        if (!r.ok) throw new Error("popular upstream " + r.status);
        const j = await r.json();
        data = j.data || {};
        list = data.cities || [];
      }
      state.total = state.stateCode ? list.length : (data?.total != null ? data.total : list.length);
      if (state.country && !state.stateCode && (window.__MIN_POPULATION || 0) > 0 && window.__CITY_TOTAL) {
        state.total = window.__CITY_TOTAL;
      }
      if (append) {
        const seen = new Set(state.cities.map(c => c.id));
        for (const c of list) if (!seen.has(c.id)) state.cities.push(c);
      } else {
        state.cities = list;
      }
      renderGrid();
      updateLoadMoreUI();
      updateResultCountUI();
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("world-time-cities: failed to fetch", err);
    } finally {
      state.loading = false;
      setLoadingUI(false);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
