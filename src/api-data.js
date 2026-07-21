/* =====================================================================
 * dateandtime.live — shared client-side API helper
 * Used by Tier 2 + Tier 3 homepage sections (chip cloud, snapshot, long
 * weekend finder, did-you-know, birthdays, deaths, year timeline, etc).
 *
 * Exposes a single global: window.DTData
 *
 * Design:
 *  - One CDN-style helper for every fetch the homepage JS needs.
 *  - Built-in 5-min in-memory cache so re-fetches (e.g. when navigating
 *    back to the page within the same session) don't hit the API.
 *  - Best-effort: a network/parse error returns null — the caller decides
 *    how to fall back (e.g. show "—" or hide the section).
 *  - Same-origin in dev (Workers proxy), cross-origin in prod.
 *
 * Endpoint catalog (mirrored from cloudflare/datetime-api/worker.js):
 *   GET /api/v1/holidays/today?country={cc}
 *   GET /api/v1/holidays/upcoming?country={cc}&days=N
 *   GET /api/v1/onthisday?month={M}&day={D}
 *   GET /api/v1/onthisday/today?country={cc}
 *   GET /api/v1/dst/upcoming?tz={iana}
 *   GET /api/v1/countries/{cc}/working-hours
 *   GET /api/v1/time/sun?lat={lat}&lon={lon}&date={YYYY-MM-DD}
 *   GET /api/v1/time/now/multi?ids=... (or ?timezones=...)
 *   GET /api/v1/person/today?type={birth|death}&limit={N}
 *   GET /api/v1/person/{slug}
 *   GET /api/v1/year/{year}/timeline
 *   GET /api/v1/year/{year}?month={M}&day={D}
 *   GET /api/v1/snapshot?country={cc}
 *   GET /api/v1/holidays?country={cc}&year={YYYY}
 * ===================================================================== */
(function () {
  "use strict";

  // ---- API base detection (matches the inline homepage logic) ---------
  const API = (function () {
    const h = location.hostname;
    if (h === "dateandtime.live" || h.endsWith(".dateandtime.live")) return "https://api.dateandtime.live";
    if (h.endsWith(".workers.dev")) return "https://dev.api.dateandtime.live";
    return ""; // same-origin (Worker proxy in dev)
  })();

  // ---- 5-minute in-memory cache ---------------------------------------
  const _cache = new Map();
  const TTL_MS = 5 * 60 * 1000;
  function _cacheKey(path, params) {
    if (!params) return path;
    const keys = Object.keys(params).sort();
    const qs = keys.map(k => `${k}=${encodeURIComponent(params[k] ?? "")}`).join("&");
    return qs ? `${path}?${qs}` : path;
  }
  function _cacheGet(key) {
    const hit = _cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > TTL_MS) {
      _cache.delete(key);
      return null;
    }
    return hit.v;
  }
  function _cacheSet(key, v) { _cache.set(key, { v, t: Date.now() }); }

  // ---- core fetch ----------------------------------------------------
  async function get(path, params, opts) {
    const key = _cacheKey(path, params);
    if (!opts || !opts.nocache) {
      const hit = _cacheGet(key);
      if (hit) return hit;
    }
    try {
      const url = (API || "") + key;
      const r = await fetch(url, { cache: opts && opts.nocache ? "no-store" : "default" });
      if (!r.ok) return null;
      const json = await r.json();
      // API responses are wrapped: { success: true, data: ... }
      const data = json && typeof json === "object" && "data" in json ? json.data : json;
      _cacheSet(key, data);
      return data;
    } catch (_e) {
      return null;
    }
  }

  // ---- convenience endpoints ----------------------------------------
  async function getHolidaysToday(country) {
    return get("/api/v1/holidays/today", { country });
  }
  async function getHolidaysUpcoming(country, days) {
    return get("/api/v1/holidays/upcoming", { country, days: days || 30 });
  }
  async function getHolidaysForYear(country, year) {
    return get("/api/v1/holidays", { country, year });
  }
  async function getOnThisDay(month, day) {
    return get("/api/v1/onthisday", { month, day });
  }
  async function getOnThisDayToday(country) {
    return get("/api/v1/onthisday/today", { country });
  }
  async function getDSTUpcoming(tz) {
    return get("/api/v1/dst/upcoming", { tz });
  }
  async function getWorkingHours(cca2) {
    return get(`/api/v1/countries/${encodeURIComponent(cca2)}/working-hours`);
  }
  async function getSun(lat, lon, date) {
    return get("/api/v1/time/sun", { lat, lon, date });
  }
  async function getTimeNow(timezones) {
    const tz = Array.isArray(timezones) ? timezones.join(",") : timezones;
    return get("/api/v1/time/now/multi", { timezones: tz });
  }
  async function getPersonToday(opts) {
    const o = opts || {};
    return get("/api/v1/person/today", {
      type: o.type,         // "birth" | "death"
      status: o.status,     // "living" | "deceased"
      limit: o.limit || 6
    });
  }
  async function getPerson(slug) {
    return get(`/api/v1/person/${encodeURIComponent(slug)}`);
  }
  async function getYearTimeline(year) {
    return get(`/api/v1/year/${encodeURIComponent(year)}/timeline`);
  }
  async function getYearMonthDay(year, month, day) {
    return get(`/api/v1/year/${encodeURIComponent(year)}`, { month, day });
  }
  async function getSnapshot(country) {
    return get("/api/v1/snapshot", { country });
  }

  // ---- long weekend algorithm (client-side, no API call needed) ------
  // Given a list of holidays for a year (Nager.Date format), compute
  // long weekends: clusters of 3+ consecutive non-working days starting
  // on a Friday or ending on a Monday.
  // We accept either raw Nager.Date format [{date, name, ...}]
  // or our wrapped format {holidays: [...]}
  function computeLongWeekends(holidays, opts) {
    const o = opts || {};
    const minDays = o.minDays || 3;
    const year = o.year || new Date().getFullYear();

    // Normalize: extract {date: 'YYYY-MM-DD', name}
    const list = (Array.isArray(holidays) ? holidays : (holidays && holidays.holidays) || [])
      .map(h => ({
        date: (h.date || "").slice(0, 10),
        name: h.name || h.localName || "Holiday"
      }))
      .filter(h => h.date && h.date.startsWith(String(year)))
      .map(h => ({ ...h, _d: new Date(h.date + "T00:00:00Z") }))
      .sort((a, b) => a._d - b._d);

    if (list.length === 0) return [];

    // Build a set of YYYY-MM-DD that are holidays
    const holidayDays = new Set(list.map(h => h.date));
    // Identify each day of the year as weekend (Sat/Sun), holiday, or work
    // A "long weekend" = >= minDays consecutive non-work days that include at
    // least one weekend OR a single holiday on Tue/Wed/Thu (those are usually
    // not "long weekends" but we'll keep them in the data for completeness).

    // Walk the year day by day, group consecutive non-work days.
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));
    const groups = [];
    let cur = null;
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
      const iso = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay(); // 0=Sun, 6=Sat
      const isHoliday = holidayDays.has(iso);
      const isWeekend = dow === 0 || dow === 6;
      const isWork = !isWeekend && !isHoliday;
      if (!isWork) {
        if (!cur) cur = { start: iso, end: iso, days: [], holiday: isHoliday, dowStart: dow };
        cur.end = iso;
        cur.days.push({ date: iso, holiday: isHoliday, weekend: isWeekend });
      } else {
        if (cur) { groups.push(cur); cur = null; }
      }
    }
    if (cur) groups.push(cur);

    // Each group's "length" in days
    const enriched = groups
      .map(g => {
        const a = new Date(g.start + "T00:00:00Z");
        const b = new Date(g.end + "T00:00:00Z");
        const len = Math.round((b - a) / 86400000) + 1;
        // Find the holiday that anchors this group (if any)
        const anchor = g.days.find(x => x.holiday);
        // Name based on anchor or first day
        const name = anchor ? list.find(h => h.date === anchor.date).name : "Weekend";
        return {
          start: g.start,
          end: g.end,
          days: len,
          name,
          anchor: anchor ? anchor.date : null
        };
      })
      .filter(g => g.days >= minDays)
      .sort((a, b) => a.start.localeCompare(b.start));

    return enriched;
  }

  // ---- DOM helpers ---------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function setHTML(el, html) { if (el) el.innerHTML = html; }
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00Z");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  function fmtDateRange(a, b) {
    if (!a || !b) return a || b || "";
    if (a === b) return fmtDate(a);
    const da = new Date(a + "T00:00:00Z");
    const db = new Date(b + "T00:00:00Z");
    const sameMonth = da.getUTCMonth() === db.getUTCMonth();
    if (sameMonth) {
      return da.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
        + " – " + db.getUTCDate();
    }
    return fmtDate(a) + " – " + fmtDate(b);
  }
  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---- expose --------------------------------------------------------
  window.DTData = {
    API,
    get,
    getHolidaysToday,
    getHolidaysUpcoming,
    getHolidaysForYear,
    getOnThisDay,
    getOnThisDayToday,
    getDSTUpcoming,
    getWorkingHours,
    getSun,
    getTimeNow,
    getPersonToday,
    getPerson,
    getYearTimeline,
    getYearMonthDay,
    getSnapshot,
    computeLongWeekends,
    $,
    $$,
    setHTML,
    fmtDate,
    fmtDateRange,
    esc
  };
})();
