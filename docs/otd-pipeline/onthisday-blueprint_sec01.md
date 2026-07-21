## 1. Executive Summary

### 1.1 What onthisday.com is and why it wins

OnThisDay.com is the niche's proof of demand — and its complacent incumbent. A public scrape captured 226,209 dated entries across events, birthdays, deaths, and weddings (June 2022) [^D3-15^], multiplied into millions of templated pages monetized at a self-reported 1M+ visitors and 3M+ pageviews per month, 53% US [^D2-1^]; the most current third-party read is ~1.8M monthly visits (directional) [^D2-7^]. Revenue is an estimated $150K–$575K per year — base case $300K–$350K — effectively 100% from programmatic display ads [^D2-1^][^D2-7^]. The niche funds a lean, founder-run operation on ads alone; this report answers what a challenger can add that ads alone cannot buy.

The incumbent's moat is real but narrow: 25 years of editorial curation (© 2000–2026), not technology or network effects [^D1-1^]. Three exposures matter more. First, the raw corpus is free — the Wikimedia Feed API serves the same events, births, and deaths under CC BY-SA, Wikidata under CC0 [^D4-2^][^D4-11^][^D6-19^]. Second, every monetizable surface beyond ads is unclaimed — no API, widgets, premium tier, or accounts — and robots.txt blocks every major AI crawler [^D1-18^]. Third, cross-verification across eight rivals found none offering AI Q&A, faceted date×category filters, or embeds either: the gaps are industry-wide. The window is open because the category is static.

### 1.2 The build blueprint in one page

For a solo founder on Next.js/Cloudflare with an existing widgets marketplace, the plan is not to out-curate a 25-year archive but to rebuild the corpus from free sources in days, then win where the incumbent refuses to build. Table 1-1 compresses it.

**Table 1-1. The blueprint at a glance**

| Layer | Choice | Why |
|---|---|---|
| Data corpus | Wikimedia Feed API primary + day-page parsing + Wikidata dump + holiday APIs | $0 under CC BY-SA/CC0; full English corpus = 366 requests, ~438 items/day [^D4-2^][^D4-11^][^D6-19^] |
| Differentiated data | Weddings + anniversaries via Wikidata SPARQL (414,149 dated marriages) | No feed serves weddings; only the incumbent covers them [^D5-9^][^D3-15^] |
| Trust layer | Per-row source provenance + offline notability scoring | The corpus is a commodity; verification and packaging are the moat |
| Growth engine | Programmatic SEO: 366 date pages, category×date, date-math tools, 1,500+ national days | Date-history queries keep ~100% click capture; answer-box terms yield 2.5–26% [^D7-2^][^D7-3^][^D7-17^] |
| Distribution | Free embeddable widgets via the widgetly marketplace | No incumbent offers embeds; every embed is a backlink [^D1-18^] |
| Monetization — baseline | Programmatic display ads, $4–12 page RPM | Incumbent proves the niche: est. $150K–$575K/yr on 3–4M pageviews [^D2-1^][^D2-7^][^33^] |
| Monetization — premium | Verified AI answers $6/mo or $49/yr; $4.99 birthday reports; API $9–99/mo | LLM cost is $0.00032/answer, so >90% gross margin; no rival offers AI Q&A [^20^][^31^] |

Read the table as a capital-allocation statement. Because acquisition costs nothing, the engineering budget concentrates on the two assets that compound: verification (provenance, dedupe, notability) and packaging (facets, widgets, artifacts). Growth spend flows only to query classes that survive zero-click search; monetization is stacked so ads pay for traffic while the premium layers — the ones no incumbent offers — carry the margin. The outlier row is differentiated data: weddings cost one SPARQL recipe yet stand alone in the field. The one row that cannot be deferred is trust: retrofitting dedupe and provenance is the costliest mistake this build can make, so it ships in week one (Chapters 6 and 10).

Two findings steer execution. Growth must route around zero-click: 60% of question-word queries trigger an AI Overview, and organic clicks fall from 15% to 8% when one appears [^D7-20^], with top-position CTR down from ~28% to ~19% [^D7-22^]. Yet "this day in history" still converts ~100% of its estimated 61K monthly searches (third-party) to the #1 result [^D7-2^], and every date carries a predictable annual pulse — Wikipedia's "January 1" spikes from a ~1,300 daily baseline to 30,520 views [^D7-15^]. Defense doubles as offense: 99.5% of AIO-cited sources rank in the organic top 10, so winning templates also wins citations [^D7-23^]. Monetization follows the same evidence. GPT-4o scores below 40% on short-fact benchmarks while retrieval grounding cuts hallucinated entities ~70–90% [^14^][^17^]; hence the premium tier sells verification — "ChatGPT guesses dates; we look them up" — at $6/mo against the $20 general-AI anchor and $10–12/mo niche precedents [^1^][^36^], with $4.99 birthday reports riding a proven ~$20 gift-poster market [^31^] and API tiers priced under proven buyers [^28^][^30^].

The window will not stay open: AI Overviews grew from 6.5% of queries in January 2025 to a ~25% peak within months [^D7-19^], and nothing prevents an incumbent — or another indie — from bolting AI onto the same free corpus. The durable position is the verified database plus the widget link graph; both compound only if built now.

#### Chapter References

*Citation convention: `[^D1-N^]` … `[^D7-N^]` preserve the Dimension-report indices as used in Chapter 10; unprefixed `[^N^]` markers preserve Dimension 08 indices as used in Chapters 8 and 10, except `[^33^]`, preserved from Chapter 3.*

- [^D1-1^]: https://www.onthisday.com/ — homepage (© 2000–2026, On This Day Pte. Ltd.) (via Ch.10)
- [^D1-18^]: https://www.onthisday.com/robots.txt — AI-bot blocklist, disallowed paths, no sitemap (via Ch.10)
- [^D2-1^]: OnThisDay.com — "Advertising Information" (via Wayback Machine, 29 Nov 2021). https://web.archive.org/web/20211129205834/https://www.onthisday.com/advertising.php (via Ch.10)
- [^D2-7^]: Exploding Topics / Semrush — onthisday.com traffic report (Jun 2026): ~1.8M visits, global rank 27,998. https://analytics.explodingtopics.com/website/onthisday.com (via Ch.10)
- [^D3-15^]: Kaggle — 226,209 events scraped from onthisday.com ("Events, Birthdays, Deaths, Weddings", June 2022). https://www.kaggle.com/datasets/draculax/226209-events-from-onthisdaycom (via Ch.10)
- [^D4-2^]: wikifeeds service README (route list incl. `onthisday` endpoints). https://github.com/wikimedia/mediawiki-services-wikifeeds (via Ch.10)
- [^D4-11^]: WMF/RESTBase terms — API content licensed CC BY-SA 3.0/GFDL. https://www.usenix.org/system/files/pepr22_slides_triedman.pdf (via Ch.10)
- [^D5-9^]: Executed count of Wikidata P26 statements with pq:P580 = 414,149 (QLever, 54 ms). https://qlever.dev/api/wikidata (via Ch.10)
- [^D6-19^]: Wikidata Query Service pattern (P569/P570 + MONTH/DAY filters; CC0). https://query.wikidata.org/sparql (via Ch.10)
- [^D7-2^]: Ahrefs public data — history.com top keywords ("this day in history" 61K #1). https://ahrefs.com/top/history.com (via Ch.10)
- [^D7-3^]: Ahrefs public data — nationaltoday.com top keywords ("what holiday is today" 149K #1, "what day is today" 86K #1), DR 83. https://ahrefs.com/top/nationaltoday.com (via Ch.10)
- [^D7-15^]: Wikimedia Pageviews API — en.wikipedia "January_1" daily 2023–2024 (baseline ~1,062–3,303; Jan 1: 30,520). https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/January_1/daily/2023122000/2024011000 (via Ch.10)
- [^D7-17^]: AcadCalendar — "National Day Calendar 2026" (1,500+ observances, ~4–5 per date). https://acadcalendar.com/national-day-calendar/ (via Ch.10)
- [^D7-19^]: Semrush AI Overviews Study (10M+ keywords; AIO 6.49% Jan 2025 → ~25% Jul peak). https://www.semrush.com/blog/semrush-ai-overviews-study/ (via Ch.10)
- [^D7-20^]: Pew Research Center browsing study (Mar 2025, via Myoho Marketing) — 60% of question-word queries trigger AIO; organic clicks 15%→8% when AIO present. https://myohomarketing.com.au/ai-overviews-in-2025-what-pew-research-centers-click-data-means-for-publishers/ (via Ch.10)
- [^D7-22^]: WebProNews — "Google AI Overviews Crush CTRs" (top organic CTR 28%→19%). https://www.webpronews.com/google-ai-overviews-crush-ctrs-seos-2025-reckoning/ (via Ch.10)
- [^D7-23^]: Rayo blog synthesis of Semrush/SparkToro data (AIO sources = top-10 organic 99.5% of the time). https://blog.rayo.work/seo/ai-overviews-study/ (via Ch.10)
- [^1^]: Perplexity pricing breakdowns — free tier, Pro $20/mo, daily Pro-search caps. https://comparaitools.com/blog/perplexity-pricing-2026 ; https://aisotools.com/pricing/perplexity (via Ch.8)
- [^14^]: OpenAI SimpleQA — GPT-4o scores below 40% on 4,326 short factual questions. https://inblix.com/article/openai-s-simpleqa-exposes-gpt-4o-s-40-factuality-score-3fbe96/ (via Ch.10)
- [^17^]: ServiceNow/NAACL 2024 — RAG cuts hallucinated structured-output entities (13.7–16.0% → 1.7–7.2%). https://arxiv.org/html/2404.08189v1 (via Ch.10)
- [^20^]: Gemini 2.5 Flash-Lite pricing — $0.10/1M input, $0.40/1M output, cached $0.01/1M. https://devtk.ai/en/models/gemini-2-5-flash-lite/ (via Ch.10)
- [^28^]: Calendarific vs alternatives — free 500 req/mo w/ attribution; $12/mo entry; $400/yr business; $4,000/yr enterprise. https://worlddataapi.com/compare/calendarific (via Ch.10)
- [^30^]: Holiday API market — timeanddate API $99–999/yr. https://worlddataapi.com/compare/holiday-apis (via Ch.10)
- [^31^]: Personalised "year you were born" birthday newspaper poster — ~$20 digital download. https://www.milestonesstudio.com.au/products/year-in-review-birthday-newspaper (via Ch.8)
- [^33^]: Skipblast — "Ezoic Earnings: November 2024 Niche Site Income Report" (education site EPMV $3.79–5.41 on Ezoic vs $23–54 RPM on Mediavine / $20+ on Raptive). https://www.skipblast.com/ezoic-earnings-november-2024-niche-site-income-report/ (via Ch.3)
- [^36^]: Consensus — corpus-grounded answer engine at $10–12/mo Pro against free general AI. https://theaiagentindex.com/compare/elicit-vs-consensus-vs-perplexity-ai (via Ch.8)
