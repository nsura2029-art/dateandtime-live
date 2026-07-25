/* dateandtime.live -- World Time hub: card grid
 *
 * Powers the world-time hub at /world-time/. Renders city cards in two
 * groupings, with per-section "Load more" buttons:
 *   1. Top popular cities (5 visible by default)
 *   2. By region — Asia, Europe, Americas, Africa, Oceania (3 visible each)
 *
 * Each card uses the same visual language as the home page city-card:
 *   green live pulse  +  city name  +  × close  +  big mono time
 *   +  region info (tz + day + offset pill)
 *
 * Data:   /api/v1/cities/popular  (250 cities, with continent + country + path)
 * Render: card grid (responsive 2/3/4/5 cols), centered
 * Live:   per-card clock updates every second via requestAnimationFrame
 *
 * Continent filter and sort are applied client-side over the initial 250
 * so the user can switch instantly without a roundtrip.
 */
(function () {
  "use strict";

  const API_BASE = "https://datetime-api-dev.nsura2029.workers.dev";
  const STORAGE_KEY = "tdl.worldtime.cities";
  const STORAGE_TTL = 24 * 60 * 60 * 1000; // 24h

  // Continent metadata (label + emoji + section key)
  const CONTINENTS = [
    { code: "all", label: "All",     emoji: "🌍" },
    { code: "AS",  label: "Asia",    emoji: "🌏", sectionKey: "asia" },
    { code: "EU",  label: "Europe",  emoji: "🌍", sectionKey: "europe" },
    { code: "NA",  label: "N. America", emoji: "🌎", sectionKey: "americas" },
    { code: "SA",  label: "S. America", emoji: "🌎", sectionKey: "americas" },
    { code: "AF",  label: "Africa",  emoji: "🌍", sectionKey: "africa" },
    { code: "OC",  label: "Oceania", emoji: "🌏", sectionKey: "oceania" }
  ];

  const SORTS = [
    { code: "population", label: "Popular" },
    { code: "name",       label: "City A-Z" },
    { code: "country",    label: "Country" }
  ];

  // Per-section initial visibility (only the "top" section is rendered now;
  // the continent filter at the top of the section handles region browsing)
  const VISIBLE_PER_SECTION = {
    top: 8
  };

  let state = {
    cities: [],
    filter: "all",
    sort: "population"
  };

  // =============== Date / time helpers ===============

  function fmtTimeWithMs(tz, date) {
    // Big mono time with milliseconds, e.g. "02:22:18.98"
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
    // Returns { year, month, day, hour, minute, weekday } in the target timezone
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", weekday: "short",
        hour12: false
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
    // Reference point for "today/tomorrow/yesterday" labelling
    return getDateInTz(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date());
  }

  function dayLabel(targetDate) {
    if (!targetDate) return "";
    const user = getUserTzDate();
    if (!user) return "";
    // Compare YYYY-MM-DD in each timezone
    const userKey = `${user.year}-${String(user.month).padStart(2, "0")}-${String(user.day).padStart(2, "0")}`;
    const targetKey = `${targetDate.year}-${String(targetDate.month).padStart(2, "0")}-${String(targetDate.day).padStart(2, "0")}`;
    if (targetKey === userKey) return "today";
    // Day diff (approximate)
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
    // Offset from user's local timezone, in hours, like "+5 H" or "-8 H"
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
    // Returns the offset in minutes east of UTC for the given timezone at the
    // given instant. Uses Intl.DateTimeFormat with timeZoneName to extract
    // the GMT offset.
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset"
      }).formatToParts(date);
      const off = parts.find(p => p.type === "timeZoneName")?.value || "GMT";
      // "GMT-8", "GMT+5:30", "GMT" etc.
      const m = off.match(/GMT([+\-])(\d{1,2})(?::(\d{2}))?/);
      if (!m) return 0;
      const sign = m[1] === "-" ? -1 : 1;
      const h = parseInt(m[2] || "0", 10);
      const mm = parseInt(m[3] || "0", 10);
      return sign * (h * 60 + mm);
    } catch (e) { return 0; }
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

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  }

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
    host.querySelectorAll(".wt-filter").forEach(btn => {
      btn.addEventListener("click", () => {
        state.filter = btn.dataset.filter;
        host.querySelectorAll(".wt-filter").forEach(b => b.classList.toggle("is-active", b === btn));
        renderSections();
      });
    });
    host.querySelectorAll(".wt-sort").forEach(btn => {
      btn.addEventListener("click", () => {
        state.sort = btn.dataset.sort;
        host.querySelectorAll(".wt-sort").forEach(b => b.classList.toggle("is-active", b === btn));
        renderSections();
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

  function continentToSection(continent) {
    // Kept for backward-compat with any legacy code that called this; the
    // single-section redesign no longer needs it.
    const meta = CONTINENTS.find(c => c.code === continent);
    return meta ? meta.sectionKey : null;
  }

  function renderSections() {
    const visible = getVisible();
    el("wt-count").textContent = visible.length.toLocaleString();

    // Single "top" section: first N cities (continent filter narrows visible[])
    const topList = visible.slice(0, VISIBLE_PER_SECTION.top);
    renderGrid("top", topList);
    // Hide top section if no cities
    document.querySelector('[data-section-key="top"]').style.display = topList.length ? "" : "none";
  }

  function renderCard(c) {
    // The card mirrors the home page city-card structure for visual consistency.
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
            <span class="wt-card-remove" aria-hidden="true" title="Close">×</span>
          </div>
          <div class="wt-card-time" data-clock-tz="${c.timezone || ""}">--:--:--.--</div>
          <div class="wt-card-meta">
            <span class="wt-card-tz" title="${safeTz}">${safeTz}</span>
            <span class="wt-card-sep" aria-hidden="true">·</span>
            <span class="wt-card-day" data-day-tz="${c.timezone || ""}">—</span>
            <span class="wt-card-pill" data-pill-tz="${c.timezone || ""}">—</span>
          </div>
        </a>
      </article>
    `;
  }

  function renderGrid(sectionKey, cities) {
    const grid = document.querySelector(`[data-section="${sectionKey}"]`);
    if (!grid) return;
    if (!cities.length) {
      grid.innerHTML = "";
      updateLoadMore(sectionKey, 0, 0);
      return;
    }
    grid.innerHTML = cities.map(renderCard).join("");

    // Section count
    const countEl = document.querySelector(`[data-section-key="${sectionKey}"] [data-section-count]`);
    if (countEl) {
      const total = getTotalForSection(sectionKey);
      countEl.textContent = total === cities.length ? `${total} cities` : `${cities.length} of ${total} cities`;
    }

    // Load more
    const total = getTotalForSection(sectionKey);
    updateLoadMore(sectionKey, cities.length, total);
  }

  function getTotalForSection(sectionKey) {
    // Returns the total number of cities in this section (not just visible)
    if (sectionKey === "top") {
      return getVisible().length;
    }
    const visible = getVisible();
    let n = 0;
    for (const c of visible) {
      if (continentToSection(c.continent) === sectionKey) n++;
    }
    return n;
  }

  function updateLoadMore(sectionKey, shown, total) {
    const btn = document.querySelector(`[data-section-key="${sectionKey}"] .wt-load-more`);
    if (!btn) return;
    const remaining = Math.max(0, total - shown);
    if (remaining > 0) {
      btn.hidden = false;
      const rem = btn.querySelector("[data-section-remaining]");
      if (rem) rem.textContent = `(${remaining} more)`;
    } else {
      btn.hidden = true;
    }
  }

  // Expand a section to show all cities
  function expandSection(sectionKey) {
    let list;
    if (sectionKey === "top") {
      list = getVisible();
    } else {
      list = getVisible().filter(c => continentToSection(c.continent) === sectionKey);
    }
    renderGrid(sectionKey, list);
  }

  // =============== Live clock updates ===============

  let rafId = null;
  function tick() {
    const now = new Date();
    document.querySelectorAll("[data-clock-tz]").forEach(el => {
      const tz = el.dataset.clockTz;
      if (!tz) return;
      el.textContent = fmtTimeWithMs(tz, now);
    });
    // Update day labels and offset pills
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

  function wireLoadMore() {
    document.querySelectorAll(".wt-load-more").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        const section = btn.dataset.section;
        if (!section) return;
        expandSection(section);
      });
    });
  }

  function wireCloseButtons() {
    // The × button on each card removes the card from the DOM for the
    // current session (no persistence — the user can always re-render via
    // the page reload). This is just a visual opt-out, like hiding a
    // banner — the data is still in the underlying state.
    document.addEventListener("click", e => {
      const btn = e.target.closest(".wt-card-remove");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest(".wt-card");
      if (!card) return;
      card.style.transition = "opacity 200ms ease, transform 200ms ease";
      card.style.opacity = "0";
      card.style.transform = "scale(0.95)";
      setTimeout(() => {
        card.remove();
      }, 200);
    });
  }

  // =============== Boot ===============

  async function init() {
    const topGrid = document.querySelector('[data-section="top"]');
    if (!topGrid) return; // not the /world-time/ page

    renderFilters();
    state.cities = await fetchCities();
    renderSections();
    wireLoadMore();
    wireCloseButtons();
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
