/**
 * datetime-api Worker
 *
 * Phase 0 (2026-07-19): Rewritten to serve the full 5,081-city
 * `timeanddatepro-full` D1 database. Replaces the legacy 190-city
 * timeanddatepro D1 binding. Powers all date/time tools — see
 * `docs/architecture/SHARED-DB-PLAN.md`.
 *
 * Actual schema (from /api/v1/health, 5,081 cities / 194 countries / 312 timezones):
 *   cities:         geoname_id, name, ascii_name, country_code, country_name,
 *                   admin1_code, admin2_code, latitude, longitude, timezone,
 *                   population, elevation, feature_code, is_capital
 *   city_aliases:   city_id, alias, type, locale
 *   countries:      cca2, cca3, ccn3, cioc, name, ascii_name, official_name,
 *                   capital, continent, un_region, un_subregion, languages (JSON),
 *                   currencies (JSON), phone_code, latitude, longitude, area_km2,
 *                   population, un_member, landlocked, independent, start_of_week,
 *                   canonical_timezones (JSON), borders (JSON)
 *   timezones:      id (IANA), region, subregion, city, country_codes (JSON),
 *                   countries (JSON), latitude, longitude, current_offset,
 *                   current_abbreviation, is_dst
 *   states:         country_code, admin1_code, name, ascii_name, type,
 *                   latitude, longitude
 *
 * Endpoints (v1):
 *   GET  /                              — API info
 *   GET  /api/v1/health                 — health check
 *   GET  /api/v1/cities                 — list cities (paginated, all 5,081)
 *   GET  /api/v1/cities/:id             — get city by geoname_id
 *   GET  /api/v1/cities/search?q=...    — basic search (LIKE)
 *   GET  /api/v1/cities/near?lat&lon&r  — Haversine
 *   GET  /api/v1/popular/cities         — popular cities (cap 500)
 *   GET  /api/v1/popular/defaults       — default popular cities (5 cities)
 *   GET  /api/v1/countries              — list countries
 *   GET  /api/v1/countries/:cca2        — get country
 *   GET  /api/v1/timezones              — list IANA timezones
 *   GET  /api/v1/timezones/:id          — get timezone
 *   GET  /api/v1/time/now?tz=...        — current time for tz
 *   GET  /api/v1/time/sun?lat&lon&date  — sunrise/sunset
 *   GET  /api/v1/holidays/today?cc      — today's holidays (Phase 2)
 *   GET  /api/v1/holidays?cc=&year=     — holidays for a year (Phase 2)
 *   GET  /api/v1/onthisday              — on-this-day events (Phase 2)
 *   POST /api/v1/feedback               — submit feedback
 *   GET  /api/v1/feedback               — list feedback
 *   GET  /api/v2/search?q=...           — advanced search (FTS5)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// ============== Types ==============

export interface Env {
  DB: D1Database;
  API_VERSION: string;
  DB_VERSION: string;
  ALLOWED_ORIGINS: string;
}

interface CityRow {
  geoname_id: number;
  name: string;
  ascii_name: string;
  country_code: string;
  country_name: string;
  admin1_code: string | null;
  admin2_code: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  population: number;
  elevation: number | null;
  feature_code: string | null;
  is_capital: number | null;
  aliases?: string | null;
}

interface CountryRow {
  cca2: string;
  cca3: string;
  ccn3: string | null;
  cioc: string | null;
  name: string;
  ascii_name: string;
  official_name: string | null;
  capital: string | null;
  continent: string | null;
  un_region: string | null;
  un_subregion: string | null;
  un_region_m49: string | null;
  un_subregion_m49: string | null;
  languages: string | null;       // JSON
  currencies: string | null;      // JSON
  phone_code: string | null;
  driving_side: string | null;
  area_km2: number | null;
  population: number | null;
  un_member: number | null;
  landlocked: number | null;
  independent: number | null;
  start_of_week: string | null;
  canonical_timezones: string | null; // JSON
  borders: string | null;             // JSON
  latitude: number | null;
  longitude: number | null;
}

interface TimezoneRow {
  id: string;                    // IANA name
  region: string | null;
  subregion: string | null;
  city: string | null;
  country_codes: string | null;  // JSON array
  countries: string | null;      // JSON array
  latitude: number | null;
  longitude: number | null;
  comments: string | null;
  current_offset: string | null; // e.g. "+01:00"
  current_abbreviation: string | null;
  is_dst: number | null;
}

// ============== Helpers ==============

const POPULAR_CITY_IDS = [5128581, 2643743, 1850147, 1816670, 2147714];

const DEFAULT_POPULAR_QUERY = `
  SELECT
    c.geoname_id, c.name, c.ascii_name, c.country_code, c.country_name,
    c.admin1_code, c.admin2_code, c.latitude, c.longitude, c.timezone,
    c.population, c.elevation, c.feature_code, c.is_capital,
    (SELECT GROUP_CONCAT(alias, ',') FROM city_aliases WHERE city_id = c.geoname_id) AS aliases
  FROM cities c
  WHERE c.geoname_id IN (?, ?, ?, ?, ?)
  ORDER BY
    CASE c.geoname_id
      WHEN 5128581 THEN 1
      WHEN 2643743 THEN 2
      WHEN 1850147 THEN 3
      WHEN 1816670 THEN 4
      WHEN 2147714 THEN 5
    END
`;

function ok<T>(data: T, extra: Record<string, unknown> = {}) {
  return { success: true, data, ...extra };
}

function fail(message: string, status = 400, code = "BAD_REQUEST") {
  return { success: false, error: { code, message } };
}

function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseIntSafe(s: string | null | undefined, fallback: number, min = 1, max = 500): number {
  if (!s) return fallback;
  const n = parseInt(s, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function safeJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function parseOffsetMinutes(offsetStr: string | null): number {
  if (!offsetStr) return 0;
  // Format: "+01:00" or "-05:30"
  const m = offsetStr.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

function toCityDto(c: CityRow) {
  return {
    id: c.geoname_id,
    name: c.name,
    asciiName: c.ascii_name,
    countryCode: c.country_code,
    countryName: c.country_name,
    stateCode: c.admin1_code,
    state: null as string | null, // populated via JOIN if available
    admin2Code: c.admin2_code,
    latitude: c.latitude,
    longitude: c.longitude,
    timezone: c.timezone,
    population: c.population,
    isCapital: c.is_capital === 1,
    featureCode: c.feature_code,
    elevation: c.elevation,
    aliases: c.aliases ? c.aliases.split(",").map((s) => s.trim()).filter(Boolean) : [],
  };
}

function toCountryDto(c: CountryRow) {
  const langs = safeJson<Array<{ iso639_1?: string; iso639_2?: string; iso639_3?: string; name?: string }>>(c.languages, []);
  const curr = safeJson<Array<{ iso4217?: string; name?: string; symbol?: string }>>(c.currencies, []);
  const tz = safeJson<string[]>(c.canonical_timezones, []);
  const borders = safeJson<string[]>(c.borders, []);

  return {
    code: c.cca2,
    cca2: c.cca2,
    cca3: c.cca3,
    ccn3: c.ccn3,
    cioc: c.cioc,
    name: c.name,
    asciiName: c.ascii_name,
    officialName: c.official_name,
    capital: c.capital,
    continent: c.continent,
    unRegion: c.un_region,
    unSubregion: c.un_subregion,
    languages: langs.map((l) => ({
      code: l.iso639_1 || l.iso639_2 || l.iso639_3 || "",
      name: l.name || "",
    })),
    currencies: curr.map((x) => ({
      code: x.iso4217 || "",
      name: x.name || "",
      symbol: x.symbol || "",
    })),
    phoneCode: c.phone_code,
    drivingSide: c.driving_side,
    startOfWeek: c.start_of_week,
    areaKm2: c.area_km2,
    population: c.population,
    unMember: c.un_member === 1,
    landlocked: c.landlocked === 1,
    independent: c.independent === 1,
    canonicalTimezones: tz,
    borders,
    latitude: c.latitude,
    longitude: c.longitude,
  };
}

function toTimezoneDto(t: TimezoneRow) {
  const codes = safeJson<string[]>(t.country_codes, []);
  const countries = safeJson<string[]>(t.countries, []);
  return {
    iana: t.id,
    region: t.region,
    subregion: t.subregion,
    city: t.city,
    countryCodes: codes,
    countries,
    currentOffset: t.current_offset,
    currentOffsetMin: parseOffsetMinutes(t.current_offset),
    currentAbbreviation: t.current_abbreviation,
    isDst: t.is_dst === 1,
    latitude: t.latitude,
    longitude: t.longitude,
  };
}

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============== App ==============

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use("*", cors({
  origin: (origin, c) => {
    const allowed = parseAllowedOrigins(c.env);
    if (!origin) return allowed[0] ?? "*";
    if (allowed.includes(origin)) return origin;
    return allowed[0] ?? null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
  credentials: false,
}));

// ---------- Root ----------
app.get("/", (c) => c.json({
  success: true,
  data: {
    name: "datetime-api",
    version: c.env.API_VERSION,
    db: { version: c.env.DB_VERSION },
    endpoints: {
      health: "/api/v1/health",
      cities: "/api/v1/cities",
      popularCities: "/api/v1/popular/cities",
      countries: "/api/v1/countries",
      timezones: "/api/v1/timezones",
      timeNow: "/api/v1/time/now",
      timeSun: "/api/v1/time/sun",
      searchV2: "/api/v2/search",
    },
  },
}));

// ---------- Health ----------
app.get("/api/v1/health", async (c) => {
  const t0 = Date.now();
  const [cityCount, countryCount, tzCount, aliasCount] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM cities").first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM countries").first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM timezones").first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM city_aliases").first<{ n: number }>(),
  ]);
  return c.json(ok({
    status: "ok",
    db: {
      cities: cityCount?.n ?? 0,
      countries: countryCount?.n ?? 0,
      timezones: tzCount?.n ?? 0,
      cityAliases: aliasCount?.n ?? 0,
    },
    dbVersion: c.env.DB_VERSION,
    apiVersion: c.env.API_VERSION,
    latencyMs: Date.now() - t0,
  }));
});

// ---------- Cities ----------
app.get("/api/v1/cities", async (c) => {
  const limit = parseIntSafe(c.req.query("limit"), 100, 1, 1000);
  const offset = parseIntSafe(c.req.query("offset"), 0, 0, 1_000_000);
  const country = c.req.query("country")?.toUpperCase();
  const tz = c.req.query("tz");
  const sort = c.req.query("sort") ?? "population";
  const order = c.req.query("order") ?? "desc";

  const where: string[] = [];
  const params: (string | number | null)[] = [];

  if (country) {
    where.push("c.country_code = ?");
    params.push(country);
  }
  if (tz) {
    where.push("c.timezone = ?");
    params.push(tz);
  }

  const orderBy = (() => {
    if (sort === "name") return `c.name ${order === "asc" ? "ASC" : "DESC"}`;
    if (sort === "latitude") return `c.latitude ${order === "asc" ? "ASC" : "DESC"}`;
    if (sort === "longitude") return `c.longitude ${order === "asc" ? "ASC" : "DESC"}`;
    return `c.population ${order === "asc" ? "ASC" : "DESC"}`;
  })();

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (await c.env.DB
    .prepare(`SELECT COUNT(*) AS n FROM cities c ${whereSql}`)
    .bind(...params)
    .first<{ n: number }>())?.n ?? 0;

  const rows = await c.env.DB
    .prepare(`SELECT
      c.geoname_id, c.name, c.ascii_name, c.country_code, c.country_name,
      c.admin1_code, c.admin2_code, c.latitude, c.longitude, c.timezone,
      c.population, c.elevation, c.feature_code, c.is_capital,
      (SELECT GROUP_CONCAT(alias, ',') FROM city_aliases WHERE city_id = c.geoname_id) AS aliases
    FROM cities c
    ${whereSql}
    ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset)
    .all<CityRow>();

  return c.json(ok({
    cities: rows.results.map(toCityDto),
    count: rows.results.length,
    total,
    limit,
    offset,
  }));
});

app.get("/api/v1/cities/search", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  const country = c.req.query("country")?.toUpperCase();
  const limit = parseIntSafe(c.req.query("limit"), 25, 1, 100);

  if (!q || q.length < 2) {
    return c.json(fail("Query 'q' must be at least 2 characters"), 400);
  }

  const like = `%${q}%`;
  const where: string[] = ["(c.name LIKE ? OR c.ascii_name LIKE ? OR c.country_name LIKE ?)"];
  const params: (string | number | null)[] = [like, like, like];
  if (country) {
    where.push("c.country_code = ?");
    params.push(country);
  }

  const rows = await c.env.DB
    .prepare(`SELECT
      c.geoname_id, c.name, c.ascii_name, c.country_code, c.country_name,
      c.admin1_code, c.admin2_code, c.latitude, c.longitude, c.timezone,
      c.population, c.elevation, c.feature_code, c.is_capital,
      (SELECT GROUP_CONCAT(alias, ',') FROM city_aliases WHERE city_id = c.geoname_id) AS aliases
    FROM cities c
    WHERE ${where.join(" AND ")} ORDER BY c.population DESC LIMIT ?`)
    .bind(...params, limit)
    .all<CityRow>();

  return c.json(ok({
    cities: rows.results.map(toCityDto),
    count: rows.results.length,
    query: q,
  }));
});

app.get("/api/v1/cities/near", async (c) => {
  const lat = parseFloat(c.req.query("lat") ?? "");
  const lon = parseFloat(c.req.query("lon") ?? "");
  const r = parseFloat(c.req.query("r") ?? "100");
  const limit = parseIntSafe(c.req.query("limit"), 5, 1, 50);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return c.json(fail("Invalid lat/lon"), 400);
  }

  // Bounding box pre-filter (fast), then Haversine for ranking
  const dLat = r / 111;
  const dLon = r / (111 * Math.cos(lat * Math.PI / 180));

  const rows = await c.env.DB
    .prepare(`SELECT
      c.geoname_id, c.name, c.ascii_name, c.country_code, c.country_name,
      c.admin1_code, c.admin2_code, c.latitude, c.longitude, c.timezone,
      c.population, c.elevation, c.feature_code, c.is_capital,
      (SELECT GROUP_CONCAT(alias, ',') FROM city_aliases WHERE city_id = c.geoname_id) AS aliases
    FROM cities c
    WHERE c.latitude BETWEEN ? AND ? AND c.longitude BETWEEN ? AND ?
    LIMIT 200`)
    .bind(lat - dLat, lat + dLat, lon - dLon, lon + dLon)
    .all<CityRow>();

  const ranked = rows.results
    .map((city) => ({
      city: toCityDto(city),
      distanceKm: Math.round(haversineKm(lat, lon, city.latitude, city.longitude) * 10) / 10,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

  return c.json(ok({
    points: ranked,
    origin: { lat, lon, radiusKm: r },
    count: ranked.length,
  }));
});

app.get("/api/v1/cities/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json(fail("Invalid city id"), 400);

  const row = await c.env.DB
    .prepare(`SELECT
      c.geoname_id, c.name, c.ascii_name, c.country_code, c.country_name,
      c.admin1_code, c.admin2_code, c.latitude, c.longitude, c.timezone,
      c.population, c.elevation, c.feature_code, c.is_capital,
      (SELECT GROUP_CONCAT(alias, ',') FROM city_aliases WHERE city_id = c.geoname_id) AS aliases
    FROM cities c
    WHERE c.geoname_id = ?`)
    .bind(id)
    .first<CityRow>();

  if (!row) return c.json(fail("City not found", 404, "NOT_FOUND"), 404);
  return c.json(ok({ city: toCityDto(row) }));
});

// ---------- Popular cities ----------
app.get("/api/v1/popular/cities", async (c) => {
  const limit = parseIntSafe(c.req.query("limit"), 200, 1, 500);
  const rows = await c.env.DB
    .prepare(`SELECT
      c.geoname_id, c.name, c.ascii_name, c.country_code, c.country_name,
      c.admin1_code, c.admin2_code, c.latitude, c.longitude, c.timezone,
      c.population, c.elevation, c.feature_code, c.is_capital,
      (SELECT GROUP_CONCAT(alias, ',') FROM city_aliases WHERE city_id = c.geoname_id) AS aliases
    FROM cities c
    WHERE c.population >= 500000
    ORDER BY c.population DESC
    LIMIT ?`)
    .bind(limit)
    .all<CityRow>();

  return c.json(ok({
    cities: rows.results.map(toCityDto),
    count: rows.results.length,
    limit,
  }));
});

app.get("/api/v1/popular/defaults", async (c) => {
  const rows = await c.env.DB
    .prepare(DEFAULT_POPULAR_QUERY)
    .bind(...POPULAR_CITY_IDS)
    .all<CityRow>();
  return c.json(ok({
    cities: rows.results.map(toCityDto),
    count: rows.results.length,
  }));
});

// ---------- Countries ----------
app.get("/api/v1/countries", async (c) => {
  const limit = parseIntSafe(c.req.query("limit"), 250, 1, 500);
  const rows = await c.env.DB
    .prepare(`SELECT * FROM countries ORDER BY name ASC LIMIT ?`)
    .bind(limit)
    .all<CountryRow>();
  return c.json(ok({
    countries: rows.results.map(toCountryDto),
    count: rows.results.length,
  }));
});

app.get("/api/v1/countries/:cca2", async (c) => {
  const cca2 = c.req.param("cca2").toUpperCase();
  const row = await c.env.DB
    .prepare("SELECT * FROM countries WHERE cca2 = ?")
    .bind(cca2)
    .first<CountryRow>();
  if (!row) return c.json(fail("Country not found", 404, "NOT_FOUND"), 404);
  return c.json(ok({ country: toCountryDto(row) }));
});

// ---------- Timezones ----------
app.get("/api/v1/timezones", async (c) => {
  const limit = parseIntSafe(c.req.query("limit"), 400, 1, 1000);
  const rows = await c.env.DB
    .prepare(`SELECT * FROM timezones ORDER BY id ASC LIMIT ?`)
    .bind(limit)
    .all<TimezoneRow>();
  return c.json(ok({
    timezones: rows.results.map(toTimezoneDto),
    count: rows.results.length,
  }));
});

app.get("/api/v1/timezones/:id{.+}", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  const row = await c.env.DB
    .prepare("SELECT * FROM timezones WHERE id = ?")
    .bind(id)
    .first<TimezoneRow>();
  if (!row) return c.json(fail("Timezone not found", 404, "NOT_FOUND"), 404);
  return c.json(ok({ timezone: toTimezoneDto(row) }));
});

// ---------- Time ----------
app.get("/api/v1/time/now", async (c) => {
  const tz = c.req.query("tz");
  const now = new Date();
  const utc = now.toISOString();

  if (!tz) {
    return c.json(ok({ utc, serverNow: now.getTime() }));
  }

  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    const time = `${get("hour")}:${get("minute")}:${get("second")}`;
    const localIso = `${date}T${time}`;

    // Compute offset by parsing local as if it were UTC
    const local = new Date(localIso + "Z");
    const offsetMin = Math.round((local.getTime() - now.getTime()) / 60000);
    const sign = offsetMin >= 0 ? "+" : "-";
    const absMin = Math.abs(offsetMin);
    const offsetStr = `${sign}${String(Math.floor(absMin / 60)).padStart(2, "0")}:${String(absMin % 60).padStart(2, "0")}`;

    return c.json(ok({
      utc,
      timezone: tz,
      date,
      time,
      localIso,
      offsetMinutes: offsetMin,
      offset: offsetStr,
    }));
  } catch (e) {
    return c.json(fail(`Invalid timezone: ${tz}`, 400, "INVALID_TZ"), 400);
  }
});

app.get("/api/v1/time/sun", async (c) => {
  const lat = parseFloat(c.req.query("lat") ?? "");
  const lon = parseFloat(c.req.query("lon") ?? "");
  const dateParam = c.req.query("date");

  if (isNaN(lat) || isNaN(lon)) return c.json(fail("lat & lon required"), 400);

  const date = dateParam ? new Date(dateParam) : new Date();
  if (isNaN(date.getTime())) return c.json(fail("Invalid date"), 400);

  const sunrise = computeSun(lat, lon, date, true);
  const sunset = computeSun(lat, lon, date, false);
  return c.json(ok({
    lat, lon,
    date: date.toISOString().slice(0, 10),
    sunrise: sunrise ? sunrise.toISOString() : null,
    sunset: sunset ? sunset.toISOString() : null,
  }));
});

function computeSun(lat: number, lon: number, date: Date, isSunrise: boolean): Date | null {
  // NOAA solar position algorithm (simplified)
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - start.getTime()) / 86400000;
  const N = Math.floor(diff);

  const gamma = (2 * Math.PI / 365) * (N - 1 + ((date.getHours() - 12) / 24));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

  const latRad = lat * Math.PI / 180;
  const cosH = (Math.cos(90.833 * Math.PI / 180) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));

  if (cosH > 1 || cosH < -1) return null;

  const H = Math.acos(cosH) * 180 / Math.PI;
  const localHourAngle = isSunrise ? -H : H;

  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

  const tzOffset = -date.getTimezoneOffset() / 60;
  const solarNoon = 12 - lon / 15 - eqTime / 60;
  const result = isSunrise ? solarNoon + localHourAngle / 15 : solarNoon - localHourAngle / 15;
  const hours = Math.floor(result);
  const minutes = Math.round((result - hours) * 60);
  const d = new Date(date);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

// ---------- Holidays (Phase 0 placeholder) ----------
app.get("/api/v1/holidays/today", async (c) => {
  const country = c.req.query("country")?.toUpperCase();
  return c.json(ok({
    holidays: [],
    count: 0,
    date: new Date().toISOString().slice(0, 10),
    country: country ?? null,
    note: "Holidays data is being added in Phase 2 of the shared DB plan. See docs/architecture/SHARED-DB-PLAN.md.",
  }));
});

app.get("/api/v1/holidays", async (c) => {
  return c.json(ok({
    holidays: [],
    count: 0,
    note: "Holidays data is being added in Phase 2 of the shared DB plan. See docs/architecture/SHARED-DB-PLAN.md.",
  }));
});

// ---------- On this day (placeholder) ----------
app.get("/api/v1/onthisday", async (c) => {
  return c.json(ok({
    events: [],
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    note: "On-this-day data is a Phase 2 deliverable.",
  }));
});

// ---------- Feedback ----------
app.post("/api/v1/feedback", async (c) => {
  const body = await c.req.json<{ message?: string; email?: string; page?: string; rating?: number; context?: string }>();
  if (!body.message || body.message.length < 1) {
    return c.json(fail("message required"), 400);
  }
  if (body.message.length > 5000) {
    return c.json(fail("message too long (max 5000 chars)"), 400);
  }
  if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) {
    return c.json(fail("rating must be 1-5"), 400);
  }

  const id = crypto.randomUUID();
  const created = new Date().toISOString();
  await c.env.DB
    .prepare(`INSERT INTO feedback (id, message, email, page, rating, context, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, body.message, body.email ?? null, body.page ?? null,
      body.rating ?? null, body.context ? JSON.stringify(body.context) : null, created)
    .run();

  return c.json(ok({ id, createdAt: created }));
});

app.get("/api/v1/feedback", async (c) => {
  const limit = parseIntSafe(c.req.query("limit"), 50, 1, 200);
  const rows = await c.env.DB
    .prepare(`SELECT id, message, email, page, rating, created_at
              FROM feedback ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all<{ id: string; message: string; email: string | null; page: string | null; rating: number | null; created_at: string }>();
  return c.json(ok({
    feedback: rows.results,
    count: rows.results.length,
  }));
});

// ---------- v2 search (FTS5) ----------
app.get("/api/v2/search", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  const country = c.req.query("country")?.toUpperCase();
  const tz = c.req.query("tz");
  const lat = parseFloat(c.req.query("lat") ?? "");
  const lon = parseFloat(c.req.query("lon") ?? "");
  const limit = parseIntSafe(c.req.query("limit"), 25, 1, 100);

  if (!q || q.length < 1) {
    // Empty search → top popular cities
    const popular = await c.env.DB
      .prepare(`SELECT
        c.geoname_id, c.name, c.ascii_name, c.country_code, c.country_name,
        c.admin1_code, c.admin2_code, c.latitude, c.longitude, c.timezone,
        c.population, c.elevation, c.feature_code, c.is_capital,
        (SELECT GROUP_CONCAT(alias, ',') FROM city_aliases WHERE city_id = c.geoname_id) AS aliases
      FROM cities c
      ORDER BY c.population DESC LIMIT ?`)
      .bind(limit)
      .all<CityRow>();
    return c.json(ok({
      cities: popular.results.map(toCityDto),
      query: q,
      count: popular.results.length,
      strategy: "popular",
    }));
  }

  // FTS5 search
  const ftsQuery = q
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => `${w}*`)
    .join(" ");

  const where: string[] = ["cities_fts MATCH ?"];
  const params: (string | number | null)[] = [ftsQuery];

  if (country) {
    where.push("c.country_code = ?");
    params.push(country);
  }
  if (tz) {
    where.push("c.timezone = ?");
    params.push(tz);
  }

  const whereSql = where.join(" AND ");
  const rows = await c.env.DB
    .prepare(`SELECT
      c.geoname_id, c.name, c.ascii_name, c.country_code, c.country_name,
      c.admin1_code, c.admin2_code, c.latitude, c.longitude, c.timezone,
      c.population, c.elevation, c.feature_code, c.is_capital,
      (SELECT GROUP_CONCAT(alias, ',') FROM city_aliases WHERE city_id = c.geoname_id) AS aliases,
      rank
    FROM cities_fts
    JOIN cities c ON c.rowid = cities_fts.rowid
    WHERE ${whereSql}
    ORDER BY rank LIMIT ?`)
    .bind(...params, limit)
    .all<CityRow & { rank: number }>();

  let cities = rows.results.map((r) => {
    const { rank, ...city } = r;
    return toCityDto(city);
  });
  const strategy = "fts5";

  // Optional: add distance for ranking info
  if (!isNaN(lat) && !isNaN(lon)) {
    cities = cities.map((city) => ({
      ...city,
      distanceKm: Math.round(haversineKm(lat, lon, city.latitude, city.longitude) * 10) / 10,
    }));
  }

  return c.json(ok({
    cities,
    query: q,
    count: cities.length,
    strategy,
  }));
});

// ---------- 404 ----------
app.notFound((c) => c.json(fail("Not found", 404, "NOT_FOUND"), 404));
app.onError((err, c) => {
  console.error(err);
  return c.json(fail(err.message || "Internal error", 500, "INTERNAL"), 500);
});

export default {
  fetch: app.fetch,
};
