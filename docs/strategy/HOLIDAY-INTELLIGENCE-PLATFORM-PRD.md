# Holiday Intelligence Platform — Product Requirements Document

**Status:** Draft v1.0 (2026-07-19)
**Author:** Mavis (Product/UX/SEO/Architecture synthesis)
**For:** dateandtime.live → expand from time tools into a Holiday Intelligence Platform
**Horizon:** 24 months (3 phases × 8 weeks each)

---

## 0. Executive Summary

dateandtime.live is currently a **time-tool utility** with a strong technical foundation (Cloudflare Workers + D1, 33,945 cities, 242 countries, 408 IANA timezones, 1,614 holidays across 39 countries, 540 OnThisDay events, real-time Cloudflare IP geolocation, FTS5 search with aliases, 12+ live API endpoints).

To become the **world's best Holiday Intelligence Platform** (not just another timeanddate clone), we must:

1. **Own the long-tail SEO** that timeanddate.com is too broad to serve well
2. **Win developer mindshare** with the best free, religion-aware holiday API
3. **Be the planning layer** for remote teams, HR, payroll, travel, and finance
4. **Monetize via API + B2B**, not ads (timeanddate already won the ad game)

The moat: **richest religion + business + market-closure data** + **the fastest, most beautiful UI** + **free tier generous enough to displace Nager.Date**.

---

## 1. Deep Research — Competitive Landscape

### 1.1 Direct Competitors

| Site/API | Traffic | Revenue Model | Strengths | Gaps We Can Exploit |
|---|---|---|---|---|
| **timeanddate.com** | **65M visits/mo** (Sep 2025), 404K organic keywords | Ads + premium API ($99–$999/yr) | 230+ countries, comprehensive UI, 50-year authority | UI is dense, ad-heavy, no religion filter, no AI, no free API |
| **Office Holidays** | ~5M visits/mo | Ads | Clean per-country pages, 50 countries | 50 countries only, no API, no observances, ad-cluttered |
| **Calendarpedia** | ~10M visits/mo | Ads | Free Excel templates, printable calendars | 30 countries, no API, no live data |
| **PublicHolidays.com** | <1M visits/mo | Ads | Simple country list | Outdated data, no API, no search |
| **Calendar Labs** | <500K visits/mo | AdSense | Free tools | Tiny catalog, no religion, no observances |
| **Nager.Date** | Open source (no traffic) | Free | Open source, 119 countries, Europe-strong | No UI, no Asia/Africa, no observances, no religion |
| **Calendarific** | <500K visits/mo (B2B) | API ($100–$4,000/yr) | Best B2B API, 230+ countries | $100/yr minimum, 1K/day free limit, no religion filter |
| **HolidayAPI.com** | <100K visits/mo | API (~$199/yr) | Established | Free tier is historical-only, narrow coverage |
| **World Data API** | <100K visits/mo | API ($79/yr) | Bundles business day calculations | Smaller brand, less coverage detail |

### 1.2 Timeanddate.com — Anatomy of the Market Leader

**Top organic keywords (US, Sep 2025):**
- `timer` — 3.35M vol/mo, $0.41 CPC → 0.75% of their traffic
- `stopwatch` — 1.22M vol/mo
- `calendar 2025` — 550K vol/mo
- `2025 calendar` — 450K vol/mo
- `date calculator` — 450K vol/mo, $1.13 CPC
- `sunset today` — 450K vol/mo
- `time` — 11.1M vol/mo (rank #8)
- `world clock` — 175K vol/mo, $1.83 CPC

**Audience:** 54.6% male, 25–34 yo, US 39% / India 8.9% / UK 7.3% / Australia 7.2% / Canada 5.4%
**Traffic sources:** 45.7% direct, 43.1% Google organic, <1% paid
**Bounce rate:** 70% (high — utilitarian intent)

**Our wedge:** timeanddate owns `calendar`, `timer`, `date calculator`. We can't beat them head-on. But:
- 65% of their 404K keywords are long-tail ("is X open on Y") — we can win with 33,945 city pages
- Their holidays section is 1 of 50+ tools — we can be **the** dedicated holiday platform
- They have 230+ countries but no religion filter, no observances tier, no AI

### 1.3 Travel, Productivity, HR, Finance, Logistics, Government

**Common thread across all verticals:** they need a reliable, structured source of "is X open/closed on Y" data, with country/region precision, and ideally a machine-readable API.

| Vertical | Pain Point | Use Case |
|---|---|---|
| **HR / Payroll** (BambooHR, Rippling, Deel) | Manual entry of country holidays; errors = late paychecks | API to fetch per-country calendar at onboarding |
| **Remote Teams** (Deel, Remote.com) | 50+ countries, each with its own holiday set; one source of truth | Cross-country comparison: "when is Germany closed vs US?" |
| **Finance** (NYSE, NASDAQ, BSE) | Stock exchange holidays differ from public holidays | Side-by-side calendar: "is NYSE closed but LSE open today?" |
| **Logistics** (UPS, FedEx, DHL) | Need to know pickup/delivery availability | "Will DHL be operating on Diwali in India?" |
| **Banking** (Fed Reserve, ACH) | Settlement delays; SWIFT cutoffs | "What's the next business day in Japan?" |
| **Government** (embassies, DMVs, tax offices) | Closure days != public holidays | "Is the German embassy open on Reformation Day?" |
| **Travel** (Booking, Expedia) | Hotel/flight demand spikes around holidays | "Best week to fly to Tokyo in 2026" |
| **Productivity** (Google Cal, Outlook) | Users manually add holidays | Native integrations + ICS export |

**The hidden gap:** none of these verticals have a **single API that combines public holidays + market closures + banking holidays + school holidays + observances + business hours** in one request.

---

## 2. User Personas & Jobs To Be Done

### 2.1 Primary Personas

| Persona | Profile | Core JTBD | Frequency |
|---|---|---|---|
| **Maya, Remote Worker** | 32, US, works async with EU + APAC team | "Is my German colleague off on Monday?" | Daily |
| **Arjun, HR Operations** | 41, India, global payroll lead at 500-person startup | "Send me all 2026 holidays for every country we operate in" | Quarterly |
| **Sofia, Travel Planner** | 28, Mexico, solo traveler planning 2026 | "What's the cheapest time to fly to Japan (avoid Golden Week)?" | Monthly |
| **David, Trader** | 45, NY, manages global portfolio | "Is LSE open while NYSE is closed on Monday?" | Daily |
| **Priya, Wedding Planner** | 34, India, multireligious weddings | "Is Eid or Diwali first in 2026? What about client availability?" | Per project |
| **Liam, Developer** | 29, Berlin, building fintech app | "I need 50K holiday API calls/month, JSON, no attribution" | One-time + ongoing |
| **Yuki, Expat Family** | 38, Japan → Berlin, kids in school | "When are school holidays in Berlin 2026?" | Quarterly |
| **Aisha, Retail Buyer** | 42, US, gift retailer | "When's Diwali 2026? Mother's Day Japan?" | Seasonal |

### 2.2 The 20 Most Common Jobs To Be Done (in order of search volume)

1. "Is today a holiday in [country]?" — **8M+ vol/mo globally** ("is today a holiday")
2. "What are the public holidays in [country] in [year]?" — **2.4M vol/mo** ("holidays in [country] [year]")
3. "When is [holiday] this year?" — **2.7M vol/mo** ("when is [holiday]")
4. "What holidays are coming up?" — 600K vol/mo ("upcoming holidays")
5. "Is the stock market open today?" — 200K vol/mo
6. "Is the bank open today?" — 90K vol/mo
7. "Long weekends in [year] [country]" — 80K vol/mo
8. "How to maximize PTO in [year]" — 60K vol/mo
9. "What holidays are observed in [state/region]?" — 40K vol/mo
10. "School holidays in [country] [year]" — 35K vol/mo
11. "Printable calendar [country] [year]" — 30K vol/mo
12. "ICS calendar import [country]" — 25K vol/mo
13. "Working days calculator" — 50K vol/mo
14. "Next business day" — 40K vol/mo
15. "Holiday in [religion] on [date]" — 20K vol/mo
16. "Are banks open on [date]?" — 18K vol/mo
17. "Post office / DHL / FedEx closed on [date]?" — 12K vol/mo
18. "API to check if today is a holiday" — developer intent, no good free option
19. "List of religious holidays in [year]" — 15K vol/mo
20. "Compare holidays between [country A] and [country B]" — under-served long-tail

---

## 3. Feature Inventory (Phased)

### 3.1 Phase 1 — Foundation (8 weeks)

**Already shipped (foundation):**
- ✅ 33,945 cities, 242 countries, 408 IANA tz
- ✅ 1,614 holidays across 39 countries × 5 years
- ✅ 540 OnThisDay events (10 categories)
- ✅ 8 religion-specific global holidays (Christian, Jewish, Muslim, Hindu, Buddhist, Sikh, Jain, secular)
- ✅ 12+ API endpoints (`/api/v1/holidays/*`, `/api/v1/onthisday/*`, `/api/v1/religions`)
- ✅ FTS5 search with diacritics + aliases
- ✅ Cloudflare IP geolocation for auto-detect
- ✅ SEO-friendly URL structure (`/holidays/`, `/onthisday/`, `/home/`)

**To ship in Phase 1 (4–6 weeks):**

| Module | Feature | Why |
|---|---|---|
| Country holidays | **7-tier "Show" filter** (Public only → All + global observances) | Match timeanddate's UX, reduce overwhelm |
| Country holidays | **Sub-national holidays** (US states, Indian states, German Bundesländer) | Big moat — no free API does this well |
| Country holidays | **Multi-language holiday names** (10 languages: en, es, fr, de, hi, ar, zh, ja, pt, ru) | 4× addressable market |
| Country holidays | **Working day calculator** (`isWorkingDay(tz, date)`) | Top JTBD, no free API |
| Country holidays | **Next business day** / **Add N business days** | Critical for finance, payroll |
| Calendar | **Printable PDF calendar** per country/year | Top 10 SEO feature, monetizable lead magnet |
| Calendar | **ICS export** for Apple/Google/Outlook | Frictionless, top of funnel |
| Calendar | **Long weekend finder** (highlight 3+ day weekends) | Massive 2026 search trend ("long weekend 2026") |
| Calendar | **PTO optimizer** ("use 4 PTO days → 10 days off") | Viral, "pto maxxing" is a 2026 trend |
| OnThisDay | **540 → 2,000+ events** with Wikipedia enrichment | Match competitors' depth |
| OnThisDay | **Births / deaths / sports / science / culture** filter | 11 categories already |
| SEO | **/holidays/[country]/[year]/[holiday-slug]** pages | Programmatic SEO, 50K+ URLs |
| SEO | **/holidays/[country]/[state]/[year]/** for sub-national | 5M+ URLs possible |
| SEO | **/onthisday/[month]/[day]/[event-slug]** pages | 366 × ~10 events = 3,660 pages |
| AI | **Holiday chatbot** ("When is the next long weekend in Germany?") | Timeanddate has none, first-mover |
| API | **Free API tier** (10K calls/month, no attribution) | Beat Nager.Date on terms |
| API | **Religion filter** (`?religion=hindu&country=US`) | Unique differentiator |
| API | **GraphQL endpoint** | Modern developer expectation |

### 3.2 Phase 2 — Intelligence Layer (8 weeks)

| Module | Feature |
|---|---|
| Markets | **NYSE / NASDAQ / LSE / BSE / TSE** trading holidays + early closes |
| Markets | **Settlement calendars** (T+1, T+2) per exchange |
| Markets | **Forex market hours** (Sydney/Tokyo/London/NY sessions) |
| Banks | **Fed Reserve / ECB / RBI / BoE / BoJ** rate decision days + bank holidays |
| Banks | **ACH / SWIFT / Wire** cut-off times + holiday delays |
| Travel | **School calendars** (US K-12, UK, India CBSE, Germany, France) |
| Travel | **Embassy / consulate closures** by country |
| Travel | **Visa application office closures** (Schengen, US, UK) |
| Logistics | **UPS / FedEx / DHL / USPS** holiday schedules + delivery delays |
| Retail | **Black Friday / Cyber Monday / Singles' Day / Diwali sale** dates |
| Developer | **Webhooks** (notify when holiday added for a country) |
| Developer | **SDKs** (JS, Python, Go, Ruby, PHP) |
| Developer | **Embeddable widgets** ("next public holiday" badge) |
| Widgets | **Holiday countdown widget** (drop-in for any site) |
| Widgets | **Today is a holiday** banner |
| Widgets | **Long weekend calendar** (for newsletters) |
| Integrations | **Google Calendar** add-on |
| Integrations | **Slack / Teams** slash command (`/holiday [country] [date]`) |
| Integrations | **Zapier / Make.com** triggers |
| Premium | **Email digest** ("next 7 days in your countries") |

### 3.3 Phase 3 — Enterprise & AI (8 weeks)

| Module | Feature |
|---|---|
| AI | **Predictive travel impact** ("Thanksgiving 2026: expect 3.2× airport traffic") |
| AI | **Crowd forecasting** for major tourist sites |
| AI | **Demand forecasting** for e-commerce (Black Friday lift predictions) |
| AI | **Anomaly detection** (sudden holiday declarations) |
| Enterprise | **Team holiday calendar** (multi-country, multi-timezone) |
| Enterprise | **PTO conflict detection** (team is in 3 different countries, who's working?) |
| Enterprise | **Payroll cutoff calculator** (when to submit to hit next pay period) |
| Enterprise | **Custom holidays** (your company's internal holidays layered on top) |
| Enterprise | **SSO + SCIM** (Okta, Azure AD) |
| Enterprise | **Audit logs** (for SOX compliance) |
| Enterprise | **Slack / Teams** native apps |
| Enterprise | **Custom webhooks** with retry + DLQ |
| Mobile | **Native iOS / Android** (React Native) |
| Mobile | **Apple Watch / Wear OS** complications |
| Mobile | **Push notifications** ("Germany is on holiday tomorrow") |
| Data | **Premium data export** (CSV / Parquet / Snowflake share) |
| Data | **Webhook stream** of government holiday declarations worldwide |
| Data | **Historical archive** (1950–2026) for back-testing |

---

## 4. Information Architecture & Sitemap

```
dateandtime.live/
├── /                                  (current landing — frozen, "Good Night" hero)
├── /home/                             (current /home — SEO-friendly hero with pills)
├── /holidays/                         (NEW — hub)
│   ├── /holidays/[country]/            (NEW — per-country)
│   │   ├── /[year]/                   (NEW — per-year)
│   │   │   ├── /                      (full year grid)
│   │   │   ├── /[month]/              (month view)
│   │   │   └── /[holiday-slug]/       (deep link, "Christmas Day 2026 in US")
│   │   ├── /state/[state]/[year]/     (sub-national, US states, IN states)
│   │   ├── /religion/[religion]/      ("Hindu holidays in US")
│   │   ├── /long-weekends/            (all long weekends in 2026)
│   │   ├── /pto-optimizer/            (interactive tool)
│   │   ├── /printable/                (PDF generator)
│   │   └── /ics/                      (ICS download)
│   ├── /compare/                      ("US vs UK holidays 2026")
│   └── /business/                     (working day calculator, settlement)
├── /onthisday/                        (existing — already shipped)
│   ├── /[month]/[day]/                (existing)
│   ├── /category/[cat]/               ("births in July", "sports in 2026")
│   └── /person/[slug]/                ("Albert Einstein born 1879")
├── /markets/                          (NEW — Phase 2)
│   ├── /nyse/, /nasdaq/, /lse/, /bse/, /tse/
│   └── /holidays/, /early-closes/, /settlement/
├── /banks/                            (NEW — Phase 2)
│   ├── /federal-reserve/, /ecb/, /rbi/
├── /travel/                           (NEW — Phase 2)
│   ├── /embassies/, /visa/, /schools/
├── /api/                              (NEW — developer portal)
│   ├── /docs, /pricing, /playground
│   ├── /changelog, /status
│   └── /dashboard
├── /widgets/                          (NEW — embeddable)
│   ├── /holiday-countdown, /today-holiday, /next-holiday
├── /blog/                             (NEW — content marketing)
│   ├── /2026-holiday-calendar-[country]/
│   ├── /long-weekends-2026/
│   ├── /pto-maxxing-2026/
│   └── /best-time-visit-[country]-2026/
└── /about/, /pricing/, /contact/
```

**URL slug strategy:** `[country]` = ISO 3166-1 alpha-2 lowercase (`us`, `in`, `de`). Holiday slugs = lowercase-hyphenated English names. This matches existing top performers in Google.

---

## 5. Data Model (Evolutionary)

### 5.1 Current Schema (shipped)

```sql
cities (33,945 rows), city_aliases, countries (242), timezones (408),
states, holidays (1,614), holiday_rules, business_calendars,
onthisday_events (540), country_religions (179), data_sources,
import_history, data_quality_checks, feedback
```

### 5.2 Phase 1 Additions

```sql
-- Granular tier system (matches timeanddate's 7-tier filter)
ALTER TABLE holidays ADD COLUMN tier TEXT DEFAULT 'public_holiday';
-- Values: 'public' | 'bank' | 'school' | 'weekday_swap' |
--         'religious' | 'observance_major' | 'observance_common' |
--         'observance_other' | 'fun'
ALTER TABLE holidays ADD COLUMN importance INTEGER DEFAULT 3;
-- 1=fun, 2=observance, 3=normal, 4=important, 5=critical

-- Sub-national holidays
ALTER TABLE holidays ADD COLUMN region_code TEXT;  -- e.g. 'US-CA', 'IN-MH', 'DE-BY'
ALTER TABLE holidays ADD COLUMN city_id INTEGER REFERENCES cities(geoname_id);

-- Multi-language
ALTER TABLE holidays ADD COLUMN translations TEXT;  -- JSON {"es": "...", "fr": "...", "hi": "..."}

-- Working day data
CREATE TABLE working_days (
  cca2 TEXT NOT NULL,
  region_code TEXT,
  date TEXT NOT NULL,
  is_working INTEGER NOT NULL,           -- 0/1
  is_half_day INTEGER DEFAULT 0,
  half_day_close_hour INTEGER,           -- 13 = 1pm ET
  reason TEXT,                           -- 'public_holiday' | 'weekend' | 'bank_holiday' | 'weekday_swap'
  source TEXT,
  PRIMARY KEY (cca2, region_code, date)
);

-- Long weekends (precomputed for SEO + PTO optimizer)
CREATE TABLE long_weekends (
  cca2 TEXT NOT NULL,
  region_code TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  total_days_off INTEGER NOT NULL,       -- 3, 4, 5...
  pto_days_required INTEGER NOT NULL,    -- 0, 1, 2...
  holidays_involved TEXT,                -- JSON array of holiday ids
  year INTEGER NOT NULL,
  PRIMARY KEY (cca2, region_code, start_date, year)
);

-- OnThisDay expansion (Wikipedia data + curated)
ALTER TABLE onthisday_events ADD COLUMN wikipedia_extract TEXT;
ALTER TABLE onthisday_events ADD COLUMN image_url TEXT;
ALTER TABLE onthisday_events ADD COLUMN coordinates TEXT;  -- JSON [lat, lon] if location-based
```

### 5.3 Phase 2 Additions

```sql
-- Market exchanges
CREATE TABLE exchanges (
  id TEXT PRIMARY KEY,                    -- 'NYSE', 'NASDAQ', 'LSE', 'BSE', 'TSE'
  name TEXT, country_code TEXT, currency TEXT,
  timezone TEXT, regular_open TEXT, regular_close TEXT,
  pre_market_open TEXT, after_hours_close TEXT
);

CREATE TABLE market_holidays (
  exchange_id TEXT REFERENCES exchanges(id),
  date TEXT NOT NULL, type TEXT,           -- 'closed' | 'early_close' | 'half_day'
  close_time TEXT, name TEXT, source TEXT,
  PRIMARY KEY (exchange_id, date)
);

-- School calendars (per district/state)
CREATE TABLE school_calendars (
  id INTEGER PRIMARY KEY,
  cca2 TEXT, region_code TEXT, district TEXT,
  school_name TEXT, grade_level TEXT,    -- 'k-12', 'university'
  academic_year INTEGER,
  breaks TEXT                              -- JSON {type, start, end}
);

-- Logistical closures
CREATE TABLE logistics_calendars (
  carrier TEXT,                            -- 'UPS', 'FedEx', 'DHL', 'USPS'
  cca2 TEXT, date TEXT,
  closure_type TEXT, name TEXT
);
```

### 5.4 Phase 3 Additions

```sql
-- Custom holidays (Enterprise tier)
CREATE TABLE custom_holidays (
  org_id TEXT NOT NULL,
  date TEXT NOT NULL, name TEXT, type TEXT,
  regions TEXT, employees TEXT,           -- JSON
  recurring TEXT,                          -- RRULE
  PRIMARY KEY (org_id, date, name)
);

-- Predictive data
CREATE TABLE travel_impact_predictions (
  holiday_id INTEGER, year INTEGER,
  airport_code TEXT, predicted_passenger_increase REAL,
  predicted_delay_minutes INTEGER, confidence REAL
);

-- Audit logs
CREATE TABLE enterprise_audit (
  org_id TEXT, user_id TEXT, action TEXT,
  resource TEXT, timestamp INTEGER,
  ip_address TEXT, metadata TEXT
);
```

---

## 6. API Design (REST + GraphQL)

### 6.1 REST Endpoints (v1 + v2)

```
# Existing (already shipped)
GET  /api/v1/cities
GET  /api/v1/cities/:id
GET  /api/v2/search?q=
GET  /api/v1/countries
GET  /api/v1/timezones
GET  /api/v1/time/now
GET  /api/v1/time/sun
GET  /api/v1/holidays/today
GET  /api/v1/holidays/upcoming
GET  /api/v1/holidays?year=&country=&religion=&tier=
GET  /api/v1/holidays/religion/:religion
GET  /api/v1/holidays/search?q=
GET  /api/v1/religions
GET  /api/v1/countries/:cca2/religions
GET  /api/v1/calendar/:year/:month
GET  /api/v1/onthisday?month=&day=
GET  /api/v1/onthisday/today
GET  /api/v1/onthisday/range
GET  /api/v1/onthisday/categories
GET  /api/v1/dst/upcoming
GET  /api/v1/cities/:id/climate
GET  /api/v1/cities/:id/aliases
GET  /api/v1/countries/:cca2/working-hours
GET  /api/v1/countries/:cca2/cities
GET  /api/v1/admin/data-quality
POST /api/v1/feedback
GET  /api/v1/feedback/top

# Phase 1 new (4 weeks)
GET  /api/v1/working-day?country=&date=        # is it a working day?
GET  /api/v1/business-day?country=&date=       # alias with more detail
GET  /api/v1/next-business-day?country=&date=&n=1
GET  /api/v1/long-weekends?country=&year=       # precomputed long weekends
GET  /api/v1/holidays/:id                       # deep link (SEO)
GET  /api/v1/holidays/compare?a=US&b=DE&year=   # side-by-side
GET  /api/v1/holidays/csv?country=&year=        # download
GET  /api/v1/holidays/ics?country=&year=        # ICS download

# Phase 2 new
GET  /api/v1/markets/:id/holidays?year=
GET  /api/v1/markets/:id/early-closes?year=
GET  /api/v1/banks/:cca2/holidays?year=
GET  /api/v1/schools/:id/calendar?year=
GET  /api/v1/logistics/:carrier/:cca2?year=
GET  /api/v1/embassies/:source/:target/closures

# Phase 3 new
POST /api/v1/enterprise/holidays                # custom holidays
GET  /api/v1/predict/travel-impact?holiday_id=
POST /api/v1/webhooks                            # subscribe
```

### 6.2 GraphQL (Phase 1)

```graphql
type Query {
  country(cca2: String!): Country
  holidays(
    country: String, region: String,
    year: Int, month: Int, day: Int,
    religion: Religion, tier: HolidayTier,
    includeObservances: Boolean = false,
    limit: Int = 100, offset: Int = 0
  ): [Holiday!]!
  workingDay(country: String!, date: String!): WorkingDay!
  nextBusinessDay(country: String!, after: String!, n: Int = 1): String!
  onThisDay(month: Int!, day: Int!, category: Category): [Event!]!
  longWeekends(country: String!, year: Int!): [LongWeekend!]!
  exchanges: [Exchange!]!
  exchange(id: String!): Exchange
}

enum Religion { CHRISTIAN JEWISH MUSLIM HINDU BUDDHIST SIKH JAIN BAHAI SECULAR }
enum HolidayTier { PUBLIC BANK SCHOOL RELIGIOUS OBSERVANCE_ALL }
enum Category { EVENT BIRTH DEATH POLITICS DISCOVERY SPORTS SCIENCE ART }
```

### 6.3 Authentication

```
# Free tier: no auth, 10K req/day per IP, CORS
# Pro tier: API key, 1M req/month, dedicated support
# Enterprise: API key + IP allowlist, custom quotas, SLA

Authorization: Bearer <api_key>
X-Rate-Limit-Remaining: 9985
X-Rate-Limit-Reset: 1690000000
```

---

## 7. UI/UX Specifications

### 7.1 Design Principles (differentiated from timeanddate)

1. **Speed first** — every page loads <500ms, no janky ads, no third-party scripts
2. **Religion-aware by default** — first-class filter, not a buried sub-menu
3. **Country-first, not tool-first** — timeanddate shows a sea of tools; we lead with "what's the time + holidays" because that's 80% of intent
4. **Beautiful on mobile** — 60%+ of our audience will be mobile
5. **Dark mode by default** for power users (PTO optimizers, traders)
6. **AI-narrated, not AI-replaced** — show data first, then offer a "ask AI" button

### 7.2 The Holiday Country Page (the most important page)

**URL:** `/holidays/us/2026/`

**Above the fold:**
- Big H1: "United States Holidays 2026"
- Subhead: "All federal, state, and religious holidays observed in the United States. 11 public holidays, 247 observances, last updated 2026-07-19."
- 7-tier "Show" dropdown: `[All holidays and national/global observances ▾]`
- Year switcher: `[2024] [2025] [2026✓] [2027] [2028]`
- 4 quick action pills: `[Print PDF] [.ics] [Compare] [PTO optimizer]`
- Stats card: "11 public · 1 religious · 7 observances · 247 total"

**Calendar grid (main view):**
- 12 mini-months, each with public holidays as red dots, observances as gold dots
- Click any day → opens a sheet with full details, "Add to calendar" button, "share" link
- Long weekends highlighted with a blue background (1 click to "Book PTO for this")
- Hover on a day shows tooltip with holiday name

**List view (toggle):**
- Sortable by date, name, religion, importance
- Each row: [date] [name] [religion badge] [type badge] [importance ★] [Wikipedia link] [+ Add to calendar]
- Filter pills: [All] [Public] [Bank] [School] [Religious] [Observances] [Long weekends only]

**Right rail (or below on mobile):**
- "Next 30 days in US" — chronological list of upcoming holidays with countdown badges
- "Long weekends in 2026" — top 5 long weekends with "Book 1 PTO → 4 days off" callouts
- "Compare with: [🇬🇧 UK] [🇩🇪 Germany] [🇮🇳 India]" — side-by-side
- "Download: [PDF] [Excel] [ICS] [CSV]"

**Bottom of page (SEO content):**
- "About US public holidays" — long-form article (~1,500 words)
- "Holidays by state" — links to /holidays/us/state/ca/2026/, /ny/, /tx/, etc.
- "Holidays by religion" — Christian, Jewish, Muslim, Hindu, Buddhist, Sikh holidays observed in US
- FAQ (5–8 questions)
- Related: "2026 calendar", "long weekends 2026", "PTO calculator 2026"

### 7.3 The OnThisDay Page

**URL:** `/onthisday/july/19/`

- H1: "On This Day — July 19"
- Subhead: "3 major events · 2 births · 0 deaths today in history"
- Category filter: [All] [Events] [Births] [Deaths] [Sports] [Politics] [Science] [Culture]
- Cards (sorted by importance): each with year, category badge, country flags, title, description, Wikipedia link, "share" button
- "Today in your country" — events filtered by user's detected country, with national flag badges

### 7.4 The PTO Optimizer (Phase 1 flagship tool)

**URL:** `/holidays/us/pto-optimizer/`

- Step 1: "How many PTO days do you have?" — slider 0–40
- Step 2: "Country" — pre-filled from IP
- Step 3: "Year" — current + next year
- Step 4: "Strategy" — [Maximize total days off] [Concentrate in summer] [Spread evenly] [Concentrate around holidays]
- Output: gold/silver/bronze ranked plans, each showing exact dates to take off, total days off, visualization as a year calendar
- Export to ICS / Google Cal

### 7.5 Component Library (reuse existing + new)

- `CityCard` (existing)
- `TimePill` (existing)
- `HolidayRow` (NEW)
- `LongWeekendCard` (NEW)
- `PtoPlanCard` (NEW)
- `ReligionBadge` (NEW)
- `EventCard` (existing pattern)
- `CountryPicker` (NEW — searchable, with flags)
- `YearSwitcher` (NEW)
- `TierSelector` (NEW)
- `PrintCalendarButton` (NEW)
- `AddToCalendarButton` (NEW)
- `LanguageSwitcher` (NEW)

---

## 8. SEO Strategy

### 8.1 Keyword Universe (8 priority clusters)

| Cluster | Search Volume (monthly) | Competition | Page Type | Count |
|---|---|---|---|---|
| `[holiday name] 2026 date` | 18M+ total | Low | /holidays/[country]/[year]/[slug]/ | 200 pages × 195 countries = 39,000 |
| `holidays in [country] [year]` | 2.4M | Med-High | /holidays/[country]/[year]/ | 195 × 5 = 975 |
| `is today a holiday` | 8M | High | /home/ (current page answers it) | 1 |
| `is [date] a holiday` | 12M | Low | /onthisday/[month]/[day]/ | 366 |
| `long weekend [year] [country]` | 80K | Low | /holidays/[country]/[year]/long-weekends/ | 195 × 5 = 975 |
| `pto optimizer [year]` | 60K | Med | /holidays/[country]/[year]/pto-optimizer/ | 195 × 5 = 975 |
| `is [business] open on [date]` | 200K | Low | /markets/[exchange]/[date]/ + /banks/[cca2]/[date]/ | thousands |
| `[country] school holidays [year]` | 35K | Med | /travel/schools/[country]/[year]/ | 195 × 5 = 975 |

**Total addressable URL inventory:** ~50,000 programmatic SEO pages at launch, ~500,000 by end of Phase 2.

### 8.2 Programmatic SEO Template

```html
<!-- /holidays/[country]/[year]/[holiday-slug]/ -->
<title>[Holiday Name] [Year] in [Country] — Date, History, Working Day Impact</title>
<meta name="description" content="[Holiday Name] is on [Date] in [Country]. [Day of week]. [Working day?]. Banks closed? Government offices? Schools? Get the full picture plus 5 fascinating facts and related holidays." />
<h1>[Holiday Name] [Year] in [Country]</h1>
<p>Last updated [date] · 1,200 words of original content per page</p>

<!-- Schema.org Holiday markup -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Holiday",
  "name": "Christmas Day",
  "alternateName": "[translations]",
  "date": "2026-12-25",
  "country": {"@type": "Country", "name": "United States", "identifier": "US"},
  "description": "...",
  "sameAs": "https://en.wikipedia.org/wiki/Christmas"
}
</script>
```

### 8.3 Internal Linking Strategy

Every page links to:
- **Sibling holidays** (same country, same year)
- **Same holiday, other countries** (e.g., "Christmas Day in Germany")
- **Same religion, all countries** ("All Hindu holidays")
- **Related tools** (PTO optimizer, printable, ICS)
- **Current date** (cross-link from /home/ to /onthisday/today/)
- **Next/prev year** (2025 ↔ 2026 ↔ 2027)

Hub-and-spoke: `/holidays/[country]/` is the hub, individual holidays are spokes. `/onthisday/` is the second hub.

### 8.4 AI Search Optimization (GEO)

Per ChatGPT/Perplexity best practices:
- **Clear factual claims** with sources cited
- **Structured data** on every page (Holiday, Event, Country, Organization, FAQ)
- **Canonical, factual answers** at the top of every page (the "answer block" before the rich content)
- **Date in title + meta** (helps AI cite "as of [date]")
- **Wikipedia outbound links** (the #1 source AI tools cite)
- **FAQ section** with 5–8 questions per page

### 8.5 Link Building Strategy

- **Submit to** Open Data registries (Wikidata, data.gov, data.world)
- **Submit to** Awesome lists (awesome-public-datasets, awesome-holiday-apis)
- **Guest post** on HR, payroll, remote-work, travel blogs
- **Be the source** for journalists ("We tracked 8,000+ holiday declarations worldwide in 2025")
- **Embeddable widgets** (other sites link back when they use them)
- **Free data export** to universities, NGOs, research projects

---

## 9. Monetization Strategy

### 9.1 Revenue Streams (ranked by potential)

| Stream | Year 1 | Year 2 | Year 3 | Notes |
|---|---|---|---|---|
| **Display ads** (ethical) | $50K | $300K | $1M | Only on /home/ and /holidays/[country]/ — never on the holy data pages |
| **API Pro** ($100/yr) | $20K | $200K | $500K | 1M calls/month, no attribution, premium data |
| **API Business** ($500/yr) | $30K | $150K | $400K | 10M calls/month, weekly updates, all languages |
| **API Enterprise** ($4K+/yr) | $20K | $200K | $800K | Custom SLAs, dedicated support, on-prem options |
| **B2B SaaS** (HR/payroll) | $0 | $100K | $500K | Team holiday calendar, SSO, custom holidays, webhooks |
| **Affiliate** (booking.com) | $0 | $50K | $200K | "Best time to visit [country]" pages link to hotels |
| **Premium content** (annual reports) | $0 | $20K | $100K | "Global Holiday Trends Report 2027" — $99 PDF |
| **Printable/PDF** (premium) | $0 | $30K | $100K | $5/mo for unlimited custom-branded printable calendars |
| **Sponsored data** (e.g. "Visa Inc. — 2026 Holiday Calendar") | $0 | $50K | $200K | Banks, airlines, governments pay for branded versions |
| **Total** | **$120K** | **$1.1M** | **$3.8M** | Year 1 = launch + traction, Year 2 = scale, Year 3 = moat |

### 9.2 Pricing Tiers (API)

| Tier | Price | Calls/mo | Attribution | Languages | Updates | SLA |
|---|---|---|---|---|---|---|
| **Free** | $0 | 10,000 | Required (link in docs) | English only | Quarterly | None |
| **Pro** | $100/yr | 1,000,000 | None | All 10 | Quarterly | 99% |
| **Business** | $500/yr | 10,000,000 | None | All 10 | Weekly | 99.9% |
| **Enterprise** | $4,000+/yr | 50,000,000+ | None | All 10 + custom | Daily | 99.99% + dedicated |

**Why this works:** Nager.Date is free but has no Asia/Africa, no observances, no religion. Calendarific is $100/yr minimum. Our free tier (10K/mo) is 20× Nager.Date's documented throughput, with no attribution required for non-commercial. We'll steal Nager.Date's developer mindshare in 6 months.

### 9.3 What We Don't Do

- ❌ No email harvesting
- ❌ No push notifications without opt-in
- ❌ No dark patterns (urgency, scarcity, "X people are viewing")
- ❌ No paywall on the core country pages
- ❌ No selling user data
- ❌ No ads on the API or data pages

---

## 10. Technical Architecture (Scaling to 1B req/month)

### 10.1 Current Stack (shipped)

- **Edge:** Cloudflare Workers (4 Workers: prod API, dev API, prod landing, dev landing)
- **DB:** D1 (SQLite at the edge, 5,081 cities, 242 countries, 408 IANA tz, 1,614 holidays, 540 OnThisDay)
- **Storage:** KV for cache, R2 for assets (flag PNGs)
- **Frontend:** Vanilla HTML + JS (no framework, fast TTI)
- **DNS:** Cloudflare
- **Email routing:** Pending (waiting for Zone Resources token)

### 10.2 Phase 1 Architecture (5x scale)

- **Edge:** Same Workers, add Workers Analytics Engine for usage tracking
- **DB:** D1 reads/writes, R2 for data exports (CSV/Parquet)
- **Cache layer:** Cloudflare Cache API for `/api/v1/holidays` (24h TTL, key = country+year+religion+tier)
- **Search:** FTS5 already in D1 (no need for Algolia)
- **Auth:** Cloudflare Access for /api/v1/dashboard, JWT for API keys
- **PDF generation:** Cloudflare Browser Rendering API (Workers + headless Chrome)
- **Image optimization:** Cloudflare Images for flag PNGs (responsive, WebP)
- **Analytics:** Cloudflare Web Analytics (free, no cookies = GDPR compliant)

### 10.3 Phase 2 Architecture (10x scale, multiple regions)

- **Add:** Workers for Markets (NYSE/BSE etc.) — separate Worker for compliance isolation
- **Add:** Durable Objects for per-org custom holiday calendars (Enterprise tier)
- **Add:** Queues for webhook delivery (Workers + Queues + DLQ)
- **Add:** R2 for static assets, ICS exports
- **Add:** D1 read replicas (when D1 supports them, announced 2025)

### 10.4 Phase 3 Architecture (Enterprise scale)

- **Add:** Workers VPC for connecting to enterprise customers' internal systems
- **Add:** Vectorize for AI semantic search ("when is the next big celebration in India?")
- **Add:** Workers AI for predictive models (travel impact, crowd forecasting)
- **Add:** Hyperdrive for connecting to enterprise Postgres/Oracle/SAP backends

### 10.5 Performance Budget

- **TTFB:** <200ms globally (Cloudflare edge)
- **LCP:** <1.5s (no third-party scripts, inlined critical CSS)
- **CLS:** <0.1 (fixed dimensions on all images, no late-loading ads)
- **JS payload:** <50KB gzipped on landing pages
- **API response time:** <100ms p99 (cached) / <300ms p99 (uncached)
- **Uptime:** 99.9% (Cloudflare SLA)

### 10.6 Accessibility (WCAG 2.1 AA)

- All color contrast 4.5:1+
- Full keyboard navigation
- Screen reader optimized (aria-labels, semantic HTML)
- prefers-reduced-motion respected
- No flashing >3Hz
- Form labels explicit
- Live regions for time updates (announce every minute, not every second)
- Date format toggle (ISO vs locale)

### 10.7 Internationalization (i18n)

10 launch languages, ordered by market size:
1. English (en) — default
2. Spanish (es) — 500M speakers, 20 countries
3. French (fr) — 300M speakers, 29 countries
4. German (de) — 100M speakers, 6 countries
5. Hindi (hi) — 600M speakers, India primary
6. Arabic (ar) — 400M speakers, RTL
7. Mandarin (zh) — 1.1B speakers
8. Japanese (ja) — 125M speakers
9. Portuguese (pt) — 250M speakers, Brazil primary
10. Russian (ru) — 150M speakers

Holiday names get translated. UI gets translated. URLs stay English (`/holidays/india/2026/`) for SEO.

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **timeanddate builds religion filter** | Med | High | We move first; we own the long-tail of 33,945 cities |
| **Calendarific drops price to $0** | Low | High | We have religion + observances tier; they don't |
| **Nager.Date adds more countries** | Med | Med | We have UI + religion + AI; they're API-only |
| **D1 query limits** at scale | Med | Med | Cache + R2 exports + read replicas (when available) |
| **Lunar date calculation errors** (Hijri, Hebrew) | Med | High | Cross-validate with HebCal + Aladhan + local community sources |
| **Wikipedia API rate limits / ToS changes** | Med | Med | Cache aggressively; supplement with curated data |
| **Government changes holidays last-minute** | High | Low | Daily cron refresh; user notifications (webhooks) |
| **Sub-national data is too big** (India has 28 states) | Med | Med | Phase 1.5: top 50 states, expand based on search demand |
| **PDF generation is slow** | Med | Med | Use Cloudflare Browser Rendering (serverless Chromium) |
| **No dev team for content** | Med | High | AI-assisted content generation + 1 human editor |
| **Ad blocker adoption kills display ad revenue** | High | Med | Diversify to API + B2B + affiliate |
| **Competitor buys top SEO keywords via Google Ads** | Med | Med | Our SEO moat grows over time; paid ads are short-term |

---

## 12. Implementation Backlog (Prioritized)

### Now (Week 1–2) — Foundation Polish

1. **Apply 7-tier "Show" filter** to `/api/v1/holidays` (DB migration + endpoint)
2. **Backfill tier + importance** for all 1,614 existing holidays
3. **Add `/api/v1/working-day?country=&date=` endpoint** — is it a working day?
4. **Add `/api/v1/next-business-day?country=&date=&n=1`** — next working day
5. **Add `/api/v1/long-weekends?country=&year=` endpoint** — precomputed
6. **Update `/holidays/` page** with the 7-tier dropdown + working day badges
7. **Add `?tier=public_holiday|bank_holiday|school_holiday|observance_major|observance_common|observance_other` filter** to /api/v1/holidays
8. **Multi-language holiday names** for top 10 languages (use Nager.Date's translations field — already in their data)

### Next 2 weeks (Week 3–4) — Long Weekend + PTO

9. **Build `/holidays/[country]/[year]/long-weekends/`** page
10. **Build `/holidays/[country]/[year]/pto-optimizer/`** interactive tool
11. **Add ICS export endpoint** `/api/v1/holidays/ics?country=&year=` (RFC 5545)
12. **Add CSV download endpoint** `/api/v1/holidays/csv?country=&year=`
13. **Add JSON download endpoint** (just `Accept: application/json` on /holidays?country=&year=)
14. **Build `/holidays/[country]/[year]/[holiday-slug]/` deep links** (programmatic SEO)

### Next 4 weeks (Week 5–8) — Sub-national + Print

15. **Add sub-national holidays for US** (50 states + DC) — seed from Nager.Date's `counties` field
16. **Add sub-national holidays for India** (28 states + 8 UTs) — biggest SEO market
17. **Add sub-national holidays for Germany** (16 Bundesländer)
18. **Build `/holidays/[country]/state/[state]/[year]/`** pages
19. **Build printable PDF calendar** via Cloudflare Browser Rendering
20. **Add `/api/v1/holidays/compare?a=US&b=DE&year=2026`** side-by-side endpoint
21. **Build `/holidays/compare/[a]/[b]/[year]/` page** with visualization

### Weeks 9–16 (Phase 2) — Markets, Banks, Logistics, Travel

22. NYSE / NASDAQ / LSE / BSE / TSE holidays + early closes (curated from exchange.gov + SIFMA)
23. Federal Reserve / ECB / RBI / BoE / BoJ rate decision days
24. UPS / FedEx / DHL / USPS holiday schedules
25. School calendars (US K-12, UK, India CBSE, Germany, France)
26. Embassy / consulate closures
27. Visa application office closures
28. Slack / Teams native apps
29. Google Calendar add-on
30. Zapier / Make.com triggers
31. Webhook delivery system
32. Developer SDKs (JS, Python, Go, Ruby, PHP)
33. Embeddable widgets
34. Native iOS / Android (React Native)
35. Apple Watch / Wear OS complications

### Weeks 17–24 (Phase 3) — Enterprise + AI

36. Multi-country team holiday calendar
37. PTO conflict detection
38. Payroll cutoff calculator
39. Custom holidays (per-org)
40. SSO (Okta, Azure AD)
41. Audit logs
42. Predictive travel impact
43. Crowd forecasting
44. Anomaly detection (sudden holiday declarations)
45. AI chatbot
46. Semantic search (Vectorize)
47. Premium data export (CSV, Parquet, Snowflake share)
48. Webhook stream

---

## 13. Success Metrics (KPIs)

### 13.1 Year 1 Targets

| Metric | Target | How Measured |
|---|---|---|
| Organic traffic | 500K visits/mo | Cloudflare Web Analytics |
| Indexed pages | 50,000 | Google Search Console |
| API signups (free tier) | 5,000 | Cloudflare Access logs |
| API paying customers | 50 | Stripe |
| MRR | $5K | Stripe |
| Domain authority | 30 | Ahrefs |
| Backlinks | 5,000 | Ahrefs |
| Pagespeed score | 95+ | PageSpeed Insights |
| NPS | 50+ | On-site survey |

### 13.2 Year 2 Targets

| Metric | Target |
|---|---|
| Organic traffic | 5M visits/mo |
| Indexed pages | 500,000 |
| API signups | 50,000 |
| API paying customers | 1,000 |
| MRR | $80K |
| ARR | $960K |
| B2B SaaS customers | 50 |
| ARR from B2B | $500K |
| Total ARR | $1.5M |

### 13.3 Year 3 Targets

| Metric | Target |
|---|---|
| Organic traffic | 20M visits/mo |
| Indexed pages | 1M |
| API signups | 200,000 |
| API paying customers | 5,000 |
| MRR | $300K |
| B2B SaaS customers | 500 |
| ARR from B2B | $3M |
| Total ARR | $5M |

---

## 14. What's Already Built (reusable foundations)

You don't have to start from scratch. We have:

| Asset | Status | Reusability |
|---|---|---|
| **33,945 cities** with timezone, country, lat/lon, aliases, FTS5 search | ✅ Live | Reusable for: city-level holiday pages, "is it a holiday in [city]?" |
| **242 countries** with phone code, currency, languages, start_of_week, borders | ✅ Live | Reusable for: country hubs, comparison, regional data |
| **408 IANA timezones** with current offset, abbreviation, DST status | ✅ Live | Reusable for: market hours, business day calculations |
| **1,614 holidays across 39 countries** | ✅ Live | Phase 1 base; expand to 100+ countries via Nager.Date |
| **8 religion holidays** globally (Christian, Jewish, Muslim, Hindu, Buddhist, Sikh, Jain, secular) | ✅ Live | Unique differentiator; first-class filter |
| **540 OnThisDay events** with category + importance + Wikipedia | ✅ Live | Phase 1 base; expand to 2,000+ |
| **179 country-religion mappings** | ✅ Live | Foundation for religion filter |
| **Cloudflare IP geolocation** (`request.cf` → `window.__location`) | ✅ Live | Foundation for auto-detect, country picker, local data |
| **FTS5 search with diacritics** (`munchen` → München, `sao paulo` → São Paulo) | ✅ Live | Foundation for any search |
| **Hono API Worker + 12+ endpoints** | ✅ Live | Foundation; add more endpoints incrementally |
| **3 SEO-friendly pages** (`/home/`, `/holidays/`, `/onthisday/`) | ✅ Live | Foundation; add 50,000+ programmatic pages |
| **3 home page pills** (holiday, next-holiday, onthisday) | ✅ Live | Foundation; expand to 10+ pills |
| **Branch workflow** (feature/* → develop → main, 2 Workers for dev/prod) | ✅ Locked | Reusable forever |

---

## 15. The 1-Page Strategy

**What we are:** The world's best Holiday Intelligence Platform, free for consumers, API-first for developers, B2B for enterprises.

**Why we'll win:** timeanddate is broad and ad-supported. Calendarific is paid. Nager.Date is API-only with limited coverage. We're the only platform that combines:
- **Free, religion-aware holiday API** (beats Nager.Date + Calendarific combined)
- **Beautiful, fast consumer UI** (beats timeanddate's 2010-era design)
- **Sub-national precision** (50 US states, 28 Indian states, 16 German Länder — no one has this for free)
- **AI planning tools** (PTO optimizer, long weekend finder — first-mover)
- **50,000+ programmatic SEO pages** (long-tail that timeanddate ignores)

**How we monetize:** API ($100–$4K/yr) + B2B SaaS ($500–$10K/yr) + tasteful ads on the consumer site + premium content. **$1.5M ARR by Year 2, $5M by Year 3.**

**What's next (this week):** Ship the 7-tier "Show" filter, working day calculator, long weekend finder, and 3 new SEO pages. Get 50 countries × 5 years = 5,000 holidays in the DB by end of week. Then expand to 100 countries next week.

**The one thing that matters most:** ship `/holidays/[country]/[year]/[holiday-slug]/` pages for the top 200 holidays × 100 countries = **20,000 indexed pages** in 4 weeks. Each one answers a real question. Each one ranks for a long-tail query. Each one has structured data, FAQ, and links to 10+ siblings. **This is the SEO moat no competitor can replicate without rebuilding their data model.**

---

*End of PRD. Ready to ship.*
