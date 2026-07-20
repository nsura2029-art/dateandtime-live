/* dateandtime.live — Country page live clock
 * Updates the live time in country clock cards and capital time pill every second
 */
(function () {
  "use strict";

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

  function fmtCapitalTime(date, tz) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true
      }).format(date);
    } catch (e) { return "—"; }
  }

  let rafId = null;
  function tick() {
    const now = new Date();

    // Update capital time pill
    document.querySelectorAll(".live-cap-time").forEach(el => {
      const tz = el.dataset.liveTz;
      if (tz) el.textContent = fmtCapitalTime(now, tz);
    });

    // Update city clock cards
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
    if (document.querySelector("[data-clock-tz]") || document.querySelector(".live-cap-time")) {
      tick();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
