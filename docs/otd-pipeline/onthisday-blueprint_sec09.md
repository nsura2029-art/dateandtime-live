## 9. Build Roadmap and Agent Implementation Prompts

Everything the preceding chapters establish — a zero-cost data stack, a template-driven SEO engine, a verification-first premium layer — compresses into a 90-day build one founder can execute with coding agents. The value is in the sequencing: data first, because every surface reads from the same fact table; distribution before premium, because links need most of a quarter to compound; and the $4.99 birthday report before subscriptions, because it monetizes existing gift-intent traffic with nothing beyond the RAG core and a checkout link [^D8-31^][^D8-7^]. Section 9.1 phases the work; 9.2 supplies the five agent prompts; 9.3 sets the KPI targets.

### 9.1 The 90-day phased plan

Three constraints fix the phase order. First, the database is the dependency root: pages, widgets, API, and AI answers are all read paths over one fact table, so ingestion and schema ship before anything customer-facing. Second, indexation lead time: pages must be indexed four to six weeks before their annual pulse — Wikipedia's "January 1" article climbs from a ~1,300-view daily baseline to 30,520 on the day, and "July 4" spikes 40–50× [^D7-15^][^D7-16^] — so all 366 date pages ship complete in Phase 1, not incrementally. Third, revenue order follows Chapter 8's ranking: the birthday report is the only feature that converts gift-intent traffic on first contact, so it precedes subscription chat [^D8-20^].

**Table 9.1 — 90-day phased build plan**

| Phase | Weeks | Deliverables | Depends on |
|---|---|---|---|
| 1 — Data foundation | 1–3 | D1 schema; ingestion crawler (Wikimedia feed EN, two mirrors, Nager holidays); notability scoring; 366 date pages + `/today/` hub live; per-template sitemaps submitted | Nothing — run Prompts A + B from day 1 |
| 2 — Template expansion | 4–6 | `/born/` + `/died/` families (732 URLs); category×date pages (music first); holiday engine with computed movable feasts and US observances via daily Checkiday pull [^D6-29^]; 150 year pages | Phase 1 database — Prompt C |
| 3 — Distribution + first revenue | 7–10 | Embeddable widget listed on the marketplace; $4.99 birthday-report MVP (pre-generated narratives + printable PDF); "tomorrow in history" email digest | Phases 1–2; RAG core — Prompts D + E |
| 4 — Premium surface | 11–13 | Cited AI chat ($6/mo or $49/yr; 3 free/day); developer API tier ($9–$99/mo); ES/PT locale clone — the feed already serves 14 languages [^D4-8^] | All prior phases |

The critical path runs Phase 1 → 3, and Phase 1 is the risk concentrator: if the crawler slips, everything slips — so the crawl is deliberately small (366 requests per language, under an hour on the free rate limit [^D4-12^]) and specified as the first prompt. The widget's Phase 3 slot is equally deliberate: embeds are the link-velocity engine, no incumbent offers them [^D1-18^], and referring domains need most of a quarter to move rankings — a week-7 launch lets equity compound before Phase 4 needs authority. Non-English sits last not because it is weak — calendarr.com draws a third of its 3.7M monthly visits from Brazil [^D7-9^] — but because a locale clone re-deploys finished templates over a second feed language, cheap precisely because it waits.

### 9.2 Copy-paste agent prompts

Five prompts execute the entire v1. Each is self-contained — naming endpoints, schema fields, URL patterns, and acceptance criteria — so it pastes into a coding agent (Kimi Code, Codex) with no surrounding context, matching the founder's prompt-driven workflow. Run A and B in parallel in week 1, C in week 4, D and E in week 7. The stack is constant: Next.js App Router on Cloudflare, D1 (SQLite) as the system of record, KV/R2 for caches and raw snapshots, GitHub Actions for scheduled jobs. Two rules recur because the research marks them non-negotiable: a contact-bearing User-Agent on every Wikimedia request — WMF machine-enforces UA policy with 429 throttling [^D4-13^] — and per-row source provenance, which keeps CC BY-SA attribution and multi-source dedupe tractable [^D4-15^].

**Prompt A — ingestion crawler (Phase 1, weeks 1–2)**

```markdown
# Task: Build the on-this-day ingestion crawler

## Stack
TypeScript script in the repo's /ingest folder, run by a GitHub Actions scheduled workflow;
raw JSON snapshots saved to Cloudflare R2 bucket "otd-raw"; normalized rows written to
Cloudflare D1 via `wrangler d1 execute --file=batch.sql`. Bun or Node 20+.

## Sources (all free, no API key)
1. PRIMARY — Wikimedia Feed API:
   GET https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/{MM}/{DD}
   MM/DD zero-padded. One call returns selected + events + births + deaths + holidays.
   Header on EVERY request: User-Agent: <appname>/1.0 (<site-url>; <contact-email>) —
   WMF throttles generic agents with 429. Serial crawl, max 5 req/s, exponential backoff
   honoring Retry-After. Anonymous budget is 500 req/h; 366 requests cover one language.
2. CROSS-CHECK MIRRORS (no zero-padding, no auth):
   https://byabbe.se/on-this-day/{M}/{D}/events.json (also births.json, deaths.json)
   https://history.muffinlabs.com/date/{M}/{D}
   Store alongside primary rows; a row present in all three sources is "verified",
   a row in only one is a review candidate.
3. RECENCY BACKFILL — the feed's events list silently excludes the last ~2 years.
   Parse the English day article's "Events" section:
   GET https://en.wikipedia.org/w/api.php?action=parse&page={Month_Day}&prop=wikitext&format=json
4. HOLIDAYS — GET https://date.nager.at/api/v3/publicholidays/{YYYY}/{CC}
   for CC in US, GB, CA, AU, for the current and next year. Store with type=holiday,
   category=public_holiday, year set per occurrence.

## Normalization rules
- Years may be zero or negative (BCE) — store as SIGNED integer; never unsigned.
- Feed holiday rows carry no year → year = NULL (recurring).
- Skip any thumbnail URL containing "/wikipedia/en/" (fair-use, not redistributable).
- Every row stores source + source_url (provenance is mandatory, not optional).
- Dedupe key: (month, day, year, type, entity_id, source). Re-runs must be idempotent.

## Acceptance criteria
- All 366 dates ingested for EN; July 19 yields >= 400 rows; January 1 >= 1,000.
- Zero rows with NULL source or source_url; unique dedupe constraint holds on re-run.
- Workflows: weekly full re-crawl; daily refresh of today + tomorrow only.
```

**Prompt B — D1 schema and read API (Phase 1, weeks 2–3)**

```markdown
# Task: Create the D1 schema and public read API

## Stack
Cloudflare D1 (SQLite) via wrangler migrations; API routes as Cloudflare Workers
(Hono or itty-router) colocated with the Next.js app; edge cache via Cache API.

## Tables (SQLite DDL — implement exactly)
entities(
  entity_id TEXT PRIMARY KEY,        -- Wikidata QID; synthetic id for non-WD rows
  label TEXT NOT NULL, description TEXT,
  entity_type TEXT,                  -- person | event | holiday | couple | place | work | org
  sitelinks INT, avg_daily_views INT, inbound_links INT,
  notability_score REAL,
  image_url TEXT, image_license TEXT, image_artist TEXT, image_license_url TEXT,
  enwiki_title TEXT
)
on_this_day(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month SMALLINT NOT NULL, day SMALLINT NOT NULL,
  year INT,                          -- NULL for recurring holidays
  year_precision TEXT,               -- day | month | year
  calendar TEXT DEFAULT 'gregorian',
  type TEXT NOT NULL,                -- event | birth | death | holiday | wedding | anniversary
  category TEXT, text TEXT NOT NULL,
  entity_id TEXT REFERENCES entities(entity_id),
  entity2_id TEXT REFERENCES entities(entity_id),  -- second spouse, weddings only
  notability_score REAL, image_url TEXT,
  source TEXT NOT NULL, source_url TEXT,           -- feedapi | daypage | mirror | nager
  last_seen_dump DATE,
  UNIQUE (month, day, year, type, entity_id, source)
)
CREATE INDEX idx_otd_day ON on_this_day (month, day, type, notability_score DESC);

## Scoring (offline at ingest, never at read time)
notability_score = 0.5*log1p(sitelinks) + 0.3*log1p(avg_daily_views)
                 + 0.2*log1p(inbound_links)

## API routes (JSON; Cache-Control: public, max-age=3600; today routes max-age=300)
GET /api/v1/on-this-day/{MM}-{DD}
  -> { date, events[], births[], deaths[], holidays[], weddings[] },
     each row { year, text, category, entity_id, notability_score, image_url, source_url },
     arrays sorted by notability_score DESC.
GET /api/v1/born/{MM}-{DD} and /api/v1/died/{MM}-{DD} -> persons only.
GET /api/v1/today -> server date (UTC) -> same payload + day_of_year + week_number.
Every response body includes attribution:
  "Text from Wikipedia contributors via the Wikimedia Feed API, licensed CC BY-SA 4.0."

## Acceptance criteria
- /api/v1/on-this-day/07-19 returns all five types, sorted, p95 < 100 ms warm.
- Wedding rows return both spouse labels (entity_id + entity2_id joined).
- openapi.yaml generated; stub middleware for API keys + per-key quotas (Phase 4).
```

**Prompt C — programmatic page templates (Phase 2, weeks 4–6)**

```markdown
# Task: Build the programmatic SEO page templates

## Stack
Next.js App Router deployed on Cloudflare; static generation with on-demand
revalidation; data fetched from the /api/v1 routes built in Prompt B.

## Routes (every page fully populated at build time — no thin placeholders)
/today/                                  auto-updating hub + day/week number
/on-this-day/{month}-{day}/              366 pages, e.g. /on-this-day/july-19/
/born/{month}-{day}/                     366 pages
/died/{month}-{day}/                     366 pages
/on-this-day/{category}/{month}-{day}/   categories: battles, disasters, politics,
                                         science-space, sports, arts, music (music first)
/year/{year}/                            1875-2025 (150 pages)
/national-{slug}-day/                    observance pages: date rule, origin, hashtags

## SEO requirements
- Evergreen URLs; refresh years in-page, never put year tokens in slugs.
- Title pattern: "On This Day in History — {Month} {D}: Events, Birthdays & Deaths";
  meta description auto-composed from the day's top 3 rows by notability.
- JSON-LD: ItemList of the day's entries + BreadcrumbList on every template.
- Internal linking on every page: previous/next day, "this week", category siblings,
  and cross-links between /on-this-day, /born, /died for the same date.
- One XML sitemap per template family (dates, born, died, categories, years,
  observances), all declared in robots.txt.
- Footer on every page: "Text from Wikipedia contributors via the Wikimedia Feed API,
  licensed CC BY-SA 4.0." with the license hyperlinked; image credits where shown.

## Acceptance criteria
- >= 1,830 URLs (366 x 5 core families) build and return HTTP 200.
- Any page with < 150 words of unique content is excluded from its sitemap.
- Sampled date pages (5) score Lighthouse SEO >= 95 and render >= 6 internal links.
```

**Prompt D — embeddable widget (Phase 3, weeks 7–8)**

```markdown
# Task: Build the embeddable "On This Day" widget

## Stack
Cloudflare Worker serving a self-contained JS snippet plus an iframe variant;
data from /api/v1/today; listing metadata prepared for the founder's widget marketplace.

## Behavior
- Publisher pastes two lines:
  <div id="otd-widget" data-theme="light" data-types="events,births"></div>
  <script src="https://<domain>/widget/v1.js" async></script>
- The script calls GET /api/v1/widget/today?types=...&theme=... and renders a card:
  top 5 rows by notability + "On This Day — powered by <Site>" attribution line.
- Card renders inside Shadow DOM (no CSS leakage); script < 8 KB gzipped;
  fixed min-height to prevent layout shift.
- FREE TIER: the attribution backlink to /on-this-day/{month}-{day}/ is mandatory
  (rel="follow"). WHITE-LABEL TIER ($19/mo): valid API key removes branding and
  raises quota; missing/invalid key silently falls back to free-tier behavior.
- Serving cost must be ~zero: responses come from a canonical daily digest
  pre-generated once per UTC day for all 366 dates, cached at the edge 24 h.

## Analytics (this is the link-velocity KPI feed)
- Log referrer domain per widget load; /admin/embeds lists live embed domains,
  first-seen date, and daily loads.

## Acceptance criteria
- A bare HTML page with the two-line snippet renders the card with no console errors.
- Free tier always emits the followed backlink; white-label requires a valid key.
- Digest pre-generation runs as a daily cron; widget p95 < 150 ms worldwide.
```

**Prompt E — cited AI answer pipeline (Phase 3–4, weeks 7–11)**

```markdown
# Task: Build the retrieval-grounded AI answer pipeline (RAG)

## Stack
Cloudflare Worker + D1 (structured retrieval) + KV (answer cache) +
Gemini 2.5 Flash-Lite via REST ($0.10 / 1M input, $0.40 / 1M output tokens;
hard budget $0.001 per generated answer — abort and log above that).

## Pipeline (six stages; the model never states a date it did not retrieve)
1. DETERMINISTIC PARSE — regex + a dateparser + entity linker resolve the query
   ("July 19", "in 1985", "Apollo") to (month, day, year, entity?) BEFORE any
   model call. The LLM never parses dates.
2. SQL RETRIEVAL — query on_this_day JOIN entities by the parsed keys;
   FTS5 fallback for fuzzy entity names; cap ~30 rows.
3. ANSWER CACHE — KV key = normalized intent + parameters; canonical date
   questions are served pre-built answers (target hit rate >= 90%).
4. GROUNDED GENERATION — prompt: "Answer using ONLY the records below. Cite
   every factual claim with its record ID in [brackets]. If the records are
   insufficient, reply exactly: 'I can only answer from our verified database.'"
5. POST-VERIFICATION — strip any sentence whose (entity, date) pair is absent
   from the retrieved set; if nothing survives, return the refusal string.
6. SERVE + QA LOG — persist question, record IDs cited, sentences stripped,
   and the "Was this accurate?" feedback flag.

## Pre-generation job (batch, weekly refresh)
Generate the canonical "What happened on {Month} {D}?" artifact for all 366 dates
(~1,100 generations including variants) into KV; expected one-time cost < $2.

## Monetization hooks
- Free tier: 3 answers/day per browser fingerprint; the 4th request returns the
  paywall payload (Plus $6/mo or $49/yr + $4.99 birthday-report upsell).
- /api/v1/ask is a separate keyed route for the future paid API tier.

## Acceptance criteria
- 100-question golden set built from DB rows: 100% of served claims carry a valid
  record ID; every out-of-corpus question returns the refusal string.
- Cache hit rate >= 90% on canonical queries; measured average cost <= $0.0005/answer.
```

The prompts double as the maintenance runbook: A's weekly cron and E's golden-set QA are the standing jobs that keep the product correct, and a failed acceptance check is fixed by re-running the block with the failing criterion pasted back. The cadence is light — Monday, crawl QA deltas (any date's row count moving >10% week-over-week); Wednesday, Search Console coverage by sitemap family; Friday, one template improvement. Hours per week, not headcount — that is the point of building by agent prompt.

### 9.3 KPI targets

The KPI stack mirrors the build order: indexation before impressions, distribution before revenue. Targets are planning figures set against cited benchmarks; search and conversion numbers are third-party directional estimates. Three instrumentations ship inside the prompts to keep them readable: Search Console segmented by sitemap family, embed-referrer logging, and the AI answer QA log.

**Table 9.2 — KPI targets, day 30 and day 90**

| Metric | 30-day target | 90-day target | Source / benchmark |
|---|---|---|---|
| Indexed programmatic URLs | ≥1,830 submitted (366×5 families); ≥60% indexed | ≥5,000 submitted (adds category, year, observance pages); ≥70% indexed | Ch. 7 template map; index before date pulses [^D7-15^] |
| Long-tail rankings | GSC baseline accruing | Page 1 for ≥50 queries in the 1–15K volume class | howlongagogo.com ranks #1 for thousands at DR 56 [^D7-10^] |
| Widget embeds (link velocity) | Marketplace listing live; first 10 embeds | ≥50 live embeds with attribution backlinks | Calendarific's attribution-for-distribution mechanic [^D8-28^]; incumbents offer no embeds [^D1-18^] |
| Free→paid conversion | Report checkout live; first sales | ≥1% of engaged free users paying (1–3% planning band) | Perplexity converts an estimated ~1–2% of MAU — third-party estimate [^D8-33^][^D8-34^] |
| Revenue | First paid reports (weeks 8–10) | ≥100 report sales ≈ $500 gross at ~91% margin; ads at $4–12 RPM baseline | Gift posters sell ~$20 digitally [^D8-31^]; education EPMV $3.79–5.41 (Ezoic), $24–32 RPM (Mediavine/Raptive) [^D2-33^][^D2-32^] |

Read the table as a chain of leading indicators, each de-risking the next. Indexation gates everything — a date page unindexed before its pulse earns nothing for a year — so coverage is tracked per sitemap family, not in aggregate, to isolate which template stalls. Rankings lag links, hence embeds carry a 30-day target though their payoff arrives with Phase 4's head-term contention. Conversion is deliberately conservative: the ~1–2% anchor comes from a general-AI subscription [^D8-33^][^D8-34^]; a $4.99 gift artifact should beat it on gift-intent traffic — which is why the report, not the subscription, carries the revenue target. The RPM row is a lever, not a forecast: within the $4–12 band every 1M monthly pageviews is worth $8K–$12K (Chapter 3), and the premium-network upgrade is near-pure margin whenever traffic qualifies [^D2-32^].

These targets hold only while the known failure modes stay managed — licensing and attribution compliance, AI-Overview CTR erosion already measured at 28%→19% [^D7-22^], and the uncertainty bands on third-party traffic estimates among them. Chapter 10 registers each risk alongside its mitigation.

#### Chapter References

*Citation convention: `[^D1-N^]` … `[^D8-N^]` cite research Dimension reports 01–08, preserving each file's original index N; the report chapter where each marker was previously used is noted in parentheses.*

- [^D1-18^]: OnThisDay.com robots.txt — AI-bot blocklist, no syndication (source: Dim 01, via Chapter 10) — https://www.onthisday.com/robots.txt
- [^D2-32^]: EliteWealthPlan — "Mediavine vs AdThrive vs Ezoic" (avg RPM: Ezoic $11.93, Mediavine $24.35, Raptive $32.47) (source: Chapter 3) — https://elitewealthplan.com/mediavine-vs-adthrive-vs-ezoic/
- [^D2-33^]: Skipblast — Ezoic earnings, education-site EPMV $3.79–5.41 vs $23–54 RPM on Mediavine / $20+ on Raptive (source: Chapter 3) — https://www.skipblast.com/ezoic-earnings-november-2024-niche-site-income-report/
- [^D4-8^]: Wikimedia feed availability matrix — 14 on_this_day languages (source: Chapter 5) — https://en.wikipedia.org/api/rest_v1/feed/availability
- [^D4-12^]: Wikimedia rate limits — 500 req/h anonymous, 5,000 req/h with free personal token (source: Chapter 5) — https://stackoverflow.com/questions/13608589/limits-of-the-wikipedia-api
- [^D4-13^]: WMF User-Agent policy and 429 enforcement (source: Chapter 5) — https://meta.wikimedia.org/wiki/User-Agent_policy
- [^D4-15^]: Wikipedia:Reusing Wikipedia content + WMF Terms of Use — CC BY-SA attribution requirements (source: Chapter 5) — https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content
- [^D6-29^]: Checkiday National Holiday API on APILayer — 5,000+ US observances; free 100 req/mo (source: Chapter 5) — https://marketplace.apilayer.com/checkiday-api
- [^D7-9^]: Ahrefs public data — calendarr.com (Brazil ~34% of 3.7M monthly visits) (source: Chapter 7) — https://ahrefs.com/top/calendarr.com
- [^D7-10^]: Ahrefs public data — howlongagogo.com (DR 56; #1 for thousands of days-since/until queries, 1–15K each) (source: Chapter 7) — https://ahrefs.com/top/howlongagogo.com
- [^D7-15^]: Wikimedia Pageviews API — en.wikipedia "January_1" daily (baseline ~1,062–3,303; Jan 1: 30,520) (source: Chapter 7) — https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/January_1/daily/2023122000/2024011000
- [^D7-16^]: Wikimedia Pageviews API — en.wikipedia "July_4" daily (baseline ~515–1,244; Jul 4: 30,005) (source: Chapter 7) — https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/July_4/daily/2024062500/2024071000
- [^D7-22^]: WebProNews — "Google AI Overviews Crush CTRs" (top organic CTR 28%→19%) (source: Chapter 7) — https://www.webpronews.com/google-ai-overviews-crush-ctrs-seos-2025-reckoning/
- [^D8-7^]: MyHeritage Deep Nostalgia used 82M times in 3 months (source: Chapter 8) — https://ai-techpark.com/deep-learning-driven-myheritage-releases-photo-repair/
- [^D8-20^]: Gemini 2.5 Flash-Lite pricing — $0.10/1M input, $0.40/1M output, cached $0.01/1M (source: Chapter 8) — https://devtk.ai/en/models/gemini-2-5-flash-lite/
- [^D8-28^]: Calendarific vs alternatives — free 500 req/mo with attribution; $12/mo entry; $400/yr business; $4,000/yr enterprise (source: Chapter 8) — https://worlddataapi.com/compare/calendarific
- [^D8-31^]: Personalised "year you were born" birthday newspaper poster — ~$20 digital download (source: Chapter 8) — https://www.milestonesstudio.com.au/products/year-in-review-birthday-newspaper
- [^D8-33^]: Perplexity scale — ~45–100M MAU, ARR ~$148–200M; basis of ~1–2% paid-conversion estimate (source: Dim 08 research file) — https://www.demandsage.com/perplexity-ai-statistics/
- [^D8-34^]: Perplexity estimated ~1M paid users; Pro $17–20/mo (source: Chapter 8) — https://resourcera.com/data/artificial-intelligence/perplexity-ai-statistics/
