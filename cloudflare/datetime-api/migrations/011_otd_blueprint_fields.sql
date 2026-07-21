-- Migration 011: On-this-day blueprint fields (per Ch 6 of teardown-blueprint)
-- Adds the schema fields needed for:
--   - Notability scoring (sitelinks, pageviews, inbound_links, rank_score)
--   - Person enrichment (star_sign, chinese_zodiac, generation, cause_of_death, age_at_death, current_age, profession)
--   - Weddings/divorces/bizarre/anniversary type expansion
--   - Per-row source provenance (data_sources JSON)
--   - Multi-language support
--   - Schema upgrade to Drizzle's `onthisday` table shape
-- All columns have defaults so existing rows continue to work.

-- ============================================================================
-- 1. Person enrichment fields (for star_sign, zodiac, generation, etc.)
-- ============================================================================

-- wikidata_id: stable Q-ID (e.g. "Q15873" for Brian May)
-- Distinct from existing external_id which can hold non-Wikidata IDs
ALTER TABLE onthisday ADD COLUMN wikidata_id TEXT;

-- wikipedia_title: canonical English Wikipedia article slug (e.g. "Brian_May")
-- Used for pageviews API lookups (per Blueprint Ch 5)
ALTER TABLE onthisday ADD COLUMN wikipedia_title TEXT;

-- star_sign: computed from birthday (Aries/Taurus/.../Pisces)
-- Examples: 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
--           'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
ALTER TABLE onthisday ADD COLUMN star_sign TEXT;

-- chinese_zodiac: computed from birth year (Rat/Ox/.../Pig)
-- Examples: 'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake',
--           'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'
ALTER TABLE onthisday ADD COLUMN chinese_zodiac TEXT;

-- generation: computed from birth year
-- Examples: 'Greatest' (1901-1927), 'Silent' (1928-1945), 'Boomer' (1946-1964),
--           'Gen X' (1965-1980), 'Millennial' (1981-1996), 'Gen Z' (1997-2012),
--           'Gen Alpha' (2013+)
ALTER TABLE onthisday ADD COLUMN generation TEXT;

-- cause_of_death: P509 from Wikidata (e.g. "lung cancer", "assassination")
ALTER TABLE onthisday ADD COLUMN cause_of_death TEXT;

-- age_at_death: P570 - P569 (number, for deceased persons only)
ALTER TABLE onthisday ADD COLUMN age_at_death INTEGER;

-- current_age: today - P569 (number, for living persons only)
ALTER TABLE onthisday ADD COLUMN current_age INTEGER;

-- profession: JSON array from P106 (e.g. ["guitarist", "astrophysicist", "songwriter"])
-- Stored as JSON string for SQLite
ALTER TABLE onthisday ADD COLUMN profession TEXT NOT NULL DEFAULT '[]';

-- language: IETF BCP 47 code (e.g. "en", "pt", "es")
-- Default 'en' for English-language entries
ALTER TABLE onthisday ADD COLUMN language TEXT NOT NULL DEFAULT 'en';

-- ============================================================================
-- 2. Notability scoring fields (per Blueprint Ch 6 formula)
-- ============================================================================

-- rank_score: composite notability score, 0-100
-- Formula: (0.5*log1p(sitelinks) + 0.3*log1p(pageviews_30d_avg) + 0.2*log1p(inbound_links)) * scale
-- Pre-computed at ingest time, never at read time
ALTER TABLE onthisday ADD COLUMN rank_score REAL NOT NULL DEFAULT 0;

-- sitelinks: number of Wikidata sitelinks (across all languages)
-- Used in notability formula
ALTER TABLE onthisday ADD COLUMN sitelinks INTEGER NOT NULL DEFAULT 0;

-- pageviews_30d_avg: trailing 30-day avg pageviews from Wikipedia
-- Refreshed weekly by cron worker
ALTER TABLE onthisday ADD COLUMN pageviews_30d_avg REAL NOT NULL DEFAULT 0;

-- inbound_links: number of Wikipedia articles linking to this entity
-- From DBpedia dbo:wikiPageWikiLink
ALTER TABLE onthisday ADD COLUMN inbound_links INTEGER NOT NULL DEFAULT 0;

-- notability_source: where the score was computed from
-- values: 'wikidata', 'dbpedia', 'pageviews', 'composite', 'pending'
ALTER TABLE onthisday ADD COLUMN notability_source TEXT NOT NULL DEFAULT 'pending';

-- ============================================================================
-- 3. Type enum expansion
-- ============================================================================

-- New types supported: 'wedding', 'divorce', 'anniversary', 'bizarre', 'holiday'
-- Existing types: 'event', 'birth', 'death'
-- Note: 'event' already exists; this is just documentation
-- (SQLite has no enum, so we use TEXT + CHECK constraint)
-- Note: existing entity_type column already exists with limited enum
-- This is a separate type column for the on_this_day concept

-- No schema change needed; just documentation of supported values
-- Supported values for `category` column going forward:
--   event, birth, death, wedding, divorce, anniversary, bizarre, holiday

-- ============================================================================
-- 4. Per-row source provenance (per Blueprint Ch 6 + Risk #1)
-- ============================================================================

-- data_sources: JSON array of provenance records per row
-- Format: [{"name":"wikipedia_rest","url":"...","retrieved_at":"2026-07-20",
--           "license":"CC BY-SA 4.0","license_url":"https://creativecommons.org/...",
--           "attribution_required":true}, ...]
-- Required for CC BY-SA compliance (Blueprint Risk #1)
ALTER TABLE onthisday ADD COLUMN data_sources TEXT NOT NULL DEFAULT '[]';

-- verified_in: which sources confirmed this entry (for multi-source dedup)
-- Format: ["wikipedia_rest", "byabbe", "muffinlabs"]
-- A row in 2+ sources = "verified"; 1 source = "review" (Blueprint Insight #7)
ALTER TABLE onthisday ADD COLUMN verified_in TEXT NOT NULL DEFAULT '[]';

-- ============================================================================
-- 5. Couple/relationship fields (for weddings/anniversaries)
-- ============================================================================

-- entity2_id: second spouse/couple member (for wedding/divorce entries)
-- FK to a future entities table (per Blueprint Ch 6)
-- For now, store the Wikidata Q-ID
ALTER TABLE onthisday ADD COLUMN entity2_id TEXT;

-- entity2_name: human-readable name of second spouse
ALTER TABLE onthisday ADD COLUMN entity2_name TEXT;

-- couple_id: stable identifier for the couple (e.g. "Q123-Q456" or hash)
ALTER TABLE onthisday ADD COLUMN couple_id TEXT;

-- ============================================================================
-- 6. Anniversary math fields (for "X years ago" pages)
-- ============================================================================

-- anniversary_date: pre-computed next occurrence (for upcoming events)
-- Format: ISO date string (e.g. "2027-07-20")
-- Computed from year + recurrence rule (none, yearly, every-N-years)
ALTER TABLE onthisday ADD COLUMN anniversary_date TEXT;

-- recurrence: pattern for recurring events
-- values: 'none', 'yearly', 'centennial', 'half_centennial', 'decade', 'quarter_century'
ALTER TABLE onthisday ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none';

-- is_anniversary_today: pre-computed for "X years ago today" (updated daily)
ALTER TABLE onthisday ADD COLUMN is_anniversary_today INTEGER NOT NULL DEFAULT 0;

-- is_today: pre-computed for "today in history" (updated daily)
ALTER TABLE onthisday ADD COLUMN is_today INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- 7. Verification + quality flags
-- ============================================================================

-- verified: 1 if cross-source-verified, 0 if single-source
-- (Computed from verified_in.length >= 2)
ALTER TABLE onthisday ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;

-- review_reason: why this row is in the editorial review queue
-- values: 'single_source', 'conflicting_dates', 'low_notability', 'incomplete'
-- null = no review needed
ALTER TABLE onthisday ADD COLUMN review_reason TEXT;

-- last_verified_at: when this row was last cross-source verified
ALTER TABLE onthisday ADD COLUMN last_verified_at TIMESTAMP;

-- ============================================================================
-- 8. Holiday/observance-specific fields (per Nager + Checkiday)
-- ============================================================================

-- holiday_type: Nager.Date type
-- values: 'Public', 'Bank', 'School', 'Authorities', 'Optional', 'Observance'
ALTER TABLE onthisday ADD COLUMN holiday_type TEXT;

-- holiday_global: 1 if observed nationwide, 0 if regional
ALTER TABLE onthisday ADD COLUMN holiday_global INTEGER NOT NULL DEFAULT 1;

-- observance_countries: JSON array of country codes (for international days)
-- e.g. ["US", "GB", "CA", "AU"] for "World Kindness Day"
ALTER TABLE onthisday ADD COLUMN observance_countries TEXT NOT NULL DEFAULT '[]';

-- observance_hashtags: JSON array of social hashtags
-- e.g. ["#WorldKindnessDay", "#KindnessMatters"]
ALTER TABLE onthisday ADD COLUMN observance_hashtags TEXT NOT NULL DEFAULT '[]';

-- ============================================================================
-- 9. Indexes for blueprint query patterns
-- ============================================================================

-- Person queries (T5/T6: person pages + birthday-twin)
CREATE INDEX IF NOT EXISTS idx_onthisday_wikidata_id ON onthisday(wikidata_id);
CREATE INDEX IF NOT EXISTS idx_onthisday_wikipedia_title ON onthisday(wikipedia_title);
CREATE INDEX IF NOT EXISTS idx_onthisday_star_sign ON onthisday(star_sign);
CREATE INDEX IF NOT EXISTS idx_onthisday_chinese_zodiac ON onthisday(chinese_zodiac);
CREATE INDEX IF NOT EXISTS idx_onthisday_generation ON onthisday(generation);

-- Notability ranking
CREATE INDEX IF NOT EXISTS idx_onthisday_rank_score ON onthisday(rank_score DESC);
CREATE INDEX IF NOT EXISTS idx_onthisday_sitelinks ON onthisday(sitelinks DESC);
CREATE INDEX IF NOT EXISTS idx_onthisday_pageviews ON onthisday(pageviews_30d_avg DESC);

-- Verification + provenance
CREATE INDEX IF NOT EXISTS idx_onthisday_verified ON onthisday(verified);
CREATE INDEX IF NOT EXISTS idx_onthisday_verified_in ON onthisday(verified_in);
CREATE INDEX IF NOT EXISTS idx_onthisday_review_reason ON onthisday(review_reason);

-- Anniversary + today
CREATE INDEX IF NOT EXISTS idx_onthisday_is_today ON onthisday(is_today);
CREATE INDEX IF NOT EXISTS idx_onthisday_is_anniversary_today ON onthisday(is_anniversary_today);
CREATE INDEX IF NOT EXISTS idx_onthisday_anniversary_date ON onthisday(anniversary_date);
CREATE INDEX IF NOT EXISTS idx_onthisday_recurrence ON onthisday(recurrence);

-- Weddings/divorces
CREATE INDEX IF NOT EXISTS idx_onthisday_entity2_id ON onthisday(entity2_id);
CREATE INDEX IF NOT EXISTS idx_onthisday_couple_id ON onthisday(couple_id);

-- Holidays/observances
CREATE INDEX IF NOT EXISTS idx_onthisday_holiday_type ON onthisday(holiday_type);
CREATE INDEX IF NOT EXISTS idx_onthisday_language ON onthisday(language);

-- ============================================================================
-- 10. Entities table (per Blueprint Ch 6 Prompt B)
-- ============================================================================

-- A normalized entity table for persons, places, events, works, organizations
-- This is the deduplication backbone for the entire system
CREATE TABLE IF NOT EXISTS otd_entities (
  entity_id TEXT PRIMARY KEY,        -- Wikidata QID; synthetic id for non-WD rows
  label TEXT NOT NULL,               -- canonical name (e.g. "Neil Armstrong")
  description TEXT,                  -- short bio (1-2 sentences)
  entity_type TEXT NOT NULL,         -- person | event | holiday | couple | place | work | org
  sitelinks INTEGER NOT NULL DEFAULT 0,
  avg_daily_views REAL NOT NULL DEFAULT 0,
  inbound_links INTEGER NOT NULL DEFAULT 0,
  notability_score REAL NOT NULL DEFAULT 0,
  notability_source TEXT NOT NULL DEFAULT 'pending',
  image_url TEXT,
  image_license TEXT,
  image_artist TEXT,
  image_license_url TEXT,
  image_source TEXT,                 -- wikidata | wikipedia | commons | external
  enwiki_title TEXT,
  wikidata_id TEXT,
  birth_date TEXT,                   -- ISO date
  death_date TEXT,                   -- ISO date or null
  birth_year INTEGER,
  death_year INTEGER,
  birth_place TEXT,
  death_place TEXT,
  country_code TEXT,
  profession TEXT NOT NULL DEFAULT '[]',  -- JSON array
  star_sign TEXT,
  chinese_zodiac TEXT,
  generation TEXT,
  cause_of_death TEXT,
  age_at_death INTEGER,
  gender TEXT,
  ethnicity TEXT,
  languages_spoken TEXT NOT NULL DEFAULT '[]',  -- JSON array
  known_for TEXT,                    -- brief description of fame
  awards TEXT NOT NULL DEFAULT '[]',  -- JSON array
  related_entities TEXT NOT NULL DEFAULT '[]',  -- JSON array of Q-IDs
  data_sources TEXT NOT NULL DEFAULT '[]',  -- JSON array of provenance
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otd_entities_type ON otd_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_otd_entities_label ON otd_entities(label);
CREATE INDEX IF NOT EXISTS idx_otd_entities_notability ON otd_entities(notability_score DESC);
CREATE INDEX IF NOT EXISTS idx_otd_entities_sitelinks ON otd_entities(sitelinks DESC);
CREATE INDEX IF NOT EXISTS idx_otd_entities_views ON otd_entities(avg_daily_views DESC);
CREATE INDEX IF NOT EXISTS idx_otd_entities_birth_year ON otd_entities(birth_year);
CREATE INDEX IF NOT EXISTS idx_otd_entities_death_year ON otd_entities(death_year);
CREATE INDEX IF NOT EXISTS idx_otd_entities_birth_date ON otd_entities(birth_date);
CREATE INDEX IF NOT EXISTS idx_otd_entities_country ON otd_entities(country_code);
CREATE INDEX IF NOT EXISTS idx_otd_entities_star_sign ON otd_entities(star_sign);
CREATE INDEX IF NOT EXISTS idx_otd_entities_wikidata_id ON otd_entities(wikidata_id);

-- FTS5 for fuzzy entity name search (RAG retrieval)
CREATE VIRTUAL TABLE IF NOT EXISTS otd_entities_fts USING fts5(
  label,
  description,
  known_for,
  content='otd_entities',
  content_rowid='rowid',
  tokenize='porter unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS otd_entities_ai AFTER INSERT ON otd_entities BEGIN
  INSERT INTO otd_entities_fts(rowid, label, description, known_for)
  VALUES (new.rowid, new.label, new.description, new.known_for);
END;

CREATE TRIGGER IF NOT EXISTS otd_entities_au AFTER UPDATE ON otd_entities BEGIN
  UPDATE otd_entities_fts SET
    label = new.label,
    description = new.description,
    known_for = new.known_for
  WHERE rowid = new.rowid;
END;

CREATE TRIGGER IF NOT EXISTS otd_entities_ad AFTER DELETE ON otd_entities BEGIN
  DELETE FROM otd_entities_fts WHERE rowid = old.rowid;
END;

-- ============================================================================
-- 11. Observances table (national/international days, 1500+ rows)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_observances (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,         -- e.g. "world-kindness-day"
  name TEXT NOT NULL,                 -- e.g. "World Kindness Day"
  description TEXT,
  date_rule TEXT NOT NULL,            -- e.g. "11-13" (Nov 13) or "second-sunday-of-may"
  month INTEGER,                      -- 1-12 (for fixed dates)
  day INTEGER,                        -- 1-31 (for fixed dates)
  is_fixed INTEGER NOT NULL DEFAULT 1,  -- 0 for movable dates
  category TEXT,                      -- awareness | international | funny | food | relationship | etc.
  origin TEXT,                        -- origin story
  founded_year INTEGER,
  observed_countries TEXT NOT NULL DEFAULT '[]',  -- JSON array of country codes
  hashtags TEXT NOT NULL DEFAULT '[]',           -- JSON array
  ideas TEXT NOT NULL DEFAULT '[]',              -- JSON array of ways to observe
  related_observances TEXT NOT NULL DEFAULT '[]', -- JSON array of slugs
  wikipedia_url TEXT,
  source TEXT,                        -- nager | checkiday | wikipedia | manual
  source_url TEXT,
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otd_observances_slug ON otd_observances(slug);
CREATE INDEX IF NOT EXISTS idx_otd_observances_date ON otd_observances(month, day);
CREATE INDEX IF NOT EXISTS idx_otd_observances_category ON otd_observances(category);
CREATE INDEX IF NOT EXISTS idx_otd_observances_fixed ON otd_observances(is_fixed);

-- ============================================================================
-- 12. Holidays table (per-country, per-year, from Nager.Date)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_holidays (
  id INTEGER PRIMARY KEY,
  country_code TEXT NOT NULL,         -- ISO 3166-1 alpha-2
  date TEXT NOT NULL,                 -- ISO date
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  name TEXT NOT NULL,
  local_name TEXT,                    -- native-language name
  holiday_type TEXT,                  -- Public | Bank | School | Authorities | Optional | Observance
  global_holiday INTEGER NOT NULL DEFAULT 1,
  regions TEXT NOT NULL DEFAULT '[]', -- JSON array of region codes
  source TEXT NOT NULL,               -- nager | openholidays
  source_url TEXT,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(country_code, date, name)
);

CREATE INDEX IF NOT EXISTS idx_otd_holidays_country ON otd_holidays(country_code);
CREATE INDEX IF NOT EXISTS idx_otd_holidays_date ON otd_holidays(month, day);
CREATE INDEX IF NOT EXISTS idx_otd_holidays_year ON otd_holidays(year);
CREATE INDEX IF NOT EXISTS idx_otd_holidays_type ON otd_holidays(holiday_type);

-- ============================================================================
-- 13. RAG answer cache (per Prompt E stage 3)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_answer_cache (
  cache_key TEXT PRIMARY KEY,         -- normalized query hash
  query_hash TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  record_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array of cited onthisday.id
  generation_cost REAL NOT NULL DEFAULT 0,  -- USD
  model TEXT,                         -- e.g. "gemini-2.5-flash-lite"
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cached_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  hit_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_otd_answer_cache_hash ON otd_answer_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_otd_answer_cache_expires ON otd_answer_cache(expires_at);

-- ============================================================================
-- 14. Source registry (for provenance tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_sources (
  source_id TEXT PRIMARY KEY,         -- e.g. "wikipedia_feed", "wikidata_qlever", "nager_date"
  name TEXT NOT NULL,
  base_url TEXT,
  license TEXT,                       -- e.g. "CC BY-SA 4.0", "CC0", "public-domain"
  license_url TEXT,
  attribution_required INTEGER NOT NULL DEFAULT 0,
  rate_limit_per_hour INTEGER,        -- max requests per hour (anonymous)
  requires_user_agent INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  first_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_rows_pulled INTEGER NOT NULL DEFAULT 0
);

-- Seed the 7 known sources
INSERT OR IGNORE INTO otd_sources (source_id, name, base_url, license, license_url, attribution_required, rate_limit_per_hour, requires_user_agent, notes) VALUES
  ('wikipedia_feed', 'Wikimedia Feed API', 'https://api.wikimedia.org/feed/v1/wikipedia', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', 1, 500, 1, 'Canonical on-this-day feed (selected + events + births + deaths + holidays + all)'),
  ('wikipedia_rest', 'Wikipedia REST API (legacy)', 'https://en.wikipedia.org/api/rest_v1', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', 1, 500, 1, 'Legacy rest_v1 mirror, retained for backward compat'),
  ('wikidata_qlever', 'Wikidata QLever mirror', 'https://qlever.dev/api/wikidata', 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/', 0, 0, 1, '100x faster than WDQS, used for heavy SPARQL'),
  ('wikidata_wdqs', 'Wikidata Query Service', 'https://query.wikidata.org/sparql', 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/', 0, 0, 1, 'Official WDQS, often times out at 60s; QLever preferred'),
  ('byabbe', 'byabbe.se on-this-day', 'https://byabbe.se/on-this-day', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', 1, 0, 1, 'Mirror of Wikimedia feed, ~60 events per day'),
  ('muffinlabs', 'Muffin Labs history.muffinlabs.com', 'https://history.muffinlabs.com/date', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', 1, 0, 0, 'Mirror of Wikipedia day pages, 60/217/117 per day'),
  ('nager_date', 'Nager.Date Public Holidays', 'https://date.nager.at/api/v3', 'free-to-use', 'https://date.nager.at/Api', 0, 0, 0, '197 countries public holidays, no key required'),
  ('openholidays', 'OpenHolidays API', 'https://openholidaysapi.org', 'free-to-use', 'https://openholidaysapi.org', 0, 0, 0, '36 EU countries, school + public holidays'),
  ('checkiday', 'Checkiday National Day API', 'https://api.checkiday.com', 'free-with-attribution', 'https://apilayer.com/marketplace/checkiday-api', 1, 100, 0, '5,000+ US observances, free 100 req/mo'),
  ('pageviews', 'Wikimedia Pageviews API', 'https://wikimedia.org/api/rest_v1/metrics/pageviews', 'CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', 1, 500, 1, 'Per-article pageview history'),
  ('dbpedia', 'DBpedia SPARQL endpoint', 'https://dbpedia.org/sparql', 'CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/', 1, 0, 1, 'Wikipedia-derived structured data'),
  ('commons_api', 'Wikimedia Commons API', 'https://commons.wikimedia.org/w/api.php', 'varies', 'https://commons.wikimedia.org/wiki/Commons:Licensing', 1, 500, 1, 'Image license + author metadata via extmetadata');

-- ============================================================================
-- 15. Pipeline run log (for tracking ingest jobs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_pipeline_runs (
  id INTEGER PRIMARY KEY,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'running',  -- running | success | failed | partial
  sources_used TEXT NOT NULL DEFAULT '[]',  -- JSON array of source_ids
  dates_processed INTEGER NOT NULL DEFAULT 0,
  rows_fetched INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_deduped INTEGER NOT NULL DEFAULT 0,
  rows_verified INTEGER NOT NULL DEFAULT 0,
  avg_quality_score REAL,
  errors TEXT NOT NULL DEFAULT '[]',  -- JSON array
  config TEXT NOT NULL DEFAULT '{}',  -- JSON
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_otd_pipeline_runs_status ON otd_pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_otd_pipeline_runs_started ON otd_pipeline_runs(started_at DESC);

-- ============================================================================
-- 16. Couple table (for weddings/anniversaries, normalized)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_couples (
  couple_id TEXT PRIMARY KEY,         -- hash of (entity_id, entity2_id) sorted
  entity_id TEXT NOT NULL,            -- first spouse Q-ID
  entity2_id TEXT NOT NULL,           -- second spouse Q-ID
  married_at TEXT,                    -- ISO date
  divorced_at TEXT,                   -- ISO date or null
  marriage_year INTEGER,
  marriage_country TEXT,
  status TEXT NOT NULL DEFAULT 'married',  -- married | divorced | widowed
  wikipedia_url TEXT,
  notes TEXT,
  data_sources TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otd_couples_entity1 ON otd_couples(entity_id);
CREATE INDEX IF NOT EXISTS idx_otd_couples_entity2 ON otd_couples(entity2_id);
CREATE INDEX IF NOT EXISTS idx_otd_couples_year ON otd_couples(marriage_year);
CREATE INDEX IF NOT EXISTS idx_otd_couples_status ON otd_couples(status);

-- ============================================================================
-- 17. Backfill: tag existing rows with default provenance
-- ============================================================================

-- All existing rows from rest_v1 get that source tagged
UPDATE onthisday
SET data_sources = json_array(
  json_object(
    'name', 'wikipedia_rest',
    'url', 'https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/' ||
           printf('%02d', month) || '/' || printf('%02d', day),
    'retrieved_at', '2026-07-20',
    'license', 'CC BY-SA 4.0',
    'license_url', 'https://creativecommons.org/licenses/by-sa/4.0/',
    'attribution_required', 1
  )
)
WHERE data_sources = '[]' OR data_sources IS NULL;

-- Set verified_in from data_sources length
UPDATE onthisday
SET verified_in = json_array('wikipedia_rest')
WHERE verified_in = '[]' OR verified_in IS NULL;

-- Default verified=0 (single source)
UPDATE onthisday
SET verified = 0
WHERE verified = 0;

-- Track the initial pipeline run
INSERT OR IGNORE INTO otd_pipeline_runs
  (started_at, completed_at, status, sources_used, dates_processed, rows_fetched, rows_inserted, rows_deduped, rows_verified, avg_quality_score, notes)
VALUES
  (CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'success',
   '["wikipedia_rest"]', 366, 71992, 71992, 0, 0, 62.0,
   'Initial batch from migration 010: 71,992 entries from 366 dates via rest_v1 (no dedup)');

-- End of migration 011
