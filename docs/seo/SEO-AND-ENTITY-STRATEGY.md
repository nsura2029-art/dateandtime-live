# SEO + Entity Strategy for dateandtime.live

> Last updated: 2026-07-21
> Status: Living document — revisit after each major section ship

This is the working playbook for ranking in Google, Bing, and AI search engines
(Perplexity, ChatGPT Search, Google AI Overviews, Copilot) for the
date/time/calendar/holiday/people knowledge domain.

---

## Part 1 — How modern search works (2026)

### The three layers every search engine has

| Layer | Google | Bing | What it does |
|---|---|---|---|
| **Crawling** | Googlebot (evergreen Chromium) | Bingbot | Discovers URLs from sitemaps, links, IndexNow. Renders JS. |
| **Indexing** | Caffeine + Hummingbird + BERT/MUM | Webmaster Tools index | Stores pages in inverted index; also stores Knowledge Graph entities. |
| **Ranking** | 200+ signals + Helpful Content + AI Overviews | RankNet + Prometheus + Copilot | Scores pages, returns top N, increasingly synthesizes. |

### What the Knowledge Graph is (and why it matters to us)

Google's Knowledge Graph (since May 2012) is a *separate* database of **entities**
(people, places, things) and their **relationships**. Example:

```
New York (Q60)  --[located_in]-->    United States (Q30)
              --[in_timezone]-->    America/New_York
              --[has_population]-->  8,336,817
              --[sameAs]-->          dbpedia, wikidata, Freebase
```

When you search "new york time", Google identifies the *entity* (Q60), looks
up its timezone, and renders a live clock. It pulls from multiple sources:
Wikipedia, Wikidata, government data, and **Schema.org markup from third-party
sites** (like ours).

**The play:** if we use the same Wikidata Q-IDs across our pages
(`/api/v1/person/Q937` for Einstein, `/api/v1/onthisday/event/Q11631` for
Apollo 11), Google can merge our entity data with its own. We become a
**trusted data source** for that entity.

### Structured data (what we control)

Schema.org markup (we ship JSON-LD on every page) is the protocol Google uses
to ingest entity info into the Knowledge Graph:

```json
{
  "@context": "https://schema.org",
  "@type": "City",
  "name": "Tokyo",
  "containedInPlace": { "@type": "Country", "name": "Japan" },
  "geo": { "latitude": 35.6762, "longitude": 139.6503 },
  "timeZone": "Asia/Tokyo"
}
```

This goes into Google's KG pipeline. They merge it with Wikipedia, Wikidata,
government feeds, etc. Then when someone searches "tokyo time", we can surface
as a **data source** even if we're not ranking #1 organically.

### What wins in 2026

| Signal | Weight | We have it? |
|---|---|---|
| **Structured data (JSON-LD)** | High | ✅ Yes |
| **Entity uniqueness** (one canonical URL per entity) | High | ⚠️ Partial — need to verify |
| **Internal link architecture** (hub-and-spoke, topic clusters) | High | ⚠️ Partial — strong on home, weak on deep pages |
| **Topical authority** (cover the topic comprehensively) | High | ✅ Yes (33,945 cities, 408 tzs) |
| **Page speed (Core Web Vitals)** | High | ✅ Yes (static HTML + CF Workers) |
| **E-E-A-T** (Experience, Expertise, Authority, Trust) | High | ✅ Yes (Wikidata + Wikipedia attribution) |
| **HTTPS + clean URL structure** | Med | ✅ Yes |
| **Freshness** (for time-sensitive queries) | High | ✅ Yes (live time, second-by-second) |
| **AI Overview citations** (Perplexity, ChatGPT, SGE) | New high | ⚠️ Partial — depends on snippet quality |

### The new reality: AI search

Perplexity gets ~10M queries/day, ChatGPT search launched 2024, Google AI
Overviews are everywhere. These engines:
- Don't care about backlinks as much
- Care **way more** about clean entity data
- Pull from the **first 1-2 sentences** of a page for the "snippet"
- Prefer **structured, citable** content

Our `/api/v1/person/{slug}` → `/person/{slug}/` approach is exactly right:
when someone asks ChatGPT "what time zone was Einstein born in", the LLM
looks for a known entity (Q937) and finds our page. That's an
**answer attribution** win.

---

## Part 2 — timeanddate.com analysis (the leader)

### Site structure (the URL hierarchy)

timeanddate.com is the dominant player in time/date queries. Here's their
URL hierarchy:

```
timeanddate.com/
├── /                                  (home, IP-detected local time)
├── /worldclock/                       (World Clock — main hub)
│   ├── /worldclock/full.html          (Extended list)
│   ├── /worldclock/usa                (Country page)
│   ├── /worldclock/usa/tampa          (City page) ← THE MONEY PAGE
│   ├── /worldclock/personal.html      (User's custom list)
│   ├── /worldclock/custom.html        (Shareable custom clock)
│   ├── /worldclock/fixedtime.html     (Event-time clock)
│   ├── /worldclock/linking.html       (Linking docs)
│   ├── /worldclock/search.html        (City search)
│   └── /worldclock/city.html?n=137    (Old-style city link)
│
├── /time/zone/usa/tampa               (Time zone page for a city)
├── /sun/usa/tampa                     (Sunrise/sunset)
├── /moon/usa/tampa                    (Moon phases)
├── /eclipse/                          (Eclipses)
├── /date/                             (Date-to-weekday etc.)
├── /calendar/                         (Year calendar)
├── /holidays/                         (Holidays)
├── /weather/                          (Weather)
├── /countdown/                        (Event countdown)
├── /timer/                            (Stopwatch/timer)
├── /date/adddays                      (Date arithmetic)
└── /sitemap.html                      (Site directory)
```

### The city page anatomy (Tampa: /worldclock/usa/tampa)

This is the most-linked, most-trafficked page type. Sections from top to bottom:

1. **Title** — "Current Local Time in Tampa, Florida, USA"
2. **Live time + date** — large mono clock, e.g. "11:03:43 pm EDT, Friday, March 27, 2026"
3. **Search field** — switch to another city
4. **Tabs** — Time/General | Weather | Time Zone | DST | Sun & Moon | (more)
5. **City data** —
   - Country: United States
   - Time Zone: EDT (Eastern Daylight Time) UTC/GMT -4 hours
   - DST: Mar 8, 2026 (start) → Nov 1, 2026 (end)
   - Difference: Same time as New York
6. **Sun & Moon block** —
   - Sunrise 7:25 am ↑ 86° East
   - Sunset 7:44 pm ↑ 274° West
   - Day length: 12h 19m (+1m 40s longer)
   - Moon phase 75% (rise/set times)
   - Solar noon
   - Twilights (astronomical, nautical, civil)
7. **Weather block** — current temp + 2-day forecast (custom data feed)
8. **More links** — to dedicated sub-pages:
   - /time/zone/usa/tampa (Time zone)
   - /sun/usa/tampa (Sun & Moon)
   - /weather/usa/tampa (Weather)
   - /calendar (Year calendar)
   - /holidays/us (Holidays in this country)
9. **Footer internal links** — nearby cities (in the same tz), same country, etc.

### Internal linking pattern (THIS IS THE KEY)

For every city page, the surrounding link graph is:

```
                     [ COUNTRY HUB ]   /worldclock/usa
                          /\
                         /  \
              [STATE HUB]   [OTHER CITIES IN COUNTRY]
              (if exists)    /worldclock/usa/new-york
                             /worldclock/usa/miami
                             /worldclock/usa/orlando
                                    |
                                    |
              [TIME ZONE HUB]  /time/zone/usa/eastern
                    /\                    /\
                   /  \                  /  \
            [CITIES IN TZ]      [TZ INFO / DST / UTC OFFSET]
            all US Eastern cities    etc.
                |
                |
            [HOLIDAYS]  /holidays/us
            [SUN/MOON]  /sun/usa/tampa
            [WEATHER]   /weather/usa/tampa
            [CALENDAR]  /calendar?year=2026&country=us
            [CALENDAR]  /calendar?year=2026&country=us&state=fl&city=tampa
```

**Key insight:** every city page is the center of a star pattern of links
to all the related entities. Google follows these links to build the graph.

### What we should learn from them

| Pattern | timeanddate.com does it | We should do it |
|---|---|---|
| One canonical URL per city | ✅ (`/worldclock/usa/tampa`) | ⚠️ Need to verify (use `/time-zones/in/us/tampa` or similar) |
| Country hub linking to all cities | ✅ (`/worldclock/usa` lists 50+ cities) | ⚠️ Have `/time-zones/in/us/` — need to make it dense |
| Time zone hub linking to all cities in tz | ✅ (every tz has a hub) | ⚠️ We have tzs in D1 but not sure all are indexed |
| City page → nearby cities | ✅ | ❌ Not yet |
| City page → all sub-topics (weather, sun, holidays) | ✅ | ⚠️ Partial |
| Sub-pages (sun, moon, weather) with their own URL | ✅ | ❌ Not yet |
| Same canonical entity on multiple page types | ✅ (city appears in /worldclock/, /sun/, /weather/) | ⚠️ Need canonical tags |
| Wikidata Q-ID in URL or canonical | ⚠️ (probably not) | ✅ We have `/api/v1/person/Q937` style |

---

## Part 3 — Suggested next sections for dateandtime.live

> **User direction (2026-07-21):** "I think the next section would be world time, city pages"

### Architecture recommendation

Match timeanddate.com's structure, but with our data advantage (33,945 cities vs their 6,000 + 6M via GeoNames). Make the entity graph the moat.

#### Tier 1 (ship first — Q3 2026)

**A. World Time hub** — `/world-time/`
- Single canonical URL per city: `/world-time/city/{slug}/` (e.g. `/world-time/city/tampa/`)
- Static HTML, server-rendered time on initial load (avoid JS-only clock for SEO)
- JSON-LD: `City`, `Place`, `AdministrativeArea`, `Country` (nested), `GeoCoordinates`, `TimeZone`
- Internal links:
  - To country hub: `/world-time/usa/` (and similar for all 242 countries)
  - To tz hub: `/time-zones/north-america/usa/eastern/` (or similar)
  - To nearby cities (5-10 in same state, 5-10 in same tz)
  - To all sub-pages: `/world-time/city/tampa/holidays/`, `/weather/`, `/sunrise/`, etc.
- Suggested sections (compact, dashboard-style):
  1. Live time + date (large)
  2. Time zone, UTC offset, DST status
  3. Sunrise/sunset + day length
  4. Moon phase + rise/set
  5. Country info (flag, capital, population, language, currency)
  6. Distance to user (if known)
  7. Time difference to 5-10 major cities
  8. Current weather (3-day forecast)
  9. Upcoming holidays in this country
  10. On-this-day events

**B. World Clock hub** — `/world-clock/`
- The timeanddate.com-style "table of times" page
- Filterable by continent, country, time zone
- Static HTML for the top 200 cities, JS for the rest
- Each row links to that city's page
- JSON-LD: `ItemList` of `Place` entities

#### Tier 2 (ship next — Q4 2026)

**C. Country pages** — `/world-time/{country-slug}/`
- All cities in the country (paginated, ~50 per page for big countries)
- Country info: capital, population, language, currency, dialing code
- Map (static image or Leaflet embed)
- Time zones in the country
- Public holidays in the country (link to /holidays/{country}/)
- Neighboring countries (with times)

**D. Time zone pages** — `/time-zones/zone/{iana-name}/`
- All cities in the tz
- Current offset, DST status, next DST change
- Countries in the tz
- UTC offset table (current, standard, DST)

#### Tier 3 (defer)

**E. Sub-pages per city** — `/world-time/city/{slug}/sunrise/`, `/weather/`, etc.
**F. Sunrise/calendar/moon per city** — same as timeanddate.com
**G. Time difference matrix** — `/time-zones/difference/`

### Internal linking map

```
                    HOME (/) [Tier 1+2+3 sections]
                       |
            +----------+----------+
            |                     |
       WORLD TIME HUB         WORLD CLOCK HUB
       /world-time/            /world-clock/
            |                     |
            +------+ tbl of cities +-----+
                   |                    |
            /world-time/usa/      /world-clock/?continent=na
            (242 country hubs)    /world-clock/?country=us
                   |
        +----------+----------+--------+
        |          |          |        |
    CITY PAGES   TZ PAGES   HOLIDAY   COUNTRY
    33,945 of    408 of     /holidays/  reuses hub
    them         them       {cc}/
        |          |
        +---sub-pages (sun, weather, moon, calendar)
```

### Entity uniqueness strategy

**Rule:** Each entity has **exactly one canonical URL**. Every other URL is either:
- A redirect (301) to the canonical, or
- Has a `<link rel="canonical">` pointing to the canonical

**Canonical URL pattern for cities:**

| Entity | Canonical URL |
|---|---|
| City | `/world-time/city/{slug}/` |
| Country | `/world-time/{country-slug}/` |
| Time zone | `/time-zones/zone/{iana}/` |
| Person | `/person/{slug}/` |
| Event (on this day) | `/onthisday/event/{slug}/` |
| Holiday | `/holidays/{country}/{year}/#{holiday-slug}` |

**Duplicate content sources to handle:**
1. Homepage "Today on Earth" strip — each city card should `rel="canonical"` to the city page, or `rel="nofollow"` to avoid duplicate indexing.
2. Search results dropdown — `nofollow` the city links.
3. Old /legacy URLs (e.g. `/city/123` GeoNames ID) — 301 redirect to `/world-time/city/{slug}/`.
4. Sub-pages (sun, weather) — they're different entities, no canonical issue, but should be in the link graph.

**Wikidata Q-IDs:** use them as part of URL path OR as a `sameAs` link in JSON-LD. Both work. Path is more user-friendly, JSON-LD is more standards-compliant.

### Structured data patterns

#### City page JSON-LD (full pattern)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "City",
      "@id": "https://dateandtime.live/world-time/city/tampa/",
      "name": "Tampa",
      "alternateName": "Tampa, Florida",
      "description": "Current local time, weather, and time zone information for Tampa, Florida, USA",
      "url": "https://dateandtime.live/world-time/city/tampa/",
      "containedInPlace": { "@id": "https://dateandtime.live/world-time/usa/#country" },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 27.94752,
        "longitude": -82.45843
      },
      "timeZone": "America/New_York",
      "population": 399451,
      "sameAs": [
        "https://www.wikidata.org/wiki/Q38072",
        "https://en.wikipedia.org/wiki/Tampa,_Florida"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://dateandtime.live/#website",
      "url": "https://dateandtime.live/",
      "name": "Date and Time"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://dateandtime.live/" },
        { "@type": "ListItem", "position": 2, "name": "World Time", "item": "https://dateandtime.live/world-time/" },
        { "@type": "ListItem", "position": 3, "name": "USA", "item": "https://dateandtime.live/world-time/usa/" },
        { "@type": "ListItem", "position": 4, "name": "Tampa" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What time is it in Tampa right now?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "It's 11:03:43 PM EDT in Tampa, Florida on Friday, March 27, 2026."
          }
        },
        ...
      ]
    }
  ]
}
```

#### Country page JSON-LD

```json
{
  "@context": "https://schema.org",
  "@type": "Country",
  "@id": "https://dateandtime.live/world-time/usa/#country",
  "name": "United States",
  "alternateName": "USA",
  "geo": { "@type": "GeoCoordinates", "latitude": 39.8283, "longitude": -98.5795 },
  "containsPlace": [
    { "@type": "City", "name": "New York", "url": "/world-time/city/new-york/" },
    { "@type": "City", "name": "Los Angeles", "url": "/world-time/city/los-angeles/" },
    ...
  ],
  "sameAs": [
    "https://www.wikidata.org/wiki/Q30",
    "https://en.wikipedia.org/wiki/United_States"
  ]
}
```

### Action items (prioritized)

**Week 1-2 — Foundations**
- [ ] Audit current site for canonical URLs (every page should have a single canonical)
- [ ] Add BreadcrumbList JSON-LD to all detail pages
- [ ] Add FAQPage JSON-LD to all city/country/tz pages
- [ ] Add lastmod to sitemap.xml
- [ ] Submit sitemap to Google Search Console + Bing Webmaster Tools
- [ ] Set up IndexNow API for instant Bing indexing

**Week 3-4 — World Time hub**
- [ ] Build `/world-time/` hub page (list of 242 countries with sample cities)
- [ ] Build `/world-time/city/{slug}/` template
- [ ] Generate static HTML for top 1,000 cities
- [ ] Lazy-render the remaining 32,945 cities
- [ ] Internal link map: home → world-time → country → city
- [ ] Add nearby cities linking (5-10 from same state, 5-10 from same tz)

**Week 5-6 — Country + Time zone hubs**
- [ ] Build `/world-time/{country}/` template (242 pages)
- [ ] Build `/time-zones/zone/{iana}/` template (408 pages)
- [ ] Cross-link country ↔ tz hubs

**Week 7-8 — Sub-pages per city**
- [ ] `/world-time/city/{slug}/sunrise/`
- [ ] `/world-time/city/{slug}/weather/`
- [ ] `/world-time/city/{slug}/holidays/`
- [ ] `/world-time/city/{slug}/calendar/`

**Ongoing — Monitoring**
- [ ] Set up Search Console performance dashboard
- [ ] Track which city pages get impressions
- [ ] Watch for "what time is it in [city]" Featured Snippets wins
- [ ] Monitor Bing Webmaster for IndexNow status

### Specific question: Should we use `/time-zones/in/{cc}/` or `/world-time/city/{slug}/`?

Currently we have:
- `/time-zones/in/{cc}/` (e.g. `/time-zones/in/jp/`) — country hubs, 146 of them
- `/api/v1/cities/{id}` — API endpoint
- Homepage "Today on Earth" 6-city strip

**Recommendation:**
1. **Use `/world-time/city/{slug}/` as the canonical city URL.** That's what users search for ("time in Tampa"), it's memorable, and it's what timeanddate.com uses (`/worldclock/usa/tampa`).
2. **Keep `/time-zones/in/{cc}/` as a country hub** (different entity, different intent).
3. **301 redirect** old IDs (`/api/v1/cities/123`) and any GeoNames ID URLs to the canonical.

### What we already have that wins

- ✅ 33,945 cities (vs timeanddate.com's 6,000 + 6M via GeoNames)
- ✅ 408 time zones (IANA canonical)
- ✅ 242 countries (UN M49 canonical)
- ✅ 1,600+ holidays (Nager.Date)
- ✅ 71,992 on-this-day events (Wikipedia)
- ✅ 50K persons (Wikidata)
- ✅ Climate data (12 months × 5,081 cities)
- ✅ DST transitions (5 years × 312 tzs)
- ✅ Static HTML + CF Workers = fast crawling
- ✅ hreflang for 14 languages
- ✅ JSON-LD on home page

### What we're missing vs timeanddate.com

- ❌ Per-city static pages (33,945 missing)
- ❌ Country hubs with full city list
- ❌ Time zone hubs with city list
- ❌ Per-city sub-pages (sun, weather, moon, calendar)
- ❌ Nearby cities linking
- ❌ Internal canonical URL strategy
- ❌ BreadcrumbList JSON-LD on detail pages
- ❌ FAQPage JSON-LD on detail pages
- ❌ IndexNow API integration
- ❌ Sitemap per page type (city-sitemap.xml, country-sitemap.xml)

---

## Open questions

1. **Slug strategy for cities with same name in different states** (Portland, OR vs Portland, ME)?
   - Option A: `/world-time/city/portland-or/` (state suffix)
   - Option B: `/world-time/city/portland-42/` (GeoNames ID suffix)
   - Option C: `/world-time/city/portland/` + canonical for the disambiguation
   - **Decision needed**

2. **URLs with non-ASCII chars** (São Paulo, Reykjavík, Zürich)?
   - Option A: keep non-ASCII (URLs can be Unicode, Google reads them)
   - Option B: ASCII-only slugs (sao-paulo, reykjavik, zurich)
   - **Recommendation: Option B for canonical; keep city name as displayed text**

3. **Should city pages also live at `/cities/{slug}/`?**
   - Probably no — keep one canonical URL.
   - If we want a different URL, 301 redirect to the canonical.

4. **How to handle the legacy `/api/v1/cities` URL in the link graph?**
   - These are API endpoints, not user-facing pages.
   - Don't link to them from the static site. Keep them for programmatic access.

---

## References

- Google Knowledge Graph: https://blog.google/products/search/introducing-knowledge-graph-things-not/
- Schema.org: https://schema.org/City, https://schema.org/Country, https://schema.org/TimeZone
- timeanddate.com world clock: https://www.timeanddate.com/worldclock/
- timeanddate.com city page help: https://www.timeanddate.com/worldclock/city-help.html
- IndexNow: https://www.indexnow.org/
- Google's Structured Data General Guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies

---

## Changelog

- 2026-07-21: Initial document. User triggered by discussion of SEO fundamentals + analysis of timeanddate.com. Next section: world time + city pages.
