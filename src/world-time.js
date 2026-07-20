/* dateandtime.live — World Time page logic
 *
 * State:
 *   - cities[]    : {id, name, countryCode, countryName, stateCode, timezone, home, currentTime}
 *   - workHours[] : cached {cca2: {workDays: [], hours: {open, close}}}
 *
 * API:
 *   - GET /api/v2/search?q={query}&limit=5
 *   - GET /api/v1/cities/{id}
 *   - GET /api/v1/time/now?tz={iana}
 *   - GET /api/v1/countries/{cca2}/working-hours
 *
 * URL:
 *   - ?cities={id1,id2,...}   pre-populate cities
 *   - ?time=15:00             pre-pick time
 *
 * Storage:
 *   - localStorage.tdlWorldTimeCities = JSON.stringify([ids])
 *
 * Page route: /world-time/
 */
(function () {
  "use strict";

  // ========== CONFIG ==========
  const API_BASE = window.location.hostname === "dateandtime.live" || window.location.hostname.endsWith(".dateandtime.live")
    ? "https://api.dateandtime.live"
    : window.location.hostname.endsWith(".workers.dev")
      ? "https://dev.api.dateandtime.live"
      : "/api"; // same-origin proxy fallback
  const STORAGE_KEY = "tdlWorldTimeCities";
  const MAX_CITIES = 10;

  // ========== STATE ==========
  let cities = []; // {id, name, countryCode, countryName, stateCode, timezone, home, currentTime, offsetMinutes, workStart, workEnd, workDays, currentHour}
  let workHoursCache = {}; // {cca2: {workDays: [...], hours: {open, close}}}
  let selectedRange = null; // {cityId, startHour, endHour}
  let focusedDate = new Date(); // currently-shown date in the timeline

  // ========== HELPERS ==========
  function $(s, root) { return (root || document).querySelector(s); }
  function $$(s, root) { return Array.from((root || document).querySelectorAll(s)); }

  function fmtHour(h) {
    if (h === 0) return { h: "12", p: "am" };
    if (h < 12) return { h: String(h), p: "am" };
    if (h === 12) return { h: "12", p: "pm" };
    return { h: String(h - 12), p: "pm" };
  }

  function localHourInCity(tz, date) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
      const parts = fmt.formatToParts(date);
      const hour = parseInt(parts.find(p => p.type === "hour").value, 10);
      return hour === 24 ? 0 : hour;
    } catch (e) { return null; }
  }

  function localDayNameInCity(tz, date) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
      return fmt.format(date);
    } catch (e) { return "?"; }
  }

  function localDateInCity(tz, date) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric", month: "short" });
      return fmt.format(date);
    } catch (e) { return ""; }
  }

  function localTimeInCity(tz, date) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
      return fmt.format(date);
    } catch (e) { return "?"; }
  }

  function localOffsetInCity(tz, date) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
      const parts = fmt.formatToParts(date);
      const off = parts.find(p => p.type === "timeZoneName")?.value || "GMT";
      return off.replace("GMT", "");
    } catch (e) { return ""; }
  }

  function localAbbrevInCity(tz, date) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
      const parts = fmt.formatToParts(date);
      return parts.find(p => p.type === "timeZoneName")?.value || "";
    } catch (e) { return ""; }
  }

  function isWorkHour(city, hour, dayName) {
    const wh = workHoursCache[city.countryCode];
    if (!wh) return false;
    if (!wh.workDays || !wh.workDays.includes(dayName)) return false;
    return hour >= wh.hours.open && hour < wh.hours.close;
  }

  function isEarlyHour(city, hour, dayName) {
    const wh = workHoursCache[city.countryCode];
    if (!wh) return false;
    if (!wh.workDays || !wh.workDays.includes(dayName)) return false;
    // Early: 1 hour before work start, or 1 hour after work end
    return (hour >= wh.hours.open - 1 && hour < wh.hours.open) ||
           (hour >= wh.hours.close && hour < wh.hours.close + 1);
  }

  function offsetHours(offsetMinutes) {
    if (offsetMinutes == null) return "";
    const h = offsetMinutes / 60;
    return h >= 0 ? "+" + h : String(h);
  }

  // ========== API CALLS ==========
  async function api(path) {
    const url = API_BASE === "/api" ? path : API_BASE + path;
    const r = await fetch(url);
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  }

  async function searchCities(query) {
    if (!query || query.length < 2) return [];
    const data = await api("/api/v2/search?q=" + encodeURIComponent(query) + "&limit=6");
    return (data.data && data.data.cities) || [];
  }

  async function getCity(id) {
    const data = await api("/api/v1/cities/" + id);
    return data.data && data.data.city;
  }

  async function getWorkingHours(cca2) {
    if (workHoursCache[cca2]) return workHoursCache[cca2];
    try {
      const data = await api("/api/v1/countries/" + cca2 + "/working-hours");
      workHoursCache[cca2] = data.data;
      return workHoursCache[cca2];
    } catch (e) {
      // Default: Mon-Fri 9-5
      return { workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], hours: { open: 9, close: 17 } };
    }
  }

  // ========== CITY LIST MANAGEMENT ==========
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  }

  function saveToStorage() {
    try {
      const ids = cities.map(c => ({ id: c.id, home: !!c.home }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {}
  }

  function getHomeCity() {
    // Use window.__location (injected by Worker from CF IP)
    const loc = window.__location;
    if (loc && loc.city && loc.country) {
      return {
        name: loc.city,
        countryCode: loc.country,
        countryName: loc.countryName || "",
        stateCode: loc.regionCode || "",
        timezone: loc.timezone || "UTC",
        home: true
      };
    }
    return null;
  }

  async function addCity(city) {
    if (cities.find(c => c.id === city.id)) return false; // already added
    if (cities.length >= MAX_CITIES) {
      alert("Max " + MAX_CITIES + " cities. Remove one to add another.");
      return false;
    }
    // Fetch full data
    let full = city;
    if (!full.timezone) {
      try { full = await getCity(city.id); } catch (e) {}
    }
    const newCity = {
      id: full.id,
      name: full.name || city.name,
      countryCode: full.countryCode || city.countryCode,
      countryName: full.countryName || city.countryName,
      stateCode: full.stateCode || city.stateCode,
      timezone: full.timezone,
      home: !!city.home
    };
    cities.push(newCity);
    // Fetch working hours in background
    if (newCity.countryCode) getWorkingHours(newCity.countryCode).then(() => { saveToStorage(); render(); });
    saveToStorage();
    render();
    return true;
  }

  function removeCity(id) {
    const idx = cities.findIndex(c => c.id === id);
    if (idx < 0) return;
    cities.splice(idx, 1);
    if (selectedRange && selectedRange.cityId === id) selectedRange = null;
    saveToStorage();
    render();
  }

  // ========== RENDER ==========
  function render() {
    renderChips();
    renderMain();
    renderUrlState();
    updateTimeEverySecond();
  }

  function renderChips() {
    const wrap = $("#wt-city-chips");
    if (!wrap) return;
    wrap.innerHTML = cities.map(c => `
      <button class="wt-city-chip ${c.home ? "home" : ""}" data-id="${c.id}" data-action="remove">
        ${c.home ? "⌂ " : ""}${escapeHtml(c.name)}<span class="now" data-time="${c.id}">--:--</span><span class="x" data-id="${c.id}">×</span>
      </button>
    `).join("");
  }

  function renderMain() {
    const main = $("#wt-main");
    if (!main) return;
    if (cities.length === 0) {
      main.innerHTML = `
        <div class="wt-empty">
          <p>No cities added yet. <strong>Type a city name</strong> in the search bar above to get started.</p>
          <p class="wt-onboard">Tip: <strong>${escapeHtml(getHomeCity() ? getHomeCity().name : "your home city")}</strong> will be added as your home city on first visit. Use <code>?cities=tampa,london&time=15:00</code> in the URL to deep-link a specific view.</p>
        </div>
      `;
      return;
    }

    const now = new Date();
    const dayName = localDayNameInCity(cities[0].timezone, now) + "day"; // Mon, Tue, etc. → Monday...
    // Actually need to get the full day name in the user's tz
    const userTz = (window.__location && window.__location.timezone) || cities[0].timezone;
    const userDayName = localDayNameInCity(userTz, now);
    const fullDayName = ({
      "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday", "Thu": "Thursday",
      "Fri": "Friday", "Sat": "Saturday", "Sun": "Sunday"
    })[userDayName] || "Monday";

    main.innerHTML = `
      <div class="wt-cities-head">
        <div class="left">+ Place or timezone</div>
        <div class="right">
          <span class="day-label" id="wt-day-label">${fullDayName}, ${localDateInCity(userTz, now)}</span>
          <div class="pager">
            <button data-pager="prev" aria-label="Previous day">‹</button>
            <button data-pager="next" aria-label="Next day">›</button>
          </div>
        </div>
      </div>
      ${cities.map(city => renderCityRow(city, now)).join("")}
    `;
  }

  function renderCityRow(city, now) {
    const tz = city.timezone;
    const hour = localHourInCity(tz, now);
    const dayName = (() => {
      const d = localDayNameInCity(tz, now);
      return ({ "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday", "Thu": "Thursday",
        "Fri": "Friday", "Sat": "Saturday", "Sun": "Sunday" })[d] || "Monday";
    })();
    const offset = localOffsetInCity(tz, now);
    const abbrev = localAbbrevInCity(tz, now);
    const time = localTimeInCity(tz, now);
    const date = localDateInCity(tz, now);
    const isHome = !!city.home;

    let tiles = "";
    for (let h = 0; h < 24; h++) {
      const isWork = isWorkHour(city, h, dayName);
      const isEarly = isEarlyHour(city, h, dayName);
      const isNow = (h === hour);
      const isSelected = selectedRange && selectedRange.cityId === city.id && h >= selectedRange.startHour && h <= selectedRange.endHour;
      const classes = ["wt-tile"];
      if (isWork) classes.push("work");
      if (isEarly) classes.push("early");
      if (isNow) classes.push("now");
      if (isSelected) classes.push(isSelected === (h === selectedRange.startHour || h === selectedRange.endHour) ? "is-selected" : "in-range");
      const fmt = fmtHour(h);
      tiles += `<div class="${classes.join(" ")}" data-tile data-city="${city.id}" data-hour="${h}"><span class="h">${fmt.h}</span><span class="p">${fmt.p}</span></div>`;
    }
    const homeLabel = isHome ? '<span class="home">⌂</span> ' : "";

    return `
      <div class="wt-city-row" data-city="${city.id}">
        <div class="left">
          <div class="row">
            ${homeLabel}<span class="name">${escapeHtml(city.name)}</span>
            <span class="abbrev">${escapeHtml(abbrev)}</span>
            <span class="offset">${offset}</span>
          </div>
          <div class="country">${escapeHtml((city.stateCode ? city.stateCode + ", " : "") + city.countryName)}</div>
          <div class="time">${time}</div>
          <div class="date">${date}</div>
        </div>
        <div class="right">${tiles}</div>
      </div>
    `;
  }

  function renderUrlState() {
    const el = $("#wt-url-state");
    if (!el) return;
    const params = new URLSearchParams(window.location.search);
    const cities = params.get("cities");
    const time = params.get("time");
    if (!cities && !time) { el.classList.add("is-hidden"); return; }
    el.classList.remove("is-hidden");
    el.innerHTML = `
      <span>🔗</span>
      <span>URL parsed:</span>
      <code>?${cities ? "cities=" + cities : ""}${cities && time ? "&" : ""}${time ? "time=" + time : ""}</code>
      <span>· pre-populated</span>
    `;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ========== TIME TICKER ==========
  function updateTimeEverySecond() {
    // Update chip times and "now" indicator every second
    if (window.__wtTickInterval) clearInterval(window.__wtTickInterval);
    function tick() {
      const now = new Date();
      cities.forEach(city => {
        const chipTime = document.querySelector(`.wt-city-chip[data-id="${city.id}"] .now`);
        if (chipTime) chipTime.textContent = localTimeInCity(city.timezone, now);
        // Update left info time
        const row = document.querySelector(`.wt-city-row[data-city="${city.id}"]`);
        if (row) {
          const timeEl = row.querySelector(".time");
          if (timeEl) timeEl.textContent = localTimeInCity(city.timezone, now);
        }
        // Update "now" indicator on the grid
        const newHour = localHourInCity(city.timezone, now);
        const oldNow = document.querySelector(`.wt-city-row[data-city="${city.id}"] .wt-tile.now`);
        if (oldNow && parseInt(oldNow.dataset.hour, 10) !== newHour) {
          oldNow.classList.remove("now");
        }
        const newNow = document.querySelector(`.wt-city-row[data-city="${city.id}"] .wt-tile[data-hour="${newHour}"]`);
        if (newNow) newNow.classList.add("now");
      });
    }
    tick();
    window.__wtTickInterval = setInterval(tick, 1000);
  }

  // ========== INTERACTIONS ==========
  // Drag select
  let dragState = null; // {cityId, startHour}
  function setupDragSelect() {
    const main = $("#wt-main");
    if (!main) return;
    main.addEventListener("mousedown", (e) => {
      const tile = e.target.closest("[data-tile]");
      if (!tile) return;
      e.preventDefault();
      const cityId = parseInt(tile.dataset.city, 10);
      const startHour = parseInt(tile.dataset.hour, 10);
      dragState = { cityId, startHour };
      selectedRange = { cityId, startHour, endHour: startHour };
      render();
    });
    main.addEventListener("mouseover", (e) => {
      if (!dragState) return;
      const tile = e.target.closest("[data-tile]");
      if (!tile) return;
      const cityId = parseInt(tile.dataset.city, 10);
      if (cityId !== dragState.cityId) return;
      const hour = parseInt(tile.dataset.hour, 10);
      const lo = Math.min(dragState.startHour, hour);
      const hi = Math.max(dragState.startHour, hour);
      selectedRange = { cityId: dragState.cityId, startHour: lo, endHour: hi };
      render();
      showSelectionBar();
    });
    document.addEventListener("mouseup", () => {
      if (dragState) {
        dragState = null;
        showSelectionBar();
      }
    });
  }

  function showSelectionBar() {
    const bar = $("#wt-selection-bar");
    if (!bar) return;
    if (!selectedRange) { bar.classList.remove("is-visible"); return; }
    bar.classList.add("is-visible");
    const hours = selectedRange.endHour - selectedRange.startHour + 1;
    $(".wt-selection-bar .duration", bar).textContent = hours === 1 ? "1 hour" : hours + " hours";
  }

  // Hover column highlight
  function setupHoverColumn() {
    const main = $("#wt-main");
    if (!main) return;
    main.addEventListener("mouseover", (e) => {
      const tile = e.target.closest("[data-tile]");
      if (!tile) return;
      const hour = parseInt(tile.dataset.hour, 10);
      // Add is-hovered to all tiles at the same hour
      $$(`[data-tile][data-hour="${hour}"]`).forEach(t => t.classList.add("is-hovered"));
    });
    main.addEventListener("mouseout", (e) => {
      const tile = e.target.closest("[data-tile]");
      if (!tile) return;
      // Only clear when leaving the main container
      if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest("[data-tile]")) {
        $$("[data-tile].is-hovered").forEach(t => t.classList.remove("is-hovered"));
      }
    });
  }

  // Chip remove
  function setupChipRemove() {
    document.addEventListener("click", (e) => {
      const x = e.target.closest(".wt-city-chip .x");
      if (!x) return;
      e.stopPropagation();
      const id = parseInt(x.dataset.id, 10);
      removeCity(id);
    });
  }

  // Search
  function setupSearch() {
    const input = $("#wt-search-input");
    const suggestions = $("#wt-suggestions");
    if (!input || !suggestions) return;
    let searchTimeout = null;
    let lastResults = [];

    function showSuggestions(items) {
      lastResults = items;
      if (items.length === 0) { suggestions.classList.remove("is-open"); return; }
      suggestions.innerHTML = items.map((c, i) => `
        <div class="wt-suggestion" data-idx="${i}">
          <div>
            <div class="name">${escapeHtml(c.name)}${c.isCapital ? " ★" : ""}</div>
            <div class="meta">${escapeHtml((c.stateCode ? c.stateCode + ", " : "") + c.countryName)} · ${c.timezone}</div>
          </div>
          <span class="plus">+</span>
        </div>
      `).join("");
      suggestions.classList.add("is-open");
    }

    input.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      const q = input.value.trim();
      if (q.length < 2) { suggestions.classList.remove("is-open"); return; }
      searchTimeout = setTimeout(async () => {
        try {
          const results = await searchCities(q);
          // Filter out already-added
          const filtered = results.filter(r => !cities.find(c => c.id === r.id));
          showSuggestions(filtered);
        } catch (e) { console.error(e); }
      }, 200);
    });
    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) input.dispatchEvent(new Event("input"));
    });
    input.addEventListener("blur", () => {
      setTimeout(() => suggestions.classList.remove("is-open"), 200);
    });
    suggestions.addEventListener("click", async (e) => {
      const item = e.target.closest(".wt-suggestion");
      if (!item) return;
      const idx = parseInt(item.dataset.idx, 10);
      const city = lastResults[idx];
      if (!city) return;
      await addCity({ id: city.id, name: city.name, countryCode: city.countryCode, countryName: city.countryName, stateCode: city.stateCode, timezone: city.timezone, home: false });
      input.value = "";
      suggestions.classList.remove("is-open");
    });
  }

  // Date pager
  function setupDatePager() {
    document.addEventListener("click", (e) => {
      const pager = e.target.closest("[data-pager]");
      if (!pager) return;
      const dir = pager.dataset.pager === "prev" ? -1 : 1;
      focusedDate.setDate(focusedDate.getDate() + dir);
      // Re-render
      render();
    });
  }

  // Selection bar actions
  function setupSelectionActions() {
    document.addEventListener("click", (e) => {
      const action = e.target.closest("[data-selection-action]");
      if (!action) return;
      const kind = action.dataset.selectionAction;
      if (kind === "clear") { selectedRange = null; render(); return; }
      // iCal / Google Cal / Clipboard / Gmail — generate from current selection
      if (!selectedRange) return;
      const city = cities.find(c => c.id === selectedRange.cityId);
      if (!city) return;
      const startTime = `${String(selectedRange.startHour).padStart(2, "0")}:00`;
      const endTime = `${String((selectedRange.endHour + 1) % 24).padStart(2, "0")}:00`;
      const dayLabel = $("#wt-day-label")?.textContent || "";
      const eventName = $(".wt-event-name")?.value || "Meeting";
      const text = `${eventName} on ${dayLabel} ${startTime}-${endTime} (${city.name})`;
      if (kind === "ical") {
        const ics = generateICS(eventName, dayLabel, startTime, endTime, city.timezone, cities);
        downloadFile(eventName.replace(/\s+/g, "_") + ".ics", ics, "text/calendar");
      } else if (kind === "google") {
        const startUtc = tzToUtc(dayLabel, startTime, city.timezone);
        const endUtc = tzToUtc(dayLabel, endTime, city.timezone);
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventName)}&dates=${startUtc}/${endUtc}&details=${encodeURIComponent(text)}`;
        window.open(url, "_blank");
      } else if (kind === "clipboard") {
        navigator.clipboard.writeText(text).then(() => {
          const old = action.textContent;
          action.textContent = "✓ Copied";
          setTimeout(() => { action.textContent = old; }, 1500);
        });
      } else if (kind === "gmail") {
        const url = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(eventName)}&body=${encodeURIComponent(text)}`;
        window.open(url, "_blank");
      } else if (kind === "link") {
        const params = new URLSearchParams();
        params.set("cities", cities.map(c => c.id).join(","));
        params.set("time", String(selectedRange.startHour).padStart(2, "0") + ":00");
        const url = window.location.origin + window.location.pathname + "?" + params;
        navigator.clipboard.writeText(url).then(() => {
          const old = action.textContent;
          action.textContent = "✓ Link copied";
          setTimeout(() => { action.textContent = old; }, 1500);
        });
      }
    });
  }

  function generateICS(name, day, start, end, tz, allCities) {
    const startUtc = tzToUtc(day, start, tz);
    const endUtc = tzToUtc(day, end, tz);
    const cityTimes = allCities.map(c => {
      return `${c.name}: ${tzToLocal(day, start, c.timezone)}-${tzToLocal(day, end, c.timezone)}`;
    }).join("\\n");
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//dateandtime.live//World Time//EN
BEGIN:VEVENT
UID:${Date.now()}@dateandtime.live
DTSTAMP:${nowUtc()}
DTSTART:${startUtc}
DTEND:${endUtc}
SUMMARY:${name}
DESCRIPTION:${cityTimes}\\n\\nGenerated by dateandtime.live/world-time/
END:VEVENT
END:VCALENDAR`;
  }

  function nowUtc() {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function tzToUtc(dayLabel, hhmm, tz) {
    // Best-effort: use today's date + tz to get UTC
    try {
      const [h, m] = hhmm.split(":").map(Number);
      const now = new Date();
      // Make a date string in the target tz's local time
      const localStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      // Get the offset for that local time in tz
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" });
      const parts = fmt.formatToParts(new Date(localStr));
      const off = parts.find(p => p.type === "timeZoneName")?.value || "GMT+00:00";
      const m2 = off.match(/GMT([+-])(\d{2}):(\d{2})/);
      if (!m2) return nowUtc();
      const sign = m2[1] === "+" ? -1 : 1;
      const oh = parseInt(m2[2], 10);
      const om = parseInt(m2[3], 10);
      const localDate = new Date(localStr);
      const utc = new Date(localDate.getTime() + sign * (oh * 60 + om) * 60000);
      return utc.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    } catch (e) { return nowUtc(); }
  }

  function tzToLocal(dayLabel, hhmm, tz) {
    // For description, format as local string in tz
    try {
      const [h, m] = hhmm.split(":").map(Number);
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
      const local = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      return fmt.format(local);
    } catch (e) { return hhmm; }
  }

  function downloadFile(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ========== INIT ==========
  async function init() {
    // 1. Load cities from URL params first, then localStorage, then default to home
    const params = new URLSearchParams(window.location.search);
    const urlCities = (params.get("cities") || "").split(",").map(s => parseInt(s, 10)).filter(Boolean);
    const urlTime = params.get("time");
    const savedIds = loadFromStorage();

    let idsToLoad = [];
    if (urlCities.length > 0) {
      idsToLoad = urlCities;
    } else if (savedIds && savedIds.length > 0) {
      idsToLoad = savedIds.map(s => s.id);
    } else {
      // Default: try to add the user's home city via search
      const home = getHomeCity();
      if (home && home.name) {
        try {
          const results = await searchCities(home.name);
          if (results.length > 0) {
            // Try to find a match that's actually in the home's country
            const match = results.find(r => r.countryCode === home.countryCode) || results[0];
            idsToLoad = [match.id];
          }
        } catch (e) { /* fall through */ }
      }
    }

    // 2. Load each city
    for (const id of idsToLoad.slice(0, MAX_CITIES)) {
      try {
        const c = await getCity(id);
        if (c) {
          cities.push({
            id: c.id, name: c.name, countryCode: c.countryCode, countryName: c.countryName,
            stateCode: c.stateCode, timezone: c.timezone, home: false
          });
        }
      } catch (e) { console.warn("Failed to load city", id, e); }
    }

    // Mark home city (the first one that matches the user's location)
    const home = getHomeCity();
    if (home) {
      const homeMatch = cities.find(c =>
        c.name.toLowerCase() === home.name.toLowerCase() &&
        c.countryCode === home.countryCode
      );
      if (homeMatch) homeMatch.home = true;
      else if (cities.length > 0) cities[0].home = true;
    } else if (cities.length > 0) {
      cities[0].home = true;
    }

    // 3. Fetch working hours for all cities in parallel
    await Promise.all(cities.map(c =>
      c.countryCode ? getWorkingHours(c.countryCode) : Promise.resolve()
    ));

    // 4. Set initial selection from URL time
    if (urlTime) {
      const [h] = urlTime.split(":").map(Number);
      if (!isNaN(h) && cities.length > 0) {
        selectedRange = { cityId: cities[0].id, startHour: h, endHour: h };
        showSelectionBar();
      }
    }

    saveToStorage();
    render();

    // 5. Wire up interactions
    setupSearch();
    setupDragSelect();
    setupHoverColumn();
    setupChipRemove();
    setupDatePager();
    setupSelectionActions();

    // 6. Re-render after work hours load
    render();
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
