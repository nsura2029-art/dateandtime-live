## 3. Business Model and Traffic Economics

Chapter 2 closed on a structural gap — no API, no widgets, no premium tier — and this chapter prices that gap. OnThisDay.com is a single-engine business: a founder-run publisher converting 3–4 million monthly pageviews into an estimated $150K–$575K per year, entirely from programmatic display ads, base case near $300K–$350K [^1^][^7^]. The model proves the niche funds a lean operation on ads alone — and maps the revenue layers the incumbent refuses to build.

### 3.1 Traffic and audience

The most reliable traffic figure is the one the site sells against: its advertising page claims "over 1m visitors serving over 3m page views a month," split 53% US, 15% UK, 5% Canada, 3% Australia — roughly 76% Tier-1 English markets, the geographies that command premium ad rates [^1^][^29^]. Third-party estimators disagree by a factor of six and are directional only.

**Table 3-1. Self-reported vs. third-party traffic estimates for OnThisDay.com**

| Source | Data date | Monthly visits | Monthly pageviews | Assessment |
|---|---|---|---|---|
| Self-reported (advertising page) [^1^] | 2021 | 1M+ | 3M+ | Verified verbatim via Wayback capture; safest planning baseline |
| Semrush / Exploding Topics [^7^] | Jun 2026 | ~1.8M | n/a | Most current read; global rank 27,998; Authority Score 62 |
| Worth Of Web [^6^] | ~mid-2022 | ~1.37M | ~6.85M | Alexa-derived; pageview figure looks inflated |
| SiteWorthTraffic [^5^] | ~2021 | ~308K | ~683K | Alexa-derived; implausibly far below self-report |

The spread between the two Alexa-era tools (308K vs 1.37M visits in adjacent years) is a calibration lesson: free estimators bracket rather than measure, so the defensible anchors are the self-report and the current Semrush read [^5^][^6^][^7^]. Reconciling them implies growth — at ~2.2 pages per visit, 1.8M visits works out to roughly 4M pageviews per month today versus 3M claimed in 2021 [^7^]. Two implications follow. The niche sustains multi-million-pageview scale on evergreen, templated content with no news operation — the exact traffic profile a programmatic challenger can replicate. And quick-fact sessions are shallow and high-bounce, so revenue scales with pageview volume and ad viewability, not engagement depth.

### 3.2 Monetization mechanics

The engine is ~100% programmatic display, with direct-sold sponsorships layered on top [^1^]. Ads run through Google Ad Manager (the rate page names DFP, its predecessor), with SHE Media as mid-tier ad-management partner and a consent-management platform disclosing 1,727 ad partners [^1^][^36^]. The rate card sells four products: 728x90 leaderboard and 300x250 medium-rectangle banners; channel buys across seven sections (Home, History Articles, Film & Television, History, Music, Sport, People); co-branded page takeovers ("This page brought to you by ___"); and daily-newsletter sponsorship — all targetable by country, continent, or hour of day, with frequency capping [^1^]. A Spanish sister site, Hoy en la Historia, extends the same inventory [^1^].

Equally instructive is what the stack lacks: no premium or ad-free subscription, no paid API or data-licensing product — third parties such as Viewbits sell "on this day" API access instead [^27^] — and no affiliate commerce [^1^]. The implication: the incumbent's entire P&L depends on one demand channel, leaving subscription, API, and licensing revenue unclaimed for a competitor.

### 3.3 Revenue model and niche RPM benchmarks

Combining 3.0–4.0M monthly pageviews with a page-RPM band of $4–$12 (RPM = revenue per thousand pageviews) yields an estimated $150K–$575K per year, base case roughly $300K–$350K [^1^][^7^].

**Figure 3-1. Revenue sensitivity: monthly pageviews × page RPM (annualized)**

![Revenue sensitivity: pageviews × RPM, $150K–$575K/yr planning range](onthisday-blueprint_chart_revenue.png)

Three judgment calls set the RPM band. 1) Mix: education/reference is a premium vertical — Playwire reports it "carries the highest average CPM of any content vertical" — and ~76% Tier-1 geography pushes rates up [^31^][^29^]. 2) Session quality: shallow ~2.2-page visits cap session value. 3) Network tier: real-world education-site RPMs span $3–5 on Ezoic to $20–54 on Mediavine/Raptive, and OnThisDay's mid-tier Google + SHE Media stack argues for the $4–12 band rather than the premium ceiling [^33^][^32^]. Independent cross-checks land inside the range: Worth Of Web's model estimates ~$247K/yr, and publisher benchmarks put 1.5–10M-pageview sites at $3K–$20K per month [^6^][^34^]. Planning rule: at base RPMs, every 1M monthly pageviews is worth $8K–$12K per month — and upgrading to a premium ad network later is a near-pure-margin lever, since the traffic is unchanged.

### 3.4 Ownership and history

The operator is On This Day Pte. Ltd. (Singapore), founded and still run by managing editor James Graham, a showcased Google AdSense publisher — ads have been the model from early on [^3^][^4^][^2^]. The archive began as HistoryOrb.com on 22 December 2000, evolved from a database originally collated by Bruce T. Goldman, and rebranded to OnThisDay.com on 21 July 2015 [^2^]. A 25-year-old, founder-led shop with no outside capital and one monetization engine is a profitable-but-static incumbent: its moat is accumulated editorial curation, not technology or network effects.

### 3.5 Comparables' monetization

The niche's other players prove that three monetization layers — ads, subscriptions, and data licensing — are all viable; OnThisDay uses only the first.

**Table 3-2. Monetization models of comparable properties**

| Property | Primary model | Premium / subscription | Paid API / data product | Reported scale |
|---|---|---|---|---|
| OnThisDay.com | Programmatic display + newsletter/co-brand sponsorships [^1^] | None | None (3rd-party APIs fill gap [^27^]) | ~1.8M visits/mo [^7^] |
| timeanddate.com | Ads + four paid APIs + freemium apps | In-app ad-free purchase | Time $49–399/yr; Astronomy $99–499/yr; Holidays (incl. "On This Day" data) $99–999/yr; Date Calculator $299–599/yr [^11^][^12^][^13^][^14^] | ~23M uniques/mo (2021) [^16^] |
| FamousBirthdays.com | ~100% programmatic display + video [^8^] | None (chose enterprise over consumer) | Famous Birthdays Pro trend data sold to platforms/agencies [^9^] | 25M uniques, 500M+ impressions/mo (2020) [^8^] |
| History.com (A+E) | Ads + TV + brand extensions | HISTORY Vault SVOD $5.99/mo or $59.99/yr [^20^] | Alexa "This Day in History" skill; live events [^21^] | Cable-network companion |
| Calendarific | API vendor | — | Holiday API: free 500 calls/mo; Starter $12/mo; Enterprise $4,000/yr [^23^] | 230+ countries |
| API-Ninjas | API vendor | — | Historical Events / Day-in-History APIs: $39–199/mo tiers [^25^][^26^] | 125+ APIs |

Three patterns should steer the founder's model. First, data licensing is the most repeated diversifier: timeanddate sells the very same "on this day" dataset inside its $99–999/yr Holidays API, and two independent vendors retail comparable feeds at $12–199 per month — proven demand at price points a solo founder can match [^13^][^23^][^25^]. Second, consumer willingness to pay attaches to packaged depth, not raw facts: HISTORY Vault monetizes ad-free long-form video at $5.99/mo [^20^], while Calendarific and API-Ninjas commoditize the data cheaply [^23^][^25^]. Third, scale is no prerequisite for B2B data revenue — Famous Birthdays built its Pro product on audience-trend data any traffic-bearing site generates [^9^]. Net implication: pair a free, widget-distributed content layer for acquisition with paid tiers where the incumbent is absent — API access, premium artifacts, sponsorship inventory — rather than competing for its ad dollars alone. Chapter 4 maps the full competitive field behind those openings — eight rivals and a mobile vanguard — and isolates the twelve capability gaps none of them covers.

#### Chapter References

[^1^]: OnThisDay.com — "Advertising Information" (via Wayback Machine, 29 Nov 2021). https://web.archive.org/web/20211129205834/https://www.onthisday.com/advertising.php
[^2^]: OnThisDay.com — "About Us" (via Wayback Machine, 2 Jan 2022). https://web.archive.org/web/20220102221238/https://www.onthisday.com/about.php
[^3^]: Crunchbase — "On This Day" company profile (On This Day Pte. Ltd.). https://www.crunchbase.com/organization/onthisday-com
[^4^]: The Tech Startup Channel — APAC startup listing naming "James Graham, Founder and managing editor at OnThisDay.com" (18 Dec 2017). https://thetechstartupchannelshow.wordpress.com/2017/12/16/were-looking-to-crown-apacs-most-promising-startups-are-you-the-top100connect-with-asias-top-tech-investors/
[^5^]: SiteWorthTraffic — Onthisday.com traffic/revenue report (~2021). https://www.siteworthtraffic.com/report/onthisday.com
[^6^]: Worth Of Web — onthisday.com valuation/traffic (~2022). https://www.worthofweb.com/website-value/onthisday.com/
[^7^]: Exploding Topics / Semrush — onthisday.com traffic report (Jun 2026): ~1.8M visits, global rank 27,998. https://analytics.explodingtopics.com/website/onthisday.com
[^8^]: Digiday — "How Famous Birthdays is building a growing media company on the back of programmatic ads" (30 Jan 2020). https://digiday.com/media/famous-birthdays-building-growing-media-company-back-programmatic-ads/
[^9^]: The Rebooting — "How Famous Birthdays built a data business from celebrity searches" (14 Feb 2022). https://www.therebooting.com/p/how-famous-birthdays-built-a-data-657bd9cb27b6682ed0d34f65
[^11^]: timeanddate.com API Services — Time API pricing. http://dev.timeanddate.com/time/pricing
[^12^]: timeanddate.com API Services — Astronomy API pricing. https://dev.timeanddate.com/astro/pricing
[^13^]: timeanddate.com API Services — Holidays API pricing (includes "On This Day" service). https://dev.timeanddate.com/holidays/pricing
[^14^]: timeanddate.com API Services — Date Calculator API pricing. https://dev.timeanddate.com/calculator/pricing
[^16^]: SiteWorthTraffic — timeanddate.com report (~2021). https://www.siteworthtraffic.com/report/timeanddate.com
[^20^]: HISTORY Vault Support — "How much does a HISTORY Vault subscription cost?" ($5.99/mo, $59.99/yr). https://support.historyvault.com/hc/en-us/articles/360058889513
[^21^]: A+E Global Media — "HISTORY®" brand portfolio (HISTORY Vault, HISTORYTalks, Alexa "This Day in History" skill, AlienCon). https://www.aegm.com/brands/history
[^23^]: Calendarific — Global Holiday Calendar API, Plans & Pricing. https://calendarific.com/
[^25^]: API Ninjas — Historical Events API docs (commercial use requires premium; related "Day in History" API). https://api-ninjas.com/api/historicalevents
[^26^]: API Ninjas — Pricing (Developer $39/mo, Business $99/mo, Professional $199/mo, Enterprise). https://api-ninjas.com/pricing
[^27^]: Viewbits — "On This Day API Documentation" (freemium third-party on-this-day JSON API) (17 Nov 2024). https://viewbits.com/docs/on-this-day-api-documentation
[^29^]: Ranktracker — "Comparing AdSense RPM in High-Income vs. Low-Income Regions" (US/CA/UK RPM $20–50+) (27 Jan 2025). https://www.ranktracker.com/blog/comparing-adsense-rpm-in-high-income-vs-low-income-regions/
[^31^]: Playwire — "Education Publisher Ad Revenue Monetization" ("education carries the highest average CPM of any content vertical") (5 May 2026). https://www.playwire.com/blog/education-publisher-ad-revenue-monetization-the-lesson-loop-advantage
[^32^]: EliteWealthPlan — "Mediavine vs AdThrive vs Ezoic" (avg RPM: Ezoic $11.93, Mediavine $24.35, Raptive $32.47) (1 Jul 2026). https://elitewealthplan.com/mediavine-vs-adthrive-vs-ezoic/
[^33^]: Skipblast — "Ezoic Earnings: November 2024 Niche Site Income Report" (education site EPMV $3.79–5.41 on Ezoic vs $23–54 RPM on Mediavine / $20+ on Raptive) (30 Nov 2024). https://www.skipblast.com/ezoic-earnings-november-2024-niche-site-income-report/
[^34^]: Next Millennium — "How Much Do Websites Make from Ads?" (1.5–10M pageview sites = $3K–$20K/mo at $2–15 RPM) (3 Mar 2026). https://nextmillennium.com/blog/how-much-do-websites-make-from-ads
[^36^]: Research file `onthisday_dim01_site_anatomy.md` — live-site observation of Google DoubleClick/Ad Manager ads and consent banner listing "1727 partners" (https://www.onthisday.com/)
