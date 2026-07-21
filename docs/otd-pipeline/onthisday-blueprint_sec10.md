## 10. Key Insights and Risk Register

Every dimension of this study converges on one conclusion: the window is open because incumbents are static — ads-only monetization, AI crawlers blocked, no API, no widgets [^D2-1^][^D1-18^]. This chapter distills the eight insights that should drive the build, then names the risks honestly, each paired with a mitigation already in the roadmap.

### 10.1 Eight cross-dimension insights

1. **The data is free; the moat is verification and packaging.** The raw corpus is downloadable in hours: 366 requests per language against the Wikimedia Feed API (~438 items/day for English) [^D4-2^], under CC BY-SA (Wikipedia-derived text and mirrors) and CC0 (Wikidata) [^D4-11^][^D6-19^]. onthisday.com's only durable asset is 25 years of curation (© 2000–2026) [^D1-1^]. The corpus is a commodity: rebuild it fast and differentiate where the incumbent refuses to go — verified records, faceted packaging, API, widgets.

2. **The premium/API layer is entirely unclaimed.** onthisday.com monetizes ~100% through programmatic display — no premium tier, no public API [^D2-1^][^D1-18^]. timeanddate sells data APIs at $99–999/yr but no AI [^30^]; no profiled competitor offers AI Q&A at all (cross-verified, High Confidence). "Verified AI answers + artifacts + API" is an open slot, and caching makes it a >90%-gross-margin slot [^20^][^24^]. This is the revenue thesis, not a feature experiment.

3. **AI is a trust product, not a chat product.** Exact dates are LLMs' weakest factual domain — GPT-4o scores below 40% on the SimpleQA short-fact benchmark [^14^] — while retrieval-grounded generation cuts hallucinated entities roughly 70–90% [^17^]. Refusing out-of-corpus questions, the ASK Britannica pattern, converts a limitation into the trust feature [^4^]. The positioning writes itself — "ChatGPT guesses dates; we look them up" — and the curated database is what makes the AI sellable.

4. **SEO must route around zero-click.** Google self-answers "what day is today," leaving the #1 result only ~26% of its volume [^D7-3^], and 60% of question-word queries trigger an AI Overview [^D7-20^]. Yet date-history queries still convert ~100% to the top result [^D7-2^], and winnable inventory is deep: 1,500+ national days, date-math tools, category×date combos, non-English markets where AIO lags [^D7-17^][^D7-19^]. Programmatic templates beat head-term fights.

5. **The birthday bump is a monetizable demand pulse.** Wikipedia date articles spike 25–50× on their own day — January 1 rises from a ~1,000–2,500 daily baseline to 30,520 views [^D7-15^]; July 4 from ~515–1,244 to 30,005 [^D7-16^] — and Brian May's pageviews double every birthday [^D5-14^]. Demand is predictable to the day, so per-date marketing pulses and $4.99 birthday reports place supply exactly where recurring demand arrives.

6. **Weddings and anniversaries are the most under-served data type.** Among the nine properties profiled, only the baseline covers weddings [^D3-15^], while Wikidata holds 414,149 dated marriages extractable with spouse-pair dedupe and sitelink ranking [^D5-9^]. No quality brand serves the category at all. The build implication: ship a weddings/anniversaries type early — it differentiates the database on day one and unlocks gift-market monetization (anniversary reports) that events-only competitors cannot copy quickly.

7. **Multi-source dedupe is the hidden engineering cost.** Feed API, day pages, Wikidata, and mirrors overlap but conflict: the feed's events list silently excludes the most recent ~2 years [^D4-3^], pre-1582 Julian dates drift, and year-only precision surfaces as false January-1 birthdays. Fund per-row source provenance and a composite notability score (log sitelinks + pageviews + inbound links) from day one; retrofitting dedupe is the costliest mistake this build can make.

8. **Widgets are a link-building weapon, not just a feature.** No incumbent offers embeds — onthisday.com's robots.txt blocklists AI crawlers rather than syndicating anything [^D1-18^]. The working model is free-with-attribution: Calendarific trades a 500-request/month free tier for a backlink [^28^]. For a marketplace like widgetly.tech, every embed is a followed link and brand impression that compounds authority while competitors stay sealed. Budget the widget program as SEO spend: it builds the referring-domain base that later head-term contention depends on.

### 10.2 Risk register

Eight risks matter. Three are existential if ignored — licensing, hallucination, and Google's AI Overviews — and each is answered by a design choice already in the roadmap.

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CC BY-SA share-alike contaminates the derived DB; image-license violations | Certain (ongoing duty) | High | Store facts, not adapted expression; per-item attribution; per-image Commons `extmetadata`; never redistribute fair-use `/wikipedia/en/` thumbnails [^D4-11^][^D4-15^][^D4-16^] |
| Hallucinated dates presented as fact | Medium | High | Retrieval-only grounding, deterministic date parsing, refuse-on-no-data, disclaimers; RAG cuts hallucinated entities ~70–90% [^17^][^8^] |
| Free chatbots cannibalize the premium tier | High | High | Sell what a chat window cannot: cited answers on a proprietary DB, artifacts, widgets, API; market against chatbots' <40% short-fact accuracy [^14^][^15^] |
| Google AIO expansion erodes informational clicks | High | High | Prioritize tools, long lists, widgets, non-English pages; become the cited AIO source (99.5% rank top-10 organically); build owned audience as top CTR falls 28%→19% [^D7-23^][^D7-22^] |
| Query seasonality — academic-calendar July trough, Dec–Jan spikes | High | Medium | Structural pattern, not a surprise [^D7-14^]; smooth with national-day inventory, per-date pulses, subscription artifacts |
| Traffic-estimate uncertainty distorts planning | High (observed) | Medium | Estimates span 308K–1.8M visits/mo; anchor to self-reported 1M+ visitors / 3M+ pageviews and Semrush ~1.8M; plan on ranges, never points [^D2-1^][^D2-5^][^D2-6^][^D2-7^] |
| LLM cost creep | Low | Low–Medium | Small models by default, pre-generated digests, 90%+ cache-hit targets, fair-use caps; $49/yr covers ~150,000 Flash-Lite answers [^20^][^22^][^24^] |
| Era-content copyright in artifacts (#1 songs, headlines) | Medium | Medium | Prefer facts (uncopyrightable) over reproduced text; license or link out; legal review before poster launch |

**Interpretation.** The register is asymmetric in a useful way: the three existential risks are front-loaded into design decisions rather than left to chance. Licensing compliance is a schema decision — facts-plus-provenance rows with per-image license capture — made in week one; hallucination is an architecture decision (retrieval-only, refuse-out-of-corpus) made in the RAG milestone; AIO erosion is a channel decision (tools, widgets, non-English, owned audience) made in the SEO plan. The remaining five rows are planning disciplines, not launch blockers, and the two "certainty" rows — licensing duties and seasonality — are fully knowable today. Treat the table as a pre-launch checklist: every mitigation is already specified in Chapters 4–9, which is the strongest evidence the plan is sound.

**Closing implication.** The window is open because incumbents are static: ads-only, AI bots blocked, no API, no widgets. It will not stay open. AI Overviews grew from 6.5% of queries in January 2025 to a ~25% peak within months [^D7-19^], and nothing stops an incumbent — or another indie — from bolting AI onto the same free corpus. The durable position is not the data; it is the verified, provenance-tracked database plus the widget link graph, and both compound only if built now.

#### Chapter References

*Citation convention: unprefixed `[^N^]` markers cite the Dim08 report (AI premium model), preserving that file's original indices; `[^D1-N^]` … `[^D7-N^]` cite Dimension reports 01–07 respectively, preserving each file's original index N.*

[^4^]: ASK Britannica product sheet — AI Q&A grounded only in Britannica vetted content, "no open-web results": https://britannicaeducation.com/wp-content/uploads/2025/10/be-resource-library-ask-britannica.pdf
[^8^]: Ancestry AI Stories (2023) — LLM first-person narratives, no citations, "AI-generated… not verified fact" disclaimer: https://www.alibaba.com/product-insights/ai-powered-genealogy-tools-myheritage-deep-nostalgia-vs-ancestry-ai-stories-historical-plausibility-checks.html
[^14^]: OpenAI SimpleQA — GPT-4o scores below 40% on 4,326 short factual questions: https://inblix.com/article/openai-s-simpleqa-exposes-gpt-4o-s-40-factuality-score-3fbe96/
[^15^]: ChatGPT accuracy/hallucination stats — o3 51%, GPT-4o 44%, o4-mini 79% on SimpleQA; ~1-in-3 factual error rate: https://livechatai.com/blog/is-chatgpt-accurate
[^17^]: ServiceNow/NAACL 2024 — RAG cuts hallucinated structured-output entities (steps 13.7–16.0% → 1.7–7.2%; tables 19.2–21.4% → 1.6–4.4%): https://arxiv.org/html/2404.08189v1
[^20^]: Gemini 2.5 Flash-Lite pricing — $0.10/1M input, $0.40/1M output, cached $0.01/1M: https://devtk.ai/en/models/gemini-2-5-flash-lite/
[^22^]: OpenAI API pricing — cached input at 10% of standard; Batch −50%: https://benchlm.ai/openai/api-pricing
[^24^]: Semantic caching cuts LLM cost 30–50% on conversational workloads: https://www.respan.ai/articles/semantic-cache-llm
[^28^]: Calendarific vs alternatives — free 500 req/mo w/ attribution; $12/mo entry; $400/yr business; $4,000/yr enterprise: https://worlddataapi.com/compare/calendarific
[^30^]: Holiday API market — timeanddate API $99–999/yr; Calendarific $100/yr: https://worlddataapi.com/compare/holiday-apis
[^D1-1^]: https://www.onthisday.com/ — homepage (nav, modules, filter bar, footer, newsletter, consent; © 2000–2026, On This Day Pte. Ltd.)
[^D1-18^]: https://www.onthisday.com/robots.txt — AI-bot blocklist, disallowed paths, no sitemap
[^D2-1^]: OnThisDay.com — "Advertising Information" (via Wayback Machine, 29 Nov 2021). https://web.archive.org/web/20211129205834/https://www.onthisday.com/advertising.php (accessed 2026)
[^D2-5^]: SiteWorthTraffic — Onthisday.com traffic/revenue report (report ~2021). https://www.siteworthtraffic.com/report/onthisday.com (accessed 2026)
[^D2-6^]: Worth Of Web — onthisday.com valuation/traffic (report ~2022). https://www.worthofweb.com/website-value/onthisday.com/ (accessed 2026)
[^D2-7^]: Exploding Topics / Semrush — onthisday.com traffic report (Jun 2026): ~1.8M visits, global rank 27,998. https://analytics.explodingtopics.com/website/onthisday.com (accessed 2026)
[^D3-15^]: https://www.kaggle.com/datasets/draculax/226209-events-from-onthisdaycom (scrape of onthisday.com: "Events, Birthdays, Deaths, Weddings", 226,209 records, June 2022 — baseline content-type evidence)
[^D4-2^]: https://github.com/wikimedia/mediawiki-services-wikifeeds (service README: full route list incl. `onthisday/{births,deaths,events,selected,holidays,all}`)
[^D4-3^]: https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/07/19 (live-tested 2026-07-19, 200, no auth; events sorted year-descending, starts 2018)
[^D4-11^]: WMF/RESTBase terms as quoted in WMF materials: "…content accessed via this API is licensed under the CC BY-SA 3.0 and GFDL licenses" (usenix.org/system/files/pepr22_slides_triedman.pdf)
[^D4-15^]: https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content and WMF Terms of Use (foundation.wikimedia.org/wiki/Policy:Terms_of_Use)
[^D4-16^]: https://enterprise.wikimedia.com/ ("Every request has metadata clearly explaining the attached license"); Commons license metadata pattern: `action=query&prop=imageinfo&iiprop=extmetadata`
[^D5-9^]: Executed count of Wikidata P26 statements with pq:P580 = 414,149 (QLever, query-time-ms 54) — https://qlever.dev/api/wikidata
[^D5-14^]: Pageviews API, tested — https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/Brian_May/daily/20250701/20250731
[^D6-19^]: Wikidata Query Service pattern: `https://query.wikidata.org/sparql` — `?person wdt:P31 wd:Q5; wdt:P569 ?dob. FILTER(MONTH(?dob)=7 && DAY(?dob)=19)`; CC0
[^D7-2^]: Ahrefs public data — history.com top keywords ("this day in history" 61K #1, "today in history" 60K #1), 2.9M traffic: https://ahrefs.com/top/history.com
[^D7-3^]: Ahrefs public data — nationaltoday.com top keywords ("what holiday is today" 149K #1, "what day is today" 86K #1), DR 83: https://ahrefs.com/top/nationaltoday.com
[^D7-14^]: Google Trends public API pull (US, 5y, 4-term comparison): today in history / what national day is today / famous birthdays / born on this day: https://trends.google.com/trends/explore?date=today%205-y&geo=US&q=today%20in%20history,what%20national%20day%20is%20today,famous%20birthdays,born%20on%20this%20day
[^D7-15^]: Wikimedia Pageviews API — en.wikipedia "January_1", daily Dec 2023–Jan 2024 (baseline ~1,062–3,303; Dec 31: 11,069; Jan 1: 30,520): https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/January_1/daily/2023122000/2024011000
[^D7-16^]: Wikimedia Pageviews API — en.wikipedia "July_4", daily Jun–Jul 2024 (baseline ~515–1,244; Jul 4: 30,005): https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/July_4/daily/2024062500/2024071000
[^D7-17^]: AcadCalendar — "National Day Calendar 2026: What National Day Is It Today?" (1,500+ observances, ~4–5 per date): https://acadcalendar.com/national-day-calendar/
[^D7-19^]: Semrush AI Overviews Study (10M+ keywords; AIO 6.49% Jan 2025 → ~25% Jul peak → 15.69% Nov 2025): https://www.semrush.com/blog/semrush-ai-overviews-study/
[^D7-20^]: Pew Research Center browsing study (Mar 2025; via Myoho Marketing summary) — 60% of question-word queries, 53% of 10+-word queries trigger AIO; organic clicks 15%→8% when AIO present: https://myohomarketing.com.au/ai-overviews-in-2025-what-pew-research-centers-click-data-means-for-publishers/
[^D7-22^]: WebProNews — "Google AI Overviews Crush CTRs" (top organic CTR 28%→19%; informational queries hit hardest): https://www.webpronews.com/google-ai-overviews-crush-ctrs-seos-2025-reckoning/
[^D7-23^]: Rayo blog synthesis of Semrush/SparkToro/SimilarWeb reporting (SparkToro ~58% zero-click; AIO sources = top-10 organic 99.5% of the time): https://blog.rayo.work/seo/ai-overviews-study/
