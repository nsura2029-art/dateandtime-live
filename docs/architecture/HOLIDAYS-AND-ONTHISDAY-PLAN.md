# Holidays + OnThisDay expansion plan (2026-07-19)

## Scope

User asked: build out holidays for ALL countries + religion-specific (Christian, Jewish, Muslim, Hindu, etc.) + make onthisday country-specific with famous people, events, birthdays, sports, etc. — show one pill on home, full browse on dedicated pages.

## What we have today

- 880 holiday rows from Nager.Date (15 countries × 5 years)
- 50 curated onthisday events (US-centric, no category breakdown)
- 9 endpoints sitting in postman collection but not exposed
- `holidays` table has: country_code, name, date, type, source, etc.
- **Missing**: religion column, observance level, wiki URL, description
- **Missing**: onthisday country/religion/category filters

## What we're adding

### A) Schema expansions (migration 010)

**`holidays` table**:
- `religion` TEXT — `christian | jewish | muslim | hindu | buddhist | sikh | jain | bahai | chinese | secular | national | observance`
- `observance_type` TEXT — `public_holiday | bank_holiday | school_holiday | observance | optional | flag_day | unofficial`
- `wikipedia_url` TEXT
- `description` TEXT
- `translations` TEXT (JSON: {lang: name})

**`onthisday_events` table** (rebuild — was 50 rows, 5 cols):
- `id` PK
- `month`, `day` (recurring annually)
- `year` (specific year of event, NULL for recurring)
- `category` — `event | birth | death | holiday | sports | art | science | politics | disaster | discovery | treaty | space`
- `subcategory` — `olympics | world_cup | election | battle | treaty | invention | expedition | first_flight | nobel | grammy | oscar`
- `country_codes` (JSON array, NULL = global)
- `religion` (same enum as holidays)
- `title` (short headline)
- `description` (1-2 sentences)
- `importance` (1-5, for ranking)
- `wikipedia_url`
- `image_url` (optional, from Wikimedia Commons)
- `source` (wikipedia | curated | computed)
- `created_at`

Indexes: `(month, day)`, `(category)`, `(year)` (for searches by year)

### B) Data sources (seed scripts)

1. **Nager.Date** (free, no auth) — Christian, secular, national holidays for 100+ countries
   - Currently 15 countries; expand to **80+ countries** (top 80 by population + all G20 + EU + GCC)
   - Add `religion='christian'|'secular'|'national'` based on holiday name heuristics + country lookup table

2. **Hebrew calendar (computed)** — Jewish holidays for any year
   - Deterministic algorithm: Rosh Hashanah, Yom Kippur, Sukkot, Hanukkah, Purim, Passover, Shavuot, Tisha B'Av
   - Country filter: IL, US, AR, BR, CA, FR, GB, ZA, AU, RU + Jewish diaspora countries

3. **Hijri calendar (computed)** — Muslim holidays
   - Eid al-Fitr, Eid al-Adha, Ramadan start, Mawlid, Isra and Mi'raj, Ashura
   - Country filter: ~50 Muslim-majority countries (SA, EG, IR, TR, ID, PK, BD, NG, etc.)

4. **Hindu festivals (curated list)** — 30+ major Hindu festivals
   - Diwali, Holi, Navratri, Dussehra, Raksha Bandhan, Janmashtami, Ganesh Chaturthi, Maha Shivaratri, etc.
   - Most are lunar; some are solar-fixed
   - Country filter: IN, NP, LK, BT, MU, ID (Bali), MY, SG, GB (diaspora)

5. **Buddhist holidays (computed + curated)** — Vesak, Magha Puja, Asalha Puja, etc.
   - Country filter: TH, LK, MM, KH, LA, BT, NP, MM, JP, KR, CN, SG, MY

6. **Sikh holidays** — Vaisakhi, Guru Nanak Jayanti, etc.
   - Country filter: IN (Punjab), GB, CA, US

7. **Jain holidays** — Mahavir Jayanti, Paryushana
   - Country filter: IN (Gujarat/Rajasthan), US, GB

8. **National days (curated)** — for all 242 countries
   - Independence Day, Republic Day, National Day, etc.
   - Cross-referenced with `countries.capital` and history

### C) OnThisDay data sources

1. **Wikipedia "On this day" archive** — manually curated from
   https://en.wikipedia.org/wiki/July_19 (and every other month/day)
   - Target: **500+ events** across all 366 days, with strong coverage of:
     - Famous births (top 100 historical figures, 1-2 per day)
     - Famous deaths (top 100)
     - Major historical events (50-100 total)
     - Sports milestones (Olympics, World Cup, Super Bowl, World Series)
     - Space exploration (Apollo, SpaceX, etc.)
     - Scientific discoveries/inventions
     - Music/album/film releases (iconic ones)
   - Country-tagged where possible

2. **Sports data (curated)**:
   - Olympics: every summer/winter games since 1896
   - FIFA World Cup: every final + iconic matches
   - Super Bowl: all 50+ games
   - World Series, NBA Finals, Champions League
   - Cricket World Cup finals

3. **Famous birthdays (curated)**:
   - Top 100 historical figures (Einstein, Curie, da Vinci, etc.)
   - Each gets a `birth` event on their birth month/day
   - Importance 4-5 for iconic figures

### D) API endpoints (build all)

```
GET /api/v1/holidays/today?country=US
GET /api/v1/holidays/upcoming?country=US&limit=5
GET /api/v1/holidays/year/{year}?country=US
GET /api/v1/holidays/range?country=US&start=2026-07-19&end=2026-07-26
GET /api/v1/holidays/religion/{religion}?year=2026
GET /api/v1/holidays/countries
GET /api/v1/holidays/religions
GET /api/v1/holidays/search?q=christmas&country=US

GET /api/v1/onthisday?month=7&day=19
GET /api/v1/onthisday/today?country=US
GET /api/v1/onthisday/range?start=2026-07-19&end=2026-07-26
GET /api/v1/onthisday/categories
GET /api/v1/onthisday/{id}
GET /api/v1/onthisday/search?q=einstein&type=birth

GET /api/v1/calendar/{year}?country=US   (full year with all holidays)
GET /api/v1/calendar/{year}/{month}?country=US   (single month)
```

### E) Home page pill (one)

Smart selection on `https://dateandtime.live/home`:
- If today is a public holiday in user's country: **"Today: Christmas Day"** (red/green themed)
- Else if a public holiday is in next 7 days: **"Next: Diwali in 3 days"**
- Else: **"On this day: 1969 — Apollo 11 lands on the moon"** (uses onthisday)

The pill shows:
- Icon (holiday, birthday, event, sports)
- Title (truncated)
- "in N days" or "today" badge
- Hover tooltip: full description + Wikipedia link

### F) Dedicated pages (browse all)

1. **`/today`** — full page of today's data
   - Today's holidays (all countries user-relevant)
   - On this day (top 5 events + famous birthdays)
   - Upcoming holidays (next 7 days)
   - Today's saint/patron day (if applicable)

2. **`/calendar`** — interactive year calendar
   - All 12 months at a glance
   - Each day shows the holiday(s) + observances
   - Click a day to see the full detail

3. **`/calendar/{year}`** — same, for any year

4. **`/holidays`** — browse by country/religion
   - Filter by country, religion, type
   - Sort by date / importance / name

5. **`/onthisday`** — browse history
   - Today + yesterday + 7-day carousel
   - Category filters (events, births, deaths, sports, etc.)
   - Search box

6. **`/religion/{slug}`** — religion-specific view
   - /religion/christian, /religion/jewish, /religion/muslim, /religion/hindu
   - All holidays for that religion, any country

## Execution order

**Phase 1** (data model + Christian + secular bulk): 1-2 days
- Migration 010 (schema expansion)
- Expand Nager.Date seed from 15 to 80 countries
- Tag existing rows with religion

**Phase 2** (computed holidays: Jewish, Muslim): 1 day
- Hebrew calendar algorithm (Python)
- Hijri calendar algorithm (Python)
- Seed scripts

**Phase 3** (curated holidays: Hindu, Buddhist, Sikh, Jain): 1 day
- Static lists + dates
- Seed scripts

**Phase 4** (OnThisDay bulk: 500+ events): 1-2 days
- Migration 011
- Curated seed data (events, births, deaths)
- Sports subcategory
- Country tags

**Phase 5** (API endpoints): 1 day
- Add 20 new endpoints to `index.ts` / `deferred-routes.ts`
- Test against dev D1

**Phase 6** (Home page pill): 1 day
- Update home page JS to fetch + render the smart pill
- Handle 3 cases: today/holiday, upcoming, onthisday
- Style: same pastel pill as other features

**Phase 7** (Dedicated pages): 2-3 days
- /today, /calendar, /holidays, /onthisday, /religion/*
- Static HTML pages served by the Worker (with API calls)
- SEO: title, meta, JSON-LD, internal links

**Total**: ~7-10 days focused work

## Tradeoffs

- **Computed holidays (Jewish, Muslim)** are deterministic — no manual entry needed
- **Hindu/Buddhist** have some lunar-based dates — need a small algorithm + curated offset table
- **Nager.Date** is free but limited coverage (top 100 countries, mostly Christian/secular)
- **Calendarific** is paid — skip for now
- **OnThisDay** can't fully automate Wikipedia scraping (against ToS for bulk) — curated approach with 500+ entries covers the long tail
