# dateandtime.live — Project Progress

> Last updated: 2026-07-25
> Tracking all work shipped to dev. Each entry has date, what shipped, files changed, and how to test.

## Live URLs

| Resource | URL | Status |
|----------|-----|--------|
| Frontend (dev) | https://tdp-landing-dev.nsura2029.workers.dev/ | ✅ Live |
| API (dev) | https://datetime-api-dev.nsura2029.workers.dev/api/v1/ | ✅ Live |
| API (custom domain) | https://dev.api.dateandtime.live/api/v1/ | ✅ Live |
| Cron worker (dev) | https://city-cron-dev.nsura2029.workers.dev/ | ✅ Live |
| City page preview (D) | https://tdp-landing-dev.nsura2029.workers.dev/city-page-preview/D-data-hub.html | ✅ Live |
| City page (Tampa, NEW path) | https://tdp-landing-dev.nsura2029.workers.dev/world-time/us/tampa/ | ✅ Live |
| City page (Tampa, old path) | https://tdp-landing-dev.nsura2029.workers.dev/world-time/city/tampa/ | 301 → new path |
| API (prod) | https://api.dateandtime.live/api/v1/ | ✅ Live (legacy routes) |
| Frontend (prod) | https://dateandtime.live/ | ✅ Live (NOT updated with new features) |

---

## 2026-07-25 — World Time hub redesign: hybrid page + URL migration

**Goal:** the /world-time/ hub now lists 250 popular cities in a 5-col alphabetical grid (each linking to its dedicated page) — inspired by timeanddate.com/worldclock/. All 911 city pages migrated to the new canonical URL pattern `/world-time/{country}/{slug}/`, with 301 redirects from the old `/world-time/city/{slug}/` path. New API endpoint `/api/v1/cities/popular` powers the grid (filterable, sortable, enriched with flag emoji + canonical path).

### Phase 1 — API ready (`cloudflare/datetime-api/routes/cities.js`, +250 lines)

- **New endpoint: `GET /api/v1/cities/popular`**
  - Query params: `limit` (default 200, max 500), `continent` (AF/AS/EU/NA/OC/SA), `country` (cca2), `isCapital` (1), `sort` (population|name|country)
  - Returns top N cities with `flagEmoji` (computed via Unicode regional indicators), `path` (canonical /world-time/{country}/{slug}/), `continent` (derived from unRegion + unSubregion)
  - 1h in-memory cache + 1h edge cache
  - Slug fallback: `slugify(name)` for the 33K cities we haven't pre-built
- **Continent derivation** — the prod API returns `continent: null` for all countries, so we map from `unRegion` (Africa → AF, Asia → AS, Europe → EU, Oceania → OC, Antarctic → AN) + `unSubregion` (Americas splits into NA / SA)
- **Deployed to dev:** `https://datetime-api-dev.nsura2029.workers.dev/api/v1/cities/popular`

### Phase 2 — URL migration: `/world-time/city/{slug}/` → `/world-time/{country}/{slug}/`

- **911 city pages regenerated** at the new path (`world-time/{country}/{slug}/index.html`, 73MB total across 133 country directories)
- **Build script** (`scripts/build-city-pages.js`) updated:
  - Output path: `world-time/city/{slug}/index.html` → `world-time/{country}/{slug}/index.html`
  - All internal links (canonical, nearby cities, sub-page anchors) updated to new pattern
  - Hardcoded popular city links (NY/London/Tokyo/Sydney/Dubai) updated
- **Old files kept on disk** (additive — no section deleted from any page)
- **301 redirects** (`src/index.js` + `src/slug-data.js`):
  - 911-entry compact slug→cca2 map (10.8KB) parsed at module init
  - Old URL → 301 → new URL (e.g. `/world-time/city/tampa/` → `/world-time/us/tampa/`)
  - Unknown slugs fall through to the legacy asset (graceful)
  - Note: wrangler 4.x couldn't parse the 911-entry JS object literal directly; switched to a compact `slug,country|...` string + runtime parser
- **Verified live:**
  - `/world-time/city/tampa/` 301 → `/world-time/us/tampa/`
  - `/world-time/city/london/` 301 → `/world-time/gb/london/`
  - `/world-time/us/tampa/` 200 (43KB, all 8 sections + new internal links)

### Phase 2b — URL migration v2: `/world-time/{cca2}/{slug}/` → `/world-time/{country-name-slug}/{slug}/`

- **911 city pages regenerated** at the new path: `world-time/{country-name-slug}/{slug}/index.html`
  (e.g. `/world-time/united-states/tampa/`, `/world-time/united-kingdom/london/`, `/world-time/china/beijing/`)
  - Old `/world-time/city/{slug}/` and `/world-time/{cca2}/{slug}/` files deleted from the repo (the Worker 301 handlers stay)
- **Country-name slug map** (`scripts/cc2-country-slug.json` + `src/cc2-country-slug.js`):
  - 242-entry compact `CC,slug|...` string (3.5KB), parsed at module init
  - `US` → `united-states`, `GB` → `united-kingdom`, `CN` → `china`, etc.
  - Same compact-string trick used to dodge wrangler 4.x's JS-object-literal parse failures
- **Worker redirects** (`src/index.js`):
  - `CCA2_TO_COUNTRY_SLUG` map (242 entries, uppercase keys)
  - `legacyCityMatch` (was: city→cca2) now goes **directly** to the country-name path, not via the cca2 path. Single 301 hop from `/world-time/city/{slug}/` to `/world-time/{country-name}/{slug}/`
  - New `cca2CityMatch` handler: `/world-time/{cca2}/{slug}/` → 301 → `/world-time/{country-name}/{slug}/`
  - **Sub-page tail handling**: `/world-time/city/{slug}/time/`, `/facts/`, `/weather/`, `/map/` are all normalized to the parent city page (since the new build is single-file with all sections inline). e.g. `/world-time/city/tampa/weather/` 301 → `/world-time/united-states/tampa/`
- **API** (`/api/v1/cities/popular`): `path` field now uses country-name slug (e.g. `/world-time/china/beijing/` not `/world-time/cn/beijing/`)
- **Verified live (single hop):**
  - `/world-time/city/tampa/` 301 → `/world-time/united-states/tampa/` 200
  - `/world-time/city/london/` 301 → `/world-time/united-kingdom/london/` 200
  - `/world-time/us/tampa/` 301 → `/world-time/united-states/tampa/` 200
  - `/world-time/city/tampa/weather/` 301 → `/world-time/united-states/tampa/` 200
  - `/world-time/gb/london/` 301 → `/world-time/united-kingdom/london/` 200

### Phase 3 — New `/world-time/` hub (hybrid design)

- **Section 1: Featured live clocks** (kept from v1) — 12 cities, 1Hz updates
- **Section 2: City grid** (NEW) — 5-col alphabetical grid of 250 popular cities
  - Each row: flag emoji + city name (link to /world-time/{country}/{slug}/) + country + live local time (1Hz)
  - 27 letter groups (A–Z)
  - 7 continent filter pills: All, Africa, Asia, Europe, N. America, Oceania, S. America
  - 3 sort options: Popular (default), City A-Z, Country
  - localStorage-cached (24h TTL) to avoid hammering the API
- **Section 3: Tools + FAQ** (kept from v1)
- **Schema**: 4 types now — WebApplication, BreadcrumbList, FAQPage, **ItemList** (hydrated from `window.__popularCities` after the JS loads so Google sees the full list, not an empty div)
- **Files added/changed:**
  - `src/world-time-cities.js` (NEW, 7.5KB) — fetch + render + live clocks
  - `src/tz-hub.css` (+250 lines) — `.wt-filters`, `.wt-city-grid`, `.wt-letter-group`, `.wt-city-row`
  - `world-time/index.html` — added `<section class="wt-city-section">` + new script + ItemList emitter

### Verification

| Check | Result |
|---|---|
| API endpoint returns 3 cities | ✅ Beijing, Kinshasa, Mexico City (with flagEmoji + path) |

### Phase 4 — Card redesign matching home page (`/world-time/` hub, 2026-07-25)

Replaced the 5-column alphabetical list with a card-based layout that mirrors
the home page's `city-card` visual language. Two grouping strategies with
per-section "Load more" buttons:

**Sections (6 total, 1 top + 5 region):**
- **🕐 Top popular cities** — 5 visible by default, "Load more" → all 250
- **🌏 By region** — for each of Asia, Europe, Americas, Africa, Oceania:
  - 3 visible by default, "Load more" → all in that region
  - Americas combines North + South America
- Empty sections are auto-hidden (e.g. when a continent filter is active)

**Card structure** (matches home page `city-card`):
- **Header** — green live dot (pulse animation) + flag + city name + × close button
- **Big mono time** — `HH:MM:SS.MS` (with milliseconds), `clamp(1.125rem, 2.4vw, 1.5rem)` font, font-weight 800
- **Meta row** — timezone (mono) + `·` + day label (`today` / `tomorrow` / `yesterday` / `+N d`) + offset pill (`+8 H` / `-6 H`)
  - Offset pill is green for positive, amber for negative, neutral for same-tz

**Live updates:** per-card time, day label, and offset pill all re-render
every `requestAnimationFrame` (~60fps) using `Intl.DateTimeFormat` + the
IANA tz offset diff.

**Close button:** `×` on each card hides it from the section for the current
session (no persistence — user re-renders on reload). Card body still
navigates to the city page.

**Files added/changed:**
- `src/world-time-cities.js` (15.7KB) — rewritten to render cards + sections
- `src/tz-hub.css` (+265 lines) — `.wt-card`, `.wt-card-head`, `.wt-live-pulse`,
  `.wt-card-time`, `.wt-card-meta`, `.wt-card-pill`, `.wt-card-grid`,
  `.wt-section`, `.wt-section-head`, `.wt-load-more`
- `world-time/index.html` — replaced the 5-col alphabetical grid with 6
  `<div class="wt-section">` blocks (top + 5 region), with per-section
  Load more buttons
- `screenshots/world-time-hub-light.png` + `world-time-hub-dark.png` +
  `world-time-hub-mobile.png` (NEW)

**Verified live (1280x1800 desktop + 390x800 mobile, light + dark themes):**
- Top section: 5 → 250 cards on Load more
- Asia section: 3 → 119 cards on Load more (3 → 41 for Americas, 3 → 48 for Africa, etc.)
- Cards have: live green dot (pulse), city name with flag, × close, big mono time with ms, timezone + day + offset pill
- Mobile (390px wide): 2-col card grid, all sections still legible
- No console errors / warnings
- API call: `GET /api/v1/cities/popular?limit=250` → 200 OK
| 250 city rows in grid | ✅ |
| 27 letter groups | ✅ |
| 7 continent filters + 3 sort options | ✅ |
| 4 schema types (WebApp, Breadcrumb, FAQ, ItemList) | ✅ |
| Click city in grid → navigates to /world-time/{country}/{slug}/ | ✅ |
| /world-time/city/{slug}/ → 301 → /world-time/{country}/{slug}/ | ✅ Tampa, London, Tokyo, Mumbai all redirect |
| New /world-time/us/tampa/ page loads with all 8 sections | ✅ |
| No console errors | ✅ |

### What changed in files

- `cloudflare/datetime-api/routes/cities.js` (+250 lines)
- `src/slug-data.js` (NEW, 10.8KB)
- `src/index.js` (+30 lines, 301 redirect handler)
- `src/world-time-cities.js` (NEW, 7.5KB)
- `src/tz-hub.css` (+250 lines)
- `scripts/build-city-pages.js` (output path + all internal links updated)
- `scripts/cities-911-build.json` (NEW, input for the build run)
- `world-time/{country}/{slug}/index.html` — 911 NEW city pages
- `world-time/city/{slug}/index.html` — 911 OLD city pages (kept, redirected)
- `world-time/index.html` — added city grid section + script
- `screenshots/screen-wt-new-top.png` + `screen-wt-new-grid.png` (NEW)

### Open follow-ups (not done in this batch)

- Sub-page URL tails (`/time/`, `/facts/`, `/weather/`, `/map/`) — the Worker now 301s them to the parent city page so the chain doesn't end in 404, but the URLs are not first-class pages. If/when SEO data shows that users want the per-section deep links, build them out as separate files.
- Scale city page coverage from 911 to all 33,945 (would need KV or R2 storage for the assets; current deploy is already ~73MB at the new path).
- The 7-city continent filter could be expanded with sub-region pills (Caribbean, Central America, etc.).

---

## 2026-07-22 — City pages at scale + freshness infrastructure

**Major shipping day.** Built Template D city page, scaled to 1,011 cities, wired all 3 freshness tiers.

### Morning: Template D (Data Hub)
- **File**: `docs/seo/city-page-templates/D-data-hub.html` (54KB)
- **Live**: https://tdp-landing-dev.nsura2029.workers.dev/city-page-preview/D-data-hub.html
- **TAD-inspired**: 8 color-coded info blocks (no card aesthetic)
- **21 sections, 2 ad slots, light + dark mode**
- 3 other templates (A: Bento, B: Dashboard, C: Story) for A/B testing

### Midday: Phase 1A + 1B migration
- **File**: `cloudflare/datetime-api/migrations/012_city_links.sql`
- Applied to dev D1
- Added `city_id`, `city_name`, `country_name` to `onthisday`
- Added `birth_city_id`, `death_city_id` to `otd_entities`
- Created 2 views: `v_otd_with_city`, `v_entities_with_cities`

### Midday: First 10 city pages
- `scripts/build-city-pages.js` (Node.js, uses prod API)
- **Live**: https://tdp-landing-dev.nsura2029.workers.dev/world-time/city/{slug}/
- 10 cities: NY, LA, London, Tokyo, Sydney, Mumbai, São Paulo, Paris, Dubai, Singapore
- Worker route: `/world-time/city/{slug}/` → static `index.html`
- Each page: ~25KB single-file HTML, live time, IANA tz-aware

### Afternoon: Freshness strategy
- **File**: `docs/FRESHNESS.md` (5.8KB)
- **3-tier model**:
  1. **Live (client JS)**: time, weather, sun, geolocation
  2. **Build snapshot**: OTD, holidays, city stats, people, JSON-LD
  3. **API (always live)**: cities-near, dynamic lookup
- Cron plan: weekly stale-page regen, yearly Dec 1 regen

### Afternoon: Scale to 1,011 cities
- `scripts/get-next-100-cities.js` (N=900) + `scripts/cities-next-900.json`
- `CONCURRENCY=10` in build script: **900 cities in 77s**
- 11 duplicate slugs detected (hyderabad IN/PK, valencia ES/VE, etc.)
- Total: 1,011 city pages, ~37MB deployed

### Afternoon: 3 freshness features
1. **`/api/v1/cities/nearby` endpoint** (haversine in SQL)
   - 5 query params: lat, lon, limit, country, radius, minPopulation
   - Test: `curl ".../cities/nearby?lat=27.95&lon=-82.46&limit=3"` → Tampa 0.3km, Orlando 124.4km
2. **12-month climate chart** on city pages (Section 08)
   - Fetches from `/api/v1/cities/{id}/climate`
   - Lat/lon-based fallback when D1 climate missing
3. **Cron worker** (`city-cron-dev`)
   - 8 endpoints: `/health`, `/status`, `/stale`, `/debug/run`, `/scan-batch`, `/scan-all`, `/trigger/scan`, `/trigger/yearly`
   - FNV-1a content hash for change detection
   - KV-backed (`CITY_BUILDS` namespace)

### Evening: Cron chunked to 20-city batches
- New endpoints: `/scan-batch?offset=N&limit=M` and `/scan-all?sync=1`
- `BATCH_SIZE=20` per Worker invocation (avoids 30s timeout)
- Full scan: 10 batches in parallel via `Promise.all`
- Direct function call (not fetch to self — CF Workers' internal fetch returns 404)
- 190 cities in 2s via `/scan-all?sync=1`
- 1000 cities estimated: ~10s

### Evening: D1 consistency gotcha discovered
- After `UPDATE cities SET ...`, wait **3+ seconds** before scanning
- D1 has read-after-write lag within same region
- Test: scan 0s after update = stale=0, scan 3s+ = correct

### Bug patterns hit (this session)
- **D1 SQL: no POWER()** — use `SIN(x)*SIN(x)` instead
- **D1 SQL: ambiguous columns on JOIN** — use `table.col` prefix
- **Dev D1 schema differs from prod**: cities uses `country`, `tz`, `is_capital` (snake_case) not camelCase
- **Country table column is `iso2` not `cca2`**
- **Wrangler CLI defaults to local KV** — need `--remote` flag
- **Wrangler 4 cron trigger API returns "non-user error"** — deploy worker without triggers, add via dashboard
- **Worker `env.ASSETS.fetch()` returns 307** — must follow redirect
- **Cloudflare Workers' internal `fetch()` to own URL returns 404** — call function directly
- **Deploy.sh 25MB asset limit** — stash `.git` to `/tmp/deploy-backup-$$/`

---

## 2026-07-21 — Homepage Tier 1+2+3 + OTD API

### Tier 1 (homepage)
- JSON-LD with city detection, pill links, "Today on Earth" strip
- 9 new endpoints for person, event, time-multi, snapshot, year, OTD
- 3 new files: `src/index.js`, `src/api-data.js`, `src/world-clock-hub.js`
- Schema 011 applied to dev D1 (8 new tables, 56 indexes)

### Tier 2 + 3 (8 new homepage sections)
- 4d. Knowledge base chip cloud
- 4e. Today's snapshot
- 4f. Long weekend finder (with bridge rule algorithm)
- 4g. Did you know?
- 4h/i/j. Famous birthdays + deaths (6 cards each)
- 4k. Year timeline (12 monthly highlights)

### Critical bug patterns (Tier 2/3)
- Missing `</script>` tag at line 1271 → entire inline JS fails
- `getElementById("onthisday")` returns null → TypeError
- `api-data.js` loaded with `defer` runs after inline script → timing race

### Educational + Country pages
- 3 educational pages: `/time-zones/what-is/`, `/dst/`, `/utc/`
- 146 country pages: `/time-zones/in/{cca2}/`
- Build: `scripts/build-country-pages.js`

---

## API Architecture

### Routes (one file per resource, exports `handle(env, path, request)`)
- `routes/person.js` — per-person + birthday-twin
- `routes/event.js` — per-event detail pages
- `routes/otd.js` — on-this-day, born, died, today, holidays
- `routes/cities.js` — nearby, by-id, climate (NEW 2026-07-22)
- `routes/time-multi.js` — batched time lookup
- `routes/year.js` — year-page data

### City data API (all live)
- `GET /api/v1/cities?countryCode=&stateCode=&search=&limit=&offset=` — list
- `GET /api/v2/search?q=&limit=` — full-text search
- `GET /api/v1/cities/nearby?lat=&lon=&limit=&country=&radius=&minPopulation=` — haversine
- `GET /api/v1/cities/:id` — single city
- `GET /api/v1/cities/:id/climate` — 12 months + seasons
- `GET /api/v1/cities/:id/aliases` — historical names

### OTD API
- `GET /api/v1/on-this-day/{MM-DD}?limit=` — events + births + deaths
- `GET /api/v1/born/{MM-DD}` — persons only
- `GET /api/v1/died/{MM-DD}` — deaths only
- `GET /api/v1/today` — today's date + payload
- `GET /api/v1/holidays/{CC}/{YYYY}` — Nager data
- `GET /api/v1/national-days/{MM-DD}` — observances

---

## D1 Database State

### Dev D1 (`timeandtimepro-dev`)
- 190 cities, 1 OTD event, 2 entities (mostly empty)
- Migration 012 applied (city links)
- Climate tables not loaded (no climate data)

### Prod D1 (`timeandtimepro-full`)
- 33,945 cities, 71,992 OTD events, 50K persons
- 60,972 climate rows, 1,560 DST transitions
- 880 holidays, 16,378 seasons

---

## Cron Worker

**URL**: https://city-cron-dev.nsura2029.workers.dev
**KV namespace**: `CITY_BUILDS` (id: `46c07adb1de34bc790b81984607d69d9`)

### 8 endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/status` | Last scan summary |
| GET | `/stale` | List of cities needing rebuild |
| GET | `/debug/run` | Sync 1-batch scan |
| GET | `/scan-batch?offset=N&limit=M` | Process one batch |
| GET | `/scan-all?sync=1` | Full scan (parallel batches) |
| POST | `/trigger/scan` | Async trigger (legacy) |
| POST | `/trigger/yearly` | Mark all for yearly rebuild |

### Cron schedule (to be set in CF dashboard)
- Weekly Sunday 04:00 UTC: scan for stale city pages
- Yearly Dec 1 05:00 UTC: full rebuild for holiday year transition

### Performance
- 20 cities: 68ms (cached) / ~2s (fresh)
- 190 cities: 2-3s (10 batches parallel)
- 1100 cities: ~10s (50 batches parallel)

---

## City Pages

### 1,011 cities deployed
- 11 originals: NY, LA, London, Tokyo, Sydney, Mumbai, São Paulo, Paris, Dubai, Singapore, Tampa
- 900 from top-pop query (Shanghai, Beijing, Delhi, Cairo, etc.)
- Each page: ~40KB, includes live time, weather, holidays, climate chart

### 11 duplicate slugs (TODO for next iteration)
- hyderabad: India + Pakistan
- suzhou, taizhou, fuzhou, baoshan, changzhi, changsha, puyang: multiple China cities
- valencia: Spain + Venezuela
- barcelona: Spain + Venezuela
- gorakhpur: 2 in India
- **Fix**: Disambiguate with country code suffix (`hyderabad-in`, `valencia-es`, etc.)

### Template D features per page
1. Hero (editorial 2-col)
2. Quick info pill bar (10 pills)
3. 8 TAD-style color-coded info blocks
4. Sun arc + 5-stat row
5. City in numbers (6 stat cells)
6. Time difference (8 cities)
7. **Ad slot 1**
8. Day-in-the-life timeline (5 events)
9. 7-day weather forecast
10. People (4 editorial portraits)
11. On this day (3 events)
12. Holidays (6 upcoming)
13. **Ad slot 2**
14. Climate year-round (12 bars)
15. City in context (paragraph)
16. Famous for (11 pill tags)
17. Nearby cities (6)
18. Airports (3) — TODO
19. Tools (4)
20. More to explore (5 link grid)
21. Footer (5-col + legal)

---

## Files Reference

### Build scripts
- `scripts/build-city-pages.js` — generates city pages from API
- `scripts/get-next-100-cities.js` — fetches next N cities by population
- `scripts/build-country-pages.js` — generates country pages
- `scripts/build-otd-from-data.js` — OTD data import
- `scripts/deploy.sh` — deploys landing worker to dev/prod

### Cron
- `cloudflare/datetime-api/cron-cities.js` — main worker
- `cloudflare/datetime-api/wrangler-cities.toml` — config (KV, D1, cron)

### Templates
- `docs/seo/city-page-templates/A-editorial-bento.html` (26KB)
- `docs/seo/city-page-templates/B-live-dashboard.html` (26KB)
- `docs/seo/city-page-templates/C-story-hero.html` (23KB)
- `docs/seo/city-page-templates/D-data-hub.html` (54KB) — canonical
- `docs/seo/city-page-templates/README.md`

### Docs
- `docs/FRESHNESS.md` — 3-tier freshness model
- `docs/seo/SEO-AND-ENTITY-STRATEGY.md` — full SEO playbook
- `docs/seo/DATA-AUDIT-FOR-CITY-PAGES.md` — data inventory
- `docs/seo/URL-PATTERN.md` — slug rules
- `docs/seo/PHASE-1-PLAN.md` — 12-step data plumbing

---

## Open Items (TODOs)

### High priority
- [ ] Fix 11 duplicate slugs (country-suffix disambiguation)
- [ ] Load 540 OTD events to dev D1 (currently 1)
- [ ] Load 50K persons to dev D1 (currently 2)
- [ ] Apply Schema 011 to prod D1 (user runs manually)
- [ ] Deploy datetime-api Worker to prod

### Medium priority
- [ ] Backfill city_id on existing OTD events (SPARQL on description text)
- [ ] Add 12-month climate chart (done) + airports section (TODO)
- [ ] Add ourairports CSV import for "airports near X"
- [ ] Add sitemap.xml for 1,011 city pages
- [ ] Add hreflang for 14 languages
- [ ] Worker→webhook to auto-trigger Node build from cron

### Low priority
- [ ] Build remaining 32,945 city pages (after Phase 1C/D)
- [ ] Add /meeting, /converter, /work-time tool pages
- [ ] Set up cron triggers in Cloudflare dashboard (wrangler 4 API bug)

---

## Test Commands

### Cron worker
```bash
# Health
curl https://city-cron-dev.nsura2029.workers.dev/health

# Full scan (sync)
curl "https://city-cron-dev.nsura2029.workers.dev/scan-all?sync=1"

# One batch
curl "https://city-cron-dev.nsura2029.workers.dev/scan-batch?offset=0&limit=20"

# Status
curl https://city-cron-dev.nsura2029.workers.dev/status

# Stale list
curl https://city-cron-dev.nsura2029.workers.dev/stale
```

### API
```bash
# Cities nearby
curl "https://datetime-api-dev.nsura2029.workers.dev/api/v1/cities/nearby?lat=27.95&lon=-82.46&limit=3"

# City by ID
curl https://datetime-api-dev.nsura2029.workers.dev/api/v1/cities/7

# Climate
curl https://datetime-api-dev.nsura2029.workers.dev/api/v1/cities/7/climate
```

### City page build
```bash
# Build 11 defaults
node scripts/build-city-pages.js

# Build next 900 with concurrency
CITIES_FILE=scripts/cities-next-900.json CONCURRENCY=10 node scripts/build-city-pages.js

# Get next N cities
N=900 node scripts/get-next-100-cities.js > scripts/cities-next-900.json
```

### Deploy
```bash
# Dev
./scripts/deploy.sh dev

# Prod (requires explicit "yes")
./scripts/deploy.sh prod
```

### D1 direct
```bash
cd cloudflare/datetime-api
npx wrangler d1 execute timeandtimepro-dev --command="..." --remote
```

---

## Git State (last 10 commits on develop)

```
063891e feat(cron): CITIES_TO_CHECK_LIMIT configurable via env (default 1100)
33a22ea feat(city): scale to 1011 city pages with parallel build
030b897 feat(cron): chunk scan to 20-city batches + add /scan-batch and /scan-all
6a4119e fix(city): attach slug to city object for URL building in template
0986e14 fix(deploy): stash .git outside workspace to avoid 25MB asset limit
456cd69 feat(city): 3 fresh features — nearby API, climate chart, cron worker
1409631 feat(city): 111 city pages + live weather (Open-Meteo) + cities-near
f2f32f0 feat(city): pre-rendered static city pages for top 10
d7ac840 feat(design): 3 city page templates (Bento / Dashboard / Story) for 2030
963cea4 feat(city): Template D — TAD-inspired Data Hub
```
