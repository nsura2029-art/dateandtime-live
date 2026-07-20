# PRDs (Product Requirements Documents)

> One file per major feature or pivot. Use the template below. Newest at the top of the index.

## 📚 Index

| PRD | Status | Date | Owner |
|---|---|---|---|
| [HOLIDAY-INTELLIGENCE-PLATFORM-PRD.md](./HOLIDAY-INTELLIGENCE-PLATFORM-PRD.md) | Draft | 2026-07-19 | — |

> When you add a new PRD, add a row here.

## 📝 PRD template

Copy this into a new file `<FEATURE-NAME>-PRD.md` (SCREAMING_SNAKE_CASE) and fill in each section. Delete sections that don't apply; add new ones for project-specific needs.

```markdown
# <Feature Name> PRD

**Date:** YYYY-MM-DD
**Owner:** name / agent
**Status:** Draft | Approved | In Progress | Shipped | Killed
**Related PRDs / docs:** [link] [link]

---

## 1. Overview
One-paragraph summary of the feature, the problem it solves, and the outcome it produces.

## 2. Goals (what success looks like)
- 3–5 measurable outcomes
- e.g. "Capture 10K MAU within 90 days of launch"
- e.g. "Hit $1.5M ARR by end of year 2"

## 3. Non-goals (what this is NOT)
- 2–4 explicit exclusions
- Saves scope from creeping

## 4. Users / Personas
- Who they are
- What they need
- What they currently do (workaround)

## 5. Jobs-to-be-done
- Top 5–10 JTBDs ranked by user pain or search volume
- "When [situation], I want to [motivation], so I can [outcome]"

## 6. Competitive landscape
- 5–10 alternatives (free + paid)
- What they do well, what they don't

## 7. Information architecture
- Sitemap / URL structure
- Key URL patterns (programmatic SEO plan)

## 8. Data model
- New tables / columns
- Migration plan (SQL, scripts, backfill)

## 9. API surface
- New endpoints
- Modified endpoints (with diff)
- Backwards compatibility plan

## 10. UI/UX
- Wireframes or links to [previews/](../previews/)
- Key user flows (with screenshots if available)

## 11. SEO strategy
- Target keywords + volume
- Programmatic SEO plan
- Schema.org / JSON-LD markup

## 12. Monetization
- Pricing
- Conversion funnel
- Unit economics

## 13. Risks + mitigations
- Top 5–10 risks, each with: likelihood × impact + mitigation

## 14. Backlog
- Weeks 1–4: foundation
- Weeks 5–8: ship MVP
- Weeks 9–24: scale

## 15. Open questions
- Things that need a decision before this PRD can be Approved
```

## ✅ Status meanings

| Status | Meaning |
|---|---|
| Draft | Work in progress. Not yet ready for review. |
| Approved | User has signed off. Ready to start building. |
| In Progress | Building has started. |
| Shipped | Feature is live in production. |
| Killed | Decided not to build. Keep the doc for context. |
