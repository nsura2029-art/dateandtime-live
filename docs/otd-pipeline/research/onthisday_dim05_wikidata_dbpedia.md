# Building a rich "On This Day" database from Wikidata SPARQL + DBpedia + Wikipedia dumps

Scope: events, births, deaths, holidays, weddings/anniversaries — beyond what the Wikimedia Feed API
(`api.wikimedia.org/feed/v1/wikipedia/en/onthisday/...`) provides. **Every query below was executed
and the sample results are real output** (July 19 used as the running example unless noted).

**Verification environment note.** In this sandbox, direct `curl` egress was blocked, so queries were
executed as URL-encoded HTTP GETs against the live endpoints (equivalent to
`curl -G -H 'Accept: application/json' -H 'User-Agent: <your-app>'`). Two SPARQL endpoints were used:

* **Official WDQS** — `https://query.wikidata.org/sparql` [^1^]. Works for light queries; the heavy
  full-scan month/day queries **timed out / were connection-killed** there (documented below).
* **QLever public mirror of Wikidata** — `https://qlever.dev/api/wikidata` [^2^]. Answered the *same*
  heavy queries in **0.05–1.3 s**. QLever requires explicit `PREFIX` declarations (it does not
  predefine `wd:`/`wdt:`) and does not support the Blazegraph-specific `SERVICE wikibase:label`
  (use `rdfs:label` + `FILTER(LANG(...))` instead). QLever is a recommended production fallback;
  it is the engine Scholia is migrating to [^3^].

For production `curl` usage, the canonical call is:

```bash
curl -G 'https://query.wikidata.org/sparql' \
  --data-urlencode query@query.rq \
  -H 'Accept: application/json' \
  -H 'User-Agent: YourApp/1.0 (https://yourapp.example; you@example.com)'
```

WDQS fair-use policy: 60 s query timeout, ~5 concurrent queries, token-bucket error quota [^4^].

---

## Wikidata SPARQL recipes (tested, per data type)

### 1a. Births on a month/day — WORKS (heavy on WDQS, fast on QLever)

Query as run on QLever (verbatim; prefixes expanded, `rdfs:label` instead of the label service):

```sparql
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?person ?name ?dob ?sitelinks WHERE {
  ?person wdt:P569 ?dob .
  ?person wikibase:sitelinks ?sitelinks .
  ?person rdfs:label ?name . FILTER(LANG(?name)="en")
  FILTER(MONTH(?dob)=7 && DAY(?dob)=19)
}
ORDER BY DESC(?sitelinks)
LIMIT 10
```

Equivalent WDQS-flavored version (uses the label service; **valid but timed out (>60 s, HTTP 502 /
connection closed) on the public WDQS endpoint** when tested — this query scans ~11 M `wdt:P569`
statements and Blazegraph has no month/day index):

```sparql
SELECT ?person ?personLabel ?dob ?sitelinks WHERE {
  ?person wdt:P569 ?dob .
  ?person wikibase:sitelinks ?sitelinks .
  FILTER(MONTH(?dob)=7 && DAY(?dob)=19)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?sitelinks)
LIMIT 20
```

Actual top results (QLever, 1.33 s, July 19) [^5^]:

| person | name | dob | sitelinks |
|---|---|---|---|
| Q132964 | Vladimir Mayakovsky | 1893-07-19 | 124 |
| Q46373  | Edgar Degas | 1834-07-19 | 113 |
| Q15873  | Brian May | 1947-07-19 | 90 |
| Q244674 | Benedict Cumberbatch | 1976-07-19 | 89 |
| Q60030  | Herbert Marcuse | 1898-07-19 | 87 |
| Q107402 | Rosalyn Sussman Yalow | 1921-07-19 | 86 |

Notes:
* `wikibase:sitelinks` (number of wiki pages linked to the item) is the standard built-in notability
  proxy; it is present in the RDF dump so it works on both WDQS and QLever.
* Add `?person wdt:P31 wd:Q5` if you want to be strict about "humans only" (a few fictional characters
  and animals have `P569`); it makes the WDQS query even slower.
* Precision caveat: `wdt:P569` truthy values include dates stored with *year-only* precision as
  `YYYY-01-01` only if entered that way — most year-only dates are not in `wdt:` at all (the truthy
  dump includes them with the stored precision normalized to day level, so **January 1 is
  over-populated**; consider filtering those out or using full statement nodes with
  `wikibase:timePrecision >= 11`).

### 1b. Deaths on a month/day — WORKS

Verbatim QLever query (identical except `P570`):

```sparql
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?person ?name ?dod ?sitelinks WHERE {
  ?person wdt:P570 ?dod .
  ?person wikibase:sitelinks ?sitelinks .
  ?person rdfs:label ?name . FILTER(LANG(?name)="en")
  FILTER(MONTH(?dod)=7 && DAY(?dod)=19)
}
ORDER BY DESC(?sitelinks)
LIMIT 10
```

Actual top results (QLever, 0.98 s, July 19) [^6^]: **Syngman Rhee** (d. 1965, 88 sitelinks),
**Garry Marshall** (2016, 74), **Rutger Hauer** (2019, 69), **Henry II, Holy Roman Emperor**
(1024, 65), **Nguyễn Phú Trọng** (2024, 64), **Aung San** (1947, 63), James Garner (2014, 61).

### 1c. Events with point-in-time (P585) on a month/day — WORKS, needs noise filtering

```sparql
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?event ?name ?date ?sitelinks WHERE {
  ?event wdt:P585 ?date .
  ?event wikibase:sitelinks ?sitelinks .
  ?event rdfs:label ?name . FILTER(LANG(?name)="en")
  FILTER(MONTH(?date)=7 && DAY(?date)=19)
}
ORDER BY DESC(?sitelinks)
LIMIT 15
```

Actual results (QLever, 1.01 s) [^7^]: Battle of Guadalete (711, 43 sitelinks), Battle of the Golden
Spurs (1302, 40), 2026 FIFA World Cup final (39), **2024 CrowdStrike incident** (37), 2020 Hungarian
Grand Prix (31), **United Airlines Flight 232** (1989, 26), The Day the Earth Smiled (2013, 23).

Two important data-quality caveats observed in the raw output:

1. **Calendar-day items pollute results** — e.g. `Q12966099 "July 19, 2010"` (22 sitelinks) is a
   Wikinews/archive "day" item, not an event. Filter with
   `FILTER NOT EXISTS { ?event wdt:P31/wdt:P279* wd:Q573 }` (day) or, better, require the item to be
   an occurrence: `?event wdt:P31/wdt:P279* wd:Q1656682` (event) — the subclass path is expensive on
   WDQS, cheap on QLever.
2. **Julian/Gregorian caveat** — `wdt:P585` truthy values lose the calendar model. The Battle of the
   Golden Spurs was 11 July 1302 (Gregorian) but surfaces as 1302-07-19 because the item stores a
   Julian date. If exact day matching matters for pre-1582 events, query the full statement node
   (`p:P585 / psv:P585 / wikibase:timeValue` + `wikibase:timeCalendarModel`) and normalize yourself.

### 1d. Weddings (spouse P26 + qualifier start time P580) — FEASIBLE, with dedupe + ranking

Model: marriage dates live on the **statement**, not the item: `?person p:P26 ?stmt`,
`?stmt ps:P26 ?spouse`, `?stmt pq:P580 ?weddingStart`. Verbatim tested query:

```sparql
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?person ?name ?spouse ?spouseName ?wedding ?sitelinks WHERE {
  ?person p:P26 ?stmt .
  ?stmt ps:P26 ?spouse .
  ?stmt pq:P580 ?wedding .
  ?person wikibase:sitelinks ?sitelinks .
  ?person rdfs:label ?name . FILTER(LANG(?name)="en")
  ?spouse rdfs:label ?spouseName . FILTER(LANG(?spouseName)="en")
  FILTER(MONTH(?wedding)=7 && DAY(?wedding)=19)
}
ORDER BY DESC(?sitelinks)
LIMIT 10
```

Actual results (QLever, 0.96 s, July 19) [^8^] — genuinely famous weddings surface:

* **Enrico Fermi & Laura Fermi**, 1928 (169 sitelinks)
* **Frank Sinatra & Mia Farrow**, 1966 (135)
* John William Strutt (Lord Rayleigh) & Evelyn Strutt, 1871 (95)
* Santiago Ramón y Cajal & Silveria Fañanás, 1879 (94)
* Nelly Furtado & Demacio Castellon, 2008 (89)
* Daphne du Maurier & Frederick Browning, 1932 (73)
* Charli XCX & George Daniel, 2025 (68)
* Naya Rivera & Ryan Dorsey, 2014 (53)

Coverage measurement: `SELECT (COUNT(*) AS ?c) WHERE { ?person p:P26 ?stmt . ?stmt pq:P580 ?w }`
→ **414,149 spouse statements with a start-time qualifier** (QLever, 54 ms) [^9^]. Caveats:

* Every marriage appears **twice** (once per spouse) — dedupe on `(?spouse pair, ?wedding)`.
* Ranking by `?person` sitelinks misses couples where the *other* spouse is the famous one;
  rank by `MAX` of both, or fetch both counts.
* `pq:P580` on `P26` means "start of the marriage", which is usually the wedding date but can be a
  civil-partnership start; precision may be year-only (normalized to `-01-01` in truthy-style values —
  statement nodes preserve precision).
* No `P26` statements exist for non-notable spouses; royal/celebrity coverage is good, long tail is
  genealogical data (many high-QID items).

### 1e. Holidays/observances for a date — WORKS but sparse; supplement needed

Recurring fixed-date observances are modeled with **`wdt:P837` "day in year for periodic event"**,
whose object is a *date item* (e.g. "July 19" = `wd:Q2726`, instance of `Q14795564` "day of the
year") [^10^]. Verbatim tested queries:

```sparql
-- find the date item for the day you want (July 19 -> Q2726)
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT ?item ?inst WHERE {
  ?item rdfs:label "July 19"@en .
  OPTIONAL { ?item wdt:P31 ?inst }
} LIMIT 10
```

```sparql
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?holiday ?name ?sitelinks WHERE {
  ?holiday wdt:P837 wd:Q2726 .
  ?holiday rdfs:label ?name . FILTER(LANG(?name)="en")
  OPTIONAL { ?holiday wikibase:sitelinks ?sitelinks }
}
ORDER BY DESC(?sitelinks)
LIMIT 25
```

Actual results (QLever, 8 ms): **Burmese Martyrs' Day** (8 sitelinks), Feast day of Saint Anne (2),
Sandinista Revolution Day (0) [^11^]. The same query on the **official WDQS endpoint also ran fine**
(light query, plus one unlabeled item `Q4425959`) [^12^].

Coverage reality check: `SELECT (COUNT(*) AS ?c) WHERE { ?s wdt:P837 ?o }` → **6,950 statements
total** [^13^] — roughly ~19/day before language/label filtering, and many days have only 2–5
English-labeled hits. **Movable feasts** (Easter, Ramadan, Thanksgiving = "4th Thursday of
November") are *not* representable via P837; some carry `P585` per-year occurrences only.
Recommendation: seed holidays from Wikipedia day-page "Holidays and observances" sections (richer,
human-curated; see §4) or the Feed API `holidays` bucket, and use Wikidata P837 only as a
structured cross-check.

---

## Notability ranking

Layered strategy (tested pieces marked):

1. **`wikibase:sitelinks` (primary, free, offline-able).** Already embedded in the queries above;
   available in the RDF dump, so it can be precomputed for all entities from a dump without any API
   calls. Rule of thumb from the July 19 runs: ≥50 sitelinks ≈ "headline" items (Mayakovsky 124,
   Degas 113, Sinatra 135), 20–50 = mid, <10 = obscure.
2. **Wikipedia Pageviews API (secondary, recency-aware).** Tested:
   `GET https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/Brian_May/daily/20250701/20250731`
   returns per-day view counts (Brian May: ~2.9k–5.1k views/day baseline, **8,183 on 2025-07-19 —
   his birthday**, plus a 13.7k spike on 2025-07-12) [^14^]. Uses:
   * rank candidates by trailing-90-day average views (more current than sitelinks);
   * detect the "birthday bump" (views spiking on the entity's own day) as a sanity signal.
   * Bulk alternative: precomputed per-hour/per-day pageview files at
     `https://dumps.wikimedia.org/other/pageviews/` [^15^] — mandatory if you need >~10k articles
     (API is rate-limited; 100 req/s burst policy, be polite).
3. **DBpedia inbound-link count** (`dbo:wikiPageWikiLink`) — a second graph-centrality signal, see §3.
4. **Feed API `selected` curation** — the on-this-day feed has an editor-curated `selected` list per
   day; treat membership as a human-notability vote [^16^].

Suggested composite: `notability_score = 0.5*log1p(sitelinks) + 0.3*log1p(avg_daily_views) + 0.2*log1p(inbound_links)`,
computed offline per entity and stored in the `entities` table (see schema). Log-scale because all
three are heavy-tailed.

---

## DBpedia option

Endpoint: `https://dbpedia.org/sparql` (OpenLink Virtuoso; accepts
`format=application/sparql-results+json`, optional `timeout` param, generous "anytime" partial
results) [^17^].

Date-structured data available (tested):

* **`dbo:birthDate` / `dbo:deathDate`** — typed `xsd:date` (e.g. `"1947-07-19"^^xsd:date`).
  `MONTH()`/`DAY()` filters work on them (verified).
* No large-scale event-date property comparable to Wikidata `P585`; no spouse/marriage qualifiers;
  no holiday day-of-year property. Events/holidays/weddings are effectively **not covered**.
* `dbo:wikiPageLength` **no longer exists** in the current release (verified: zero results; the
  property set on resources is now `wikiPageWikiLink`, `wikiPageExternalLink`, plus
  `dbp:wikiPageUsesTemplate`). For notability use inbound-link counts instead.
* `owl:sameAs` links to `wikidata.org` exist for most resources but are not guaranteed loaded for
  minor resources (OPTIONAL came back empty for obscure footballers in my test) — join via the
  Wikidata side (`?article schema:about ?item`) or via sitelink titles when in doubt.

Verbatim tested births query ranked by inbound links:

```sparql
PREFIX dbo: <http://dbpedia.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?person ?name ?birthDate (COUNT(?in) AS ?links) WHERE {
  ?person dbo:birthDate ?birthDate .
  ?person rdfs:label ?name . FILTER(lang(?name)='en')
  FILTER(MONTH(?birthDate)=7 && DAY(?birthDate)=19)
  OPTIONAL { ?in dbo:wikiPageWikiLink ?person }
}
GROUP BY ?person ?name ?birthDate
ORDER BY DESC(?links)
LIMIT 10
```

Actual results [^18^]: Brian May (1947, 1117 inbound links), George McGovern (1922, 1029),
Benedict Cumberbatch (1976, 848), Xavier Malisse (1980, 819), Edgar Degas (1834, 813),
Ilie Năstase (1946, 739), Nicola Sturgeon (1970, 625), Vladimir Mayakovsky (1893, 505) —
consistent with the Wikidata ranking (same top names, different order).

Deaths analogous (`dbo:deathDate`, verified: e.g. Osvaldinho d. 2012-07-19, Tommy Calandra
d. 1998-07-19) [^19^].

**Pros vs Wikidata:** dates are clean `xsd:date` (no precision/calendar-model edge cases); Virtuoso
is tolerant of heavier aggregations (the GROUP BY + COUNT + ORDER BY above completed); simpler flat
model — no statement nodes/qualifiers to learn; entity URIs are the Wikipedia article names
(`dbpedia.org/resource/Brian_May`), which makes URL construction trivial.

**Cons vs Wikidata:** English-Wikipedia-only coverage (no multilingual sitelinks; deaths/births only
for people with enwiki infoboxes); no events/holidays/weddings structure; no sitelinks metric;
infobox extraction lag (monthly-ish releases) vs Wikidata's near-real-time; ontology quirks
(multiple `birthDate` values from different infobox fields occur).

Verdict: fine as a **secondary/cross-check source for en births+deaths** and for inbound-link
notability; not sufficient as the primary store.

---

## Bulk/dump options (incl. vizgr, HistoryLabs)

### Wikimedia Feed API (the baseline to beat)

`GET https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/07/19` — tested live [^16^].
Returns `selected` (curated ~10), `events`, `births`, `deaths`, `holidays`, each with full page
objects (title, `wikibase_item`, thumbnail, extract). Excellent per-day quality, but: you get what
editors wrote on the day-page, no global ranking field, no weddings, and you must hit 366 endpoints
× languages. **Use it as one ingest source, not the whole DB.**

### Wikipedia day-page dumps as bulk source — recommended core for events/holidays

* enwiki `pages-articles` XML dump: `https://dumps.wikimedia.org/enwiki/` (multistream recommended:
  `enwiki-latest-pages-articles-multistream.xml.bz2`, ~25 GB) [^20^]. Extract the ~1,300 relevant
  pages locally instead of hitting the API: 366 day pages ("July 19"), year pages ("1947"), decade
  pages, plus `Portal:Current events` month subpages for recent daily granularity.
* Day-page structure is machine-regular (verified via parse API on "July 19", pageid 16091):
  sections **Events** (sub: Pre-1600 / 1601–1900 / 1901–present), **Births**, **Deaths**,
  **Holidays and observances** [^21^]. Each entry is a list item `* [[YYYY]] – text with [[links]]`.
  The first link is the year; subsequent links give you candidate entity titles → resolve to QIDs
  via the `page`/`pageprops` tables or the `wbsearchentities` API.
* Wikidata JSON dump for the entity side: `https://dumps.wikimedia.org/wikidatawiki/entities/`
  (`latest-all.json.gz`, ~100 GB) — one pass gives you P569/P570/P585/P26+PQ:P580/P837/P18 +
  sitelink counts for **everything**, letting you build the entire DB offline with zero rate limits
  [^22^]. (A "truthy" subset `latest-truthy` is smaller.)

### vizgr.org historical-events dataset — API alive, SPARQL dead, data frozen ~2013

* Web API **still responds** (tested):
  `https://www.vizgr.org/historical-events/search.php?begin_date=19000719&end_date=20000719&format=json&limit=5`
  → e.g. `{date: "1900/07/19", description: "The first line of the Paris Métro is opened."...}`
  [^23^]. Params: `begin_date/end_date YYYYMMDD`, `lang` (en/de/it/es/pt/ca/id/ro/tr), `query`,
  `format json|xml`, `granularity year|month`, `category`, `limit`. Note the JSON is an XML→JSON
  conversion with repeated `"event"` keys — parse as XML (`format=xml`) to be safe.
* Dataset size: **192,463 events** total; English: 37,859 year-granularity (300 BC–2012) + 38,150
  month-granularity (2000–2012) [^24^].
* N3 bulk dumps still linked from the project page (`wikieventRDF_en_year.n3`,
  `wikieventRDF_en_month.n3`, relative links under `/historical-events/`) [^24^].
* SPARQL endpoint `http://lod.gesis.org/historicalevents/sparql` (LODE ontology, events linked to
  DBpedia entities [^25^]) is **dead** — the host now redirects to a GESIS Skosmos vocabulary
  browser (verified) [^26^]. Linked Data frontend likewise gone.
* Verdict: usable as a **historical backfill** (pre-2013 events with DBpedia links, multilingual),
  but stale; don't rely on it for anything after 2012/2013.

### HistoryLabs/events-api (Go) — code actively maintained; hosted instance down in my tests

* GitHub: `https://github.com/HistoryLabs/events-api` — Go, MIT license, created 2022-07-12,
  **last push 2026-05-07** (repo metadata via GitHub API) [^27^]. Scrapes Wikipedia day pages
  (`/date?month=&date=`) and year pages (`/year/:year`, with `onlyDated` filter), returns
  `{year, yearInt, content}` JSON with the `sourceUrl` — a good reference implementation (or
  self-hostable micro-service) for the day-page parsing described above.
* Documented deployment `https://events.historylabs.io/` **did not respond** from this sandbox
  (connection closed) — treat hosted instance as unreliable; run it yourself (`go run ./cmd/server`,
  serves on :5000).

---

## Images via Commons

Pipeline (every step tested):

1. **Get the image filename** from Wikidata `P18` (light query — runs fine on official WDQS):
   `SELECT ?img WHERE { wd:Q15873 wdt:P18 ?img }` →
   `http://commons.wikimedia.org/wiki/Special:FilePath/TaylorHawkTributeWemb030922%20%28208%20copped%29.jpg`
   (Brian May) [^28^]. `Special:FilePath/<filename>` 302-redirects to the actual
   `upload.wikimedia.org` URL and supports `?width=300` for thumbnails — good enough if you don't
   need license metadata.
2. **License + thumbnail via Commons API** (tested):
   ```
   https://commons.wikimedia.org/w/api.php?action=query
     &titles=File:TaylorHawkTributeWemb030922 (208 copped).jpg
     &prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=300&format=json
   ```
   returned `thumburl` (300 px), `LicenseShortName: "CC BY 2.0"`, `UsageTerms`, `LicenseUrl`,
   `Artist: "Raph_PH" (Flickr)`, `AttributionRequired: "true"` [^29^].
3. **License handling rules:** store `license_short_name`, `artist`, `license_url`, and
   `attribution_required` per image. CC-BY / CC-BY-SA require displaying author + license link;
   public domain (`PD-old` etc.) needs none; watch out for `Non-free`/fair-use images (e.g. some
   event photos hosted on enwiki, not Commons — these come from the Feed API thumbnails with
   `upload.wikimedia.org/wikipedia/en/...` URLs; P18/Commons never returns them). For persons,
   prefer P18; for events, many items have no P18 — fall back to the Feed API page thumbnails or
   `pageimages` (`prop=pageimages` on the linked Wikipedia article).

---

## Recommended schema + taxonomy

One fact table keyed by (month, day) with a type discriminator, plus an entity dimension. SQL DDL
(Postgres-flavored):

```sql
CREATE TABLE entities (
  entity_id      TEXT PRIMARY KEY,        -- 'Q15873' (Wikidata QID; synthetic ids for non-WD rows)
  label          TEXT NOT NULL,
  description    TEXT,                    -- Wikidata description / first sentence
  entity_type    TEXT,                    -- person | event | holiday | couple | place | work | org
  sitelinks      INT,
  avg_daily_views INT,                    -- trailing-90d pageview average
  inbound_links  INT,                     -- DBpedia wikiPageWikiLink count (optional)
  notability_score REAL,                  -- composite, see §2
  image_url      TEXT,                    -- upload.wikimedia.org thumb URL (300px)
  image_license  TEXT,                    -- 'CC BY 2.0', 'Public domain', ...
  image_artist   TEXT,
  image_license_url TEXT,
  enwiki_title   TEXT
);

CREATE TABLE on_this_day (
  id             BIGSERIAL PRIMARY KEY,
  month          SMALLINT NOT NULL,       -- 1-12
  day            SMALLINT NOT NULL,       -- 1-31
  year           INT,                     -- event year; NULL for recurring holidays w/o fixed year
  year_precision TEXT,                    -- day | month | year (from wikibase:timePrecision)
  calendar       TEXT DEFAULT 'gregorian',-- gregorian | julian | other
  type           TEXT NOT NULL,           -- event | birth | death | holiday | wedding | anniversary
  category       TEXT,                    -- taxonomy below
  text           TEXT NOT NULL,           -- display sentence, e.g. "1834 – Edgar Degas, French painter, born"
  entity_id      TEXT REFERENCES entities,     -- primary entity (person/event/holiday)
  entity2_id     TEXT REFERENCES entities,     -- second entity for weddings (spouse)
  notability_score REAL,                  -- denormalized for sorting at read time
  image_url      TEXT,                    -- denormalized for fast reads
  source         TEXT NOT NULL,           -- wikidata | dbpedia | daypage | feedapi | vizgr | historylabs
  source_url     TEXT,                    -- provenance: entity URI, day page, or API URL
  last_seen_dump DATE,
  UNIQUE (month, day, year, type, entity_id, source)  -- dedupe guard
);
CREATE INDEX idx_otd_day  ON on_this_day (month, day, type, notability_score DESC);
CREATE INDEX idx_otd_year ON on_this_day (year);
```

Design notes: denormalizing `notability_score`/`image_url` into the fact row makes the hot read
path (`WHERE month=? AND day=? ORDER BY notability_score DESC LIMIT n`) a single index scan; the
`entities` table is still needed for detail pages and for recomputing scores. `source` + `source_url`
per row is essential for multi-source dedupe (same fact found by Wikidata *and* the day page:
prefer the day-page `text` for events — it is human-written prose — and the Wikidata row for
births/deaths/weddings where you generate `text` yourself as `"<year> – <label>, <description>, born"`).

**Category taxonomy** (value of `category`; map from Wikidata `P31`/`P279*` classes and day-page
link context):

| type | suggested categories (map from P31 ancestors) |
|---|---|
| event | battle_war (Q178561/Q180684), disaster (Q3839081), crime_trial (Q16738832/Q8016240), politics_election (Q40231/Q1077), science_space (Q336/Q5916), sports (Q349), arts_release (Q11424 film/Q482994 album/Q7889 game), aviation (Q…), disaster_transport, culture_society, other_event |
| birth / death | person field via `P106` occupation tree: arts (actor/musician/writer/artist), sports, politics (politician/head of state), science, military, religion, business, other_person |
| holiday | public_holiday, religious_observance, international_observance (UN days), national_day, awareness_day, movable_feast (compute per year), saint_feast_day |
| wedding / anniversary | wedding (P26+PQ:P580), coronation/accession (anniversary of reign start — optional stretch), founding_anniversary (org `P571` inception), launch_anniversary (product/work `P577` publication date) |

The "anniversary" type generalizes weddings: any entity with an inception/publication/launch date
(`P571`, `P577`, `P1619`…) whose month/day matches — e.g. "Company X founded on this day in 1905".

---

## Feasibility notes (what works, what doesn't)

**Works well (tested end-to-end):**
* Births/deaths by month-day from Wikidata, ranked by sitelinks — high-quality, multilingual,
  famous-first results (Mayakovsky/Degas/Brian May; Syngman Rhee/Rutger Hauer/Aung San).
* Events via `P585` — good coverage of battles, disasters, finals, incidents; **must** filter out
  calendar-day items and handle Julian dates for pre-1582.
* Weddings via `P26` statement + `pq:P580` — genuinely feasible: 414,149 dated marriages; with
  sitelink ranking + pairwise dedupe you get Sinatra–Farrow-class rows for most days. Not in the
  Feed API at all — a real differentiator.
* Holidays via `P837` — mechanically works (8 ms) and runs on stock WDQS, but only ~6,950 dated
  observances exist; fine as structured backbone, insufficient alone.
* Notability via sitelinks + pageviews (pageview birthday-bump verified empirically).
* Images via P18 → Special:FilePath → Commons extmetadata (license/attribution captured).
* Feed API as a curated baseline; day pages as the richest events/holidays source.

**Pain points / doesn't work (honest list):**
* The naive month/day births query **times out on public WDQS** (60 s cap, HTTP 502/connection
  killed in tests) — there is no month/day index in Blazegraph. Mitigations: (a) run heavy queries
  against QLever (`https://qlever.dev/api/wikidata`, sub-second, same data, ~24 h freshness);
  (b) better: precompute everything from the Wikidata JSON dump into your own DB and never query
  SPARQL at read time; (c) on WDQS keep only light lookups (P18, single-entity, P837-by-item).
* WDQS light queries and the QLever mirror occasionally drop connections under load — retry with
  backoff and cache aggressively.
* Julian-vs-Gregorian drift in `wdt:` truthy values (Golden Spurs 11 Jul → stored 19 Jul). Use
  statement nodes + `timeCalendarModel` if you care; most consumer apps can ignore it pre-1900.
* Year-precision dates surface as `-01-01` in truthy values → January 1 bias; filter by
  `timePrecision >= 11` (day) via statement nodes, or accept the noise for birthdays.
* vizgr SPARQL endpoint is dead; dataset frozen 2012/2013 — backfill only. HistoryLabs hosted API
  down; self-host the Go code.
* DBpedia: no events/holidays/weddings; `wikiPageLength` gone; en-only. Cross-check source only.
* Movable feasts (Easter-based, nth-weekday holidays like US Thanksgiving) have no fixed month/day
  in Wikidata — compute with a holiday library (e.g. `dateutil.easter`, python-holidays) and store
  per-year rows.
* Wikinews "July 19, 2010" day items pollute P585 results (see §1c filter).
* Multi-source dedupe is the hardest engineering problem: the same battle appears in Wikidata,
  the day page, vizgr, and the Feed API with different text. Key on `(month, day, year, QID)`;
  keep all `source` rows but elect one display row.

---

## References

[^1^]: Wikidata Query Service endpoint — https://query.wikidata.org/sparql (light queries verified live:
       sitelinks of Q42 = 132; P837-by-item holidays; P18 lookup).
[^2^]: QLever public Wikidata endpoint — https://qlever.dev/api/wikidata (UI: https://qlever.dev/wikidata).
       All heavy queries executed here; query-time-ms reported inline per query.
[^3^]: Scholia issue "Set up a QLever-based SPARQL endpoint for Wikidata on Wikimedia premises" —
       https://github.com/WDscholia/scholia/issues/2757
[^4^]: WDQS 60 s timeout & fair-use limits — https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual ;
       Pham et al., "Embracing Timeouts on Public SPARQL Endpoints" (CEUR Vol-4085, 2025) —
       https://ceur-ws.org/Vol-4085/paper70.pdf
[^5^]: Executed: https://qlever.dev/api/wikidata (births query, query-time-ms 1333) — top rows
       Q132964 Mayakovsky 1893-07-19 (124), Q46373 Degas 1834-07-19 (113), Q15873 Brian May
       1947-07-19 (90), Q244674 Cumberbatch 1976-07-19 (89), Q60030 Marcuse 1898-07-19 (87).
[^6^]: Executed: deaths query (query-time-ms 982) — Q171684 Syngman Rhee d.1965-07-19 (88),
       Q315087 Garry Marshall d.2016 (74), Q213574 Rutger Hauer d.2019 (69), Q103556 Henry II HRE
       d.1024 (65), Q318458 Nguyễn Phú Trọng d.2024 (64), Q194161 Aung San d.1947 (63).
[^7^]: Executed: events query (query-time-ms 1012) — Q504172 Battle of Guadalete 0711-07-19 (43),
       Q44732 Battle of the Golden Spurs 1302-07-19 (40), Q127603401 2024 CrowdStrike incident
       2024-07-19 (37), Q580343 United Airlines Flight 232 1989-07-19 (26); noise rows
       "July 19, 2010" (Q12966099) etc. observed.
[^8^]: Executed: weddings query (query-time-ms 960) — Q8753 Enrico Fermi & Q6498895 Laura Fermi
       1928-07-19 (169), Q40912 Frank Sinatra & Q202725 Mia Farrow 1966-07-19 (135),
       Q5084390 Charli XCX & Q18043937 George Daniel 2025-07-19 (68), Q229364 Naya Rivera &
       Q97283925 Ryan Dorsey 2014-07-19 (53).
[^9^]: Executed: count of P26 statements with pq:P580 = 414,149 (query-time-ms 54).
[^10^]: Property P837 "day in year for periodic event" — https://www.wikidata.org/wiki/Property:P837 ;
        date item "July 19" = Q2726, instance of Q14795564 "day of the year" (verified by label query).
[^11^]: Executed: holidays for Q2726 (query-time-ms 8) — Q4999425 Burmese Martyrs' Day (8),
        Q10412386 Feast day of Saint Anne (2), Q111774855 Sandinista Revolution Day (0).
[^12^]: Executed on official WDQS: `SELECT ?holiday ?holidayLabel WHERE { ?holiday wdt:P837 wd:Q2726 .
        SERVICE wikibase:label {...} }` — same 3 labeled results + unlabeled Q4425959.
[^13^]: Executed: count of all P837 statements = 6,950 (query-time-ms 4).
[^14^]: Pageviews API, tested — https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/Brian_May/daily/20250701/20250731
        (8,183 views on 20250719 vs ~2.9k–5.1k typical). Docs: https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews
[^15^]: Pageview bulk dumps — https://dumps.wikimedia.org/other/pageviews/
[^16^]: Wikimedia Feed API on-this-day, tested — https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/07/19 ;
        docs: https://api.wikimedia.org/wiki/Feed_API
[^17^]: DBpedia SPARQL endpoint — https://dbpedia.org/sparql (Virtuoso; birthDate datatype verified
        xsd:date; wikiPage* property inventory checked on dbr:Brian_May).
[^18^]: Executed: DBpedia births-ranked-by-inbound-links query — Brian May 1947-07-19 (1117 links),
        George McGovern 1922-07-19 (1029), Benedict Cumberbatch 1976-07-19 (848),
        Edgar Degas 1834-07-19 (813), Vladimir Mayakovsky 1893-07-19 (505).
[^19^]: Executed: DBpedia deaths query — e.g. dbr:Osvaldinho_(footballer,_born_1937) 2012-07-19,
        dbr:Tommy_Calandra 1998-07-19, dbr:Ibsen_Nelsen 2001-07-19 (all xsd:date).
[^20^]: enwiki dumps index — https://dumps.wikimedia.org/enwiki/
[^21^]: Executed: https://en.wikipedia.org/w/api.php?action=parse&page=July_19&prop=sections&format=json
        — sections Events (Pre-1600/1601–1900/1901–present), Births, Deaths, Holidays and observances.
[^22^]: Wikidata entity dumps — https://dumps.wikimedia.org/wikidatawiki/entities/
[^23^]: Executed: https://www.vizgr.org/historical-events/search.php?begin_date=19000719&end_date=20000719&format=json&limit=5
        (first row: 1900/07/19 Paris Métro first line opens).
[^24^]: vizgr project page (dataset stats: 192,463 events; en/year 37,859 to 2012; en/month 38,150;
        N3 download links) — https://www.vizgr.org/historical-events/
[^25^]: Hienert & Luciano, "Extraction of Historical Events from Wikipedia" — SPARQL endpoint
        http://lod.gesis.org/historicalevents/sparql, LODE ontology, DBpedia-linked events —
        https://link.springer.com/chapter/10.1007/978-3-662-46641-4_2
[^26^]: Verified: http://lod.gesis.org/historicalevents/sparql now redirects to
        https://data.gesis.org/cvbrowser/en/historicalevents/ (Skosmos vocabulary browser) — endpoint defunct.
[^27^]: GitHub API repo metadata — https://api.github.com/repos/HistoryLabs/events-api
        (created 2022-07-12, pushed_at 2026-05-07, Go, MIT, homepage https://events.historylabs.io);
        repo README endpoints /date and /year/:year — https://github.com/HistoryLabs/events-api
[^28^]: Executed on official WDQS: `SELECT ?img WHERE { wd:Q15873 wdt:P18 ?img }` →
        commons Special:FilePath/TaylorHawkTributeWemb030922 (208 copped).jpg
[^29^]: Executed: Commons API — https://commons.wikimedia.org/w/api.php?action=query&titles=File:TaylorHawkTributeWemb030922%20(208%20copped).jpg&prop=imageinfo&iiprop=extmetadata%7Curl&iiurlwidth=300&format=json
        → thumburl 300px, LicenseShortName "CC BY 2.0", Artist Raph_PH, LicenseUrl creativecommons.org/licenses/by/2.0.
