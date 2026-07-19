# TimeAndDatePro — Agent Guide

> Read this before designing, building, or modifying **any** page on `dateandtime.live`
> or **any** table in the shared date/time reference DB.
> This file is the source of truth for the visual & product direction, and for the
> cross-app shared-database scope.

---

## Shared global reference database (date & time scope)

Both `dateandtime.live` (static landing) and the broader product surface (React app,
future tools) draw from one shared date/time reference database. The full architecture
spec lives at **`docs/architecture/global-reference-db-spec.pdf`** (from 2026-07-19);
this section is the working scope summary for what we're actually building first.

### In scope (date & time only)

1. **Geography** — countries, administrative regions, cities, place names
2. **Time zones** — IANA identifiers, DST, historical transitions, city→tz mapping
3. **Holidays** — country / region / city specific, fixed + rule-based
4. **Business calendars** — business-day calculator, weekend definitions per country
5. **Date/time formats** — per-locale date/time strings, AM/PM labels, first day of week
6. **Date-to-words / time-to-words** — localized spoken / legal / invitation styles
7. **Sunrise / sunset** — astronomical lookup per lat/lon/date
8. **Seasonal / climate summaries** — vacation-planner reference data per city/month
9. **Travel / vacation profiles** — best-month, peak/shoulder/low, weekend, calling code
10. **Airports** + city↔airport relationships (IATA/ICAO codes, lat/lon, timezone)
11. **Place relationships** — metro area, capital-of, airport-serves
12. **Search** — FTS5 + alias + fuzzy + transliteration + ranking (population, capital, location)
13. **Data sources / import history** — lineage for every entity

### Out of scope (this pass)

Currency / exchange rates, unit converters, calling codes as a standalone tool,
cost estimators, crypto, waitlist, rate alerts, ad-hoc audit. These live in the
DB tables already (see `timeanddatepro-full`) but no APIs are exposed for them yet.

### Existing assets (don't re-build from scratch)

- **D1 `timeanddatepro-full`** (id `c401ffb6-51db-49e6-991f-b5695f9e6a7d`) —
  5,081 cities / 194 countries / 3,865 states / 312 IANA tz / 406 city aliases /
  1,460 country aliases. Schema v2.3.0, seeded 2026-07-12 from GeoNames cities5000.
  Currently **unbound** to any Worker.
- **D1 `timeanddatepro-dev`** (id `ea1ef5ff-7132-40f4-b952-fff27621580c`) —
  190 famous cities. Bound to `datetime-api-dev` Worker.
- **D1 `timeanddatepro`** (id `3105810e-a602-4a5c-adee-be2f11b41893`) — prod
  schema, 190 cities. `datetime-api` Worker is **404 on all requests** — needs redeploy.
- **Postman collection** — `docs/api/timeanddatepro-api.postman_collection.json`
  (46+ endpoints across 14 folders). Some endpoints are stubs (return curated
  placeholder data); see the rollout queue.

### Phased delivery plan

| Phase | Scope | Status |
|---|---|---|
| **0** | Fix prod API Worker, point at `timeanddatepro-full`, rebuild v2 search, bump cap | ✅ **shipped 2026-07-19** — `cloudflare/datetime-api/` on Hono, 5,081 cities / 194 countries / 312 IANA tzs / 206 aliases, FTS5 covers names + aliases, prod (`api.dateandtime.live`) + dev (`dev.api.dateandtime.live`) both live, all landing features (sync, sunrise, search, cities) now show real data |
| **1** | Date/time formats + locales (CLDR seed) | ⏳ |
| **2** | Holidays + business calendars | ✅ **shipped 2026-07-19** — 880 holidays (15 countries × 5 years from Nager.Date), 21 business_calendars, 11 holiday_rules. Migrations: `migrations/002_*` + `003_*`. |
| **3** | Date-to-words / time-to-words (localized) | ⏳ |
| **4** | Sunrise / sunset / seasonal | ✅ **shipped 2026-07-19** — 60,972 climate rows (5,081 cities × 12 months), 16,378 seasons, 1,560 DST transitions (312 tzs × 5 years), 50 onthisday events. Migrations: `migrations/004_*` + `005_*`. |
| **5** | Travel / vacation metadata + airports | ⏳ |
| **6** | Search quality (FTS5, transliteration, ranking) | ✅ **shipped 2026-07-19** — 30 historical place_redirects (Bombay→Mumbai, Edo→Tokyo, etc.). FTS5 with aliases already shipped in Phase 0. Migration: `migrations/006_*`. |
| **7** | Data quality + governance + automated checks | ✅ **shipped 2026-07-19** — 8 data_sources, 10 import_history rows, 10 data_quality_checks (all 10 pass except 43 duplicate_cities which is informational). Migration: `migrations/007_*`. |
| **8** | cities15000.zip bulk import | ✅ **shipped 2026-07-19** — cities **5,081 → 33,945** (+28,864). countries **194 → 242** (+48 territories via migration `008_*`). timezones **312 → 408** (+96 via `seed/missing_tzs.py` so the cities FK passes). Tier 3 towns (50K-100K) jumped from 16 → 6,100. Guntur's 30km neighborhood fully searchable (Thenali, Mangalagiri, Tādepalle, Kānūru, etc.). `climate_summaries` rebuilt with `UNIQUE(city_id, month)` so re-runs are idempotent; being re-seeded for all 33,945 cities. Migration: `migrations/008_*`. Seed: `seed/cities15000.py`, `seed/missing_tzs.py`. |

Detailed steps per phase: see the full spec PDF. The phases are independent — each
one can ship to production behind a feature flag without breaking earlier phases.

### Cross-app rule (from the spec)

> All tools must reference the same canonical country, region, city, currency,
> language, and time-zone identifiers. Do not build separate copies of country, city,
> currency, language, or time-zone data for every tool.

In practice, this means:
- `dateandtime.live` (static landing) reads from the API at `api.dateandtime.live`
- The React app reads from the same API
- Future apps (e.g. `meeting.tdp`, `planner.tdp`) read from the same API
- No app maintains its own city list, country list, or tz list

### Required follow-up reads

- `docs/architecture/global-reference-db-spec.pdf` — the full architecture
- `docs/ROLLOUT.md` — API feature rollout queue
- `AGENTS.md` §8 — production API, feature-by-feature rules
- `AGENTS.md` "Branching & deployment workflow" — how to ship each phase

---

## Design rules (apply to **every** page)

### 1. **No cards.** Ever.
- Use the **page background** (white in light mode, deep purple in dark mode) as the canvas.
- Use **whitespace, type, color, dividers** — never a bordered, rounded, shadowed box.
- The only "containers" allowed are the **time-card and onthisday** floating rows, but they are **flat panels** (no border, no shadow, no rounded box). Use them sparingly.
- **Forbidden**: `border-radius` + `border` + `background-color` + `box-shadow` on a child that is a stand-alone group. Use spacing instead.
- If you need visual separation, use a **hairline divider** (`1px solid var(--color-border-soft)`), generous vertical rhythm, or a subtle background tint via `color-mix(in srgb, var(--color-primary) 4%, transparent)`.

### 2. **Mobile first. Always.**
- Write the **smallest screen** CSS first, then `@media (min-width: …)` to expand.
- **Breakpoints**:
  - **Base / phone**: `<= 760px` — the default
  - **Tablet**: `761px – 1023px`
  - **Desktop**: `1024px – 1279px`
  - **Wide**: `>= 1280px`
- **Touch targets**: minimum 44×44 px.
- **Type scale**: test at 360 px wide. Headlines must never horizontally overflow.
- **Stack vertically** on phone, then reflow on larger screens.

### 3. **Ad sense — real placements, not afterthoughts.**
- **Reserve ad slots in the layout** at design time. Don't bolt them on later.
- **Standard sizes** (Google AdSense default):
  - **Leaderboard** — 728×90 (desktop), 320×50 (mobile)
  - **Medium rectangle** — 300×250 (universal)
  - **Half-page** — 300×600 (sidebar, desktop only)
- **Where**:
  - **Below the hero / above the city list** — one leaderboard or medium rectangle, centered, max-width capped
  - **Between city sections** — one leaderboard, full-width
  - **Sidebar** (desktop ≥ 1024px only) — half-page
- **How to mock**: a flat rectangle with `var(--color-page-texture)` background, a small "Ad" label in `var(--color-muted-soft)`, a 1px hairline border, **no shadow, no rounded corners larger than 8px**, sized exactly to the ad unit. The mockup is **visually quiet** so the real ad lands gracefully.
- **Ad label is mandatory** (`Advertisement` or `Sponsored`) — required by AdSense policy.

### 4. **Hero section contents** (landing page)
- **Top-to-bottom order**:
  1. **Greeting** — `Good {Morning|Afternoon|Evening|Night}, {City}` (auto from local time)
  2. **Subtitle** — single-line value prop
  3. **7-segment clock** (HH:MM:SS.MS + AM/PM) — the hero's centerpiece
  4. **Day + date + timezone** — `Saturday, July 18, 2026 · EDT UTC-04:00`
  5. **Sync accuracy** — `Your clock is X.X seconds behind. Accuracy ±0.123s.`
  6. **Off hours / Sunrise–sunset pills** — three inline pills (green / purple / orange)
  7. **City list** — 5 cities, user's **home at the top**, each row: name · live time · timezone
  8. **+ Add city** — last item in the list
  9. **Current location** — `Current time in {City}, {Region}`
- **All of this lives in the hero section**. No separate sections, no scrolling required to see it all on a 360×640 phone.

### 5. **5 cities + add-your-own pattern**
- **Default 5** (when user has no saved list):
  1. User's **home** (auto-detected: geolocation → IANA tz → fallback)
  2. New York
  3. London
  4. Tokyo
  5. Sydney
- **User can add**: search via `/api/v2/search` → click result → prepend or append → save to `localStorage`.
- **User can remove**: `×` button on each city (except home, which is locked).
- **Home is dynamic** — re-detected on first visit, then locked. User can re-pick via the search by clicking a "Set as home" affordance.
- **Persistence**: `localStorage.tdp-cities` (array of city objects, normalized shape).

### 6. **Widgetly + NotebookLM design tokens**
- **Always** import the token block from `index.html` (or `design-system/index.html`).
- **No new colors** without adding them to the token system first.
- **No new type scales** — use `clamp(…)` with the existing scale.
- **No new component styles** without a reference in `design-system/`.

### 7. **Live data only**
- **Time**: `new Date()` in the browser, `requestAnimationFrame` for 60fps tick.
- **Per-city time**: computed in the browser with `Intl.DateTimeFormat` + the city's IANA tz.
- **Sync accuracy**: round-trip against `/v1/time/now?tz=UTC` (when available on prod).
- **Sunrise / sunset**: `/v1/time/sun?lat=…&lon=…&date=YYYY-MM-DD`, convert UTC → city-local (when available).
- **City search**: `/v2/search` (handles 13 edge cases: aliases, fuzzy, diacritics, disambiguation — when available).
- **City data**: `/v1/cities?limit=200` (cached in `localStorage`) — **the only endpoint guaranteed on production today**.
- **On-this-day**: `/v1/onthisday?month=…&day=…` (curated, may be empty for some dates — when available).
- **No new endpoints** without updating `docs/api/`.

### 8. **Production API — feature-by-feature deployment**

The landing page is **production-only**. There is no dev reference in any deployed file. We do **not** big-bang deploy; we ship one feature at a time, gated by the corresponding endpoint being live on `https://api.dateandtime.live`.

- **API base (hardcoded)**: `https://api.dateandtime.live`
- **Probed on boot** (HEAD request; on 404, the feature UI hides gracefully):
  - `/v1/time/now`  → sync row
  - `/v1/time/sun`  → sunrise / sunset pill
  - `/v1/onthisday` → on-this-day line
  - `/v2/search`    → search bar (shows a soft note when disabled)
- **Endpoint status** (current): only `/v1/cities` is live. Everything else 404s on prod. The page still works — it just shows fewer features. As you add each endpoint to the prod API, the matching feature auto-appears on next page load. **No code change needed.**
- **Strategic rollout queue** (in order):
  1. ✅ `/v1/cities` — done. The 5 default cities render.
  2. ⏳ `/v1/time/now` — adds the "Your clock is X seconds behind" line.
  3. ⏳ `/v1/time/sun` — adds the sunrise / sunset pill to the home city.
  4. ⏳ `/v1/onthisday` — adds the "on this day in …" line.
  5. ⏳ `/v2/search` — enables the search bar (currently shows a soft note).
- **Cache**: cities list is cached in `localStorage.tdp-cities-cache` with a timestamp; future enhancement can add a TTL.

### 9. **3D globe page (parked)**
- Lives at `/globe/`. **Do not modify** until the user resumes that thread.
- The landing page (`/`) is the active focus.

### 10. **Page hierarchy**
- `/` — landing (this is the active design)
- `/design-system/` — Widgetly + NotebookLM token reference
- `/globe/` — parked, don't touch
- `/docs/api/` — Postman collection + endpoint map

---

## Quick checklist for any new page or component

- [ ] No card chrome (no border + radius + shadow on a stand-alone group)
- [ ] Mobile-first CSS (write phone styles first, then `@media (min-width: …)`)
- [ ] Type, spacing, color from the Widgetly + NotebookLM tokens
- [ ] All hero content visible on a 360×640 phone without scrolling
- [ ] If a real page: one **reserved ad slot** in the layout (with a mock placeholder)
- [ ] 5 cities visible by default + add-your-own search (landing)
- [ ] User's home at the top of the city list
- [ ] All times computed from `new Date()` or `Intl.DateTimeFormat` with the city's IANA tz
- [ ] No new endpoints without updating `docs/api/`
- [ ] No changes to `/globe/`

---

## Branching & deployment workflow (LOCKED 2026-07-19)

The repo has **two long-lived branches** (`main` + `develop`) and **one short-lived branch per feature** (`feature/*`). Each one maps to a different Cloudflare Worker.

| Branch      | Worker                | URL                                                          | Purpose                                       |
|-------------|----------------------|--------------------------------------------------------------|-----------------------------------------------|
| `main`      | `dateandtime-live`   | `https://dateandtime.live`                                   | **Production** — what the public sees          |
| `develop`   | `tdp-landing-dev`    | `https://tdp-landing-dev.nsura2029.workers.dev`              | **Dev** — integration branch, pre-prod preview |
| `feature/*` | `tdp-landing-dev`    | `https://tdp-landing-dev.nsura2029.workers.dev`              | **Feature preview** — replaces dev during work |

> **Why the weird Worker name?** Anything close to `dateandtime-live` (e.g. `dateandtime-live-dev`) gets flagged by Chrome as a lookalike of `dateandtime.live` and shows a "Did you mean...?" phishing warning. The brand-prefixed `tdp-landing-dev` reads as its own thing and passes Chrome's check.

A single feature preview URL. While a feature branch is checked out and deployed, the dev URL serves *that feature*'s content. Once the feature is merged into `develop` and the dev URL is re-deployed from `develop`, the dev URL serves develop's content again. Then `develop` → `main` when the next prod release ships.

### Lifecycle of a feature

1. **Branch from `develop`** (never from `main`):
   ```bash
   cd /workspace/dateandtime-live
   git fetch origin
   git worktree add .worktrees/feature-<name> -b feature/<name> origin/develop
   cd .worktrees/feature-<name>
   ```
2. **Build + commit** in the worktree. Work freely; commits on `feature/*` are throwaway until merged.
3. **Deploy the feature to the dev Worker** (from the worktree):
   ```bash
   npx wrangler deploy --env dev
   ```
   The dev URL now serves your feature. Verify visually and via `curl`.
4. **Iterate** — make changes, commit, redeploy. The dev URL always reflects the latest commit on the checked-out branch.
5. **Merge to `develop`** when the feature is good:
   ```bash
   cd /workspace/dateandtime-live        # back to the main checkout
   git fetch origin
   git checkout develop
   git merge --ff-only feature/<name>   # must be fast-forward
   git push <PAT> origin develop
   git worktree remove --force .worktrees/feature-<name>
   git branch -d feature/<name>
   git push <PAT> origin --delete feature/<name>
   ```
6. **Redeploy `develop` to the dev Worker** so the dev URL now serves the integrated content:
   ```bash
   git checkout develop
   npx wrangler deploy --env dev
   ```
7. **Promote `develop` to `main` for prod** when the next release ships:
   ```bash
   git checkout main
   git merge --ff-only develop
   git push <PAT> origin main
   npx wrangler deploy                   # no --env → deploys to prod Worker
   ```

### Rules (always)

- **Never commit directly to `main` or `develop`.** Always go through a `feature/*` worktree.
- **Never `--no-ff` or non-fast-forward merge.** Use `--ff-only` so the feature branch is effectively rebased into develop.
- **One feature per branch.** Don't stack multiple features on a single `feature/x`.
- **The dev Worker is shared.** Only one `feature/*` can be deployed to it at a time. If two features are in flight, deploy-then-merge-then-deploy-then-start-next.
- **No direct prod deploys.** Always `develop` → `main` → `wrangler deploy` (no `--env`).
- **API endpoints still deploy feature-by-feature** (per §8). The branch workflow handles *page* changes; the API endpoint workflow handles *data* changes. They're independent.

### Deploy cheat sheet

```bash
# From a feature worktree — deploys to the DEV URL
npx wrangler deploy --env dev

# From develop (main checkout) — deploys to the DEV URL
git checkout develop && npx wrangler deploy --env dev

# From main (main checkout) — deploys to the PROD URL
git checkout main    && npx wrangler deploy
```

---

## File map

```
dateandtime-live/
├── index.html              ← landing (active)
├── design-system/index.html
├── globe/index.html        ← parked
├── docs/api/
├── docs/ROLLOUT.md         ← API feature rollout queue
├── favicon.svg
├── src/index.js
├── wrangler.toml           ← prod + dev envs
└── AGENTS.md               ← this file
```
