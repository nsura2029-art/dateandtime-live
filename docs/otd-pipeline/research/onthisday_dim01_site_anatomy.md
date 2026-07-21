# OnThisDay.com — Complete Site Anatomy (Competitive Teardown)

> Research date: session "today" rendered by the site as **July 19** (site © 2000‑2026, operated by **On This Day Pte. Ltd.** — a Singapore entity).[^1^]
> Method: live browsing of 20+ distinct pages/URLs on www.onthisday.com (Cloudflare-protected; intermittent 403/timeouts limited some sections). Sections not verified live are explicitly marked **[NOT VERIFIED — inferred]**.
> Scale reference: a public scrape dataset ("226,209 Events From onthisday.com", June 2022) covers Events, Birthdays, Deaths & Weddings — i.e. the DB holds **~226k+ dated entries**.[^20^]

---

## 1. Homepage anatomy (https://www.onthisday.com/)

Title: *"On This Day - Today in History, Film, Music and Sport"*.[^1^]

**Global header / nav**
- Channel hubs: **History** (`/today/events.php`), **Film & TV** (`/film-tv/`), **Music** (`/music/`), **Sport** (`/sport/`).[^1^]
- "Today in History" feature tabs: **Events** (`/today/events.php`), **Birthdays** (`/today/birthdays.php`), **Deaths** (`/today/deaths.php`), **Fun Facts** (`/today/fun-facts.php`), **Quiz** (`/quiz/july/15-21` — weekly range URL).[^1^]
- Country-lens flag links (icon-only): `/today/american-history.php`, `/today/british-history.php`, `/today/chinese-history.php` (+ `/today/australian-history.php` seen on birthdays page).[^1^][^10^]
- Prev/next day links: `18 Jul` → `/day/july/18`, `Jul 20` → `/day/july/20`.[^1^]
- **Universal filter bar** (repeated on virtually every page, header and footer): keyword text input + **All Days** dropdown (1–31) + **All Months** dropdown (January–December) + **All Types** dropdown (**Events / Birthdays / Deaths / Weddings**) + **Search** button; second free-text input (person/keyword).[^1^]
- Cookie/consent: GDPR banner ("1727 partners"), ads served via Google DoubleClick.[^1^][^5^]

**Body sections (top → bottom)**[^1^]
1. **Today in History** — 5 highlighted events with photos: year link (e.g. `1843` → `/events/date/1843`), short text with inline person links (`/people/isambard-kingdom-brunel`), some with `h3` titles + `figure/picture` images + photo links (`/photos/ss-great-britain-launched`); footnote refs `[1][2]` on some entries (source citations).
2. **Historical Events Today** (list module).
3. **Events in 2025** (current-year module).
4. **Today in Sport** (e.g. 1877 1st Wimbledon; 1903 1st Tour de France).
5. **Take Our Weekly Quiz!** (module → `/quiz/july/15-21`).
6. **Did You Know?** (fun-fact teaser with full date, e.g. "July 19, 2001").
7. **Famous Birthdays** — 6 historical figures w/ lifespan ranges (Samuel Colt 1814–1862 …) + "Famous Birthdays Today" link.
8. **Celebrity Birthdays** — living celebs w/ photos (`/images/people/{slug}.jpg`) and ordinal age labels ("Ilie Năstase 80th Birthday", "Benedict Cumberbatch 50th Birthday").
9. **Famous Weddings** — entries with both partners' ages: "John Dickinson (37) weds … Mary Norris (30) in a civil ceremony".
10. **Famous Divorces** — e.g. "2023 Actor Joe Manganiello files for divorce from actress Sofía Vergara"; "Weddings & Divorces Today" link.
11. **Famous Deaths in History** — 6 entries w/ lifespans; "Famous Deaths Today" + "Deaths in August 2025" (month+year death index) links.
12. **Featured Article** — card → `/articles/american-women-demand-their-rights` w/ teaser + event date.
13. **Famous Americans** — nationality module (`/people/nationality/american`) with 6 person links (Lincoln, Washington, MLK Jr…).
14. **Footer**: search tagline *"Search the largest and most accurate independent site for today in history."* + full filter bar; links **About / Contact / Corrections / Privacy / Terms** (`/about.php` etc.); **"Get Our Daily Email"** newsletter signup (email input + "Add Me!"); social icons Facebook/Instagram/Twitter; copyright line.[^1^]

**Calendar control**: a "Calendar" button appears beside every date header (opens date picker) — exact widget behavior **[NOT VERIFIED]**.

---

## 2. Feature × Filter matrix

| Feature | Filters / dimensions observed | URL pattern (verified live) | Notes |
|---|---|---|---|
| **Date overview ("What happened on")** | day (1–31), month (Jan–Dec), type tabs (Events/Birthdays/Deaths/Weddings), channel tabs (History/Film&TV/Music/Sport), prev/next day | `/day/{month}/{day}` e.g. `/day/july/19`[^2^] | Aggregates: Major Events (photo highlights), More Events, Birthdays, Actors/Musicians/Athletes born, Famous Deaths, Articles+Photos+Quiz, "{Month} in History" nearby-date article links |
| **Events by date** | day, month, type, channel; prev/next day (`/events/july/18`) | `/events/{month}/{day}`[^3^] | Full chronological list (every entry since antiquity, e.g. year 64); highlighted entries get `h3`+image+figcaption; footnote citations `[1][2]` |
| **Events by year** | year (prev/next), month anchor jumps, type, channel | `/events/date/{year}`[^4^] and alias `/date/{year}`[^4^][^5^] | Year page = overview w/ "Major Events", "{year} in Music/Sport", Did You Know, births/deaths by channel, awards, "World Leaders in {year}" |
| **Events by full date** | year+month+day | `/date/{year}/{month}/{day}` e.g. `/date/1990/may/17`, `/date/1887/february/1`[^5^][^8^] | Single-day-in-year pages; linked from topic lists as ISO labels ("1887-02-01") |
| **Birthdays by date** | day, month, channel (Actors=`/film-tv/birthdays/{m}/{d}`, Musicians=`/music/...`, Athletes=`/sport/...`) | `/birthdays/{month}/{day}`; today view `/today/birthdays.php`[^10^] | Entry = "Name, nationality + profession, born in PLACE (d. YEAR)"; `[OS]` Old Style flag on pre-Gregorian dates; living celebs shown with ordinal age |
| **Birthdays by year** | year, channel | `/birthdays/date/{year}`, `/film-tv/birthdays/date/{year}`[^5^][^10^] | "Actors/Musicians/Athletes Born in {year}" modules |
| **Deaths by date** | day, month, channel (Actors/Musicians/Athletes deaths variants) | `/deaths/{month}/{day}`[^11^] | Entry = "Name, descriptor (reign/role years), cause/manner, dies at AGE" (e.g. "killed in a tournament at 23", "dies of the plague at 55") |
| **Deaths by year / month** | year (`/deaths/date/{year}`); month+year ("Deaths in August 2025") | `/deaths/date/{year}`[^5^][^11^]; month-year URL **[NOT VERIFIED]** | "Athletes Who Died in {year}" etc. |
| **Weddings & Divorces by date** | day, month, type (Famous Weddings / Famous Divorces sections) | `/weddings/{month}/{day}`[^12^]; today view `/today/weddings-divorces.php`[^9^] | Entries give **both partners' ages** + location; divorce entries note marriage duration ("after 2 years of marriage") |
| **Weddings by year** | year | `/weddings/date/{year}`[^12^] | — |
| **Channel hub: Film & TV** | Today / Events / Birthdays / Deaths / **By Year** / **By Day** / **Topics** | `/film-tv/`, `/film-tv/events.php`, `.../events-by-year.php`, `.../events-calendar.php`, `.../topics.php`[^6^] | Type filter drops Weddings (Events/Birthdays/Deaths only); channel-scoped search (`/film-tv/search.php`); footer tagline customized ("largest, most accurate site for today in entertainment history") |
| **Film & TV topics (2-level taxonomy)** | topic → subtopic | `/film-tv/{topic}` + `/film-tv/{topic}/{sub}` e.g. `/film-tv/comedy/cartoons`, `/film-tv/film/hollywood`[^7^][^8^] | **Comedy** (Cartoons, Humorists, Ventriloquists) · **Film** (Bollywood, Films, Hollywood) · **Film & TV Awards** (22: Academy Awards, BAFTA Film/TV, Berlin, Cannes, Critics' Choice Movie/TV, Daytime Emmy, Emmy, Golden Globes, Golden Raspberry, NAACP Image, National Film Awards India, Other Film Festivals, People's Choice, San Diego Comic-Con, Soap Opera Digest, Sundance, Toronto, Venice, American Comedy Awards) · **Professions** (Broadcasters, Cinematographers, Critics, Film Score Composers, Production Designers, TV Executives, TV Writers) · **Modelling** (Beauty Pageants, Playmates) · **Television** (TV Channels, TV Game Shows, TV News & Current Affairs, TV Programs, TV Series) · **Video Games** |
| **Channel hub: Music** | Today / Events / Birthdays / Deaths / By Year / By Day / **Genres** | `/music/`, `/music/genres.php`[^13^] | Same template as Film & TV |
| **Music genres (2-level)** | genre → subgenre/role | `/music/{genre}` + `/music/{genre}/{sub}` e.g. `/music/heavy-metal/heavy-metal-bands`[^13^] | **Blues** (Ragtime) · **Classical** (National Anthems, Orchestras) · **Concerts & Festivals** · **Country & Western** (Bluegrass) · **Dance** (Ballet Dancers) · **Electronic** · **Folk** (Ballad) · **Gospel** (Hymnists) · **Heavy Metal** (Artists, Bands) · **Jazz** (Big Band Musicians) · **Music Awards** (11: Grammy, BRIT, Billboard, American Music, MTV VMA, Eurovision, Academy of Country Music, CMA, CMT, Soul Train, Music City News Country) · **Music Industry** (15: Album Cover Artists, Billboard Magazine & Charts, Mastering/Recording Engineers, Music Critics/Directors/Journalists/Managers/Producers/Promoters/Publishers/Teachers/Theorists, Instrument Inventors, Musicologists) · **Musicals** (Cats, Grease, Les Misérables, Phantom of the Opera, West Side Story) · **Opera** · **Pop** (Pop Bands) · **Rap** · **Reggae** (Dancehall, Reggae Bands) · **R&B** (R&B Singers) · **Rock n Roll** (Rock Bands) |
| **Channel hub: Sport** | Today / Events / Birthdays / Deaths / By Year / By Day / **Sports** | `/sport/`, `/sport/sports.php`[^14^][^15^] | Same template |
| **Sports (2-level)** | sport → league/competition/role | `/sport/{sport}` + `/sport/{sport}/{sub}` e.g. `/sport/boxing/weight-divisions`[^15^] | **American Football** (Championships, Hall of Fame, Leagues, College Football, NFL Draft, NFL Teams) · **Athletics** (18 disciplines: Decathlon→Sprinting, World Championships) · **Australian Rules** · **Baseball** (Championships, Coaches, Hall of Fame, Leagues, Umpires, MLB Draft, MLB Teams) · **Basketball** (Championships, Hall of Fame, Leagues, College, Harlem Globetrotters, NBA Draft, NBA Teams) · **Boxing** (Associations, Kickboxing, Weight Divisions) · **Chess** · **Cricket** (Competitions, International Teams) · **Cycling** (BMX, Mountain Biking, Tour de France) · **Darts** · **Extreme Sports** (Base Jumping, Skateboarding, Skydiving, Surfing, Water Skiing) · **Field Hockey** · **Golf** (Opens, Tournaments, Tours) · **Horse Racing** (Equestrian, Races, Trainers, Racehorses, Hall of Fame) · **Ice Hockey** (Hall of Fame, Championships, NHL, NHL Teams) · **Martial Arts** (UFC) · **Motor Sport** (Drag, F1, Motocross, Races, Motorcycle, NASCAR) · **Netball** · **Olympic Sports** (20: Archery…Wrestling, Winter Olympics) · **Rugby League** (World Cup) · **Rugby Union** (World Cup, Six Nations, Super Rugby) · **Snooker** (Billiards) · **Soccer** (Ballon d'Or, English Premier League, Football Managers, Tournaments) · **Tennis** (Tournaments) · **Yachting** (America's Cup, Windsurfing) |
| **People (famous-people hub)** | **Age** (`/people/age-groups.php`: 20‑29…80‑89, Over 90, "living people by age") · **Generation** (`/people/by-generation.php` → `/people/generation/{greatest-generation\|silent-generation\|baby-boomer\|generation-x\|millennial\|generation-z}`) · **Country** (`/people/by-nationality.php` → `/people/nationality/{american…}`) · **Profession** (`/people/professions.php`, 12 pages `?p=1..12`, 100+ professions) · **Star Sign** (`/people/star-signs.php` → `/people/star-sign/{aries…}`) · **Chinese Zodiac** (`/people/chinese-zodiac.php`, 12 animals) · **Cause of Death** (`/people/cause-of-death.php`: Assassination, Drug Overdose, Gunshot Wound, Murder, Plane Crash, Suicide) · **Top 100** (`/people/most-popular.php`) · **A–Z** (`/people/starting-with-a` … `-z`) | `/famous-people.php`[^16^] | Profession page URLs: `/people/{plural-slug}` (`/people/actors`, `/people/astronomers`) **and** `/people/profession/{slug}` (`/people/profession/us-attorneys-general`); professions run A–Z (Abolitionists, Actors, Actresses, Admirals, Anthropologists, Archaeologists, Architects, Artists, Assassins, Astronauts, Astronomers, Attorneys General, Australian PMs, Authors, Automobile Pioneers…) |
| **Person profile** | — | `/people/{slug}` e.g. `/people/johannes-kepler`, `/people/nelson-mandela`[^1^][^3^] | Page anatomy **[NOT VERIFIED]** (linked from every entry; images at `/images/people/{slug}.jpg`) |
| **Search** | keyword/person text + day + month + type (Events/Birthdays/Deaths/Weddings); channel-scoped variants | `/search.php`, `/film-tv/search.php`, `/music/search.php`, `/sport/search.php`[^17^] | Results render via POST/JS — direct `?search=` GET returns bare form **[NOT VERIFIED further]**; search page nav exposes index pages: Calendar, Dates, People, Articles, Photos, Quiz |
| **Quiz** | weekly date ranges | `/quiz/{month}/{dd}-{dd}` e.g. `/quiz/july/15-21`; index `/quiz/`[^1^][^17^] | "Multi-choice, weekly history quiz… challenge your friends"; mechanics **[NOT VERIFIED]** |
| **Articles (long-form)** | by date proximity ("July in History"), by year ("Articles About 1990") | `/articles/{slug}`; index `/articles.php`[^2^][^5^][^17^] | Teaser card = title + 1–2 sentence hook + event date; full page **[NOT VERIFIED]** |
| **Photos** | attached to highlighted events | `/photos/{slug}` e.g. `/photos/ss-great-britain-launched`; index `/photos/`[^1^][^17^] | Photo feature pages w/ caption + date |
| **Fun Facts ("Did You Know?")** | by day | `/today/fun-facts.php`[^1^] | Page **[NOT VERIFIED]**; modules appear on homepage/date/year pages |
| **Country-lens "today" pages** | country (US, UK, China, Australia observed) | `/today/american-history.php`, `/today/british-history.php`, `/today/chinese-history.php`, `/today/australian-history.php`[^1^][^10^] | Icon/flag nav items; likely more countries **[NOT VERIFIED]** |
| **Calendar / date picker** | month+day (+year on year pages) | `/calendar.php`; "Calendar" overlay button on all date pages; `/dates-by-year.php` year index[^2^][^17^] | Behavior **[NOT VERIFIED]** |
| **Newsletter** | email only | footer form "Get Our Daily Email" + "Add Me!" button[^1^] | Daily email digest |

---

## 3. URL architecture & programmatic SEO patterns

**Core principle: one entry is addressable through a huge lattice of dimensions** — date (day/month/year/full-date) × type (events/birthdays/deaths/weddings) × channel (history/film-tv/music/sport) × topic/genre/sport × person × profession/nationality/zodiac/cause-of-death.

```
/                                                         homepage (= today overview)
/day/{month}/{day}                                        date overview (all types)
/events/{month}/{day}                                     events on date
/birthdays/{month}/{day}  /deaths/{month}/{day}  /weddings/{month}/{day}
/date/{year}                                              year overview (alias of /events/date/{year})
/events/date/{year}  /birthdays/date/{year}  /deaths/date/{year}  /weddings/date/{year}
/date/{year}/{month}/{day}                                single full date (e.g. /date/1990/may/17)
/today/events.php  /today/birthdays.php  /today/deaths.php  /today/weddings-divorces.php  /today/fun-facts.php
/today/american-history.php  /today/british-history.php  /today/chinese-history.php  /today/australian-history.php
/{channel}/                                               film-tv | music | sport hub (= today view)
/{channel}/events.php  birthdays.php  deaths.php          channel today lists
/{channel}/events-by-year.php  /{channel}/events-calendar.php   channel indexes (By Year / By Day)
/{channel}/events/{month}/{day}  /{channel}/birthdays/{month}/{day}  /{channel}/deaths/{month}/{day}
/{channel}/events/date/{year}  /{channel}/birthdays/date/{year}
/{channel}/topics.php | /music/genres.php | /sport/sports.php     taxonomy indexes
/{channel}/{topic}  /{channel}/{topic}/{subtopic}         2-level topic pages (e.g. /film-tv/film/hollywood,
                                                          /music/heavy-metal/heavy-metal-bands, /sport/boxing/ufc→/sport/martial-arts/ufc)
/people/{slug}                                            person profile (e.g. /people/benedict-cumberbatch)
/people/{plural}                                          profession list (e.g. /people/actors, /people/directors)
/people/profession/{slug}                                 alt profession URL (/people/profession/us-attorneys-general)
/people/nationality/{slug}                                nationality list (/people/nationality/american)
/people/generation/{slug}                                 generation list (/people/generation/millennial)
/people/star-sign/{sign}                                  zodiac list
/people/starting-with-{a..z}                              alphabetical people index
/people/age-groups.php  by-generation.php  by-nationality.php  professions.php?p=1..12
/people/star-signs.php  chinese-zodiac.php  cause-of-death.php  most-popular.php
/famous-people.php                                        people hub
/articles/{slug}   /articles.php                          long-form articles + index
/photos/{slug}       /photos/                             photo features + index
/quiz/{month}/{dd}-{dd}   /quiz/                          weekly quiz + index
/calendar.php  /dates-by-year.php  /search.php  /{channel}/search.php
/about.php /contact.php /corrections.php /privacy.php /terms.php
/images/people/{slug}.jpg                                 person image CDN path
```

**Programmatic SEO observations**
- Titles are template-generated per dimension combo: *"What Happened on July 19"*, *"Historical Events on July 19"*, *"What Happened in 1990"*, *"Today's Famous Birthdays"*, *"Famous Deaths on July 19"*, *"Famous Wedding Anniversaries on July 19"*, *"Hollywood in History"*, *"Film & Television History by Topic"*, *"Today in Movie and TV History"*.[^2^][^3^][^4^][^10^][^11^][^12^][^6^][^7^][^8^]
- Breadcrumbs on taxonomy pages (Home > Film & TV > Topics > Film) + sibling-topic cross-links ("Film: Bollywood – Films").[^8^]
- Legacy `.php` endpoints coexist with clean path URLs (e.g. `/today/events.php` vs `/events/july/19`; `/date/64` vs `/events/date/1990`) — both verified live; duplicates presumably canonicalized **[NOT VERIFIED]**.
- Pagination via query param: `/people/professions.php?p=2…12`.[^16^]
- `robots.txt`: no sitemap declared; **aggressively blocks AI/LLM crawlers** (GPTBot, ClaudeBot, PerplexityBot, CCBot, Bytespider, Meta-ExternalAgent…) and disallows odd paths `/1006136/`, `/tower/`, `/film-tv/film-tv/`, `/music/music/`.[^18^]
- Ads: Google DoubleClick/Ad Manager; consent via a 1,727-partner CMP → heavy programmatic ad revenue model.[^1^][^5^]

---

## 4. Content / entry data model (inferred from observed rendering)

**Event entry**
- `year` (linked; supports ancient years, e.g. 64 AD), `month`, `day` (full-date pages exist → day-precision for most entries; `[OS]` Old Style flag seen on pre-Gregorian birth dates)
- `text` (1–2 sentences, plain, encyclopedic; often with embedded person references)
- `persons[]` → linked to `/people/{slug}` (multiple per entry, e.g. Stanton + Mott)
- `highlight` flag → promoted entries get an editorial `h3` **title** (e.g. "Mansa Musa Arrives in Cairo", "Operation Desert Shield", "The Squaw Man"), an image (`figure` + `figcaption` w/ person role caption, e.g. "Ruler of the Kingdom of Mali"), and sometimes a linked `/photos/{slug}` feature
- `citations[]` → numeric footnote markers `[1][2]` on some entries (source references)
- `channels[]` → history / film-tv / music / sport (drives channel filtering)
- `topics[]` → 2-level taxonomy tags per channel (e.g. film-tv/film/hollywood)
- inferred extra fields used by modules: `country/nationality` (American/British/Chinese/Australian history lenses), `article_id`/`photo_id` links, `fun_fact` flag ("Did You Know?")

**Person entry**
- `name`, `slug`; `birth_date` (d/m/y, OS flag), `death_date` (nullable → "living" logic)
- computed: **current age** ("50th Birthday" ordinal labels, "64 Years Old"), **age at death** ("dies at 69"), **star sign**, **Chinese zodiac animal**, **generation**, **age group** (living people 20‑29…Over 90)
- `nationality` (→ `/people/nationality/{x}`), `professions[]` (→ 100+ profession lists), `birthplace` ("born in Römhild, Kingdom of Bavaria")
- `cause_of_death` (Assassination, Drug Overdose, Gunshot Wound, Murder, Plane Crash, Suicide…)
- `popularity rank` (Top 100 "most popular", Popular Celebrities vs Popular Historical Figures)
- `image` (`/images/people/{slug}.jpg`), `role/descriptor` shown in figcaptions ("Astronomer", "Physicist")

**Birthday list row**: "Name, nationality + profession, born in PLACE (d. YEAR)".
**Death list row**: "Name, descriptor w/ reign/office years, cause/manner, dies at AGE".
**Wedding row**: "Person A (age) weds Person B (age) [+ B's descriptor], location, ceremony notes"; **Divorce row**: "A divorces B after N years of marriage" / "files for divorce".
**Article**: title, teaser hook (1–2 sentences), event date, body **[NOT VERIFIED]**; **Photo feature**: title, caption, date.

---

## 5. Interactive extras

- **Universal date/type/keyword search bar** on every page (header + footer) with day/month/type dropdowns.[^1^]
- **Calendar button** beside every date header (date-picker overlay — exact widget **[NOT VERIFIED]**); dedicated `/calendar.php` and `/dates-by-year.php` indexes linked from the search page.[^17^]
- **Weekly multi-choice quiz** at `/quiz/{month}/{dd}-{dd}` ("test your knowledge… then challenge your friends!" → social-challenge hook); quiz index `/quiz/`.[^2^][^17^]
- **"Did You Know?"** fun-fact modules on homepage/date/year pages; dedicated `/today/fun-facts.php`.[^1^][^5^]
- **Daily email newsletter** ("Get Our Daily Email" — footer of every page).[^1^]
- **Social**: Facebook / Instagram / Twitter (X) profile links in footer; no per-entry share buttons observed in extracted content **[partially verified]**.[^1^]
- **Corrections page** (`/corrections.php`) — crowdsourced accuracy workflow, matching their "most accurate independent site" positioning.[^1^]
- **No public API, no webmaster widgets, no embed tools, no age/date calculators found** in explored nav/footers **[NOT found in verified areas — could not check every page due to blocking]**. robots.txt shows heavy anti-bot/anti-AI-crawler posture → content is licensed/protected, not syndicated via free API.[^18^]
- **No user accounts / no personalization** ("On this day in your life"-style features not observed).

---

## 6. Key takeaways for a competitor build

1. **The moat is the lattice, not the list**: ~226k dated entries are re-sliced across date (366 day-pages × 4 types), ~2,000+ year-pages × 4 types, 3 channels × (events/birthdays/deaths) × day+year, 100+ topic pages, 100+ profession pages, nationalities, generations, star signs, Chinese zodiac, causes of death, A–Z, popularity — millions of thin-but-templated index pages with perfect internal linking (every year, name, date in every entry is a link).
2. **Replicate the URL grammar**: `/day/{m}/{d}`, `/{type}/{m}/{d}`, `/{type}/date/{year}`, `/date/{y}/{m}/{d}`, `/{channel}/{topic}/{sub}`, `/people/{slug}` — template titles per combo ("Famous Deaths on July 19").
3. **Entry model is simple** (date + 1–2 sentence text + person links + tags) — the differentiators are: `highlight` editorial layer (titles/photos/captions), footnote citations ("most accurate" brand), Old Style date handling, and computed person attributes (ages, zodiacs, generations) that generate entire page families for free.
4. **Weddings+divorces with both partners' ages and "Fun Facts" are cheap differentiators** they exploit well; **country-lens "today" pages** (US/UK/CN/AU) are a smart geo-SEO play worth copying and extending.
5. **Gaps a competitor can exploit**: no public API or embeddable widgets (a free "on this day" widget/API = link-building weapon they refuse to use); no user accounts/personalization ("on this day in your life", birthday twin finder, date-difference/age tools); no visible per-entry social sharing; ancient/modern coverage but no apparent maps, timelines, or interactive visualizations; topic taxonomy covers entertainment/sport deeply but **general history has NO topic layer** (no WWII/Vietnam/Space/Disasters topic pages found — the History channel is date-organized only) → a history-topic taxonomy (wars, disasters, space, science, crime…) is an open flank.
6. **Monetization is programmatic ads** (DoubleClick + 1,727-partner CMP); alternative revenue (API licensing, premium widgets, print-on-demand "day you were born") is unexploited.
7. **They are litigious about scraping** (robots.txt blocks all major AI bots; Cloudflare challenge on every new session) — build original data or license it (Wikipedia/Wikidata, Britannica, NYT archive) rather than scraping them.
8. **Content ops signal**: small evergreen editorial team produces Articles + Photos + weekly Quiz that interlink with the entry graph — a competitor needs the same "editorial spine" (weekly quiz, daily featured article) to earn return visits beyond SEO landings.

---

## Citations

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
[^17^]: https://www.onthisday.com/search.php — search form + index links (Calendar `/calendar.php`, Dates `/dates-by-year.php`, People `/famous-people.php`, Articles `/articles.php`, Photos `/photos/`, Quiz `/quiz/`)
[^18^]: https://www.onthisday.com/robots.txt — AI-bot blocklist, disallowed paths, no sitemap
[^19^]: https://www.onthisday.com/people/johannes-kepler — person profile URL (linked; anatomy not verified)
[^20^]: Kaggle dataset "226,209 Events From onthisday.com" (Events, Birthdays, Deaths, Weddings; as of 2022-06-28) — via https://www.selectdataset.com/dataset/057611ee4ac2fed10f2b992a4d9171d1
[^21^]: https://nichefacts.com/days/ — third-party note on onthisday.com structure (categories: history, film & TV, music, sport + months/years/days)

*Verification note: quiz mechanics, calendar widget, article/person/photo page bodies, fun-facts page, search-results rendering, deaths-by-month URLs, and any API/widget offerings could not be verified live due to Cloudflare rate-limiting (403/timeouts) after ~25 page fetches; all such items are marked [NOT VERIFIED] above and are inferred only from observed links/modules.*
