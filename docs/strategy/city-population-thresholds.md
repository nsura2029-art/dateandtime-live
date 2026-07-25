# City Population Thresholds — Per-Country Strategy

**Status:** Active
**Last updated:** 2026-07-25
**Owner:** Frontend

## What this is

The country page (`/world-time/{country}/`) shows a list of cities in that
country. We use a `minPopulation` query param to filter out tiny hamlets and
make sure every state/region is represented.

But the threshold can't be the same for every country. Tiny countries
(Liechtenstein, Vatican, Monaco) have zero 40K+ cities, so we'd show empty
pages. The US, by contrast, needs 40K+ to cover all 51 states (5 states have
no 50K+ city).

## The rule

**Per-country `minPopulation` in `scripts/build-country-state-pages.js`:**

```js
const MIN_POPULATION = {
  US: 40000,   // 1,246 cities across 51 states
};
function minPopulationFor(cca2) {
  return MIN_POPULATION[cca2] || 0;  // default: no filter
}
```

The build script bakes this into `window.__MIN_POPULATION` for the country
page. The JS uses it to call `/api/v1/cities?country=XX&minPopulation=XX`.

## Why US is 40K

The goal is "show every state in the US" — that's 51 states.

| Threshold | Cities | States covered | States missing |
|---|---:|---:|---|
| ≥ 100K | 356 | 46/51 | DE, ME, VT, WV, WY |
| ≥ 75K | 551 | 46/51 | DE, ME, VT, WV, WY |
| ≥ 50K | 976 | 49/51 | VT, WV |
| **≥ 40K** | **1,246** | **51/51** | **none** |

40K is the lowest threshold that covers all 51 states without going below a
"real city" population. (Burlington, VT has 42K; Huntington, WV has 48K.)

## Why this varies for other countries

Small countries (Europe, Caribbean, Pacific) often have NO 40K+ cities. For
example:

- **Liechtenstein** (LI): total population 39,000. No 40K+ cities.
- **Monaco** (MC): population 39,000. No 40K+ cities.
- **Vatican** (VA): population 800. No 40K+ cities.
- **San Marino** (SM): population 33,000. No 40K+ cities.

For these countries, the country page would be empty. Solution: **default
to 0 (no filter) for all non-US countries** for now. If we want to optimize
later, we can add a per-country threshold based on the country's biggest
city's population.

## When to add a new entry

When launching the country page for a new top-20 country, check if the
default 0 threshold gives a sensible result. If it shows 1,000+ cities
of all sizes, consider adding a minPopulation based on the country's
biggest city:

```
if (maxCityPopulation < 100K)   → 0 (no filter)
if (maxCityPopulation < 1M)    → 25,000
if (maxCityPopulation < 10M)   → 50,000
if (maxCityPopulation >= 10M)  → 100,000
```

(Heuristic — tweak based on UX testing.)

## Open question

For Oceania (AU, NZ, FJ, etc.), should we use a lower threshold (10K?) so
the country page isn't empty? Phase B (dr5hn cities import, 152,970 cities)
will fix this — we'll have hundreds of cities per Oceania country. Until
then, we can lower the threshold as needed.

## Related

- `scripts/build-country-state-pages.js` — defines `MIN_POPULATION`
- `src/world-time-cities.js` — reads `window.__MIN_POPULATION` and passes
  to `/api/v1/cities?minPopulation=...`
- `cloudflare/datetime-api/routes/cities.js` — `/api/v1/cities` and
  `/api/v1/cities/popular` both support `minPopulation` filter
- `docs/strategy/COUNTRY_STATE_PAGES_STRATEGY.md` — overall country page
  rollout plan
