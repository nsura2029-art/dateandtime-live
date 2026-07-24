# dateandtime.live — Project Progress

> Last updated: 2026-07-24
> Tracking all work shipped to dev. Each entry has date, what shipped, files changed, and how to test.

## Live URLs

| Resource | URL | Status |
|----------|-----|--------|
| Frontend (dev) | https://tdp-landing-dev.nsura2029.workers.dev/ | ✅ Live |
| API (dev) | https://datetime-api-dev.nsura2029.workers.dev/api/v1/ | ✅ Live |
| API (custom domain) | https://dev.api.dateandtime.live/api/v1/ | ✅ Live |
| Cron worker (dev) | https://city-cron-dev.nsura2029.workers.dev/ | ✅ Live |
| City page preview (D) | https://tdp-landing-dev.nsura2029.workers.dev/city-page-preview/D-data-hub.html | ✅ Live |
| City page (Tampa) | https://tdp-landing-dev.nsura2029.workers.dev/world-time/city/tampa/ | ✅ Live |
| API (prod) | https://api.dateandtime.live/api/v1/ | ✅ Live (legacy routes) |
| Frontend (prod) | https://dateandtime.live/ | ✅ Live (NOT updated with new features) |

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
8616f83 fix(design-system): align .nav-link font-weight to 600 across all pages
5533fbb feat(globe): align /globe with shared site shell (additive only)
6aecaf9 feat(home): align /home backup page with shared site shell
cdd5afc feat(shell): strengthen site-shell.css as canonical design system
e026c7c fix(city): slug disambiguation for SEO + PROGRESS.md tracking file
063891e feat(cron): CITIES_TO_CHECK_LIMIT configurable via env (default 1100)
33a22ea feat(city): scale to 1011 city pages with parallel build
030b897 feat(cron): chunk scan to 20-city batches + add /scan-batch and /scan-all
6a4119e fix(city): attach slug to city object for URL building in template
0986e14 fix(deploy): stash .git outside workspace to avoid 25MB asset limit
```

---

## 2026-07-24 — Design system consistency across all pages

**Goal:** the design system (header, light/dark themes, breadcrumb, footer, correct font size + weight) is now consistent across every user-facing page. No section was deleted on any page.

### What changed

**Phase 1 — `src/site-shell.css` promoted to the canonical design system** (300 insertions, 22 deletions)
- Documented the file with a table of contents at the top
- Added the full token set: `--fs-*` type scale, `--fw-*` weight scale, `--sp-*` spacing, `--r-*` radii, `--ease-*` easings, `--dur-*` durations
- Added `color-scheme: light/dark` to `:root` and `[data-theme="dark"]` so form controls + native scrollbars flip too
- Added the page-texture, glow, on-segment, off-segment tokens (light + dark) that the landing uses
- Added the full pill palette (purple, orange, green) for both themes
- Moved the brand button styles (`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-secondary`, `.btn-sm`, `.btn-lg`) into the shared file so they no longer need to be re-declared per page
- Added shared `.pill` base + variants
- Added `:focus-visible` accessibility ring and theme-aware scrollbar
- Updated the nav link, logo, breadcrumb, footer, mobile nav, and page title to explicitly use the design tokens (font size + weight)

**Phase 2 — `home/index.html` aligned to the shared shell** (76 insertions, 20 deletions, additive only)
- Added `<body class="shell-page">`
- Added `<link rel="stylesheet" href="/src/site-shell.css" />`
- Updated the brand text `TimeAndDatePro` → `dateandtime.live` (matches the actual brand)
- Switched the theme toggle from `id="theme-light"` / `id="theme-dark"` to `data-theme-btn="light"` / `data-theme-btn="dark"` (so `site-shell.js` can manage it and migrate the legacy `tdp-theme` localStorage key)
- Added the mobile nav (hamburger + slide-out panel + backdrop) — `/home` previously had no mobile nav
- Added the breadcrumb `Home` above the main content
- Added the shared site-footer (additive — `/home` previously had no footer at all)
- Added `<script src="/src/site-shell.js" defer></script>`
- Removed the duplicate inline theme JS (now handled by `site-shell.js`)
- **All existing sections preserved**: hero, clock, pills, search, rail, popular cities, ad slot, current city, feedback panel

**Phase 3 — `globe/index.html` aligned to the shared shell** (40 insertions, 1 deletion, additive only)
- Added `<body class="shell-page">`
- Added `<link rel="stylesheet" href="/src/site-shell.css" />`
- Added the breadcrumb `Home / 3D Globe`
- Added the shared site-footer (additive — `/globe` previously had no footer at all)
- Added `<script src="/src/site-shell.js" defer></script>`
- Updated the `<title>` from `3D Globe · TimeAndDatePro` to `3D Globe · dateandtime.live`
- **All 3D globe content preserved** (globe stage, layout, sidebar, cities list, render loop, all untouched)

**Phase 4 — `index.html` (the active landing) verified and refined**
- Added `<body class="shell-page">` (the landing was already using the shared CSS/JS but the body class was missing)
- Updated the page-level `.nav-link` font-weight from `700` to `600` to match the shared design system
- Updated the comment header from `TimeAndDatePro` → `dateandtime.live`
- **All landing content preserved** (hero, clock, pills, search, rail, popular cities, ad slot, current city, feedback panel)

**Phase 5 — `home/index.html` and `globe/index.html` page-level `.nav-link` aligned**
- Updated page-level `.nav-link` font-weight from `700` to `600` to match the shared design system

### Pages that already used the shared system and were NOT changed
- `onthisday/index.html` — already on the shared system
- `holidays/index.html` — already on the shared system
- `about/index.html` — already on the shared system
- `privacy/index.html` — already on the shared system
- `terms/index.html` — already on the shared system
- `editorial-policy/index.html` — already on the shared system

### Pages intentionally NOT changed
- `design-system/index.html` — the design system reference page itself; it intentionally has the alternate `NotebookLM` tokens (deep purple + orange LED) and a custom `TimeAndDatePro` brand to document the design system. Not user-facing.
- `prototypes/A-rail.html`, `B-tabs.html`, `C-inline-list.html` — dev-only prototype mockups, not deployed.

### Verification matrix (post-change)

| Page | shell-page | site-shell.css | site-shell.js | data-theme-btn | site-header | site-footer | breadcrumb | mobile nav | nav-link weight |
|---|---|---|---|---|---|---|---|---|---|
| `/` (landing) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a (homepage) | ✓ | 600 |
| `/home/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 600 |
| `/onthisday/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 600 (shared) |
| `/holidays/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 600 (shared) |
| `/globe/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 600 |
| `/about/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 600 (shared) |
| `/privacy/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 600 (shared) |
| `/terms/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 600 (shared) |
| `/editorial-policy/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 600 (shared) |

### Files changed
- `src/site-shell.css` (300+, 22-)
- `home/index.html` (76+, 20-)
- `globe/index.html` (40+, 1-)
- `index.html` (1+, 1-)
- `PROGRESS.md` (this entry)
