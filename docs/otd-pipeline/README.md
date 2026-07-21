# On This Day — Data Pipeline

A comprehensive data pipeline for the onthisday feature that builds a
365-day database of historical events, births, deaths, weddings, and
divorces from multiple free data sources.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     SOURCE CONNECTORS                        │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐     │
│  │  Wikidata   │  │  Wikipedia   │  │ Wikimedia      │     │
│  │  (SPARQL)   │  │  (REST API)  │  │ Commons        │     │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────┘     │
│         │                │                   │              │
│         │     ┌──────────┴────────┐ ┌─────────┴────────┐    │
│         │     │  Nager.Date       │ │ NASA Images     │    │
│         │     │  (holidays)       │ │ Smithsonian     │    │
│         │     └──────────┬────────┘ └─────────┬────────┘    │
└─────────┼────────────────┼────────────────────┼──────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│                  FETCH + DEDUPLICATE                         │
│                                                              │
│  • Parse SPARQL/JSON responses                               │
│  • Normalize to our schema                                   │
│  • Dedupe by date+year+title                                 │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                      VALIDATION                              │
│                                                              │
│  • Schema rules (required fields, lengths, patterns)         │
│  • Date validity (Feb 29, etc.)                              │
│  • URL validity (Wikipedia, image URLs)                      │
│  • Profanity check                                           │
│  • Severity: error (block) vs warning (fix)                  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  AUTO-IMPROVEMENT                            │
│                                                              │
│  Tier 1: 5-tier image fallback                               │
│    1. Wikidata P18/P109                                      │
│    2. Wikipedia article thumbnail                            │
│    3. Wikimedia Commons search                               │
│    4. NASA / Smithsonian                                     │
│    5. Generated SVG placeholder                              │
│                                                              │
│  Tier 2: Description enrichment                              │
│    • Fetch from Wikipedia REST API                           │
│    • Expand short descriptions                               │
│                                                              │
│  Tier 3: Metadata filling                                    │
│    • Country code (regex extract)                            │
│    • Key people (NER-style extraction)                       │
│    • Importance (calculated from sitelinks)                  │
│    • Search keywords (generated)                             │
│    • FAQ Q&A pairs (generated)                               │
│    • Key facts (extracted)                                   │
│    • Image alt text (generated)                              │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   QUALITY SCORING                            │
│                                                              │
│  Score = sum of:                                             │
│    15 - has main image                                       │
│    15 - has long description (200+ chars)                    │
│    10 - has short description (50+ chars)                    │
│    10 - has Wikipedia URL                                    │
│     5 - has 2+ data sources                                  │
│    10 - has country code                                     │
│     5 - has category                                         │
│    10 - has 3+ key people                                    │
│     5 - has 5+ search keywords                               │
│     5 - has 3+ tags                                          │
│     5 - updated within 30 days                               │
│  ────                                                        │
│  100 max                                                     │
│                                                              │
│  Tiers:                                                      │
│    90-100: gold  (publish as-is)                             │
│    70-89:  silver (publish, auto-improve)                    │
│    50-69:  bronze (publish, flag for review)                 │
│    <50:    blocked (auto-improve, then re-score)             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                  PERSIST TO D1                               │
│                                                              │
│  • POST to /api/v1/onthisday                                 │
│  • All 22 fields stored                                      │
│  • Image URLs cached to R2 (when mirrored)                   │
└──────────────────────────────────────────────────────────────┘
```

## File Structure

```
scripts/
├── lib/
│   ├── image-fallback.js     # 5-tier image fallback
│   ├── quality-scorer.js     # 0-100 quality scoring
│   ├── validation.js         # Schema + dedup
│   └── auto-improve.js       # Field enrichment
├── sources/
│   ├── wikidata.js           # SPARQL connector
│   └── wikipedia.js          # REST API connector
├── fetch-otd-batch.js        # Main orchestrator
└── seed-onthisday.js         # Curated July 20 seed (existing)

cloudflare/datetime-api/
├── migrations/
│   ├── 009_enhanced_onthisday.sql  # Initial enhanced schema
│   └── 010_otd_quality.sql         # Quality + image fields
└── cron-worker.js                  # Cloudflare Cron Worker
```

## Usage

### Fetch a single date

```bash
node scripts/fetch-otd-batch.js --month 7 --day 20
```

### Fetch the top 50 high-search dates

```bash
node scripts/fetch-otd-batch.js --top-dates
```

### Fetch a date range

```bash
node scripts/fetch-otd-batch.js --range 2026-07-20 2026-07-27
```

### Fetch all 365 days (slow, ~30min)

```bash
node scripts/fetch-otd-batch.js --all-365
```

### Options

```
--api-base <url>     API base URL (default: https://dev.api.dateandtime.live)
--no-images          Skip image fetching (faster)
--no-improve         Skip auto-improvement
--dry-run            Don't push to API
--verbose            Show detailed output
--max-per-day <n>    Max entries per day per type (default: 20)
```

## Quality Rules

### Field Population

| Field | Type | Required | Min | Max | Notes |
|---|---|---|---|---|---|
| `title` | string | ✓ | 5 | 200 | No profanity |
| `description` | string | ✓ | 50 | 1500 | 2-3 sentences |
| `long_description` | string | | 200 | 3000 | 1-2 paragraphs |
| `wikipedia_url` | URL | | | | Valid URL |
| `image_url` | URL | | | | Valid image |
| `image_alt` | string | when image | 10 | 200 | Accessibility |
| `year` | number | ✓ | -3000 | current+1 | |
| `month` | number | ✓ | 1 | 12 | |
| `day` | number | ✓ | 1 | 31 | |
| `country_code` | string | | | | ISO 3166-1 alpha-2 |
| `category` | string | ✓ | | | One of 12 |
| `type` | string | ✓ | | | One of 6 |
| `importance` | number | ✓ | 1 | 5 | |

### Auto-Improvement Triggers

A field is auto-improved when:
- Quality score < 70
- Field is in the suggestions list
- max 5 attempts per field
- Rate limit: 3 concurrent improvements

### Dedup Rules

- **Strict match**: same date + year + title (case-insensitive) → merge
- **Fuzzy match**: same date + year + similar title (Jaccard > 0.7) → review
- **By Wikipedia URL**: same URL → merge

## Cron Schedules

| Schedule | Action | Duration |
|---|---|---|
| Daily 03:00 UTC | Re-validate today's images | ~30s |
| Weekly Sun 04:00 UTC | Refresh upcoming 7 days, improve low-score entries | ~3min |
| Monthly 1st 05:00 UTC | Re-validate all images, generate quality report | ~5min |

## Data Sources

### Free APIs (no key required)

| Source | URL | Use |
|---|---|---|
| Wikidata SPARQL | query.wikidata.org/sparql | Events, births, deaths with metadata |
| Wikipedia REST | en.wikipedia.org/api/rest_v1 | Article summaries, thumbnails, "On this day" |
| Wikimedia Commons | commons.wikimedia.org/w/api.php | Image search by title |
| NASA Images | images-api.nasa.gov | Space/science events |
| Smithsonian Open Access | api.si.edu/openaccess/v1.0 | Historical images |

### With API key (free tier)

| Source | URL | Use |
|---|---|---|
| Nager.Date | date.nager.at/api/v3 | Public holidays by country |
| TMDB | api.themoviedb.org/3 | Movie/TV metadata |
| MusicBrainz | musicbrainz.org/ws/2 | Music metadata |
| FRED | api.stlouisfed.org/fred | Economic indicators |
| Open Library | openlibrary.org/developers/api | Books/authors |

## Schema (Migration 010)

### New columns

```sql
-- Image-related
image_status TEXT             -- 'wikidata' | 'wikipedia' | 'commons' | 'external' | 'generated' | 'missing' | 'failed'
image_attempts INTEGER        -- How many times we've tried to fetch
image_last_checked TIMESTAMP  -- Last URL validation
image_license TEXT            -- CC-BY-SA, CC0, etc.
image_credit TEXT             -- Photographer/source attribution
image_source_url TEXT         -- Original page URL
image_width INTEGER           -- Original dimensions
image_height INTEGER
image_r2_key TEXT             -- Where cached in R2
image_r2_cached_at TIMESTAMP
image_variants TEXT           -- JSON: {thumb, medium, large, hero}

-- Quality scoring
quality_breakdown TEXT        -- JSON: {has_image: 15, has_long_desc: 15, ...}
quality_tier TEXT             -- 'gold' | 'silver' | 'bronze' | 'blocked'
quality_history TEXT          -- JSON: [{date, score}]

-- Auto-improvement tracking
improvement_attempts INTEGER
improvement_log TEXT          -- JSON: [{date, field, from, to}]
blocked_reason TEXT

-- Enrichment
faq_questions TEXT            -- JSON: [{q, a}]
key_facts TEXT                -- JSON: ["fact 1", "fact 2"]
people_mentioned TEXT         -- JSON: [{name, role, wiki_url}]
```

## Testing

```bash
# Unit test image-fallback
node -e "
const { getGeneratedPlaceholder } = require('./scripts/lib/image-fallback');
const p = getGeneratedPlaceholder({title: 'Test', year: 1969, type: 'event'});
console.log('Generated:', p.url.length, 'bytes');
"

# Unit test quality-scorer
node -e "
const { scoreEntry } = require('./scripts/lib/quality-scorer');
const r = scoreEntry({title: 'Test', description: 'A test entry with 50+ chars of description text', wikipedia_url: 'https://en.wikipedia.org/wiki/Test'});
console.log('Score:', r.score, 'Tier:', r.tier);
"

# Unit test auto-improve
node -e "
const { improveEntry } = require('./scripts/lib/auto-improve');
improveEntry({title: 'Test', year: 1969, month: 7, day: 20, type: 'event', category: 'events', description: 'Test'}, {skipImageFetch: true}).then(r => console.log('Improved from', r.scoreBefore, 'to', r.scoreAfter));
"
```

## Release Schedule

### Week 1 (current)
- Schema migration 010
- 5-tier image fallback
- Quality scoring
- Auto-improvement
- First batch: 50 high-search dates

### Week 2
- Top 50 dates fully populated
- Image proxy Worker deployed
- Quality dashboard live

### Week 3-4
- Expand to 100 dates
- Per-date pages `/onthisday/july-20/`
- Per-category pages `/onthisday/science/`

### Week 5-12
- All 365 days
- Per-country pages
- Per-decade/century pages
- Continuous cron running

### Week 13+
- Auto-expansion based on search trends
- AI-generated descriptions for low-quality entries
- User feedback integration
