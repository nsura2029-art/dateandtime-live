# dateandtime-live API

> **Base URL**: `https://api.dateandtime.live/api/v1/`
> **Source repo**: `cloudflare/datetime-api/` in `dateandtime-live`
> **Architecture**: Cloudflare Workers + D1 (SQLite) + 12-source ingestion pipeline
> **Last updated**: 2026-07-20

## Endpoints (16 total)

### 🆕 New endpoints (built 2026-07-20 for the homepage + per-entity detail pages)

| Method | Path | Purpose | Response shape |
|--------|------|---------|----------------|
| GET | `/person/{slug}` | Per-person detail (image, brief desc, full data) | `{ id, label, birthDate, deathDate, starSign, chineseZodiac, image:{url,license,credit}, briefDescription, onthisdayEntries, knowledgeGraphLinks, ... }` |
| GET | `/person/today` | Today's birthdays (top N) | `{ date, persons:[{label, birthYear, image, starSign, kgLinks}] }` |
| GET | `/person/born/{MM-DD}` | Birthday-twin tool (top N per date) | Same as `/person/today` |
| GET | `/person/{slug}/onthisday` | All OTD entries mentioning this person | `{ person, entries:[...] }` |
| GET | `/onthisday/event/{slug}` | Per-event detail (image, description, related) | `{ title, year, type, briefDescription, longDescription, keyPeople, image, relatedEvents, kgLinks, ... }` |
| GET | `/onthisday/event/{slug}/related` | Related events (same date, year, entity) | `{ event, related:[...] }` |
| GET | `/time/now/multi` | Batched time lookup for "Today on Earth" strip | `{ serverTime, results:[{cityId, time, date, timezone, offset, isDst}] }` |
| GET | `/snapshot` | Combined today's snapshot (holiday + OTD + DST + sun) | `{ date, holiday, onthisday, sunTimes, attribution }` |

### Existing endpoints (read-only public API)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/cities` | 33,945 cities with lat/lon/tz |
| GET | `/cities/:id` | Single city |
| GET | `/countries` | 242 countries |
| GET | `/countries/:cca2` | Single country |
| GET | `/timezones` | 408 IANA timezones |
| GET | `/time/now` | Current time for one city |
| GET | `/time/sun` | Sunrise/sunset for a city |
| GET | `/holidays/{CC}/{YYYY}` | Public holidays for country+year |
| GET | `/onthisday` | Today's OTD entries |
| GET | `/onthisday/born/{MM-DD}` | Born-on-day list |
| GET | `/onthisday/died/{MM-DD}` | Died-on-day list |
| GET | `/onthisday/today` | Same as `/onthisday` with date=today |
| GET | `/onthisday/holidays/{CC}/{YYYY}` | Holidays for country+year |
| GET | `/onthisday/national-days` | 88 curated international days |
| POST | `/onthisday` | Bulk-ingest new entries (internal) |
| GET | `/ask` | RAG-based Q&A (Gemini 2.5 Flash-Lite) |

## Slug formats

### Person slugs
- **Wikidata Q-ID**: `Q937` (Albert Einstein)
- **Wikipedia title**: `Albert_Einstein` (URL-safe form)
- **Name slug**: `einstein` (last-name only, fuzzy match)
- **Full name slug**: `albert-einstein`, `brian-may`

### Event slugs
- **Wikidata Q-ID**: `Q11631` (Apollo 11)
- **Wikipedia title**: `Apollo_11`
- **Year-title**: `1969-apollo-11` (recommended for SEO)
- **Title only**: `apollo-11` (fuzzy match)

## Response shape contracts (locked 2026-07-20)

### Person response
```json
{
  "id": "Q937",
  "wikidataId": "Q937",
  "label": "Albert Einstein",
  "description": "German-born theoretical physicist...",
  "briefDescription": "...",   // 1-2 sentence bio
  "longDescription": "...",     // Detailed bio
  "entityType": "person",
  "birthDate": "1879-03-14",
  "deathDate": "1955-04-18",
  "birthYear": 1879,
  "deathYear": 1955,
  "countryCode": "DE",
  "profession": ["physicist", "mathematician"],
  "starSign": "pisces",
  "chineseZodiac": "goat",
  "generation": "lost_generation",
  "causeOfDeath": "abdominal aortic aneurysm",
  "ageAtDeath": 76,
  "image": {
    "url": "https://upload.wikimedia.org/...",
    "license": "CC BY-SA 4.0",
    "credit": "Oren Jack Turner",
    "artist": "..."
  },
  "onthisdayEntries": [...],
  "knowledgeGraphLinks": {
    "wikidata": "https://www.wikidata.org/wiki/Q937",
    "wikipedia": "https://en.wikipedia.org/wiki/Albert_Einstein",
    "bornOnPage": "https://dateandtime.live/onthisday/born/03-14/",
    "diedOnPage": "https://dateandtime.live/onthisday/died/04-18/",
    "profile": "https://dateandtime.live/person/albert-einstein/"
  },
  "sources": [...],
  "attribution": {
    "text": "Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0.",
    "textUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "wikimediaFeed": "https://api.wikimedia.org/feed/v1/wikipedia/",
    "byabbe": "https://byabbe.se/",
    "muffinlabs": "https://history.muffinlabs.com/",
    "nagerDate": "https://date.nager.at/Api",
    "wikidata": "https://www.wikidata.org/"
  }
}
```

### Event response
```json
{
  "id": "Q11631",
  "title": "Apollo 11 lands on the Moon",
  "type": "event",
  "year": 1969,
  "month": 7,
  "day": 20,
  "yearPrecision": "day",
  "briefDescription": "...",
  "longDescription": "...",
  "keyPeople": ["Neil Armstrong", "Buzz Aldrin", "Michael Collins"],
  "keyFacts": ["First crewed Moon landing", "..."],
  "faqQuestions": ["Who was the first person on the Moon?", "..."],
  "image": {
    "url": "https://upload.wikimedia.org/...",
    "license": "CC BY-SA 4.0",
    "credit": "NASA / Neil Armstrong",
    "width": 330,
    "height": 250,
    "sourceUrl": "https://en.wikipedia.org/wiki/Apollo_11"
  },
  "wikidataId": "Q11631",
  "wikipediaUrl": "https://en.wikipedia.org/wiki/Apollo_11",
  "wikipediaTitle": "Apollo_11",
  "countryCode": "US",
  "region": "Texas",
  "yearsAgo": 57,
  "isAnniversaryToday": false,
  "rankScore": 95,
  "relatedEvents": [
    { "relation": "same-date-different-year", "title": "...", "year": ..., "wikipediaUrl": "..." }
  ],
  "knowledgeGraphLinks": {
    "wikidata": "https://www.wikidata.org/wiki/Q11631",
    "wikipedia": "https://en.wikipedia.org/wiki/Apollo_11",
    "date": "https://dateandtime.live/onthisday/by-date/07-20/",
    "country": "https://dateandtime.live/time-zones/in/us/"
  },
  "sources": [
    { "name": "wikipedia_feed", "license": "CC BY-SA 4.0" },
    { "name": "wikidata_qlever", "license": "CC0" }
  ],
  "verified": true,
  "attribution": { ... }
}
```

### Multi-time response
```json
{
  "serverTime": "2026-07-21T02:42:22.811Z",
  "requested": 3,
  "succeeded": 3,
  "results": [
    {
      "cityId": 5128581,
      "cityName": "New York",
      "country": "US",
      "timezone": "America/New_York",
      "time": "22:42:22",
      "date": "2026-07-20",
      "dayOfWeek": "Monday",
      "abbr": "EDT",
      "offset": "-04:00",
      "offsetMinutes": -240,
      "isDst": true
    },
    ...
  ]
}
```

## Cache strategy

| Endpoint | Browser TTL | Edge TTL | Notes |
|----------|-------------|----------|-------|
| `/person/*` | 1 hour | 24 hours | CC BY-SA attribution is permanent |
| `/onthisday/event/*` | 1 hour | 24 hours | CC BY-SA attribution is permanent |
| `/time/now/multi` | 5 min | 10 min | Time changes per-second; client refreshes via rAF |
| `/snapshot` | 5 min | 10 min | Same as above |
| `/ask` (RAG) | 1 min | 5 min | Pre-gen cache hits 90%+ |

## Deployment

The Worker combines all route modules. Required `wrangler.toml`:

```toml
name = "datetime-api"
main = "worker.js"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "OTD_DB"
database_name = "timeandtimepro-full"
database_id = "<UUID>"

[vars]
OTD_DATES_DIR = "/tmp/otd-data-final/dates"
OTD_WEDDINGS_DIR = "/tmp/otd-weddings/by-date"
OTD_PERSONS_FILE = "/tmp/otd-final/persons-top-50k.json"
```

Deploy:
```bash
cd cloudflare/datetime-api
wrangler deploy --name datetime-api
```

## Local testing

```bash
# Run the test harness (16 tests, all should pass)
node cloudflare/datetime-api/test-api.js

# Run the smoke test (full response dumps)
node cloudflare/datetime-api/smoke-test.js
```

## Source provenance

All Wikimedia-derived data is **CC BY-SA 4.0**. Per-page attribution is mandatory.
Each API response includes an `attribution` block with source URLs and license info.

12 data sources registered:
- `wikipedia_feed` — primary
- `wikidata_qlever` — primary (100x faster than WDQS)
- `byabbe` — cross-check mirror
- `muffinlabs` — cross-check mirror
- `nager_date` — holidays (197 countries)
- `openholidays` — EU holidays
- `day_page` — recency backfill
- `pageviews` — WM pageviews API
- `dbpedia` — inbound links signal
- `commons_api` — image metadata
- `chronicling_america` — US newspapers (stub)
- `wikipedia_featured` — featured content (stub)

## Architecture

```
Sources (12 connectors)
    ↓
Ingestion (fetch-otd-batch + fetch-weddings)
    ↓
Multi-source dedup (strict Q-ID + fuzzy Jaccard 0.7)
    ↓
Provenance capture (per-row CC BY-SA)
    ↓
Notability scoring (0-100, pre-computed at ingest)
    ↓
D1 persistence (entities + on_this_day + observances + holidays + reports)
    ↓
Worker API (16 endpoints with edge caching)
    ↓
RAG pipeline (retrieval-only, refusal-on-no-data, Gemini Flash-Lite)
```

## Data flow for new endpoints

```
GET /api/v1/person/{slug}
    ↓
  Route: routes/person.js
    ↓
  Either:
    a) D1 query (prod): queryEntity() + queryOTD()
    b) File fallback (dev): loadEntityFromFile() + loadEntriesForEntityFromFiles()
    ↓
  Normalize to public JSON (camelCase)
    ↓
  Build knowledgeGraphLinks from Q-IDs
    ↓
  Add CC BY-SA attribution
    ↓
  Cache headers (1h browser, 24h edge)
    ↓
  Response
```

## Related

- Blueprint: `docs/otd-pipeline/TODO.md`
- Schema: `cloudflare/datetime-api/migrations/011_otd_blueprint_fields.sql`
- Ingestion: `scripts/fetch-otd-batch.js`, `scripts/fetch-weddings.js`
- Homepage mockup: `homepage-tier1-preview.html` (Tier 1/2/3 changes preview)
