# dateandtime.live — Documentation

> The source of truth for strategy, design, API, and architectural decisions.

## 📁 Folder map

| Folder | What's here | When to add a file |
|---|---|---|
| **`strategy/`** | PRDs (Product Requirements Documents) | Before building a major feature or pivot. Use the [PRD template](./strategy/README.md#prd-template). |
| **`api/`** | API documentation | When you add/change/remove an endpoint. Update [api/CHANGELOG.md](./api/CHANGELOG.md). For complex endpoints, add a deep-dive in `api/endpoints/`. |
| **`previews/`** | HTML mockups + design prototypes | When you need visual review before coding. Self-contained HTML files you can open in a browser. See [previews/README.md](./previews/README.md). |
| **`architecture/`** | System design, DB schema, technical decisions | When a new system or feature needs an architectural plan. |
| **`research/`** | Design/UX research, exploration docs | When research informs a decision. |
| **`CHANGELOG.md`** | Top-level digest of what shipped | Weekly or per release. |

## 🔗 Related files (outside this folder)

- `../AGENTS.md` — project rules, workflow, deploy policy (the 4-step workflow)
- `../README.md` — high-level project overview
- `../wrangler.toml` — Cloudflare Workers config
- `../cloudflare/datetime-api/` — API Worker source code
- `../index.html` — default landing page (production-stable, user-locked 2026-07-19)

## 📝 Conventions

- **Markdown** for prose, **JSON/YAML** for machine-readable specs
- **Kebab-case or SCREAMING_SNAKE** for filenames (e.g. `seo-city-page-v1.html`, `HOLIDAY-INTELLIGENCE-PLATFORM-PRD.md`)
- **Dated sections** at the top of any CHANGELOG.md, newest first
- **Cross-link generously** — use relative paths to other docs/

## 🗓 Last updated
2026-07-19 — created the docs/ structure (user-approved)
