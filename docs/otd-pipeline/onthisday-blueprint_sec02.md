## 2. OnThisDay.com Site Anatomy — Features and Filters

OnThisDay.com is not a list of facts; it is a lattice. A public scrape captured 226,209 dated entries across Events, Birthdays, Deaths and Weddings (June 2022 snapshot), and the site multiplies that single corpus into millions of templated pages by re-slicing it along date, type, channel, topic, and person dimensions [^20^]. The build lesson: the entry schema is trivially simple, and all defensibility sits in the filter lattice, the computed person attributes, and a thin editorial layer. This chapter maps the modules, filters, and URL grammar worth cloning, then the five flanks left open.

### 2.1 Homepage and content modules

The homepage is the daily-rendered front page of the whole database. Under the title "On This Day — Today in History, Film, Music and Sport," fourteen stacked modules each open a storefront window into a different slice of the corpus, with a universal filter bar (keyword + day + month + type) repeated in header and footer [^1^]. Three modules are computed live against the current date — a pattern worth stealing, because it makes the page self-updating with zero daily editorial labor.

**Table 2-1. Homepage module inventory (top → bottom, as rendered July 19) [^1^]**

| # | Module | What it renders | Mechanics / link target |
|---|---|---|---|
| 1 | Today in History | 5 photo-highlighted events with year links, person links, footnote citations `[1][2]` | `highlight` flag → h3 + image; links to year/photo pages [^1^] |
| 2 | Historical Events Today | Extended chronological event list | Auto from Events table [^1^] |
| 3 | Events in 2025 | Current-year happenings | Auto: year filter [^1^] |
| 4 | Today in Sport | Channel teaser (1877 first Wimbledon, 1903 first Tour de France) | Auto: Sport channel filter [^1^] |
| 5 | Take Our Weekly Quiz! | Multi-choice quiz call-to-action | Weekly URL `/quiz/{month}/{dd}-{dd}` [^1^] |
| 6 | Did You Know? | One fun fact with full date ("July 19, 2001") | `fun_fact` flag [^1^] |
| 7 | Famous Birthdays | 6 deceased figures with lifespan ranges | Birthdays table [^1^] |
| 8 | Celebrity Birthdays | Living celebrities with photos and ordinal ages ("Ilie Năstase 80th Birthday") | **Computed live** from `birth_date` [^1^] |
| 9 | Famous Weddings | Entries with **both partners' ages** ("John Dickinson (37) weds… Mary Norris (30)") | Ages computed at event date [^1^] |
| 10 | Famous Divorces | Filings with marriage-duration notes | Divorces table [^1^] |
| 11 | Famous Deaths in History | 6 entries with lifespans + "Deaths in August 2025" month index | Deaths table [^1^] |
| 12 | Featured Article | Long-form teaser card with event date | `/articles/{slug}` [^1^] |
| 13 | Famous Americans | Nationality module (Lincoln, Washington, MLK Jr.) | `/people/nationality/american` [^1^] |
| 14 | Footer | Filter bar, "Get Our Daily Email" newsletter, About/Corrections/Privacy, social icons | Newsletter = only retention channel [^1^] |

The stack is a cross-sell engine, not decoration: every module deep-links into a page family (year pages, profiles, topics, articles), turning one landing visit into the multi-page sessions that feed the ad model. The rebuild ratio that matters: eleven of fourteen modules are pure database queries, two (quiz, featured article) are light weekly editorial, and only photo highlights need per-entry human work. The live age labels in modules 8–9 are the highest-leverage trick — a `birth_date` column plus date math yields "80th Birthday today" headlines that feel freshly written each morning. All fourteen are reproducible in Next.js as static components with daily revalidation in the first build sprint.

### 2.2 Feature-by-feature filter matrix

Filtering is the product. Every page carries the same bar — keyword, All Days (1–31), All Months, All Types (Events/Birthdays/Deaths/Weddings) — and each feature adds its own facet axes (a *facet* = a filterable attribute that spawns its own index-page family) [^1^]. Table 2-2 consolidates the matrix.

**Table 2-2. Feature × filter matrix**

| Feature | Filters | URL pattern | Notes |
|---|---|---|---|
| Date overview | day, month, type tabs, channel tabs, prev/next | `/day/{month}/{day}` [^2^] | Aggregates all four types + articles, photos, quiz |
| Events by date | day, month, channel | `/events/{month}/{day}` [^3^] | Chronological back to year 64; highlights get h3 + image + footnotes |
| Events by year | year, month anchors, channel | `/events/date/{year}` ≡ `/date/{year}` [^4^][^5^] | Adds "{year} in Music/Sport," awards, World Leaders |
| Events by full date | year + month + day | `/date/{year}/{month}/{day}` [^5^] | Single-day-in-year pages |
| Birthdays | day, month, channel variants (actors/musicians/athletes) | `/birthdays/{month}/{day}` [^10^] | `[OS]` Old Style flag; living people get computed ordinal age |
| Deaths | day, month, year, channel | `/deaths/{month}/{day}`, `/deaths/date/{year}` [^11^] | Rows carry cause/manner + age at death |
| Weddings & Divorces | day, month, year | `/weddings/{month}/{day}`, `/weddings/date/{year}` [^12^] | Both partners' ages; divorces note duration |
| Channel hubs ×3 | Today / Events / Birthdays / Deaths / By Year / By Day / Topics | `/film-tv/`, `/music/`, `/sport/` [^6^][^13^][^14^] | Channel-scoped search; Weddings dropped |
| Topic taxonomies | topic → subtopic (2 levels) | `/{channel}/{topic}/{subtopic}` [^7^][^8^][^13^][^15^] | 22 film/TV awards, 11 music awards, 30+ sports |
| People engine | age group, generation, nationality, 100+ professions, star sign, Chinese zodiac, cause of death, Top 100, A–Z | `/famous-people.php` + `/people/{axis}/{value}` [^16^] | Nine facet axes — deepest filter set on site |
| Search | keyword + day + month + type; channel variants | `/search.php`, `/{channel}/search.php` [^17^] | Results via POST/JS — not URL-addressable |
| Country lenses | US, UK, China, Australia | `/today/american-history.php` etc. [^1^][^10^] | Geo-SEO "today" variants |
| Quiz | weekly date range | `/quiz/{month}/{dd}-{dd}` [^1^] | "Challenge your friends" hook |

Three conclusions fall out. First, every facet axis is a page family: the nine people axes spawn hundreds of index pages from one table, which is why computed attributes (zodiac, generation, age band) repay their storage cost many times over. Second, taxonomy investment is asymmetric — Film & TV, Music, and Sport each get a curated two-level tree, while the flagship History channel has **no topic layer at all** [^6^][^7^][^13^][^15^]. Third, search is architecturally weak: POST/JS results have no stable URLs [^17^], so the incumbent indexes nothing for "person + date" long-tail queries. A challenger shipping server-rendered, URL-addressable faceted search claims an entire query class OnThisDay.com structurally cannot rank for.

### 2.3 URL architecture and programmatic-SEO grammar

The site's programmatic SEO (page templates generated from database dimensions at scale) follows one principle: every entry is addressable through a lattice of dimensions — date (day/month/year/full-date) × type × channel × topic × person attribute [^3^][^16^]. Table 2-3 is the clone-ready map.

**Table 2-3. URL grammar map**

| URL pattern | Renders | Template title example | Approx. family size |
|---|---|---|---|
| `/day/{month}/{day}` | All-types date overview | "What Happened on July 19" [^2^] | 366 |
| `/{type}/{month}/{day}` (events, birthdays, deaths, weddings) | Type-filtered day list | "Historical Events on July 19" [^3^]; "Famous Deaths on July 19" [^11^]; "Famous Wedding Anniversaries on July 19" [^12^] | 366 × 4 ≈ 1,464 |
| `/events/date/{year}` ≡ `/date/{year}` | Year overview | "What Happened in 1990" [^4^][^5^] | ~2,000 years × 4 types |
| `/date/{year}/{month}/{day}` | Single full date | Event permalinks [^5^] | Effectively unbounded |
| `/today/*.php` | Legacy "today" endpoints | "Today's Famous Birthdays" [^9^][^10^] | 5+ |
| `/today/{country}-history.php` | Country-lens today | [^1^][^10^] | 4 observed |
| `/{channel}/` + `/{channel}/events.php` etc. | Channel hubs + day/year lists | "Today in Movie and TV History" [^6^][^14^] | 3 channels × ~6 views |
| `/{channel}/{topic}/{subtopic}` | Two-level topic pages | "Hollywood in History" [^7^][^8^] | 100+ topics |
| `/people/{slug}`; `/people/{plural}`; `/people/profession\|nationality\|generation\|star-sign/{x}`; `/people/starting-with-{a–z}` | Profiles + people lists | People-hub facets [^16^] | 100+ professions, dozens of axes |
| `/articles/{slug}`, `/photos/{slug}`, `/quiz/{month}/{dd}-{dd}` | Editorial layer | [^1^][^17^] | Weekly cadence |

Titles are machine-generated per dimension combination, breadcrumbs and sibling-topic links reinforce the taxonomy, and every year, name, and date in every entry is a hyperlink — near-perfect internal linking for free [^2^][^3^][^4^][^8^][^10^][^11^][^12^]. Two imperfections matter to a cloner: legacy `.php` endpoints coexist with clean paths (both live; canonicalization unverified), and pagination leaks through query strings (`?p=2…12`) [^16^]. Most tellingly, `robots.txt` declares no sitemap and blocks every major AI crawler — GPTBot, ClaudeBot, PerplexityBot, CCBot, Bytespider, Meta-ExternalAgent [^18^]. Recommended posture: replicate this grammar one-for-one as statically generated routes, fix the duplication and pagination hygiene, then extend with the axes the incumbent lacks (history topics, combined facets).

### 2.4 Entry content model and editorial layering

The schema is small. A base **event entry** carries `year` (linked; supports antiquity, e.g. 64 AD), `month`, `day`, 1–2 sentences of encyclopedic text, linked `persons[]`, channel tags, and topic tags [^1^][^3^]. A `highlight` flag promotes an entry into the editorial layer: an h3 display title ("Mansa Musa Arrives in Cairo"), a captioned image, sometimes a linked photo feature, and footnote citations `[1][2]` underpinning the "most accurate independent site" brand [^1^][^3^]. A **person record** carries name, slug, birth date (with `[OS]` Old Style flag for pre-Gregorian dates), nullable death date driving living/deceased logic, birthplace, nationality, professions, cause of death, popularity rank, and image [^10^][^11^][^16^]; everything else — current age, age at death, star sign, Chinese zodiac, generation, age group — is computed [^16^]. List rows are equally templated: birthdays render "Name, nationality + profession, born in PLACE (d. YEAR)"; deaths "Name, descriptor, cause/manner, dies at AGE"; weddings give both partners' ages; divorces note duration [^10^][^11^][^12^].

Implication: the schema is a weekend build, and computed attributes generate entire page families at zero marginal cost. The only genuinely expensive layer is 25 years of highlight titles, captions, and footnotes — exactly where a verification-first data pipeline (Chapter 5) must substitute for editorial headcount.

### 2.5 What is missing (the open flanks)

Five absences define the competitive opening:

1. **No public API, widgets, or embed tools** anywhere in navigation or footers; `robots.txt` blocks every major AI crawler — content is protected, never syndicated [^1^][^18^].
2. **No accounts or personalization** — no "on this day in your life," birthday-twin, or saved-interest features [^1^].
3. **No date calculators or visualizations** — no age/date-difference tools, maps, or timelines; the product is read-only lists [^1^][^17^].
4. **No History topic taxonomy** — topic trees exist only for entertainment and sport; there are no WWII, Space, Disasters, or Science pages [^6^][^7^][^13^][^15^].
5. **No indexable search results** — POST/JS rendering means zero long-tail landing pages [^17^].

Cross-verification across eight profiled competitors confirms none fills the API, widget, or faceted-filter gap either — an industry-wide blind spot, not a single-incumbent oversight [^22^]. Each missing piece is also unclaimed revenue: APIs, widgets, and personalization are precisely the monetizable surfaces an ads-only model cannot fund. Chapter 3 quantifies that model — and what these openings are worth.

#### Chapter References

[^1^]: https://www.onthisday.com/ — homepage (nav, modules, filter bar, footer, newsletter, consent)
[^2^]: https://www.onthisday.com/day/july/19 — "What Happened on July 19" date overview page
[^3^]: https://www.onthisday.com/events/july/19 — "Historical Events on July 19" full event list
[^4^]: https://www.onthisday.com/events/date/1990 and https://www.onthisday.com/date/1990 — "What Happened in 1990" year page
[^5^]: https://www.onthisday.com/date/1990 — year page modules (Did You Know `/date/1990/may/17`, births/deaths by channel, awards, World Leaders)
[^6^]: https://www.onthisday.com/film-tv/ — "Today in Movie and TV History" channel hub (sub-nav: Today/Events/Birthdays/Deaths/By Year/By Day/Topics)
[^7^]: https://www.onthisday.com/film-tv/topics.php — "Film & Television History by Topic" taxonomy
[^8^]: https://www.onthisday.com/film-tv/film/hollywood — "Hollywood in History" topic page (breadcrumbs, ISO full-date links)
[^9^]: https://www.onthisday.com/today/events.php — "Today in History" (weddings link `/today/weddings-divorces.php`)
[^10^]: https://www.onthisday.com/today/birthdays.php — "Today's Famous Birthdays" (entry format, [OS] flag, `/birthdays/date/{year}`, `/today/australian-history.php`)
[^11^]: https://www.onthisday.com/deaths/july/19 — "Famous Deaths on July 19" (cause/age-at-death format, `/deaths/date/{year}`)
[^12^]: https://www.onthisday.com/weddings/july/19 — "Famous Wedding Anniversaries on July 19" (both partners' ages, `/weddings/date/{year}`)
[^13^]: https://www.onthisday.com/music/genres.php — "Music History by Genre" taxonomy
[^14^]: https://www.onthisday.com/sport/ — "Today in Sports History" channel hub
[^15^]: https://www.onthisday.com/sport/sports.php — "Sports History by Sport" full taxonomy
[^16^]: https://www.onthisday.com/famous-people.php and https://www.onthisday.com/people/professions.php — people hub (Age/Generation/Country/Profession/Star Sign/Zodiac/Cause of Death/Top 100/A–Z) + paginated professions `?p=1..12`
[^17^]: https://www.onthisday.com/search.php — search form + index links (Calendar, Dates, People, Articles, Photos, Quiz)
[^18^]: https://www.onthisday.com/robots.txt — AI-bot blocklist (GPTBot, ClaudeBot, PerplexityBot, CCBot, Bytespider, Meta-ExternalAgent), disallowed paths, no sitemap
[^20^]: Kaggle dataset "226,209 Events From onthisday.com" (Events, Birthdays, Deaths, Weddings; as of 2022-06-28) — via https://www.selectdataset.com/dataset/057611ee4ac2fed10f2b992a4d9171d1
[^22^]: Competitor matrix research file `onthisday_dim03_competitor_matrix.md` — feature matrix rows 25–26 (syndication/API, accounts) and gap analysis #1/#8 (no competitor offers REST API, embeddable widgets, or faceted date×category filtering); cross-checked across Britannica, History.com, BBC On This Day, timeanddate, Famous Birthdays, On-This-Day.com, Library of Congress, Histoday
