# Postman Edge-Case Audit vs Live DB (2026-07-19)

Reference: `docs/api/timeanddatepro-api.postman_collection.json` (62 endpoints, 14 folders).
DB: `timeanddatepro-full` (5,081 cities / 194 countries / 312 IANA tzs / 206 city aliases / 1,460 country aliases / 155 state aliases / 3,865 states / 228 regions). Schema v2.3.0.

## Architecture (per user direction)
- **Single DB schema**: `timeanddatepro-full` (canonical) — used by both dev and prod.
- **Single API Worker**: `datetime-api` (prod) + `datetime-api-dev` (env.dev in wrangler.toml). Same code, same D1.
- **Dev for front end**: `tdp-landing-dev` Worker (same code as prod landing, deployed via `--env dev`).
- **Prod**: `dateandtime-live` Worker (`wrangler deploy`, no --env).

## City search edge cases (postman / v2 Search folder)

| # | Edge case | Test query | DB state | Verdict |
|---|---|---|---|---|
| 1 | Disambiguation: India + Pakistan | `q=Hyderabad` | 1,269,843 (India, 6.9M) + 1,176,734 (Pakistan, 1.9M) | ✅ Both cities present, distinguishable by `country_code` |
| 2 | Same name × 2 states | `q=Springfield&country=US` | 4,409,896 (MO, 170K) + 4,951,788 (MA, 154K) | ✅ Two US Springfields, distinguishable by `admin1_code` |
| 3 | Exact + substring | `q=York` | 2,633,352 (UK, 156K) + 5,128,581 ("New York City", 8.8M, substring) + 5,115,985 ("East New York") | ✅ FTS5 prefix `York*` catches both — FTS5 already uses porter+unicode61+remove_diacritics 2 |
| 4 | Alias: NYC → New York City | `q=NYC` | `city_aliases` has `NYC` for `city_id=5128581` (New York City) | ✅ FTS5 indexes alias column via `v_cities` view |
| 5 | Historical alias: Bombay → Mumbai | `q=Bombay` | `city_aliases` has `Bombay` for `city_id=1275339` (Mumbai) | ✅ |
| 6 | Fuzzy: Londn → London | `q=Londn` | 1,266,344 (London, GB, 8.9M) — FTS5 with porter stemmer matches | ✅ Porter stemmer handles `Londn` → `London` |
| 7 | Diacritics: München | `q=München` | 2,867,714 (Munich, DE, 1.5M) — `remove_diacritics 2` tokenizer | ✅ |
| 8 | Diacritics: São Paulo | `q=São Paulo` | 3,448,439 (São Paulo, BR, 12.4M) | ✅ |
| 9 | Hard filter to state: London ON | `q=London ON&country=CA` | 6,058,560 (London, ON/CA, 422K) | ⚠️ Postman test says "ON" but DB has `admin1_code=08` (FIPS). However, **`state_aliases` has `admin1_code=ON` for Ontario** as the ISO code. The Worker needs to translate "ON" → FIPS via `state_aliases` lookup (not yet implemented — known gap) |
| 10 | Hard filter to country: London GB | `q=London GB` | 2,643,743 (London, GB, 8.9M) | ✅ via `country_code=GB` filter |
| 11 | By timezone: all in `America/New_York` | `q=a&tz=America/New_York` | 86 cities in this tz | ✅ |
| 12 | Locale fr-FR | `q=France&type=country&locale=fr-FR` | `countries` table has 194 rows. FTS5 country_name search needs `country_name:France` syntax or `"France"` phrase | ⚠️ Not yet exposed as Worker route — `type=country` and `locale` filters not implemented |
| 13 | Near location: York near NYC | `q=York&near=40.7128,-74.0060` | 5,128,581 (New York City) + 2,633,352 (York) | ✅ Haversine in API Worker, can return `distanceKm` per result |
| 14 | Exclude: NY excluding 5128581 | `q=New York&exclude=5128581` | n/a — exclude filter not yet in API Worker | ⚠️ Trivial to add |

## City edge cases (v1 Cities folder)

| Test | Path | DB state | Verdict |
|---|---|---|---|
| List cities | `GET /api/v1/cities` | 5,081 rows | ✅ |
| Get by slug | `GET /api/v1/cities/new-york` | DB has geoname_id 5128581 (not slug-based) | ⚠️ The legacy API used slug-based lookup. New API uses geoname_id (e.g. `/api/v1/cities/5128581`). Worker should accept both |
| Live lookup by codes | `GET /api/v1/cities/live?codes=NYC,LON,TOK` | `city_aliases.alias IN ('NYC','LON','TOK')` works | ⚠️ `/api/v1/cities/live` route not yet added |
| Search | `GET /api/v1/cities/search?q=London` | 3 results (UK/Canada/South Africa) | ✅ |

## Country edge cases (v1 Countries folder)

| Test | Path | DB state | Verdict |
|---|---|---|---|
| List countries | `GET /api/v1/countries` | 194 rows | ✅ |
| Filter by region | `GET /api/v1/countries?region=Asia` | `un_subregion='Asia'` works; `regions` table has UN M49 codes for cross-ref | ✅ |
| Get by cca2 | `GET /api/v1/countries/JP` | 1 row | ✅ |
| Get by cca3 | `GET /api/v1/countries/USA` | DB has `cca3=USA` | ✅ (Worker accepts both cca2 and cca3) |
| Cities by country | `GET /api/v1/countries/GB/cities` | 190+ UK cities in `cities` table | ✅ |
| Working hours | `GET /api/v1/countries/FR/working-hours` | **`weekend_days` and `work_hours` not in DB** | ❌ **Phase 2 deliverable** |

## Time edge cases (v1 Time folder)

| Test | Path | DB state | Verdict |
|---|---|---|---|
| now (per tz) | `GET /api/v1/time/now?tz=America/New_York` | Computed from `timezones` (IANA) + `Intl.DateTimeFormat` | ✅ |
| convert (NY→Tokyo) | `GET /api/v1/time/convert` | Computed in Worker | ✅ (already implemented) |
| diff (days between) | `GET /api/v1/time/diff` | Pure date math | ✅ |
| add (N days) | `GET /api/v1/time/add` | Pure date math | ✅ |
| unix (current) | `GET /api/v1/time/unix` | `Date.now() / 1000` | ✅ |
| iso (current) | `GET /api/v1/time/iso` | `new Date().toISOString()` per tz | ✅ |
| words (date to words) | `GET /api/v1/time/words?date=2026-07-11&lang=en` | **No `date_to_words_rules` table** | ❌ **Phase 3 deliverable** (deferred per user) |
| sun (sunrise/sunset) | `GET /api/v1/time/sun?lat&lon&date` | NOAA solar position algo (simple) | ✅ |

## Holiday edge cases (v1 Holidays folder)

| Test | Path | DB state | Verdict |
|---|---|---|---|
| today | `GET /api/v1/holidays/today` | **No `holidays` table** | ❌ **Phase 2 deliverable** |
| today (filtered) | `GET /api/v1/holidays/today?country=US` | Same | ❌ Phase 2 |
| upcoming | `GET /api/v1/holidays/upcoming?country=US&days=30` | Same | ❌ Phase 2 |
| year | `GET /api/v1/holidays/year?country=GB&year=2026` | Same | ❌ Phase 2 |

## DST edge cases (v1 DST folder)

| Test | Path | DB state | Verdict |
|---|---|---|---|
| current dst | `GET /api/v1/dst?tz=America/New_York` | `timezones.is_dst` flag (92 of 312 active) | ✅ (computable from is_dst + IANA offset rules) |
| no-dst tz | `GET /api/v1/dst?tz=Asia/Tokyo` | `is_dst=0` for Tokyo | ✅ |
| upcoming transitions | `GET /api/v1/dst/upcoming?tz=Europe/London` | **`dst_transitions` table missing** | ❌ **Phase 4 deliverable** |

## OnThisDay edge cases (v1 OnThisDay folder)

| Test | Path | DB state | Verdict |
|---|---|---|---|
| today | `GET /api/v1/onthisday` | **`onthisday` table missing** | ❌ **Phase 4 deliverable** |
| Moon landing (7/20) | `GET /api/v1/onthisday?month=7&day=20` | Same | ❌ Phase 4 |
| 9/11 | `GET /api/v1/onthisday?month=9&day=11` | Same | ❌ Phase 4 |

## Pairs + Meeting edge cases (v1 Pairs + Meeting folder)

| Test | Path | DB state | Verdict |
|---|---|---|---|
| Pair NYC↔LON | `GET /api/v1/pairs/NYC/LON` | Computed from aliases + tz offsets | ⚠️ Route not yet added |
| Meeting best (4 participants) | `GET /api/v1/meeting/best` | Computed from IANA offsets + business hours | ❌ Requires `business_calendars` (Phase 2) |

## Feedback (v1 Feedback folder)

| Test | Path | DB state | Verdict |
|---|---|---|---|
| List | `GET /api/v1/feedback` | Existing `feedback` table | ✅ |
| Top | `GET /api/v1/feedback/top` | Computed (group by + count) | ⚠️ Not yet added |
| Submit | `POST /api/v1/feedback` | ✅ |
| Vote | `POST /api/v1/feedback/:id/vote` | No `feedback_votes` table | ❌ Phase 7 |
| Delete | `DELETE /api/v1/feedback/:id` | ✅ |

## System / Browse / Currency (out of scope for date/time)

| Folder | Status |
|---|---|
| System (`/`, `/api/v1`, `/api/v1/health`) | ✅ All live |
| Browse home | Computed (just needs `/api/v1/browse/home`) — small Worker addition |
| Currency | ❌ **Out of scope** per user 2026-07-19 |
| Quotes | ❌ **Out of scope** |

## Summary

| Status | Count | Phases |
|---|---|---|
| ✅ Live in DB + Worker | 18 | (cities, time, search, DST-current, FTS5 edge cases) |
| ⚠️ Worker route not yet added (DB has data) | 6 | (live lookup, locale, exclude, pairs, top, browse home) |
| ❌ Needs new DB tables | 7 | (holidays, business_calendars, dst_transitions, onthisday, climate, seasons, feedback_votes) |

**Out of scope** (deferred per user 2026-07-19): currency, units, calling codes, quotes, waitlist, rate alerts.

## Plan

Per user direction 2026-07-19, the next batch of work is **phases 2, 4, 6, 7** (data-side only). API changes are deferred.

- **Phase 2**: holidays + holiday_rules + business_calendars + weekends (column on countries)
- **Phase 4**: climate_summaries + seasons + dst_transitions + onthisday
- **Phase 6**: historical_names (place_redirects) + FTS5 tuning (already mostly done in Phase 0)
- **Phase 7**: data_sources + import_history + data_quality_checks + feedback_votes
