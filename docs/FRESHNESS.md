# City Page Freshness Strategy

> Last updated: 2026-07-22
> Per the plan locked in 2026-07-22 ("if we build all of these pages now, what's the plan for freshness?")

## TL;DR

**3 freshness tiers**, mixed per data type:

| Tier | What it covers | How | Regen |
|------|----------------|-----|-------|
| **Live (client)** | Time, weather, sun position today, geolocation | JS fetch on page load | Never (always fresh) |
| **Build snapshot** | OTD, holidays, city stats, people, JSON-LD, page copy | Pre-rendered into HTML at build time | On-content-change or weekly cron |
| **API (always live)** | Cities near me, dynamic person lookup, search | API endpoint called from JS | Never (live DB queries) |

## What lives where on the page

For each section of the city page, here's the freshness tier:

| Section | Tier | Data source | Regen trigger |
|---------|------|-------------|---------------|
| Hero (live time) | **Live** | `new Date().toLocaleTimeString()` in `requestAnimationFrame` | — |
| Hero (city name, coord, pop) | **Build** | From `/api/v2/search` | Weekly or on city data change |
| Quick info pills (weather, sun) | **Live** | Open-Meteo + computed sun position | — |
| 8 color-coded info blocks | **Mixed** | Live time + build city/tz data | On data change |
| Tampa in numbers | **Build** | From `/api/v2/search` | Quarterly or on city data change |
| Time difference table | **Build** | Hardcoded list of 8 cities | When new "key cities" added |
| Day in the life | **Build** | Curated content per city | When new content added |
| 7-day weather | **Live** | Open-Meteo | — |
| People (4 portraits) | **Build** | Top 4 by city_id from /otd_entities | When new persons ingested |
| OTD today (3 events) | **Build** | Today's date filtered from /onthisday | Daily if we want |
| Holidays (6 upcoming) | **Build** | Year-filtered from /holidays/{cc}/{yyyy} | Yearly (Dec 1 trigger) |
| Year-round climate (12 bars) | **Build** | From /cities/{id}/climate | When climate data refreshed |
| Cities near X (6) | **API** | /api/v1/cities/nearby?lat=&lon= | — (live) |
| Airports (3) | **API** | /api/v1/airports/nearby?lat=&lon= | — (live) |
| Footer (5-col link grid) | **Build** | Hardcoded top cities | When new top cities added |

## Why this mix works

**1. SEO is preserved.** Googlebot gets fully-rendered HTML with the build-snapshot data.
That's the bulk of the content (people, holidays, OTD, climate, narrative). Live sections
just need to not error on initial load.

**2. Per-section freshness decay** is naturally handled:
- Time / weather / sun = always live
- OTD / holidays / people = change rarely → build is fine
- "Cities near me" = need user location → API is the only way anyway

**3. Build size stays sane.** Each city page = 24KB. At 100 cities = 2.4MB. At 1,000
cities = 24MB. Cloudflare Pages can serve gigabytes; this is fine.

**4. Regen is incremental.** When new OTD events are added, we re-run the build script
for the affected dates. When new holidays come out, we regen at year boundary. When the
"top 10" city list changes, we regen those 10. We never have to rebuild 33,945 pages
for a single change.

## Cron schedule (planned)

```bash
# Daily — no-op, all live data
0 4 * * *  ./scripts/build-city-pages.js --only-stale > /dev/null 2>&1

# Weekly Sunday — check if any city has new OTD/holidays, regen if so
0 5 * * 0  ./scripts/build-city-pages.js --weekly-diff

# Yearly Dec 1 — switch to next year for holidays
0 6 1 12 *  YEAR=$(date +%Y) ./scripts/build-city-pages.js --year=$YEAR

# On-demand — when new content ingested
./scripts/build-city-pages.js --city=lisbon  # single city regen
```

The `--only-stale` flag does a cheap check: compare each city's data hash to a stored
manifest. Only rebuild changed pages. Most of the time, the answer is "nothing changed",
so the daily job is a 30-second check, not a full rebuild.

## What NOT to pre-render

- **Live weather** — would be stale within an hour
- **Live time** — always wrong
- **Distance from user** — needs geolocation
- **"What time is it there right now" widgets** — would be stale on page load

## Long tail (10,001+ cities)

For cities below the top 1,000, we'll use **dynamic SSR via Worker** instead of
pre-rendering. The Worker:
1. Fetches city data from D1 (~5ms)
2. Fetches OTD/holidays/climate from D1 (~10ms each)
3. Renders Template D with data injected (~5ms)
4. Returns the HTML (~30KB)
5. Cloudflare caches at the edge (cache key: URL + lang)

This is fast enough for SEO and fast enough for users. No build cost. No stale data.

## Open questions to resolve

1. **Where does the "people" section data come from for cities without OTD data?**
   Currently we use Wikipedia curated top-4 by city. For 33,945 cities, this isn't
   scalable. We need a "famous people born/died in city X" endpoint, which depends
   on backfilling `birth_city_id` / `death_city_id` on `otd_entities` (Phase 1B — done).
   The endpoint query: `SELECT label, description, image_url, year FROM otd_entities
   WHERE birth_city_id = ? ORDER BY sitelinks DESC LIMIT 4`. This needs Phase 1D
   (load 50K persons to D1) to be useful.

2. **How do we get the airport data?** OurAirports CSV. No API for "airports near X"
   yet. Would need a small new endpoint and import.

3. **Cron infrastructure** — we have a `cron-worker.js` in the API repo but it's not
   set up. Needs: trigger schedule + write to a D1 "needs_rebuild" table + a worker
   consumer that calls the build script.

## Decision log

- **2026-07-22**: Locked the 3-tier freshness model above. Going forward, every
  new section on the city page must declare its tier before build.
- **2026-07-22**: Top 1,000 cities = pre-render. 1,001+ = dynamic SSR. No hybrid.
- **2026-07-22**: Open-Meteo chosen for weather (free, no key, CC-BY 4.0 attribution
  required — already shown in footer).
