## 5. Free Data Sources and API Stack

The founder's core question — "where do I get events, births, deaths, weddings, and holidays for free?" — has a decisive answer: one primary API, two mirrors, a layered holiday stack, and two enrichment lanes, every one of them free and live-tested on 2026-07-19. Total acquisition cost is $0 and roughly one hour of crawling: 366 requests per language against the Wikimedia Feed API returns the full daily corpus, measured at ~438 items for a typical English date and up to ~1,400 on January 1 [^4-4^][^4-10^]. Money enters the picture only for one niche upgrade — US "national day" observances — and even there a free tier suffices. Table 5.1 ranks the full catalog; the sections that follow explain how to deploy it.

**Table 5.1 — Ranked source catalog for the on-this-day database (all entries live-tested 2026-07-19 unless noted)**

| # | Source | Types | Scale (observed) | Auth / limits | License | Verdict |
|---|--------|-------|------------------|---------------|---------|---------|
| 1 | Wikimedia Feed API `onthisday` | events, births, deaths, holidays, curated "selected" | ~438 items/day EN (Jul 19); 14 languages [^4-4^][^4-8^] | Keyless with descriptive UA; 500 req/h anon, 5,000/h free token [^4-12^] | CC BY-SA [^4-11^] | **Use — primary** |
| 2 | byabbe.se On-This-Day | events, births, deaths | Jul 19: ~60 events, 185 births, 92 deaths [^6-1^] | None, no key, no documented limit [^6-2^] | CC BY-SA 3.0 [^6-2^] | **Use — mirror** |
| 3 | Muffin Labs Today in History | events, births, deaths | Jul 19: 60 events, 217 births, 117 deaths [^6-3^] | None, no key [^6-3^] | CC BY-SA 3.0 [^6-4^] | **Use — cross-check** |
| 4 | Nager.Date | public/bank holidays by country | 197 countries; US 2025 ≈ 30 incl. observances [^6-5^] | None, no key; MIT self-host option [^6-6^] | MIT code, public-source data [^6-6^] | **Use — holidays primary** |
| 5 | vacanza/holidays (Python lib) | public/bank/religious holidays | 100+ countries, computed offline [^6-8^] | n/a — library | MIT [^6-8^] | **Use — offline holidays** |
| 6 | Wikidata SPARQL | births, deaths, weddings, notability | millions of persons; 414,149 dated marriages [^6-19^][^5-9^] | No key; fair-use query limits | CC0 [^6-19^] | **Use — enrichment** |
| 7 | OpenHolidays API | public + school holidays | 36 countries, EU-centric; **no US** [^6-7^] | None, no key [^6-7^] | Open data (official sources) [^6-7^] | Use — EU layer |
| 8 | commenthol/date-holidays (JS lib) | holidays with local-language names | ~200 countries, offline [^6-9^] | n/a — library | ISC-family [^6-9^] | Use — JS alternative |
| 9 | Chronicling America (LOC) | historic US newspapers by date | 12M+ pages, 1777–1963 [^6-15^] | No key; JSON API [^6-16^] | Public domain [^6-15^] | Use — editorial lane |
| 10 | dayinhistory.dev | events, births, deaths | today: 13 events, 58 births, 46 deaths [^6-10^] | Free 10 req/h; $5/mo → 1,000 req/h [^6-10^] | Proprietary; AI-blended provenance [^6-11^] | Maybe — daily refresh |
| 11 | API-Ninjas | events by date or keyword | ≤10 results/call [^6-13^] | Key; date backfill premium-only, from $39/mo [^6-14^] | Proprietary [^6-14^] | Maybe — keyword search |
| 12 | Checkiday | US "national day" observances | 5,000+ holidays [^6-29^] | Key; free 100 req/mo [^6-29^] | Proprietary [^6-29^] | Maybe — observances |
| 13 | Calendarific | holidays + observances | 230+ countries, 100+ languages [^6-27^] | Key; free 500 calls/mo, non-commercial [^6-27^] | Proprietary [^6-27^] | Maybe — breadth |
| 14 | HistoryLabs events-api | events with year-range, BCE | Wikipedia live-scrape; hosted demo down [^6-22^] | None; self-host Go binary [^6-22^] | MIT code / CC BY-SA data [^6-22^] | Maybe — self-host |
| 15 | timeanddate Holidays API | holidays + observances, 230 countries | 7,000+ holidays [^6-25^] | $99–$999/yr; **delete data on lapse** [^6-25^][^6-26^] | Temporary license [^6-26^] | Skip — wrong economics |
| 16 | numbersapi.com | date trivia | was 1 fact/date | **Dead — API paths return host 404** [^6-17^] | — | Skip — broken |
| 17 | famousbirthdays.com | celebrity birthdays | — | **No public API**; scraping is ToS risk [^6-18^] | Proprietary | Skip — use Wikidata |

The table's shape is the strategy. The top tier is entirely Wikipedia-derived, which defines the niche's cost structure: the raw corpus is a commons, so engineering budget should go to verification, dedupe, and packaging rather than acquisition. The freemium middle tier (rows 10–14) sizes its free quotas deliberately below bulk-harvest needs — dayinhistory.dev's 10 requests/hour would need ~86 days to backfill a single year — making these services viable only as daily-refresh supplements, never as the pipeline [^6-10^]. The skip tier shares one signature: restrictive data terms (timeanddate's delete-on-lapse license) or no legitimate machine access (famousbirthdays.com) [^6-26^][^6-18^]. Note the structural hole: **no free feed serves weddings** — Wikidata is the only structured source, which is why a query service earns row 6.

### 5.1 Primary source: the Wikimedia Feed API `onthisday`

Build the database backbone on the Wikimedia Feed API. Three properties make it the obvious primary source: it is structured (five typed lists per day with hydrated article metadata), it is multilingual (14 Wikipedias: en, de, fr, sv, pt, ru, es, ar, bs, uk, it, tr, zh, cs), and it is Wikimedia-operated on its own CDN — the same feed that powers the official Wikipedia apps since 2017 [^4-2^][^4-8^].

```
# Canonical (WMF API portal); MM/DD must be zero-padded
GET https://api.wikimedia.org/feed/v1/wikipedia/{lang}/onthisday/{all|selected|events|births|deaths|holidays}/{MM}/{DD}
# Keyless legacy mirror — same JSON, no auth at all
GET https://{lang}.wikipedia.org/api/rest_v1/feed/onthisday/{type}/{MM}/{DD}

curl -A "YourApp/1.0 (https://yoursite.example/; you@example.com)" \
  "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/07/19"
```

Measured volume for July 19 (English): 20 selected + 60 events + 228 births + 119 deaths + 11 holidays ≈ **438 items in one `all` call**; January 1, the largest day article (210,913 B of wikitext), runs an estimated 1,200–1,400 items [^4-5^][^4-3^][^4-9^][^4-7^][^4-10^]. Plan capacity for ~170k–200k items per language-year, with births roughly half of all rows. The schema is uniform across types: `{text, year, pages[]}`, where each `pages[]` entry carries `title`, `wikibase_item`, `thumbnail`, `extract`, and `content_urls` — the last giving ready-made attribution links [^4-5^]. Four gotchas will crash a naive importer:

1. **Recency filter (undocumented):** `events` silently excludes the last ~2 years — the Jul 19 feed starts at 2018 while the day article already lists 2024–2025 entries. Backfill recent events by parsing day articles via `action=parse` (Chapter 6) [^4-3^][^4-9^].
2. **Holidays carry no `year`, and `pages` can be an empty array** (real example: "Palace Day") [^4-7^].
3. **Thumbnails are optional, and some are fair-use enwiki images** (`/wikipedia/en/` paths) that must not be hotlinked [^4-5^].
4. **Ancient years arrive as small or negative integers** ("AD 64", "484 BC") — validate before storing as unsigned [^4-9^].

Rate limits are generous: 500 requests/hour anonymous (one language in ~45 minutes) and 5,000/hour with a free personal token (all 14 languages in ~1 hour) [^4-12^]. The one hard rule is a descriptive `User-Agent` with contact info — WMF now machine-enforces UA policy with 429 throttling, so this header is non-negotiable [^4-13^]. Honor `429`/`Retry-After` with exponential backoff [^4-14^].

### 5.2 Mirrors and fallbacks (live-tested)

Deploy two mirrors from day one, because the primary's single point of failure is Wikipedia itself. byabbe.se and Muffin Labs both republish Wikipedia-derived events/births/deaths as keyless JSON under CC BY-SA, with no documented rate limits [^6-1^][^6-2^][^6-3^]:

```
curl "https://byabbe.se/on-this-day/7/19/events.json"   # also births.json, deaths.json
curl "https://history.muffinlabs.com/date/7/19"         # events + births + deaths in one call
```

Their counts diverge from the feed — on Jul 19, births were 185 (byabbe) vs 217 (Muffin) vs 228 (feed) — because each snapshots Wikipedia at a different time [^6-1^][^6-3^][^4-9^]. Treat divergence as a cross-check signal, not an error: a row present in all three is verified; a row in one is a review candidate. Both mirrors are single-hobbyist services with no SLA, so never hard-depend on either; if one dies, regenerate your own mirror with the `muffinista/history_parse` parser or the self-hosted HistoryLabs Go binary (MIT), which adds year-range filtering and BCE support [^6-4^][^6-22^].

The freemium tier is strictly optional. dayinhistory.dev (free 10 req/h; $5/mo for 1,000 req/h) blends sources with AI — provenance too opaque for a verification-first product, acceptable for a daily "freshness ping" [^6-10^][^6-11^]. API-Ninjas offers the catalog's only keyword-search-over-events capability (`/v1/historicalevents?text=moon`), but date backfill is paywalled from $39/mo and the Developer tier forbids caching — incompatible with building your own DB [^6-12^][^6-13^][^6-14^]. numbersapi.com, once a trivia staple, is dead (host 404) — skip [^6-17^].

### 5.3 Holidays and observances

Holidays are a separate acquisition problem: the Wikimedia feed's holiday list is thin (11 items on Jul 19, mostly Christian feast days) and carries no country or type metadata [^4-7^]. The fix is a layered stack — compute what is computable, fetch what is not. Table 5.2 compares the options.

**Table 5.2 — Holiday source comparison**

| Source | Coverage | Observances | Auth / cost | License | Role |
|--------|----------|-------------|-------------|---------|------|
| Nager.Date | 197 countries, public/bank; `types` field [^6-5^] | Thin | None; free [^6-5^] | MIT code [^6-6^] | Primary API |
| OpenHolidays | 36 countries, EU-centric + BR/MX/ZA; school holidays [^6-7^] | No; **no US** [^6-7^] | None; free [^6-7^] | Open data [^6-7^] | EU layer |
| vacanza/holidays | 100+ countries, computed offline [^6-8^] | Category tags | Free library (1,907★) [^6-8^] | MIT [^6-8^] | Offline fallback |
| commenthol/date-holidays | ~200 countries, local-language names [^6-9^] | Yes | Free library (1,082★) [^6-9^] | ISC-family [^6-9^] | JS alternative |
| Checkiday | 5,000+ US national days [^6-29^] | Yes — core strength | Free 100 req/mo [^6-29^] | Proprietary [^6-29^] | US observances upgrade |
| Calendarific | 230+ countries, 3,000+ subdivisions [^6-27^] | Yes | Free 500 calls/mo, non-commercial [^6-27^] | Proprietary [^6-27^] | Breadth upgrade |
| timeanddate | 230 countries, years 1–3999 [^6-25^] | Yes | $99–$999/yr, delete-on-lapse [^6-25^][^6-26^] | Temporary [^6-26^] | Skip |

The winning principle is compute-over-fetch. Public holidays are deterministic calendar math, so Nager.Date plus OpenHolidays plus an offline library covers every meaningful market at $0 — and the offline library (vacanza in Python, date-holidays in JS) deletes rate-limit and uptime risk from the stack entirely [^6-5^][^6-7^][^6-8^][^6-9^]. The genuine gap is US informal observances ("National Pizza Day"), which only Checkiday and Calendarific cover with depth; both free tiers are sized for exactly the production pattern a live site needs — a once-daily "today + tomorrow" pull — so seed from Wikipedia and upgrade later without re-architecting [^6-29^][^6-27^]. Keep the Wikimedia feed's holidays as the Wikipedia-linked layer (feast days and national days with articles attached). Reject timeanddate despite the best raw data: its temporary license forces deletion of cached data on lapse, which is incompatible with owning a durable database [^6-26^].

```
GET "https://date.nager.at/api/v3/publicholidays/2026/US"
GET "https://date.nager.at/api/v3/availablecountries"
GET "https://openholidaysapi.org/PublicHolidays?countryIsoCode=DE&validFrom=2026-01-01&validTo=2026-12-31"
```

### 5.4 Editorial and enrichment lanes

Three free feeds turn a list site into a destination. First, one extra Wikimedia call powers an entire "Today" page: `featured/{yyyy}/{mm}/{dd}` returns the day's featured article, picture of the day, most-read top 50, in-the-news, did-you-know, and the curated on-this-day list — cache it once daily shortly after 00:00 UTC [^4-2^][^4-8^]. Second, the Library of Congress's Chronicling America API (keyless JSON, 12M+ digitized newspaper pages, 1777–1963, public domain) enables a "front page from 100 years ago today" module no feed competitor offers [^6-15^][^6-16^]:

```
GET "https://chroniclingamerica.loc.gov/search/pages/results/?andtext=apollo&date1=07/19/1969&date2=07/19/1969&format=json"
```

Third, weddings — the founder's requested fifth type — exists in no feed. Wikidata closes the gap under CC0: 414,149 dated marriages via spouse statements with start-time qualifiers, plus births/deaths by `MONTH(?dob)`/`DAY(?dob)` filters with sitelink counts as a ready-made notability ranking [^5-9^][^6-19^]. The tested SPARQL recipes are Chapter 6's material; the sourcing decision belongs here.

### 5.5 Licensing: what you must carry forward

Everything in the primary lane is CC BY-SA, and that is workable — if the schema is designed for it now. Wikipedia text (event blurbs, extracts) is CC BY-SA + GFDL; attribution requires credit, a license link, and indication of changes, and each `pages[]` object ships the exact URLs needed (`content_urls.desktop.page` and the revision-history link for author credit) [^4-11^][^4-15^]. Recommended per-page string:

> "Text from Wikipedia contributors via the Wikimedia Feed API, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)." [^4-15^]

Three traps matter. **Share-alike:** verbatim storage of `text`/`extract` makes your DB a CC BY-SA copy, and rewritten or translated blurbs remain CC BY-SA derivatives — plan the database license accordingly; storing bare facts (year + "X happened") is not an adaptation [^4-15^]. **Images are not covered by the text license:** fetch each file's license and artist from Commons `extmetadata` (`action=query&prop=imageinfo&iiprop=extmetadata`) and attribute per image; never redistribute `/wikipedia/en/` fair-use thumbnails [^4-5^][^4-16^]. **Proprietary tiers prohibit database-building:** Checkiday and Calendarific free tiers are runtime-lookup arrangements with attribution, not seed sources [^6-27^][^6-29^]. The counterweight is Wikidata's CC0 — zero obligations, making it the right home for derived assets like notability scores and spouse-pair wedding records [^6-19^].

This is the handoff to Chapter 6: because every row in the database carries a different license and provenance trail (CC BY-SA feed rows, CC0 Wikidata rows, MIT-computed holidays, public-domain newspaper links), per-row source provenance is not a nice-to-have — it is the schema's organizing constraint, and the ingestion blueprint in Chapter 6 builds on exactly that.

#### Chapter References

*Citation convention: `[^4-N^]` cites reference N of the Dimension 04 report (Wikimedia API); `[^5-N^]` cites Dimension 05 (Wikidata/DBpedia); `[^6-N^]` cites Dimension 06 (free APIs catalog). Original indices preserved.*

**From Dimension 04 — Wikimedia "On This Day" API field report:**

- [^4-2^]: wikifeeds service README (route list, 2-digit MM/DD rule, `feed/availability`) — https://github.com/wikimedia/mediawiki-services-wikifeeds
- [^4-3^]: rest_v1 mirror, `onthisday/events/07/19` (live-tested 2026-07-19, no auth; year-descending, starts 2018) — https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/07/19
- [^4-4^]: Feed API `onthisday/all/07/19` (live-tested, 200, anonymous) — https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/07/19
- [^4-5^]: Feed API `onthisday/selected/07/19` (live-tested; 20 items; includes fair-use `/wikipedia/en/` thumbnails) — https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/07/19
- [^4-7^]: Feed API `onthisday/holidays/07/19` (live-tested; 11 items; `"Palace Day"` has `"pages":[]`) — https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/holidays/07/19
- [^4-8^]: `feed/availability` (live-tested; on_this_day languages: en, de, fr, sv, pt, ru, es, ar, bs, uk, it, tr, zh, cs) — https://en.wikipedia.org/api/rest_v1/feed/availability
- [^4-9^]: "July 19" day-article wikitext sections (exact events/births/deaths counts, fetched 2026-07-19) — https://en.wikipedia.org/w/index.php?title=July_19&action=raw&section=N
- [^4-10^]: "January 1" section byte offsets via Action API (210,913 B; basis of Jan-1 volume estimate) — https://en.wikipedia.org/w/api.php?action=parse&page=January_1&prop=sections&format=json
- [^4-11^]: WMF/RESTBase terms as quoted in WMF materials (≤200 req/s; UA policy; content CC BY-SA 3.0/GFDL) — https://www.usenix.org/system/files/pepr22_slides_triedman.pdf
- [^4-12^]: Official Wikimedia "Rate limits" page (Nov 2024) as quoted at Stack Overflow — anonymous 500 req/h per IP; personal token 5,000 req/h — https://stackoverflow.com/questions/13608589/limits-of-the-wikipedia-api
- [^4-13^]: WMF User-Agent policy and 429 enforcement (D. Kinzler) — https://meta.wikimedia.org/wiki/User-Agent_policy ; https://github.com/OpenRefine/OpenRefine/issues/7731
- [^4-14^]: Rate-limit etiquette (429/`Retry-After`, backoff) — https://apis.io/rate-limits/wikidata/wikidata-rate-limits/
- [^4-15^]: Wikipedia:Reusing Wikipedia content + WMF Terms of Use — https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content ; https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use
- [^4-16^]: Wikimedia Enterprise (license metadata per request); Commons license metadata pattern `action=query&prop=imageinfo&iiprop=extmetadata` — https://enterprise.wikimedia.com/

**From Dimension 05 — Wikidata/DBpedia report:**

- [^5-9^]: Executed on QLever public Wikidata endpoint (https://qlever.dev/api/wikidata): count of P26 spouse statements with pq:P580 start-time = 414,149 (query-time 54 ms).

**From Dimension 06 — Free/freemium APIs & open datasets catalog:**

- [^6-1^]: Live curl tests, 2026-07-19: byabbe.se events/births/deaths JSON — https://byabbe.se/on-this-day/7/19/events.json
- [^6-2^]: byabbe.se OAS3 spec (CC BY-SA 3.0 license block; "keep calm and query on") — https://byabbe.se/on-this-day/on-this-day.yaml
- [^6-3^]: Live curl test, 2026-07-19: Muffin Labs Today in History (60 events, 217 births, 117 deaths) — https://history.muffinlabs.com/date/7/19
- [^6-4^]: GitHub API: `muffinista/really-simple-history-api` (59★), `muffinista/history_parse` (11★) — https://github.com/muffinista/really-simple-history-api
- [^6-5^]: Live curl tests, 2026-07-19: Nager.Date public holidays + available countries (197 entries) — https://date.nager.at/api/v3/publicholidays/2025/US
- [^6-6^]: GitHub API: `nager/Nager.Date` (1,388★, MIT; REST/Docker/NuGet) — https://github.com/nager/Nager.Date
- [^6-7^]: Live curl tests, 2026-07-19: OpenHolidays — US query returns `[]`; `/Countries` lists 36 codes — https://openholidaysapi.org/Countries
- [^6-8^]: GitHub API: `vacanza/holidays` (1,907★, MIT, updated 2026-07-18) — https://github.com/vacanza/holidays
- [^6-9^]: GitHub API: `commenthol/date-holidays` (1,082★, ISC-family/NOASSERTION) — https://github.com/commenthol/date-holidays
- [^6-10^]: dayinhistory.dev homepage + live curls of `/v1/today/events|births|deaths/` (free 10 req/h; Premium $5/mo) — https://api.dayinhistory.dev/v1/today/events/
- [^6-11^]: dayinhistory.dev docs ("internet sources fine-tuned with advanced AI models") — https://dayinhistory.dev/docs
- [^6-12^]: API-Ninjas Day in History docs (month/day/offset/limit = premium) — https://api-ninjas.com/api/dayinhistory
- [^6-13^]: API-Ninjas Historical Events docs (keyword search; ≤10 per call) — https://api-ninjas.com/api/historicalevents
- [^6-14^]: API-Ninjas pricing (Developer $39/mo, 100k calls, no caching; commercial use requires paid plan) — https://api-ninjas.com/pricing
- [^6-15^]: Live curl tests, 2026-07-19: loc.gov/today + Chronicling America (403 Cloudflare challenge from sandbox; usable from normal networks); LC for Robots overview — https://www.loc.gov/today/ ; https://zenodo.org/records/7789480
- [^6-16^]: public-apis listing: Chronicling America API, no auth — https://github.com/public-apis/public-apis
- [^6-17^]: Live curl tests, 2026-07-19: numbersapi.com API paths return host 404 page (service dead) — https://numbersapi.com/7/19/date
- [^6-18^]: Dead unofficial famousbirthdays.com wrapper (2015, Mashape-defunct); no official API — https://github.com/daxeel/CelebInfo-API
- [^6-19^]: Wikidata Query Service pattern (P569/P570 + MONTH/DAY filters; CC0) — https://query.wikidata.org/sparql
- [^6-22^]: GitHub: `HistoryLabs/events-api` (Go, MIT, 8★; minYear/maxYear, BCE; hosted demo unreachable) — https://github.com/HistoryLabs/events-api
- [^6-25^]: timeanddate Holidays API pricing ($99/$399/$999 per yr; 7,000+ holidays) — https://dev.timeanddate.com/holidays/pricing
- [^6-26^]: timeanddate API Terms (temporary data license; delete data on lapse) — https://dev.timeanddate.com/terms
- [^6-27^]: Calendarific pricing (Free 500 calls/mo + attribution; Starter $100/yr; 230+ countries) — https://calendarific.com/
- [^6-29^]: Checkiday National Holiday API on APILayer (5,000+ holidays; free 100 req/mo) — https://marketplace.apilayer.com/checkiday-api
