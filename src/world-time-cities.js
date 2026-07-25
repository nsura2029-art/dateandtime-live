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
  const INITIAL_VISIBLE = 8;   // page 1
  const PAGE_STEP = 15;        // each subsequent page
  const SEARCH_DEBOUNCE_MS = 250;

  // Continent metadata. continent code → URL/API value, label, emoji,
  // and sub-region list (slugs that the API understands for that continent).
  // Sub-region slugs match the API's `?region=` param. The Americas
  // intentionally have an empty list — the API data is messy (NA/SA
  // territories sit under continent=XX), so we show "All Americas" only.
  const CONTINENTS = [
    { code: "all",      api: null,       label: "All",        emoji: "🌍", regions: [] },
    { code: "africa",   api: "AF",       label: "Africa",     emoji: "🌍", regions: [
      { slug: "northern-africa",   label: "Northern Africa" },
      { slug: "western-africa",    label: "Western Africa" },
      { slug: "middle-africa",     label: "Middle Africa" },
      { slug: "eastern-africa",    label: "Eastern Africa" },
      { slug: "southern-africa",   label: "Southern Africa" }
    ] },
    { code: "asia",     api: "AS",       label: "Asia",       emoji: "🌏", regions: [
      { slug: "eastern-asia",      label: "Eastern Asia" },
      { slug: "south-eastern-asia", label: "South-Eastern Asia" },
      { slug: "southern-asia",     label: "Southern Asia" },
      { slug: "central-asia",      label: "Central Asia" },
      { slug: "western-asia",      label: "Western Asia" }
    ] },
    { code: "europe",   api: "EU",       label: "Europe",     emoji: "🌍", regions: [
      { slug: "western-europe",    label: "Western Europe" },
      { slug: "northern-europe",   label: "Northern Europe" },
      { slug: "southern-europe",   label: "Southern Europe" },
      { slug: "central-europe",    label: "Central Europe" },
      { slug: "southeast-europe",  label: "Southeast Europe" },
      { slug: "eastern-europe",    label: "Eastern Europe" }
    ] },
    { code: "namerica", api: "NA",       label: "N. America", emoji: "🌎", regions: [] },
    { code: "samerica", api: "SA",       label: "S. America", emoji: "🌎", regions: [] },
    { code: "oceania",  api: "OC",       label: "Oceania",    emoji: "🌏", regions: [
      { slug: "australia-and-new-zealand", label: "Australia & NZ" },
      { slug: "melanesia",         label: "Melanesia" },
      { slug: "micronesia",        label: "Micronesia" },
      { slug: "polynesia",         label: "Polynesia" }
    ] }
  ];

  const SORTS = [
    { code: "popular", label: "Popular" },
    { code: "name",    label: "City A–Z" },
    { code: "country", label: "Country" }
  ];

  // =============== State ===============

  const state = {
    continent: "all",
    region: null,
    sort: "popular",
    q: "",
    page: 1,
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
    if (state.sort && state.sort !== "popular") params.set("sort", state.sort);
    if (state.q) params.set("q", state.q);
    const offset = p === 1 ? 0 : (INITIAL_VISIBLE + (p - 2) * PAGE_STEP);
    const limit = p === 1 ? INITIAL_VISIBLE : PAGE_STEP;
    params.set("offset", String(offset));
    params.set("limit", String(limit));
    return `${API_BASE}/api/v1/cities/popular?${params}`;
  }

  async function fetchPage({ append = false } = {}) {
    if (state.aborter) {
      try { state.aborter.abort(); } catch (e) {}
    }
    state.aborter = new AbortController();
    state.loading = true;
    setLoadingUI(true);

    try {
      const r = await fetch(buildApiUrl(), {
        signal: state.aborter.signal,
        headers: { "Accept": "application/json" }
      });
      if (!r.ok) throw new Error("popular upstream " + r.status);
      const j = await r.json();
      const data = j.data || {};
      const list = data.cities || [];
      state.total = data.total != null ? data.total : list.length;

      if (append) {
        // Append, dedup by id
        const seen = new Set(state.cities.map(c => c.id));
        for (const c of list) if (!seen.has(c.id)) state.cities.push(c);
      } else {
        state.cities = list;
      }

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
    state.page = 1;
    state.cities = [];
    state.total = 0;          // reset total too so the Load more text is correct
    renderContinentPills();
    renderRegionPills();
    updateLoadMoreUI();
    updateResultCountUI();
    pushUrl();
    fetchPage({ append: false });
  }

  function setRegion(slug) {
    if (state.region === slug) return;
    state.region = slug || null;
    state.page = 1;
    state.cities = [];
    state.total = 0;
    renderRegionPills();
    updateLoadMoreUI();
    updateResultCountUI();
    pushUrl();
    fetchPage({ append: false });
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
      return `<button type="button" class="wt-pill${active}" data-continent="${c.code}">${c.emoji} ${c.label}</button>`;
    }).join("");
    host.querySelectorAll(".wt-pill").forEach(btn => {
      btn.addEventListener("click", () => setContinent(btn.dataset.continent));
    });
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
      return `<button type="button" class="wt-pill wt-pill-sub${active}" data-region="${r.slug}">${r.label}</button>`;
    }).join("");
    host.querySelectorAll(".wt-pill").forEach(btn => {
      btn.addEventListener("click", () => setRegion(btn.dataset.region));
    });
  }

  function renderCard(c) {
    const safeName = escapeHtml(c.name);
    const safeCountry = escapeHtml(c.countryName || "");
    const safeTz = escapeHtml(c.timezone || "");
    const flag = c.flagEmoji || "";
    const path = c.path || "#";
    return `
      <article class="wt-card" data-tz="${c.timezone || ""}" data-id="${c.id}" data-path="${path}">
        <a class="wt-card-link" href="${path}" aria-label="Open ${safeName} time zone page">
          <div class="wt-card-head">
            <span class="wt-live-pulse" aria-hidden="true"></span>
            <span class="wt-card-name">${flag ? `<span class="wt-card-flag">${flag}</span>` : ""}${safeName}</span>
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
    grid.innerHTML = state.cities.map(renderCard).join("");
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
    renderContinentPills();
    renderRegionPills();
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

    renderContinentPills();
    renderRegionPills();
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
      const r = await fetch(buildApiUrlForPage(p), {
        signal: state.aborter.signal,
        headers: { "Accept": "application/json" }
      });
      if (!r.ok) throw new Error("popular upstream " + r.status);
      const j = await r.json();
      const data = j.data || {};
      const list = data.cities || [];
      state.total = data.total != null ? data.total : list.length;
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
