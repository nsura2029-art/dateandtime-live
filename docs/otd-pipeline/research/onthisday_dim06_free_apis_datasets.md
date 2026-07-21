# On This Day — Free/Freemium APIs & Open Datasets Catalog (Dimension 06)

Research date: **2026-07-19**. All "tested" notes below are live `curl` results from that date unless marked otherwise.

## Ranked summary table

| # | Source | Type(s) | Scale (observed) | Auth / limits | License | Cost | Verdict |
|---|--------|---------|------------------|---------------|---------|------|---------|
| 1 | **Wikimedia Feed / REST "onthisday"** (cross-ref, other agent) | events, births, deaths, holidays, "selected" | Full en.wp daily pages, curated + all entries | Anonymous OK w/ descriptive UA; api.wikimedia.org free tier w/ OAuth | CC BY-SA 3.0 | Free | **USE (primary)** |
| 2 | **byabbe.se On-This-Day** | events, births, deaths | Jul 19: 185 births, 92 deaths, ~60 events/day | None; no key; no documented rate limit | CC BY-SA 3.0 (Wikipedia-derived) | Free | **USE (primary mirror/breadth)** |
| 3 | **Muffin Labs Today in History** | events, births, deaths | Jul 19: 60 events, 217 births, 117 deaths | None; no key; no documented rate limit | CC BY-SA 3.0 (Wikipedia-derived) | Free | **USE (mirror/cross-check)** |
| 4 | **Nager.Date (date.nager.at)** | public holidays by country/year | 197 country entries returned; US 2025 → ~30 holidays incl. observances | None; no key; open-source (Docker self-host) | MIT (code); data compiled from public sources | Free | **USE (holidays primary)** |
| 5 | **vacanza/holidays (Python lib)** | public/bank/religious holidays, some observances | 100+ countries, computed offline | n/a (library, offline) | MIT | Free | **USE (offline holidays)** |
| 6 | **Wikidata SPARQL** | births, deaths, notable people by month/day | Millions of persons w/ P569/P570 | No key; fair-use query limits | CC0 | Free | **USE (births/deaths enrichment)** |
| 7 | **OpenHolidays API** | public + school holidays | 36 countries (Europe-centric + BR, MX, ZA); **US not covered** | None; no key | Open data (official sources) | Free | **USE for EU; gap for US** |
| 8 | **commenthol/date-holidays (JS lib)** | holidays incl. observances, names in local languages | ~200 countries, offline | n/a (library) | ISC (repo license) | Free | **USE (alt offline holidays)** |
| 9 | **dayinhistory.dev** | events, births, deaths | Today: 13 events, 58 births, 46 deaths | Free: 10 req/hr no key; Premium: 1,000 req/hr w/ key | Proprietary; provenance "internet sources + AI fine-tuned" | Free / **$5/mo** | **MAYBE (too slow for bulk; OK daily)** |
| 10 | **API-Ninjas: Day in History + Historical Events** | events (by date or text/year search) | Not stated; sample quality good | API key; custom month/day + offset = premium only; free = today only | Proprietary; commercial use requires paid plan | Free key / paid from **$39/mo** (100k calls) | **MAYBE** |
| 11 | **Chronicling America (LOC)** | historic US newspapers by date ("100 years ago today") | 12M+ digitized pages, 1777–1963 | No key; JSON API; Cloudflare bot protection observed | Public domain (pre-1928 core) | Free | **USE (enrichment angle)** |
| 12 | **Checkiday – National Holiday API** | US "national day" observances + descriptions | 5,000+ holidays | API key; free 100 req/mo via APILayer | Proprietary | Free tier / paid 5k–75k+ req/mo | **MAYBE (observances)** |
| 13 | **Calendarific** | holidays + observances, 230+ countries, 3,000+ regions, 100+ languages | Claims 90% of requests <10 ms | API key; free 500 calls/mo, attribution + non-commercial only | Proprietary | Free / $100–$4,000/yr | **MAYBE (pay for breadth)** |
| 14 | **HistoryLabs events-api** | events by date/year, minYear/maxYear filters (BC support) | Wikipedia live-scrape; hosted demo **unreachable** at test time | None documented; self-host Go binary | MIT (code), CC BY-SA data | Free | **MAYBE (self-host only)** |
| 15 | **GitHub/Kaggle offline datasets** (details below) | events/births/deaths/holidays seeds | Varies (4.7k–100k+ rows) | n/a | MIT / Apache 2.0 / CC BY-SA | Free | **MAYBE (bootstrap seeds)** |
| 16 | **Numbers API (numbersapi.com)** | date trivia | Was 1 fact/date | None — **service degraded**: API paths return host 404 page at test time | Data files historically on GitHub | Free | **SKIP (broken)** |
| 17 | **timeanddate Holidays API** | holidays + observances, 230 countries, yr 1–3999; has "On This Day" service at Premium | 7,000+ holidays | Key + signature; 3-month trial only, no free tier | Temporary data license; must delete data on lapse | **$99–$999/yr** per product | **SKIP (paid-only, restrictive)** |
| 18 | **famousbirthdays.com** | celebrity birthdays | — | **No public API** (only dead unofficial scrapers); scraping = ToS risk | Proprietary | — | **SKIP → use Wikidata** |
| 19 | **LOC "Today in History" (loc.gov/today/)** | daily history highlights | Human-facing page | No dedicated API/RSS found; Cloudflare JS-challenge blocks bots | Public domain content mostly | Free | **SKIP as API; scrape unfriendly** |

---

## Per-source detail

### 1. Wikimedia Feed API / REST `onthisday` (cross-reference)
One line as agreed — covered by another agent: `GET https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/07/19` (or `en.wikipedia.org/api/rest_v1/feed/onthisday/{type}/{MM}/{DD}`) returns curated `selected`, `events`, `births`, `deaths`, `holidays` with thumbnails; CC BY-SA; the natural primary source. Note: both wikimedia.org hosts were unreachable (HTTP 000) from this research sandbox, so no live re-test here.

### 2. byabbe.se On-This-Day API — USE
- **Tested:** `curl https://byabbe.se/on-this-day/7/19/events.json` → HTTP 200, `application/json`, ~1.3 s. Also `births.json` (185 records) and `deaths.json` (92 records) for 7/19.[^1^]
- **Docs:** Swagger UI at `https://byabbe.se/on-this-day/`, OAS3 spec at `/on-this-day.yaml`. Only 3 endpoints: `/{month}/{day}/events.json|births.json|deaths.json`.[^2^]
- **License (from spec):** "data is all harvested from Wikipedia and therefore licensed under Creative Commons Attribution-ShareAlike 3.0"; "The API itself is available as-is. Just keep calm and query on" → no formal rate limit, be polite.[^2^]
- **Data shape:** `{date, wikipedia, events:[{year, description, wikipedia:[{title, wikipedia}]}]}` — clean entity links for dedup/joining.
- **Reliability:** run by Albin Larsson (long-time Wikimedia contributor), stable for years; single-hobbyist hosting, no SLA.
- **Coverage:** all 366 days; ~50–60 events/day; English Wikipedia only.

### 3. Muffin Labs "Today in History" — USE
- **Tested:** `curl https://history.muffinlabs.com/date/7/19` → HTTP 200 JSON, 1.45 s; counts: **Events 60, Births 217, Deaths 117**. Also `/date` (today).[^3^]
- **Data shape:** `{date, url, data:{Events,Births,Deaths}}`; each item has `year` (string, may contain "BC"), `text`, `html`, `no_year_html`, `links[]`.
- **License:** Wikipedia-derived; the site nav links "Data License" to Wikipedia's CC BY-SA 3.0 text. Source code: `muffinista/really-simple-history-api` (59★) and parser `muffinista/history_parse` (11★).[^4^]
- **Reliability:** running since ~2014, widely used in tutorials; single hobbyist (Sinatra app), no SLA, no documented limits.

### 4. Nager.Date — USE (holidays)
- **Tested:** `curl https://date.nager.at/api/v3/publicholidays/2025/US` → HTTP 200 JSON array with `date, localName, name, countryCode, fixed, global, counties[], types[]` (types include `Public`, `Bank`, `Observance`). `/api/v3/availablecountries` returned **197** entries.[^5^]
- Other endpoints: `/NextPublicHolidays/{code}`, `/IsTodayPublicHoliday/{code}`, subdivision support.
- **Auth/limits:** none, no key. **License/cost:** free; code is MIT and self-hostable via Docker/NuGet (`nager/Nager.Date`, 1,388★).[^6^]
- **Verdict:** best free public-holiday feed; observance coverage is thin vs. Checkiday/Calendarific.

### 5. OpenHolidays API — USE (EU) 
- **Tested:** `GET https://openholidaysapi.org/PublicHolidays?countryIsoCode=US&validFrom=2025-01-01&validTo=2025-12-31` → HTTP 200 but `[]` — **US not covered**. `/Countries` lists **36** codes: AD AL AT BE BG BR BY CH CZ DE EE ES FR HR HU IE IT LI LT LU LV MC MD MT MX NL PL PT RO RS SE SI SK SM VA ZA.[^7^]
- Also `/SchoolHolidays`, `/Subdivisions`, `/Languages`. No key; open-data project sourcing official government publications. Good EU complement to Nager.Date (adds school holidays).

### 6. Holiday libraries as offline datasets
- **vacanza/holidays** (Python "Open World Holidays Framework"): 1,907★, MIT, actively updated (2026-07). 100+ countries incl. observance categories; compute any year locally → zero rate-limit risk.[^8^]
- **commenthol/date-holidays** (JS): 1,082★, ISC-family license (GitHub flags NOASSERTION), ~200 countries with local-language names; YAML data files reusable directly.[^9^]
- **nager/Nager.Date** (1,388★, MIT) doubles as Nager.Date's backend — self-host if you need the REST shape offline.[^6^]

### 7. dayinhistory.dev — MAYBE
- **Tested:** `curl https://api.dayinhistory.dev/v1/today/events/` → HTTP 200 (no key): DRF-paginated JSON, today = 13 events, plus `/v1/today/births/` (58) and `/v1/today/deaths/` (46) with `type, name, description, bio` fields.[^10^]
- **Docs (dayinhistory.dev/docs):** date-specific routes `GET /v1/events/january/15/`, `/v1/births/december/25/`, `/v1/deaths/april/14/`.[^11^]
- **Limits/pricing:** Free 10 req/hr, no key; Premium **$5/mo** → 1,000 req/hr, Bearer key (`dih_` prefix).[^10^]
- **Caveats:** new service (records created 2025-05), provenance = "reliable internet sources fine-tuned with advanced AI models" (opaque, Wikipedia-adjacent but not verbatim); claims 99.9% uptime, no status page seen. 10 req/hr free = ~86 days to harvest a full year → free tier only viable for daily-refresh, premium for backfill.

### 8. API-Ninjas — MAYBE
- **`/v1/dayinhistory`**: returns `[{year, month, day, event}]`; month/day/offset/limit are **premium** parameters — free key gets today's events only.[^12^]
- **`/v1/historicalevents`**: search by `text`, `year` (negative = BCE), `month`, `day`; ≤10 per call, `offset` premium-only — unique "search events by keyword" capability in this catalog.[^13^]
- **Auth/pricing:** `X-Api-Key` header; free account, no card. Paid: Developer **$39/mo** (100k calls/mo, **no caching allowed**), Business $99/mo (1M), Professional $199/mo (10M); commercial use requires a paid plan.[^14^]
- Verdict: useful for keyword search and production SLA, but date backfill is paywalled and caching restrictions conflict with building your own DB on the cheap tier.

### 9. LOC Today in History + Chronicling America
- `loc.gov/today/`: **403 Cloudflare JS-challenge to curl even with browser UA** at test time; no dedicated API or RSS found. LOC's machine access program is "LC for Robots" (labs.loc.gov/lc-for-robots) covering the general loc.gov JSON API (`?fo=json`) — the Today-in-History feature itself isn't a documented API resource.[^15^]
- **Chronicling America**: documented free JSON API (`chroniclingamerica.loc.gov/about/api/`), 12M+ newspaper pages 1777–1963, no key; e.g. `…/search/pages/results/?andtext=apollo&date1=07/19/1969&date2=07/19/1969&format=json`. Also Cloudflare-challenged from this sandbox (403) — usable from normal networks/servers. Ideal for a "front page 100 years ago today" enrichment lane.[^15^][^16^]

### 10. Numbers API — SKIP (broken)
- **Tested 2026-07-19:** `http(s)://numbersapi.com/7/19/date` and `/42/trivia` return a **generic hosting 404 HTML page** (Chinese panel template); root `/` returns HTTP 200 but an effectively empty page. DNS points to a lone DigitalOcean droplet (159.65.220.83). The service is **down/degraded**, not just moved. Even when alive it offered only one crowd-sourced trivia fact per date (date/math/trivia/year), no auth — nice-to-have, now dead. Historical data dumps exist in GitHub forks if ever wanted.[^17^]

### 11. Famous birthdays sources
- **famousbirthdays.com: no public API — confirmed.** Only a long-dead unofficial Mashape wrapper (`daxeel/CelebInfo-API`, 2015) exists; scraping violates ToS → skip.[^18^]
- **Fallbacks (USE):** Wikidata SPARQL, e.g. persons with `MONTH(?dob)=7 && DAY(?dob)=19` on `wdt:P569` (and `P570` for deaths) — CC0, no key, scales to millions; combine with sitelink counts for notability ranking. (query.wikidata.org unreachable from this sandbox — standard, well-documented endpoint.)[^19^]
- **Kaggle seeds (MAYBE):** `mexwell/famous-birthdays` (4.7k famous persons + zodiac, CSV 245 KB, license "Other")[^20^]; `dharun4772/celebrity-birthdays-full-calendar-year` (full calendar coverage, 9.1 MB CSV, **Apache 2.0**).[^21^]

### 12. HistoryLabs events-api — MAYBE (self-host)
- GitHub `HistoryLabs/events-api`: Go, MIT, 8★ (low adoption). `GET /date?month=7&date=19&minYear=-500&maxYear=2022` and `GET /year/:year?onlyDated=` — scrapes Wikipedia day/year pages on demand, includes BCE support and `yearInt` normalization.[^22^]
- Hosted demo `https://events.historylabs.io/` was **unreachable (HTTP 000)** at test time → treat as self-host-only. Useful if you want year-range filtering without building the scraper.

### 13. GitHub open datasets (seeds) — MAYBE
| Repo | ★ | What | License |
|------|---|------|---------|
| `PrintNow/TodayInHistory` | 96 | Full "历史上的今天" DB from Wikipedia, **MySQL + JSON** dumps | MIT [^23^] |
| `muffinista/history_parse` | 11 | Parser → per-day JSON of en.wp today-in-history (regenerate your own mirror) | (code) [^4^] |
| `sasalatart/on-this-day` | 12 | Scraper + server for events/births/deaths by date | (code) [^24^] |
| `zhoujinshi/history_in_today` | 3 | JSON today-in-history DB (zh), updated 2023 | — [^23^] |
| `nkl-kst/MMM-OnThisDay` | 45 | MagicMirror module consuming the Wikimedia feed (reference impl.) | — [^24^] |
Note: generic GitHub searches ("on this day dataset", "historical events csv") return mostly noise; the above are the quality hits plus the holiday libraries in §6.

### 14. timeanddate.com — SKIP
Holidays API: 7,000+ holidays/observances, 230 countries, years 1–3999, includes an "On This Day" service — but **no free tier** (3-month trial only); Basic $99/yr (1 country, 50k credits), Plus $399/yr, Premium $999/yr; data license is temporary — you must delete cached data if the license lapses. Excellent data, wrong economics for this project.[^25^][^26^]

### 15. Calendarific — MAYBE
230+ countries, 3,000+ subdivisions, 100+ languages, observances included. Free: 500 calls/mo, attribution required, non-commercial, quarterly updates. Starter $100/yr (10k/mo), Business $500/yr (weekly updates), Enterprise $4,000/yr (daily). Status page exists (calendarific.statuspal.io). Good if US/global *observances* beyond Nager.Date are needed and attribution is acceptable.[^27^][^28^]

### 16. Checkiday — MAYBE
"National Holiday API" — 5,000+ mostly-US observances (National X Day), human-researched, powers CNN/NYT-style "today is…" content. Free tier **100 req/mo** via APILayer marketplace; paid tiers 5k/35k/75k+ req/mo; official client libraries (JS, Python, C#, PHP, Go, Dart, Rust). Free quota suffices for a once-daily pull of "today + tomorrow".[^29^]

---

## Recommended ingestion stack

1. **Primary (events/births/deaths): Wikimedia Feed API** (`/feed/v1/wikipedia/en/onthisday/…`) — curated `selected` + full lists + holidays, free with a polite User-Agent. *(Details owned by the Wikimedia agent.)*
2. **Breadth mirror + redundancy: byabbe.se and Muffin Labs** — both Wikipedia-derived (CC BY-SA), keyless, no documented limits. Harvest all 366 days once (~1,100 requests total across both), then diff weekly; either can backstop the other. Self-host regeneration path exists via `muffinista/history_parse` or HistoryLabs events-api if either goes down.
3. **Holidays: Nager.Date** (global public/bank + light observances) **+ OpenHolidays** (EU school/public) **+ vacanza/holidays** as the offline compute fallback. Upgrade path for US "national day" observances: Checkiday free tier (100 req/mo is enough for daily pulls) or Calendarific free (with attribution).
4. **Famous-birthday depth: Wikidata SPARQL** (CC0, rank by sitelinks), seeded/QA'd against the Apache-2.0 Kaggle celebrity-birthday CSV.
5. **Editorial enrichment: Chronicling America** "this day's newspaper, 100 years ago" (public domain, keyless).
6. **Skip:** timeanddate (paid-only + delete-on-lapse license), famousbirthdays.com (no API), numbersapi.com (dead), scraping loc.gov/today (bot-blocked, no API).

---
[^1^]: Live curl test, 2026-07-19: `https://byabbe.se/on-this-day/7/19/events.json|births.json|deaths.json` → HTTP 200 JSON.
[^2^]: byabbe.se OAS3 spec: `https://byabbe.se/on-this-day/on-this-day.yaml` (license block CC BY-SA 3.0; "keep calm and query on").
[^3^]: Live curl test, 2026-07-19: `https://history.muffinlabs.com/date/7/19` → HTTP 200; counts parsed from response.
[^4^]: GitHub API, 2026-07-19: `muffinista/really-simple-history-api` (59★), `muffinista/history_parse` (11★).
[^5^]: Live curl tests, 2026-07-19: `https://date.nager.at/api/v3/publicholidays/2025/US`, `/api/v3/availablecountries` (197 entries).
[^6^]: GitHub API: `nager/Nager.Date` 1,388★, MIT — "REST API, Docker, or NuGet, 200+ countries" (repo description; observed country list = 197).
[^7^]: Live curl tests, 2026-07-19: `https://openholidaysapi.org/PublicHolidays?countryIsoCode=US…` → `[]`; `/Countries` → 36 codes.
[^8^]: GitHub API: `vacanza/holidays` 1,907★, MIT, updated 2026-07-18.
[^9^]: GitHub API: `commenthol/date-holidays` 1,082★, license NOASSERTION (ISC-family).
[^10^]: dayinhistory.dev homepage + live curl of `https://api.dayinhistory.dev/v1/today/events|births|deaths/`, 2026-07-19 (10 req/hr free; Premium $5/mo, 1,000 req/hr).
[^11^]: dayinhistory.dev docs: `https://dayinhistory.dev/docs` (endpoint patterns; "internet sources fine-tuned with advanced AI models").
[^12^]: API-Ninjas Day in History docs: `https://api-ninjas.com/api/dayinhistory` (month/day/offset/limit = premium).
[^13^]: API-Ninjas Historical Events docs: `https://api-ninjas.com/api/historicalevents`.
[^14^]: API-Ninjas pricing page: `https://api-ninjas.com/pricing` (Developer $39/mo, 100k calls, no caching on Developer tier; commercial use requires paid plan).
[^15^]: Live curl tests, 2026-07-19: `https://www.loc.gov/today/` and `https://chroniclingamerica.loc.gov/search/pages/results/?format=json` → HTTP 403 Cloudflare challenge; LC for Robots overview (Zenodo GLAM Labs deck): `https://zenodo.org/records/7789480` (loc.gov JSON API, Chronicling America APIs, 12M+ pages).
[^16^]: public-apis listing: Chronicling America API — "Provides access to millions of pages of historic US newspapers", no auth: `https://github.com/public-apis/public-apis` (raw README).
[^17^]: Live curl tests, 2026-07-19: `https://numbersapi.com/7/19/date`, `/42/trivia` → host 404 page; DNS 159.65.220.83.
[^18^]: `daxeel/CelebInfo-API` (unofficial famousbirthdays.com wrapper, 2015, Mashape-defunct): `https://github.com/daxeel/CelebInfo-API`; no official API advertised by famousbirthdays.com.
[^19^]: Wikidata Query Service pattern (standard): `https://query.wikidata.org/sparql` — `?person wdt:P31 wd:Q5; wdt:P569 ?dob. FILTER(MONTH(?dob)=7 && DAY(?dob)=19)`; CC0. (HTTP 000 from sandbox; documented, not live-tested.)
[^20^]: Kaggle: `mexwell/famous-birthdays` — 4.7k famous persons, birthdays.csv 245 KB, license "Other (specified in description)": `https://www.kaggle.com/datasets/mexwell/famous-birthdays/data`.
[^21^]: Kaggle: `dharun4772/celebrity-birthdays-full-calendar-year` — birthdays.csv 9.13 MB, Apache 2.0: `https://www.kaggle.com/datasets/dharun4772/celebrity-birthdays-full-calendar-year`.
[^22^]: GitHub: `HistoryLabs/events-api` README (endpoints, DTOs) + GitHub API repo metadata (8★, MIT, Go); hosted demo `https://events.historylabs.io/` unreachable at test time.
[^23^]: GitHub search API, 2026-07-19: `PrintNow/TodayInHistory` (96★, MIT, MySQL+JSON from Wikipedia), `zhoujinshi/history_in_today` (3★).
[^24^]: GitHub search API, 2026-07-19 (q=onthisday): `sasalatart/on-this-day` (12★), `nkl-kst/MMM-OnThisDay` (45★), `MarketingPipeline/OnThisDay.js` (18★).
[^25^]: timeanddate Holidays API pricing: `https://dev.timeanddate.com/holidays/pricing` ($99/$399/$999 per yr; 7,000+ holidays; On This Day service at Premium).
[^26^]: timeanddate API Terms: `https://dev.timeanddate.com/terms` (temporary data license; delete data on lapse).
[^27^]: Calendarific pricing: `https://calendarific.com/` (Free 500 calls/mo + attribution; Starter $100/yr; Business $500/yr; Enterprise $4,000/yr; 230+ countries).
[^28^]: Calendarific profile/status: `https://apitracker.io/a/calendarific` (status page calendarific.statuspal.io); coverage 230+ countries / 3,000+ regions per explinks provider profile.
[^29^]: Checkiday on APILayer marketplace: `https://marketplace.apilayer.com/checkiday-api` (5,000+ holidays; free 100 req/mo; client libraries).
