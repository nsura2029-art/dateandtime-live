# 3D Globe for TimeAndDatePro — Research & Plan

> Status: Research complete. Ready for Phase 0 kickoff.
> Compiled: 2026-07-18 (after user shared the YouTube reference video).

---

## 1. The reference video (what the user sent)

**URL:** https://www.youtube.com/watch?v=MeYdaNnXuHI (matches 3w3.org — "World Time 3D Globe")

### What I understand from the reference

The reference app (vClock/3w3-class world clock) shows an **interactive 3D globe** as the primary visual. The globe is:

- A **WebGL sphere** rendered with `three.js` (or a wrapper like `globe.gl` / `three-globe`)
- Likely using the **`solar-calculator`** package for sun position math, plus a custom **day/night shader** that blends two earth textures (one for day, one for night) based on the current sun position
- Equipped with **city markers** as data points on the sphere
- **Draggable** (rotate) + **scroll-zoomable** (wheel) + **clickable** (pick a city)
- Pairs with a **search** UI to fly the camera to any city
- Pairs with a **sidebar/list** of cities showing live local time
- Click a marker → select → it's added to the user's world clock / meeting plan

**Verdict — yes, 100% doable, and it's actually the canonical "best-in-class" interaction model for time-zone apps.** TimeTrex, 3w3.org, amCharts (toggle to 3D), webclock.online, Every Time Zone, World Time Buddy all use a globe as the primary interface. The pattern is proven.

---

## 2. Library options (the meaty part)

| Library | Bundle | Why pick it | Why not |
|---|---|---|---|
| **`globe.gl`** (vasturiano) | ~250 KB | High-level API. Built-in: day/night, sun terminator, atmosphere, clouds, city points, arcs, hex polygons, rings/ripples, click handlers, flyTo, OrbitControls. MIT. | Slow when zoomed in (FPS drops on high hex resolution). 2x slower than three-globe. |
| **`three-globe`** (vasturiano) | ~200 KB | Same features, lower level. You control the scene/camera directly. ~2x faster than globe.gl. | You write more glue code. |
| **`react-globe.gl`** | same as globe.gl | React 19 / Next.js bindings. State-driven (props = imperative calls). | Same perf ceiling as globe.gl. |
| **`cobe`** (shuding) | 5 KB | Beautiful, minimal, used by Vercel/Linear. | No interactivity, no markers, no flyTo. Just decoration. |
| **Cesium** | ~3 MB | True GIS — tiles, terrain, standards. | Overkill. Bundle too big. |
| **Mapbox globe view** | Mapbox SDK | Polished, vector. | Requires API key + has free-tier limits. 3D limited. |

**Recommendation: `react-globe.gl`** (or `globe.gl` if we keep vanilla). The day/night shader + city points + arcs + flyTo + click + sun terminator are all built in. We can ship Phase 1 in a week, Phase 4 in a month.

---

## 3. Reuse for World Clock & Timezone Converter

The same globe instance powers **all three tools**. This is the trick that makes the architecture clean:

```
                    ┌──────────────────────────────┐
                    │   <InteractiveGlobe>         │
                    │   (the single source of      │
                    │    truth for "where")        │
                    └──────────────────────────────┘
                                ▲
            ┌───────────────────┼───────────────────┐
            │                   │                   │
   ┌────────┴───────┐  ┌────────┴───────┐  ┌────────┴───────┐
   │  World Clock   │  │    Meeting     │  │   Timezone     │
   │                │  │    Finder      │  │   Navigator    │
   │ click → add    │  │ click 3 cites  │  │ click → set    │
   │ to favorites   │  │ → overlap      │  │ from/to        │
   └────────────────┘  └────────────────┘  └────────────────┘
```

**The same `<Globe>` component** is mounted in each page. The current city selection lives in a global store (Zustand or React context). Click on the globe → updates the store → the page below reacts.

---

## 4. Use case inventory (the deep research)

### 4.1 Core (Phase 1 — ship in 7 days)

| # | Use case | How the globe participates | Output |
|---|---|---|---|
| 1 | **View** | Static globe with day/night terminator, auto-rotate on idle | First impression |
| 2 | **Click any city** | Raycast pick on point cloud → select | Adds to local selection state |
| 3 | **Click anywhere** | Raycast on sphere surface (lat/lng) → look up nearest city + timezone | Snaps to nearest known city |
| 4 | **Hover** | Tooltip with name + live time + UTC offset | Sidebar tooltip |
| 5 | **Search** | Type "Tokyo" → flyTo + highlight pulsing ring | Camera animation |
| 6 | **Pinned cities** | Render larger pulsing markers for user's saved cities | Visual "these are my cities" |

### 4.2 Tool integration (Phase 2 — ship in 14 days)

| # | Use case | Globe role |
|---|---|---|
| 7 | **World Clock — add city** | Click marker → adds to world clock list + saves to KV |
| 8 | **Meeting Finder — multi-select** | Click 3 cities → highlights 3 with arcs between them + shows overlap time window below |
| 9 | **Timezone Navigator — from/to** | Click any point → sets "from" timezone; click again → sets "to" |
| 10 | **Visualize day/night** | Side panel "click here to scrub time" → see where on Earth it's 9 AM right now |
| 11 | **Time scrubber** | Drag a slider → terminator line moves, all city times update |
| 12 | **Sun position** | Show a small sun icon at the sub-solar point; tooltip on hover |

### 4.3 Advanced (Phase 3 — ship in 30 days)

| # | Use case | Globe role |
|---|---|---|
| 13 | **Time zone heatmap** | Color each timezone region by current local hour (rainbow gradient) |
| 14 | **Work hours heatmap** | Color by whether it's work hours (green) / lunch (amber) / off (gray) |
| 15 | **DST transition warning** | Highlight zones in DST transition (Samoa jump, etc.) |
| 16 | **Compare two times** | Side-by-side or split globe: "what does the world look like at 9 AM Tokyo vs 9 AM Berlin" |
| 17 | **Route arcs (great circle)** | Show a flight path between two selected cities with distance + flight time |
| 18 | **Holiday layer** | Highlight countries currently celebrating a holiday |

### 4.4 Nice-to-haves (Phase 4 — opportunistic)

| # | Use case | Globe role |
|---|---|---|
| 19 | **3D extruded markers** | Bars on top of cities showing timezone offset height |
| 20 | **Audio cue on the hour** | Optional chime from the sub-solar longitude (sundial mode) |
| 21 | **AR mode** | Drop the globe on the floor with WebXR (probably not worth it) |
| 22 | **Globe themes** | Political map / terrain / dark topo / vintage 17th century |

---

## 5. Phased todo list

### Phase 1 — Foundation (1 week)

- [ ] Install `react-globe.gl` (or `globe.gl` vanilla) and `three`
- [ ] Create `<InteractiveGlobe>` component in `src/components/globe/`
- [ ] Load Earth textures: day (`earth-blue-marble.jpg`), night (`earth-night.jpg`), bump (`earth-topology.png`)
- [ ] Configure globe: atmosphere, background, auto-rotate, OrbitControls with damping
- [ ] Day/night shader via `solar-calculator` for sun position
- [ ] Load city dataset (start with the existing 190 cities in `cities.js`, expand to 5,000+)
- [ ] Render city points layer (`pointsData`, `pointLat`, `pointLng`, `pointColor`, `pointAltitude`, `pointRadius`)
- [ ] Hover handler: tooltip with city + live time + UTC offset
- [ ] Click handler: select city, fly camera, emit event
- [ ] `flyTo({ lat, lng, altitude })` for search
- [ ] `prefers-reduced-motion` support (no auto-rotate)
- [ ] Loading state (skeleton with spinning ring)
- [ ] Error state (WebGL unsupported → fallback to 2D map)

### Phase 2 — Search & Navigation (1 week)

- [ ] Autocomplete search input (typeahead)
- [ ] Search index: trie or FlexSearch over city names + aliases
- [ ] Search → flyTo with marker pulse
- [ ] Pulse animation: ripple ring expanding from city (built-in `ringData`)
- [ ] Saved cities: render larger markers, click to remove
- [ ] Side panel list: synced with globe clicks (selecting on globe highlights in list, vice versa)
- [ ] Mobile gestures: pinch-zoom, touch-drag-rotate
- [ ] Keyboard nav: arrow keys rotate globe, Tab moves through markers

### Phase 3 — Tool integration (1 week)

- [ ] Wire into **World Clock** page: click marker → add to clock list
- [ ] Wire into **Timezone Navigator** page: click → sets from/to
- [ ] Wire into **Meeting Finder** page: click 3 cities → highlight + arcs + compute overlap
- [ ] Time scrubber: drag a slider, terminator updates, all city times update
- [ ] URL state: `?globe=40.7,-74.0&zoom=2` deep-link to a city view
- [ ] Share button: copy URL with current selection

### Phase 4 — Polish (1 week)

- [ ] Performance: InstancedMesh for markers, reduce hex resolution on zoom out
- [ ] Time zone heatmap layer (toggle)
- [ ] Work hours heatmap layer (toggle)
- [ ] Atmosphere tuning (fresnel + rayleigh)
- [ ] Stars background (subtle, not "outer space tacky")
- [ ] Reduce motion: disable animations, static terminator
- [ ] Server-side: cache city list, ship as static JSON
- [ ] Bundle audit: lazy-load globe (only on routes that need it)

---

## 6. Data sources

| Data | Source | License |
|---|---|---|
| 190 cities | existing `cities.js` in timeanddatepro | our own |
| 5,000 cities | `joelacus/world-cities` (CC-BY 4.0) or `simplemaps.com/world-cities` (free w/ attribution) | CC-BY |
| 150,000 cities (premium) | `simplemaps` paid ($39 one-time) | commercial OK |
| Timezone polygons | `candu/efele-tz-world-geojson` (public domain) | public domain |
| IANA timezone lookup | built into `Intl.DateTimeFormat` | built-in |
| Sun position | `solar-calculator` npm (MIT) | MIT |

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| WebGL not supported | Feature-detect, fall back to 2D map (Leaflet) |
| Mobile perf | Reduce texture resolution, use `cobe` for mobile if FPS < 30 |
| Globe.gl is 2x slower than three-globe | If FPS drops, swap to three-globe + write our own thin React wrapper |
| Bundle size (250 KB+) | Lazy-load globe on routes that need it (dynamic import) |
| iOS Safari touch quirks | Test early; add `touch-action: none` on canvas |
| DST transition edge cases | Defer to `Intl.DateTimeFormat`; test around March/Nov boundaries |

---

## 8. What I'd ship in the next 7 days (proposal)

Day 1–2: `<InteractiveGlobe>` component with day/night + 190 cities + hover tooltip
Day 3: Click handler + city selection + flyTo
Day 4: Integrate with **World Clock** page (click → add city)
Day 5: Integrate with **Timezone Navigator** page (click → set from/to)
Day 6: Search input + autocomplete + flyTo
Day 7: Polish, mobile, reduced-motion, deploy to dev

Then iterate on Meeting Finder (Phase 3).

---

## 9. Open questions for the user

1. **react-globe.gl or vanilla globe.gl?** — The user's repo is Vite/React 19 SPA, so react-globe.gl is the natural fit. But vanilla gives us more control.
2. **Phase 1 first or full architecture first?** — I'd recommend the simple integration (just add to World Clock) over a full refactor.
3. **Static export or do we need SSR?** — Cloudflare Pages + RSC, so probably fine.
4. **Do we want all 5,000 cities or just the 190 we have?** — 5,000 is great, 150K is overkill.
5. **Day/night texture quality?** — Free Blue Marble is fine for MVP; premium (NASA Visible Earth) for polish.

---

## 10. Time font correction

**The previous font (DSEG7-Classic) is wrong.** Looking at the vClock reference, the actual font is a **clean digital LCD/LED alarm clock font** with:

- **Blue rectangle background** (~#1d3eb5)
- **Time digits in white** (the "9:23:56 AM" part)
- **Date in orange** (#f97316-ish, the LED alarm color)
- Smooth rounded "9", clean "AM" letterforms, NOT the chunky 7-segment-with-bars look

The correct font is most likely **DS-Digital** by Digital Studio, or possibly **Digital-7** by Style-7. Will fix in the v2 HTML.

**Note on Google Fonts alternatives** (free, similar vibe):
- Share Tech Mono (close, free)
- VT323 (terminal, similar weight)
- Major Mono Display (retro, free)
- Source Code Pro (clean monospace)
- JetBrains Mono (modern monospace, what we already use)

For pixel-perfect vClock look, we need a paid font. Free options are good-enough approximations.
