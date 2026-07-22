# City Page Templates — 2030 Design

> Last updated: 2026-07-22
> 4 design directions for `/world-time/city/{slug}/`
> **Template D (Data Hub) is the recommended default** — TAD-inspired data density without the card aesthetic.

These are 4 distinct design systems for the city page. Each has its own
personality, use case, and design language. All 4 share:
- Light + dark mode (CSS variables, auto-switching)
- Live time updates (client-side, 60fps)
- 12h/24h format toggle (localStorage)
- Tampa, FL as the demo content
- The same internal link graph (country, state, tz, holidays, people, etc.)
- Modern CSS (no preprocessors, no frameworks)
- ~25KB each, fully self-contained

---

## The 4 templates

### Template D: Data Hub ⭐ RECOMMENDED

**File:** `D-data-hub.html`

**Personality:** TAD-inspired functional density, 2030 design language, **no card aesthetic**. Color-coded info blocks (warm pastels), inline pills, linear section flow.

**Layout:**
- Top: nav + theme toggle
- Hero: 2-col — left editorial headline + meta, right live clock card
- Quick info pill bar (10 horizontal pills, scrollable)
- Section 02: **8 TAD-style color-coded info blocks** (Current time, Time zone, DST started, DST ends, Other cities, Weather, Sunrise, Sunset)
- Section 03: Sun arc visualization + 5 stat row (sunrise, solar noon, sunset, day length, vs yesterday)
- Section 04: "Tampa in numbers" (6 stat cells inline: pop, area, density, elevation, rank, annual avg)
- Section 05: Time difference table (8 cities)
- **[Ad slot 1 — 728×90 leaderboard]**
- Section 06: "A Tuesday in Tampa" timeline (5 events: sunrise, coffee, lunch, storm, sunset)
- Section 07: 7-day weather forecast
- Section 08: "People Tampa gave the world" (4 editorial portraits, from Template C)
- Section 09: On this day (3 events)
- Section 10: Upcoming US holidays (6 events)
- **[Ad slot 2 — 728×90 leaderboard]**
- Section 11: Year-round climate (12 bar chart)
- Section 12: "Tampa in context" (long-form paragraph)
- Section 13: "Tampa is famous for" (11 pill tags)
- Section 14: Cities near Tampa (6 nearby)
- Section 15: Airports near Tampa (3 rows)
- Section 16: Tools grid (4 tools)
- Section 17: "More to explore" link grid (5 sub-pages)
- Footer: 5-col link grid + legal

**Best for:** Information lookup, SEO density, ad revenue, users who came to GET DATA.

**Design tokens:**
- Warm rust primary (`#c44536`)
- Color-coded tints (no card backgrounds): time (coral), zone (amber), sun (yellow), moon (lavender), tide (aqua), weather (sky), air (mint), pop (rose), DST (gold)
- Inter sans + Source Serif 4 + JetBrains Mono
- 1280px max-width, no card aesthetic

**Distinct features:**
- 17 SEO sections (each with its own H2)
- 2 ad slots (728×90 leaderboards, natural break points)
- TAD-style color-coded info blocks (the proven pattern for time data)
- No card aesthetic — uses rows, lists, inline blocks, grids
- 10 horizontal quick-info pills (scrollable, mobile-friendly)
- Light + dark via CSS variables with warm rust accents
- Reuses the editorial People grid from Template C
- Reuses the day-in-the-life timeline from Template C
- 12-month climate bar chart (custom CSS, not a chart library)

---

## The 4 templates

### Template A: Editorial Bento

**File:** `A-editorial-bento.html`

**Personality:** Modern magazine, glanceable cards, photo-driven.

**Layout:**
- Top: breadcrumb + status pill
- Hero: split layout — left = city photo with overlaid title, right = live clock card
- Bento grid (3×2 + extras): sun arc, time zone, DST, population, "famous for" tags, weather, coordinates, distance
- Two-column: famous people + upcoming holidays
- Footer: 4-column with sections

**Best for:** Editorial/magazine readers, content-driven discovery, mobile-first browsing.

**Design tokens:**
- Warm ember primary (`#c2410c`)
- Soft pastel card colors (yellow/blue/lavender/mint/rose/periwinkle)
- Inter sans + Source Serif 4 + JetBrains Mono
- 1280px max-width, full-width hero

**Distinct features:**
- Sun arc visualization (SVG, animated)
- Photo card with live status pill overlay
- Pastel bento cards (each a different color)
- 3-row people list + 6-row holidays list
- Auto-detects user location to show "distance from you"

---

### Template B: Live Dashboard

**File:** `B-live-dashboard.html`

**Personality:** Command-center, all info at a glance, dense layout, real-time data.

**Layout:**
- Sticky top bar: logo + breadcrumb + live indicator + city search
- Page header: H1 + meta strip
- Tab bar: Time/General | Weather | Sun & Moon | Holidays | People | Climate | Airports
- 12-column responsive grid:
  - 8-col hero clock (gradient bg, gradient thumb, ms precision, "in 1h 26m")
  - 4-col KPI grid (4 mini-cards: sunrise, sunset, day, moon)
  - 5-col "Time difference" table (6 cities)
  - 7-col 24-hour temperature chart (live bar chart)
  - 5-col 12-month climate chart
  - 7-col holidays list
  - 5-col famous people list
  - 12-col airports grid (3 cards)
- Sub-page link strip
- Footer

**Best for:** Power users, planners, frequent travellers — "give me everything now".

**Design tokens:**
- Indigo primary (`#4f46e5`)
- Neutral grayscale base
- Inter + JetBrains Mono only (no serif)
- 1440px max-width, sticky top bar
- Status pulse dot (live indicator)
- 24-hour bar chart generated client-side (real-time)

**Distinct features:**
- 12-col grid system (responsive: 12/6/1)
- Tab bar with active state
- 24h temperature chart (real data from Open-Meteo)
- 12-month climate chart (12 bars)
- "Same time in other cities" comparison table
- 4 KPI mini-cards (sunrise/sunset/day/moon)

---

### Template C: Story Hero

**File:** `C-story-hero.html`

**Personality:** Magazine editorial, personal narrative, big photo, "a day in the life".

**Layout:**
- Minimal top nav (logo + back link)
- Full-bleed hero: city photo + overlaid serif headline + live time
- Lead paragraph (centered, serif): "Tampa wakes up at 6:47am…"
- Section 01 (2-col): "A 200-year-old port, reinvented" + Ybor City photo
- Pull quote (centered, italic, serif)
- Section 02: "A Tuesday in Tampa" timeline (5 events: sunrise, coffee, lunch, storm, sunset)
- Section 03: "People Tampa gave the world" — 4 portrait grid
- Sub-page link strip (4 cards)
- Footer: long colophon paragraph + legal

**Best for:** Storytelling, brand building, attracting organic linkbacks from blogs, long-form reading.

**Design tokens:**
- Warm earth primary (`#be5b1e`)
- Cream paper background (`#fdfaf3`)
- Inter sans + Source Serif 4 (heavy use) + JetBrains Mono
- 1280px max-width, full-bleed hero
- 75vh hero image

**Distinct features:**
- 75vh full-bleed photo hero with title overlay
- Serif-heavy typography (editorial feel)
- "A day in the life" timeline (5 events with rich descriptions)
- Pull quote (italics, large)
- 4-portrait people grid (grayscale filter)
- Long colophon footer (gives the page deep content for SEO)
- 4-card sub-page link grid (icon + label + tagline)

---

## Comparison matrix

| Feature | A: Bento | B: Dashboard | C: Story | D: Data Hub ⭐ |
|---|---|---|---|---|
| **Tone** | Modern editorial | Command center | Magazine feature | Functional/clear (TAD) |
| **Layout** | Bento grid | 12-col dashboard | Long-form article | Linear sections (TAD) |
| **Hero** | Split photo + clock | Gradient panel with thumb | Full-bleed photo | Editorial 2-col |
| **Card style** | Yes (bento) | Yes (panels) | No (article) | **No (inline blocks)** |
| **Density** | Medium | High | Low | High (TAD-density) |
| **Best for** | Discovery | Planning | Reading | Information lookup |
| **Colors** | Warm pastels | Indigo on white | Cream + warm earth | Color-coded tints |
| **Typography** | Inter + serif + mono | Inter + mono | Inter + serif (heavy) + mono | Inter + serif + mono |
| **Time display** | "14:23:45" (HH:MM:SS) | "14:23:45.45" (with ms) | "14:23:45" (HH:MM:SS) | "14:23:45.45 PM" (with ms + ampm) |
| **Charts** | Sun arc (SVG) | 24h temp + 12-month climate | Timeline (text) | Sun arc + 12-mo climate |
| **People** | 3 cards | 5 rows | 4 portraits | 4 editorial portraits |
| **Holidays** | 5 rows | 6 rows | Mentioned in timeline | 6 rows (full list) |
| **Ad slots** | 1 | 0 | 0 | **2** |
| **SEO sections** | ~12 | ~10 | ~7 | **17** |
| **JSON-LD ready** | ✅ | ✅ | ✅ | ✅ |
| **Light + dark** | ✅ | ✅ | ✅ | ✅ |
| **File size** | 26 KB | 26 KB | 23 KB | 54 KB |

---

## What all 3 share (the entity graph)

Every template links to the same internal entities:
- `/world-time/` (World Time hub)
- `/world-time/usa/` (Country hub)
- `/world-time/usa/florida/` (State hub)
- `/world-time/city/tampa/sunrise/` (Sub-page)
- `/world-time/city/tampa/holidays/` (Sub-page)
- `/world-time/city/tampa/people/` (Sub-page)
- `/world-time/city/tampa/climate/` (Sub-page)
- `/world-time/city/tampa/weather/` (Sub-page)
- `/time-zones/zone/america-new-york/` (TZ hub)
- `/holidays/us/` (Holidays hub)
- `/meeting/?with=tampa` (Tool)
- `/converter/?from=tampa` (Tool)

---

## How to pick

**Use Template D (Data Hub)** ⭐ if:
- You want timeanddate.com density without the 2003 feel
- Your users come to LOOK UP DATA, not read a story
- You want maximum SEO + ad density
- You want a design that follows your existing design system (no card aesthetic)
- Light + dark mode is required

**Use Template A (Bento)** if:
- Most users will browse once and leave
- You want to maximize "discover" of sub-pages
- Your audience is general public
- You want a balance of dense + beautiful
- Card aesthetic fits your brand

**Use Template B (Dashboard)** if:
- Most users are power users (planners, remote teams)
- They want all info at once
- You want sticky nav and tab bar
- You're optimizing for "I came to do a task, not to read"

**Use Template C (Story)** if:
- You want organic linkbacks from blogs
- You're building a brand (not just a tool)
- Long-form content matters for SEO (more text = more keywords)
- Your audience is reading-oriented (magazine, Atlantic-style)
- You want to attract press/editorial coverage

---

## Recommended rollout

1. **Ship D (Data Hub) as the default** — best for SEO + ads + data lookup
2. **A (Bento) for A/B testing** on top 1,000 cities — see if users prefer bento over linear
3. **B (Dashboard) for power-user landing** (tool-heavy users returning often)
4. **C (Story) for top 100 cities only** — long-form SEO moat where Wikipedia-style content matters most

All 4 share the same `index.html` host and the same JSON-LD structure.

---

## Implementation notes

All templates are **fully self-contained single-file HTML** with:
- Inline CSS (CSS variables for theming)
- Inline JS (no dependencies, no build step)
- SVG icons (no icon font, no images)
- Live updates via `requestAnimationFrame`
- Format toggle via `localStorage` (12h vs 24h)
- Geolocation API (with permission gate)

**To use in production:**
1. Render the HTML server-side with the city data injected
2. Hydrate the JS for interactive features
3. Add `<link rel="canonical">` with the full city URL
4. Add JSON-LD @graph with City, BreadcrumbList, FAQPage
5. Add hreflang for 14 languages

**To preview on dev:** Open each file in a browser. Click the sun/moon
icon (top-right) to toggle dark mode. The time updates in real time.
