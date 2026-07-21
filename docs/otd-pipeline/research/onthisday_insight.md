# Phase 6 — Cross-Dimension Insights (onthisday.com build blueprint)

1. **The data is free; the moat is verification + packaging.** Wikipedia/Wikidata/byabbe/muffin give away the raw corpus (CC BY-SA/CC0). onthisday.com's only durable asset is 25 years of editorial curation. A challenger can rebuild ~80% of the corpus in days via Feed API + day-page parsing (Dim04, Dim05, Dim06), so differentiation must come from what onthisday.com refuses to do: API, widgets, faceted filtering, and verified AI answers (Dim01, Dim02, Dim03, Dim08).

2. **Incumbents left the premium/API layer entirely unclaimed.** onthisday.com = ads only; timeanddate sells data APIs ($49–999/yr) but no AI; no history site offers AI Q&A (Dim02, Dim03, Dim08). Selling "verified AI answers + artifacts + API" is an open slot with >90% gross margin via caching (Dim08).

3. **AI is a trust product here, not a chat product.** Exact dates are LLMs' weakest factual domain (SimpleQA <40%) — the curated DB is what makes AI answers sellable ("ChatGPT guesses dates; we look them up"). RAG-with-citations + refuse-out-of-corpus is the defensible pattern (Dim08, Dim05 notability-ranking data).

4. **SEO strategy must route around zero-click.** Google self-answers "what day is today" (#1 captures only ~26% of clicks) but date-history queries still convert ~100% to the #1 result; winnable segments = date-math tools, 1,500+ individual national days, category×date combos, non-English markets (Dim07). Programmatic templates: 366 dates × 5 types × categories × years (Dim01 URL grammar as template reference).

5. **The "birthday bump" is a monetizable demand pulse.** Wikipedia date/person pages spike 25–50× on their own day; Brian May's pageviews double on his birthday (Dim05, Dim07). Per-date marketing pulses + birthday-report artifacts ($4.99 PDF) align supply with this recurring demand (Dim08).

6. **Weddings/anniversaries are the most under-served data type.** Only onthisday.com covers weddings among competitors (Dim03); Wikidata holds 414K dated marriages, extractable with spouse-pair dedupe (Dim05) — a differentiated content type with gift-market monetization (anniversary reports).

7. **Multi-source dedupe is the hidden engineering cost.** Feed API, day pages, Wikidata, and mirrors overlap heavily but conflict on recency, calendar drift (Julian dates), and precision (Jan-1 bias) (Dim04, Dim05, Dim06). Per-row source provenance + composite notability score (log sitelinks + log pageviews + log inbound links) is required from day one.

8. **Widgets are a link-building weapon, not just a feature.** No incumbent offers embeddable widgets (Dim01, Dim03); for a marketplace like widgetly.tech, free-with-attribution widgets turn the content DB into a backlink engine that compounds SEO (Dim07, Dim08).
