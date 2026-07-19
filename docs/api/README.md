# TimeAndDatePro API — Reference

> **Source of truth**: `timeanddatepro-api.postman_collection.json` (the full Postman v2.1.0 collection, 46+ endpoints)
> **Base URLs**:
> - **Dev**: `https://dev.api.dateandtime.live`
> - **Prod**: `https://api.dateandtime.live`
> - **Workers.dev fallback**: `https://datetime-api-dev.nsura2029.workers.dev`
> - **Local** (Wrangler): `http://localhost:8787`

## Endpoint map (from the Postman collection)

| # | Group | Path | What it does |
|---|---|---|---|
| 1 | **System** | `GET /` | API info |
| 2 | | `GET /api/v1` | Full endpoint list |
| 3 | | `GET /api/v1/health` | Health check |
| 4 | **v2 Search** | `GET /api/v2/search?q=…&limit=…&country=…&tz=…&locale=…&near=…&exclude=…` | Smart search — handles 13 edge cases: disambiguation (Hyderabad, Springfield, York), aliases (NYC→New York, Bombay→Mumbai), fuzzy match (Londn→London), diacritics (München, São Paulo), hard filters (London ON / London GB), timezone search, locale-aware, location boost, exclude |
| 5 | **v1 Cities** | `GET /api/v1/cities?limit=…` | List bundled cities |
| 6 | | `GET /api/v1/cities/:slug` | Single city by slug |
| 7 | | `GET /api/v1/cities/live?codes=NYC,LON,TOK` | Live time for multiple cities |
| 8 | | `GET /api/v1/cities/search?q=…&limit=…` | Simple search |
| 9 | **v1 Time** | `GET /api/v1/time/now?tz=…` | Current time in a tz |
| 10 | | `GET /api/v1/time/convert?from=…&to=…&time=…` | Convert time between zones |
| 11 | | `GET /api/v1/time/diff?from=…&to=…` | Days between two dates |
| 12 | | `GET /api/v1/time/add?date=…&days=…` | Add days to a date |
| 13 | | `GET /api/v1/time/unix` | Current unix timestamp |
| 14 | | `GET /api/v1/time/iso?tz=…` | Current ISO 8601 |
| 15 | | `GET /api/v1/time/words?date=…&lang=…` | Date → words |
| 16 | | `GET /api/v1/time/sun?lat=…&lon=…&date=…` | Sunrise / sunset |
| 17 | **v1 Countries** | `GET /api/v1/countries?limit=…&region=…` | List 194 countries |
| 18 | | `GET /api/v1/countries/:cc` | Single country (cca2) |
| 19 | | `GET /api/v1/countries/USA` | Single country (cca3) |
| 20 | | `GET /api/v1/countries/:cc/cities?limit=…` | Cities in a country |
| 21 | | `GET /api/v1/countries/:cc/working-hours` | Working hours for a country |
| 22 | **v1 Popular** | `GET /api/v1/popular/cities?limit=…&country=…` | Famous cities |
| 23 | | `GET /api/v1/popular/defaults` | Default popular list |
| 24 | **v1 Holidays** | `GET /api/v1/holidays/today?country=…` | Today's holiday |
| 25 | | `GET /api/v1/holidays/upcoming?country=…&days=…` | Upcoming holidays |
| 26 | | `GET /api/v1/holidays/year?country=…&year=…` | Year's holidays |
| 27 | **v1 DST** | `GET /api/v1/dst?tz=…` | DST status for a tz |
| 28 | | `GET /api/v1/dst/upcoming?tz=…` | Next DST change |
| 29 | **v1 Quotes** | `GET /api/v1/quotes/random` | Random time quote |
| 30 | | `GET /api/v1/quotes/ranked?limit=…` | Top quotes |
| 31 | **v1 OnThisDay** | `GET /api/v1/onthisday?month=…&day=…` | Historical events for a date |
| 32 | **v1 Currency** | `GET /api/v1/currency/rates?base=…` | Currency rates |
| 33 | | `GET /api/v1/currency/convert?from=…&to=…&amount=…` | Currency conversion |
| 34 | | `GET /api/v1/currency/codes` | All currency codes |
| 35 | **v1 Browse** | `GET /api/v1/browse/home` | Home page data |
| 36 | **v1 Pairs + Meeting** | `GET /api/v1/pairs/:a/:b` | Time pair between two cities |
| 37 | | `GET /api/v1/meeting/best?participants=…&duration=…` | Best meeting time |
| 38 | **v1 Feedback** | `GET /api/v1/feedback?limit=…` | List feedback |
| 39 | | `GET /api/v1/feedback/top?limit=…` | Top voted feedback |
| 40 | | `POST /api/v1/feedback` | Create feedback entry |
| 41 | | `POST /api/v1/feedback/:id/vote` | Upvote |
| 42 | | `DELETE /api/v1/feedback/:id` | Soft-delete |

## How the 3D globe page uses this

`globe/index.html` (deployed at `https://dateandtime.live/globe/`) currently calls:

```js
const API_URL = 'https://api.dateandtime.live/v1/cities';
```

**Available to wire in next** (no new code needed — just call them):
- `/api/v1/cities/live?codes=NYC,LON,TOK` — server-side live time (no JS time math)
- `/api/v2/search?q=…` — better search (handles 13 edge cases) instead of client-side `.includes()`
- `/api/v1/pairs/NYC/LON` — time pair between pinned cities
- `/api/v1/meeting/best?participants=…` — meeting finder
- `/api/v1/holidays/today?country=…` — today's holiday on the dashboard
- `/api/v1/time/sun?lat=…&lon=…&date=…` — proper sunrise/sunset for any city
- `/api/v1/dst?tz=…` — DST status to show on each city

## Import into Postman

1. Postman → **File** → **Import**
2. Drag `timeanddatepro-api.postman_collection.json` in
3. The 3 environment variables are already in the collection:
   - `base` → `https://dev.api.dateandtime.live` (change to prod if needed)
   - `workers` → `https://datetime-api-dev.nsura2029.workers.dev`
   - `local` → `http://localhost:8787`
