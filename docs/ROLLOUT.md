# Production Rollout — feature by feature

> The landing page is **production-only**. The dev API is purged from all
> deployed files. We do **not** big-bang deploy; each feature lights up
> when its corresponding endpoint ships to `https://api.dateandtime.live`.

## How the page works today

On every page load, the script runs `HEAD` probes against the four
non-core endpoints. If the endpoint returns `200`, the feature shows.
If it returns `404`, the feature hides gracefully (no error in the UI,
no broken layout). This is a **client-side feature flag** driven by the
API's own surface area.

## Endpoint status (as of 2026-07-11)

| Endpoint            | Prod status | Feature it lights up                | Where in the page          |
|---------------------|-------------|-------------------------------------|----------------------------|
| `/v1/cities`        | ✅ live     | The 5 default cities                | Hero rail (always visible) |
| `/v1/time/now`      | ❌ 404      | Sync accuracy line                  | Below day/date + tz        |
| `/v1/time/sun`      | ❌ 404      | Sunrise / sunset pill               | Right after off-hours pill |
| `/v1/onthisday`     | ❌ 404      | "On this day in …" line             | Below the sync row         |
| `/v2/search`        | ❌ 404      | City search bar (currently a note)  | Above the favorite cities  |

## Rollout queue (in order)

1. **Cities** — ✅ done. The page renders the home + 5 defaults.
2. **Sync** — `GET /v1/time/now?tz=UTC` returns `{ data: { iso, unix_ms, tz } }`. When it lands on prod, the "Your clock is X seconds behind · Accuracy ±X.XXX" row appears.
3. **Sun** — `GET /v1/time/sun?lat=…&lon=…&date=YYYY-MM-DD` returns `{ data: { sunrise_utc, sunset_utc, … } }`. The page converts UTC → home-city-local and renders the pill.
4. **On-this-day** — `GET /v1/onthisday?month=…&day=…` returns curated events; the first event becomes the line.
5. **Search** — `GET /v2/search?q=…&limit=8` returns `{ data: { results: [...] } }`. The search bar becomes interactive; clicking a result adds the city to the rail.

## Adding an endpoint to production

When you deploy a new endpoint to `https://api.dateandtime.live`, the
landing page picks it up automatically on the next refresh. **No code
change, no deploy needed.** Just verify with `curl`:

```bash
curl -I https://api.dateandtime.live/v1/time/now
# expect: HTTP/2 200
```

If the page doesn't pick it up:

1. Open DevTools → Network → look for the HEAD request
2. Confirm it's not cached (`Cache-Control: no-store` is set)
3. Confirm the endpoint is on the same origin (no redirect)

## How to disable a feature manually

If you want to hide a feature without removing the endpoint, set its
`state.features.X = false` in the script, or add `?disable=sync,sun` to
the URL (this is a future hook, not implemented yet).

## When the page is "feature complete"

When all 5 endpoints are live on prod, the page shows the full hero:

- Greeting
- Subtitle
- 7-seg clock + 12h/24h toggle
- Day / date / tz
- **Sync row** (live)
- **On-this-day** (live)
- **Off-hours + Sunrise pills** (live)
- **Search bar** (interactive)
- **5 default cities** (live)
- Ad slot
- Current city footer

That's the moment we cut the dev API entirely from internal docs and
move on to the next page (e.g. `/meeting-finder/`, `/world-clock/`).
