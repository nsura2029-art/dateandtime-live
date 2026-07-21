# On-This-Day Data Build — 30-Item Todo (90-Day Plan, Data-Only)

> **Source blueprint**: `onthisday-teardown-and-blueprint.agent.final.md` (10 chapters, 200+ citations, 5 copy-paste prompts)
> **Mode**: Data layer only — no UI integration per user constraint 2026-07-20
> **Constraint**: Cloudflare Workers 25MB asset limit (large JSON files live in `/tmp/otd-data-final/`, not in repo)
> **Last updated**: 2026-07-20

---

## 🎯 Executive Summary

**Goal**: Build the full data layer for 14 page templates × all 366 dates × all 4 source families, behind a clean read API and ingestion pipeline, before any UI work.

**Architecture**:
```
Free sources (Wikimedia Feed + Wikipedia REST + byabbe.se + Muffin Labs + Nager.Date + QLever + DBpedia + Pageviews)
    ↓
Ingestion (5 connectors + recency backfill via day-article parsing)
    ↓
Normalization (CC BY-SA per-row provenance, signed years, QID dedup key)
    ↓
Notability scoring (0.5*log1p(sitelinks) + 0.3*log1p(pageviews) + 0.2*log1p(inbound_links))
    ↓
Multi-source dedup (strict on QID, fuzzy on title Jaccard > 0.7, merge keep-higher-quality)
    ↓
Quality scoring (0-100: image + long_desc + short_desc + wiki + country + category + people + keywords + tags + sources + freshness)
    ↓
D1 persistence (entities + on_this_day + observances + holidays + reports)
    ↓
Read API (GET endpoints, edge-cached)
    ↓
RAG layer (retrieval-only, refusal-on-no-data, pre-gen canonical answers)
```

**Out of scope (per user)**: UI integration, page rendering changes, navigation updates. Data goes to `content/otd/`, `scripts/`, `migrations/`. UI is for a future session.

---

## 📊 Current State (as of 2026-07-20)

| Asset | Status | Source |
|---|---|---|
| `scripts/lib/image-fallback.js` | ✅ Done (5-tier pipeline) | v46 |
| `scripts/lib/quality-scorer.js` | ✅ Done (0-100, 11 criteria) | v46 |
| `scripts/lib/validation.js` | ✅ Done (13 field rules + dedup) | v46 |
| `scripts/lib/auto-improve.js` | ✅ Done (10-step enrichment) | v46 |
| `scripts/sources/wikidata.js` | ✅ Done (SPARQL via WDQS) | v46 |
| `scripts/sources/wikipedia.js` | ✅ Done (REST feed) | v46 |
| `scripts/fetch-otd-batch.js` | ✅ Done (orchestrator) | v46 |
| `scripts/build-otd-from-data.js` | ✅ Done (static page builder) | v46 |
| `cloudflare/datetime-api/cron-worker.js` | ✅ Done (daily/weekly/monthly) | v46 |
| `cloudflare/datetime-api/post-onthisday.js` | ✅ Done (POST handler) | v50 |
| `migrations/009_enhanced_onthisday.sql` | ✅ Done | v44 |
| `migrations/010_otd_quality.sql` | ✅ Done (image_status, quality_breakdown, faq_questions) | v46 |
| 293 date index pages live on dev | ✅ Deployed | v48-v49 |
| 71,992 entries from 366 dates | ✅ Fetched (Wikipedia only) | v48 |
| **Schema 011** | ❌ TODO | **Item 1** |
| **QLever mirror** | ❌ TODO | **Item 4** |
| **byabbe.se + Muffin Labs** | ❌ TODO | **Item 3** |
| **Nager.Date holidays** | ❌ TODO | **Item 5** |
| **OpenHolidays (36 EU)** | ❌ TODO | **Item 6** |
| **Recency backfill (2-yr gap)** | ❌ TODO | **Item 7** |
| **Notability scoring** | ❌ TODO | **Item 8** |
| **Pageviews API** | ❌ TODO | **Item 9** |
| **DBpedia inbound links** | ❌ TODO | **Item 10** |
| **Weddings (414K from Wikidata)** | ❌ TODO | **Item 14** |
| **Person enrichment** | ❌ TODO | **Item 17** |
| **Category×date data** | ❌ TODO | **Item 18** |
| **Year-page data** | ❌ TODO | **Item 19** |
| **Country-lens data** | ❌ TODO | **Item 20** |
| **National day data (1500+)** | ❌ TODO | **Item 21** |
| **Holiday-year data** | ❌ TODO | **Item 22** |
| **Days-since/until data** | ❌ TODO | **Item 23** |
| **Zodiac/generation data** | ❌ TODO | **Item 24** |
| **RAG retrieval layer** | ❌ TODO | **Item 30** |
| **RAG generation layer** | ❌ TODO | **Item 31** |
| **Day Report generator** | ❌ TODO | **Item 32** |
| **CC BY-SA attribution + FAQ schema** | ❌ TODO | **Item 33** |
| **Dev API endpoints** | ❌ TODO | **Item 34** |
| **Multi-language data (PT/ES/DE)** | ❌ TODO | **Item 35** |

---

# PHASE 1 — Data Foundation (Weeks 1-3)

> **Goal**: Schema 011, all 5 source connectors, notability scoring, dedup, 365-day batch
> **Output**: 71K+ entries from 4 sources, all with provenance + notability, no thin rows

---

## [x] #1 — Schema 011: New fields + type enum (🔴 HIGH) ✅ DONE 2026-07-20

**Acceptance criteria**:
- New columns on `on_this_day`: `wikidata_id`, `wikipedia_title`, `star_sign`, `chinese_zodiac`, `generation`, `cause_of_death`, `age_at_death`, `current_age`, `profession` (JSON array), `language`, `rank_score`, `sitelinks`, `pageviews_30d_avg`, `inbound_links`
- New `type` enum: `event`, `birth`, `death`, `wedding`, `divorce`, `anniversary`, `bizarre`, `holiday`
- New `source` table: `source_id`, `url`, `retrieved_at`, `license`, `license_url`, `attribution_required` (per-row provenance)
- New `on_this_day_sources` join table: `(otd_id, source_id, raw_json, raw_text)` for full audit trail
- All existing rows get `source = 'wikipedia_rest'` with attribution stamp
- Migration runs cleanly on D1 (no FK violations, no duplicate column errors)
- Backward compatible with migration 010

**Files added**:
- ✅ `cloudflare/datetime-api/migrations/011_otd_blueprint_fields.sql` (25.8KB)

**What shipped**:
- 31 new columns on `onthisday` (person enrichment, notability, source provenance, anniversary, holiday, verification, couple fields)
- 7 new tables: `otd_entities`, `otd_observances`, `otd_holidays`, `otd_answer_cache`, `otd_sources`, `otd_pipeline_runs`, `otd_couples`
- FTS5 search on entities for RAG retrieval
- 22 new indexes for blueprint query patterns
- 12 source registry entries (wikimedia_feed, qlever, byabbe, muffinlabs, nager, openholidays, checkiday, pageviews, dbpedia, commons_api, etc.)
- Backfill: existing 71,992 rows tagged with `wikipedia_rest` source + CC BY-SA 4.0 attribution
- Pipeline run log entry for the original 71,992-row batch

**Status**: ✅ Schema written. Not yet applied to D1 (need to run `wrangler d1 execute`). Will apply during next deploy.

**Source**: Blueprint Ch 6 (DB architecture + 4 SPARQL recipes) + Dim05 (Wikidata/DBpedia)

---

## [ ] #2 — Source connector: switch to canonical api.wikimedia.org/feed/v1 (🔴 HIGH)

**Acceptance criteria**:
- Replace `en.wikipedia.org/api/rest_v1` with `api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/{MM}/{DD}`
- User-Agent header on every request: `DateAndTime-Live/1.0 (https://dateandtime.live; contact@dateandtime.live)`
- Exponential backoff honoring `Retry-After` (429 throttling)
- Max 5 req/s; budget 500 req/h anonymous
- 366 requests cover one language
- All 5 endpoints work: `events`, `births`, `deaths`, `selected`, `holidays`, `all`

**Files to modify**:
- `scripts/sources/wikipedia.js` — switch URL base, add UA policy + retry logic

**Source**: Blueprint Prompt A (ingestion crawler) + Dim04 (Wikimedia Feed API)

---

## [ ] #3 — byabbe.se + Muffin Labs cross-check connectors (🔴 HIGH)

**Acceptance criteria**:
- `scripts/sources/byabbe.js` — fetch `https://byabbe.se/on-this-day/{M}/{D}/events.json` (also `births.json`, `deaths.json`)
- `scripts/sources/muffinlabs.js` — fetch `https://history.muffinlabs.com/date/{M}/{D}`
- Both run in parallel with Wikimedia feed
- Rows tagged with `source = 'byabbe'` or `source = 'muffinlabs'`
- A row present in all 3 sources = "verified" status (used by dedup)
- A row in only 1 source = "review" status (flagged but not blocked)
- No zero-padding needed (byabbe) and no auth needed

**Files to add**:
- `scripts/sources/byabbe.js`
- `scripts/sources/muffinlabs.js`

**Source**: Blueprint Ch 5 (free data sources) + Prompt A cross-check mirrors

---

## [ ] #4 — QLever Wikidata connector (🔴 HIGH)

**Acceptance criteria**:
- `scripts/sources/wikidata.js` — switch SPARQL endpoint to `https://qlever.dev/api/wikidata` (mirror, 100x faster than WDQS)
- All 4 SPARQL recipes work:
  1. Births by month/day: `?person wdt:P31 wd:Q5; wdt:P569 ?dob. FILTER(MONTH(?dob)=N && DAY(?dob)=N)`
  2. Deaths by month/day
  3. Events by month/day (P31/Q1190554 + P580/P585)
  4. Weddings by month/day (P26 + pq:P580)
- Response time <2s per query (was 60s+ timeout on WDQS)
- Country code mapping (Q-ID → ISO 3166-1 alpha-2) for ~250 countries

**Files to modify**:
- `scripts/sources/wikidata.js` — switch SPARQL endpoint

**Source**: Blueprint Ch 5 (QLever) + Dim05 (Wikidata/DBpedia) + Ch 6 SPARQL recipes

---

## [ ] #5 — Nager.Date holidays connector (🔴 HIGH)

**Acceptance criteria**:
- `scripts/sources/nager.js` — fetch `https://date.nager.at/api/v3/publicholidays/{YYYY}/{CC}` for 197 countries
- Initial: US, GB, CA, AU (top 4 by traffic)
- Pulls current year + next year (per Blueprint Prompt A)
- Stored as `type='holiday'`, `category='public_holiday'`, `year` set per occurrence
- Local names + English names
- Types: Public, Bank, School, Authorities, Optional, Observance

**Files to add**:
- `scripts/sources/nager.js`

**Source**: Blueprint Ch 5 (free APIs catalog) + Prompt A (holidays)

---

## [ ] #6 — OpenHolidays connector (🟡 MED)

**Acceptance criteria**:
- `scripts/sources/openholidays.js` — fetch `https://openholidaysapi.org/PublicHolidays` for 36 EU countries
- School + public + bank holidays
- Coverage gap: Nager misses IN/PK/ET/IR/TH (5/20 top countries); OpenHolidays fills part of EU
- Stored as `type='holiday'`, with country code, language

**Files to add**:
- `scripts/sources/openholidays.js`

**Source**: Blueprint Ch 5 (free APIs catalog) + Dim07 (Holidays data)

---

## [ ] #7 — Recency backfill via day-article parsing (🔴 HIGH)

**Acceptance criteria**:
- `scripts/sources/day-page.js` — fetch `https://en.wikipedia.org/w/api.php?action=parse&page={Month_Day}&prop=wikitext&format=json`
- Parse Events section wikitext for the last 2 years (Wikimedia feed `events` silently excludes them per Blueprint Dim04 §F-3)
- Year-only precision: surface as `year_precision='year'`
- Pre-1582 Julian dates: flagged, year field set, not auto-converted
- False January-1 birthdays (year-only precision): detected and tagged

**Files to add**:
- `scripts/sources/day-page.js`

**Source**: Blueprint Prompt A (recency backfill) + Dim04 (day-page wikitext)

---

## [ ] #8 — Notability scoring library (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/notability.js` — exports `score(entity)` returning 0-100
- Formula: `0.5*log1p(sitelinks) + 0.3*log1p(pageviews) + 0.2*log1p(inbound_links)` then scale to 0-100
- Tiers: notable (60+), famous (80+), legendary (95+)
- Pre-computed at ingest time, never at read time
- Stored in `on_this_day.notability_score` and `entities.notability_score`

**Files to add**:
- `scripts/lib/notability.js`

**Source**: Blueprint Ch 6 (scoring formula)

---

## [ ] #9 — Pageviews fetcher (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/pageviews.js` — fetches `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{lang}.wikipedia/all-access/all-agents/{title}/daily/{start}/{end}`
- Trailing-90-day average per entity (cached to avoid 500 req/h limit)
- Batch mode: bulk fetch top 1,000 entities from a date
- Stored in `entities.avg_daily_views` (existing field)

**Files to add**:
- `scripts/lib/pageviews.js`

**Source**: Blueprint Ch 5 (pageviews API) + Dim05 (pageviews dump)

---

## [ ] #10 — DBpedia connector for inbound_links (🟡 MED)

**Acceptance criteria**:
- `scripts/sources/dbpedia.js` — SPARQL on `https://dbpedia.org/sparql`
- Count inbound links per entity: `SELECT ?s WHERE { ?s dbo:wikiPageWikiLink <URI> }`
- Top 1,000 entities per date (most notability)
- Stored in `entities.inbound_links` (existing field)

**Files to add**:
- `scripts/sources/dbpedia.js`

**Source**: Blueprint Ch 5 (DBpedia) + Dim05 (DBpedia data)

---

## [ ] #11 — Per-row source provenance + license capture (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/provenance.js` — every entry has `data_sources[]` array of `{source_id, url, retrieved_at, license, license_url, attribution_required}`
- For images: Commons `extmetadata` returns `LicenseShortName`, `Artist`, `AttributionRequired`, `LicenseUrl`
- Never hotlink fair-use `/wikipedia/en/` thumbnails (path prefix check)
- CC BY / CC BY-SA: render author + license link with thumbnail
- Public domain: no attribution needed but credit shown

**Files to add**:
- `scripts/lib/provenance.js`

**Source**: Blueprint Ch 6 (image pipeline) + Dim04 (Commons extmetadata)

---

## [ ] #12 — Multi-source dedup (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/dedup.js` — strict key: `(month, day, year, type, wikidata_id, source)`
- Fuzzy key: title Jaccard > 0.7
- Field merging: keep higher quality (longer description, higher resolution image, more sources)
- Output: deduped list with `verified_in[]` (which sources confirmed this entry)
- Logs dedup stats (rows removed, fields merged, conflicts resolved)

**Files to add**:
- `scripts/lib/dedup.js`

**Source**: Blueprint Insight #7 (multi-source dedup is hidden engineering cost) + Risk #1 (CC BY-SA)

---

## [ ] #13 — Run full 365-day batch through new pipeline (🔴 HIGH)

**Acceptance criteria**:
- Updated `scripts/fetch-otd-batch.js` orchestrates all 5+ sources
- 366 dates × 4-5 sources = ~1,800 requests
- Per-row provenance captured
- Notability scores computed
- Dedup applied
- Quality scores generated (existing 0-100 system)
- Output: `content/otd/all-365-with-sources.json` (slim, <25MB)
- Report: rows per source, dedup stats, avg quality, verified-vs-review split
- Runs in <30 min on Wikipedia + byabbe + Muffin + Nager
- Can resume from last successful date on failure

**Files to modify**:
- `scripts/fetch-otd-batch.js` — full pipeline integration

**Source**: Blueprint Ch 9 (Phase 1 deliverable) + KPI 30d (1,830 URLs indexed)

---

# PHASE 2 — Template Expansion (Weeks 4-6)

> **Goal**: Weddings, persons, category×date, year, country-lens, national day, holiday-year, days-since, zodiac data
> **Output**: All 14 page templates' underlying data, ready for static-page generation in a future session

---

## [ ] #14 — Wikidata weddings connector (🔴 HIGH)

**Acceptance criteria**:
- 414,149 dated marriages from Wikidata (P26 + PQ:P580)
- Stored as `type='wedding'` with `entity_id` (groom) + `entity2_id` (bride)
- Sitelink scoring: top 5,000 weddings per day
- Joined with `entities` for label + image + spouse info
- Deduplicated by couple pair

**Files to add**:
- `scripts/sources/wikidata-weddings.js`

**Source**: Blueprint Ch 5 (Weddings 414K) + Insight #6 (weddings most under-served)

---

## [ ] #15 — Wikidata divorces connector (🟡 MED)

**Acceptance criteria**:
- P26 with end-time qualifier (P580 end date)
- Stored as `type='divorce'`
- Top 1,000 by notability

**Files to add**:
- `scripts/sources/wikidata-divorces.js`

**Source**: Blueprint Ch 5 (Wikidata P26)

---

## [ ] #16 — Wikidata anniversaries (🟡 MED)

**Acceptance criteria**:
- P571 (inception) + P577 (publication) + P1619 (date)
- For organizations, books, films, etc.
- Stored as `type='anniversary'`
- Top 5,000 per day

**Files to add**:
- `scripts/sources/wikidata-anniversaries.js`

**Source**: Blueprint Ch 5 (Wikidata anniversary properties)

---

## [ ] #17 — Person data library (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/persons.js` — extracts person entities with:
  - `star_sign` (from birthday: Aries/Taurus/.../Pisces, computed)
  - `chinese_zodiac` (from birth year, computed)
  - `generation` (e.g., "Boomer", "Gen X", "Millennial", "Gen Z", from birth year ranges)
  - `age_at_death` (from P570 - P569)
  - `current_age` (today - P569 if alive)
  - `cause_of_death` (P509)
  - `profession[]` (P106 array)
  - `country` (P27)
- Output: `content/otd/persons/top-50k.json` (Q-ID + all fields)
- Top 50K people by notability

**Files to add**:
- `scripts/lib/persons.js`

**Source**: Blueprint Ch 6 (entities table) + Dim05 (Wikidata persons)

---

## [ ] #18 — Category×date data (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/category-date.js` — for each (date, category), group events by category
- 12 categories: battles, disasters, politics, science-space, sports, arts, music, literature, technology, religion, exploration, crime
- Output: `content/otd/categories/{category}/{month}-{day}.json` × 12 × 366 = 4,392 files (sample 200)
- 5-15 events per category×date (filtered by notability)

**Files to add**:
- `scripts/lib/category-date.js`

**Source**: Blueprint Ch 7 (T3 template: category×date) + Ch 6 (12-category taxonomy)

---

## [ ] #19 — Year-page data (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/year-pages.js` — for each year (~150, 1875-2025), aggregate:
  - All events in that year
  - All births in that year
  - All deaths in that year
  - Culture stats (TFA, POTD, OTD entries)
  - Top 10 by notability
- Output: `content/otd/years/{year}.json` × ~150

**Files to add**:
- `scripts/lib/year-pages.js`

**Source**: Blueprint Ch 7 (T4 template: year page) + 1969 / 1985 examples

---

## [ ] #20 — Country-lens data (🟡 MED)

**Acceptance criteria**:
- `scripts/lib/country-lens.js` — for each (country, date), "today in {country} history"
- Initial: US, UK, CN, AU, IN, BR, JP, DE, FR, CA (10 countries)
- Country = P27 in Wikidata, joined to entity
- Output: `content/otd/countries/{cca2}/{month}-{day}.json` × 10 × 366

**Files to add**:
- `scripts/lib/country-lens.js`

**Source**: Blueprint Ch 7 (country-lens + international expansion) + 53% US / 15% UK

---

## [ ] #21 — National day data (🔴 HIGH)

**Acceptance criteria**:
- `scripts/sources/checkiday.js` + `nager.js` — pull 1,500+ observances
- Per observance: date rule, origin, hashtags, ideas, country
- Output: `content/otd/national-days/{slug}.json` × 1,500
- Also indexed by date: `content/otd/national-days/by-date/{month}-{day}.json` × 366

**Files to add**:
- `scripts/sources/checkiday.js`
- `scripts/lib/national-days.js`

**Source**: Blueprint Ch 5 (Nager + Checkiday) + Ch 7 (T8 template: national day)

---

## [ ] #22 — Holiday-year data (🟡 MED)

**Acceptance criteria**:
- `scripts/lib/holiday-year.js` — computed movable feasts (Easter, Thanksgiving, Memorial Day, Labor Day, etc.) for next 3 years
- Top 200 holidays worldwide
- Output: `content/otd/holidays/{holiday-slug}/{year}.json`

**Files to add**:
- `scripts/lib/holiday-year.js`

**Source**: Blueprint Ch 7 (T9 template: holiday-year) + "Easter 2024 hit 6.5M searches"

---

## [ ] #23 — Days-since/until data (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/days-since.js` — index of notable events with dates for date-math tool
- Top 5,000 notable events indexed by date
- Pre-computed: "X days since Y", "X days until Y"
- Output: `content/otd/days-since-index.json` (slim)

**Files to add**:
- `scripts/lib/days-since.js`

**Source**: Blueprint Ch 7 (T7 template: days-since/until) + howlongagogo.com #1 at DR 56

---

## [ ] #24 — Zodiac/generation data (🟡 MED)

**Acceptance criteria**:
- `scripts/lib/zodiac.js` — for all top 50K people, group by:
  - Star sign (12)
  - Chinese zodiac (12)
  - Generation (Boomer/X/Millennial/Z/Alpha)
- Output: `content/otd/zodiac/{sign}.json` × 12
- Output: `content/otd/generation/{gen}.json` × 5

**Files to add**:
- `scripts/lib/zodiac.js`

**Source**: Blueprint Ch 7 (T11 template: zodiac) + Dim05 (sign from birthday)

---

# PHASE 3 — Premium + Distribution (Weeks 7-10)

> **Goal**: "X would be N today" data, widget digests, RAG pipeline, Day Report generator
> **Output**: All premium product data layer (no UI for now, but data ready for $4.99 reports + RAG + widgets)

---

## [ ] #25 — "X would be N today" data (🟡 MED)

**Acceptance criteria**:
- `scripts/lib/would-be-age.js` — for each deceased celebrity, compute would-be age as of today
- Output: `content/otd/would-be-age/today.json` (top 1,000 by notability)
- Refresh daily

**Files to add**:
- `scripts/lib/would-be-age.js`

**Source**: Blueprint Ch 7 (T7 + T9: anniversary math) + Insight #5 (birthday bump)

---

## [ ] #26 — "X years ago today" data (🟡 MED)

**Acceptance criteria**:
- `scripts/lib/anniversaries-today.js` — for each event, compute anniversary as of today
- Output: `content/otd/anniversaries-today/today.json` (top 1,000)
- Refresh daily

**Files to add**:
- `scripts/lib/anniversaries-today.js`

**Source**: Blueprint Ch 7 (T7: days-since) + Ch 10 Insight #5

---

## [ ] #27 — Chronicling America enrichment (🟢 LOW)

**Acceptance criteria**:
- `scripts/sources/loc.js` — `https://chroniclingamerica.loc.gov/` API
- 100-years-ago newspaper front pages for major events
- 12M historic US newspapers
- Output: `content/otd/loc/{date}.json` (one per date, 1900-1925)

**Files to add**:
- `scripts/sources/loc.js`

**Source**: Blueprint Ch 5 (Chronicling America) + Dim05 (LOC data)

---

## [ ] #28 — Wikimedia featured enrichment (🟢 LOW)

**Acceptance criteria**:
- `scripts/sources/featured.js` — Today's Featured Article, Picture of the Day, On The News, Most Read, Did You Know
- Output: `content/otd/featured/{YYYY-MM-DD}.json`
- Wikimedia feed extension

**Files to add**:
- `scripts/sources/featured.js`

**Source**: Blueprint Ch 5 (Wikimedia feeds) + Dim04

---

## [ ] #29 — Widget digest data (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/widget-digest.js` — pre-generate canonical daily digest for all 366 dates
- Top 5 events + 5 births + 5 deaths by notability per day
- Output: `content/otd/widget/{MM}-{DD}.json` × 366
- Used by embeddable widget (Prompt D)
- Cached at edge 24h

**Files to add**:
- `scripts/lib/widget-digest.js`

**Source**: Blueprint Prompt D (embeddable widget) + Ch 8 (free widget tier)

---

## [ ] #30 — RAG retrieval layer (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/rag-retrieve.js` — 3-stage retrieval:
  1. **Deterministic parse**: regex + dateparser + entity linker
  2. **SQL retrieval**: query `on_this_day JOIN entities` by (month, day, year, entity)
  3. **FTS5 fallback**: fuzzy entity name search
- Cap ~30 rows per retrieval
- Returns `{records, sql_query, parse_metadata}`
- Refusal string when empty: "I can only answer from our verified database."
- Cost: $0 (no LLM)

**Files to add**:
- `scripts/lib/rag-retrieve.js`
- `cloudflare/datetime-api/routes/ask.js` (POST /api/v1/ask)

**Source**: Blueprint Ch 8 (RAG architecture, Prompt E stage 1-3) + Risk #2 (hallucination)

---

## [ ] #31 — RAG generation layer (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/rag-generate.js` — Gemini 2.5 Flash-Lite via REST
- Stage 4: Grounded generation (records-only prompt, cite record IDs)
- Stage 5: Post-verification (strip uncited claims)
- Stage 6: Serve + QA log
- Cost: $0.00032/answer (Flash-Lite)
- Answer cache: KV key = normalized intent + parameters (target ≥90% hit)
- Pre-gen: ~1,100 canonical answers for $0.35-1.60 one-time

**Files to add**:
- `scripts/lib/rag-generate.js`
- `cloudflare/datetime-api/routes/ask.js` (extend)

**Source**: Blueprint Ch 8 (RAG, Prompt E stage 4-6) + Unit economics table

---

## [ ] #32 — Day Report generator (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/day-report.js` — generates $4.99 report for any date
- 400-800 word cited narrative
- Printable PDF (via `pdfkit` or similar)
- Square social share card
- Free teaser: 3 cited facts + blurred poster preview
- Output: `content/otd/reports/{date}.{json,pdf}`
- Template engines: narrative (LLM-cached) + facts (deterministic)

**Files to add**:
- `scripts/lib/day-report.js`
- `scripts/templates/day-report.html` + `.pdf` generator

**Source**: Blueprint Ch 8 (Feature #1: Birthday AI Report) + MyHeritage pattern (82M uses)

---

# PHASE 4 — Premium Surface + i18n (Weeks 11-13)

> **Goal**: CC BY-SA attribution, FAQ schema, dev API, multi-language, verification reports
> **Output**: Production-ready data layer with provenance + API + 3 languages

---

## [ ] #33 — CC BY-SA attribution helpers + FAQ schema (🔴 HIGH)

**Acceptance criteria**:
- `scripts/lib/attribution.js` — generates per-page footer + JSON-LD
- Required text: "Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0."
- License hyperlink: `https://creativecommons.org/licenses/by-sa/4.0/`
- Image credits where shown (per-image `extmetadata.Artist` + `LicenseShortName`)
- FAQ schema: `FAQPage` JSON-LD with 3-5 Q&A per date
- Used by static page generator (when UI work resumes)

**Files to add**:
- `scripts/lib/attribution.js`

**Source**: Blueprint Ch 6 (image pipeline) + Risk #1 (CC BY-SA) + Ch 7 (FAQ for PAA/AIO)

---

## [ ] #34 — Developer API endpoints (🟡 MED)

**Acceptance criteria**:
- `cloudflare/datetime-api/routes/otd.js` — REST endpoints:
  - `GET /api/v1/on-this-day/{MM-DD}` — events + births + deaths + holidays
  - `GET /api/v1/born/{MM-DD}` — persons only
  - `GET /api/v1/died/{MM-DD}` — persons only
  - `GET /api/v1/today` — server date + payload
  - `GET /api/v1/holidays/{CC}/{YYYY}` — Nager data
  - `GET /api/v1/national-days/{MM-DD}` — observances
  - `GET /api/v1/ask?q=...` — RAG (Phase 3)
- Per-key quotas: Hobby 10K/mo, Pro 100K/mo, Business 1M/mo
- Data only, no auth UI (per user)

**Files to add**:
- `cloudflare/datetime-api/routes/otd.js`
- `cloudflare/datetime-api/lib/rate-limit.js`

**Source**: Blueprint Ch 5 + Insight #2 (premium/API entirely unclaimed) + Feature #5

---

## [ ] #35 — Multi-language data (🟢 LOW)

**Acceptance criteria**:
- Fetch Wikimedia Feed API for PT, ES, DE, FR, ID, HI
- 14 languages available per `https://en.wikipedia.org/api/rest_v1/feed/availability`
- Per language: 366 dates, 200-500 events each
- Output: `content/otd/i18n/{lang}/{MM-DD}.json` × 6 langs × 366 = 2,196 files
- calendarr.com draws 34% of traffic from Brazil (PT) per Blueprint Dim01

**Files to add**:
- `scripts/sources/wikipedia-i18n.js`

**Source**: Blueprint Ch 5 (14 languages) + Ch 7 (T14 non-English) + Calendarr 34% Brazil

---

## [ ] #36 — Cross-source verification report (🟡 MED)

**Acceptance criteria**:
- `scripts/lib/verify.js` — for each entry, check presence in 2+ sources
- Output: `content/otd/verification-report.json`
- Stats:
  - % verified (in 2+ sources)
  - % review (in 1 source only)
  - Coverage gaps (dates with <10 entries)
  - Source divergence (conflicting years/dates between sources)
- Used by editorial review queue (when UI work resumes)

**Files to add**:
- `scripts/lib/verify.js`

**Source**: Blueprint Insight #7 (multi-source dedup) + Risk #1 (CC BY-SA)

---

# 📈 Progress Tracking

| Phase | Items | Done | % |
|---|---|---|---|
| Phase 1 (Data foundation) | 13 | 1 | 8% |
| Phase 2 (Template expansion) | 11 | 0 | 0% |
| Phase 3 (Premium + distribution) | 8 | 0 | 0% |
| Phase 4 (Premium surface + i18n) | 4 | 0 | 0% |
| **TOTAL** | **36** | **1** | **3%** |

> 36 items (some blueprints split into sub-items for clarity). User said "all todos" so this is the comprehensive list.

---

# 🎯 Blueprint-to-Todo Cross-Reference

| Blueprint Source | Items |
|---|---|
| Ch 5 (Data sources) | #2, #3, #4, #5, #6, #7, #9, #10, #27, #28, #35 |
| Ch 6 (DB architecture) | #1, #8, #11, #14, #15, #16, #17 |
| Ch 7 (SEO templates) | #13, #18, #19, #20, #21, #22, #23, #24, #25, #26 |
| Ch 8 (AI premium) | #30, #31, #32, #34 |
| Ch 9 (90-day plan) | All (phases) |
| Ch 10 (Insights) | #12 (dedup), #33 (CC BY-SA), #36 (verify) |
| Risk #1 (CC BY-SA) | #1, #11, #33, #36 |
| Risk #2 (Hallucination) | #30, #31 |
| Insight #6 (Weddings) | #14 |

---

# 🔧 Working Approach

1. **One item at a time, fully complete before moving on** — per Blueprint "data first, because every surface reads from the same fact table"
2. **Test against acceptance criteria** — every item has explicit pass/fail
3. **Update this file as we go** — check boxes, log progress
4. **Commit per item** — atomic commits for review
5. **No UI work** — per user constraint, output goes to `content/otd/`, `scripts/`, `migrations/`

---

# 🚦 Status Legend

- `[ ]` pending
- `[x]` done
- `[~]` in progress
- `[!]` blocked

---

# 📂 File Organization (Target)

```
dateandtime-live/
├── scripts/
│   ├── lib/                          # Phase 1-4
│   │   ├── image-fallback.js         ✅
│   │   ├── quality-scorer.js         ✅
│   │   ├── validation.js             ✅
│   │   ├── auto-improve.js           ✅
│   │   ├── notability.js             [ ] #8
│   │   ├── pageviews.js              [ ] #9
│   │   ├── provenance.js             [ ] #11
│   │   ├── dedup.js                  [ ] #12
│   │   ├── persons.js                [ ] #17
│   │   ├── category-date.js          [ ] #18
│   │   ├── year-pages.js             [ ] #19
│   │   ├── country-lens.js           [ ] #20
│   │   ├── national-days.js          [ ] #21
│   │   ├── holiday-year.js           [ ] #22
│   │   ├── days-since.js             [ ] #23
│   │   ├── zodiac.js                 [ ] #24
│   │   ├── would-be-age.js           [ ] #25
│   │   ├── anniversaries-today.js    [ ] #26
│   │   ├── widget-digest.js          [ ] #29
│   │   ├── rag-retrieve.js           [ ] #30
│   │   ├── rag-generate.js           [ ] #31
│   │   ├── day-report.js             [ ] #32
│   │   ├── attribution.js            [ ] #33
│   │   ├── verify.js                 [ ] #36
│   │   └── rate-limit.js             [ ] #34
│   ├── sources/                      # Phase 1-4
│   │   ├── wikipedia.js              ✅ → modify #2
│   │   ├── wikidata.js               ✅ → modify #4
│   │   ├── byabbe.js                 [ ] #3
│   │   ├── muffinlabs.js             [ ] #3
│   │   ├── nager.js                  [ ] #5
│   │   ├── openholidays.js           [ ] #6
│   │   ├── day-page.js               [ ] #7
│   │   ├── dbpedia.js                [ ] #10
│   │   ├── wikidata-weddings.js      [ ] #14
│   │   ├── wikidata-divorces.js      [ ] #15
│   │   ├── wikidata-anniversaries.js [ ] #16
│   │   ├── checkiday.js              [ ] #21
│   │   ├── loc.js                    [ ] #27
│   │   ├── featured.js               [ ] #28
│   │   └── wikipedia-i18n.js         [ ] #35
│   ├── fetch-otd-batch.js            ✅ → extend #13
│   └── build-otd-from-data.js        ✅
├── cloudflare/datetime-api/
│   ├── migrations/
│   │   ├── 009_enhanced_onthisday.sql ✅
│   │   ├── 010_otd_quality.sql       ✅
│   │   ├── 011_otd_blueprint_fields.sql  [ ] #1
│   │   └── 011_sources_table.sql     [ ] #1
│   ├── routes/
│   │   ├── otd.js                    [ ] #34
│   │   └── ask.js                    [ ] #30-31
│   ├── post-onthisday.js             ✅
│   └── cron-worker.js                ✅
├── content/otd/                      # Output data
│   ├── dates/                        ✅ (top-5-dates.json)
│   ├── all-365-with-sources.json     [ ] #13
│   ├── persons/top-50k.json          [ ] #17
│   ├── categories/                   [ ] #18
│   ├── years/                        [ ] #19
│   ├── countries/                    [ ] #20
│   ├── national-days/                [ ] #21
│   ├── holidays/                     [ ] #22
│   ├── days-since-index.json         [ ] #23
│   ├── zodiac/                       [ ] #24
│   ├── would-be-age/                 [ ] #25
│   ├── anniversaries-today/          [ ] #26
│   ├── loc/                          [ ] #27
│   ├── featured/                     [ ] #28
│   ├── widget/                       [ ] #29
│   ├── reports/                      [ ] #32
│   ├── i18n/                         [ ] #35
│   └── verification-report.json      [ ] #36
└── docs/otd-pipeline/
    ├── README.md                     ✅
    ├── TODO.md                       ✅ (this file)
    ├── sample-data-5-dates.json      ✅
    ├── onthisday-teardown-and-blueprint.agent.final.md  ✅
    └── ...
```

---

# ⏭️ Next Action

**Item #1 — Schema 011 migration** (in_progress). Building the D1 schema with all blueprint fields, type enum, sources table, and per-row provenance.

---

_Last sync: 2026-07-20 21:30 EST_
