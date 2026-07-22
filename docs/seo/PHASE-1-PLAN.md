# Phase 1 Build Plan — Data Plumbing

> Last updated: 2026-07-21
> Goal: fix the data foundation so city pages can be built in Phase 2

This is the systematic build order for Phase 1. Each item unblocks the
next. The user requested "lets go systematic way. and then phase1."

---

## Current state (verified 2026-07-21)

### What we have

| Asset | Location | Records | Status |
|---|---|---|---|
| Cities (full data) | prod D1 + dev D1 | 33,945 | ✅ |
| Countries (UN M49) | prod D1 + dev D1 | 242 | ✅ |
| Time zones (IANA) | prod D1 + dev D1 | 408 | ✅ |
| Holidays (Nager.Date) | prod D1 + dev D1 | 1,600+ | ✅ |
| Climate summaries | prod D1 + dev D1 | 60,972 | ✅ data, ❌ no API |
| DST transitions | prod D1 + dev D1 | 1,560 | ✅ data, ❌ no API |
| OTD events (540) | prod API (JSON file fallback) | 540 | ⚠️ prod only, not in dev D1 |
| Persons (3) | dev D1 | 3 | ❌ 50K available in JSON file, not loaded |
| 50K persons JSON file | `/tmp/otd-final/persons-top-50k.json` | 50,000 | ❌ not in this env |
| Comprehensive seed (114 events) | `scripts/seed-onthisday-comprehensive.js` | 114 | ⚠️ not POSTed yet |

### What's broken

1. **`/cities?country=X&state=Y` filter doesn't work** — returns 200 most-populous globally
2. **No nearby-cities endpoint** — can't compute "cities near Tampa"
3. **No state-hub endpoint** — can't list cities in a state
4. **No tz-hub endpoint** — can't list cities in a timezone
5. **OTD events not city-linked** — can't say "Apollo 11 launched from Cape Canaveral"
6. **Persons not city-linked** — can't say "Einstein was born in Ulm"
7. **OTD data not in dev D1** — only 3 events (the seed)
8. **Persons not in dev D1** — only 3 records (50K in JSON file)

---

## Free data sources we can pull (all CC-friendly, no API key)

| Data | Source | Cost | Records | Format | URL |
|---|---|---|---|---|---|
| **Airports** | OurAirports | Free (Public Domain) | ~75K airports, 9K countries, 4K regions | CSV | https://ourairports.com/data/ |
| **Weather (current + 16d forecast)** | Open-Meteo | Free (no key, 10K req/day) | Global, by lat/lon | JSON API | https://open-meteo.com/ |
| **Country info (90+ fields)** | REST Countries v3.1 | Free (no key) | 250+ countries | JSON | https://restcountries.com/ |
| **Country info (alt)** | countries.dev | Free (no key) | All countries | JSON | https://countries.dev/ |
| **GeoNames cities** | geonames.org | Free with credit | 11M+ places | CSV | https://www.geonames.org/ |
| **Holidays** | Nager.Date | Free | 100+ countries | API | https://date.nager.at/Api |
| **Time zones** | IANA / zoneinfo | Free | 408 tzs | tzdata | https://www.iana.org/time-zones |
| **Wikipedia articles** | REST API | Free | 6M+ articles | API | https://en.wikipedia.org/api/rest_v1/ |
| **Wikidata entities** | SPARQL | Free | 100M+ entities | SPARQL | https://query.wikidata.org/ |
| **Climate (1940-present)** | Open-Meteo Historical | Free | Global | JSON API | https://archive-api.open-meteo.com/ |

---

## Phase 1 — Data Plumbing (the foundation)

### 1A. Add `city_id` column to `onthisday` table

**Goal:** Each OTD event links to a city (e.g., "Apollo 11 launched from Cape Canaveral, FL" → city_id for Cape Canaveral).

**Migration:** `cloudflare/datetime-api/migrations/012_otd_city_id.sql`
```sql
ALTER TABLE onthisday ADD COLUMN city_id INTEGER REFERENCES cities(id);
ALTER TABLE onthisday ADD COLUMN city_name TEXT;
ALTER TABLE onthisday ADD COLUMN importance_score INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_onthisday_city ON onthisday(city_id);
```

**Apply:** `wrangler d1 execute timeandtimepro-dev --remote --file=migrations/012_otd_city_id.sql`
**Apply to prod:** Same file, applied to `timeandtimepro-full`

### 1B. Add `birth_city_id`, `death_city_id` to `otd_entities`

**Goal:** Each person links to where they were born/died (e.g., "Einstein was born in Ulm" → city_id for Ulm, DE).

**Migration:** `cloudflare/datetime-api/migrations/013_otd_entity_city_id.sql`
```sql
ALTER TABLE otd_entities ADD COLUMN birth_city_id INTEGER REFERENCES cities(id);
ALTER TABLE otd_entities ADD COLUMN death_city_id INTEGER REFERENCES cities(id);
CREATE INDEX IF NOT EXISTS idx_entities_birth_city ON otd_entities(birth_city_id);
CREATE INDEX IF NOT EXISTS idx_entities_death_city ON otd_entities(death_city_id);
```

**Apply:** same as 1A

### 1C. Load 540 OTD events to dev D1

**Goal:** Sync dev D1 with the 540 events currently in prod (via JSON file fallback).

**Method:** POST to `https://dev.api.dateandtime.live/api/v1/onthisday` for each event, using the existing `seed-onthisday-comprehensive.js` script.

**Sources:**
- `scripts/seed-onthisday-comprehensive.js` — 114 curated events
- `scripts/fetch-otd-batch.js` — fetches from 8 sources
- `scripts/fetch-weddings.js` — 414K weddings (Wikidata)

**Step 1:** Run `seed-onthisday-comprehensive.js` to POST the 114 curated events
**Step 2:** Run `fetch-otd-batch.js --all-365 --max-per-day 30` to fetch the remaining 426 events

**Note:** Batch fetcher was paused at 110/366 (Apr 20). Need to resume.

### 1D. Load 50K persons to dev D1

**Goal:** Top 50K Wikipedia persons in D1 with birth/death years + places.

**Source:** The JSON file at `/tmp/otd-final/persons-top-50k.json` (if it exists in the Cloudflare Workers build env).

**Fallback:** Fetch from Wikipedia API:
```js
// Per the pipeline: top-50K persons by Wikipedia pageviews
// For each: GET /api/v1/person/{slug}  →  get wikidata_id
// Resolve place names → city_ids
```

**Step 1:** Check if the JSON file is accessible from the build env
**Step 2:** If not, run the fetch script for top 50K persons
**Step 3:** Resolve birth_place / death_place strings → city_ids

### 1E. Fix `/cities` filter API

**Goal:** Make `/cities?countryCode=X&stateCode=Y&timezone=Z` actually work.

**Current bug:** The route ignores filter params, always returns 200 most-populous.

**File:** `cloudflare/datetime-api/routes/cities.js` (or wherever)

**Fix:**
```js
// Add WHERE clauses based on filter params
const filters = [];
if (countryCode) filters.push('country_code = ?');
if (stateCode) filters.push('state_code = ?');
if (timezone) filters.push('timezone = ?');
const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
const sql = `SELECT * FROM cities ${where} ORDER BY population DESC LIMIT ?`;
```

### 1F. Add `/cities/nearby?lat=&lon=&radius=` endpoint

**Goal:** Compute cities within X km of a lat/lon (haversine).

**SQL:** Use SQLite's haversine:
```sql
SELECT *,
  (6371 * acos(
    cos(radians(?)) * cos(radians(latitude)) *
    cos(radians(longitude) - radians(?)) +
    sin(radians(?)) * sin(radians(latitude))
  )) AS distance_km
FROM cities
HAVING distance_km < ?
ORDER BY distance_km
LIMIT 20
```

### 1G. Add `/cities/state/:cc/:state` endpoint

**Goal:** List all cities in a state.

```sql
SELECT * FROM cities WHERE country_code = ? AND state_code = ? ORDER BY population DESC LIMIT 500
```

### 1H. Add `/cities/timezone/:iana` endpoint

**Goal:** List all cities in a timezone.

```sql
SELECT * FROM cities WHERE timezone = ? ORDER BY population DESC LIMIT 1000
```

### 1I. Expose `climate` and `dst` endpoints (data exists)

**Climate** (`climate_summaries` table):
```sql
-- /api/v1/climate?city_id=X
SELECT * FROM climate_summaries WHERE city_id = ? ORDER BY month
```

**DST** (`dst_transitions` table):
```sql
-- /api/v1/dst/upcoming?tz=America/New_York
SELECT * FROM dst_transitions WHERE timezone = ? AND date >= ? ORDER BY date LIMIT 10
```

### 1J. Build airports table + import OurAirports CSV

**Schema:**
```sql
CREATE TABLE airports (
  id INTEGER PRIMARY KEY,
  ident TEXT NOT NULL UNIQUE,
  type TEXT,
  name TEXT NOT NULL,
  latitude_deg REAL,
  longitude_deg REAL,
  elevation_ft INTEGER,
  continent TEXT,
  iso_country TEXT,
  iso_region TEXT,
  municipality TEXT,
  scheduled_service TEXT,
  iata_code TEXT,
  icao_code TEXT,
  timezone TEXT,
  city_id INTEGER REFERENCES cities(id)
);
CREATE INDEX idx_airports_city ON airports(city_id);
CREATE INDEX idx_airports_iata ON airports(iata_code);
```

**Import:** Download from https://davidmegginson.github.io/ourairports-data/airports.csv
- ~75K rows, 19 cols
- Filter to type='large_airport' or 'medium_airport' (~5K rows, much more useful)
- Match `municipality` + `iso_country` to cities.name + cities.country_code for `city_id`

### 1K. Backfill `city_id` on OTD events

**Method:** For each OTD event:
- If `city_name` is set in the event payload, match against `cities.name` + `cities.country_code`
- Update `onthisday.city_id` to the matched city

**Batch script:** Use the existing comprehensive seed which already has city_name for some events.

### 1L. Backfill `birth_city_id` / `death_city_id` on persons

**Method:** For each person:
- If `birth_place` is set, parse + match against `cities.name` + `cities.country_code`
- Update `otd_entities.birth_city_id` / `death_city_id`

**Data quality:** Need to handle:
- "Ulm, Germany" → "Ulm" + "DE"
- "Brooklyn, New York, USA" → "Brooklyn" + "US" (or just "New York")
- "Paris, France" → "Paris" + "FR"
- Multiple cities with same name (need country match)

---

## Phase 2 — City pages (after Phase 1)

**Depends on:** 1A, 1B, 1E, 1F, 1K, 1L all done

- HTML template for `/world-time/city/{slug}/`
- Server-side render the time
- JSON-LD @graph
- Internal links to country, state, tz, holidays, OTD, persons
- Static export top 1,000 cities
- Lazy-render the rest

## Phase 3 — Hubs (after Phase 2)

- `/world-time/{country}/` (242 pages)
- `/world-time/{country}/{state}/` (~3,000 pages for US states + others)
- `/time-zones/zone/{iana}/` (408 pages)

## Phase 4 — Sub-pages per city (after Phase 3)

- `/world-time/city/{slug}/sunrise/`
- `/world-time/city/{slug}/holidays/`
- `/world-time/city/{slug}/people/`
- `/world-time/city/{slug}/climate/`
- `/world-time/city/{slug}/weather/` (needs Open-Meteo proxy)
- `/world-time/city/{slug}/airports/` (needs airports data)

## Phase 5 — Tools (after Phase 4)

- Meeting planner
- Time converter
- Distance calculator
- Event time announcer
- Embeddable clock widget

---

## Execution order (next 1-2 weeks)

| Day | Task | Deliverable |
|---|---|---|
| 1 | 1A + 1B migrations | New columns in D1 |
| 1 | 1E fix cities filter | /cities?countryCode=X works |
| 1 | 1F nearby endpoint | /cities/nearby works |
| 1 | 1G + 1H state + tz endpoints | /cities/state/{cc}/{state} works |
| 2 | 1C load 114 seed events | 114 OTD events in D1 |
| 2 | 1I expose climate + dst | /climate, /dst work |
| 3 | 1C run fetch-otd-batch (resume at 110/366) | All 540 events in D1 |
| 3 | 1D load 50K persons | 50K persons in D1 |
| 4 | 1K + 1L backfill city links | city_id on OTD + persons |
| 4 | 1J import airports | 5K airports in D1 |
| 5-7 | Phase 2: Tampa city page template | First city page live |
| 8-10 | Phase 2: Static export top 1K cities | 1K city pages live |
| 11+ | Phase 3: country + state + tz hubs | 3K+ hub pages live |
| 12+ | Phase 4: sub-pages | 6K+ sub-pages live |

---

## Quick wins (do first, ship fast)

- **1E** (fix cities filter) — 1 hour, big UX win
- **1F** (nearby endpoint) — 2 hours, enables city page "nearby" section
- **1I** (climate + dst) — 2 hours, enables city page "climate" section
- **1G + 1H** (state + tz endpoints) — 2 hours, enables state + tz hub pages
- **1C** (load 114 events) — 30 min, fixes "OTD is empty" issue
- **1J** (airports) — 4 hours, enables "Airports near X" section

**Total: 1-2 days to ship all quick wins.**

---

## Files to create / modify

**New migrations:**
- `cloudflare/datetime-api/migrations/012_otd_city_id.sql`
- `cloudflare/datetime-api/migrations/013_otd_entity_city_id.sql`
- `cloudflare/datetime-api/migrations/014_airports.sql`

**New scripts:**
- `scripts/backfill-otd-city-ids.js`
- `scripts/backfill-person-city-ids.js`
- `scripts/import-airports.js`
- `scripts/import-persons.js`

**Modified files:**
- `cloudflare/datetime-api/routes/cities.js` (fix filter)
- `cloudflare/datetime-api/routes/climate.js` (expose)
- `cloudflare/datetime-api/routes/dst.js` (expose)
- `cloudflare/datetime-api/routes/airports.js` (new)

---

## Success criteria

After Phase 1, we should be able to:
- ✅ Get 540 OTD events via API, filter by month/day/country
- ✅ Get 50K persons, filter by country/birth_year
- ✅ List cities in US/FL (or any state)
- ✅ List cities in America/New_York (or any tz)
- ✅ Get nearby cities to any point
- ✅ Get climate for any city
- ✅ Get DST transitions for any tz
- ✅ Get airports in any city
- ✅ Each OTD event has a city_id link
- ✅ Each person has birth_city_id / death_city_id

Then Phase 2 (city pages) can start.
