# SEO + Compliance Strategy

> Cross-cutting strategy for indexability (SEO), jurisdiction-specific cookie compliance, and E-E-A-T signals. This is the canonical source for "where to put X" decisions related to indexing, consent, and legal pages.

**Date:** 2026-07-19
**Status:** Active — Tier 1 + Tier 2 in progress
**Owner:** —
**Related:** [HOLIDAY-INTELLIGENCE-PLATFORM-PRD.md](./HOLIDAY-INTELLIGENCE-PLATFORM-PRD.md) — the SEO section of the flagship product PRD

---

## Table of contents

- [1. The big picture](#1-the-big-picture)
- [2. SSR architecture (the SSR-by-injection pattern)](#2-ssr-architecture-the-ssr-by-injection-pattern)
- [3. Tier 1 — SSR + indexing (ship today)](#3-tier-1--ssr--indexing-ship-today)
- [4. Tier 2 — Footer + legal + cookie consent (ship this week)](#4-tier-2--footer--legal--cookie-consent-ship-this-week)
- [5. Tier 3 — Programmatic SEO + blog + backlinks (next 2 weeks)](#5-tier-3--programmatic-seo--blog--backlinks-next-2-weeks)
- [6. Cookie consent strategy](#6-cookie-consent-strategy)
- [7. Jurisdiction matrix](#7-jurisdiction-matrix)
- [8. JSON-LD strategy](#8-json-ld-strategy)
- [9. Sitemap + robots strategy](#9-sitemap--robots-strategy)
- [10. Google Search Console plan](#10-google-search-console-plan)
- [11. E-E-A-T improvement plan](#11-e-e-a-t-improvement-plan)
- [12. Analytics — decision deferred](#12-analytics--decision-deferred)
- [13. Backlink strategy](#13-backlink-strategy)
- [14. Open questions](#14-open-questions)

---

## 1. The big picture

dateandtime.live is a brand-new static-first site served by a Cloudflare Worker. We're in the same niche as `timeanddate.com` (DA 90+), so we cannot outrank them on broad queries. We CAN win on:

- **Long-tail**: "current time in [obscure city]" — 33K+ opportunities
- **Programmatic SEO**: per-city and per-country pages at scale
- **Specific tools** that timeanddate.com doesn't have well: long weekend finder, working day calculator, PTO optimizer
- **Newer / smaller markets** timeanddate.com doesn't prioritize

To do this, we need to:
1. Be **crawlable** (SSR for all public pages, sitemap, robots, JSON-LD)
2. Be **legal** (GDPR/CCPA/LGPD-compliant cookie consent, privacy/terms/about pages)
3. Be **trustworthy** (E-E-A-T: editorial policy, author bio, contact, sources)
4. Be **discoverable** (GSC, backlinks, AI engines)

This doc is the master plan for #1–#4.

---

## 2. SSR architecture (the SSR-by-injection pattern)

### Why SSR-by-injection (not a framework switch)

We already have a Cloudflare Worker intercepting every request (`src/index.js`, `run_worker_first = true`). The cleanest path is to **enhance the existing Worker** to inject request-time data into the HTML before serving. No new framework, no build step, no migration.

### Flow

```
Browser request
  ↓
Cloudflare Worker (src/index.js)
  ↓ reads static HTML from assets
  ↓ injects: window.__location, H1 city name, initial time, JSON-LD context, cookie consent state
  ↓ returns fully-rendered HTML
  ↓
Browser receives complete HTML (Google sees same thing)
  ↓
Client JS resumes (clock, pills, search, popular cities, cookie banner)
```

### What gets SSR'd

| Element | Source | Injected by |
|---|---|---|
| H1 city name | `request.cf.city` | Worker |
| `<title>` | `request.cf.city`, `request.cf.region` | Worker |
| Meta description | computed from city + time | Worker |
| `window.__location` | `request.cf.*` | Worker (already done) |
| `window.__initialTime` | `Intl.DateTimeFormat` with `request.cf.timezone` | Worker |
| `window.__consentRegion` | derived from `request.cf.country` | Worker |
| `window.__hasConsent` | parsed from `cookie_consent` cookie | Worker |
| Cookie banner HTML | region-specific copy | Worker |
| All static text | hardcoded in HTML | HTML |
| Search index, popular cities | hardcoded in HTML | HTML |

### What does NOT get SSR'd (today)

| Element | Why | Future? |
|---|---|---|
| Holiday pill | Requires API call to /api/v1/holidays/today | Could be SSR with Worker-side fetch |
| Sunrise pill | Requires API call + lat/lon lookup | Could be SSR with Worker-side fetch |
| Live clock | Dynamic (1Hz updates) | Initial time is SSR'd; JS resumes |
| Search results | User input | N/A |

### Trade-offs

- ✅ All public text in raw HTML (Google, AI engines, screen readers all see it)
- ✅ No framework lock-in, no build complexity
- ✅ ~50ms extra latency per request (negligible)
- ⚠️ Pills (holiday, sunrise) stay client-side for now
- ⚠️ Per-city `/time/in/{city}/` pages need their own SSR route (out of scope today)

---

## 3. Tier 1 — SSR + indexing (ship today)

### 3.1 SSR Worker enhancement

`src/index.js` gets:
- `parseConsentCookie(cookieHeader)` — reads the `cookie_consent` cookie
- `getInitialTime(timezone)` — server-rendered initial time
- `injectSSRContext(html, request, consent)` — replaces H1 placeholder, updates title, injects `window.__*` globals
- `injectCookieBanner(html, region, consent)` — adds banner HTML before `</body>`

### 3.2 Static H1 fallback

H1 in HTML:
```html
<h1 class="greeting-seo">Current time in <span class="greeting-city" id="greeting-city">your city</span></h1>
```

Worker replaces `your city` with the actual city from `request.cf` (or leaves as `your city` if unknown).

### 3.3 Dynamic title + meta

- Title: `Current Time in [city], [region] | dateandtime.live`
- Description: `It's [time] in [city] right now. Live clock, sunrise/sunset, holidays, and business hours.`

### 3.4 JSON-LD structured data (3 schemas)

| Schema | Where | Purpose |
|---|---|---|
| `WebSite` | All pages | Sitelinks search box + site identity |
| `SoftwareApplication` | Homepage | Tells Google we're a tool, not just content |
| `FAQPage` | Homepage (Q&As in the body) | Featured snippets + rich results |

### 3.5 `sitemap.xml`

Lists all public URLs. Future: dynamically include all 33K+ `/time/in/{city}/` pages.

### 3.6 `robots.txt`

- Allow everything
- Reference sitemap
- Disallow `/api/`

---

## 4. Tier 2 — Footer + legal + cookie consent (ship this week)

### 4.1 Real `<footer>` element

On every page, with: About · Privacy · Terms · Editorial Policy · Contact · Sitemap · Do Not Sell (CCPA).

### 4.2 Legal pages

| Page | URL | Content |
|---|---|---|
| Privacy | `/privacy/` | GDPR + CCPA + LGPD compliant, plain English |
| Terms | `/terms/` | Terms of service, simple |
| About | `/about/` | Who we are, mission, data sources, contact |
| Editorial Policy | `/editorial-policy/` | How we ensure accuracy (E-E-A-T gold) |

**Design decision (user-locked 2026-07-19):** All legal pages are **simple, with left-side nav** for jumping between sections. No fancy stuff, no cards.

### 4.3 Cookie consent banner

See [§6](#6-cookie-consent-strategy) for the full design.

---

## 5. Tier 3 — Programmatic SEO + blog + backlinks (next 2 weeks)

### 5.1 Per-city pages

`/time/in/{city-slug}/` — one per city in our 33,945-city DB. Each page is:
- SSR (Worker reads city from URL, fetches data, injects)
- H1: "Current time in [city], [country]"
- Sections: clock, date, sunrise/sunset, DST, holidays, working hours, on-this-day
- JSON-LD: per-page `WebPage` + `Place` schema
- Internal links: 5+ other cities in the same country

Estimated 33K+ indexable pages × 5–10 keyword patterns = 165K–330K long-tail URLs.

### 5.2 Blog

4–6 pillar articles targeting top 10 keywords:
- "Long weekend in [country] [year]" (80K/mo)
- "Working days in [country] [year]" (50K/mo)
- "When is [holiday] in [year]?" (varies)
- "Time zone [city]" (varies)
- "Sunrise/sunset times in [city] [month]" (varies)

### 5.3 The "big wins" tools

Per the Holiday PRD, these have the highest SEO potential:
- **Long Weekend Finder** (no good free tool exists)
- **Working Day Calculator** (high JTBD, no free API)
- **Next Business Day** (programmer + business audience)
- **PTO Optimizer** (60K/mo, 2026 trend, first-mover)

---

## 6. Cookie consent strategy

### 6.1 The 3-bucket model

| Category | Always on? | Purpose | Examples |
|---|---|---|---|
| **Essential** | ✅ Yes | Site functionality, no consent needed | Theme, location, language preference, session state |
| **Analytics** | ❌ Opt-in | Help us improve the site | Plausible / Fathom / GA4 (provider TBD) |
| **Advertising** | ❌ Opt-in | Keep the site free | Google AdSense / media.net (when approved) |

### 6.2 Banner UX

```
┌────────────────────────────────────────────────────────────────┐
│ 🍪 Cookies.                                                    │
│                                                                │
│ We use essential cookies to keep the clock working.            │
│ Analytics and ads are opt-in. [Privacy] · [Customize]         │
│                                                                │
│ [Essential only]                    [Accept all]               │
└────────────────────────────────────────────────────────────────┘
```

- Shows on first visit
- "Essential only" closes banner, no analytics/ads load
- "Accept all" sets all 3 categories to true
- "Customize" expands to show category checkboxes
- Once chosen, banner doesn't reappear for 12 months (best practice)

### 6.3 Region-specific copy

| Region | Copy difference |
|---|---|
| EU/UK/CA/BR (GDPR-equivalent) | "Under GDPR/CCPA, we need your consent before non-essential cookies." |
| Other regions | "We respect your privacy. Choose what to allow." |

### 6.4 Storage

- `cookie` named `cookie_consent`
- Value: JSON `{essential: true, analytics: bool, advertising: bool, ts: ISO_DATE, v: 1}`
- Attributes: `Path=/; Max-Age=31536000; SameSite=Lax`
- Worker reads the cookie on every request

### 6.5 Server-side script gating

- Worker injects `window.__hasConsent` on every request
- Worker injects analytics `<script>` tags ONLY if `__hasConsent.analytics === true`
- Worker injects ad `<script>` tags ONLY if `__hasConsent.advertising === true`
- AdSense / analytics provider scripts are NEVER inlined in the static HTML — they are inserted by the Worker at request time

### 6.6 CCPA "Do Not Sell" link

- Visible in footer
- Sets `cookie_consent.advertising = false` + sets a `dnt` global flag
- Tells any future ad networks not to sell/share personal info

---

## 7. Jurisdiction matrix

| Jurisdiction | Consent required for non-essential? | Our approach |
|---|---|---|
| 🇪🇺 **GDPR** (EU 27) | Yes, explicit opt-in | Banner blocks analytics/ads until consent |
| 🇬🇧 **UK PECR** | Yes (post-Brexit, same as GDPR) | Same as EU |
| 🇧🇷 **LGPD** (Brazil) | Yes | Same as EU |
| 🇨🇦 **PIPEDA + Quebec Law 25** | Yes (Quebec), implied (federal) | Same as EU + "Do Not Sell" |
| 🇦🇺 **Privacy Act** (Australia) | Implied, but transparent notice needed | Banner shows but copy is "softer" |
| 🇯🇵 **APPI** (Japan) | Implied for some cookies | Banner shows |
| 🇺🇸 **CCPA/CPRA** (California) | Opt-out model | "Do Not Sell" link in footer + opt-out via banner |
| Other (US, Asia, Africa) | No strict law, but best practice | Banner shows with neutral copy |

**Implementation:** use `request.cf.country` to determine the region. The Worker injects the right banner copy.

---

## 8. JSON-LD strategy

### 8.1 Per page type

| Page | Primary schema | Secondary |
|---|---|---|
| `/` (home) | `WebSite` + `SoftwareApplication` | `FAQPage` (Q&As in body) |
| `/holidays/` | `WebPage` + `ItemList` | `FAQPage` |
| `/onthisday/` | `WebPage` + `ItemList` | — |
| `/privacy/` | `WebPage` | — |
| `/terms/` | `WebPage` | — |
| `/about/` | `AboutPage` + `Organization` | — |
| `/editorial-policy/` | `WebPage` | — |
| `/time/in/{city}/` (future) | `WebPage` + `Place` | `FAQPage` |

### 8.2 FAQ content (homepage)

8–10 Q&As that match common queries:
- "What time is it in [city]?"
- "How do I convert time between cities?"
- "When is the next holiday in [country]?"
- "When does daylight saving time end in [country]?"
- "What is the UTC offset for [city]?"
- ...

Each Q&A is a `<h2>` heading + 40–60 word answer, with the answers in the JSON-LD `FAQPage` schema.

---

## 9. Sitemap + robots strategy

### 9.1 `sitemap.xml`

```
/
/holidays/
/onthisday/
/privacy/
/terms/
/about/
/editorial-policy/
... (future: /time/in/{slug}/ for each city)
```

### 9.2 `robots.txt`

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://dateandtime.live/sitemap.xml
```

### 9.3 Future: per-city sitemaps

When we ship 33K+ per-city pages, split into:
- `sitemap-cities-eu.xml`
- `sitemap-cities-asia.xml`
- `sitemap-cities-americas.xml`
- etc.

Use a sitemap index file `sitemap.xml` that points to all the sub-sitemaps.

---

## 10. Google Search Console plan

### 10.1 Submit

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Choose "URL prefix" → `https://dateandtime.live/`
3. Verify via DNS (CNAME or TXT) — Cloudflare makes this 1-click
4. Submit `sitemap.xml`

### 10.2 Also submit to

- **Bing Webmaster Tools** (Bing is 5–10% of search)
- **Yandex Webmaster** (Russia)
- **Baidu Search Console** (China) — probably not relevant for our audience
- **Apple Search Ads** (if we ever ship iOS app)
- **DuckDuckGo** (no formal console, but they use Bing's index)

### 10.3 Track

- Coverage (indexed vs. excluded pages)
- Performance (queries, clicks, CTR, position)
- Mobile usability
- Core Web Vitals

### 10.4 Submit to AI engines

- **Perplexity**: no formal submission, but their index uses Bing + their own crawlers
- **ChatGPT**: no formal submission, but content cited by Wikipedia/Reddit is more likely
- **Google AI Overviews**: same as regular GSC
- **Claude**: same

---

## 11. E-E-A-T improvement plan

### 11.1 Current state

- ❌ No "About" page
- ❌ No "Editorial Policy" page
- ❌ No "Contact" page
- ❌ No author bio anywhere

### 11.2 Target state

- ✅ `/about/` with team info, mission, data sources
- ✅ `/editorial-policy/` explaining how we ensure time accuracy
- ✅ Contact: `hello@dateandtime.live` (link in footer)
- ✅ Data sources listed visibly: IANA, Nager.Date, Wikipedia, etc.
- ✅ Update cadence noted ("Updated daily" or "Last updated: [date]")

---

## 12. Analytics — decision deferred

**Date:** 2026-07-19
**Decision:** Deferred — pick a provider before adding the script

### Options

| Option | Pros | Cons | Cost |
|---|---|---|---|
| **Plausible** | Cookieless, privacy-friendly, GDPR-compliant by default, fast | Paid (starts $9/mo) | $9–$19/mo |
| **Fathom** | Same as Plausible | Paid, smaller community | $14/mo+ |
| **Google Analytics 4** | Free, deep data, integrations | Requires consent, complex, IP-based | Free |
| **Cloudflare Analytics** | Free, no consent needed, but limited | Only traffic (no events, no funnels) | Free |
| **None for now** | Zero compliance burden | No data, blind to user behavior | Free |

### Current choice (2026-07-19)

**Cloudflare Analytics only** (no cookies, no consent needed, free). We'll add Plausible later if we need more detailed data.

### Implementation

- The cookie banner is built to gate analytics scripts
- When we add Plausible/GA4 later, the script will be injected by the Worker ONLY when `cookie_consent.analytics === true`
- For now: no analytics script loads. The banner still appears for legal compliance, but no analytics happens either way.

---

## 13. Backlink strategy

### 13.1 Quick wins (week 1)

- **Hacker News** "Show HN" — launch post
- **Product Hunt** — coordinated launch
- **Reddit**: r/webdev, r/programming, r/sysadmin, r/SEO, r/bigseo
- **Indie Hackers** — build log + product page
- **Dev.to** — 2–3 technical articles about the architecture
- **Hashnode** — same articles cross-posted

### 13.2 Medium wins (month 1)

- Get listed in "best of" lists (e.g. "top 10 time zone tools")
- Comment on relevant HN/Reddit threads with helpful info (not spammy)
- Guest posts on time management / productivity blogs
- Outreach to timeanddate.com alternative listicles

### 13.3 Long-term (months 2–6)

- Original research: "What country has the most public holidays?" — data-backed article
- Tools that other sites want to link to: long weekend finder, working day calculator
- Press coverage: tech blogs, news sites
- Wikipedia citations (if our data is genuinely useful)

---

## 14. Open questions

| Question | Status | Decision deadline |
|---|---|---|
| Analytics provider | **Deferred** | Before we add the script (not urgent) |
| Domain email `hello@dateandtime.live` | Set up via Cloudflare Email Routing | This week |
| AdSense application | After Tier 1 + Tier 2 ship + ~3 months of content | End of 2026 |
| i18n: which 5–10 languages first? | TBD | After MVP stabilizes |
| Author byline: real name or "dateandtime.live team"? | TBD | When we add a blog |
| Per-city pages: which 5 city templates? | TBD | When we build `/time/in/{city}/` |
| Editorial process: who reviews accuracy? | TBD | This week |

---

## 15. Google Consent Mode v2 (shipped 2026-07-19)

**Why:** Mandatory for any site using Google Ads / GA4 / Marketing Platform to reach EEA + UK users. Google actively disabled personalization, remarketing, and conversion tracking for non-compliant accounts starting **July 21, 2025**. Next enforcement wave: **June 15, 2026** (Google Signals stops being a fallback).

**Source:** [developers.google.com/tag-platform/security/guides/consent](https://developers.google.com/tag-platform/security/guides/consent)

### 15.1 What it does

Google Consent Mode v2 sends 4 consent signals to Google before any Google tag loads:

| Parameter | Values | What it means |
|---|---|---|
| `ad_storage` | granted / denied | Cookies for ads |
| `analytics_storage` | granted / denied | Cookies for analytics |
| `ad_user_data` (v2 new) | granted / denied | Send user data to Google for advertising |
| `ad_personalization` (v2 new) | granted / denied | Personalized ads (remarketing) |

When `denied`, Google still sends **cookieless pings** for measurement (no cookies, no PII) — so you still get modeled conversions.

### 15.2 Implementation on dateandtime.live

**Region-aware defaults (set in Worker before any HTML):**

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: "denied",            // EEA/UK: all denied
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);
</script>
```

- For users in GDPR countries (EU 27, UK, BR, CA): all 4 signals set to `denied`
- For users in other countries: all 4 signals set to `granted`
- `wait_for_update: 500` = wait 500ms for the banner before firing tags (so tags can read the user's choice)
- `ads_data_redaction: true` = strip IP from Google hits when ad_user_data is denied (extra privacy)

**Consent update (fired when user makes a choice in the banner):**

```js
window.gtag("consent", "update", {
  ad_storage: advertising ? "granted" : "denied",
  analytics_storage: analytics ? "granted" : "denied",
  ad_user_data: advertising ? "granted" : "denied",
  ad_personalization: advertising ? "granted" : "denied"
});
```

This is called from `src/cookie-consent.js` in `saveConsent()` (3 places: "Essential only", "Accept all", "Customize + Save") and in `doNotSell()` (CCPA link in footer).

**3-bucket → 4-signal mapping:**

| Our bucket | Google signal(s) |
|---|---|
| Essential (always on) | (no Google signal needed) |
| Analytics (opt-in) | `analytics_storage` |
| Advertising (opt-in) | `ad_storage` + `ad_user_data` + `ad_personalization` |

### 15.3 Why we did this before adding Google tags

We're not using Google Ads or GA4 yet, but:
- ✅ Implementing now = zero risk, future-proof
- ✅ When we add AdSense, the consent state is already there
- ✅ When we add GA4, same — no retroactive work
- ✅ SEO strategy doc has the full implementation reference

### 15.4 Verification checklist (when we add AdSense/GA4)

- [ ] Open Chrome Tag Assistant, visit the site
- [ ] Accept all consent → expect consent state `g111` in hits to GA4
- [ ] Reject all consent → expect cookieless pings with state `g100`
- [ ] In GA4: Admin > Data Streams > confirm "ads measurement consent signals active" is green
- [ ] In Google Ads: Diagnostics > individual conversions > confirm Consent Mode status is OK

### 15.5 References

- Google Consent Mode docs: https://developers.google.com/tag-platform/security/guides/consent
- GTM support: https://support.google.com/tagmanager/answer/13695607
- Implementation guide: https://joindatacops.com/resources/google-consent-mode-v2-a-complete-implementation-guide/

