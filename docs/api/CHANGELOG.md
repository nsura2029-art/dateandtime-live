# API Changelog

## 2026-07-19 — Phases 2/4/6/7 endpoints wired up

**Commit:** `e48a0fe` — `feat(api): wire up deferred endpoints for Phases 2/4/6/7`

The data layer for Phases 2/4/6/7 shipped 2026-07-19 but no API endpoints
exposed it. This release wires up 13 new endpoints (in `src/deferred-routes.ts`,
mounted at `/api/v1`). All read from the live `timeandtimepro-full` D1.

### New endpoints (13)

| Path | Phase | What |
|---|---|---|
| `GET /api/v1/holidays/today?country=US` | 2 | Today's holidays (was placeholder) |
| `GET /api/v1/holidays/upcoming?country&days` | 2 | Upcoming holidays (next 30/60/365 days) |
| `GET /api/v1/holidays?country&year` | 2 | All holidays for a year (was placeholder) |
| `GET /api/v1/countries/:cca2/working-hours` | 2 | Business calendar (work days, hours, lunch, siesta) |
| `GET /api/v1/onthisday?month&day` | 2 | On-this-day events (was placeholder) |
| `GET /api/v1/dst/upcoming?tz=` | 4 | Next DST transition for an IANA tz |
| `GET /api/v1/cities/:id/climate?month=` | 4 | Climate data for a city (12 months + seasons) |
| `GET /api/v1/cities/:id/aliases` | 6 | Modern aliases + historical place_redirects |
| `GET /api/v1/countries/:cca2/cities?admin1=` | new | All cities in a country (optionally filtered by admin1) |
| `GET /api/v1/admin/data-quality` | 7 | Run all 10 data quality checks |
| `POST /api/v1/feedback/:id/vote` | 7 | Vote on feedback (deduped via SHA-256 of IP+UA) |
| `GET /api/v1/feedback/top` | 7 | Top voted feedback (filter by type/status) |

### Removed
- The 3 placeholder handlers for `holidays/today`, `holidays`, `onthisday` — now live in `deferred-routes.ts` and read from the real tables.

### HEAD support
11 new `HEAD` routes added so the landing's feature-flag probes return 200 and the corresponding UI can show.

### Pattern: deferred sub-router
The new endpoints live in `src/deferred-routes.ts` and are mounted via
`app.route("/api/v1", deferred)`. This keeps the main `index.ts` lean
and isolates the deferred logic.

### Verified
All 13 endpoints tested against the live prod API (`api.dateandtime.live`).
Type-checks clean, deployed to dev (`dev.api.dateandtime.live`) and prod.
