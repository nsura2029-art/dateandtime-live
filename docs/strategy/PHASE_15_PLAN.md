# Phase 15 Plan: Ingest 152K-City Dataset & Build All USA City Pages

## Scope Analysis

### What we have now (dateandtime.live)
| | Current | Target (from dataset) | Gap |
|---|---|---|---|
| Regions | 6 | 7 | +1 (Other + Polar) |
| Subregions | 25 | 33 (dataset total) | -8 (consolidating) |
| Countries | 242 | 250 | +8 extras (mostly territories) |
| States | 3,865 | 5,308 (adm1+adm2+section) | +1,443 (mostly adm2) |
| Cities | 33,945 | 153,149 | **+119,204** |
| USA cities | 3,407 (pop>=40K) | 16,731 | **+13,324** |
| City pages built | 911 | 16,731 (all USA) | +15,820 |

### US city population distribution
- **1M+**: 16 (NYC, LA, Chicago, Houston...)
- **500K-1M**: 17
- **100K-500K**: 29
- **50K-100K**: 329
- **10K-50K**: 614
- **1K-10K**: 3,551
- **100-1K**: 11,454
- **<100**: 737
- **Median**: 3,869

The bottom 70% are tiny towns but still have valid SEO value for long-tail queries.

---

## Phase A: Data Ingestion (~3-4 hours)

### A1. Migration 014: Schema additions
```sql
-- Cities
ALTER TABLE cities ADD COLUMN city_type TEXT;          -- 'city', 'adm1', 'adm2', etc.
ALTER TABLE cities ADD COLUMN region TEXT;             -- 'Americas', 'Asia', etc.
ALTER TABLE cities ADD COLUMN subregion TEXT;          -- UN M49 subregion
ALTER TABLE cities ADD COLUMN region_id INTEGER;        -- UN M49 region code
ALTER TABLE cities ADD COLUMN subregion_id INTEGER;     -- UN M49 subregion code
ALTER TABLE cities ADD COLUMN is_capital INTEGER DEFAULT 0;

-- States
ALTER TABLE states ADD COLUMN state_native TEXT;        -- Local language name
ALTER TABLE states ADD COLUMN state_type TEXT;          -- 'state', 'province', 'region', etc.
ALTER TABLE states ADD COLUMN state_id INTEGER;         -- Original GeoNames ID

-- Countries
ALTER TABLE countries ADD COLUMN region TEXT;           -- Already there
ALTER TABLE countries ADD COLUMN subregion TEXT;        -- Already there (but verify)
ALTER TABLE countries ADD COLUMN region_id INTEGER;
ALTER TABLE countries ADD COLUMN subregion_id INTEGER;
```

### A2. Seed script
- File: `cloudflare/datetime-api/seed/dataset-cities.py`
- Match strategy: (name + cca2 + state_code) → fallback to (name + cca2) → fallback to (name only)
- 152K cities in dataset, ~33K already in our DB → expect to insert ~119K new
- Estimated runtime: 5-10 min (D1 HTTP API has rate limits)
- Estimated D1 row count after: 33K + 119K = 152K cities

### A3. Add missing countries (27)
- 2 Other: Kosovo (XK), Taiwan (TW)
- 3 Polar: Antarctica (AQ), Bouvet (BV), Heard/McDonald (HM)
- 22 territories: Pitcairn, Tokelau, Niue, Wallis & Futuna, Faroe Islands, Gibraltar, Åland, Jersey, Isle of Man, Guernsey, Guam, American Samoa, Northern Marianas, Cook Islands, Puerto Rico, US Virgin Islands, Saint Pierre, Bermuda, Greenland, Cayman Islands, Turks & Caicos, Anguilla, Montserrat

---

## Phase B: API Updates (~1-2 hours)

### B1. Enhanced city endpoint
`GET /api/v1/cities/{id}` — add to response:
```json
{
  "id": 4174757,
  "name": "Tampa",
  "countryCode": "US",
  "countryName": "United States",
  "stateCode": "FL",
  "state": "Florida",
  "stateNative": "Florida",                    // NEW
  "region": "Americas",                         // NEW
  "subregion": "Northern America",              // NEW
  "regionId": 19,                               // NEW (UN M49)
  "subregionId": 21,                            // NEW
  "cityType": "city",                           // NEW
  "isCapital": 0,                               // NEW
  ...
}
```

### B2. New region endpoints
- `GET /api/v1/regions` — list 7 regions
- `GET /api/v1/regions/{id}/subregions` — list subregions for a region
- `GET /api/v1/regions/{id}/countries` — list countries in a region

### B3. Enhanced country endpoint
- `GET /api/v1/countries/{cca2}/states` — include `stateNative` field

### B4. New region landing page support
- `/world-time/region/{slug}/` — auto-generated for 7 regions
- `/world-time/region/{slug}/{subregion}/` — auto-generated for ~22 subregions

---

## Phase C: Build All 16,731 USA City Pages (~4-6 hours)

### C1. Update build script
- File: `scripts/build-us-cities.js` (new, dedicated for US)
- Or: extend `scripts/build-city-pages.js` to support larger batches
- Switch from hardcoded 911-city list to: all US cities with pop >= 0 (all 16,731)
- Optimize: cache template strings, parallel I/O

### C2. Build strategy
- Total: 16,731 files
- Average size: 50-60 KB per page
- Total size: ~900 MB
- Build time estimate: 30-60 min with parallel I/O (vs 95s for 911)
- Output structure: `world-time/united-states/{state}/{city-slug}/index.html`

### C3. URL pattern
- `https://dateandtime.live/world-time/united-states/california/los-angeles/`
- `https://dateandtime.live/world-time/united-states/texas/houston/`
- `https://dateandtime.live/world-time/united-states/florida/miami/`
- `https://dateandtime.live/world-time/united-states/wyoming/cody/`
- `https://dateandtime.live/world-time/united-states/rhode-island/newport/`

### C4. State sub-pages
- `https://dateandtime.live/world-time/united-states/state/california/`
- `https://dateandtime.live/world-time/united-states/state/california/?p=2&p=3...`
- Page size: 500 cities per page (current 100+100 = 200, increase for big states)
- California alone: 1066 cities = 3 pages
- Texas: 1022 cities = 3 pages
- Texas + California + New York + Pennsylvania + Florida = 4,842 cities = 10 pages
- All US: 16,731 cities = 34 pages

### C5. City page template updates
- Add region/subregion breadcrumbs (Top › Americas › Northern America › US › Florida › Tampa)
- Add state native name (if different)
- Add "Cities near {city}" (haversine, already exists)
- Add "Counties" or "Neighborhoods" section for cities with adm2 areas

### C6. SEO/Index considerations
- Update sitemap.xml with all 16,731 URLs
- Update robots.txt
- Add canonical URLs
- Update `STATE_META` with all 52 US states (currently 51)

---

## Phase D: USA Country Page Updates (~1-2 hours)

### D1. New USA page layout
- Header: USA stats (16,731 cities, 50 states + DC, pop 340M)
- "States of USA" grid: 52 state cards with state_native name + state code + city count
- "Top cities in USA" grid: top 100 cities by population
- "Browse all states" → list of state pages

### D2. State card data
- State code (CA, TX, etc.)
- State native name (none for US states but structure ready for intl)
- Capital (Sacramento, Austin, etc.)
- City count (1,066 for CA)
- Largest city (Los Angeles for CA)
- Population sum

### D3. Top cities widget
- Top 100 by population: New York, LA, Chicago, Houston, Phoenix...
- Pre-built at build time, included in HTML

---

## Phase E: World-Time Hub Updates (~1-2 hours)

### E1. Continent filter
- Add "Other" and "Polar" buttons
- Update label: "Continents" → "Regions"
- Reorder: Europe, Americas, Asia, Oceania, Africa, Other, Polar

### E2. Sub-region chips
- When a region is selected, show subregions as chips
- "Northern America", "Caribbean", "Central America", "South America" for Americas

### E3. Region landing pages
- New: `/world-time/region/europe/` (5 main + 2 special)
- New: `/world-time/region/americas/northern-america/` (22 subregion pages)
- Template: hero with region name + country list grid + insights

### E4. Country dropdown
- Add 8 new countries (XK, TW, AQ, BV, HM, plus territories)
- Sort by population with US/UK at top

---

## Phase F: Test + Deploy (~1-2 hours)

### F1. Regression test (28 existing tests must pass)
- DST callout, Tools section, News section, today bar, etc.
- All city page tests
- Mobile + iOS Safari

### F2. New tests
- New city page test (pop < 1K small town)
- State page test with 500+ cities
- New region page test

### F3. Lighthouse / performance
- Page size for tiny-town pages (~30 KB instead of 55 KB)
- Initial render time
- SEO score

### F4. Sitemap + index update
- Generate `sitemap-us.xml` with all 16,731 city URLs
- Update main `sitemap.xml` with new region/subregion URLs

---

## Risk Assessment

### Storage
- 16,731 × 55 KB = **920 MB** added to deploy
- CF Pages limit: 25,000 files per project (we'd have 16,000+ new files, currently ~3,500 = 19,500 total — under limit)
- CF Pages size: 25 MB per file (each page is well under)

### Build time
- Sequential: 30-60 min
- Parallel (5 workers): 8-12 min
- Acceptable for monthly rebuilds; CI cache recommended

### D1 performance
- 152K cities × indexes on (countryCode, stateCode, name)
- Query time: < 50ms for any city
- All-state pages: aggregation queries (~200ms for full state)

### SEO impact
- **Major**: 16K new landing pages = ~5x current indexable URLs
- Long-tail: "small town near X" queries can now route to dedicated pages
- Backlinks: Each city gets its own canonical URL for local citations

---

## Recommended Execution Order

1. **Phase A** (data): Migration + seed → 3-4 hrs
2. **Phase B** (API): Endpoints + types → 1-2 hrs
3. **Phase C** (city pages): Build script + all 16,731 → 4-6 hrs
4. **Phase D** (USA page): Layout + state cards → 1-2 hrs
5. **Phase E** (hub): Continent filter + region pages → 1-2 hrs
6. **Phase F** (test + deploy): Regression + push → 1-2 hrs

**Total**: 11-16 hours of focused work. Can be split into 2-3 days.

### Quick-win alternative (4-5 hours)
- Skip the +119K global cities
- **Only** add the +13,324 US cities
- Build all 16,731 US city pages
- Update USA page with real state data
- **Defer** the world-time hub changes

### Medium scope (8-10 hours)
- Above + ingest 7 regions + 8 new countries
- World-time hub gets Other/Polar buttons
- No new region landing pages yet

### Full plan (15+ hours)
- Everything above + new region/subregion landing pages
- State native names
- D1 schema overhaul

---

## Open Questions

1. **Deployment scope**: dev only, or push to prod?
2. **Build frequency**: rebuild on every commit, or weekly batch?
3. **URL canonicalization**: `/world-time/united-states/california/los-angeles/` or `/us/california/los-angeles/`?
4. **Small town coverage**: Build all 16,731 (incl. 737 with pop<100), or filter to pop>=500 (drops to ~8,000)?
5. **Region pages**: Build all 33 subregion pages, or just the 5 main regions?
6. **State native names**: Add for all 5,308 states, or just the major ones?
