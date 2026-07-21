# Cross-Verification — onthisday.com Teardown & Build Blueprint (2026-07-19)

## Confidence tiers

### High Confidence (≥2 agents, independent sources)
- onthisday.com: 200k+ curated entries (events, birthdays, weddings/divorces, deaths), 1M+ visitors / 3M+ pageviews/mo, 53% US audience [Dim01, Dim02]
- Monetization is ~100% programmatic display ads; NO premium tier, NO public API, NO widgets, NO accounts [Dim01, Dim02, Dim03]
- Wikimedia Feed API `onthisday` endpoints work without auth at reasonable limits; schema = {text, year, pages[]} with hydrated page metadata; ~438 items/day for EN (July 19 measured) [Dim04, Dim06 (byabbe/muffin mirrors corroborate volumes)]
- Competitor set and their gaps: weddings coverage unique to onthisday.com; holidays-by-country unique to timeanddate; no competitor offers API/widgets or AI Q&A [Dim02, Dim03, Dim08]
- LLM factual weakness on exact dates (SimpleQA <40%) → "verified AI answers" positioning [Dim08, consistent with SEO zero-click analysis Dim07]

### Medium Confidence (single authoritative source)
- Revenue estimate $150K–$575K/yr (base $300–350K) — Dim02 model, estimator inputs
- Ownership: On This Day Pte. Ltd. (Singapore), founder James Graham, ex-HistoryOrb.com (2000→2015) — Dim02
- Wikidata recipes (births/deaths/events/weddings/holidays) verified via QLever mirror; WDQS times out on full scans — Dim05
- 414,149 dated marriages in Wikidata; weddings ARE extractable — Dim05
- SEO volumes (Ahrefs US Jul 2026): famous birthdays 428K, what day is it 234K, this day in history 61K, on this day 23K — Dim07

### Low Confidence / Directional
- Third-party traffic estimates (Semrush ~1.8M/mo vs WorthOfWeb 1.37M vs SiteWorthTraffic 308K) — wide spread; self-reported 1M+ visitors used as anchor
- dayinhistory.dev provenance ("internet sources + AI fine-tuned") — opaque
- Google Trends growth multiples (4–6× since 2021) — relative indices

### Conflict Zones (resolved)
1. **Traffic estimates conflict** (308K–1.8M/mo): RESOLVED by anchoring to self-reported advertising.php + noting estimator spread as directional.
2. **Events recency**: Dim04 found Feed API `events` excludes last ~2 years; Dim05 found day-page parsing includes 2024/2025 → RESOLVED: use Feed API as primary + action=parse day pages for recent events.
3. **Holiday coverage**: OpenHolidays lacks US; Wikidata P837 sparse (6,950); → RESOLVED: layered stack Nager.Date + OpenHolidays + vacanza + Feed holidays.
4. **numbersapi.com**: Dim06 found dead (404) → SKIP.
