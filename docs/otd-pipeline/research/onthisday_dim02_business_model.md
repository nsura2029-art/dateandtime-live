# OnThisDay.com — Business Model & Traffic Analysis (Dimension 02)

*Research compiled for competitor revenue modeling. All third-party figures are estimates unless noted as self-reported. Sources + access dates at end.*

---

## Self-reported stats (verified)

Captured directly from the site's own `advertising.php` page (via Wayback Machine snapshot, 29 Nov 2021) and `about.php` (2 Jan 2022). The live pages are behind a Cloudflare challenge, so the archived copies were used; wording matches the brief.[^1^][^2^]

- **Positioning:** "the world's largest, most accurate and popular site for on this day in history," pitched to teachers, students and history fans.[^1^]
- **Content volume:** "over **200,000** historical events, famous birthdays, weddings and divorces and famous deaths," "created and edited by our team of historians." The About page (2022) cites **215,000+ entries**.[^1^][^2^]
- **Traffic claim:** "receives **over 1m visitors** serving **over 3m page views a month**."[^1^]
- **Audience geography:** "**53%** US, **15%** UK, **5%** Canada, **3%** Australia," rest global students/history lovers (~76% Tier-1 English markets).[^1^]
- **Ad serving / targeting:** "We use Google's industry standard **DFP** to serve our ads" (DoubleClick for Publishers, now Google Ad Manager). Ads "targeted to a specific country, continent or **hour of the day**" and can be "**frequency capped**." Sold with "complete transparent tracking" (impressions, clicks, CTR per banner).[^1^]
- **Formats:** "Four standard forms of advertising"; the named banner sizes are **728x90 (leaderboard)** and **300x250 (med-rectangle)**.[^1^]
- **Channels (section-targeted buys):** Home Page, History Articles, Film & Television, History, Music, Sport, People.[^1^]
- **Other inventory:** (a) **Daily Email Newsletter** sponsorship; (b) **Spanish-language** reach via sister site **HoyenlaHistoria.com**; (c) **Co-Branding** — exclusive page takeover where a sponsor's banners fill every ad zone on a page with a "This page brought to you by ___" caption (available sitewide except the front page).[^1^]
- Footer of the era showed "© 2000–2021 OnThisDay.com" plus an **SHE Media** "Ad Services Privacy Policy" link and AdChoices — i.e., a mid-tier programmatic ad-management partner in addition to Google's stack.[^1^]

*Verification note: every stat the brief listed (200k entries, 1M visitors / 3M pageviews, 53/15/5/3 geo split, DFP, geo/hour targeting + frequency capping, 728x90 & 300x250, channels, co-branding) is confirmed verbatim on the page.*

---

## Third-party traffic estimates

Estimates **conflict widely** (different methodologies/eras); treat as a range, not a point.

| Source | Date of data | Monthly visits | Monthly pageviews | Notes |
|---|---|---|---|---|
| **Semrush / Exploding Topics** [^7^] | Jun 2026 | **~1.8M visits** | — | Global rank **27,998**; US rank 10,046; Category rank #319 "Newspapers"; Authority Score 62. Most current & authoritative. |
| **Worth Of Web** [^6^] | ~mid-2022 (Alexa-based) | **~1.37M** | **~6.85M** | Est. value $968,800; revenue model ~$685/day (~$20.5K/mo, ~$247K/yr). Alexa rank 35,545. Pageviews look inflated. |
| **SiteWorthTraffic** [^5^] | ~2021 (Alexa-based) | **~308K** | **~683K** | Est. value $49,830; ~$23/day (~$683/mo). Alexa rank 41,547; ~2.2 pageviews/user. Far too low vs. self-report. |
| **Self-reported** [^1^] | 2021 | **1M+** | **3M+** | Used as conservative baseline. |

**Takeaways on traffic:**
- The **Semrush ~1.8M visits/mo (Jun 2026)** is the most reliable current figure and is consistent with the "1M+ visitors" self-claim.[^7^]
- The two 2021–22 Alexa-derived tools bracket the truth (308K vs 1.37M visits), illustrating how unreliable free estimators are for this site. The self-reported **3M+ pageviews/mo** sits between SiteWorthTraffic's 683K and WorthOfWeb's 6.85M and is the safest planning number.
- At ~2.2–3 pages/visit (Alexa showed 2.2), 1.8M visits implies **~4–5M pageviews/mo currently** — above the 2021 self-report, suggesting modest growth. Bounce-rate not published for this domain; comparable "quick-fact" reference pages are typically high-bounce / shallow-session, which matters for monetization (below).

---

## Monetization breakdown

**Primary: programmatic display advertising.** This is essentially the whole model.[^1^][^8^]
- Ad server: **Google DFP / Ad Manager**; founder James Graham is a showcased **Google AdSense** publisher ("Meet AdSense Publisher James Graham" video embedded on the About page).[^1^][^2^]
- Mid-tier ad-management partner: **SHE Media** (per the ad-services privacy link in footer).[^1^]
- Direct-sold sponsorships layered on top: channel buys, **co-branded page takeovers**, and **newsletter sponsorship**.[^1^]
- Internationalization: Spanish sister site **Hoy en la Historia** extends ad inventory.[^1^]

**What is NOT present (checked About/Contact/Privacy/Advertising/footers):**
- ❌ No consumer **premium / ad-free subscription** or membership.
- ❌ No first-party **paid API or data-licensing product** (unlike niche peers — see below). Third parties (e.g., Viewbits "On This Day API") monetize this data instead.[^27^]
- ❌ No visible **affiliate** program, e-commerce, donations/paywall, or events arm.
- ✅ Newsletter exists but is used as ad/sponsorship inventory, not a paid product.[^1^]

**Verdict:** a single-engine, ad-supported reference publisher. Diversification is thin — a clear gap vs. peers and an opportunity/risk a competitor should note.

---

## Revenue estimate model (with assumptions)

**Inputs & assumptions**
- **Pageviews:** 3.0M/mo conservative (self-report 2021) → 3.5M base → 4.0M high (Semrush 1.8M visits × ~2.2 pages/visit).[^1^][^7^]
- **Geo quality:** ~76% Tier-1 (US/UK/CA/AU) — favorable; high-income regions command the top RPMs.[^1^][^29^]
- **Niche RPM (education/reference/history):** Education is a *premium-CPM* vertical — Playwire reports it "carries the highest average CPM of any content vertical."[^31^] But this is **"quick-fact" content with shallow sessions** (~2.2 pages/visit, likely high bounce), which caps session value. Real-world education-site RPMs span a huge band by network: **$3–5 on Ezoic** up to **$20–54 on Mediavine/Raptive**.[^33^][^32^] General content-site page-RPM norms: ~$1–3 ordinary, $3–8 decent, $8–15 good vertical (US/EU search).[^30^][^28^]
- **Ad stack:** mid-tier programmatic (Google + SHE Media), ~2–3 impressions/page → assume **page RPM $4 (low) / $8 (base) / $12 (high)**.

**Model (annual = monthly × 12)**

| Scenario | Pageviews/mo | Page RPM | Monthly | Annual |
|---|---|---|---|---|
| Conservative | 3.0M | $4 | **$12,000** | **~$144K** |
| Base | 3.5M | $8 | **$28,000** | **~$336K** |
| Optimistic | 4.0M | $12 | **$48,000** | **~$576K** |

**Cross-checks:** WorthOfWeb's independent model lands at **~$247K/yr** (inside range); SiteWorthTraffic's ~$8K/yr is a clear under-estimate (broken ~$1 RPM assumption).[^6^][^5^] Broader publisher benchmarks put 1.5–10M-pageview sites at **$3K–$20K/mo** ($36K–$240K/yr) at $2–15 RPM, consistent with the conservative-to-base band.[^34^]

> **Planning estimate: ~$150K–$575K/year, base case ≈ $300K–$350K/year** from display ads alone. Upside exists (education RPMs of $20+ on premium networks like Raptive/Mediavine) *if* the operator upgraded its ad stack, but its current mid-tier setup argues for the base band.[^33^][^32^]

---

## Ownership / history

- **Founder & Managing Editor: James Graham.** "James founded On This Day in **2000**."[^2^] A 2017 APAC startup listing identifies "James Graham — Founder and managing editor at OnThisDay.com," and Crunchbase lists the founder as Graham (James) Graham.[^4^][^3^]
- **Legal entity:** **On This Day Pte. Ltd.** — a Singapore-registered private limited company (Crunchbase).[^3^]
- **Origin of data:** archives "evolved from a smaller database originally collated by **Bruce T. Goldman**," expanded/corrected by the in-house team and reader submissions.[^2^]
- **Timeline (from About page):**[^2^]
  - **2000-12-22** — launched as **HistoryOrb.com**
  - 2004 — added MusicOrb.com / TodayinSport.com (now Music & Sport channels)
  - 2008 — first major redesign
  - 2012 — launched Spanish sister site **Hoy en la Historia**
  - **2015-07-21** — rebranded/relocated **HistoryOrb.com → OnThisDay.com**
  - 2016 — second redesign (studio Fhoke); added History and Film & TV channels
  - 2017 — helped launch non-profit Borneo Dictionary
- **Operator profile:** lean founder-led content shop; monetized via AdSense/programmatic from early on (Graham is a featured AdSense publisher).[^2^]

---

## Niche comparables monetization table

| Property | Owner / founded | Primary model | Premium / subscription | Paid API / data product | Scale (reported) |
|---|---|---|---|---|---|
| **OnThisDay.com** | On This Day Pte. Ltd. (SG); J. Graham; 2000 | Programmatic display (Google DFP + SHE Media) + newsletter/co-brand sponsorship | ❌ | ❌ (3rd parties fill gap) | ~1.8M visits/mo [^7^] |
| **timeanddate.com** | Time and Date AS (Norway); 1998 | Display ads + **4 paid APIs** + freemium mobile apps (IAP ad-free) | App IAP (ad-free) | ✅ **Time $49–399/yr, Astronomy $99–499/yr, Holidays $99–999/yr (incl. "On This Day" service), Date Calculator $299–599/yr** | ~23M uniques/mo (2021) [^11^][^12^][^13^][^14^][^16^][^17^] |
| **FamousBirthdays.com** | E. Britton; 2012; Santa Monica | **~100% programmatic** display + video ads | ❌ (chose enterprise over consumer subs) | ✅ **Famous Birthdays Pro** — popularity-trend data sold to platforms/agencies/talent | 25M uniques/mo; 500M+ impressions/mo (2020) [^8^][^9^][^10^] |
| **History.com** | A+E Global Media (Hearst/Disney JV) | Display + video ads; TV-Everywhere unlock; brand/extensions | ✅ **HISTORY Vault** SVOD **$5.99/mo or $59.99/yr** (ad-free) | ✅ Voice/“This Day in History” Alexa skill; events (HISTORYTalks, AlienCon), podcasts | Major cable-network companion [^18^][^19^][^20^][^21^][^22^] |
| **Calendarific** (API) | — | n/a (API vendor) | — | ✅ Holiday API: Free 500/mo; Starter **$12/mo**; Business $400/yr; Enterprise $4,000/yr | 230+ countries [^23^][^24^] |
| **API-Ninjas** (Historical Events + Day-in-History APIs) | — | n/a (API vendor) | — | ✅ Dev **$39/mo** (100k), Business **$99/mo** (1M), Pro **$199/mo** (10M), Enterprise custom; free tier non-commercial | 125+ APIs [^25^][^26^] |
| **Viewbits "On This Day API"** | 3rd party | n/a (API vendor) | — | ✅ Freemium JSON feed (5 req/30s free; key for premium) | — [^27^] |

---

## Takeaways

1. **Single-engine business:** OnThisDay.com is a ~25-year-old, founder-run (James Graham / On This Day Pte. Ltd., Singapore) reference publisher making essentially **all revenue from programmatic display ads** (Google Ad Manager + SHE Media), plus direct newsletter/co-brand sponsorships.[^1^][^2^][^3^]
2. **Verified scale:** Self-report (200k+ entries; 1M+ visitors / 3M+ pageviews; 53% US / 15% UK / 5% CA / 3% AU) is confirmed verbatim on its rate page; the most current third-party read is **~1.8M visits/mo (Semrush, Jun 2026)**.[^1^][^7^]
3. **Traffic estimates conflict** (308K vs 1.37M vs 1.8M visits) — use self-report + Semrush as anchors; ignore low Alexa-era tools.[^5^][^6^][^7^]
4. **Revenue ≈ $150K–$575K/yr, base ≈ $300K–$350K/yr** on 3–4M pageviews at $4–12 page RPM; education is a premium-CPM niche but "quick-fact" shallow sessions temper RPM.[^30^][^31^][^33^]
5. **Clear monetization gap = competitor opportunity:** OnThisDay has **no premium tier, no paid API, no data-licensing arm**. Peers prove the upside — timeanddate runs **four paid APIs** (incl. an "On This Day" data service) and freemium apps; Famous Birthdays sells a **Pro data product**; History.com runs **HISTORY Vault SVOD** and voice skills.[^13^][^9^][^20^]
6. **Data is commoditized:** the underlying "on this day" dataset is already sold cheaply by third parties (Calendarific $12/mo; API-Ninjas $39–199/mo; Viewbits freemium), so a new entrant can source content/API cheaply and should differentiate on engagement depth and diversified monetization rather than raw facts.[^23^][^25^][^27^]
7. **Modeling guidance for a competitor:** anchor on ~$8–12 page RPM for US-heavy history/education programmatic traffic; every 1M pageviews ≈ **$8K–$12K/mo**; add upside levers (premium ad-free, paid API, newsletter sponsorship, data licensing) that OnThisDay leaves on the table.

---

## Sources

[^1^]: OnThisDay.com — "Advertising Information" (via Wayback Machine, 29 Nov 2021). https://web.archive.org/web/20211129205834/https://www.onthisday.com/advertising.php (accessed 2026)
[^2^]: OnThisDay.com — "About Us" (via Wayback Machine, 2 Jan 2022). https://web.archive.org/web/20220102221238/https://www.onthisday.com/about.php (accessed 2026)
[^3^]: Crunchbase — "On This Day" company profile (On This Day Pte. Ltd.). https://www.crunchbase.com/organization/onthisday-com (accessed 2026)
[^4^]: The Tech Startup Channel — APAC startup listing naming "James Graham, Founder and managing editor at OnThisDay.com" (18 Dec 2017). https://thetechstartupchannelshow.wordpress.com/2017/12/16/were-looking-to-crown-apacs-most-promising-startups-are-you-the-top100connect-with-asias-top-tech-investors/
[^5^]: SiteWorthTraffic — Onthisday.com traffic/revenue report (report ~2021). https://www.siteworthtraffic.com/report/onthisday.com (accessed 2026)
[^6^]: Worth Of Web — onthisday.com valuation/traffic (report ~2022). https://www.worthofweb.com/website-value/onthisday.com/ (accessed 2026)
[^7^]: Exploding Topics / Semrush — onthisday.com traffic report (Jun 2026): ~1.8M visits, global rank 27,998. https://analytics.explodingtopics.com/website/onthisday.com (accessed 2026)
[^8^]: Digiday — "How Famous Birthdays is building a growing media company on the back of programmatic ads" (30 Jan 2020). https://digiday.com/media/famous-birthdays-building-growing-media-company-back-programmatic-ads/
[^9^]: The Rebooting — "How Famous Birthdays built a data business from celebrity searches" (14 Feb 2022). https://www.therebooting.com/p/how-famous-birthdays-built-a-data-657bd9cb27b6682ed0d34f65
[^10^]: SoCalTech — "Carving An Internet Niche With FamousBirthdays.com" (Evan Britton interview, 14 May 2013). https://www.socaltech.com/carving_an_internet_niche_with_famousbirthdays_com/s-0049284.html
[^11^]: timeanddate.com API Services — Time API pricing. http://dev.timeanddate.com/time/pricing (accessed 2026)
[^12^]: timeanddate.com API Services — Astronomy API pricing. https://dev.timeanddate.com/astro/pricing (accessed 2026)
[^13^]: timeanddate.com API Services — Holidays API pricing (includes "On This Day" service). https://dev.timeanddate.com/holidays/pricing (accessed 2026)
[^14^]: timeanddate.com API Services — Date Calculator API pricing. https://dev.timeanddate.com/calculator/pricing (accessed 2026)
[^15^]: World Data API — "World Data API vs TimeAndDate" comparison (30 Nov 2025). https://worlddataapi.com/compare/timeanddate
[^16^]: SiteWorthTraffic — timeanddate.com report (~2021). https://www.siteworthtraffic.com/report/timeanddate.com
[^17^]: Soft112 — "World Clock by timeanddate.com" (freemium app: ad-funded + IAP ad-free) (18 May 2021). https://world-clock-by-timeanddate-com.soft112.com/
[^18^]: The Streamable — "HISTORY Vault Review" ($4.99/mo or $49.99/yr, ad-free). https://thestreamable.com/video-streaming/history-vault (accessed 2026)
[^19^]: PCMag UK — "History Vault Review" (20 Apr 2023). https://uk.pcmag.com/old-video-streaming-services/135362/history-vault
[^20^]: HISTORY Vault Support — "How much does a HISTORY Vault subscription cost?" ($5.99/mo, $59.99/yr). https://support.historyvault.com/hc/en-us/articles/360058889513 (accessed 2026)
[^21^]: A+E Global Media — "HISTORY®" brand portfolio (HISTORY Vault, HISTORYTalks, Alexa "This Day in History" skill, AlienCon). https://www.aegm.com/brands/history (accessed 2026)
[^22^]: HISTORY Support — "How much is a History Channel subscription" (TV-Everywhere unlock; Vault $5.99/mo). https://support.history.com/hc/en-us/articles/1500009175581 (accessed 2026)
[^23^]: Calendarific — Global Holiday Calendar API, Plans & Pricing. https://calendarific.com/ (accessed 2026)
[^24^]: World Data API — "World Data API vs Calendarific" (30 Nov 2025). https://worlddataapi.com/compare/calendarific
[^25^]: API Ninjas — Historical Events API docs (commercial use requires premium; related "Day in History" API). https://api-ninjas.com/api/historicalevents (accessed 2026)
[^26^]: API Ninjas — Pricing (Developer $39/mo, Business $99/mo, Professional $199/mo, Enterprise). https://api-ninjas.com/pricing (accessed 2026)
[^27^]: Viewbits — "On This Day API Documentation" (freemium third-party on-this-day JSON API) (17 Nov 2024). https://viewbits.com/docs/on-this-day-api-documentation
[^28^]: Ranktracker — "How Much Does AdSense Pay for 1,000 Pageviews?" (niche RPM bands) (24 Jan 2025). https://www.ranktracker.com/blog/how-much-does-adsense-pay-for-1-000-pageviews/
[^29^]: Ranktracker — "Comparing AdSense RPM in High-Income vs. Low-Income Regions" (US/CA/UK RPM $20–50+) (27 Jan 2025). https://www.ranktracker.com/blog/comparing-adsense-rpm-in-high-income-vs-low-income-regions/
[^30^]: MakerNeo — "What is a Typical Google AdSense Page RPM?" (page-RPM ranges by site type/geo) (16 Jul 2026). https://www.makerneo.com/en/articles/google-adsense-page-rpm-cpm-income-guide.html
[^31^]: Playwire — "Education Publisher Ad Revenue Monetization" ("education carries the highest average CPM of any content vertical") (5 May 2026). https://www.playwire.com/blog/education-publisher-ad-revenue-monetization-the-lesson-loop-advantage
[^32^]: EliteWealthPlan — "Mediavine vs AdThrive vs Ezoic" (avg RPM: Ezoic $11.93, Mediavine $24.35, Raptive $32.47) (1 Jul 2026). https://elitewealthplan.com/mediavine-vs-adthrive-vs-ezoic/
[^33^]: Skipblast — "Ezoic Earnings: November 2024 Niche Site Income Report" (education site EPMV $3.79–5.41 on Ezoic vs $23–54 RPM on Mediavine / $20+ on Raptive) (30 Nov 2024). https://www.skipblast.com/ezoic-earnings-november-2024-niche-site-income-report/
[^34^]: Next Millennium — "How Much Do Websites Make from Ads?" (1.5–10M pageview sites = $3K–$20K/mo at $2–15 RPM) (3 Mar 2026). https://nextmillennium.com/blog/how-much-do-websites-make-from-ads
[^35^]: Niche Pursuits — "How much does Google AdSense pay per pageview?" ($2–5 low end, $30+ high end) (28 Jun 2024). https://www.nichepursuits.com/how-much-does-google-adsense-pay-per-pageview/

*Note: live onthisday.com and hypestat.com pages were behind Cloudflare bot-challenges at research time; self-reported figures were therefore verified via Wayback Machine captures of the same pages. Third-party traffic/revenue numbers are estimator outputs and should be treated as directional.*
