# dateandtime.live — Changelog

> Top-level digest of what shipped. Newest first. For API changes see [`api/CHANGELOG.md`](./api/CHANGELOG.md).

---

## 2026-07-19 — Docs structure established (this commit)

Created a clean `docs/` tree so future work has a place to live.

**What's new:**

- `docs/README.md` — nav index for the whole `docs/` folder
- `docs/strategy/README.md` — PRD template + index of all PRDs
- `docs/previews/README.md` — HTML mockup index + naming convention
- `docs/api/CHANGELOG.md` — added a copy-paste template at the top
- `docs/api/endpoints/` — new folder for per-endpoint deep-dive docs
- `docs/research/` — moved 3 loose top-level MDs here (`DESIGN_RESEARCH`, `3D_GLOBE_RESEARCH`, `ROLLOUT`)
- `docs/CHANGELOG.md` (this file) — top-level digest

**Convention going forward:**

- PRDs → `docs/strategy/<NAME>-PRD.md`
- HTML previews → `docs/previews/<feature>-<version>.html`
- API changes → `docs/api/CHANGELOG.md` (every change) + `docs/api/endpoints/<name>.md` (if complex)
- Research → `docs/research/<topic>.md`
- Architecture / DB → `docs/architecture/<topic>.md`

---

## 2026-07-19 — Holiday Intelligence Platform PRD (44KB strategic doc)

`docs/strategy/HOLIDAY-INTELLIGENCE-PLATFORM-PRD.md` — comprehensive PRD covering competitors, personas, JTBDs, IA, data model, API design, UI/UX, SEO, monetization, risks, 24-week backlog. This is the flagship strategy doc.

---

## 2026-07-19 — Phases 0/2/4/6/7/8 of shared DB shipped

Single canonical D1 schema `timeandtimepro-full` (33,945 cities, 242 countries, 408 IANA tzs, holidays, onthisday, country-religions, climate, seasons, DST transitions, data quality). See `docs/architecture/SHARED-DB-PLAN.md` and `docs/architecture/HOLIDAYS-AND-ONTHISDAY-PLAN.md`.

---

## 2026-07-19 — 12 new API endpoints live (Holidays + OnThisDay + Religion)

See `docs/api/CHANGELOG.md` for the full list. Religion-aware (`country` × `religion` × `year` filters) — major step toward the holiday intelligence platform.

---

## 2026-07-19 — Default landing promoted from `/home` to `/`

`/` is now the SEO-friendly home (formerly `home/index.html`). `/home` 301-redirects to `/`. See `AGENTS.md` "Default landing" section.

---

## 2026-07-19 — Production deploy policy locked

After an incident where an agent shipped a text cleanup to prod without authorization, the user locked the rule: **always deploy to dev first, never ship to prod without explicit "ship it" / "yes" / "go to prod"**. See `AGENTS.md` "CRITICAL — Production deploy policy" and the "Quick workflow (4 steps)" section.
