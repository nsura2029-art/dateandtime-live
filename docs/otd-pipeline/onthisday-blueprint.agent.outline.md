# OnThisDay.com Teardown & Build-Your-Own Blueprint: Features, Data Sources, SEO, and the AI-Premium Opportunity

## 1. Executive Summary (~700 words)
### 1.1 What onthisday.com is and why it wins
#### 1.1.1 200k+ curated entries across events/birthdays/weddings/deaths; ~1M visitors, 3M pageviews/mo; 100% ad-funded, est. $150K–$575K/yr
#### 1.1.2 Its moat is 25 years of editorial curation — but the raw data is free (Wikipedia/Wikidata), and the site has left API, widgets, faceted filters, and AI answers unclaimed
### 1.2 The build blueprint in one page
#### 1.2.1 Data stack: Wikimedia Feed API primary + day-page parsing + Wikidata SPARQL + holiday APIs — full corpus in days
#### 1.2.2 Growth: programmatic SEO around date-history queries (zero-click-safe segments), widgets as backlink engine
#### 1.2.3 Monetization: ads (baseline) + verified AI answers subscription + $4.99 birthday/anniversary report artifacts + API/widget tiers

## 2. OnThisDay.com Site Anatomy — Features and Filters (~1,400 words, 3 tables)
### 2.1 Homepage and content modules
#### 2.1.1 Module inventory: Today in History photo highlights, Events in 2025, Today in Sport, Weekly Quiz, Did You Know, Famous Birthdays (live ages), Weddings & Divorces (both partners' ages), Famous Deaths, Featured Article, newsletter
### 2.2 Feature-by-feature filter matrix
#### 2.2.1 Events: date pages /events/{month}/{day}, year pages /events/date/{year}, category hubs /film-tv/ /music/ /sport/ with 2-level topic taxonomies (22 film awards, 11 music awards, 30+ sports)
#### 2.2.2 Birthdays / Deaths / Weddings: /birthdays|deaths|weddings/{month}/{day}; people engine /famous-people.php filters by age, generation, nationality, 100+ professions, star sign, Chinese zodiac, cause of death, Top 100, A–Z
#### 2.2.3 Search: keyword + day + month + type bar on every page, channel-scoped variants; results via POST/JS
### 2.3 URL architecture and programmatic-SEO grammar
#### 2.3.1 Full URL grammar table: /day/{m}/{d}, /events|birthdays|deaths|weddings/{m}/{d}, /date/{y}, /date/{y}/{m}/{d}, /today/*.php, channel + topic paths — the template map a challenger should clone and extend
### 2.4 Entry content model and editorial layering
#### 2.4.1 Base entry = date + 1–2 sentence text + person links + channel/topic tags; highlighted entries add editorial h3 title, image, citation footnotes; person records carry birthplace, nationality, professions, computed age/zodiac/generation
### 2.5 What is missing (the open flanks)
#### 2.5.1 No public API, no widgets, no accounts/personalization, no date calculators; History channel lacks topic taxonomy (no WWII/Space/Disasters pages); robots.txt blocks AI bots

## 3. Business Model and Traffic Economics (~1,000 words, 2 tables, 1 chart)
### 3.1 Traffic and audience
#### 3.1.1 Self-reported 1M+ visitors / 3M+ pageviews per month; geo split 53% US / 15% UK / 5% CA / 3% AU; third-party estimates 0.3M–1.8M/mo (Semrush ~1.8M, Jun 2026) — directional only
### 3.2 Monetization mechanics
#### 3.2.1 ~100% programmatic display (Google Ad Manager + SHE Media, 1,727-partner CMP): 728x90 & 300x250, channel buys, co-brand takeovers, geo/hour targeting, frequency caps; newsletter sponsorship; NO premium, NO API, NO affiliate
### 3.3 Revenue model and niche RPM benchmarks
#### 3.3.1 Est. $150K–$575K/yr (base $300–350K) at $4–12 page RPM; education = highest-CPM vertical per Playwire; chart: revenue sensitivity pageviews × RPM
### 3.4 Ownership and history
#### 3.4.1 On This Day Pte. Ltd. (Singapore), founder/Managing Editor James Graham; HistoryOrb.com (2000) → OnThisDay.com (2015); featured Google AdSense publisher
### 3.5 Comparables' monetization
#### 3.5.1 timeanddate: 4 paid APIs incl. on-this-day data ($49–$999/yr) + freemium apps; Famous Birthdays: programmatic + Pro data product; History.com: HISTORY Vault SVOD $5.99/mo; data vendors Calendarific $12/mo, API-Ninjas $39–199/mo

## 4. Competitor Landscape and Gap Analysis (~1,100 words, 2 tables)
### 4.1 The field
#### 4.1.1 Britannica /on-this-day (editorial authority), History.com (video + Vault), BBC On This Day (news archive, 8 themes ~60 subcategories), timeanddate (holidays-by-country + data APIs), Famous Birthdays (14M/mo engagement machine), On-This-Day.com (music/TV verticals), LOC Today in History (primary sources), 5 mobile apps (Histoday: freemium $15/yr + AI chat)
### 4.2 Master feature matrix
#### 4.2.1 34-row ✅/🟡/❌ matrix across 10 competitors: content types, filters, unique features, data model, monetization
### 4.3 Best-in-class per capability
#### 4.3.1 Taxonomy: BBC; engagement: Famous Birthdays; sourcing: LOC; holidays: timeanddate; mobile/AI: Histoday
### 4.4 The 12 gaps nobody covers
#### 4.4.1 Faceted date×category×country×profession filtering; weddings (only onthisday.com); anniversary-milestone math; holiday-origin stories; non-Western coverage; public API/widgets; web personalization; verified AI answers

## 5. Free Data Sources and API Stack (~1,300 words, 2 tables)
### 5.1 Primary: Wikimedia Feed API onthisday
#### 5.1.1 Endpoints /feed/v1/wikipedia/{lang}/onthisday/{all|selected|events|births|deaths|holidays}/{MM}/{DD}; 14 languages; no-auth mirror at en.wikipedia.org/api/rest_v1; measured ~438 items/day EN (Jul 19: 20 selected + 60 events + 228 births + 119 deaths + 11 holidays); schema {text, year, pages[title, wikibase_item, thumbnail, extract, content_urls]}; gotchas: events exclude last ~2 years, holidays lack year, 500 req/h anon
### 5.2 Mirrors and fallbacks (live-tested)
#### 5.2.1 byabbe.se (events/births/deaths JSON, CC BY-SA, no key), Muffin Labs (same), dayinhistory.dev (freemium $5/mo), API-Ninjas (paid), HistoryLabs events-api (self-host, Go/MIT); dead: numbersapi.com
### 5.3 Holidays and observances
#### 5.3.1 Nager.Date (public holidays, ~197 countries, free), OpenHolidays (36 countries, no US), vacanza/holidays (1,907★ MIT offline), Checkiday (5,000+ US observances), Calendarific (freemium)
### 5.4 Editorial and enrichment lanes
#### 5.4.1 Chronicling America API (historic newspapers), Wikimedia featured/{yyyy}/{mm}/{dd} (TFA, POTD, most-read, in-the-news, DYK) powering a full Today page in one call
### 5.5 Licensing
#### 5.5.1 CC BY-SA attribution strings, per-image Commons license via extmetadata, fair-use thumbnail pitfalls, CC0 Wikidata

## 6. Database Architecture Blueprint (~1,200 words, 2 tables, 1 diagram)
### 6.1 Ingestion pipeline
#### 6.1.1 Crawl plan: 366 all/{MM}/{DD} calls/language (~1 h, free token), weekly re-crawl of living day pages; day-page action=parse for recent-2-year events gap; Wikidata dump precompute (public WDQS times out; QLever mirror works)
### 6.2 Wikidata SPARQL recipes (tested)
#### 6.2.1 Births/deaths via P569/P570 + MONTH/DAY filters + sitelinks ranking; events via P585 with calendar-day-item exclusion + Julian drift warning; weddings via p:P26/ps:P26/pq:P580 (414,149 dated marriages — feasible); holidays via P837 (sparse, 6,950)
### 6.3 Notability ranking
#### 6.3.1 Composite score: log(sitelinks) + log(pageviews) + log(DBpedia inbound links); birthday-bump evidence (Brian May 8,183 views on Jul 19 vs ~4k baseline); bulk pageview dumps
### 6.4 Schema and taxonomy
#### 6.4.1 entities + on_this_day DDL: denormalized notability/image for single-index day reads, per-row source provenance for multi-source dedupe; category taxonomy (events→battle/disaster/politics/science/sports/arts; persons→occupation; holidays→public/religious/UN/national/movable; weddings + anniversaries via P571/P577)
### 6.5 Images pipeline
#### 6.5.1 P18 → Special:FilePath → Commons extmetadata (license + artist attribution)

## 7. SEO and Programmatic Growth Strategy (~1,200 words, 2 tables, 1 chart)
### 7.1 Demand landscape
#### 7.1.1 Niche growing: "on this day" interest ~5–6× and "today in history" ~4× since 2021 (Google Trends); head-term volumes (Ahrefs US Jul 2026): famous birthdays 428K, what day is it 234K, what holiday is today 149K, this day in history 61K, on this day 23K
### 7.2 Zero-click economics
#### 7.2.1 Click-capture analysis: "this day in history" #1 ≈100% of volume vs "what day is today" #1 ≈26% (Google OneBox/AIO) — route around zero-click with tools, lists, embeds
### 7.3 Programmatic template map
#### 7.3.1 14 templates: /on-this-day/{m}/{d}, /born/{m}/{d}, /died/{m}/{d}, /on-this-day/{category}/{m}/{d}, /year/{y}, /days-since/{event}, /how-old/{person}, /national-{day}-day; per-date 25–50× demand pulses; holiday-year prizes (easter 2024: 6.5M)
### 7.4 Winnable segments and entry sequence
#### 7.4.1 Date-math tools (winnable at DR 56), 1,500+ individual national days, category×date combos ("on this day in music" rising +100%), birthday-twin tools, non-English (PT/ES); widgets as backlink engine; 4-phase entry plan

## 8. AI Premium Product Design (~1,300 words, 2 tables)
### 8.1 Positioning: sell verification, not chat
#### 8.1.1 GPT-4o <40% on SimpleQA; exact dates are LLMs' weakest domain — "ChatGPT guesses dates. We look them up."; precedents: Perplexity freemium, Britannica ASK (grounded-only answers), Scopus AI, MyHeritage (82M viral uses → artifact purchase), Consensus
### 8.2 Ranked premium features
#### 8.2.1 1) "The world on the day you were born" AI report + printable PDF at $4.99 (gift-market posters sell ~$20); 2) cited AI chat subscription $6/mo or $49/yr with 3 free answers/day; 3) NL→filter chat; 4) embeddable widget free w/ attribution, $19/mo white-label; 5) API tier $9–$99/mo
### 8.3 RAG architecture
#### 8.3.1 Deterministic date/entity parsing → SQL retrieval → retrieval-only grounded generation with per-claim record IDs → post-verification stripping uncited claims → multi-level cache; refuse-out-of-corpus (Britannica model)
### 8.4 Unit economics
#### 8.4.1 $0.0003–0.0016 per cited answer (Flash-Lite/GPT-5-mini); pre-generate 366 days <$2; prompt caching + semantic cache → 90–99% cost cut; >90% gross margin all tiers
### 8.5 Trust UX and risks
#### 8.5.1 Two-tone Verified vs AI-written labeling, row-level citations, watermarked artifacts, ad-free Plus; risks: hallucination liability, free-chatbot cannibalization (sell artifacts/widgets/API, not prose), era-content copyright (#1 songs, headlines — legal review)

## 9. Build Roadmap and Agent Implementation Prompts (~1,000 words, 2 tables)
### 9.1 90-day phased plan
#### 9.1.1 Phase 1 (weeks 1–3): data ingestion + schema + day pages; Phase 2 (weeks 4–6): faceted search + programmatic templates + holiday engine; Phase 3 (weeks 7–10): widgets + birthday report MVP + newsletter; Phase 4 (weeks 11–13): AI chat premium + API tier + non-English expansion
### 9.2 Copy-paste agent prompts
#### 9.2.1 Prompt A: ingestion crawler; Prompt B: schema + API; Prompt C: programmatic page templates; Prompt D: widget; Prompt E: AI answer pipeline — each a self-contained brief for the user's coding agent (Kimi Code/Codex), aligned to their Next.js/React + Cloudflare stack habits
### 9.3 KPI targets
#### 9.3.1 Indexation (366×5 pages in 30 days), impressions growth, widget embeds as link velocity, free→paid conversion benchmarks (1–3% freemium norm), RPM targets

## 10. Key Insights and Risk Register (~800 words, 1 table)
### 10.1 Eight cross-dimension insights
#### 10.1.1 Data is free — moat is verification and packaging; premium/API layer unclaimed; AI as trust product; zero-click routing; birthday-bump demand pulses; weddings under-served (414K Wikidata marriages); dedupe as hidden cost; widgets as link engine
### 10.2 Risk register
#### 10.2.1 Licensing/attribution compliance; CC BY-SA share-alike implications for derived DB; traffic-estimate uncertainty; AI cost creep; holiday-year query seasonality; Google AIO expansion; era-content copyright

# References
## onthisday_dim01_site_anatomy.md
- **Type**: Research dimension
- **Description**: Live-verified site anatomy: homepage modules, feature×filter matrix, URL grammar, entry content model, gaps
- **Path**: /mnt/agents/output/research/onthisday_dim01_site_anatomy.md
## onthisday_dim02_business_model.md
- **Type**: Research dimension
- **Description**: Traffic, monetization, revenue model, ownership, comparables
- **Path**: /mnt/agents/output/research/onthisday_dim02_business_model.md
## onthisday_dim03_competitor_matrix.md
- **Type**: Research dimension
- **Description**: 8 sites + 5 apps profiled; 34-row feature matrix; 12 gaps
- **Path**: /mnt/agents/output/research/onthisday_dim03_competitor_matrix.md
## onthisday_dim04_wikimedia_api.md
- **Type**: Research dimension
- **Description**: Wikimedia Feed API endpoints, schema, volumes, rate limits, licensing, bulk strategy
- **Path**: /mnt/agents/output/research/onthisday_dim04_wikimedia_api.md
## onthisday_dim05_wikidata_dbpedia.md
- **Type**: Research dimension
- **Description**: Tested SPARQL recipes, notability ranking, DDL schema, images pipeline
- **Path**: /mnt/agents/output/research/onthisday_dim05_wikidata_dbpedia.md
## onthisday_dim06_free_apis_datasets.md
- **Type**: Research dimension
- **Description**: 19-source ranked catalog, live tests, ingestion stack
- **Path**: /mnt/agents/output/research/onthisday_dim06_free_apis_datasets.md
## onthisday_dim07_seo_keywords.md
- **Type**: Research dimension
- **Description**: Keyword volumes, zero-click analysis, 14 programmatic templates, entry strategy
- **Path**: /mnt/agents/output/research/onthisday_dim07_seo_keywords.md
## onthisday_dim08_ai_premium_model.md
- **Type**: Research dimension
- **Description**: AI premium precedents, ranked features, RAG architecture, unit economics, UX flows
- **Path**: /mnt/agents/output/research/onthisday_dim08_ai_premium_model.md
## onthisday_cross_verification.md
- **Type**: Cross-verification
- **Description**: Confidence tiers and conflict resolution
- **Path**: /mnt/agents/output/research/onthisday_cross_verification.md
## onthisday_insight.md
- **Type**: Insight synthesis
- **Description**: 8 cross-dimension insights
- **Path**: /mnt/agents/output/research/onthisday_insight.md
