# Landing page redesign — research & 3 design proposals

> The user's brief: **no cards, mobile-first, ad-sense aware, hero section holds everything (clock + location + day/timezone + off hours + sunrise/sunset), 5 cities by default + add-your-own, home at top.**

## Analysis of the current landing (`/index.html`)

| Element | Where it sits | Issue |
|---|---|---|
| Greeting `Good Evening, New York` | top of `<main>` (in `.hero` section) | fine |
| Subtitle | below greeting | fine |
| **Time card** (sync row + accuracy + "Time in [city] now:" + search input) | `<article class="time-card">` — a **bordered, blurred, rounded box** | **this is a card** — violates rule 1 |
| **7-segment clock** | inside the time card | cramped, the card's `padding` + `backdrop-filter` + `border` makes the clock feel boxed-in |
| **Search input** | inside the time card, on the right at desktop | on mobile, the search is **above** the clock — bad for the hero (search is utility, not centerpiece) |
| **Day + date + timezone** | **below the time card**, in a separate card | splits the "what time is it" answer across two cards |
| **On-this-day** | another `<article>` card | third card |
| **Pills row** | a `<div>` with no chrome — OK | ✓ this works as-is |
| **Current city footer** | a `<p>` inside a soft-border panel | mild card |
| **Footer** | `<footer>` (not present yet) | TBD |

### Pain points

1. **Three cards stack** (`time-card`, `onthisday`, `current-city`) on phone — requires scrolling, the user has to assemble the answer themselves.
2. **The clock is buried** inside a card. The clock is the hero's centerpiece — it should be **on the page**, not inside a box.
3. **Sync accuracy + day/date/timezone + sun/off hours are scattered** across 3 different visual treatments.
4. **No city list**. The user can search, but there's no persistent "my cities" rail. We promised 5 default + add-your-own.
5. **No ad slot reserved** — ads get bolted on later, break the layout.

---

## Design principles for the 3 proposals

All three follow these rules from `AGENTS.md`:

- **No card chrome**. Use the page background, hairlines, spacing, type.
- **Mobile-first**. Phone (≤ 760) is the default. Tablet / desktop add columns.
- **Ad slot reserved**. Each layout has at least one clearly-sized placeholder (728×90 desktop, 320×50 mobile, or 300×250 universal).
- **Hero holds everything** — clock + day/date/tz + sync + sun + off hours + 5-city list + add + current location, all visible on a 360×640 phone.
- **Widgetly + NotebookLM tokens** — light/dark, no new colors.
- **5 default cities + add-your-own** — New York / London / Tokyo / Sydney / user's home at the top.

---

## Proposal 1 — **"Rail"** (horizontal city strip)

> The hero is a **vertical stack**, but the **city times** are a **horizontal scrolling rail** (5 cities as a single row that scrolls on phone, wraps on desktop).

**Layout (top → bottom):**

```
┌─────────────────────────────────────┐
│ Good Evening, New York              │  ← greeting
│ Plan your day, meetings, holidays…  │  ← subtitle
│                                     │
│         08:42:38 .33 PM             │  ← 7-seg clock, hero centerpiece
│       Saturday, July 18, 2026       │  ← day/date
│       EDT · UTC-04:00               │  ← timezone
│                                     │
│  ● Your clock is 0.2s behind.       │  ← sync row
│  Accuracy of synchronization ±0.123s│
│                                     │
│  [Sync] [Off hours] [Sun ↑↓]        │  ← 3 inline pills
│                                     │
│  Cities                             │  ← small label
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ NYC │ │ LON │ │ TKY │ │ SYD │ → │  ← 5 cities, horizontal scroll
│  │ 8:42│ │ 1:42│ │ 9:42│ │10:42│   │     on phone, wraps on desktop
│  └─────┘ └─────┘ └─────┘ └─────┘   │
│  [ + Add city ]                     │  ← inline button
│                                     │
│  ┌─────────────────────────────┐    │
│  │     [ Ad — 728×90 / 320×50 ] │    │  ← ad slot #1
│  └─────────────────────────────┘    │
│                                     │
│  📍 Current time in Sydney, NSW, AU │  ← current location
└─────────────────────────────────────┘
```

**Why:** scan-friendly, scannable in a glance, "bento-like" without borders. Phone users swipe the city rail horizontally; desktop users see all 5 in a row.

---

## Proposal 2 — **"Tabs"** (focused per-city view)

> The clock is the hero. **Below the clock**, a **tab strip** lets the user pick a city. The selected city expands its full info (day/date, timezone, off hours, sunrise/sunset) directly under the clock.

**Layout (top → bottom):**

```
┌─────────────────────────────────────┐
│ Good Evening, New York              │
│ Plan your day, meetings, holidays…  │
│                                     │
│         08:42:38 .33 PM             │  ← clock, hero
│                                     │
│  [● Home] [NYC] [LON] [TOK] [SYD] + │  ← tab strip (city names as pills)
│                                     │
│  ┌─────────────────────────────┐    │
│  │     [ Ad — 728×90 / 320×50 ] │    │
│  └─────────────────────────────┘    │
│                                     │
│  Saturday, July 18, 2026            │  ← selected city's day/date
│  EDT · UTC-04:00                    │  ← selected city's timezone
│                                     │
│  ● Your clock is 0.2s behind.       │  ← sync
│  [Sync ✓] [Off hours] [Sun ↑↓]      │  ← pills for selected city
│                                     │
│  📍 Current time in New York        │
└─────────────────────────────────────┘
```

**Why:** focused, the **whole hero is one city at a time** — clock + everything. Tab strip is the navigation. Phone: tabs scroll horizontally; desktop: tabs in a row, content stacks below.

---

## Proposal 3 — **"Inline list"** (all-visible, dense)

> The clock is the hero. **All 5 cities are listed inline** below — each row: name + live time + sun/off hours indicator. No tabs, no scroll, no cards. Everything visible at once on any screen.

**Layout (top → bottom):**

```
┌─────────────────────────────────────┐
│ Good Evening, New York              │
│ Plan your day, meetings, holidays…  │
│                                     │
│         08:42:38 .33 PM             │  ← clock
│       Saturday, July 18, 2026       │  ← day/date
│       EDT · UTC-04:00               │  ← timezone
│                                     │
│  ● Your clock is 0.2s behind.       │  ← sync
│                                     │
│  Cities                             │
│  ──────────────────────────────     │
│  🏠 New York        8:42:38 PM      │  ← user's home (1st)
│     EDT · Sun 5:32a · Sun 8:26p     │
│  ──────────────────────────────     │
│  London          1:42:38 AM         │
│     GMT · Off hours · Mon 9:00a     │
│  ──────────────────────────────     │
│  Tokyo           9:42:38 AM         │
│     JST · Working hours             │
│  ──────────────────────────────     │
│  Sydney         10:42:38 AM         │
│     AEST · Working hours            │
│  ──────────────────────────────     │
│  + Add city                         │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     [ Ad — 728×90 / 320×50 ] │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Why:** **everything visible at once**. No tab switching, no horizontal scroll. The list IS the hero. The clock is at the top, the city details are below. Each city row shows just the essentials — no per-city cards.

---

## Recommendation

**Proposal 3 ("Inline list")** is the strongest fit for the brief:

- It puts **all 5 cities + add** in the hero without scrolling (on a 360×640 phone the user sees clock + day/tz + sync + 3 of 5 cities + add + ad, with two more cities reachable by short scroll).
- It avoids the "card feel" entirely — each city is just a row of text.
- It's the **most direct** answer to "5 cities by default + add your own + home at top + everything in the hero".
- It is **mobile-first by default** — it's literally a vertical list with a hero header.

Proposal 1 ("Rail") and Proposal 2 ("Tabs") are great alternatives depending on the brand direction:
- **Rail** = scannable, social-media feel
- **Tabs** = focused, single-city feel

All three are delivered as prototypes in `prototypes/`.
