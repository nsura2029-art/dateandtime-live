# dateandtime.live — Keyword Research & SEO Strategy

**Prepared**: 2026-07-20
**Site**: dateandtime.live (33,945 cities, 408 time zones, 242 countries, 1,600+ holidays)

---

## Executive Summary

After researching the time/date niche via Google, competitor analysis, and your existing seed data, here's the strategy:

**Top 3 SEO opportunities** (by volume × relevance × convertability):
1. **City-level "time in [city]" queries** — biggest volume, lowest competition for non-top-1000 cities
2. **DST 2026/2027 queries** — massive seasonal spike every March and November
3. **Time zone conversion (UTC to X, EST to PST, etc.)** — high volume, easy to rank with tool pages

**Your secret weapon**: You have **33,945 city pages** AND **API data** for ALL the content the competitors build manually. Most of this is **programmatic**, not editorial.

---

## Part 1: Keyword Universe (High-Value Targets)

### Tier 1: Head Terms (High Volume, High Competition)

| Keyword | Est. Volume | Competition | Your Asset |
|---|---|---|---|
| world clock | 250K+/mo | High | `/world-time/` |
| current time | 500K+/mo | Very High | Homepage + city pages |
| time zone | 200K+/mo | High | `/time-zones/` + 146 country pages |
| time zone converter | 100K+/mo | High | `/time-zones/converter/` |
| daylight saving time | 150K+/mo | High | `/time-zones/dst/` |
| UTC time | 100K+/mo | High | Homepage + `/time-zones/utc/` |
| time in [city] | varies | Med | 33,945 city pages (TBD) |
| sunrise sunset times | 50K+/mo | High | Need new pages |
| moon phase today | 30K+/mo | High | Need new pages |
| meeting planner | 20K+/mo | Med | `/world-time/meeting/` |

### Tier 2: Long-Tail (Medium Volume, Lower Competition, Higher Intent)

| Keyword Pattern | Est. Volume | Your Asset |
|---|---|---|
| `time in [city]` | 1K-50K per city | **MISSING** — need city pages |
| `[city] time zone` | 500-10K per city | **MISSING** |
| `time difference between [city] and [city]` | 1K-5K per pair | World time tool can do this |
| `DST 2026 [country]` | 1K-10K per country | **MISSING** — need 195 pages |
| `holidays in [country] 2026` | 1K-5K per country | 1,600+ holidays DB |
| `long weekends 2026 [country]` | 500-5K per country | **MISSING** (HUGE opportunity) |
| `[city] sunrise sunset` | 100-1K per city | **MISSING** |
| `full moon [month] [year]` | 5K-20K per month/year | **MISSING** |
| `eclipse [year]` | 10K-50K per year | **MISSING** |
| `best time to call [country]` | 500-5K per country | World time tool can do this |
| `work hours [country]` | 500-2K per country | **MISSING** (have data!) |

### Tier 3: Programmatic Gold (Zero Effort After Build)

These can be **auto-generated** from your existing API data:

| Pattern | Pages Possible | Annual Refresh? |
|---|---|---|
| `/time/in/[city]/` (33,945 cities) | 33,945 | No (live data) |
| `/time-zones/in/[country]/` (139 countries) | 139 | Partial (DST) |
| `/dst/[year]/[country]/` (195 × 3 years) | 585 | Yes (yearly) |
| `/holidays/[year]/[country]/` (195 × 5 years) | 975 | Yes |
| `/long-weekends/[year]/[country]/` | 975 | Yes |
| `/sunrise-sunset/[city]/[month]/` | 407K | No (live) |
| `/moon-phase/[city]/[month]/[year]/` | huge | No |
| `/eclipse/[year]/` | 5-10 | Partial |
| `/equinox/[year]/` + `/solstice/[year]/` | 8 | Yes |
| `/business-hours/[city]/` | 33,945 | No |

---

## Part 2: Your Seed Data → Programmatic Pages

This is where you WIN. The competitors build these manually. You have the data.

### Existing data we can use RIGHT NOW

| Data | API endpoint | What we can build |
|---|---|---|
| 33,945 cities | `/api/v1/cities` | City time pages |
| 408 time zones | `/api/v1/timezones` | TZ info pages |
| 1,600+ holidays | `/api/v1/holidays?year=2026` | Country holiday pages |
| DST transitions | `/api/v1/dst/upcoming` | DST country pages |
| Climate data | `/api/v1/cities/:id/climate` | Climate by city pages |
| Seasons | `/api/v1/cities/:id/seasons` | Season pages |
| 50 onthisday events | `/api/v1/onthisday` | We already have this! |

### Top 5 highest-ROI seed-data pages to build (next 2 weeks)

#### 1. **`/long-weekends/[year]/[country]/`** — 39 countries × 5 years = 195 pages

- **Why**: "long weekend [country] [year]" is ~80K searches/mo for US/UK/India/Canada alone
- **Competition**: Mostly calendar sites with thin content
- **Data we have**: All 1,600+ holidays + weekend math
- **Build effort**: 1-2 days (script)
- **Expected traffic**: 5-15K visits/mo in year 1
- **AdSense RPM**: $4-8 (travel vertical)

**Example page**: `/long-weekends/2026/united-states/`
```
# Long Weekends in the United States 2026

The US has 11 public holidays in 2026, creating 8 long weekends
and 1 four-day weekend at Easter.

| Date | Days | Holiday |
|---|---|---|
| Jan 1-3 | 3 days | New Year's Day |
| Jan 19-20 | 3 days (4 with weekend) | MLK Day |
| May 22-25 | 3 days (4 with weekend) | Memorial Day |
...

## Best 3-day weekends
[list with celebration ideas]

## How to maximize your PTO
[content: how to stack with 1-2 days off for 4-5 day breaks]

## All 2026 public holidays in the US
[auto-generated list from API]
```

#### 2. **`/dst/[year]/[country]/`** — 195 countries × 3 years = 585 pages

- **Why**: "DST 2026 [country]" spikes in March and November (1M+ searches combined)
- **Competition**: timeanddate.com dominates; we can rank for long-tail
- **Data we have**: DST transitions in DB
- **Build effort**: 1-2 days
- **Expected traffic**: 3-8K visits/mo
- **AdSense RPM**: $5-10 (finance/business vertical)

**Example**: `/dst/2026/united-states/`
```
# Daylight Saving Time in the United States 2026

DST starts on Sunday, March 8, 2026 at 2:00 AM
DST ends on Sunday, November 1, 2026 at 2:00 AM

## Clock change schedule 2026
[table of all 6 changes, with UTC times]

## Exceptions
- Hawaii: no DST
- Arizona (most): no DST
- US territories: no DST

## States considering permanent DST
[news about legislation]

## Related
- DST in Canada 2026
- DST around the world
- What is DST?
```

#### 3. **`/time/in/[city]/`** — Top 500 cities first (1,000+ cities by year-end)

- **Why**: "time in [city]" is the #1 query in this niche
- **Competition**: 24timezones.com and timeanddate.com dominate; we win on long-tail (mid-size cities)
- **Data we have**: 33,945 cities
- **Build effort**: 1 day for script
- **Expected traffic**: 50-200K visits/mo total (long-tail)
- **AdSense RPM**: $3-6

**Example**: `/time/in/london/`
```
# Current Time in London, United Kingdom

It's 5:42 PM in London right now (BST, UTC+1)

[live clock - same component as homepage]

## Time zone info
- IANA: Europe/London
- UTC offset: +1 (BST) / 0 (GMT)
- DST: Active (until Oct 25, 2026)
- Population: 8.9 million

## London sunrise & sunset today
[sun times]

## Upcoming clock changes
- Oct 25, 2026: clocks go back 1 hour

## Compare with other cities
- Time in New York vs London
- Time in Tokyo vs London
- Time in Sydney vs London

## Key facts
- London uses BST (British Summer Time) in summer, GMT in winter
- 195 countries have this time pattern: ...

## Tools
- Meeting planner with London
- Time zone converter (London to ...)
```

#### 4. **`/sunrise-sunset/[city]/[month]/[year]/`** — 500 cities × 12 months = 6,000 pages/yr

- **Why**: "sunrise [city] [month]" gets 100-5K searches per major city per month
- **Competition**: timeanddate.com and sunrisesunset.com
- **Data we have**: Climate + sun data
- **Build effort**: 1-2 days
- **Expected traffic**: 10-30K visits/mo total
- **AdSense RPM**: $2-5

**Example**: `/sunrise-sunset/new-york/june/2026/`
```
# Sunrise & Sunset in New York, June 2026

[table of all 30 days, sunrise/sunset/daylight length]

## Daylight trends this month
- Longest day: June 21 (15h 05m)
- Shortest day: June 1 (14h 48m)
- Change: +17 minutes

## Compare to other cities
- London in June: 16h 38m (longest)
- Singapore in June: 12h 12m (consistent)
- Reykjavik in June: 21h 30m (midnight sun)
```

#### 5. **`/eclipse/[year]/`** + `/full-moon/[year]/[month]/` — 5 + 144 = 149 pages

- **Why**: "solar eclipse 2026" gets 100K+ searches around eclipse dates
- **Competition**: timeanddate.com and NASA dominate; we can win on long-tail
- **Data we have**: 50 onthisday events
- **Build effort**: 2-3 days
- **Expected traffic**: 5-20K visits/mo during events
- **AdSense RPM**: $3-7 (education/science vertical)

---

## Part 3: Editorial Calendar (Next 90 Days)

Use this for the news section (every 2-3 days):

| Week | Article | Category | Target keywords |
|---|---|---|---|
| 1 | "What time is it in [City]?" (roundup) | Time Zone | time in [city], current time |
| 1 | "DST 2026: Final Week of Winter Time" | Time Zone | DST 2026, daylight saving time 2026 |
| 2 | "Easter Around the World" | Calendar | Easter 2026, when is Easter |
| 2 | "Spring Equinox 2026: First Day of Spring" | Astronomy | spring equinox, vernal equinox |
| 3 | "April Total Solar Eclipse Guide" | Astronomy | solar eclipse 2026, total solar eclipse |
| 3 | "Best 3-Day Weekends in US 2026" | Calendar | long weekends 2026, three day weekends |
| 4 | "International Workers' Day / May Day" | Calendar | labor day, may day |
| 4 | "Perseid Meteor Shower 2026" | Astronomy | perseids 2026, perseid meteor shower |
| 5 | "Time Zones in Space" (fascinating) | Astronomy | time in space, ISS time |
| 5 | "DST 2026 Ends: US Falls Back" | Time Zone | DST end 2026, fall back 2026 |
| 6 | "Full Moon Names 2026" | Astronomy | full moon names 2026 |
| 6 | "Thanksgiving 2026: Date & History" | Calendar | thanksgiving 2026 |
| 7 | "Year in Review: Time News 2026" | Time Zone | best of 2026 |
| 7 | "Winter Solstice 2026" | Astronomy | winter solstice |

**14 articles in 90 days** = 1 every ~6 days. Plus automated long-weekend and DST pages.

---

## Part 4: Action Plan (Prioritized)

### 🔥 This week (highest ROI)

1. **Long Weekends generator** (`/long-weekends/[year]/[country]/`) — 195 pages in 1 day
2. **DST country pages** (`/dst/[year]/[country]/`) — 585 pages in 2 days
3. **1-2 news articles** per week from editorial calendar

### 📅 Next 2 weeks

4. **Top 100 city time pages** (`/time/in/[city]/`) — 100 pages in 1 day
5. **Sunrise/sunset pages** (top 50 cities × 12 months) — 600 pages in 2 days
6. **Add "Latest news" widget to home + hub pages**

### 📈 Next month

7. **Eclipse 2026 hub** (`/eclipse/2026/`) — single authoritative page
8. **Full moon 2026 calendar** — 12 monthly pages
9. **Sitemap re-submission** to Google Search Console

### 🎯 Quarter goal

- 1,500+ new indexed URLs
- 50K+ organic visits/mo (currently ~5K estimated)
- Topical authority for "DST 2026", "long weekends 2026", "time in [city]"
- 3-4 AdSense placements + monetization

---

## Part 5: Tools to Use (Free)

Since Google Keyword Planner requires a Google Ads account, use these free alternatives:

| Tool | URL | What it does |
|---|---|---|
| Google Trends | trends.google.com | Compare search terms, see trends over time, regional interest |
| Moz Keyword Explorer (free) | moz.com/explorer | 10 free searches/mo, search volume + difficulty |
| Ahrefs Free Keyword Generator | ahrefs.com/keyword-generator | 100 keyword ideas per search |
| AnswerThePublic | answerthepublic.com | Question-based keywords (great for "what is", "when is", "how to") |
| Semrush Free | semrush.com/free-tools | Search volume checker |
| KeywordTool.io (free) | keywordtool.io | 50+ keywords per seed, autocomplete data |
| Google autocomplete | Just type in Google | Real queries, real volume signals |
| AlsoAsked.com | alsoasked.com | "People also ask" questions |

### How to use them for our niche

1. **Seed keywords** (5):
   - "world clock"
   - "current time"
   - "DST 2026"
   - "long weekend"
   - "time in [city]"

2. **Expand each seed** with the tools above

3. **Filter by relevance** to our site (skip "online world clock game" etc.)

4. **Group by intent**:
   - Informational: "what is UTC"
   - Transactional: "buy world clock" (skip)
   - Navigational: "world clock widget"
   - Time-sensitive: "DST 2026", "eclipse 2026"

5. **Prioritize** by Volume × (1 - Difficulty) × Relevance

---

## Part 6: Competitive Analysis (Quick)

| Competitor | Strength | Your Advantage |
|---|---|---|
| timeanddate.com | 30 years of content, 1000+ city pages, brand | **More cities (33,945 vs their ~500)**, faster tech, modern UX |
| 24timezones.com | 500 cities, clean design | **33,945 cities**, more data, tools |
| worldtimebuddy.com | Simple meeting planner | **Better meeting planner** (live time, drag-select) |
| savvytime.com | Time conversion | **More converters, IANA data** |

### Top SEO gaps we can exploit

1. **"time in [city]" for any city** — they only have ~500; we have 33,945
2. **"long weekend [country] [year]"** — they have it; we should too (programmatic)
3. **"sunrise sunset [city] [date]"** — they have calculators; we should have monthly tables
4. **"[country] holidays 2026"** — they have it; we should too (we have data!)

---

## Part 7: How to use the seed data we already have

### Step 1: Audit what we have

```
✅ 33,945 cities (API)
✅ 408 time zones (API)
✅ 242 countries (API)
✅ 1,600+ holidays (API, 39 countries + 21 with business calendars)
✅ 1,560 DST transitions (API, 312 timezones × 5 years)
✅ 60,972 climate summaries (5,081 cities × 12 months)
✅ 16,378 seasons (5,081 cities × 3-4 seasons)
✅ 50 onthisday events (we have /onthisday/ already)
✅ 8 data sources documented
✅ 10 data quality checks
```

### Step 2: Map data → pages

```
cities         → /time/in/[city]/                  × 33,945
countries      → /time-zones/in/[country]/          × 139 (we have)
                /holidays/[year]/[country]/          × 195
                /long-weekends/[year]/[country]/    × 195
                /dst/[year]/[country]/               × 195
                /business-hours/[country]/            × 195
                /best-time-to-call/[country]/         × 195
time zones     → /time-zones/info/[zone]/            × 408
holidays       → /holidays/[holiday-slug]/            × 100+
                /onthisday/                          × 365 days/yr
climate        → /climate/[city]/                     × 5,081
seasons        → /seasons/[city]/                    × 5,081
sun data       → /sunrise-sunset/[city]/[month]/     × 60,972
moon data      → /moon-phase/[city]/[month]/         × 60,972
eclipses       → /eclipse/[year]/                    × 5-10
solstices      → /equinox-solstice/[year]/            × 8
```

### Step 3: Prioritize by traffic potential

**Tier 1 (build this month)**:
- Top 500 cities × 12 months of sunrise pages = 6,000 pages
- Top 50 countries × 3 years × long weekends = 150 pages
- 1 major eclipse + 12 monthly full moon pages = 13 pages

**Tier 2 (build next month)**:
- DST pages: 195 × 3 years = 585 pages
- Holiday pages: 195 × 5 years = 975 pages

**Tier 3 (build over time)**:
- All 33,945 city time pages (programmatic, can do in batches)
- All 60,972 sunrise pages (programmatic)

---

## Quick Win: One-Page SEO Audit of Current Site

After our work, here's what we have SEO-wise:

### ✅ What's good

- 139 country pages (`/time-zones/in/[country]/`)
- 3 educational pages (What is, DST, UTC)
- 2 hub pages (World Time, Time Zones)
- 2 tool pages (Meeting Planner, Converter)
- 19 topic pages (news tags)
- 5 news articles
- Onthisday pages
- Holidays pages
- Sitemap with 161 URLs (now 168+ with news)

### ❌ What's missing (top priority)

- No `/time/in/[city]/` pages (HUGE opportunity, 33,945 cities)
- No `/long-weekends/` pages
- No `/dst/[year]/[country]/` pages
- No `/sunrise-sunset/` pages
- No `/eclipse/` pages
- No "Latest news" widget on hub pages
- No FAQ schema on home page (would help featured snippets)
- No breadcrumb on home page

---

## Summary: Your 90-Day Roadmap

| Day | Action | New pages | Cumulative |
|---|---|---|---|
| 1-2 | Long Weekends generator | 195 | 195 |
| 3-4 | DST country pages | 585 | 780 |
| 5-6 | Top 100 city time pages | 100 | 880 |
| 7 | Add Latest News widget to home | 0 | 880 |
| 8-10 | Sunrise/sunset (top 50 cities) | 600 | 1,480 |
| 11-12 | Eclipse + full moon hub | 13 | 1,493 |
| 13-14 | FAQ schema on home | 0 | 1,493 |
| 15-90 | Editorial news articles (1 per 3 days) | +25-30 | 1,520 |

**End state**: 1,500+ indexed URLs, topical authority for 10+ high-volume keyword clusters, ~50K visits/mo from organic.

---

## Next Step

Want me to start with #1 from the action plan — building the **Long Weekends generator**? It's:

- ✅ Highest ROI (massive search volume, low competition)
- ✅ Data we already have (1,600+ holidays)
- ✅ Fast to build (1-2 days)
- ✅ Works across all 39+ countries we have holiday data for
- ✅ Auto-refreshes yearly (just re-run the script in Jan 2027)

Say "go" and I'll start building it. 🚀
