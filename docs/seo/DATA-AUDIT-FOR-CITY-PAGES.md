# Data Audit for City Pages (Tampa example)

> Last updated: 2026-07-21
> Goal: figure out exactly what data we have to build `/world-time/city/tampa/` and its internal link graph

This is the data inventory + gap analysis + link graph blueprint for the
Tampa (and by extension all 33,945 city pages).

---

## Part 1 — What we have in D1 (verified via live API + D1 queries)

### Tampa city data (1 row, `cities` table)

| Field | Value |
|---|---|
| `id` (GeoNames) | **4174757** |
| `name` | Tampa |
| `countryCode` | US |
| `stateCode` | FL (Florida) |
| `admin2Code` | 057 (Hillsborough County) |
| `latitude` | 27.94752 |
| `longitude` | -82.45843 |
| `timezone` | **America/New_York** (IANA) |
| `population` | 414,547 |
| `elevation` | 1 (m) |
| `isCapital` | false (county seat, not state capital) |
| `featureCode` | PPLA2 |
| `aliases` | [] |

### Global table sizes (from D1 + API stats)

| Table | Rows | Notes |
|---|---|---|
| `cities` | **33,945** | GeoNames cities15000 + missing tz/countries (the Oct 2026 expansion) |
| `countries` | **242** | UN M49 (was 194, +48 territories) |
| `timezones` | **408** | IANA (was 312, +96 from zoneinfo) |
| `onthisday` | **540** | Wiley Post, Einstein, Apollo 11, plus ~537 more. Goal: 71,992 |
| `otd_entities` (persons) | **3** in D1 | Einstein, Brian May, Apollo 11. **50K in JSON file** (not yet loaded to D1) |
| `holidays` | 1,600+ | Nager.Date, 15 countries × 5 years + business_calendars (20 countries) |
| `holiday_rules` | 11 | US + UK rule-based |
| `climate_summaries` | 60,972 | 5,081 cities × 12 months |
| `seasons` | 16,378 | 5,081 cities × 3-4 seasons |
| `dst_transitions` | 1,560 | 312 tzs × 5 years |
| `onthisday` (OTD events) | 50 currently exposed | 540 total in DB |

### US holidays 2026 (15 holidays, `holidays` table)

```
2026-01-01  New Year's Day (public_holiday)
2026-01-19  Martin Luther King, Jr. Day (public_holiday)
2026-02-12  Lincoln's Birthday (observance)
2026-02-16  Presidents Day (public_holiday)
2026-04-03  Good Friday (public_holiday)
2026-05-08  Truman Day (school_holiday)
2026-05-25  Memorial Day (public_holiday)
2026-06-19  Juneteenth National Independence Day (public_holiday)
2026-07-03  Independence Day (public_holiday)
2026-09-07  Labour Day (public_holiday)
2026-10-12  Columbus Day (public_holiday)
2026-10-12  Indigenous Peoples' Day (public_holiday)
2026-11-11  Veterans Day (public_holiday)
2026-11-26  Thanksgiving Day (public_holiday)
2026-12-25  Christmas Day (public_holiday)
```

### OTD events categories (540 events, `onthisday` table)

| Category | Count | Examples |
|---|---|---|
| event | 304 | Historical events |
| birth | 163 | Famous births |
| politics | 37 | Political events |
| death | 22 | Famous deaths |
| discovery | 5 | Scientific discoveries |
| battle | 3 | Military battles |
| treaty | 2 | Treaties |
| religion | 1 | |
| first | 1 | First-of-kind events |
| disaster | 1 | |
| disappearance | 1 | |

### OTD events for today (7-22)

```
1933  Wiley Post flies solo around world  (US)
```

Only 1 event for today. We need 5-10 for a good city page.

### Persons in D1 (3 records)

| Q-ID | Name | Birth | Death | Country |
|---|---|---|---|---|
| Q937 | Albert Einstein | 1879-03-14 | 1955-04-18 | DE |
| Q5816 | Brian May | 1947-07-19 | alive | GB |
| Q11631 | Apollo 11 | 1969-07-20 | event | US |

**Persons JSON file**: `/tmp/otd-final/persons-top-50k.json` exists with ~50K records but is NOT loaded into D1 yet. Loading this is a priority for city pages.

---

## Part 2 — What we DON'T have (gaps to fill)

### Critical gaps for city pages

| Gap | What it blocks | Effort to fix |
|---|---|---|
| **Persons not loaded to D1** | Can't show "Famous people born in Tampa" | LOW (load JSON → D1) |
| **OTD events not city-linked** | Can't show "Events that happened in Tampa" | MEDIUM (need city_id col + backfill) |
| **Persons not city-linked** | Can't show "Famous people from Tampa" | MEDIUM (need birth_place/death_place resolved to city_id) |
| **No airports data** | Can't show "Airports near Tampa" | HIGH (need new data source, e.g. OpenFlights or OurAirports) |
| **No weather API** | Can't show "Current weather in Tampa" | MEDIUM (need weather provider) |
| **No distance calculator** | Can't show "Distance from your home" | LOW (haversine on lat/lon) |
| **No "famous events in city"** | Can't show "Apollo 11 launched from Cape Canaveral" | HIGH (need to backfill OTD with city links) |
| **Climate API not exposed** | Can't show "Climate in Tampa" | LOW (table exists, need API route) |
| **DST API not exposed** | Can't show "DST in America/New_York" | LOW (table exists, need API route) |
| **Nearby cities not computed** | Can't show "Cities near Tampa" | LOW (haversine on cities table) |
| **State hubs not built** | Can't show "Florida cities" page | MEDIUM (need /usa/fl/ template) |
| **Meeting planner not built** | Can't show "Meeting time with Tampa" | MEDIUM (need algorithm) |
| **Event announcer not built** | Can't show "Event time in Tampa" | LOW (timezone math) |
| **Time difference page not built** | Can't show "Tampa vs New York" | LOW (tz offset math) |

### Data quality issues

| Issue | Detail | Fix |
|---|---|---|
| `cities` filter API broken | `/cities?countryCode=US` returns 200 most-populous, not filtered | Rewrite `cities.js` route in API Worker |
| `cities/nearby` not implemented | Haversine on cities table | Add SQL query |
| Persons: birth_place/death_place NULL for all 3 | Wikipedia JSON doesn't have city IDs | Need to resolve place names → city_ids via a join |
| OTD: country_codes JSON string not filterable | Stored as text, not queryable | Could use LIKE search, or migrate to separate table |
| `cities/tz` not filterable | Same as above | Same fix |

---

## Part 3 — Internal link graph blueprint for Tampa

Here's the FULL link map for `/world-time/city/tampa/`:

```
/world-time/city/tampa/                          ← CANONICAL
│
├── Hero (live time + date + day name)
│   └── JSON-LD: City, WebSite, BreadcrumbList, FAQPage
│
├── [H1] "Current Local Time in Tampa, Florida, USA"
│
├── [Section 1] Quick facts
│   ├── Country: United States → /world-time/usa/
│   ├── State: Florida → /world-time/usa/florida/      ⚠️ need to build state hubs
│   ├── Time zone: America/New_York → /time-zones/zone/america-new-york/
│   ├── UTC offset: UTC-4 (DST active) → /time-zones/utc/
│   ├── Population: 414,547 → # (anchor)
│   ├── Coordinates: 27.95°N, 82.46°W → /time-zones/in/united-states/tampa-on-map/
│   └── Elevation: 1m
│
├── [Section 2] Time zone (Tab: Time/General)
│   ├── Current offset table (this year)
│   ├── DST history: next change 2026-11-01 (EST)
│   ├── Compare to other zones: 5-10 cities in different tzs
│   └── Link to: /time-zones/zone/america-new-york/
│
├── [Section 3] Sun & Moon
│   ├── Sunrise 6:42 am ↑ 84° E
│   ├── Sunset 8:21 pm ↑ 276° W
│   ├── Day length: 13h 39m
│   ├── Moon phase: 75% (Waxing Gibbous)
│   ├── Moon rise / set
│   ├── Civil / Nautical / Astronomical twilight
│   └── Link to: /sun/usa/tampa/    ⚠️ need to build
│
├── [Section 4] Calendar
│   ├── Today's date: July 22, 2026
│   ├── Week of year, day of year
│   ├── Link to: /calendar/2026/?country=US&state=FL&city=tampa
│
├── [Section 5] Upcoming Holidays (US, 2026)
│   ├── Sep 7  Labour Day → /holidays/us/2026/#labour-day
│   ├── Oct 12 Columbus Day → /holidays/us/2026/#columbus-day
│   ├── Oct 12 Indigenous Peoples' Day
│   ├── Nov 11 Veterans Day
│   ├── Nov 26 Thanksgiving Day
│   └── Link to: /holidays/us/, /holidays/us/2026/
│
├── [Section 6] On This Day (events from US on 7-22)
│   ├── 1933  Wiley Post flies solo around world
│   │   → /onthisday/event/wiley-post
│   └── Link to: /onthisday/, /onthisday/by-date/7-22/
│
├── [Section 7] Famous people from Tampa
│   ├── 5-10 persons born in Tampa, FL     ⚠️ need persons D1 + birth_place
│   ├── 5-10 persons died in Tampa, FL
│   └── Each → /person/{slug}/
│
├── [Section 8] Time difference from Tampa
│   ├── Tampa vs New York: same
│   ├── Tampa vs London: +5 hours
│   ├── Tampa vs Tokyo: +13 hours
│   ├── Tampa vs Sydney: +14 hours
│   ├── Tampa vs Mumbai: +9.5 hours
│   └── Link to: /time-zones/difference/tampa/
│
├── [Section 9] Meeting planner with Tampa
│   ├── Find best meeting time with 2-5 cities
│   └── Link to: /meeting/?with=tampa
│
├── [Section 10] Nearby cities (haversine, 100km radius)
│   ├── St. Petersburg, FL (30 km W) → /world-time/city/st-petersburg-fl/
│   ├── Clearwater, FL (32 km W) → /world-time/city/clearwater-fl/
│   ├── Lakeland, FL (51 km E) → /world-time/city/lakeland-fl/
│   ├── Bradenton, FL (54 km S) → /world-time/city/bradenton-fl/
│   ├── Orlando, FL (134 km NE) → /world-time/city/orlando/
│   └── Link to: /world-time/usa/florida/  (state hub)
│
├── [Section 11] Other cities in Florida (top 20)
│   ├── Jacksonville, Miami, Tampa, Orlando, St. Petersburg, ...
│   └── Link to: /world-time/usa/florida/
│
├── [Section 12] Other cities in America/New_York tz
│   ├── New York, Philadelphia, Boston, Washington DC, Atlanta, ...
│   └── Link to: /time-zones/zone/america-new-york/
│
├── [Section 13] Tools
│   ├── → /meeting/?cities=tampa
│   ├── → /converter/tampa/
│   ├── → /event-time/?city=tampa
│   ├── → /distance/?from=tampa
│   ├── → /clock/tampa/  (embeddable widget)
│   └── → /time/usa/tampa/  (legacy timeanddate-style URL?)
│
├── [Section 14] Climate (12-month chart)
│   ├── Avg high: 89°F (Jul) / 70°F (Jan)
│   ├── Avg low: 75°F (Jul) / 50°F (Jan)
│   └── Link to: /climate/usa/tampa/    ⚠️ need to expose climate API
│
├── [Section 15] FAQ (5-10 questions)
│   ├── "What time is it in Tampa right now?" → live answer
│   ├── "Does Tampa observe DST?" → yes
│   ├── "What is Tampa's time zone?" → America/New_York
│   ├── "When is sunrise in Tampa today?" → 6:42 am
│   ├── "What is the population of Tampa?" → 414,547
│   └── 5-10 more
│
└── [Footer] "Other cities in USA" + sitemap link
```

### Total outbound links per page: ~60-100

This is the gold standard city page. Compare to timeanddate.com's Tampa
page which has ~30-50 links.

---

## Part 4 — Implementation order (recommended)

### Phase 1 (Week 1): Fix the data plumbing

These unblock everything else.

- [ ] **Fix `/api/v1/cities` filter** — make `?countryCode=X&stateCode=Y&timezone=Z` actually work
- [ ] **Add `/api/v1/cities/nearby?lat=&lon=&radius=`** — haversine on cities table
- [ ] **Add `/api/v1/cities/state/:cc/:state`** — list cities in a state
- [ ] **Add `/api/v1/cities/timezone/:iana`** — list cities in a timezone
- [ ] **Load `/tmp/otd-final/persons-top-50k.json` to D1** — ~50K persons
- [ ] **Add `birth_city_id`, `death_city_id` columns to otd_entities** — link persons to cities
- [ ] **Resolve `birth_place`, `death_place` strings to city_ids** — backfill

### Phase 2 (Week 2): Tampa city page template

Build the HTML template for one city and test it.

- [ ] **HTML template** for `/world-time/city/{slug}/` with all 15 sections above
- [ ] **Server-side render the time** — first paint shows correct time (no FOUC)
- [ ] **JSON-LD @graph** with City + WebSite + BreadcrumbList + FAQPage
- [ ] **Internal links** to country, state, tz, holidays, OTD, persons, etc.
- [ ] **Responsive** for mobile
- [ ] **Dehydrate hero location for SEO** — full content visible without JS
- [ ] **Static export** of top 1,000 cities

### Phase 3 (Week 3): State + country hubs

- [ ] **`/world-time/{country}/`** template — list all cities, holidays, OTD
- [ ] **`/world-time/{country}/{state}/`** template — list cities in state
- [ ] **`/time-zones/zone/{iana}/`** template — list all cities in tz
- [ ] **Add `state_hubs.json`** to migrations for fast lookup

### Phase 4 (Week 4): Sub-pages per city

- [ ] **`/world-time/city/{slug}/sunrise/`** — sun & moon for the year
- [ ] **`/world-time/city/{slug}/holidays/`** — all holidays in country for next 5 years
- [ ] **`/world-time/city/{slug}/weather/`** — placeholder (needs data source)
- [ ] **`/world-time/city/{slug}/climate/`** — 12-month climate chart (data exists)
- [ ] **`/world-time/city/{slug}/onthisday/`** — all OTD events in this city
- [ ] **`/world-time/city/{slug}/people/`** — famous people born/died here

### Phase 5 (Week 5+): Tools

- [ ] **Meeting planner** — pick 2-5 cities, find best time
- [ ] **Time converter** — Tampa + any other tz
- [ ] **Event time announcer** — fixed-time world clock for events
- [ ] **Distance calculator** — haversine between cities

---

## Part 5 — Data needed to be created

### New tables (or columns) to add

```sql
-- Add to otd_entities:
ALTER TABLE otd_entities ADD COLUMN birth_city_id INTEGER REFERENCES cities(id);
ALTER TABLE otd_entities ADD COLUMN death_city_id INTEGER REFERENCES cities(id);

-- Add to onthisday:
ALTER TABLE onthisday ADD COLUMN city_id INTEGER REFERENCES cities(id);
ALTER TABLE onthisday ADD COLUMN city_name TEXT;
ALTER TABLE onthisday ADD COLUMN importance_score INTEGER DEFAULT 0;

-- New table for airports:
CREATE TABLE airports (
  id INTEGER PRIMARY KEY,
  iata_code TEXT,
  icao_code TEXT,
  name TEXT,
  city_id INTEGER REFERENCES cities(id),
  country_code TEXT,
  latitude REAL,
  longitude REAL,
  timezone TEXT,
  elevation_m INTEGER
);
```

### Data to import (50K persons)

```bash
# Load the JSON file to D1
wrangler d1 execute timeandtimepro-dev --remote --file=seed-persons.sql
```

The seed script needs to:
1. Parse `/tmp/otd-final/persons-top-50k.json`
2. Insert each person to `otd_entities`
3. Resolve `birth_place` / `death_place` to `cities.id` via name + country match

### Data to import (airports)

Use **OurAirports** open data: https://ourairports.com/data/
- 75K+ airports worldwide
- Free, downloadable as CSV
- Has IATA, ICAO, name, city, country, lat/lon, timezone

---

## Part 6 — Per-page metadata templates

### City page (Tampa)

**Title:** Current Local Time in Tampa, Florida, USA — Date and Time
**Description:** Live clock, time zone, weather, and calendar for Tampa, Florida. Sunrise 6:42 am, sunset 8:21 pm. Population 414,547. America/New_York time zone.
**Canonical:** https://dateandtime.live/world-time/city/tampa/
**Hreflang:** 14 languages (en, es, pt, fr, de, it, nl, pl, ja, zh, ko, ar, ru, tr)

### JSON-LD @graph (full pattern)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://dateandtime.live/#website",
      "url": "https://dateandtime.live/",
      "name": "Date and Time"
    },
    {
      "@type": "City",
      "@id": "https://dateandtime.live/world-time/city/tampa/#city",
      "name": "Tampa",
      "alternateName": ["Tampa, Florida", "Tampa, FL"],
      "url": "https://dateandtime.live/world-time/city/tampa/",
      "description": "Tampa is a city in Florida, United States with a population of 414,547. It is in the America/New_York time zone.",
      "containedInPlace": {
        "@type": "State",
        "name": "Florida",
        "containedInPlace": {
          "@type": "Country",
          "name": "United States",
          "@id": "https://dateandtime.live/world-time/usa/#country"
        }
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 27.94752,
        "longitude": -82.45843,
        "elevation": 1
      },
      "timeZone": "America/New_York",
      "population": 414547,
      "sameAs": [
        "https://www.wikidata.org/wiki/Q38072",
        "https://en.wikipedia.org/wiki/Tampa,_Florida"
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://dateandtime.live/" },
        { "@type": "ListItem", "position": 2, "name": "World Time", "item": "https://dateandtime.live/world-time/" },
        { "@type": "ListItem", "position": 3, "name": "USA", "item": "https://dateandtime.live/world-time/usa/" },
        { "@type": "ListItem", "position": 4, "name": "Tampa" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What time is it in Tampa right now?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "It's currently 11:03:43 PM EDT in Tampa, Florida on Friday, March 27, 2026."
          }
        },
        {
          "@type": "Question",
          "name": "What time zone is Tampa in?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Tampa is in the America/New_York time zone (Eastern Daylight Time, UTC-4 during daylight saving time)."
          }
        }
      ]
    }
  ]
}
```

---

## Part 7 — Open questions

1. **Do we serve Tampa's homepage from D1 or a static file?**
   - Static (pre-rendered) is best for SEO + speed
   - D1 with edge cache is also fine
   - Recommendation: static for top 5,000 cities, dynamic for the rest

2. **How to handle the 2-3% of cities with the same name?**
   - Portland, OR (414, compton: 575, etc.)
   - Tampa, FL has no collision but Portland, OR vs Portland, ME does
   - Solution: use slug like `portland-or` (state suffix) when collision, or use GeoNames ID

3. **What about cities in disputed territories?**
   - Crimea (RU/UA), Taiwan, etc.
   - Use UN M49 code as canonical
   - For display, use English name + flag (or no flag for disputed)

4. **Should we redirect /api/v1/cities/{id} → /world-time/city/{slug}/?**
   - YES — for SEO. /api/ paths shouldn't be indexable.
   - Add `<link rel="canonical">` to /api/ responses
   - Add 301 from /api/v1/cities/{id}/ to /world-time/city/{slug}/

5. **Server-side render the time?**
   - YES for the initial HTML — first paint should show correct time
   - Then JS updates every second
   - This avoids FOUC and gives Google the time in the HTML

6. **Cache strategy?**
   - Static HTML for top 1K cities, cached at edge
   - Dynamic for the rest with Cloudflare Cache API (1-hour TTL)
   - City data changes once per ~year (DST transitions), so cache long

---

## Summary

| What | Status |
|---|---|
| City data (lat/lon/tz/pop) | ✅ Have it for 33,945 cities |
| US holidays 2026 | ✅ Have it (15 holidays) |
| OTD events for US/7-22 | ⚠️ Only 1 event for today (Wiley Post) |
| Persons in D1 | ❌ Only 3 of ~50K |
| Climate data | ✅ Have it (60K rows) but no API |
| DST transitions | ✅ Have it (1.5K rows) but no API |
| Nearby cities | ❌ API not implemented |
| State hubs | ❌ Not built |
| Airports | ❌ No data |
| Weather | ❌ No data source |
| Distance / meeting / converter | ❌ Not built |

**Net:** we have the core city/timezone data. We need to:
1. Fix the broken API filter endpoints
2. Add new endpoints (nearby, state, tz)
3. Load 50K persons to D1
4. Build the city page template
5. Build state + country hubs
6. Add per-city sub-pages
7. Add airport data
8. Add weather data source

Then we have a complete entity graph that Google can crawl, index, and rank.
