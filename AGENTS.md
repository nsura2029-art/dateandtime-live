# TimeAndDatePro — Agent Guide

> Read this before designing, building, or modifying **any** page on `dateandtime.live`.
> This file is the source of truth for the visual & product direction.

---

## Design rules (apply to **every** page)

### 1. **No cards.** Ever.
- Use the **page background** (white in light mode, deep purple in dark mode) as the canvas.
- Use **whitespace, type, color, dividers** — never a bordered, rounded, shadowed box.
- The only "containers" allowed are the **time-card and onthisday** floating rows, but they are **flat panels** (no border, no shadow, no rounded box). Use them sparingly.
- **Forbidden**: `border-radius` + `border` + `background-color` + `box-shadow` on a child that is a stand-alone group. Use spacing instead.
- If you need visual separation, use a **hairline divider** (`1px solid var(--color-border-soft)`), generous vertical rhythm, or a subtle background tint via `color-mix(in srgb, var(--color-primary) 4%, transparent)`.

### 2. **Mobile first. Always.**
- Write the **smallest screen** CSS first, then `@media (min-width: …)` to expand.
- **Breakpoints**:
  - **Base / phone**: `<= 760px` — the default
  - **Tablet**: `761px – 1023px`
  - **Desktop**: `1024px – 1279px`
  - **Wide**: `>= 1280px`
- **Touch targets**: minimum 44×44 px.
- **Type scale**: test at 360 px wide. Headlines must never horizontally overflow.
- **Stack vertically** on phone, then reflow on larger screens.

### 3. **Ad sense — real placements, not afterthoughts.**
- **Reserve ad slots in the layout** at design time. Don't bolt them on later.
- **Standard sizes** (Google AdSense default):
  - **Leaderboard** — 728×90 (desktop), 320×50 (mobile)
  - **Medium rectangle** — 300×250 (universal)
  - **Half-page** — 300×600 (sidebar, desktop only)
- **Where**:
  - **Below the hero / above the city list** — one leaderboard or medium rectangle, centered, max-width capped
  - **Between city sections** — one leaderboard, full-width
  - **Sidebar** (desktop ≥ 1024px only) — half-page
- **How to mock**: a flat rectangle with `var(--color-page-texture)` background, a small "Ad" label in `var(--color-muted-soft)`, a 1px hairline border, **no shadow, no rounded corners larger than 8px**, sized exactly to the ad unit. The mockup is **visually quiet** so the real ad lands gracefully.
- **Ad label is mandatory** (`Advertisement` or `Sponsored`) — required by AdSense policy.

### 4. **Hero section contents** (landing page)
- **Top-to-bottom order**:
  1. **Greeting** — `Good {Morning|Afternoon|Evening|Night}, {City}` (auto from local time)
  2. **Subtitle** — single-line value prop
  3. **7-segment clock** (HH:MM:SS.MS + AM/PM) — the hero's centerpiece
  4. **Day + date + timezone** — `Saturday, July 18, 2026 · EDT UTC-04:00`
  5. **Sync accuracy** — `Your clock is X.X seconds behind. Accuracy ±0.123s.`
  6. **Off hours / Sunrise–sunset pills** — three inline pills (green / purple / orange)
  7. **City list** — 5 cities, user's **home at the top**, each row: name · live time · timezone
  8. **+ Add city** — last item in the list
  9. **Current location** — `Current time in {City}, {Region}`
- **All of this lives in the hero section**. No separate sections, no scrolling required to see it all on a 360×640 phone.

### 5. **5 cities + add-your-own pattern**
- **Default 5** (when user has no saved list):
  1. User's **home** (auto-detected: geolocation → IANA tz → fallback)
  2. New York
  3. London
  4. Tokyo
  5. Sydney
- **User can add**: search via `/api/v2/search` → click result → prepend or append → save to `localStorage`.
- **User can remove**: `×` button on each city (except home, which is locked).
- **Home is dynamic** — re-detected on first visit, then locked. User can re-pick via the search by clicking a "Set as home" affordance.
- **Persistence**: `localStorage.tdp-cities` (array of city objects, normalized shape).

### 6. **Widgetly + NotebookLM design tokens**
- **Always** import the token block from `index.html` (or `design-system/index.html`).
- **No new colors** without adding them to the token system first.
- **No new type scales** — use `clamp(…)` with the existing scale.
- **No new component styles** without a reference in `design-system/`.

### 7. **Live data only**
- **Time**: `new Date()` in the browser, `requestAnimationFrame` for 60fps tick.
- **Per-city time**: computed in the browser with `Intl.DateTimeFormat` + the city's IANA tz.
- **Sync accuracy**: round-trip against `/api/v1/time/now?tz=UTC`.
- **Sunrise / sunset**: `/api/v1/time/sun?lat=…&lon=…&date=YYYY-MM-DD`, convert UTC → city-local.
- **City search**: `/api/v2/search` (handles 13 edge cases: aliases, fuzzy, diacritics, disambiguation).
- **City data**: `/api/v1/cities?limit=200` (cached in `localStorage`).
- **On-this-day**: `/api/v1/onthisday?month=…&day=…` (curated, may be empty for some dates — handle gracefully).
- **No new endpoints** without updating `docs/api/`.

### 8. **3D globe page (parked)**
- Lives at `/globe/`. **Do not modify** until the user resumes that thread.
- The landing page (`/`) is the active focus.

### 9. **Page hierarchy**
- `/` — landing (this is the active design)
- `/design-system/` — Widgetly + NotebookLM token reference
- `/globe/` — parked, don't touch
- `/docs/api/` — Postman collection + endpoint map

---

## Quick checklist for any new page or component

- [ ] No card chrome (no border + radius + shadow on a stand-alone group)
- [ ] Mobile-first CSS (write phone styles first, then `@media (min-width: …)`)
- [ ] Type, spacing, color from the Widgetly + NotebookLM tokens
- [ ] All hero content visible on a 360×640 phone without scrolling
- [ ] If a real page: one **reserved ad slot** in the layout (with a mock placeholder)
- [ ] 5 cities visible by default + add-your-own search (landing)
- [ ] User's home at the top of the city list
- [ ] All times computed from `new Date()` or `Intl.DateTimeFormat` with the city's IANA tz
- [ ] No new endpoints without updating `docs/api/`
- [ ] No changes to `/globe/`

---

## File map

```
dateandtime-live/
├── index.html              ← landing (active)
├── design-system/index.html
├── globe/index.html        ← parked
├── docs/api/
├── favicon.svg
├── src/index.js
├── wrangler.toml
└── AGENTS.md               ← this file
```
