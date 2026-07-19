# Shared Date/Time Reference Database — Working Plan

> Generated 2026-07-19. Scope is **date & time only** per user direction
> (currency, crypto, calling codes, cost estimators, etc. are explicitly
> **out of scope** for this pass).
>
> Source spec: [`global-reference-db-spec.pdf`](./global-reference-db-spec.pdf)
> (also kept at `/workspace/attachments/7252a947__a2a071fd-debe-43bb-bb33-9d192081f138.pdf`)

## Why

Every date/time tool we build (world clock, time-zone converter, meeting
finder, vacation planner, holiday calendar, business-day calculator,
date-to-words, sunrise/sunset) needs the same canonical data:
countries, regions, cities, IANA time zones, place names, holidays,
date formats, business calendars. The spec PDF defines a shared
reference platform so we build this once and reuse it across:
- `dateandtime.live` (static landing)
- `timeanddatepro.com` (React app)
- Future tools (`meeting.tdp`, `planner.tdp`, etc.)

## Current state (audit 2026-07-19)

| Resource | State | Action |
|---|---|---|
| D1 `timeanddatepro-full` | 5,081 cities / 194 countries / 3,865 states / 312 IANA tz / 406 city aliases / 1,460 country aliases / 155 state aliases. Schema v2.3.0 seeded 2026-07-12 from GeoNames cities5000. | **Unused** — bind to API Worker in Phase 0 |
| D1 `timeanddatepro-dev` | 190 cities / 97 famous_cities / 80 countries / 97 IANA tz | Bound to `datetime-api-dev` (dev API) |
| D1 `timeanddatepro` | 190 cities / 97 famous_cities / 80 countries / 97 IANA tz | `datetime-api` Worker is **404 on all requests** — needs redeploy |
| `datetime-api-dev` Worker | ✅ alive at `https://dev.api.dateandtime.live` | Keep, but rebind to full DB |
| `datetime-api` Worker (prod) | ❌ 404 on everything | Redeploy in Phase 0, re-attach `api.dateandtime.live` |
| `datetime-api-cron` Worker | ✅ alive | Use for data refreshes (Phase 7) |
| Postman collection | 46+ endpoints across 14 folders (in `docs/api/`) | Update as phases ship |

## Entities to add / expose

The 5,081-city DB has the geographic foundation. What we need to add to it
(in roughly this order):

| # | Entity | Use | Phase |
|---|---|---|---|
| 1 | Rebuild v2 FTS5 search on 5,081 cities | World clock picker, search box | 0 |
| 2 | `date_formats` + per-locale seed (CLDR) | Day/date display per country | 1 |
| 3 | `locales` + `month_names` + `day_names` | Localized month/day strings | 1 |
| 4 | `holidays` + `holiday_rules` (fixed + computed) | Holiday calendar, business-day calc | 2 |
| 5 | `business_calendars` + `weekends` per country | Business-day calculator | 2 |
| 6 | `date_to_words_rules` + `time_to_words_rules` | "the nineteenth of July, two thousand twenty-six" | 3 |
| 7 | `climate_summaries` + `seasons` per city/month | Vacation planner | 4 |
| 8 | `country_travel_profiles` + `city_travel_profiles` | Best time to visit, peak/shoulder/low | 5 |
| 9 | `airports` + city↔airport relationships (IATA/ICAO) | Travel planning | 5 |
| 10 | `place_relationships` (metro, capital-of, airport-serves) | Search disambiguation, meeting finder | 5/6 |
| 11 | Transliteration + historical-name penalty in v2 search | "München" → Munich, "Bombay" → Mumbai | 6 |
| 12 | Ranking factors (population, capital, location) | Search quality | 6 |
| 13 | `data_sources` + `import_history` | Lineage | 7 |
| 14 | Automated data-quality checks (cron) | Cities without tz, conflicting holidays, stale profiles | 7 |

## Phased delivery

### Phase 0 — Fix prod API + bind full DB
- [ ] Get the `datetime-api` Worker source (or re-derive from `datetime-api-dev`)
- [ ] Update `wrangler.toml`: `database_id = c401ffb6-51db-49e6-991f-b5695f9e6a7d` (full)
- [ ] Update SQL queries to match the full-DB schema (geoname_id-based cities, no `code` column)
- [ ] Rebuild the v2 search FTS5 index over the 5,081 cities
- [ ] Bump the `/api/v1/popular/cities` max limit from 100 → 200
- [ ] Redeploy `datetime-api` Worker
- [ ] Re-attach custom domain `api.dateandtime.live`
- [ ] Verify `dateandtime.live` (landing) + `timeanddatepro.com` (React) both hit the right base
- [ ] Update `AGENTS.md` "Live URLs" with the new counts

### Phase 1 — Date/time formats + locales
- [ ] Add `date_formats` table (country_code, locale, date_format_short, date_format_long, time_format, am_pm_labels, first_day_of_week, weekend_days JSON)
- [ ] Seed from CLDR for ~40 popular locales
- [ ] Add `month_names` + `day_names` tables (per locale)
- [ ] Add Worker routes: `GET /api/v1/locales`, `GET /api/v1/countries/{code}/formats`, `POST /api/v1/date/format`
- [ ] Wire `dateandtime-live` day-date display to use `/countries/US/formats`

### Phase 2 — Holidays + business calendars
- [ ] Add `holidays` table (country_code, region_code, date, observed_date, name, localized_names, type, fixed_or_rule, source, confidence)
- [ ] Add `holiday_rules` table for computed holidays (Easter, lunar, observed-on-Monday)
- [ ] Seed holidays for top 20 countries × 5 years (~5,000 rows)
- [ ] Add `business_calendars` + `weekends` tables
- [ ] Add Worker routes: `GET /api/v1/holidays/today`, `GET /api/v1/holidays?country=US&year=2026`, `POST /api/v1/business-days/calculate`, `GET /api/v1/holidays/upcoming`
- [ ] Replace the static "On this day" placeholder in `dateandtime-live` with the live call

### Phase 3 — Date-to-words / time-to-words
- [ ] Add `date_to_words_rules` + `time_to_words_rules` (locale-keyed)
- [ ] Add Worker routes: `POST /api/v1/date/to-words`, `POST /api/v1/time/to-words`
- [ ] Add `numbers_to_words` for ordinals (1st, 21st, etc.)

### Phase 4 — Sunrise / sunset / seasonal
- [ ] Add `climate_summaries` (city_id, month, avg_high_c, avg_low_c, rainy_days, season_class)
- [ ] Add `seasons` (city_id, season, start_date, end_date)
- [ ] Add Worker route: `GET /api/v1/time/sun?lat=...&lon=...&date=...`
- [ ] Wire `dateandtime-live` to replace the static "Sunrise · Sunset —" pill with live data

### Phase 5 — Travel / vacation metadata + airports
- [ ] Add `country_travel_profiles` (best_months, peak/shoulder/low, climate, calling_code, weekend_days)
- [ ] Add `city_travel_profiles`
- [ ] Add `airports` (iata_code, icao_code, name, city_id, lat, lon, timezone)
- [ ] Add Worker route: `GET /api/v1/destinations/{placeId}/travel-profile`

### Phase 6 — Search quality
- [ ] Migrate v2 search FTS5 from 190-city index to 5,081-city
- [ ] Add transliteration support (München → Munich)
- [ ] Add historical-name penalty (Bombay → Mumbai, but mark as historical)
- [ ] Add ranking: population, capital status, exact-name, user-location
- [ ] Add `GET /api/v1/cities/near?lat=...&lon=...&r=km` (Haversine in SQL)
- [ ] Add `GET /api/v1/cities/by-timezone?iana=Asia/Tokyo`

### Phase 7 — Data quality + governance
- [ ] Add `data_sources` + `import_history` tables
- [ ] Add automated cron checks: cities without country / tz, invalid IANA, conflicting holidays, stale travel profiles
- [ ] Add `GET /api/v1/admin/data-quality` endpoint (gated)

## Cross-app impact

| App | Reads from shared DB |
|---|---|
| `dateandtime.live` (static landing) | `cities`, `timezones`, `holidays/today`, `time/sun`, `countries/{code}/formats` |
| `timeanddatepro.com` (React) | All of the above + `business-days/calculate`, `date/to-words`, `destinations/{id}/travel-profile` |
| `meeting.tdp` (future) | `cities`, `timezones`, `meeting/find-overlap`, `business-days/calculate` |
| `planner.tdp` (future) | `holidays`, `travel-profiles`, `destinations` |
| `date.tdp` / `time.tdp` (future) | `date/format`, `date/to-words`, `time/to-words`, `cities/search` |

## Architectural rules (from the spec, adapted to D1/SQLite)

- **One canonical ID per entity** (country, city, currency, language, tz). All tools use the same IDs.
- **Separate concerns through tables**, not schemas (SQLite doesn't have schemas the way PG does). Use `geo_*`, `tz_*`, `cal_*` prefixes if needed for organization.
- **Stable reference data is separate from volatile operational data.** Currencies/rates, weather, advisories go in their own tables with TTL fields.
- **Never store current UTC offset on cities.** Calculate it from IANA tz + requested timestamp.
- **Lineage on every row.** `data_source_id`, `source_record_id`, `imported_at`, `version`.
- **Search uses multiple strategies** (FTS5 + alias table + population + capital status). Never match on name alone.
- **API endpoints are versioned and stable** (`/api/v1/...`). Breaking changes get a new prefix.
- **D1 is the source of truth.** KV/Cache (when added) is for hot reads, not canonical data.

## What I'd do first

If approved, start with **Phase 0** — fix the prod API Worker, point it
at `timeanddatepro-full`, rebuild the FTS5 index, and verify the
landing + React app both hit it. After that, the rest of the phases
add features without breaking anything.

For Phase 0, the `datetime-api` Worker source needs to be retrieved
(it's currently missing from the workspace — the timeanddatepro
React app's `cloudflare/datetime-api/` directory isn't on disk anymore).
Options:
1. Re-derive from `datetime-api-dev` (which IS alive and serves the same endpoints)
2. Get the source from Cloudflare's Worker editor
3. Rewrite from scratch using the Postman collection as the spec

The fastest path is option 1.
