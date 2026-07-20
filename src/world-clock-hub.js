/* dateandtime.live — World Clock hub
 * Displays live current time in 12 major cities (one per continent / region)
 * Updates every second via requestAnimationFrame
 */
(function () {
  "use strict";

  // Top 12 cities for the world clock hub — one per major region
  const FEATURED_CITIES = [
    { id: 5128581, name: "New York",    country: "United States", flag: "🇺🇸", tz: "America/New_York" },
    { id: 2643743, name: "London",      country: "United Kingdom", flag: "🇬🇧", tz: "Europe/London" },
    { id: 1850147, name: "Tokyo",       country: "Japan", flag: "🇯🇵", tz: "Asia/Tokyo" },
    { id: 1275339, name: "Mumbai",      country: "India", flag: "🇮🇳", tz: "Asia/Kolkata" },
    { id: 3435907, name: "Buenos Aires",country: "Argentina", flag: "🇦🇷", tz: "America/Argentina/Buenos_Aires" },
    { id: 293397,  name: "Dubai",       country: "UAE", flag: "🇦🇪", tz: "Asia/Dubai" },
    { id: 1796236, name: "Shanghai",    country: "China", flag: "🇨🇳", tz: "Asia/Shanghai" },
    { id: 2147714, name: "Sydney",      country: "Australia", flag: "🇦🇺", tz: "Australia/Sydney" },
    { id: 993800,  name: "Johannesburg",country: "South Africa", flag: "🇿🇦", tz: "Africa/Johannesburg" },
    { id: 2988507, name: "Paris",       country: "France", flag: "🇫🇷", tz: "Europe/Paris" },
    { id: 6167865, name: "Toronto",     country: "Canada", flag: "🇨🇦", tz: "America/Toronto" },
    { id: 3451190, name: "Rio de Janeiro", country: "Brazil", flag: "🇧🇷", tz: "America/Sao_Paulo" }
  ];

  function fmtClock(date, tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true
      }).formatToParts(date);
      const h = parts.find(p => p.type === "hour")?.value || "00";
      const m = parts.find(p => p.type === "minute")?.value || "00";
      const s = parts.find(p => p.type === "second")?.value || "00";
      const p = parts.find(p => p.type === "dayPeriod")?.value || "";
      return { h, m, s, p };
    } catch (e) { return { h: "--", m: "--", s: "--", p: "" }; }
  }

  function fmtOffset(tz, date) {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
      const parts = fmt.formatToParts(date);
      const offset = parts.find(p => p.type === "timeZoneName")?.value || "";
      return offset.replace("GMT", "UTC");
    } catch (e) { return ""; }
  }

  function fmtDate(tz, date) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz, weekday: "short", month: "short", day: "numeric"
      }).format(date);
    } catch (e) { return ""; }
  }

  function buildGrid() {
    const grid = document.getElementById("wt-clock-grid");
    if (!grid) return;
    grid.innerHTML = FEATURED_CITIES.map(c => `
      <div class="wt-clock-card" data-tz="${c.tz}">
        <div class="wt-clock-flag">${c.flag}</div>
        <div class="wt-clock-body">
          <div class="wt-clock-name">${c.name}</div>
          <div class="wt-clock-country">${c.country}</div>
          <div class="wt-clock-time-row">
            <span class="live-dot"></span>
            <span class="wt-clock-time" data-clock-tz="${c.tz}">--:--:--</span>
            <span class="wt-clock-period" data-period-tz="${c.tz}"></span>
          </div>
          <div class="wt-clock-meta">
            <span class="wt-clock-date" data-date-tz="${c.tz}">--</span>
            <span class="wt-clock-offset" data-offset-tz="${c.tz}"></span>
          </div>
        </div>
      </div>
    `).join("");
  }

  let rafId = null;
  function tick() {
    const now = new Date();
    document.querySelectorAll("[data-clock-tz]").forEach(el => {
      const tz = el.dataset.clockTz;
      const t = fmtClock(now, tz);
      el.textContent = `${t.h}:${t.m}:${t.s}`;
      const periodEl = document.querySelector(`[data-period-tz="${tz}"]`);
      if (periodEl) periodEl.textContent = t.p;
      const dateEl = document.querySelector(`[data-date-tz="${tz}"]`);
      if (dateEl) dateEl.textContent = fmtDate(tz, now);
      const offsetEl = document.querySelector(`[data-offset-tz="${tz}"]`);
      if (offsetEl) offsetEl.textContent = fmtOffset(tz, now);
    });
    rafId = requestAnimationFrame(tick);
  }

  function init() {
    buildGrid();
    if (document.querySelector("[data-clock-tz]")) {
      tick();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
