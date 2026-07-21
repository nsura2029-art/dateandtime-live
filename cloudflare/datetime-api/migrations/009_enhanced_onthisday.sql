-- Migration 009: Enhanced onthisday schema
-- Adds SEO, user intent, media, and discovery fields.
-- All new columns have sensible defaults so existing rows work without backfill.

-- ============================================================================
-- 1. Add new columns to onthisday
-- ============================================================================

-- user_intents: array of user search intents this entry answers
--   e.g. ["what happened on July 20", "Apollo 11 history", "moon landing facts"]
ALTER TABLE onthisday ADD COLUMN user_intents TEXT NOT NULL DEFAULT '[]';

-- search_keywords: SEO keywords this entry ranks for
--   e.g. ["Apollo 11", "Moon landing 1969", "Neil Armstrong", "Buzz Aldrin", "space race"]
ALTER TABLE onthisday ADD COLUMN search_keywords TEXT NOT NULL DEFAULT '[]';

-- entity_type: typed classification
--   values: event, person_birth, person_death, discovery, launch, treaty, election, accident, award, anniversary
ALTER TABLE onthisday ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'event';

-- media: JSON object with image, thumbnail, video URLs
--   e.g. {"image_url": "https://upload.wikimedia.org/.../Apollo_11.jpg", "thumbnail_url": "https://...", "video_url": null, "source": "wikipedia_commons"}
ALTER TABLE onthisday ADD COLUMN media TEXT NOT NULL DEFAULT '{}';

-- tags: flexible array of tags for filtering
--   e.g. ["apollo", "nasa", "moon", "space-race", "cold-war"]
ALTER TABLE onthisday ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

-- region: geographic region for filtering
--   values: global, north_america, south_america, europe, asia, africa, oceania, middle_east, caribbean
ALTER TABLE onthisday ADD COLUMN region TEXT NOT NULL DEFAULT 'global';

-- sentiment: editorial tone
--   values: positive, negative, neutral, mixed, tragic, celebratory
ALTER TABLE onthisday ADD COLUMN sentiment TEXT NOT NULL DEFAULT 'neutral';

-- related_event_ids: array of related onthisday.id values
ALTER TABLE onthisday ADD COLUMN related_event_ids TEXT NOT NULL DEFAULT '[]';

-- country_code: most relevant ISO 3166-1 alpha-2 country code
ALTER TABLE onthisday ADD COLUMN country_code TEXT;

-- quality_score: 0-100 editorial quality (helps ranking)
ALTER TABLE onthisday ADD COLUMN quality_score INTEGER NOT NULL DEFAULT 50;

-- source_url: additional source URL (e.g. Nobel Prize, WHO, etc.)
ALTER TABLE onthisday ADD COLUMN source_url TEXT;

-- external_id: stable ID from source system (e.g. Wikidata Q-ID)
ALTER TABLE onthisday ADD COLUMN external_id TEXT;

-- created_at and updated_at
ALTER TABLE onthisday ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE onthisday ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 2. Indexes for fast queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_onthisday_entity_type ON onthisday(entity_type);
CREATE INDEX IF NOT EXISTS idx_onthisday_region ON onthisday(region);
CREATE INDEX IF NOT EXISTS idx_onthisday_country_code ON onthisday(country_code);
CREATE INDEX IF NOT EXISTS idx_onthisday_quality ON onthisday(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_onthisday_year ON onthisday(year);

-- ============================================================================
-- 3. FTS5 full-text search on title, description, keywords
-- ============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS onthisday_fts USING fts5(
  title,
  description,
  search_keywords,
  user_intents,
  content='onthisday',
  content_rowid='id',
  tokenize='porter unicode61 remove_diacritics 2'
);

-- Populate FTS from existing rows
INSERT INTO onthisday_fts(rowid, title, description, search_keywords, user_intents)
SELECT id, title, description, search_keywords, user_intents FROM onthisday;

-- Trigger to keep FTS in sync on insert
CREATE TRIGGER IF NOT EXISTS onthisday_ai AFTER INSERT ON onthisday BEGIN
  INSERT INTO onthisday_fts(rowid, title, description, search_keywords, user_intents)
  VALUES (new.id, new.title, new.description, new.search_keywords, new.user_intents);
END;

-- Trigger to keep FTS in sync on update
CREATE TRIGGER IF NOT EXISTS onthisday_au AFTER UPDATE ON onthisday BEGIN
  UPDATE onthisday_fts SET
    title = new.title,
    description = new.description,
    search_keywords = new.search_keywords,
    user_intents = new.user_intents
  WHERE rowid = new.id;
END;

-- Trigger to keep FTS in sync on delete
CREATE TRIGGER IF NOT EXISTS onthisday_ad AFTER DELETE ON onthisday BEGIN
  DELETE FROM onthisday_fts WHERE rowid = old.id;
END;

-- ============================================================================
-- 4. View: events joined with parsed JSON fields
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_onthisday_rich AS
SELECT
  o.*,
  json_each.value AS user_intent_item
FROM onthisday o, json_each(o.user_intents)
;

-- ============================================================================
-- 5. Sample queries enabled by the new schema
-- ============================================================================

-- Examples (NOT executed — for reference only):

-- Find events in a specific region + year range:
-- SELECT * FROM onthisday WHERE region = 'europe' AND year BETWEEN 1900 AND 1999 ORDER BY importance DESC LIMIT 10;

-- Find related events for a specific country:
-- SELECT * FROM onthisday WHERE country_code = 'US' ORDER BY importance DESC, year DESC LIMIT 20;

-- Full-text search across title + description + keywords:
-- SELECT * FROM onthisday WHERE id IN (SELECT rowid FROM onthisday_fts WHERE onthisday_fts MATCH 'Apollo moon') ORDER BY importance DESC;

-- Get events by user intent:
-- SELECT * FROM onthisday WHERE user_intents LIKE '%moon landing%' ORDER BY year DESC LIMIT 5;

-- ============================================================================
-- 6. Backfill the existing 591 rows with sensible defaults
-- ============================================================================

-- Existing rows get a quality_score based on importance
UPDATE onthisday SET quality_score = importance * 20 WHERE quality_score = 50 AND importance IS NOT NULL;

-- Existing rows get a "general" entity_type based on category
UPDATE onthisday SET entity_type = CASE
  WHEN category = 'birth' THEN 'person_birth'
  WHEN category = 'death' THEN 'person_death'
  WHEN category = 'discovery' THEN 'discovery'
  ELSE 'event'
END WHERE entity_type = 'event' AND category IN ('birth', 'death', 'discovery');

-- Index user_intents for LIKE queries (SQLite FTS5 already covers MATCH)
CREATE INDEX IF NOT EXISTS idx_onthisday_user_intents ON onthisday(user_intents);

-- End of migration 009
