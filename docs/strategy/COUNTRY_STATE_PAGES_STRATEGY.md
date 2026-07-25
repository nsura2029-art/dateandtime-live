# Country & State Pages — Strategy & TODO

**Status:** USA full launch, all other countries = 3-tier (Full / Minimal / Coming Soon)
**Owner:** TBD
**Last updated:** 2026-07-25

---

## TL;DR

- **MVP** = USA fully built (1 country + 50 states + 911 city pages)
- **All other countries** = generated with one of 3 templates based on data availability:
  - **Tier 1 (Full)** — countries with ≥10 cities in our DB
  - **Tier 2 (Minimal)** — countries with 1–9 cities
  - **Tier 3 (Coming Soon)** — countries with 0 cities in our DB
- **Tier 3 page** = live clock + "Coming soon" badge + 3 feedback CTAs + 6 contextual backlinks
- **Post-MVP rollout** = continent-by-continent (Asia → Europe → Americas → Africa → Oceania)

---

## Current state (as of 2026-07-25)

| Tier | Countries | Examples | Template |
|---|---|---|---|
| 1 (Full) | ~50 | US, CN, IN, ID, BR, PK, MX, JP, TR, NG, KR, VN, RU, IQ, IR, DE, GB, FR, IT, CA, AU, AR, CO, EG, TH, ZA, SA, MY, PH, PL, ES, NL, BD, etc. | `country-page.html` (current — 20+20 cities + state grid + tools) |
| 2 (Minimal) | ~80 | AD, MC, SM, LI, VA, MT, CY, AG, BB, BZ, BS, CV, MU, IS, FO, GG, JE, IM, etc. | Same template + "More coming soon" badge |
| 3 (Coming Soon) | ~120 | FJ, WS, TO, TV, KI, MH, FM, NR, PW, VU, SB, PG, NC, PF, NR, NR, NR, etc. | NEW `coming-soon.html` template |

---

## What we discovered

### Issue 1: Slug conflict — `washington` (state) vs `washington` (city)

The state "Washington" (admin1_code = `WA`) and the city "Washington, D.C." (the US capital) both slugify to `washington`. The state page overwrote the city page, so:

- `/world-time/united-states/washington/` → STATE page (only 1 city: Seattle)
- The CITY page (the capital) is unreachable

**Fix options:**
- **A. Namespace state pages** → `/world-time/{country}/state/{state}/` (cleanest, no conflicts)
- **B. Move the city to a distinct slug** → `/world-time/united-states/washington-d-c/` (less clean)
- **C. Use a path-based convention** → `/world-time/{country}/{state}/state/` (backwards, awkward)

**Recommendation:** **A** — namespace state pages. Same pattern as the city page is just `{country}/{city}/`. The conflict is only with the country name, but for now (MVP = US only) this works fine.

### Issue 2: State pages only show 1 city (e.g. WA → Seattle only)

The `/api/v1/cities/popular` endpoint caps at the top-1,000 cities by population. For state pages, this means:

| State | Popular API | Full DB |
|---|---:|---:|
| NY | 5 | 68 |
| CA | 4 | 211 |
| TX | 6 | 75 |
| FL | 1 | 79 |
| IL | 1 | 46 |
| WA | 1 | 26 |

**Fix options:**
- **A. Add a new endpoint** `/api/v1/states/{country}/{state}/cities` that returns all cities in the state, not just top-N
- **B. Increase the popular endpoint limit** to 5,000 (still capped, but more inclusive)
- **C. Add a `?all=true` flag to popular** that switches to the full DB query

**Recommendation:** **A** — cleanest. The state page calls a different endpoint that joins `cities.state_code` and returns the full list. Already sorted by population.

---

## Strategy: 3-tier template system

### Tier 1 — Full (≥10 cities)

Uses the current country page template, no changes:
- Hero: "X cities across Y states"
- Filter bar: search + sort
- 20 city cards initial, Load more +20
- "Browse {Country} by state" tile grid
- World Time Tools

### Tier 2 — Minimal (1–9 cities)

Same template, but:
- Hero: "X cities (more coming soon)" — emphasize small count
- Show the cities that exist
- **Add a "More coming soon" badge** prominently
- Skip the state grid (only 1-9 cities, not worth showing states)
- World Time Tools

### Tier 3 — Coming Soon (0 cities)

NEW template, completely different layout:

```
┌──────────────────────────────────────────────┐
│ 🇫🇯 Fiji — Current Time                       │
│                                              │
│  ⏰  Suva: 14:23:45 (FJT, +12 H)              │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ 🚧  COMING SOON                       │    │
│  │ We don't have city-level data for     │    │
│  │ Fiji yet. Want to help us add it?     │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  💡 Help us prioritize:                       │
│  [Suggest cities]  [Tell us more]  [Notify me]│
└──────────────────────────────────────────────┘

[Backlinks — keep users on-site]

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 📅 Today     │ │ 📜 On this   │ │ 📰 Time news │ │ 📚 Time zone │
│              │ │ day in hist  │ │              │ │ education    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

[World Time Tools — same 4 cards]
```

---

## Implementation TODO

### Phase 1: Fix the broken bits (USA-full launch)

- [ ] **P1.1** Add new endpoint `/api/v1/states/{country}/{state}/cities` that returns ALL cities in a state (not just top-1000)
- [ ] **P1.2** Update state page JS to call the new endpoint (so WA shows 26 cities, not 1)
- [ ] **P1.3** Namespace state pages: `/world-time/{country}/state/{state}/` instead of `/world-time/{country}/{state}/`
- [ ] **P1.4** Update all city page breadcrumb links to point to new state page URL
- [ ] **P1.5** Update all "All {state} cities" explore links on city pages
- [ ] **P1.6** Add 301 redirect from old `/world-time/{country}/{state}/` to new `/world-time/{country}/state/{state}/`
- [ ] **P1.7** Verify all 50 US state pages work with correct city counts
- [ ] **P1.8** Verify city page breadcrumb links work for all 911 cities

### Phase 2: Build the 3-tier system (other countries)

- [ ] **P2.1** Add helper function to `/scripts/build-country-state-pages.js` to determine tier per country
- [ ] **P2.2** Add new template `country-page-minimal.html` for Tier 2 (1-9 cities + "more coming soon" badge)
- [ ] **P2.3** Add new template `country-page-coming-soon.html` for Tier 3 (live clock only)
- [ ] **P2.4** For Tier 3 pages: include the country's capital timezone in the live clock (use `c.capital` field from API)
- [ ] **P2.5** For Tier 3 pages: include 4-6 contextual backlinks (Today, On this day, News, Time zones learn, Meeting planner, Holidays)
- [ ] **P2.6** For Tier 3 pages: include 3 feedback CTAs (Suggest city, Tell us more, Notify me)
- [ ] **P2.7** Wire up the feedback CTAs to existing `/api/v1/feedback` and `waitlist` D1 tables
- [ ] **P2.8** Re-build all 250 country pages with tier detection
- [ ] **P2.9** Verify with screenshots: pick one Tier-1 country (CN), one Tier-2 country (IS), one Tier-3 country (FJ)

### Phase 3: Content & SEO (post-MVP)

- [ ] **P3.1** Add `/time-zones/learn/` page with evergreen time zone education content
- [ ] **P3.2** Add `/news/` index page (currently empty, just nav link)
- [ ] **P3.3** Add `/today/` global view (what time is it in the world right now)
- [ ] **P3.4** Add structured data (JSON-LD) for the new Tier-3 pages (no ItemList since no items)
- [ ] **P3.5** Generate sitemap.xml including all 250 country pages (with priority by tier)
- [ ] **P3.6** Add hreflang tags to country pages using the dr5hn translations (zh-CN, ja, ar, es, fr, etc.)

### Phase 4: Continental expansion (post-MVP, in priority order)

| # | Continent | Countries | Cities | Effort | When |
|---|---|---|---|---|---|
| 1 | **Asia** (excl. CN, IN, JP done) | 46 | ~3,000 | 1 week | After live |
| 2 | **Europe** | 49 | ~2,500 | 1 week | +2 weeks |
| 3 | **Americas** (excl. US, MX, BR, CA, AR) | 50 | ~2,000 | 1 week | +4 weeks |
| 4 | **Africa** | 58 | ~2,500 | 1 week | +6 weeks |
| 5 | **Oceania** (incl. Pacific) | 25 | ~1,500 | 3 days | +8 weeks |

For each continent, repeat Phase 1-3 patterns (or just Phase 1 since the templates are built).

---

## Feedback collection (the "what users want" data)

Each Tier-3 page submits to existing D1 tables:

| CTA | D1 table | Schema |
|---|---|---|
| Suggest a city | `feedback` | `{type: "city-suggestion", country, city, user_email, created_at}` |
| Tell us more | `feedback` | `{type: "country-info-request", country, message, created_at}` |
| Notify me | `waitlist` | `{email, country, source: "country-page", created_at}` |

This gives us:
- **Demand signal** per country (which ones to prioritize)
- **Email list** per country (for re-engagement when we build it)
- **Qualitative data** (what users want most)

---

## Success metrics

| Metric | Target (3 months post-launch) |
|---|---|
| Country pages with real data (Tier 1) | 50 → 80 countries |
| Country pages with at least 1 city (Tier 2) | 80 → 120 countries |
| Tier-3 feedback submissions | 1,000+ suggestions |
| Email waitlist signups from Tier-3 pages | 500+ emails |
| Internal click-through (Tier 3 → backlinked pages) | 30% of Tier-3 visitors click at least 1 backlink |
| SEO index rate (Google) | 95% of generated country pages indexed |

---

## Open questions

1. **State page URL** — namespace `/state/` or move the conflicting city? (Recommendation: namespace)
2. **Tier-3 timezone** — show the capital's timezone, or the primary IANA zone? (Recommendation: primary IANA zone, e.g. `Pacific/Fiji`)
3. **Backlink placement** — at the bottom only, or also inline as suggestions? (Recommendation: bottom only, less cluttered)
4. **Email signup** — use the existing `waitlist` table or a new `country_watchers` table? (Recommendation: reuse `waitlist` with a `source` field)
5. **Translations** — Phase 1 in P3.6, but should we make the Tier-3 page auto-translate? (Recommendation: no, English-only for MVP)

---

## Files affected

| File | Change |
|---|---|
| `scripts/build-country-state-pages.js` | Add tier detection + 3 templates |
| `cloudflare/datetime-api/routes/cities.js` | Add `/states/{country}/{state}/cities` endpoint |
| `src/world-time-cities.js` | Use new endpoint for state pages, add Tier-3 clock-only mode |
| `src/tz-hub.css` | Add styles for Tier-3 page (badge, CTAs, backlink grid) |
| `src/site-shell.js` | Wire up the 3 feedback CTAs to API |
| All 250+ country page HTML files | Regenerate via build script |
| All 50 US state page HTML files | Regenerate via build script |

---

## Related work

- Phase A (dr5hn enrichment) — already shipped ✓
  - 2,581 / 3,865 states matched with real names
  - 242 / 250 countries enriched with native + nationality + gdp
  - 4,364 / 4,724 country translations loaded
- Phase B (city rebuild) — DEFERRED
  - Would replace the 33,945 GeoNames cities with 152,970 dr5hn cities
  - Effort: ~1 day
  - Would auto-fix the Tier-3 problem for many countries (most small ones would get 1-5 cities)
