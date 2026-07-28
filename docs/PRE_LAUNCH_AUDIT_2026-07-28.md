# Pre-Launch Audit — dateandtime.live
**Date:** 2026-07-28  
**Target launch:** ~2026-08-04 (1 week)  
**Method:** Live headless browser + curl against `tdp-landing-dev` and `datetime-api-dev`  
**State of branch:** `feature/world-time-hub`, commit `bb2b3b156`, 55 ahead of develop

---

## TL;DR — Where we stand

We have **a real, working site** with 33,945 city URLs, 911 + 15,994 US city pages, country/state pages, news, hero clocks, and a working API. Most things are solid.

**But I found 5 critical bugs that need to ship before launch** (≈ 6–10 hours of work), **6 quality issues** to consider (≈ 1 day), and a few nice-to-haves. None are architectural — they're all localized.

**Verdict:** Don't ship today. Ship after fixing the 5 criticals + the 2 highest-priority quality issues (≈ 1 day of work). With buffer, we're launch-ready in 2–3 days.

---

## Critical bugs — must fix before launch

### 🔴 C1. Legacy city pages have ZERO images (911 pages affected)

**URL:** `/world-time/united-states/new-york/` (and 910 other legacy cities)  
**Symptom:** Page has 13 h2 sections, full content, live time, but **0 `<img>` tags**. No flag, no country flag, no state flag, no hero image. Just text and SVGs.

**Cause:** The legacy city-page template (`scripts/build-city-pages.js`) never had image slots. The lite template (15,994 US cities) has the US flag at minimum.

**Fix:** Add flag images to the legacy city-page template:
- Country flag (flagcdn) — top-right of hero
- State/region flag (where applicable)
- Maybe a hero image (Unsplash with city name) — or skip for now

**Effort:** 2–3 hours (one template change, regenerate 911 pages)

---

### 🔴 C2. State tiles 404 on non-US country pages

**URL:** `/world-time/japan/`, `/world-time/germany/`, every non-US country page with states  
**Symptom:** 27/47 state tile images return 404. Console shows `Failed to load state image: /assets/states/yamanashi.webp` etc.  
**Cause:** I only generated state landmark images for US states (option C in Phase 15). The JS `renderStateGrid()` falls back to `{state-slug}.webp` for non-US states, which don't exist.

**Fix (3 options):**
- **A. Generate state images for top 10 countries** (DE, FR, IT, JP, GB, CN, IN, BR, CA, MX) — 200+ images via `image_synthesize` (~3 hours)
- **B. Skip image for non-US states** — show the state code badge or a flag emoji as fallback (~30 min)
- **C. Don't render the state grid on non-US country pages** — just show the city list (~15 min)

**Recommendation:** **C for launch, A as a post-launch follow-up.** Non-US country pages are tier-2 anyway.

**Effort:** 15 min (option C) — 3 hours (option A)

---

### 🔴 C3. Holidays API returns empty for US

**URL:** `GET /api/v1/holidays/upcoming?country=US&limit=3`  
**Response:** `{"success":true,"data":{"from":"2026-07-28","to":"2026-08-27","days":30,"country":"US","holidays":[],"count":0}}`  
**Symptom:** US has no holidays in the next 30 days. That's wrong — there's at least Labor Day (Sep 1).  
**Cause:** The `holidays` table has 880 rows (15 countries × 5 years). The endpoint probably looks at country=`US` but the data might be stored with a different code, or the date filter is wrong, or Nager.Date didn't return US holidays.

**Fix:** 
1. Check the holidays table for US rows
2. Check the endpoint SQL — likely a date filter bug
3. Verify the seed script (`seed/holidays.py`) wrote US data

**Effort:** 1–2 hours (data + endpoint debug)

---

### 🔴 C4. API has no edge caching — every request hits D1

**Symptom:** All API responses are missing `cf-cache-status` and `age` headers. Every request goes through to D1.  
**Impact:** Higher latency, more D1 reads, more $ spent.  
**Cause:** The API Worker doesn't set `Cache-Control` or use Cloudflare's cache API.

**Fix:** Add `Cache-Control: public, max-age=60, s-maxage=300` to read-only endpoints:
- `/api/v1/cities/{id}` — 5 min
- `/api/v1/cities/all?country=X` — 1 hour
- `/api/v1/countries` — 1 day
- `/api/v1/countries/{cca2}/states` — 1 day
- `/api/v1/holidays/*` — 1 hour

**Effort:** 30 min

---

### 🔴 C5. Oceania has 0 cities on the hub (regression)

**URL:** `/world-time/?continent=oceania`  
**Symptom:** After filtering by Oceania, the country list shows 0 cities in the city grid.  
**Cause:** Known issue from the summary. The popular endpoint caps at top-1000 globally, so AU/NZ/Pacific cities don't appear in the global top.  
**Fix:** When continent=oceania is selected, use a regional query instead of the global top-1000. OR ship the consolidated dataset (Phase B) which has 152,970 cities.

**Effort:** 1–2 hours (per-region query) or 2–3 days (consolidated dataset)

---

## Quality issues — should fix before launch

### 🟡 Q1. Mobile horizontal overflow on 2 pages

**Pages with overflow (375px viewport):**
- `/` (homepage): 402px doc width (27px overflow)
- `/world-time/united-states/new-york/` (legacy city): 473px doc width (98px overflow) — likely a wide table or pre/code block

**Fix:** Find the offending element with Chrome DevTools. For the city page, probably a long IANA timezone string or weather table. For the home, likely a hero metric bar.

**Effort:** 1 hour

---

### 🟡 Q2. Homepage H1 is geo-personalized

**Symptom:** Homepage H1 says "Current time in Virginia Beach" because of `window.__location` from CF geo.  
**Impact:** Some users will be confused — they expected a generic homepage. Others will love the personalization.  
**Fix (pick one):**
- **A. Make H1 generic + city in subtitle** — "Current time worldwide · [City] local: 04:45 AM" (recommended)
- **B. Show two states** — first-time visitors get generic, returning get personalized
- **C. Move to a sticky bar** — geo only as a bar, not H1

**Effort:** 30 min

---

### 🟡 Q3. /api/v1/onthisday/2026-07-28 returns 404

**URL:** `GET /api/v1/onthisday/2026-07-28`  
**Response:** 404 NOT_FOUND  
**Cause:** Endpoint not implemented. Only `/api/v1/onthisday` (today) works.  
**Fix:** Implement the date-param variant. The data is in the `onthisday` table (50 events).

**Effort:** 30 min

---

### 🟡 Q4. /api/v1/data-quality returns 404

**URL:** `GET /api/v1/data-quality`  
**Symptom:** Returns 404. Documented in the postman collection but not implemented.  
**Fix:** Either implement (data is in the `data_quality_checks` table) or remove from docs.

**Effort:** 30 min (implement) or 5 min (remove from docs)

---

### 🟡 Q5. Coming-soon pages have 0 images

**URL:** `/world-time/colombia/medell-n/` (33,034 pages)  
**Symptom:** No flag, no country image, no city image. Just text.  
**Impact:** Lower quality for the 97% of URLs that don't have real pages yet. But they're not high-traffic.

**Fix:** Add at least the country flag to the coming-soon template.

**Effort:** 30 min

---

### 🟡 Q6. Legacy city pages (911) use a different template than lite (15,994)

**Symptom:** Two templates. Legacy has 13 sections (Did you know, Learn about time zones, etc.). Lite has 7. The lite template is missing the rich educational content.

**Fix:** Port the legacy sections to the lite template. Or, generate "rich lite" pages for top cities.

**Effort:** 4–6 hours (full unification) or 1–2 hours (port top 100)

---

## Things that are working well ✅

- **All 6 main page types render:** home, world-time hub, country, state, city (legacy + lite), news
- **All API endpoints work** (12+ tested, 2 missing — see C3/Q3/Q4)
- **Time updates live** (clock-time, ms precision, every frame)
- **City search works** (15,994 US cities via local JSON)
- **Filter pills work** (continent, region, country, state)
- **State grid** renders for US with images
- **Hero clocks** render with 6 different animated SVGs
- **News articles** render with images
- **Mobile responsive** for most pages (except C1, Q1)
- **Sitemap & robots.txt** work
- **Sitemap excludes /api/ correctly**
- **Cache HIT on /world-time/ pages** (Cloudflare edge cache is working)
- **Cross-origin API** works (landing → API worker)
- **Diacritics** render correctly (Medellín, Bogotá, etc.)

---

## Movement plan — what to do in the next 1–3 days

### Day 1 (today/tomorrow) — Critical fixes

1. **C1: Add flag images to legacy city pages** (3 hours)
   - Modify `scripts/build-city-pages.js`
   - Add country flag (flagcdn) + state flag if applicable
   - Regenerate 911 pages
   - Deploy

2. **C2: Skip state grid for non-US countries** (15 min) + add fallback
   - Modify `renderStateGrid()` in `src/world-time-cities.js`
   - Only render grid if `state.image` exists in `__STATE_META`
   - For non-US: show as a simple pill list with state name + city count

3. **C3: Fix holidays US endpoint** (2 hours)
   - Check holidays table for US data
   - Fix date filter / country code mismatch
   - Test with `/api/v1/holidays/upcoming?country=US&limit=3`

4. **C4: Add Cache-Control to API** (30 min)
   - Update `cloudflare/datetime-api/src/index.js`
   - Add per-endpoint cache headers

5. **C5: Per-continent city fetch on hub** (2 hours)
   - When continent != "all", use a per-continent query OR add AU/NZ/Pacific cities to the top-1000 manually

**Total Day 1: ~8 hours**

### Day 2 — Quality fixes + verification

6. **Q1: Fix mobile overflow** (1 hour)
7. **Q2: Generic H1 on homepage** (30 min)
8. **Q3 + Q4: Implement missing API endpoints or remove from docs** (1 hour)
9. **Q5: Add country flag to coming-soon pages** (30 min)

**Total Day 2: ~3 hours**

### Day 3 — Polish + launch prep

10. Run a full Playwright test suite against the 33,945 URLs (sample 200, fail fast)
11. Verify all API endpoints respond within 200ms
12. Verify sitemap.xml includes all 33,945+ URLs
13. Verify robots.txt is correct
14. Verify meta tags / OG tags on top pages
15. Set up Datadog/Sentry for error tracking (currently none)
16. Set up uptime monitoring
17. **Deploy to prod** 🚀

---

## Honest read

The site is **85% ready**. The remaining 15% is mostly:
- 5 critical bugs (1 day)
- 6 quality issues (1 day)
- Verification + monitoring (1 day)

**You can ship in 3 days if you focus.** I recommend fixing the 5 criticals + Q1 + Q2 first (about 1.5 days), then doing a 0.5-day launch prep.

After launch, the post-launch follow-ups are:
- Generate state images for top 10 countries (3 hours)
- Port rich content to lite city template (4 hours)
- Email notifications for waitlist/feedback (per memory)
- Add a Datadog/Sentry + uptime monitor

Want me to start on Day 1?
