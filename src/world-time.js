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
  // Default work hours: 8am-5pm Mon-Fri (hardcoded for all cities, regardless of country)
  const DEFAULT_WORK_OPEN = 8;   // 8am
  const DEFAULT_WORK_CLOSE = 17;  // 5pm
  const DEFAULT_WORK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  let cities = []; // {id, name, countryCode, countryName, stateCode, timezone, home, currentTime, offsetMinutes, workStart, workEnd, workDays, currentHour}
  let workHoursCache = {}; // {cca2: {workDays: [...], hours: {open, close}}}
  let selectedRange = null; // {anchorCityId, startCol, endCol} — anchor city is the first one selected
  let focusedDate = new Date(); // currently-shown date in the timeline
  let cityOffsetCache = {}; // {iana: offsetHours} — cache for performance
  let use24h = false; // false = 12h (default), true = 24h
  const TOTAL_COLS = 24; // 24 hourly columns; :30 suffix shown for cities with 30-min offset (e.g. India)

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
    // Default 8am-5pm Mon-Fri (same for all cities, hardcoded)
    if (!DEFAULT_WORK_DAYS.includes(dayName)) return false;
    return hour >= DEFAULT_WORK_OPEN && hour < DEFAULT_WORK_CLOSE;
  }

  function isEarlyHour(city, hour, dayName) {
    // No early/late hours — work starts/ends exactly at 8/5
    return false;
  }

  // Sleep: 11pm-6am (default sleep hours, applies every day including weekends)
  function isSleepHour(hour) {
    return hour >= 23 || hour < 6;
  }

  function offsetHours(offsetMinutes) {
    if (offsetMinutes == null) return "";
    const h = offsetMinutes / 60;
    return h >= 0 ? "+" + h : String(h);
  }

  // Get the UTC offset (in hours, positive for east) for a timezone at a given date
  function getTzOffsetHours(tz, date) {
    if (cityOffsetCache[tz] !== undefined) return cityOffsetCache[tz];
    try {
      // Use Intl.DateTimeFormat to get the long offset (e.g. "GMT-04:00")
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" });
      const parts = fmt.formatToParts(date);
      const off = parts.find(p => p.type === "timeZoneName")?.value || "GMT+00:00";
      // Parse "GMT-04:00" or "GMT+05:30"
      const m = off.match(/GMT([+-])(\d{1,2}):(\d{2})/);
      if (!m) { cityOffsetCache[tz] = 0; return 0; }
      const sign = m[1] === "+" ? 1 : -1;
      const h = parseInt(m[2], 10);
      const mi = parseInt(m[3], 10);
      const result = sign * (h + mi / 60);
      cityOffsetCache[tz] = result;
      return result;
    } catch (e) { return 0; }
  }

  // Format a number of hours as a local time string
  function formatLocalTime(hours) {
    // hours can be a fractional number (e.g. 13.5 = 1:30pm)
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    const hr = ((h + 24) % 24);
    const fmt = fmtHalfHour(hr, m, use24h);
    return fmt.h + (fmt.m ? " " + fmt.m : "") + fmt.p;
  }

  // Get the local hour range for a city given an anchor city's selected range
  // Returns: { startLocal, endLocal, crossesMidnight, dayOffset }
  function getLocalRangeForCity(city, anchor, startHour, endHour) {
    const anchorOffset = getTzOffsetHours(anchor.timezone, focusedDate);
    const cityOffset = getTzOffsetHours(city.timezone, focusedDate);
    const delta = cityOffset - anchorOffset;
    let startLocal = startHour + delta;
    let endLocal = endHour + delta;
    let dayOffset = 0;
    let crossesMidnight = false;
    // Normalize to [0, 24)
    if (startLocal < 0) { startLocal += 24; dayOffset = -1; crossesMidnight = true; }
    if (endLocal <= 0) { endLocal += 24; dayOffset = -1; crossesMidnight = true; }
    if (startLocal >= 24) { startLocal -= 24; dayOffset = 1; crossesMidnight = true; }
    if (endLocal > 24) { endLocal -= 24; dayOffset = 1; crossesMidnight = true; }
    if (endLocal < startLocal && !crossesMidnight) crossesMidnight = true;
    return { startLocal, endLocal, dayOffset, crossesMidnight };
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
    const data = await api("/api/v2/search?q=" + encodeURIComponent(query) + "&limit=10");
    const cities = (data.data && data.data.cities) || [];
    // Prefer more populous cities when names match (avoids San Antonio FL vs TX confusion)
    // The API already returns results sorted by relevance, but we re-sort by population
    // for ambiguous names where multiple cities exist.
    return cities.sort((a, b) => (b.population || 0) - (a.population || 0)).slice(0, 6);
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
    if (selectedRange && selectedRange.anchorCityId === id) {
      // Pick a new anchor (or clear if no cities left)
      selectedRange = cities.length > 0 ? { anchorCityId: cities[0].id, startCol: selectedRange.startCol, endCol: selectedRange.endCol } : null;
    }
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
          <div class="wt-head-row">
            <button class="pager-btn" data-pager="prev" aria-label="Previous day">‹</button>
            <div class="wt-date-tabs" id="wt-date-tabs">
              <!-- Populated by JS -->
            </div>
            <button class="pager-btn" data-pager="next" aria-label="Next day">›</button>
            <input type="date" id="wt-date-picker" class="wt-date-picker" aria-label="Pick a date" />
            <button class="wt-time-toggle" id="wt-time-toggle" title="Toggle 12/24 hour format" aria-label="Toggle 12/24 hour format">12h</button>
          </div>
          <div class="wt-day-label-wrap">
            <span class="day-label" id="wt-day-label">${fullDayName}, ${localDateInCity(userTz, now)}</span>
          </div>
        </div>
      </div>
      ${cities.map(city => renderCityRow(city, now)).join("")}
      <div class="wt-now-line" id="wt-now-line" style="display:none"></div>
    `;
    // Position the now-line in the first city's row at the now hour
    positionNowLine(now);
  }

  function positionNowLine(now, currentCol) {
    const line = document.getElementById("wt-now-line");
    if (!line || cities.length === 0) return;
    if (currentCol === undefined) {
      const anchorTz = cities[0]?.timezone;
      if (!anchorTz) return;
      try {
        const fmt = new Intl.DateTimeFormat("en-US", { timeZone: anchorTz, hour: "numeric", minute: "numeric", hour12: false });
        const parts = fmt.formatToParts(now);
        let h = 0, m = 0;
        for (const p of parts) { if (p.type === "hour") h = parseInt(p.value, 10); if (p.type === "minute") m = parseInt(p.value, 10); }
        currentCol = h * 2 + (m >= 30 ? 1 : 0);
      } catch (e) { return; }
    }
    const firstRow = document.querySelector(".wt-city-row");
    if (!firstRow) return;
    const firstTiles = firstRow.querySelectorAll(".wt-tile");
    const targetTile = firstTiles[currentCol];
    if (!targetTile) { line.style.display = "none"; return; }
    const grid = firstRow.querySelector(".right");
    if (!grid) { line.style.display = "none"; return; }
    const gridRect = grid.getBoundingClientRect();
    const tileRect = targetTile.getBoundingClientRect();
    const x = tileRect.left - gridRect.left + tileRect.width / 2;
    line.style.display = "block";
    line.style.left = (gridRect.left - firstRow.getBoundingClientRect().left + x) + "px";
    const allRows = document.querySelectorAll(".wt-city-row");
    let maxH = 0;
    allRows.forEach(r => { if (r.scrollHeight > maxH) maxH = r.scrollHeight; });
    line.style.height = maxH + "px";
  }

  // === SHARED WALL-CLOCK AXIS HELPERS ===
  // Compute the wall-clock moment for a given anchor column (0-23, hourly) on the focused date.
  // The moment represents col:00:00 in the ANCHOR city's tz.
  function getAnchorColMoment(col) {
    const anchorTz = cities[0]?.timezone;
    if (!anchorTz) {
      return new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate(), col, 0, 0, 0);
    }
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: anchorTz, year: "numeric", month: "2-digit", day: "2-digit" });
      const [y, m, d] = fmt.format(focusedDate).split("-").map(Number);
      // Compute the SIGNED UTC offset of the anchor tz at noon of that day
      const noonUTC = Date.UTC(y, m - 1, d, 12, 0, 0);
      const hourInAnchor = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: anchorTz, hour: "numeric", hour12: false }).format(new Date(noonUTC)), 10);
      let offset = hourInAnchor - 12;
      if (offset > 14) offset -= 24;
      if (offset < -12) offset += 24;
      // The moment for col:00 in anchor tz = Date.UTC(y, m, d, col - offset, 0, 0)
      return new Date(Date.UTC(y, m - 1, d, col - offset, 0, 0));
    } catch (e) {
      return new Date(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate(), col, 0, 0, 0);
    }
  }

  // Format a 30-min slot (hour 0-23, min 0 or 30) for display
  // Returns { h, m, p } where m is the "30" suffix (rendered as small superscript)
  function fmtHalfHour(hour, min, is24h) {
    const m = (min === 0) ? "" : String(min).padStart(2, "0");
    if (is24h) {
      const h = String(hour).padStart(2, "0");
      return { h, m, p: "" };
    }
    let h12, p;
    if (hour === 0) { h12 = "12"; p = "am"; }
    else if (hour < 12) { h12 = String(hour); p = "am"; }
    else if (hour === 12) { h12 = "12"; p = "pm"; }
    else { h12 = String(hour - 12); p = "pm"; }
    return { h: h12, m, p };
  }

  // Format a full local time string (e.g. "8:30 AM" or "08:30")
  function fmtLocalTime(date, tz, is24h) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: !is24h });
      return fmt.format(date);
    } catch (e) { return ""; }
  }

  function renderCityRow(city, now) {
    // === Shared wall-clock axis (WTB model) ===
    // Columns are anchored to the FIRST/anchor city's local 30-min slots (0-47).
    // Each row shows the LOCAL time in that city for that anchor column.
    const anchorTz = cities[0]?.timezone;
    // Current hour in the anchor's tz (0-23) — the "now" column
    const currentCol = (() => {
      if (!anchorTz) return 0;
      try {
        return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: anchorTz, hour: "numeric", hour12: false }).format(now), 10);
      } catch (e) { return 0; }
    })();
    const isHome = !!city.home;

    // Per-row date RANGE (in the city's tz)
    const startMoment = getAnchorColMoment(0);
    const endMoment = getAnchorColMoment(TOTAL_COLS - 1);
    const fmtDayDate = (m) => {
      try {
        const fmt = new Intl.DateTimeFormat("en-US", { timeZone: city.timezone, weekday: "short", day: "numeric", month: "short" });
        return fmt.format(m);
      } catch (e) { return ""; }
    };
    const startDayDate = fmtDayDate(startMoment);
    const endDayDate = fmtDayDate(endMoment);
    const dateLabel = startDayDate === endDayDate ? startDayDate : `${startDayDate} \u2192 ${endDayDate}`;

    const isFocusedTodayInAnchor = (() => {
      if (!anchorTz) return true;
      try {
        const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: anchorTz, year: "numeric", month: "2-digit", day: "2-digit" });
        return fmt.format(now) === fmt.format(focusedDate);
      } catch (e) { return true; }
    })();

    const focusedDateStrInAnchor = (() => {
      if (!anchorTz) return "";
      try {
        const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: anchorTz, year: "numeric", month: "2-digit", day: "2-digit" });
        return fmt.format(focusedDate);
      } catch (e) { return ""; }
    })();

    // Selected tiles: selection is in the anchor's 30-min columns
    let selectedStartCol = -1, selectedEndCol = -1;
    if (selectedRange) {
      const startC = selectedRange.startCol;
      const endC = selectedRange.endCol;
      if (startC <= endC) {
        selectedStartCol = startC;
        selectedEndCol = endC;
      } else {
        selectedStartCol = 0;
        selectedEndCol = TOTAL_COLS - 1;
      }
    }

    // Generate 24 tiles (hourly columns). For cities with a 30-min offset
    // (e.g. India UTC+5:30, Iran UTC+3:30), each tile's local time will
    // naturally fall on :30, and we show the ":30" suffix. For cities with
    // an integer offset, local minutes are 0 and no suffix is shown.
    let tiles = "";
    for (let c = 0; c < TOTAL_COLS; c++) {
      const moment = getAnchorColMoment(c);
      const localHour = localHourInCity(city.timezone, moment);
      const localMin = (() => {
        try {
          const fmt = new Intl.DateTimeFormat("en-US", { timeZone: city.timezone, minute: "numeric" });
          return parseInt(fmt.format(moment), 10);
        } catch (e) { return 0; }
      })();
      const localDayShort = (() => {
        try {
          const fmt = new Intl.DateTimeFormat("en-US", { timeZone: city.timezone, weekday: "short" });
          return fmt.format(moment);
        } catch (e) { return "Mon"; }
      })();
      const localDayLong = (() => {
        try {
          const fmt = new Intl.DateTimeFormat("en-US", { timeZone: city.timezone, weekday: "long" });
          return fmt.format(moment);
        } catch (e) { return "Monday"; }
      })();
      const localDateShort = (() => {
        try {
          const fmt = new Intl.DateTimeFormat("en-US", { timeZone: city.timezone, weekday: "short", day: "2-digit", month: "short" });
          return fmt.format(moment);
        } catch (e) { return ""; }
      })();
      const localDateStrInCity = (() => {
        try {
          const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: city.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
          return fmt.format(moment);
        } catch (e) { return ""; }
      })();
      const isWeekend = (localDayShort === "Sat" || localDayShort === "Sun");
      // Show day label at the first tile of each new day (local hour === 0 AND minute === 0)
      const showDayLabel = (localHour === 0 && localMin === 0);
      const isNextDay = focusedDateStrInAnchor && localDateStrInCity && localDateStrInCity > focusedDateStrInAnchor;
      const isWork = isWorkHour(city, localHour, localDayLong);
      const isEarly = isEarlyHour(city, localHour, localDayLong);
      const isSleep = isSleepHour(localHour);
      let isWorkEdge = false, isWorkMiddle = false;
      if (isWork) {
        isWorkEdge = (localHour === DEFAULT_WORK_OPEN) || (localHour === DEFAULT_WORK_CLOSE - 1);
        isWorkMiddle = isWork && !isWorkEdge;
      }
      // "Now" is now a COLUMN highlight, not an individual tile
      const isNowCol = isFocusedTodayInAnchor && (c === currentCol);
      const isPast = isFocusedTodayInAnchor && (c < currentCol);
      const isInRange = selectedStartCol >= 0 && c >= selectedStartCol && c <= selectedEndCol;
      const isStart = isInRange && c === selectedStartCol;
      const isEnd = isInRange && c === selectedEndCol;
      const classes = ["wt-tile"];
      if (isPast) classes.push("past");
      if (isWork) classes.push("work");
      if (isWorkEdge) classes.push("work-edge");
      else if (isWorkMiddle) classes.push("work-middle");
      if (isSleep) classes.push("sleep");
      if (isWeekend) classes.push("weekend");
      if (isNextDay) classes.push("next-day");
      if (isNowCol) classes.push("now-col");
      if (isStart || isEnd) classes.push("is-selected");
      else if (isInRange) classes.push("in-range");
      if (showDayLabel) classes.push("day-change");
      const fmt = fmtHalfHour(localHour, localMin, use24h);
      const dayLabelHtml = showDayLabel ? `<span class="day-label">${localDateShort.toUpperCase()}</span>` : "";
      tiles += `<div class="${classes.join(" ")}" data-tile data-city="${city.id}" data-col="${c}" data-hour="${localHour}" data-min="${localMin}">${dayLabelHtml}<span class="h">${fmt.h}</span>${fmt.m ? `<span class="m">${fmt.m}</span>` : ""}<span class="p">${fmt.p}</span></div>`;
    }

    const time = fmtLocalTime(now, city.timezone, use24h);
    const abbrev = localAbbrevInCity(city.timezone, now);
    const offset = localOffsetInCity(city.timezone, now);
    const homeLabel = isHome ? '<span class="home">\u2302</span> ' : "";

    return `
      <div class="wt-city-row" data-city="${city.id}">
        <div class="left">
          <button class="row-remove" data-row-remove="${city.id}" title="Remove ${escapeHtml(city.name)}" aria-label="Remove city">\u00d7</button>
          <div class="row">
            ${homeLabel}<span class="name">${escapeHtml(city.name)}</span>
            <span class="abbrev">${escapeHtml(abbrev)}</span>
            <span class="offset">${offset}</span>
          </div>
          <div class="country">${escapeHtml((city.stateCode ? city.stateCode + ", " : "") + city.countryName)}</div>
          <div class="time">${time}</div>
          <div class="date-row"><span class="day">${dateLabel}</span></div>
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
      const anchorTz = cities[0]?.timezone;
      // Compute current 30-min column (0-47) in the anchor's tz
      const currentCol = (() => {
        if (!anchorTz) return 0;
        try {
          return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: anchorTz, hour: "numeric", hour12: false }).format(now), 10);
        } catch (e) { return 0; }
      })();
      const isFocusedTodayInAnchor = (() => {
        if (!anchorTz) return true;
        try {
          const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: anchorTz, year: "numeric", month: "2-digit", day: "2-digit" });
          return fmt.format(now) === fmt.format(focusedDate);
        } catch (e) { return true; }
      })();
      cities.forEach(city => {
        const chipTime = document.querySelector(`.wt-city-chip[data-id="${city.id}"] .now`);
        if (chipTime) chipTime.textContent = fmtLocalTime(now, city.timezone, use24h);
        const row = document.querySelector(`.wt-city-row[data-city="${city.id}"]`);
        if (row) {
          const timeEl = row.querySelector(".time");
          if (timeEl) timeEl.textContent = fmtLocalTime(now, city.timezone, use24h);
        }
      });
      // Update "now-col" highlight: ALL rows at the same anchor column
      if (isFocusedTodayInAnchor) {
        $$(".wt-tile.now-col").forEach(t => t.classList.remove("now-col"));
        $$(`.wt-tile[data-col="${currentCol}"]`).forEach(t => t.classList.add("now-col"));
        $$(".wt-tile.past").forEach(t => t.classList.remove("past"));
        for (let c = 0; c < currentCol; c++) {
          $$(`.wt-tile[data-col="${c}"]`).forEach(t => t.classList.add("past"));
        }
      } else {
        $$(".wt-tile.now-col, .wt-tile.past").forEach(t => t.classList.remove("now-col", "past"));
      }
      positionNowLine(now, currentCol);
    }
    tick();
    window.__wtTickInterval = setInterval(tick, 1000);
  }

  // ========== INTERACTIONS ==========
  // Click select (single hour only — matches user request "move 1 HR only")
  let dragState = null; // {cityId, startCol}
  function setupDragSelect() {
    const main = $("#wt-main");
    if (!main) return;
    main.addEventListener("mousedown", (e) => {
      const tile = e.target.closest("[data-tile]");
      if (!tile) return;
      if (tile.classList.contains("past")) return; // can't select past hours
      e.preventDefault();
      const cityId = parseInt(tile.dataset.city, 10);
      const col = parseInt(tile.dataset.col, 10);
      dragState = { cityId, startCol: col };
      // Selection is a 30-min slot (1 tile = 30 min)
      selectedRange = { anchorCityId: cityId, startCol: col, endCol: col };
      render();
    });
    main.addEventListener("mouseover", (e) => {
      // Just highlight the column across all rows (1 hour window)
      // No drag-select for multi-hour ranges (per user request)
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
    if (!selectedRange) {
      bar.classList.remove("is-visible");
      $("#wt-picked-times").innerHTML = "";
      return;
    }
    bar.classList.add("is-visible");
    const hours = selectedRange.endCol - selectedRange.startCol + 1;
    $(".wt-selection-bar .duration", bar).textContent = hours === 1 ? "1 hour" : hours + " hours";
    // Per-city picked times
    const anchor = cities.find(c => c.id === selectedRange.anchorCityId);
    if (!anchor) return;
    const wrap = $("#wt-picked-times");
    if (!wrap) return;
    const evName = ($(".wt-event-name")?.value || "Meeting").trim();
    wrap.innerHTML = cities.map(city => {
      // Convert anchor columns (30-min slots) to local hours for the city
      const { startLocal, endLocal, dayOffset, crossesMidnight } = getLocalRangeForCity(city, anchor, selectedRange.startCol, selectedRange.endCol + 0.5);
      const startStr = formatLocalTime(startLocal);
      let endStr = formatLocalTime(endLocal);
      const nextDay = dayOffset > 0 || (crossesMidnight && endLocal < startLocal);
      const dayLabel = nextDay ? " +1d" : (dayOffset < 0 ? " -1d" : "");
      return `<div class="wt-picked-time ${city.home ? 'home' : ''}">
        <span class="time">${startStr}${endLocal !== startLocal ? '–' + endStr : ''}</span>
        <span class="city">${escapeHtml(city.name)}</span>
        ${dayLabel ? '<span class="next-day">' + dayLabel + '</span>' : ''}
      </div>`;
    }).join("");
  }

  // Hover column highlight
  function setupHoverColumn() {
    const main = $("#wt-main");
    if (!main) return;
    main.addEventListener("mouseover", (e) => {
      const tile = e.target.closest("[data-tile]");
      if (!tile) return;
      const col = parseInt(tile.dataset.col, 10);
      // Add is-hovered to all tiles at the same column (across all rows)
      $$(`[data-tile][data-col="${col}"]`).forEach(t => t.classList.add("is-hovered"));
    });
    main.addEventListener("mouseout", (e) => {
      const tile = e.target.closest("[data-tile]");
      if (!tile) return;
      if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest("[data-tile]")) {
        $$("[data-tile].is-hovered").forEach(t => t.classList.remove("is-hovered"));
      }
    });
  }

  // Rich tooltip on tile click: shows time in all cities at that column
  function setupTileTooltip() {
    const tooltip = document.getElementById("wt-tooltip");
    const tooltipBody = document.getElementById("wt-tooltip-body");
    const tooltipTitle = document.getElementById("wt-tooltip-title");
    const tooltipClose = document.getElementById("wt-tooltip-close");
    if (!tooltip || !tooltipBody) return;

    function close() {
      tooltip.classList.remove("is-open");
      tooltip.style.display = "none";
    }
    if (tooltipClose) tooltipClose.addEventListener("click", close);
    // Close on click outside (but not on the same mousedown that opened it)
    let suppressNextClose = false;
    document.addEventListener("mousedown", (e) => {
      if (!tooltip.classList.contains("is-open")) return;
      if (e.target.closest("#wt-tooltip")) return;
      if (e.target.closest("[data-tile]")) {
        // Clicking another tile will open a new tooltip — suppress this close
        suppressNextClose = true;
        return;
      }
      close();
    });
    document.addEventListener("click", (e) => {
      if (suppressNextClose) { suppressNextClose = false; return; }
      if (!tooltip.classList.contains("is-open")) return;
      if (e.target.closest("#wt-tooltip")) return;
      if (e.target.closest("[data-tile]")) return;
      close();
    });
    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    // Open on tile mousedown (fires before render() replaces the tile in setupDragSelect)
    document.addEventListener("mousedown", (e) => {
      const tile = e.target.closest("[data-tile]");
      if (!tile) return;
      // Only show tooltip for non-past tiles
      if (tile.classList.contains("past")) return;

      // Only show on left-click (button 0)
      if (e.button !== 0) return;

      const col = parseInt(tile.dataset.col, 10);
      if (isNaN(col)) return;
      const moment = getAnchorColMoment(col);
      const anchorTz = cities[0]?.timezone;
      const focusedDateInAnchor = (() => {
        try {
          const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: anchorTz, year: "numeric", month: "2-digit", day: "2-digit" });
          return fmt.format(focusedDate);
        } catch (e) { return ""; }
      })();

      // Build rows: one per city
      const rows = cities.map((city) => {
        const localHour = localHourInCity(city.timezone, moment);
        const localTime = fmtLocalTime(moment, city.timezone, use24h);
        const localDayShort = (() => {
          try {
            const fmt = new Intl.DateTimeFormat("en-US", { timeZone: city.timezone, weekday: "short" });
            return fmt.format(moment);
          } catch (e) { return "Mon"; }
        })();
        const localDayLong = (() => {
          try {
            const fmt = new Intl.DateTimeFormat("en-US", { timeZone: city.timezone, weekday: "long" });
            return fmt.format(moment);
          } catch (e) { return "Monday"; }
        })();
        const localDateStr = (() => {
          try {
            const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: city.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
            return fmt.format(moment);
          } catch (e) { return ""; }
        })();
        const isWork = isWorkHour(city, localHour, localDayLong);
        const isEarly = isEarlyHour(city, localHour, localDayLong);
        const isSleep = isSleepHour(localHour);
        const isWeekend = (localDayShort === "Sat" || localDayShort === "Sun");
        const isNextDay = focusedDateInAnchor && localDateStr && localDateStr > focusedDateInAnchor;
        const isHome = !!city.home;

        let status = "off";
        let statusLabel = "Off";
        if (isWork) {
          if (localHour === DEFAULT_WORK_OPEN) { status = "work"; statusLabel = "Work start"; }
          else if (localHour === DEFAULT_WORK_CLOSE - 1) { status = "work"; statusLabel = "Work end"; }
          else { status = "work"; statusLabel = "Work"; }
        } else if (isSleep) { status = "sleep"; statusLabel = "Sleep"; }
        if (isWeekend) { status = "weekend"; statusLabel = "Weekend"; }

        return { city, localTime, localDayShort, isNextDay, status, statusLabel, isHome };
      });

      // Title: the anchor city's time + day
      const anchorRow = rows[0];
      tooltipTitle.textContent = `${anchorRow.localTime} \u00b7 ${anchorRow.localDayShort}${anchorRow.isNextDay ? ' +1d' : ''}`;

      // Body
      tooltipBody.innerHTML = rows.map(r => {
        const home = r.isHome ? '<span class="home" title="Your home city">\u2302</span> ' : '';
        const nextDay = r.isNextDay ? ' <span class="plus">+1d</span>' : '';
        return `<div class="wt-tooltip-row">
          <span class="wt-tooltip-name">${home}${escapeHtml(r.city.name)}</span>
          <span class="wt-tooltip-time">${r.localTime}</span>
          <span class="wt-tooltip-day">${r.localDayShort}${nextDay}</span>
          <span class="wt-tooltip-status ${r.status}">${r.statusLabel}</span>
        </div>`;
      }).join("");

      // Position the tooltip as an overlay at the home city row, at the selected column
      tooltip.style.display = "block";
      tooltip.style.visibility = "hidden";
      requestAnimationFrame(() => {
        positionTooltipAtHomeCol(col);
        tooltip.style.visibility = "";
        tooltip.classList.add("is-open");
      });
    });
  }

  // Position the tooltip centered on the home city tile at the given column
  // and just below the home city row (or above if no space below)
  function positionTooltipAtHomeCol(col) {
    const tooltip = document.getElementById("wt-tooltip");
    if (!tooltip) return;
    const homeRow = document.querySelector(".wt-city-row");
    if (!homeRow) return;
    const homeTiles = homeRow.querySelectorAll(".wt-tile");
    const homeTile = homeTiles[col];
    if (!homeTile) return;
    const tileRect = homeTile.getBoundingClientRect();
    const homeRect = homeRow.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Center horizontally on the home tile
    let left = tileRect.left + tileRect.width / 2 - tooltipRect.width / 2;
    // Default: below the home city row
    let top = homeRect.bottom + 10;
    let arrowSide = "down";

    const margin = 12;
    // Clamp horizontally to viewport
    if (left < margin) left = margin;
    if (left + tooltipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tooltipRect.width - margin;
    }
    // If not enough space below, position above
    if (top + tooltipRect.height > window.innerHeight - margin) {
      top = homeRect.top - tooltipRect.height - 10;
      arrowSide = "up";
    }
    // If still not enough space, position at top of viewport
    if (top < margin) top = margin;

    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";

    // Position the arrow at the home tile's center (relative to the tooltip)
    const arrowX = tileRect.left + tileRect.width / 2 - left;
    tooltip.style.setProperty("--wt-tooltip-arrow-left", arrowX + "px");
    tooltip.dataset.arrow = arrowSide;
  }

  // Reposition the tooltip on scroll/resize so it follows the selected column
  function setupTooltipReposition() {
    let lastCol = null;
    function onChange() {
      if (lastCol === null) return;
      positionTooltipAtHomeCol(lastCol);
    }
    // Watch for scroll/resize
    window.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
    // Watch for tile clicks to remember the last selected col
    document.addEventListener("mousedown", (e) => {
      const tile = e.target.closest("[data-tile]");
      if (tile && !tile.classList.contains("past")) {
        const c = parseInt(tile.dataset.col, 10);
        if (!isNaN(c)) lastCol = c;
      }
    });
  }
  // 12/24 hour toggle
  function setupTimeToggle() {
    const btn = document.getElementById("wt-time-toggle");
    if (!btn) return;
    function update() {
      btn.textContent = use24h ? "24h" : "12h";
      btn.classList.toggle("is-24h", use24h);
    }
    update();
    btn.addEventListener("click", () => {
      use24h = !use24h;
      try { localStorage.setItem("tdlWtUse24h", use24h ? "1" : "0"); } catch (e) {}
      update();
      render();
    });
  }

  // Date picker: native <input type="date">
  // Min = yesterday, Max = +1 year. When changed, re-center date tabs and set focusedDate.
  function setupDatePicker() {
    const picker = document.getElementById("wt-date-picker");
    if (!picker) return;
    const today = new Date();
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const max = new Date(today);
    max.setFullYear(max.getFullYear() + 1);
    picker.min = yest.toISOString().slice(0, 10);
    picker.max = max.toISOString().slice(0, 10);
    // Initialize to focusedDate (today by default)
    picker.value = isoDate(focusedDate);
    picker.addEventListener("change", (e) => {
      const val = e.target.value;
      if (!val) return;
      const [y, m, d] = val.split("-").map(Number);
      const picked = new Date(y, m - 1, d, 12, 0, 0, 0); // noon
      focusedDate = picked;
      renderDateTabs();
      render();
    });
  }

  // Helper: format a Date as YYYY-MM-DD (for date picker value)
  function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function setupChipRemove() {
    document.addEventListener("click", (e) => {
      const x = e.target.closest(".wt-city-chip .x");
      if (x) {
        e.stopPropagation();
        const id = parseInt(x.dataset.id, 10);
        removeCity(id);
        return;
      }
      const rowRemove = e.target.closest("[data-row-remove]");
      if (rowRemove) {
        const id = parseInt(rowRemove.dataset.rowRemove, 10);
        removeCity(id);
        return;
      }
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
      suggestions.innerHTML = items.map((c, i) => {
        const state = c.stateCode ? c.stateCode + ", " : "";
        const pop = c.population ? ` · ${(c.population / 1000).toFixed(0)}k people` : "";
        return `
        <div class="wt-suggestion" data-idx="${i}">
          <div>
            <div class="name">${escapeHtml(c.name)}${c.isCapital ? " ★" : ""}</div>
            <div class="meta"><strong>${escapeHtml(state + c.countryName)}</strong> · ${escapeHtml(c.timezone)}${pop}</div>
          </div>
          <span class="plus">+</span>
        </div>
      `;
      }).join("");
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
      // Click on date tab (Jul 17, 18, 19, ...)
      const tab = e.target.closest("[data-idx]");
      if (tab && !e.target.closest("#wt-date-picker")) {
        e.preventDefault();
        const idx = parseInt(tab.dataset.idx, 10);
        // Tabs are -2 to +4 from focusedDate. idx 2 is the selected.
        // Compute the new focusedDate: focusedDate + (idx - 2) days
        const newDate = new Date(focusedDate);
        newDate.setHours(12, 0, 0, 0);
        newDate.setDate(newDate.getDate() + (idx - 2));
        focusedDate = newDate;
        // Re-render date tabs (the selected tab moves to center)
        renderDateTabs();
        // Update the date picker value
        const picker = document.getElementById("wt-date-picker");
        if (picker) picker.value = isoDate(focusedDate);
        // Update the day label
        const userTz = (window.__location && window.__location.timezone) || cities[0]?.timezone || "UTC";
        const dayNameFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][newDate.getDay()];
        $(".wt-cities-head .day-label")?.replaceChildren(document.createTextNode(`${dayNameFull}, ${localDateInCity(userTz, newDate)}`));
        render();
        return;
      }
      // Click on ‹/› pager
      const pager = e.target.closest("[data-pager]");
      if (!pager) return;
      const dir = pager.dataset.pager === "prev" ? -1 : 1;
      focusedDate.setDate(focusedDate.getDate() + dir);
      focusedDate.setHours(12, 0, 0, 0);
      // Re-render (and update today class)
      renderDateTabs();
      // Update the date picker value
      const dp = document.getElementById("wt-date-picker");
      if (dp) dp.value = isoDate(focusedDate);
      // Update the day label
      const userTz = (window.__location && window.__location.timezone) || cities[0]?.timezone || "UTC";
      const dayNameFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][focusedDate.getDay()];
      $(".wt-cities-head .day-label")?.replaceChildren(document.createTextNode(`${dayNameFull}, ${localDateInCity(userTz, focusedDate)}`));
      render();
    });
  }

  // Render the date tabs (re-render when pager changes)
  // Render the date tabs: 7 days centered on focusedDate (-2 to +4)
  // Tab i is at offset (i - 2) from focusedDate.
  // The tab with data-idx=2 is the selected date (highlighted).
  function renderDateTabs() {
    if (window.__wtDebug) console.log("DEBUG renderDateTabs called, focusedDate=", focusedDate);
    const tabs = $("#wt-date-tabs");
    if (!tabs) { if (window.__wtDebug) console.log("DEBUG renderDateTabs: no tabs element"); return; }
    // Start from focusedDate - 2 days
    const start = new Date(focusedDate);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 2);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dow = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      const num = d.getDate();
      const isToday = (d.getTime() === today.getTime());
      const isSelected = (i === 2); // middle tab is the selected
      days.push({ d, dow, num, isToday, isSelected });
    }
    tabs.innerHTML = days.map((day, i) => `
      <div class="wt-date-tab ${day.isSelected ? 'today' : ''}${day.isToday ? ' today-actual' : ''}" data-idx="${i}">
        <span class="dow">${day.dow}</span>
        <span class="num">${day.num}</span>
      </div>
    `).join('');
  }

  // Selection bar actions
  function setupSelectionActions() {
    document.addEventListener("click", (e) => {
      // "Copy link" button in toolbar (always visible)
      const linkView = e.target.closest("[data-action='link-view']");
      if (linkView) {
        e.preventDefault();
        const params = new URLSearchParams();
        if (cities.length) params.set("cities", cities.map(c => c.id).join(","));
        if (selectedRange) params.set("time", `${String(selectedRange.startCol).padStart(2,"0")}:00`);
        const url = window.location.origin + window.location.pathname + "?" + params;
        navigator.clipboard.writeText(url).then(() => {
          const old = linkView.textContent;
          linkView.textContent = "✓ Link copied!";
          setTimeout(() => { linkView.textContent = old; }, 1500);
        });
        return;
      }
      const action = e.target.closest("[data-selection-action]");
      if (!action) return;
      const kind = action.dataset.selectionAction;
      if (kind === "clear") { selectedRange = null; render(); return; }
      // iCal / Google Cal / Clipboard / Gmail — generate from current selection
      if (!selectedRange) return;
      const city = cities.find(c => c.id === (selectedRange.anchorCityId || selectedRange.cityId));
      if (!city) return;
      const startTime = `${String(selectedRange.startCol).padStart(2,"0")}:00`;
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
        params.set("time", `${String(selectedRange.startCol).padStart(2,"0")}:00`);
        const url = window.location.origin + window.location.pathname + "?" + params;
        navigator.clipboard.writeText(url).then(() => {
          const old = action.textContent;
          action.textContent = "✓ Link copied";
          setTimeout(() => { action.textContent = old; }, 1500);
        });
      } else if (kind === "png") {
        saveGridAsPng(action);
      } else if (kind === "share") {
        shareWithImage(action);
      }
    });
  }

  // Save grid as PNG using html2canvas
  async function saveGridAsPng(button) {
    if (typeof html2canvas === "undefined") {
      alert("PNG library loading… try again in a moment.");
      return;
    }
    const oldText = button.textContent;
    button.textContent = "⏳ Generating…";
    button.disabled = true;
    try {
      // Capture the URL bar, main grid, selection bar
      const main = $("#wt-main");
      const urlState = $("#wt-url-state");
      const selBar = $("#wt-selection-bar");
      const chips = $("#wt-city-chips");
      // Build a wrapper for the screenshot
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:fixed;top:0;left:0;background:white;padding:16px;z-index:99999;font-family:system-ui;";
      const titleEl = document.createElement("div");
      titleEl.style.cssText = "font-size:18px;font-weight:800;margin-bottom:4px;color:#1f1a3a;";
      titleEl.textContent = $("h1")?.textContent || "World time";
      const subEl = document.createElement("div");
      subEl.style.cssText = "font-size:12px;color:#777;margin-bottom:8px;";
      subEl.textContent = "dateandtime.live/world-time/";
      const urlEl = document.createElement("div");
      urlEl.style.cssText = "font-size:11px;color:#5b4aaf;margin-bottom:12px;font-family:monospace;";
      urlEl.textContent = window.location.href;
      const mainClone = main.cloneNode(true);
      mainClone.style.borderRadius = "8px";
      mainClone.style.overflow = "hidden";
      const selBarClone = selBar.cloneNode(true);
      selBarClone.style.display = "flex";
      const chipsClone = chips.cloneNode(true);
      const headerEl = document.createElement("div");
      headerEl.style.cssText = "margin-bottom: 12px;";
      headerEl.appendChild(titleEl);
      headerEl.appendChild(subEl);
      headerEl.appendChild(urlEl);
      wrapper.appendChild(headerEl);
      if (chips && chips.children.length > 0) { chipsClone.style.marginBottom = "8px"; wrapper.appendChild(chipsClone); }
      if (selBar && selBar.classList.contains("is-visible")) wrapper.appendChild(selBarClone);
      wrapper.appendChild(mainClone);
      document.body.appendChild(wrapper);
      const canvas = await html2canvas(wrapper, { backgroundColor: "#ffffff", scale: 2, logging: false });
      document.body.removeChild(wrapper);
      canvas.toBlob(blob => {
        const dayLabel = $("#wt-day-label")?.textContent || "schedule";
        const filename = `worldtime-${dayLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        button.textContent = "✓ Saved!";
        setTimeout(() => { button.textContent = oldText; button.disabled = false; }, 1500);
      });
    } catch (e) {
      console.error("PNG export failed", e);
      button.textContent = "✗ Failed";
      setTimeout(() => { button.textContent = oldText; button.disabled = false; }, 2000);
    }
  }

  // Web Share API (mobile) or download + copy URL (desktop)
  async function shareWithImage(button) {
    if (typeof html2canvas === "undefined") {
      alert("Library loading… try again in a moment.");
      return;
    }
    const oldText = button.textContent;
    button.textContent = "⏳ Generating…";
    button.disabled = true;
    try {
      const canvas = await generateShareCanvas();
      const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
      const params = new URLSearchParams();
      if (cities.length) params.set("cities", cities.map(c => c.id).join(","));
      if (selectedRange) params.set("time", `${String(selectedRange.startCol).padStart(2,"0")}:00`);
      const shareUrl = window.location.origin + window.location.pathname + "?" + params;
      const shareData = {
        title: "World Time schedule",
        text: cities.map(c => c.name).join(", ") + " meeting schedule",
        url: shareUrl
      };
      const file = new File([blob], "worldtime-schedule.png", { type: "image/png" });
      // Try Web Share API with file (mobile)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ ...shareData, files: [file] });
          button.textContent = "✓ Shared!";
        } catch (e) {
          if (e.name !== "AbortError") throw e;
        }
      } else {
        // Desktop fallback: download + copy URL
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "worldtime-schedule.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await navigator.clipboard.writeText(shareUrl);
        button.textContent = "✓ Saved + link copied!";
      }
      setTimeout(() => { button.textContent = oldText; button.disabled = false; }, 2000);
    } catch (e) {
      console.error("Share failed", e);
      button.textContent = "✗ Failed";
      setTimeout(() => { button.textContent = oldText; button.disabled = false; }, 2000);
    }
  }

  // Reuse the same canvas-building logic
  async function generateShareCanvas() {
    const main = $("#wt-main");
    const selBar = $("#wt-selection-bar");
    const chips = $("#wt-city-chips");
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:fixed;top:0;left:0;background:white;padding:16px;z-index:99999;font-family:system-ui;";
    const titleEl = document.createElement("div");
    titleEl.style.cssText = "font-size:18px;font-weight:800;margin-bottom:4px;color:#1f1a3a;";
    titleEl.textContent = $("h1")?.textContent || "World time";
    const subEl = document.createElement("div");
    subEl.style.cssText = "font-size:12px;color:#777;margin-bottom:8px;";
    subEl.textContent = "dateandtime.live/world-time/";
    const headerEl = document.createElement("div");
    headerEl.style.cssText = "margin-bottom: 12px;";
    headerEl.appendChild(titleEl);
    headerEl.appendChild(subEl);
    wrapper.appendChild(headerEl);
    if (chips && chips.children.length > 0) {
      const chipsClone = chips.cloneNode(true);
      chipsClone.style.marginBottom = "8px";
      wrapper.appendChild(chipsClone);
    }
    if (selBar && selBar.classList.contains("is-visible")) {
      const selBarClone = selBar.cloneNode(true);
      selBarClone.style.display = "flex";
      wrapper.appendChild(selBarClone);
    }
    const mainClone = main.cloneNode(true);
    mainClone.style.borderRadius = "8px";
    mainClone.style.overflow = "hidden";
    wrapper.appendChild(mainClone);
    document.body.appendChild(wrapper);
    const canvas = await html2canvas(wrapper, { backgroundColor: "#ffffff", scale: 2, logging: false });
    document.body.removeChild(wrapper);
    return canvas;
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
    // Load 12/24 preference
    try { use24h = localStorage.getItem("tdlWtUse24h") === "1"; } catch (e) {}
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
        const col = h; selectedRange = { anchorCityId: cities[0].id, startCol: col, endCol: col };
        showSelectionBar();
      }
    }

    saveToStorage();
    render();
    renderDateTabs();
    if (window.__wtDebug) console.log("DEBUG init: renderDateTabs called, focusedDate=", focusedDate, "tabs element:", document.getElementById("wt-date-tabs")?.children.length);

    // 5. Wire up interactions
    setupSearch();
    setupDragSelect();
    setupHoverColumn();
    setupTileTooltip();
    setupTooltipReposition();
    setupChipRemove();
    setupTimeToggle();
    setupDatePicker();
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
