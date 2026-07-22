# URL Pattern for City Pages

> Last updated: 2026-07-21
> Status: Locked (after this audit)

## The canonical URL pattern

```
/world-time/                                      (hub: world time, all countries)
/world-time/{country-slug}/                       (country hub: 242 pages)
/world-time/{country-slug}/{state-slug}/          (state hub: ~3K pages)
/world-time/city/{city-slug}/                     (CITY PAGE — 33,945 pages) ⭐

# City sub-pages (one per topic)
/world-time/city/{city-slug}/time/                (live time + tz details)
/world-time/city/{city-slug}/sunrise/             (sun & moon)
/world-time/city/{city-slug}/holidays/            (holidays in country)
/world-time/city/{city-slug}/onthisday/           (OTD events in this city)
/world-time/city/{city-slug}/people/              (famous people born/died here)
/world-time/city/{city-slug}/weather/             (current weather + forecast)
/world-time/city/{city-slug}/climate/             (12-month climate chart)
/world-time/city/{city-slug}/airports/            (airports near)

# Time zone pages
/time-zones/zone/{iana-tz}/                       (tz hub: 408 pages)

# Tools (work with any city)
/meeting/?cities=tampa,new-york                   (meeting planner)
/converter/?from=tampa&to=tokyo                   (time converter)
/distance/?from=tampa&to=orlando                  (distance calculator)
/event-time/?at=tampa&datetime=2026-12-25T19:00   (event time announcer)
```

## Slug rules

### General
- **Lowercase only**
- **ASCII only** (transliterate non-ASCII: São Paulo → `sao-paulo`, Zürich → `zurich`, Reykjavík → `reykjavik`, Κέρκυρα → `kerkyra`)
- **Hyphens separate words**: `new-york`, `sao-paulo`, `kuala-lumpur`
- **No trailing slash** in URL; trailing slash on the page itself

### Disambiguation (same name, different place)

When two cities have the same name (e.g., Portland, OR vs Portland, ME):

**Primary (most populous, OR capital)**: `/world-time/city/portland/`
**Secondary**: `/world-time/city/portland-or/`, `/world-time/city/portland-me/`

Rule:
- If a city is in our `cities.isCapital` table for the country → use bare slug
- Else: append `{state-slug}` (US/Canada/Australia) or `{country-slug}` (elsewhere)
- `state-slug` from `cities.stateCode` lowercased (`FL` → `fl`, `NSW` → `nsw`)

Examples:
- `/world-time/city/portland/` — Portland, OR (Oregon, larger)
- `/world-time/city/portland-me/` — Portland, ME
- `/world-time/city/springfield/` — Springfield, MO (largest of 30+ Springfields)
- `/world-time/city/springfield-il/` — Springfield, IL (Lincoln's home)
- `/world-time/city/springfield-ma/` — Springfield, MA

### Capital city rule

- If a city is the **national capital** of its country → bare slug
- E.g. `/world-time/city/tokyo/` (Japan capital), `/world-time/city/london/` (UK capital)
- E.g. `/world-time/city/berlin/` (Germany capital)
- E.g. `/world-time/city/canberra/` (Australia capital — NOT Sydney, which is largest)

### State-vs-no-state rule

- US/Canada/Australia: prefer `state-slug` for non-capitals
  - `/world-time/city/tampa/` (FL)
  - `/world-time/city/miami/` (FL — most populous, no need for state)
  - `/world-time/city/jacksonville/` (FL — largest FL city)
- Other countries: bare slug if it's a top-100 city; append admin1 otherwise

### Examples of the full pattern

| City | URL |
|---|---|
| Tampa, FL, USA | `/world-time/city/tampa/` |
| New York, NY, USA | `/world-time/city/new-york/` |
| Los Angeles, CA, USA | `/world-time/city/los-angeles/` |
| São Paulo, Brazil | `/world-time/city/sao-paulo/` |
| Mexico City, Mexico | `/world-time/city/mexico-city/` |
| Zürich, Switzerland | `/world-time/city/zurich/` |
| Reykjavík, Iceland | `/world-time/city/reykjavik/` |
| Beijing, China | `/world-time/city/beijing/` |
| Shanghai, China | `/world-time/city/shanghai/` |
| London, UK | `/world-time/city/london/` |
| Tokyo, Japan | `/world-time/city/tokyo/` |
| Mumbai, MH, India | `/world-time/city/mumbai/` |
| Delhi, DL, India | `/world-time/city/delhi/` |
| Bangalore, KA, India | `/world-time/city/bangalore/` |
| Portland, OR, USA | `/world-time/city/portland/` |
| Portland, ME, USA | `/world-time/city/portland-me/` |
| Springfield, MO, USA | `/world-time/city/springfield/` |
| Springfield, IL, USA | `/world-time/city/springfield-il/` |
| Sydney, NSW, Australia | `/world-time/city/sydney/` (state capital, even though not the largest) |
| Melbourne, VIC, Australia | `/world-time/city/melbourne/` (state capital) |

## Slug generation algorithm

```python
import unicodedata
import re

def slugify(name, ascii_name=None):
    """Convert 'São Paulo' → 'sao-paulo'"""
    s = ascii_name or name
    # Normalize: é → e, ü → u, ñ → n, etc.
    s = unicodedata.normalize('NFKD', s)
    s = s.encode('ascii', 'ignore').decode('ascii')
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    return s

def city_slug(city, all_cities):
    """
    city: { name, asciiName, countryCode, stateCode, isCapital, population }
    all_cities: list of all cities with same name (same asciiName)
    """
    base = slugify(city['asciiName'])
    if city['isCapital']:
        return base  # bare slug for capitals
    if len(all_cities) == 1:
        return base  # unique name
    # Multiple cities with same name: disambiguate
    # If has state, use state suffix
    if city.get('stateCode'):
        return f"{base}-{city['stateCode'].lower()}"
    return f"{base}-{city['countryCode'].lower()}"
```

## Slug uniqueness check

For each candidate slug, check that no other city in our D1 has the same
`{country, slug}` pair. If conflict, append a numeric suffix or use the
GeoNames ID (e.g., `springfield-il-2`).

## URL redirects (301)

| Old path | New path |
|---|---|
| `/api/v1/cities/{id}` | `/world-time/city/{slug}/` |
| `/city/{id}` | `/world-time/city/{slug}/` |
| `/time-zones/in/{cc}/tampa/` | `/world-time/city/tampa/` |
| `/cities/tampa` | `/world-time/city/tampa/` |
| `/cities/4174757` | `/world-time/city/tampa/` |

## Canonical URL rules

Every page should have:
```html
<link rel="canonical" href="https://dateandtime.live/world-time/city/tampa/" />
```

Multiple URLs to the same content:
- `https://dateandtime.live/world-time/city/tampa/`
- `https://dateandtime.live/world-time/city/tampa` (no trailing slash)

These should both serve the same page, with the same canonical.

## Sitemap strategy

- `/sitemap-cities-1.xml` (cities 1-10,000)
- `/sitemap-cities-2.xml` (cities 10,001-20,000)
- `/sitemap-cities-3.xml` (cities 20,001-33,945)
- `/sitemap-countries.xml` (242 countries)
- `/sitemap-timezones.xml` (408 tzs)
- `/sitemap-index.xml` (master)

Each sitemap ≤ 50,000 URLs (Google limit).

## hreflang for 14 languages

Each city page should be available in 14 languages:
```
EN: /world-time/city/tampa/
ES: /es/world-time/city/tampa/
PT: /pt/world-time/city/tampa/
FR: /fr/world-time/city/tampa/
DE: /de/world-time/city/tampa/
IT: /it/world-time/city/tampa/
NL: /nl/world-time/city/tampa/
PL: /pl/world-time/city/tampa/
JA: /ja/world-time/city/tampa/
ZH: /zh/world-time/city/tampa/
KO: /ko/world-time/city/tampa/
AR: /ar/world-time/city/tampa/
RU: /ru/world-time/city/tampa/
TR: /tr/world-time/city/tampa/
```

With `<link rel="alternate" hreflang="..." href="...">` in head.

## Open questions

1. **Auto-redirect or canonical for non-canonical URLs?**
   - Decision: canonical (Google prefers canonical over 301 in some cases)
2. **How to handle rare cities (population < 1000)?**
   - Decision: still get a page, but lower quality score in our internal ranking
3. **Sub-pages (sun, weather) for tiny cities?**
   - Decision: yes, but use cached data; only the main city page is static
