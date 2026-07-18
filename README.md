# TimeAndDatePro · dateandtime.live

> A modern time-and-date workbench — **7-segment display**, world clock, meeting finder, timezone navigator. Built on the **Widgetly design system** with NotebookLM color tokens.

🌐 **Live**: [dateandtime.live](https://dateandtime.live) _(coming soon)_

---

## What is this?

TimeAndDatePro is a time-toolkit web app with a clear philosophy:

- **Time, told like a real clock** — a hand-built CSS 7-segment display (no font, no SVG, no dependency), centered "1" via the `.is-one` class for true constant spacing.
- **No cards** — just white space, hairline rules, and type hierarchy.
- **One design system, two themes** — light (NotebookLM pastel gradient + purple) and dark (deep purple + orange LED). One `data-theme` attribute, ~16 CSS variables.
- **Two formats, one toggle** — 12h with AM/PM pill, or 24h. Persists in localStorage. Setup runs before the first render so there's no flicker.

## Quick start

```bash
# Open the main page
open index.html

# Or serve locally
npx serve .
```

No build step. No npm install. It's a single self-contained HTML file with one local font (`fonts/DSEG14Classic-Bold.woff2`).

## File structure

```
dateandtime-live/
├── index.html                          # The main page (Widgetly system + 7-seg clock)
├── fonts/
│   └── DSEG14Classic-Bold.woff2        # Monospace 7-segment font
├── design-system/
│   └── widget-system-notebook.html     # Full design system reference page
├── docs/
│   └── 3D_GLOBE_RESEARCH.md            # Research doc for the upcoming 3D globe
├── .gitignore
└── README.md
```

## Design tokens

The full token set lives in the `:root` and `[data-theme="dark"]` blocks at the top of `index.html`. Here's the short version:

| Token | Light | Dark |
|---|---|---|
| `--color-primary` | `#5b4aaf` (NotebookLM purple) | `#a78bfa` |
| `--color-on-segment` | `#47435f` (active digit) | `#f97316` (orange LED) |
| `--color-foreground` | `#49445f` | `#ede9fe` |
| `--color-background` | white + pastel gradient | `#16092e` (deep purple) |
| `--color-period-fg` | `#49445f` | `#f97316` |
| `--color-glow` | `drop-shadow(0 5px 8px rgba(91,77,145,.10))` | `drop-shadow(0 0 12px rgba(249,115,22,.25))` |

## Roadmap

- [x] **Phase 0** — Design system foundation (NotebookLM tokens, light/dark, 7-seg clock)
- [ ] **Phase 1** — Landing + date-to-words tool
- [ ] **Phase 2** — World clock + Meeting finder + Timezone navigator pages
- [ ] **Phase 3** — AI features (timezone-aware scheduling assistant)
- [ ] **Phase 4** — Long tail (countdowns, holidays, work-hours heatmap)
- [ ] **3D globe** — see `docs/3D_GLOBE_RESEARCH.md` for the planned interactive globe

## License

MIT

## Author

TimeAndDatePro — © 2026
