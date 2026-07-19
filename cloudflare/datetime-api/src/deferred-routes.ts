/**
 * Deferred API routes — Phases 2, 4, 6, 7 of the shared DB
 * Locked 2026-07-19
 *
 * These endpoints expose the data layer shipped for the 4 phases.
 * All read from the timeanddatepro-full D1.
 *
 * Endpoints (all GET unless noted):
 *   /api/v1/holidays/today?country=US       — today's holidays
 *   /api/v1/holidays/upcoming?country&days  — upcoming holidays
 *   /api/v1/holidays?country&year           — holidays for a year
 *   /api/v1/countries/:cca2/working-hours   — business calendar
 *   /api/v1/onthisday?month&day             — on-this-day events
 *   /api/v1/dst/upcoming?tz=Europe/London   — next DST transition
 *   /api/v1/cities/:id/climate?month        — climate for a city
 *   /api/v1/cities/:id/aliases              — historical place_redirects
 *   /api/v1/countries/:cca2/cities?admin1   — cities in a country
 *   /api/v1/admin/data-quality              — run data quality checks
 *   POST /api/v1/feedback/:id/vote          — vote on feedback
 *   /api/v1/feedback/top                    — top voted feedback
 */

import { Hono } from "hono";
import type { Env } from "./index";

export const deferred = new Hono<{ Bindings: Env }>();

interface HolidayRow {
  id: number;
  country_code: string;
  region_code: string | null;
  city_id: number | null;
  name: string;
  type: string;
  date: string;
  observed_date: string | null;
  year: number;
  fixed: number;
  global_holiday: number;
  launch_year: number | null;
  source: string;
  confidence: number;
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// Holidays (Phase 2)
// ============================================================

deferred.get("/holidays/today", async (c) => {
  const country = c.req.query("country")?.toUpperCase();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  let sql = `SELECT id, country_code, region_code, city_id, name, type, date,
             observed_date, year, fixed, global_holiday, launch_year, source, confidence
             FROM holidays
             WHERE (date = ? OR observed_date = ?)`;
  const params: (string | number)[] = [today, today];

  if (country) {
    sql += ` AND country_code = ?`;
    params.push(country);
  }

  sql += ` ORDER BY global_holiday DESC, country_code, name LIMIT 200`;

  const rows = await c.env.DB.prepare(sql).bind(...params).all<HolidayRow>();

  return c.json({
    success: true,
    data: {
      date: today,
      country: country ?? null,
      holidays: rows.results,
      count: rows.results.length,
    },
  });
});

deferred.get("/holidays/upcoming", async (c) => {
  const country = c.req.query("country")?.toUpperCase();
  const days = parseInt(c.req.query("days") ?? "30", 10);
  if (isNaN(days) || days < 1 || days > 365) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "days must be 1-365" } }, 400);
  }
  const limit = parseInt(c.req.query("limit") ?? "50", 10);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const future = new Date(now.getTime() + days * 86400 * 1000);
  const futureStr = future.toISOString().slice(0, 10);

  let sql = `SELECT id, country_code, region_code, name, type, date, observed_date,
             year, fixed, global_holiday, source
             FROM holidays
             WHERE date >= ? AND date <= ?`;
  const params: (string | number)[] = [today, futureStr];

  if (country) {
    sql += ` AND country_code = ?`;
    params.push(country);
  }

  sql += ` ORDER BY date ASC, global_holiday DESC LIMIT ?`;
  params.push(Math.min(limit, 200));

  const rows = await c.env.DB.prepare(sql).bind(...params).all<HolidayRow>();

  return c.json({
    success: true,
    data: {
      from: today,
      to: futureStr,
      days,
      country: country ?? null,
      holidays: rows.results,
      count: rows.results.length,
    },
  });
});

deferred.get("/holidays", async (c) => {
  const country = c.req.query("country")?.toUpperCase();
  const year = parseInt(c.req.query("year") ?? new Date().getFullYear().toString(), 10);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "year must be 1900-2100" } }, 400);
  }

  let sql = `SELECT id, country_code, region_code, name, type, date, observed_date,
             year, fixed, global_holiday, source
             FROM holidays WHERE year = ?`;
  const params: (string | number)[] = [year];

  if (country) {
    sql += ` AND country_code = ?`;
    params.push(country);
  }

  sql += ` ORDER BY date, country_code, name LIMIT 1000`;

  const rows = await c.env.DB.prepare(sql).bind(...params).all<HolidayRow>();

  return c.json({
    success: true,
    data: {
      year,
      country: country ?? null,
      holidays: rows.results,
      count: rows.results.length,
    },
  });
});

// ============================================================
// Working hours (Phase 2)
// ============================================================

deferred.get("/countries/:cca2/working-hours", async (c) => {
  const cca2 = c.req.param("cca2").toUpperCase();
  const region = c.req.query("region")?.toUpperCase();

  const country = await c.env.DB
    .prepare(`SELECT cca2, name, capital, continent, start_of_week FROM countries WHERE cca2 = ?`)
    .bind(cca2)
    .first<{ cca2: string; name: string; capital: string | null; continent: string | null; start_of_week: string | null }>();

  if (!country) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: `Country ${cca2} not found` } }, 404);
  }

  let sql = `SELECT country_code, region_code, work_days, work_open_hour, work_close_hour,
             work_lunch_break_hours, lunch_start_hour, friday_close_hour, siesta_countries, source, notes
             FROM business_calendars WHERE country_code = ?`;
  const params: string[] = [cca2];
  if (region) {
    sql += ` AND (region_code = ? OR region_code IS NULL)`;
    params.push(region);
  } else {
    sql += ` AND region_code IS NULL`;
  }
  sql += ` LIMIT 1`;

  const cal = await c.env.DB.prepare(sql).bind(...params).first<{
    country_code: string;
    region_code: string | null;
    work_days: string;
    work_open_hour: number;
    work_close_hour: number;
    work_lunch_break_hours: number;
    lunch_start_hour: number | null;
    friday_close_hour: number | null;
    siesta_countries: number;
    source: string;
    notes: string | null;
  }>();

  const workDays: number[] = cal ? JSON.parse(cal.work_days) : [1, 2, 3, 4, 5];
  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return c.json({
    success: true,
    data: {
      country: {
        cca2: country.cca2,
        name: country.name,
        capital: country.capital,
        continent: country.continent,
        startOfWeek: country.start_of_week,
      },
      region: region ?? null,
      workDays: workDays.map((d) => dayNames[d] ?? `day_${d}`),
      hours: {
        open: cal?.work_open_hour ?? 9,
        close: cal?.work_close_hour ?? 17,
        lunchBreakHours: cal?.work_lunch_break_hours ?? 1,
        lunchStartHour: cal?.lunch_start_hour ?? null,
        fridayCloseHour: cal?.friday_close_hour ?? null,
      },
      siesta: cal?.siesta_countries === 1,
      source: cal?.source ?? "default",
      notes: cal?.notes ?? null,
    },
  });
});

// ============================================================
// On this day (Phase 2)
// ============================================================

deferred.get("/onthisday", async (c) => {
  const month = parseInt(c.req.query("month") ?? (new Date().getMonth() + 1).toString(), 10);
  const day = parseInt(c.req.query("day") ?? new Date().getDate().toString(), 10);

  if (isNaN(month) || month < 1 || month > 12) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "month must be 1-12" } }, 400);
  }
  if (isNaN(day) || day < 1 || day > 31) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "day must be 1-31" } }, 400);
  }

  const rows = await c.env.DB
    .prepare(`SELECT id, month, day, year, title, description, category, source, confidence
              FROM onthisday WHERE month = ? AND day = ?
              ORDER BY year DESC, id LIMIT 50`)
    .bind(month, day)
    .all<{ id: number; month: number; day: number; year: number | null; title: string; description: string | null; category: string; source: string; confidence: number }>();

  return c.json({
    success: true,
    data: {
      month,
      day,
      events: rows.results,
      count: rows.results.length,
    },
  });
});

// ============================================================
// DST (Phase 4)
// ============================================================

deferred.get("/dst/upcoming", async (c) => {
  const tz = c.req.query("tz");
  if (!tz) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "tz query param required (IANA timezone, e.g. Europe/London)" } }, 400);
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const thisYear = await c.env.DB
    .prepare(`SELECT tz_id, year, spring_forward_date, spring_forward_offset_before, spring_forward_offset_after,
              fall_back_date, fall_back_offset_before, fall_back_offset_after, dst_observed
              FROM dst_transitions WHERE tz_id = ? AND year = ?`)
    .bind(tz, currentYear)
    .first<{
      tz_id: string; year: number;
      spring_forward_date: string | null;
      spring_forward_offset_before: string | null;
      spring_forward_offset_after: string | null;
      fall_back_date: string | null;
      fall_back_offset_before: string | null;
      fall_back_offset_after: string | null;
      dst_observed: number;
    }>();

  if (!thisYear) {
    return c.json({
      success: true,
      data: {
        tz,
        currentYear,
        nextTransition: null,
        note: "DST data not available for this timezone",
      },
    });
  }

  const today = now.toISOString().slice(0, 10);
  let nextTransition: Record<string, unknown> | null = null;

  if (thisYear.spring_forward_date && thisYear.spring_forward_date >= today) {
    nextTransition = {
      type: "spring_forward",
      date: thisYear.spring_forward_date,
      offsetBefore: thisYear.spring_forward_offset_before,
      offsetAfter: thisYear.spring_forward_offset_after,
    };
  } else if (thisYear.fall_back_date && thisYear.fall_back_date >= today) {
    nextTransition = {
      type: "fall_back",
      date: thisYear.fall_back_date,
      offsetBefore: thisYear.fall_back_offset_before,
      offsetAfter: thisYear.fall_back_offset_after,
    };
  } else {
    const nextYearRow = await c.env.DB
      .prepare(`SELECT spring_forward_date, spring_forward_offset_before, spring_forward_offset_after,
                fall_back_date, fall_back_offset_before, fall_back_offset_after
                FROM dst_transitions WHERE tz_id = ? AND year = ?`)
      .bind(tz, currentYear + 1)
      .first<{
        spring_forward_date: string | null;
        spring_forward_offset_before: string | null;
        spring_forward_offset_after: string | null;
        fall_back_date: string | null;
        fall_back_offset_before: string | null;
        fall_back_offset_after: string | null;
      }>();

    if (nextYearRow?.spring_forward_date) {
      nextTransition = {
        type: "spring_forward",
        date: nextYearRow.spring_forward_date,
        offsetBefore: nextYearRow.spring_forward_offset_before,
        offsetAfter: nextYearRow.spring_forward_offset_after,
        note: "next year",
      };
    }
  }

  return c.json({
    success: true,
    data: {
      tz,
      currentYear,
      dstObserved: thisYear.dst_observed === 1,
      nextTransition,
    },
  });
});

// ============================================================
// Climate (Phase 4)
// ============================================================

deferred.get("/cities/:id/climate", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "id must be integer (geoname_id)" } }, 400);
  }
  const monthParam = c.req.query("month");
  const month = monthParam ? parseInt(monthParam, 10) : null;
  if (month !== null && (isNaN(month) || month < 1 || month > 12)) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "month must be 1-12" } }, 400);
  }

  const city = await c.env.DB
    .prepare(`SELECT geoname_id, name, country_code, latitude, longitude FROM cities WHERE geoname_id = ?`)
    .bind(id)
    .first<{ geoname_id: number; name: string; country_code: string; latitude: number; longitude: number }>();

  if (!city) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: `City ${id} not found` } }, 404);
  }

  let sql = `SELECT city_id, month, avg_high_c, avg_low_c, avg_mean_c, rainy_days,
             avg_precipitation_mm, daylight_hours, climate_class, source, confidence
             FROM climate_summaries WHERE city_id = ?`;
  const params: number[] = [id];
  if (month !== null) {
    sql += ` AND month = ?`;
    params.push(month);
  }
  sql += ` ORDER BY month`;

  const rows = await c.env.DB.prepare(sql).bind(...params).all<{
    city_id: number; month: number;
    avg_high_c: number; avg_low_c: number; avg_mean_c: number;
    rainy_days: number; avg_precipitation_mm: number;
    daylight_hours: number; climate_class: string;
    source: string; confidence: number;
  }>();

  const seasons = await c.env.DB
    .prepare(`SELECT season, start_month, end_month, avg_temp_c, source FROM seasons WHERE city_id = ? ORDER BY start_month`)
    .bind(id)
    .all<{ season: string; start_month: number; end_month: number; avg_temp_c: number | null; source: string }>();

  return c.json({
    success: true,
    data: {
      city: {
        id: city.geoname_id,
        name: city.name,
        countryCode: city.country_code,
        latitude: city.latitude,
        longitude: city.longitude,
      },
      climate: rows.results,
      seasons: seasons.results,
      count: rows.results.length,
    },
  });
});

// ============================================================
// Place redirects / aliases (Phase 6)
// ============================================================

deferred.get("/cities/:id/aliases", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "id must be integer (geoname_id)" } }, 400);
  }

  const city = await c.env.DB
    .prepare(`SELECT geoname_id, name, ascii_name, country_code FROM cities WHERE geoname_id = ?`)
    .bind(id)
    .first<{ geoname_id: number; name: string; ascii_name: string; country_code: string }>();

  if (!city) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: `City ${id} not found` } }, 404);
  }

  const aliases = await c.env.DB
    .prepare(`SELECT alias, type, locale FROM city_aliases WHERE city_id = ? ORDER BY type, alias`)
    .bind(id)
    .all<{ alias: string; type: string; locale: string | null }>();

  const redirects = await c.env.DB
    .prepare(`SELECT old_name, year_from, year_to, reason, source, confidence
              FROM place_redirects WHERE city_id = ? ORDER BY year_from`)
    .bind(id)
    .all<{ old_name: string; year_from: number | null; year_to: number | null; reason: string | null; source: string; confidence: number }>();

  return c.json({
    success: true,
    data: {
      city: {
        id: city.geoname_id,
        name: city.name,
        asciiName: city.ascii_name,
        countryCode: city.country_code,
      },
      aliases: aliases.results,
      historicalNames: redirects.results,
    },
  });
});

// ============================================================
// Cities by country
// ============================================================

deferred.get("/countries/:cca2/cities", async (c) => {
  const cca2 = c.req.param("cca2").toUpperCase();
  const admin1 = c.req.query("admin1")?.toUpperCase();
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10), 1000);

  const country = await c.env.DB
    .prepare(`SELECT cca2, name FROM countries WHERE cca2 = ?`)
    .bind(cca2)
    .first<{ cca2: string; name: string }>();

  if (!country) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: `Country ${cca2} not found` } }, 404);
  }

  let sql = `SELECT geoname_id, name, ascii_name, country_code, country_name, admin1_code,
             admin2_code, latitude, longitude, timezone, population, elevation, feature_code, is_capital,
             (SELECT GROUP_CONCAT(alias, ',') FROM city_aliases WHERE city_id = c.geoname_id) AS aliases
             FROM cities c WHERE country_code = ?`;
  const params: (string | number)[] = [cca2];

  if (admin1) {
    sql += ` AND admin1_code = ?`;
    params.push(admin1);
  }

  sql += ` ORDER BY population DESC LIMIT ?`;
  params.push(limit);

  const rows = await c.env.DB.prepare(sql).bind(...params).all<{
    geoname_id: number; name: string; ascii_name: string;
    country_code: string; country_name: string;
    admin1_code: string | null; admin2_code: string | null;
    latitude: number; longitude: number; timezone: string;
    population: number; elevation: number | null;
    feature_code: string | null; is_capital: number | null;
    aliases: string | null;
  }>();

  const cities = rows.results.map((r) => ({
    id: r.geoname_id,
    name: r.name,
    asciiName: r.ascii_name,
    countryCode: r.country_code,
    countryName: r.country_name,
    stateCode: r.admin1_code,
    admin2Code: r.admin2_code,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    population: r.population,
    elevation: r.elevation,
    featureCode: r.feature_code,
    isCapital: r.is_capital === 1,
    aliases: r.aliases ? r.aliases.split(",") : [],
  }));

  return c.json({
    success: true,
    data: {
      country: country.cca2,
      admin1: admin1 ?? null,
      cities,
      count: cities.length,
      limit,
    },
  });
});

// ============================================================
// Data quality (Phase 7)
// ============================================================

interface QualityCheck {
  id: string;
  name: string;
  description: string | null;
  category: string;
  sql_query: string;
  severity: string;
  enabled: number;
}

deferred.get("/admin/data-quality", async (c) => {
  const checks = await c.env.DB
    .prepare(`SELECT id, name, description, category, sql_query, severity, enabled
              FROM data_quality_checks WHERE enabled = 1
              ORDER BY severity DESC, category, name`)
    .all<QualityCheck>();

  const results: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string;
    severity: string;
    issueCount: number;
    sampleIssues: unknown[];
  }> = [];

  for (const check of checks.results) {
    try {
      const issues = await c.env.DB
        .prepare(check.sql_query)
        .all<unknown>();
      results.push({
        id: check.id,
        name: check.name,
        description: check.description,
        category: check.category,
        severity: check.severity,
        issueCount: issues.results.length,
        sampleIssues: issues.results.slice(0, 5),
      });
    } catch (e) {
      results.push({
        id: check.id,
        name: check.name,
        description: check.description,
        category: check.category,
        severity: check.severity,
        issueCount: -1,
        sampleIssues: [{ error: (e as Error).message }],
      });
    }
  }

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.issueCount === 0).length,
    warn: results.filter((r) => r.severity === "warn" && r.issueCount > 0).length,
    error: results.filter((r) => r.severity === "error" && r.issueCount > 0).length,
  };

  return c.json({
    success: true,
    data: {
      summary,
      checks: results,
    },
  });
});

// ============================================================
// Feedback votes (Phase 7)
// ============================================================

deferred.post("/feedback/:id/vote", async (c) => {
  const id = c.req.param("id");
  if (!id || !/^\d+$/.test(id)) {
    return c.json({ success: false, error: { code: "BAD_REQUEST", message: "id must be integer" } }, 400);
  }

  const fb = await c.env.DB
    .prepare(`SELECT id, votes FROM feedback WHERE id = ?`)
    .bind(id)
    .first<{ id: number; votes: number }>();

  if (!fb) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: `Feedback ${id} not found` } }, 404);
  }

  // Hash IP+UA for voter identity (no PII stored)
  const ip = c.req.header("cf-connecting-ip") ?? "anon";
  const ua = c.req.header("user-agent") ?? "";
  const voterHash = await sha256(`${ip}:${ua}`);

  try {
    await c.env.DB
      .prepare(`INSERT INTO feedback_votes (feedback_id, voter_hash) VALUES (?, ?)`)
      .bind(id, voterHash)
      .run();

    await c.env.DB
      .prepare(`UPDATE feedback SET votes = votes + 1, updated_at = ? WHERE id = ?`)
      .bind(Math.floor(Date.now() / 1000), id)
      .run();

    const updated = await c.env.DB
      .prepare(`SELECT id, votes FROM feedback WHERE id = ?`)
      .bind(id)
      .first<{ id: number; votes: number }>();

    return c.json({
      success: true,
      data: { id: updated!.id, votes: updated!.votes, voted: true },
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("UNIQUE")) {
      return c.json({
        success: true,
        data: { id: fb.id, votes: fb.votes, voted: false, note: "Already voted from this device" },
      });
    }
    return c.json({ success: false, error: { code: "INTERNAL", message: msg } }, 500);
  }
});

deferred.get("/feedback/top", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "10", 10), 50);
  const type = c.req.query("type");
  const status = c.req.query("status") ?? "open";

  let sql = `SELECT id, type, title, body, author, country_code, status, votes, created_at, updated_at
             FROM feedback WHERE status = ?`;
  const params: (string | number)[] = [status];

  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }

  sql += ` ORDER BY votes DESC, created_at DESC LIMIT ?`;
  params.push(limit);

  const rows = await c.env.DB.prepare(sql).bind(...params).all<{
    id: number; type: string; title: string; body: string;
    author: string | null; country_code: string | null; status: string;
    votes: number; created_at: number; updated_at: number;
  }>();

  return c.json({
    success: true,
    data: {
      feedback: rows.results,
      count: rows.results.length,
      type: type ?? null,
      status,
    },
  });
});
