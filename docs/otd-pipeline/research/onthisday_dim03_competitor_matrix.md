# Competitor Feature Matrix — "On This Day in History" Products

**Mission:** Map exactly what competitors of onthisday.com offer, feature by feature, filter by filter, to inform a competing product.
**Method:** Live browsing of each competitor (July 2026), plus app-store/web research for mobile leaders. 8 web competitors + mobile app leaders covered. onthisday.com itself (the baseline) was Cloudflare-blocked to automated browsing; its content types are corroborated from a public scrape dataset and flagged where inferred.
**Confidence:** High for everything observed live; marked `[inferred]` otherwise.

---

## 1. Competitor Profiles

### 1.1 Britannica — "On This Day / Today in History" [^1^]
- **Content types:** Historical events, births, deaths — all merged into one reverse-chronological daily timeline (e.g., "1817 — Jane Austen … died … at age 41"; "1921 — John Glenn … was born"). Featured Event + Featured Biography at top. No weddings, no holidays.
- **Filters & navigation:** Date switcher (per-day pages, e.g. July 18/19); "What Happened On Your Birthday?" tool [^1^]; no category/country/profession filters on the page itself.
- **Unique features:** Every entry deep-links into Britannica encyclopedia articles AND to related quizzes/lists ("Sort fact from fiction in our WWII quiz", "10 greatest baseball players"); newsletter signup; Games & Quizzes hub; AI chatbot; Britannica Premium upsell.
- **Data source model:** Pure editorial — written/curated by Britannica editors from the encyclopedia.
- **Monetization:** Britannica Premium subscription (prominent SUBSCRIBE), newsletter list-building.
- **UX strengths:** Clean, authoritative, great cross-linking that keeps users on-site; age-at-death and context in-line.
- **UX weaknesses:** Few items per day (~7–10); no faceted filtering; no multimedia beyond one photo per item.

### 1.2 History.com (HISTORY Channel / A+E) — "This Day in History" [^2^]
- **Content types:** Events (multiple stories/day with estimated read times, e.g. "1:30 m read") and "Born on This Day" (photo cards with mini-bios, e.g. Degas, Brian May, Benedict Cumberbatch). Deaths not a dedicated section. Coverage spans politics, war, crime, pop culture.
- **Filters & navigation:** Date picker (per-day URLs `/this-day-in-history/july-19`); site topic hubs double as category filters: U.S., World, Eras & Ages, Culture, Science & Innovation; site search.
- **Unique features:** Video archive tie-in (HISTORY videos, shows); "This Day in History" daily email newsletter; free HISTORY profile accounts; HISTORY Vault SVOD upsell; HISTORY Education, HISTORY Apps, HISTORY en Español, Military HISTORY brand extensions; "Timeline" and "History Every Day" modules.
- **Data source model:** Editorial (A+E Networks staff historians/producers).
- **Monetization:** Display ads (heavy), HISTORY Vault subscription, TV-Everywhere streaming (play.history.com), email acquisition.
- **UX strengths:** Strong visuals and celebrity-birthday cards; read-time labels; deep story pages per event.
- **UX weaknesses:** Ad-heavy; US-centric; no deaths/weddings; category hubs are site-wide, not combinable with the date view.

### 1.3 BBC — "On This Day" (news.bbc.co.uk/onthisday, archived) [^3^][^4^]
- **Content types:** News events only, each page an original BBC news report as it broke (archive roughly 1950–2005; site frozen, ©2008). No birthday/death lists except via the Royalty theme ("Births, Marriages & Deaths").
- **Filters & navigation:** The richest taxonomy of any competitor:
  - By date (day + month dropdowns, prev/next day);
  - By **Years** index;
  - By **Themes** — 8 top-level themes with ~60 subcategories: Conflict & War (by region + WWII), Crime & Punishment (murders, bombings, kidnapping, assassinations, trials…), Science & Technology (space, discoveries), Politics & Protest UK (elections, scandal, industrial disputes…), Disaster & Tragedy (natural, rail, air, sea, disease, fire, sporting), Lifestyle/Sport/Entertainment (football, Olympics, TV & radio, film, music, celebrities, "Silly Season"), World Politics (cold war, summits, independence movements, US presidents), Royalty, Society (race, religion, health, education, environment…) [^4^];
  - **Witness** — user-contributed memories by theme.
- **Unique features:** Original AV archive (video/audio clips inside stories); "Witness memories" community layer; "This Week" top stories; theme compilations (e.g., WWII "stories as they broke"); RSS feed; low-bandwidth text-only version.
- **Data source model:** Editorial archive (BBC News reports) + community (Witness submissions).
- **Monetization:** None — public service, preserved as archive.
- **UX strengths:** Unmatched archival authenticity ("read the news as it was reported") and the best theme taxonomy in the space.
- **UX weaknesses:** Dated 2008 UI, no longer updated (nothing after ~2005–08), UK-centric, no birthdays/deaths/ages, themes not combinable with dates.

### 1.4 timeanddate.com — "On This Day" [^5^]
- **Content types:** Events (~5/day, expandable `<details>` blurbs), Births, Deaths — plus **Holidays observed on this date worldwide** (e.g., "Martyrs' Day, Myanmar", "Sandinista Revolution Day, Nicaragua").
- **Filters & navigation:** Month + day picker with full calendar grid URLs (`/on-this-day/july/19`); "Create Calendar" tool (year/month + **country selector covering ~240 countries**); entries expandable inline.
- **Unique features:** Only competitor that joins "on this day" history to a **country-aware holiday database**; custom printable calendar creation; plugs into its ecosystem (world clock, calendars, astronomy).
- **Data source model:** Aggregated short editorial blurbs + proprietary holiday database.
- **Monetization:** Display ads; account/premium ecosystem upsell.
- **UX strengths:** Fast, scannable, no-click expand/collapse; holiday-by-country angle nobody else has.
- **UX weaknesses:** Thin depth (~5 items/section/day, no images, no source links); no categories; no video; utilitarian design.

### 1.5 Famous Birthdays (famousbirthdays.com) — birthday-focused leader [^6^][^13^]
- **Content types:** Celebrity birthdays ONLY — actors, musicians, world leaders, and crucially **social-media creators** (TikTok/YouTube stars). Lifespans shown for the dead ("Nelson Mandela (1918–2013)"); current age auto-computed for the living ("Vin Diesel, 59"). Trending and Most Popular charts. No events, no deaths section.
- **Filters & navigation:** Today's Birthdays / Tomorrow's Birthdays (per-date URLs like `/july18.html`); popular; trending; video; trivia; random person; profession tag on every card (Movie Actor, Rapper, TikTok Star…); site search (by name, birthdate, birthplace, profession, associated shows) [^13^].
- **Unique features:** Gamified popularity: users "boost" stars, driving live trending scores; trivia games (Who Am I, Guess Their Age, Who Ranks Higher, Who Played Me, Name That Cast); **mobile app with birthday reminders/notifications** [^13^]; age calculation everywhere.
- **Data source model:** Community-driven (user-submitted bios + popularity votes, editorially moderated) — scales far beyond editorial teams.
- **Monetization:** Display ads; app (ad/IAP ecosystem).
- **UX strengths:** Highly engaging, social, gamified, Gen-Z-relevant; profession tags; real-time charts.
- **UX weaknesses:** Zero historical-event content; community data has accuracy/credibility issues; no educational depth or sourcing.

### 1.6 On-This-Day.com (hyphenated — different company from onthisday.com) [^7^]
- **Content types:** Events ("Misc. History"), Famous Birthdays, Music History, War History, U.S. History, TV History, Sports History, Daily Quotes. Deaths appear within day pages/topic pages (e.g., "Crime, Death and Disasters").
- **Filters & navigation:** Separate mini-calendar per content vertical (misc/music/birthdays each get month grids); large library of **topic sub-sites**: U.S. states (Texas…Wyoming), U.S. Presidents, wars (Revolution, Civil War, WWI, WWII, Vietnam), music artists (Beatles, Elvis, Prince, Michael Jackson), Star Wars, crime/disasters; search; mobile version.
- **Unique features:** **Content feeds/syndication** (`on-this-day.com/feeds`) — sells/gives daily-history content to other websites; daily quotes engine; niche vertical depth no generalist matches.
- **Data source model:** Aggregated/editorial, small-team curated.
- **Monetization:** Display ads (PixFuture), affiliate commerce (eBay magnets), feed syndication/licensing.
- **UX strengths:** Broadest vertical sprawl (music-by-day, TV-by-day, state history) and a B2B syndication angle.
- **UX weaknesses:** Extremely dated static-HTML UX; deaths/weddings thin; no images/video, no personalization.

### 1.7 Library of Congress — "Today in History" (loc.gov/collections/today-in-history) [^8^][^9^]
- **Content types:** One featured historical event per day as a **long-form essay illustrated with primary sources** from LOC digital collections (period newspapers, manuscripts, photos — e.g., July 19 = Seneca Falls Convention with 1848 newspaper scan and convention report). No births/deaths/holidays.
- **Filters & navigation:** Per-date pages (`/item/today-in-history/july-19/`); browsable by date; searchable by topic via LOC search; collection-level browse.
- **Unique features:** "Learn More" curated reading paths with search tips into LOC collections; essays fact-checked and updated by reference librarians; "Ask a Librarian" help; running since April 1997 (American Memory program).
- **Data source model:** Editorial/archival — American Memory Program staff + Researcher & Reference Services.
- **Monetization:** None (U.S. federal government).
- **UX strengths:** Deepest trust/sourcing in the space; genuine primary documents; great for educators.
- **UX weaknesses:** Only ONE event per day; US-centric; no birthdays/deaths; no video; minimal interactivity or personalization.

### 1.8 Mobile app leaders
- **Histoday (iOS/Android)** [^10^]: Daily curated events feed; **10 smart categories (Science, Politics, Arts, War, Sports, Crime, Religion, etc.) with per-category colors + 20 thematic tags; interest-based personalization; AI-powered summaries and "Ask AI" history chat; Daily Quiz with streaks & leaderboard; "Time Travel Mode" (What-If alternate histories + immersive Story Mode); smart push notifications; favorites/collections; calendar explorer for any date.** Freemium: free = 10 events/day; Premium $15/year unlocks unlimited events, AI features, calendars, leaderboard, no ads. 15K+ downloads, 4.5★.
- **"On This Day — Today in history" (Android, Wikipedia-based)** [^11^]: Events/births/deaths cards with featured-article links; date picker; **group events by century**; 6 Wikipedia languages; ads + IAP.
- **"Today in History" (iOS, established version)** [^12^]: Daily bite-sized facts; $9.99 one-time + optional $1.99/mo Pro; free clones exist.
- **"Historical Calendar" (Android only)** [^12^]: Search ANY date (birthdays/anniversaries); photos for most events; free with ads, one-time ad removal.
- **Famous Birthdays app** [^13^]: see 1.5 — trivia games, boosts, birthday reminders, profession/birthplace search.
- **HISTORY Channel app + HISTORY Vault** [^2^][^12^]: TV/doc streaming; Vault ~$5.99/mo.

### 1.9 Adjacent / baseline
- **datesandevents.org** [^14^]: Not date-based; static **timelines of people/places/events for students & kids** (US-heavy: WW2, Civil War, immigration timelines), blank-timeline creator tool; ads; run by Siteseen Ltd. Shows the education/SEO long-tail end of the market.
- **onthisday.com (BASELINE the new product competes with):** blocked to bots during research (Cloudflare 403). Corroborated via a 226,209-record public scrape: content types = **Events, Birthdays, Deaths, Weddings** [^15^]. Site structure `[inferred, high confidence]`: per-day pages with category sections (general events, film/TV, music, sport), plus year and "born on this day" browsing; monetization via display ads. Treat baseline cells as medium confidence.

---

## 2. MASTER COMPARISON MATRIX

Legend: ✅ = yes/core, 🟡 = partial/limited, ❌ = no, ? = unverified.

| # | Feature / Filter | Britannica | History.com | BBC On This Day | timeanddate | Famous Birthdays | On-This-Day.com | LOC Today in History | Mobile apps (Histoday et al.) | onthisday.com (baseline) |
|---|---|---|---|---|---|---|---|---|---|---|
| **CONTENT TYPES** |
| 1 | Historical events | ✅ curated timeline | ✅ multi-story/day | ✅ original news reports | ✅ ~5/day | ❌ | ✅ | ✅ 1 essay/day | ✅ | ✅ |
| 2 | Famous births | ✅ in timeline + featured bio | ✅ "Born on This Day" cards | 🟡 royalty only | ✅ | ✅ core product | ✅ | ❌ | ✅ | ✅ |
| 3 | Deaths | ✅ in timeline (w/ age at death) | 🟡 not a section | 🟡 royalty only | ✅ | 🟡 lifespan label only | 🟡 in day/topic pages | ❌ | ✅ | ✅ |
| 4 | Weddings / divorces | ❌ | ❌ | 🟡 royal marriages theme | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ [^15^] |
| 5 | Holidays / observances | ❌ | ❌ | ❌ | ✅ by country | ❌ | ❌ | ❌ | 🟡 (National Day Calendar apps) | 🟡 ? |
| 6 | Sports history | 🟡 inside events | 🟡 inside events | ✅ theme (Sport, Football, Olympics) | 🟡 inside events | ❌ | ✅ dedicated vertical | 🟡 occasional | ✅ category | ✅ `[inferred]` |
| 7 | Music history | 🟡 inside events | 🟡 inside events | ✅ theme | 🟡 inside events | 🟡 musicians' birthdays | ✅ dedicated vertical + artist sub-sites | 🟡 occasional | 🟡 | ✅ `[inferred]` |
| 8 | Film / TV history | 🟡 inside events | 🟡 inside events | ✅ theme (Film, TV & Radio) | 🟡 inside events | 🟡 actors' birthdays | ✅ TV History vertical | 🟡 occasional | 🟡 | ✅ `[inferred]` |
| 9 | Quotes of the day | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ dedicated engine | ❌ | ❌ | 🟡 ? |
| 10 | Primary sources / archival docs | ❌ | 🟡 photos (Getty) | ✅ original reports + AV clips | ❌ | ❌ | ❌ | ✅ best-in-class | ❌ | ❌ |
| 11 | Video content | ❌ | ✅ shows/clips/Vault | ✅ archive clips | ❌ | ✅ video section | ❌ | ❌ | 🟡 (History app) | 🟡 ? |
| **FILTERS & NAVIGATION** |
| 12 | Browse by date (day/month) | ✅ | ✅ | ✅ dropdowns | ✅ calendar grid | ✅ today/tomorrow | ✅ per-vertical calendars | ✅ | ✅ calendar explorer | ✅ |
| 13 | Browse by year | ❌ | ❌ | ✅ Years index | ❌ | ❌ | 🟡 topic pages | ❌ | 🟡 via date search | ✅ `[inferred]` |
| 14 | Category / topic filters | ❌ (site sections only) | 🟡 hubs: U.S./World/Eras/Culture/Science | ✅ ~60 subcategories in 8 themes | ❌ | 🟡 profession tags | ✅ topic sub-sites | 🟡 topic search | ✅ 10 categories + 20 tags | ✅ `[inferred]` |
| 15 | Country / region filter | ❌ | 🟡 U.S./World hubs | 🟡 regions within War theme | ✅ 240-country holiday picker | ❌ | 🟡 U.S. states | 🟡 US-focused | ❌ | 🟡 ? |
| 16 | Profession filter | ❌ | ❌ | ❌ | ❌ | ✅ tag on every card + search | ❌ | ❌ | ❌ | 🟡 ? |
| 17 | Century grouping | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ ("On This Day" app) | ❌ |
| 18 | Free-text search | ✅ site search | ✅ | ✅ | 🟡 site search | ✅ name/date/place/profession | ✅ | ✅ LOC search | ✅ | ✅ |
| 19 | Timeline / chronological view | ✅ reverse-chron day list | ✅ "Timeline" module | 🟡 date pages | ❌ | ❌ | ❌ | ❌ | ✅ feed/calendar | ✅ |
| **UNIQUE FEATURES** |
| 20 | "What happened on YOUR birthday" lookup | ✅ tool | ❌ | ❌ | 🟡 via date picker | 🟡 via date pages | 🟡 via calendar | ❌ | ✅ | ✅ `[inferred]` |
| 21 | Live age calculation | ❌ | 🟡 birth–death years | ❌ | ❌ | ✅ signature feature | ❌ | ❌ | 🟡 | ✅ `[inferred]` |
| 22 | Quizzes / trivia | ✅ cross-linked per item | ❌ | ❌ | ❌ | ✅ 5 game modes | ❌ | ❌ | ✅ daily quiz, streaks, leaderboard | 🟡 ? |
| 23 | Email newsletter | ✅ | ✅ "This Day in History" | 🟡 RSS instead | ❌ | ❌ | ❌ | ❌ | 🟡 push notifications | ✅ `[inferred]` |
| 24 | Native mobile app | ❌ | ✅ HISTORY apps/Vault | ❌ | ❌ | ✅ | 🟡 mobile site only | ❌ | ✅ core product | ✅ `[inferred]` |
| 25 | RSS / feeds / API / syndication | ❌ | ❌ | ✅ RSS | ❌ | ❌ | ✅ content feeds for webmasters (B2B) | ❌ | ❌ | 🟡 widgets `[inferred]` |
| 26 | User accounts / personalization | 🟡 Britannica login | ✅ free HISTORY profile | ❌ | 🟡 My Account | 🟡 app boosts | ❌ | ❌ | ✅ interests, favorites, collections | ❌ ? |
| 27 | Community contributions | ❌ | 🟡 "Share Your Opinions" | ✅ Witness memories | ❌ | ✅ submissions + votes | ❌ | ❌ | 🟡 | ❌ |
| 28 | AI features | 🟡 site chatbot | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ AI summaries + Ask AI chat + What-If mode | ❌ |
| 29 | Custom calendar / printable creation | ❌ | ❌ | ❌ | ✅ signature tool | ❌ | ❌ | ❌ | 🟡 calendar explorer | ❌ |
| 30 | Gamification (streaks, boosts, leaderboards) | ❌ | ❌ | ❌ | ❌ | ✅ boosts/trending | ❌ | ❌ | ✅ streaks/leaderboard | ❌ |
| **DATA & BUSINESS** |
| 31 | Data model | Editorial | Editorial | Editorial archive + community | Aggregated blurbs + holiday DB | Community + moderation | Small-team aggregated | Editorial/archival (librarians) | Wikipedia/Wikidata + AI | Aggregated/editorial |
| 32 | Monetization | Premium subs, newsletter | Ads, Vault SVOD, streaming | None (public service) | Ads, premium ecosystem | Ads, app | Ads, affiliate, feed licensing | None (gov) | Freemium subs ($15/yr), IAP, ads | Ads |
| 33 | Update cadence | Daily, current | Daily, current | Frozen (~2008 archive) | Daily, current | Daily, real-time trending | Daily, current | Daily (evergreen essays) | Daily, personalized | Daily, current |
| 34 | Language reach | English | EN + ES (en Español) | English | English | English | English | English | Multi (6 Wikipedia langs on one app) | English |

---

## 3. GAP ANALYSIS — what NOBODY does well (opportunities)

1. **Faceted, combinable filtering on the web.** The best taxonomy (BBC's ~60 subcategories) can't be crossed with date; app categories (Histoday) can't be crossed with country/profession. Nobody offers `date × category × country × profession/era` faceted search. **#1 structural opening.**
2. **Weddings/anniversaries.** Only the baseline (onthisday.com) covers weddings/divorces; none of the 8 profiled competitors do. Celebrity + historical weddings are unserved by every "quality" brand.
3. **Anniversary math at scale.** Famous Birthdays computes current ages, but nobody surfaces "**50 years ago today**", "**X would have turned 100 today**", or centenary/milestone lenses across events. Cheap to build, high emotional hook.
4. **Trustworthy + flexible.** Authoritative sources (Britannica, LOC, BBC) are shallow in filters; flexible sources (apps) run on unvetted Wikipedia/Wikidata. **Curated, cited data with modern faceted UX is wide open.**
5. **Global / non-Western coverage.** Every competitor is US/UK-centric (LOC and History.com explicitly American; BBC UK). Non-Western history-by-date, local-language dates, and "on this day in [country]" for >20 countries is unserved; timeanddate's country holiday picker proves the demand pattern.
6. **Holidays ↔ history integration.** Only timeanddate shows holidays-by-date, but with zero historical context. Nobody explains a holiday's historical origin in the daily view.
7. **Multimedia + faceting together.** BBC has the AV archive but a frozen 2008 UI and no date×theme cross-filter; History.com has video but siloed from filters. A modern video-rich, filterable daily product doesn't exist.
8. **Developer/B2B access.** On-This-Day.com's feeds are the only syndication play, and they're legacy-HTML. A clean **REST/JSON API, embeddable widgets, and white-label daily-history feed** is unoccupied by any credible brand.
9. **Rich deaths/obits.** Deaths are a bare list everywhere (or absent). Nobody offers "died on this day" with obituary context, legacy notes, or "on this day we lost…" storytelling.
10. **Personalization on the open web.** Interest-based feeds, saved collections, and streaks exist only inside Histoday's paywalled app. No major website personalizes "on this day" (e.g., "more music, less war").
11. **Social/shareable artifacts.** Nobody generates share-ready cards ("On the day you were born…"), year-in-review date pages, or embeddable "today" badges — a natural viral loop the baseline leaves unused.
12. **Education tooling.** LOC is educator-friendly but passive; datesandevents shows SEO demand from students. Lesson-ready daily history (standards-aligned, printable, quiz-generating) is unserved by a modern product.

## 4. BEST-IN-CLASS PER FEATURE (who to benchmark)

| Feature | Best in class | Why |
|---|---|---|
| Editorial authority & cross-linking | **Britannica** | Encyclopedia deep-links + quiz tie-ins on every item [^1^] |
| Primary-source depth | **LOC Today in History** | Real 1848 newspapers/manuscripts; librarian fact-checking [^8^][^9^] |
| Archival video/audio | **BBC On This Day** | Original broadcasts as they broke [^3^] |
| Category taxonomy | **BBC Themes** | 8 themes / ~60 subcategories [^4^] |
| Celebrity birthdays + engagement | **Famous Birthdays** | Age calc, boosts, trending charts, trivia, reminders app [^6^][^13^] |
| Holidays-by-country | **timeanddate** | 240-country holiday picker + custom calendars [^5^] |
| Niche verticals & B2B feeds | **On-This-Day.com** | Music/TV/war/state sub-sites; syndication feeds [^7^] |
| Modern mobile UX / AI / gamification | **Histoday** | AI summaries, Ask-AI, What-If mode, quiz streaks, $15/yr [^10^] |
| Century grouping & multi-language | **"On This Day" Android app** | Century grouping; 6 Wikipedia languages [^11^] |
| Video streaming monetization | **History.com** | Vault SVOD funnel from daily content [^2^] |
| Weddings/divorces coverage | **onthisday.com (baseline)** | Only player with the category [^15^] |
| Community data sourcing | **Famous Birthdays** | User submissions + votes scale the DB [^6^] |

**Bottom line for a challenger:** combine Famous Birthdays' engagement mechanics, BBC-grade taxonomy, Britannica/LOC-grade sourcing, timeanddate's country awareness, and Histoday's AI/personalization in ONE web-first product — then add what none have: faceted filtering, weddings, anniversary-milestone lenses, holiday-origin stories, and a public API/widgets.

---

## Citations
[^1^]: https://www.britannica.com/on-this-day (live browse, incl. July 18/19 daily timeline with births/deaths and quiz cross-links)
[^2^]: https://www.history.com/this-day-in-history (live browse of /this-day-in-history/july-19: Born on This Day cards, read-time stories, U.S./World/Eras & Ages/Culture/Science & Innovation hubs, newsletter, Vault/apps/education footer)
[^3^]: http://news.bbc.co.uk/onthisday (front page: date search, Years/Themes/Witness nav, This Week, RSS, text-only)
[^4^]: http://news.bbc.co.uk/onthisday/hi/themes/default.stm (full theme taxonomy, ~60 subcategories)
[^5^]: https://www.timeanddate.com/on-this-day/ (events/births/deaths expandables, date grid, Create Calendar with 240-country selector, holidays-on-this-date)
[^6^]: https://www.famousbirthdays.com/ (today/tomorrow birthdays, ages, profession tags, trending scores, popular/video/trivia/random)
[^7^]: https://on-this-day.com/ and /mobile and /feeds (vertical calendars: Misc/Music/Birthdays; topic sub-sites; quotes; feeds)
[^8^]: https://www.loc.gov/collections/today-in-history/about-this-collection/ (editorial model, since April 1997, fact-checked by reference staff)
[^9^]: https://www.loc.gov/item/today-in-history/july-19/ (Seneca Falls essay with primary-source images + Learn More)
[^10^]: https://histoday.app/ (features, 10 categories, AI, quiz, Time Travel, pricing $15/yr premium, 15K+ downloads)
[^11^]: https://on-this-day.en.aptoide.com/app ("On This Day" Android: births/deaths, century grouping, 6 Wikipedia languages, ads/IAP)
[^12^]: https://nibble-app.com/blog/best-apps-to-learn-history (Today in History app $9.99 + $1.99/mo Pro; Historical Calendar Android, free w/ ads; HISTORY Vault $5.99/mo)
[^13^]: https://mwm.ai/apps/famous-birthdays/646707938 (Famous Birthdays iOS app: trivia games, boosts, reminders, search by profession/birthplace)
[^14^]: https://www.datesandevents.org/ (timelines for students/kids; people/places/events; timeline creator)
[^15^]: https://www.kaggle.com/datasets/draculax/226209-events-from-onthisdaycom (scrape of onthisday.com: "Events, Birthdays, Deaths, Weddings", 226,209 records, June 2022 — baseline content-type evidence)

*Note on baseline: www.onthisday.com returned Cloudflare 403 to automated access on research day; cells marked `[inferred]` rely on citation [^15^] plus general knowledge and should be verified manually before final product decisions.*
