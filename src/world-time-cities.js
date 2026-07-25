/* dateandtime.live -- World Time hub: city grid
 *
 * Powers the 5-column alphabetical grid on /world-time/ that lists the
 * 200+ most popular cities, each linking to its dedicated page.
 *
 * Data:   /api/v1/cities/popular  (with continent / isCapital / sort filters)
 * Render: 5 columns on desktop, 3 on tablet, 2 on phone
 * Live:   per-row clock updates every second via requestAnimationFrame
 *
 * Continent filter and sort are applied client-side over the initial 200
 * so the user can switch instantly without a roundtrip.
 */
(function () {
  "use strict";

  const API_BASE = "https://datetime-api-dev.nsura2029.workers.dev";
  const STORAGE_KEY = "tdl.worldtime.cities";
  const STORAGE_TTL = 24 * 60 * 60 * 1000; // 24h

  // Continent metadata (label + emoji)
  const CONTINENTS = [
    { code: "all", label: "All",     emoji: "🌍" },
    { code: "AF",  label: "Africa",  emoji: "🌍" },
    { code: "AS",  label: "Asia",    emoji: "🌏" },
    { code: "EU",  label: "Europe",  emoji: "🌍" },
    { code: "NA",  label: "N. America", emoji: "🌎" },
    { code: "OC",  label: "Oceania", emoji: "🌏" },
    { code: "SA",  label: "S. America", emoji: "🌎" }
  ];

  const SORTS = [
    { code: "population", label: "Popular" },
    { code: "name",       label: "City A-Z" },
    { code: "country",    label: "Country" }
  ];

  let state = {
    cities: [],
    filter: "all",
    sort: "population"
  };

  // =============== Date / time helpers ===============

  function fmtTime(tz, date) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true
      }).formatToParts(date);
      const h = parts.find(p => p.type === "hour")?.value || "";
      const m = parts.find(p => p.type === "minute")?.value || "";
      const p = parts.find(p => p.type === "dayPeriod")?.value || "";
      return h && m ? `${h}:${m} ${p}` : "—";
    } catch (e) { return "—"; }
  }

  function isDaytime(tz, date) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "numeric", hour12: false
      }).formatToParts(date);
      const h = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
      return h >= 6 && h < 19;
    } catch (e) { return true; }
  }

  // =============== Data loading ===============

  async function fetchCities() {
    // Try cache first
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (cached && Date.now() - cached.at < STORAGE_TTL && Array.isArray(cached.data) && cached.data.length) {
        return cached.data;
      }
    } catch (e) { /* ignore */ }

    try {
      const r = await fetch(API_BASE + "/api/v1/cities/popular?limit=250");
      if (!r.ok) throw new Error("popular upstream " + r.status);
      const j = await r.json();
      const list = (j.data && j.data.cities) || [];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), data: list })); } catch (e) {}
      return list;
    } catch (err) {
      console.error("world-time-cities: failed to fetch", err);
      return [];
    }
  }

  // =============== Rendering ===============

  function el(id) { return document.getElementById(id); }

  function renderFilters() {
    const host = el("wt-filters");
    if (!host) return;
    const filterPills = CONTINENTS.map(c => {
      const active = state.filter === c.code ? " is-active" : "";
      return `<button type="button" class="wt-filter${active}" data-filter="${c.code}">${c.emoji} ${c.label}</button>`;
    }).join("");
    const sortBtns = SORTS.map(s => {
      const active = state.sort === s.code ? " is-active" : "";
      return `<button type="button" class="wt-sort${active}" data-sort="${s.code}">${s.label}</button>`;
    }).join("");
    host.innerHTML = `
      <div class="wt-filter-row">
        <span class="wt-filter-label">Continent:</span>
        <div class="wt-filter-pills">${filterPills}</div>
      </div>
      <div class="wt-sort-row">
        <span class="wt-sort-label">Sort:</span>
        <div class="wt-sort-pills">${sortBtns}</div>
      </div>
    `;
    // Wire up clicks
    host.querySelectorAll(".wt-filter").forEach(btn => {
      btn.addEventListener("click", () => {
        state.filter = btn.dataset.filter;
        host.querySelectorAll(".wt-filter").forEach(b => b.classList.toggle("is-active", b === btn));
        renderGrid();
      });
    });
    host.querySelectorAll(".wt-sort").forEach(btn => {
      btn.addEventListener("click", () => {
        state.sort = btn.dataset.sort;
        host.querySelectorAll(".wt-sort").forEach(b => b.classList.toggle("is-active", b === btn));
        renderGrid();
      });
    });
  }

  function getVisible() {
    let cities = state.cities;
    if (state.filter !== "all") {
      cities = cities.filter(c => c.continent === state.filter);
    }
    if (state.sort === "name") {
      cities = cities.slice().sort((a, b) => a.name.localeCompare(b.name));
    } else if (state.sort === "country") {
      cities = cities.slice().sort((a, b) =>
        (a.countryName || "").localeCompare(b.countryName || "") || a.name.localeCompare(b.name)
      );
    } else {
      // 'population' (default) - already sorted by the API
    }
    return cities;
  }

  function renderGrid() {
    const grid = el("wt-city-grid");
    if (!grid) return;
    const visible = getVisible();

    // Group by first letter
    const groups = new Map();
    for (const c of visible) {
      const letter = (c.name || "?").charAt(0).toUpperCase();
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter).push(c);
    }

    const sections = Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([letter, cities]) => {
        const rows = cities.map(c => {
          const safeName = (c.name || "").replace(/</g, "&lt;");
          const safeCountry = (c.countryName || "").replace(/</g, "&lt;");
          const flag = c.flagEmoji || "";
          const path = c.path || "#";
          return `
            <a href="${path}" class="wt-city-row" data-tz="${c.timezone || ""}" data-id="${c.id}">
              <span class="wt-city-flag" aria-hidden="true">${flag}</span>
              <span class="wt-city-name">${safeName}</span>
              <span class="wt-city-country">${safeCountry}</span>
              <span class="wt-city-time" data-clock-tz="${c.timezone || ""}">—</span>
              <span class="wt-city-arrow" aria-hidden="true">›</span>
            </a>
          `;
        }).join("");
        return `
          <section class="wt-letter-group">
            <h3 class="wt-letter-head" id="letter-${letter}">${letter}</h3>
            <div class="wt-letter-rows">${rows}</div>
          </section>
        `;
      }).join("");

    grid.innerHTML = sections || `<p class="wt-empty">No cities match the current filter.</p>`;
    el("wt-count").textContent = visible.length.toLocaleString();
  }

  // =============== Live clock updates ===============

  let rafId = null;
  function tick() {
    const now = new Date();
    document.querySelectorAll("[data-clock-tz]").forEach(el => {
      const tz = el.dataset.clockTz;
      if (!tz) return;
      el.textContent = fmtTime(tz, now);
    });
    rafId = requestAnimationFrame(tick);
  }

  // =============== Boot ===============

  async function init() {
    const grid = el("wt-city-grid");
    if (!grid) return; // not the /world-time/ page

    renderFilters();
    state.cities = await fetchCities();
    renderGrid();
    tick();
    // Expose + announce so other scripts (ItemList schema) can pick up.
    window.__popularCities = state.cities;
    window.dispatchEvent(new CustomEvent("tdl-popular-cities-loaded", { detail: { count: state.cities.length } }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
