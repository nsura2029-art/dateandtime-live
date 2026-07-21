-- Migration 010: On-this-day data quality + image fallback
-- Adds the fields needed for the 5-tier image pipeline + quality scoring.
-- All columns have defaults so existing rows continue to work.

-- ============================================================================
-- 1. Image-related fields (for 5-tier fallback)
-- ============================================================================

-- image_status: tracks where the image came from and its state
--   values:
--     'wikidata'         -- Tier 1: from Wikidata P18/P109
--     'wikipedia'        -- Tier 2: from Wikipedia article thumbnail
--     'commons'          -- Tier 3: from Wikimedia Commons search
--     'external'         -- Tier 4: from Smithsonian/NASA/LoC
--     'generated'        -- Tier 5: SVG gradient + emoji placeholder
--     'missing'          -- no image available anywhere
--     'failed'           -- last attempt failed, needs retry
ALTER TABLE onthisday ADD COLUMN image_status TEXT NOT NULL DEFAULT 'missing';

-- image_attempts: number of times we've tried to fetch a real image
ALTER TABLE onthisday ADD COLUMN image_attempts INTEGER NOT NULL DEFAULT 0;

-- image_last_checked: when we last verified the image URL still works
ALTER TABLE onthisday ADD COLUMN image_last_checked TIMESTAMP;

-- image_license: CC-BY-SA, CC0, public-domain, etc.
ALTER TABLE onthisday ADD COLUMN image_license TEXT;

-- image_credit: photographer or source attribution
ALTER TABLE onthisday ADD COLUMN image_credit TEXT;

-- image_source_url: original page where image was found
ALTER TABLE onthisday ADD COLUMN image_source_url TEXT;

-- image_width / image_height: original dimensions
ALTER TABLE onthisday ADD COLUMN image_width INTEGER;
ALTER TABLE onthisday ADD COLUMN image_height INTEGER;

-- ============================================================================
-- 2. Quality scoring fields
-- ============================================================================

-- quality_breakdown: JSON object showing the per-criterion score
--   e.g. {"has_image":15,"has_long_desc":15,"has_wiki":10,...}
ALTER TABLE onthisday ADD COLUMN quality_breakdown TEXT NOT NULL DEFAULT '{}';

-- quality_tier: derived from quality_score
--   values: 'gold' (90+), 'silver' (70-89), 'bronze' (50-69), 'blocked' (<50)
ALTER TABLE onthisday ADD COLUMN quality_tier TEXT NOT NULL DEFAULT 'bronze';

-- quality_history: JSON array of past scores (for trend analysis)
--   e.g. [{"date":"2026-07-20","score":85},...]
ALTER TABLE onthisday ADD COLUMN quality_history TEXT NOT NULL DEFAULT '[]';

-- ============================================================================
-- 3. Auto-improvement tracking
-- ============================================================================

-- improvement_attempts: how many times auto-improve has been run
ALTER TABLE onthisday ADD COLUMN improvement_attempts INTEGER NOT NULL DEFAULT 0;

-- improvement_log: JSON array of what was auto-fixed
--   e.g. [{"date":"...","field":"image_url","from":"missing","to":"wikidata:..."}]
ALTER TABLE onthisday ADD COLUMN improvement_log TEXT NOT NULL DEFAULT '[]';

-- blocked_reason: why the entry is blocked (if quality_tier = 'blocked')
--   e.g. 'no_description', 'invalid_year', 'no_sources'
ALTER TABLE onthisday ADD COLUMN blocked_reason TEXT;

-- ============================================================================
-- 4. Enrichment fields
-- ============================================================================

-- faq_questions: JSON array of FAQ Q&A pairs for this entry
--   e.g. [{"q":"When did Apollo 11 land on the Moon?","a":"July 20, 1969"}]
ALTER TABLE onthisday ADD COLUMN faq_questions TEXT NOT NULL DEFAULT '[]';

-- key_facts: JSON array of bullet-point facts (for rich snippets)
--   e.g. ["First Moon landing in human history","Neil Armstrong was first to step on Moon","Mission duration: 8 days 3 hours 18 minutes"]
ALTER TABLE onthisday ADD COLUMN key_facts TEXT NOT NULL DEFAULT '[]';

-- people_mentioned: JSON array of key people with metadata
--   e.g. [{"name":"Neil Armstrong","role":"Commander","wiki_url":"...","image":"..."}]
ALTER TABLE onthisday ADD COLUMN people_mentioned TEXT NOT NULL DEFAULT '[]';

-- ============================================================================
-- 5. Image processing metadata
-- ============================================================================

-- image_r2_key: where the image is stored in Cloudflare R2 (if mirrored)
--   e.g. "otd/1969/07/apollo-11-1969.webp"
ALTER TABLE onthisday ADD COLUMN image_r2_key TEXT;

-- image_r2_cached_at: when we cached the image to R2
ALTER TABLE onthisday ADD COLUMN image_r2_cached_at TIMESTAMP;

-- image_variants: JSON object with multiple sizes
--   e.g. {"thumb":"...","medium":"...","large":"...","hero":"..."}
ALTER TABLE onthisday ADD COLUMN image_variants TEXT NOT NULL DEFAULT '{}';

-- ============================================================================
-- 6. Indexes for quality + image queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_onthisday_image_status ON onthisday(image_status);
CREATE INDEX IF NOT EXISTS idx_onthisday_quality_tier ON onthisday(quality_tier);
CREATE INDEX IF NOT EXISTS idx_onthisday_image_last_checked ON onthisday(image_last_checked);

-- ============================================================================
-- 7. Data quality report table
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_quality_reports (
  id INTEGER PRIMARY KEY,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_entries INTEGER,
  gold_count INTEGER,
  silver_count INTEGER,
  bronze_count INTEGER,
  blocked_count INTEGER,
  missing_images INTEGER,
  missing_descriptions INTEGER,
  missing_wiki INTEGER,
  duplicate_count INTEGER,
  avg_score REAL,
  report_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_otd_quality_reports_date ON otd_quality_reports(generated_at DESC);

-- ============================================================================
-- 8. Image cache table (for R2 + URL tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_image_cache (
  id INTEGER PRIMARY KEY,
  source_url TEXT NOT NULL,
  r2_key TEXT,
  cached_at TIMESTAMP,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type TEXT,
  license TEXT,
  source_type TEXT,
  last_validated TIMESTAMP,
  validation_count INTEGER DEFAULT 0,
  UNIQUE(source_url)
);

CREATE INDEX IF NOT EXISTS idx_otd_image_cache_validated ON otd_image_cache(last_validated);
CREATE INDEX IF NOT EXISTS idx_otd_image_cache_source_type ON otd_image_cache(source_type);

-- ============================================================================
-- 9. Backfill existing rows
-- ============================================================================

-- Calculate quality_score for existing rows based on field population
UPDATE onthisday SET
  quality_breakdown = json_object(
    'has_image', CASE WHEN media LIKE '%image_url%' THEN 15 ELSE 0 END,
    'has_long_desc', CASE WHEN description IS NOT NULL AND length(description) > 200 THEN 15 ELSE 0 END,
    'has_wiki', CASE WHEN wikipedia_url IS NOT NULL THEN 10 ELSE 0 END,
    'has_country', CASE WHEN country_code IS NOT NULL THEN 10 ELSE 0 END,
    'has_importance', CASE WHEN importance >= 4 THEN 5 ELSE 0 END,
    'has_search_keywords', CASE WHEN length(search_keywords) > 10 THEN 5 ELSE 0 END,
    'has_tags', CASE WHEN length(tags) > 5 THEN 5 ELSE 0 END
  )
WHERE quality_breakdown = '{}';

-- Recalculate quality_score from breakdown
UPDATE onthisday SET
  quality_score = (
    CASE WHEN media LIKE '%image_url%' THEN 15 ELSE 0 END +
    CASE WHEN description IS NOT NULL AND length(description) > 200 THEN 15 ELSE 0 END +
    CASE WHEN wikipedia_url IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN country_code IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN importance >= 4 THEN 5 ELSE 0 END +
    CASE WHEN length(search_keywords) > 10 THEN 5 ELSE 0 END +
    CASE WHEN length(tags) > 5 THEN 5 ELSE 0 END
  );

-- Set quality_tier based on score
UPDATE onthisday SET
  quality_tier = CASE
    WHEN quality_score >= 90 THEN 'gold'
    WHEN quality_score >= 70 THEN 'silver'
    WHEN quality_score >= 50 THEN 'bronze'
    ELSE 'blocked'
  END
WHERE quality_tier = 'bronze';

-- Backfill image_status from existing media field
UPDATE onthisday SET
  image_status = CASE
    WHEN media LIKE '%wikimedia%' OR media LIKE '%wikipedia%' THEN 'wikipedia'
    WHEN media LIKE '%image_url%' THEN 'wikipedia'
    ELSE 'missing'
  END
WHERE image_status = 'missing' AND media != '{}';

-- Set image_last_checked for entries with images
UPDATE onthisday SET image_last_checked = CURRENT_TIMESTAMP
WHERE image_status != 'missing' AND image_last_checked IS NULL;

-- End of migration 010
