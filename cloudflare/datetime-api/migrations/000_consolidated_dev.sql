-- Migration 000 (consolidated for dev D1)
-- Creates the onthisday table with ALL columns from base + 009 + 010 + 011
-- plus the 7 new tables from migration 011 and all indexes.
--
-- USE THIS FOR: dev D1 (timeandtimepro-dev) where onthisday doesn't exist yet
-- DO NOT USE: prod (timeandtimepro-full) — there, run 009 → 010 → 011 in order

-- ============================================================================
-- 1. ONTHISDAY table (base + 009 + 010 + 011 columns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS onthisday (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Core identity (base)
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  year INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  type TEXT NOT NULL DEFAULT 'event',
  category TEXT,
  subcategory TEXT,
  importance INTEGER NOT NULL DEFAULT 0,
  country_code TEXT,
  country_codes TEXT NOT NULL DEFAULT '[]',
  region TEXT NOT NULL DEFAULT 'global',
  wikipedia_url TEXT,
  source_url TEXT,
  external_id TEXT,
  -- Image (base + 010)
  image_url TEXT,
  image_alt TEXT,
  image_status TEXT NOT NULL DEFAULT 'missing',
  image_attempts INTEGER NOT NULL DEFAULT 0,
  image_last_checked TIMESTAMP,
  image_license TEXT,
  image_credit TEXT,
  image_source_url TEXT,
  image_width INTEGER,
  image_height INTEGER,
  image_r2_key TEXT,
  image_r2_cached_at TIMESTAMP,
  image_variants TEXT NOT NULL DEFAULT '{}',
  -- SEO/discovery (009)
  user_intents TEXT NOT NULL DEFAULT '[]',
  search_keywords TEXT NOT NULL DEFAULT '[]',
  entity_type TEXT NOT NULL DEFAULT 'event',
  media TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  sentiment TEXT NOT NULL DEFAULT 'neutral',
  related_event_ids TEXT NOT NULL DEFAULT '[]',
  -- Quality (009 + 010)
  quality_score INTEGER NOT NULL DEFAULT 50,
  quality_tier TEXT NOT NULL DEFAULT 'bronze',
  quality_breakdown TEXT NOT NULL DEFAULT '{}',
  quality_history TEXT NOT NULL DEFAULT '[]',
  improvement_attempts INTEGER NOT NULL DEFAULT 0,
  improvement_log TEXT NOT NULL DEFAULT '[]',
  blocked_reason TEXT,
  -- Structured content (010)
  faq_questions TEXT NOT NULL DEFAULT '[]',
  key_facts TEXT NOT NULL DEFAULT '[]',
  people_mentioned TEXT NOT NULL DEFAULT '[]',
  -- Person enrichment (011)
  wikidata_id TEXT,
  wikipedia_title TEXT,
  star_sign TEXT,
  chinese_zodiac TEXT,
  generation TEXT,
  cause_of_death TEXT,
  age_at_death INTEGER,
  current_age INTEGER,
  profession TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'en',
  -- Notability (011)
  rank_score REAL NOT NULL DEFAULT 0,
  sitelinks INTEGER NOT NULL DEFAULT 0,
  pageviews_30d_avg REAL NOT NULL DEFAULT 0,
  inbound_links INTEGER NOT NULL DEFAULT 0,
  notability_source TEXT NOT NULL DEFAULT 'pending',
  -- Provenance (011)
  data_sources TEXT NOT NULL DEFAULT '[]',
  verified_in TEXT NOT NULL DEFAULT '[]',
  -- Weddings / pairs (011)
  entity2_id TEXT,
  entity2_name TEXT,
  couple_id TEXT,
  -- Anniversary (011)
  anniversary_date TEXT,
  recurrence TEXT NOT NULL DEFAULT 'none',
  is_anniversary_today INTEGER NOT NULL DEFAULT 0,
  is_today INTEGER NOT NULL DEFAULT 0,
  -- Editorial (011)
  verified INTEGER NOT NULL DEFAULT 0,
  review_reason TEXT,
  last_verified_at TIMESTAMP,
  -- Holiday (011)
  holiday_type TEXT,
  holiday_global INTEGER NOT NULL DEFAULT 1,
  observance_countries TEXT NOT NULL DEFAULT '[]',
  observance_hashtags TEXT NOT NULL DEFAULT '[]',
  -- Audit (009)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. OTD_ENTITIES table (011)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL,
  wikidata_id TEXT,
  enwiki_title TEXT,
  birth_date TEXT,
  death_date TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  birth_place TEXT,
  death_place TEXT,
  country_code TEXT,
  profession TEXT NOT NULL DEFAULT '[]',
  star_sign TEXT,
  chinese_zodiac TEXT,
  generation TEXT,
  cause_of_death TEXT,
  age_at_death INTEGER,
  gender TEXT,
  languages_spoken TEXT NOT NULL DEFAULT '[]',
  known_for TEXT,
  awards TEXT NOT NULL DEFAULT '[]',
  sitelinks INTEGER NOT NULL DEFAULT 0,
  avg_daily_views REAL NOT NULL DEFAULT 0,
  inbound_links INTEGER NOT NULL DEFAULT 0,
  notability_score REAL NOT NULL DEFAULT 0,
  notability_source TEXT,
  image_url TEXT,
  image_license TEXT,
  image_artist TEXT,
  image_license_url TEXT,
  image_source TEXT,
  related_entities TEXT NOT NULL DEFAULT '[]',
  data_sources TEXT NOT NULL DEFAULT '[]',
  last_updated TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. OTD_OBSERVANCES table (011)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_observances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observance_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  description TEXT,
  observance_date TEXT,
  recurrence TEXT,
  is_global INTEGER NOT NULL DEFAULT 0,
  countries TEXT NOT NULL DEFAULT '[]',
  hashtags TEXT NOT NULL DEFAULT '[]',
  source_url TEXT,
  data_source TEXT,
  image_url TEXT,
  image_license TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  rank_score REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. OTD_HOLIDAYS table (011)
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  holiday_id TEXT NOT NULL,
  country_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  local_name TEXT,
  date TEXT NOT NULL,
  end_date TEXT,
  type TEXT,
  observed INTEGER NOT NULL DEFAULT 1,
  public_holiday INTEGER NOT NULL DEFAULT 1,
  school_holiday INTEGER NOT NULL DEFAULT 0,
  observance_countries TEXT NOT NULL DEFAULT '[]',
  data_source TEXT,
  data_source_id TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(holiday_id, country_code, year)
);

-- ============================================================================
-- 5. OTD_ANSWER_CACHE table (011) — for RAG cached answers
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_answer_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  query_intent TEXT,
  query_month INTEGER,
  query_day INTEGER,
  query_year INTEGER,
  query_entity_id TEXT,
  response_json TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  generation_model TEXT,
  generation_cost_usd REAL NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 1,
  last_hit_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. OTD_SOURCES table (011) — registry of data sources
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  license TEXT,
  license_url TEXT,
  attribution_required INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 50,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP,
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. OTD_PIPELINE_RUNS table (011) — run log for ingestion pipeline
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL UNIQUE,
  pipeline TEXT NOT NULL,
  source_id TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'running',
  rows_processed INTEGER NOT NULL DEFAULT 0,
  rows_added INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  rows_errored INTEGER NOT NULL DEFAULT 0,
  error_log TEXT,
  config_json TEXT
);

-- ============================================================================
-- 8. OTD_COUPLES table (011) — for weddings/divorces
-- ============================================================================

CREATE TABLE IF NOT EXISTS otd_couples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id TEXT NOT NULL UNIQUE,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity2_id TEXT NOT NULL,
  entity2_name TEXT NOT NULL,
  marriage_date TEXT,
  marriage_year INTEGER,
  marriage_month INTEGER,
  marriage_day INTEGER,
  marriage_place TEXT,
  marriage_country_code TEXT,
  divorce_date TEXT,
  divorce_year INTEGER,
  status TEXT NOT NULL DEFAULT 'married',
  verified INTEGER NOT NULL DEFAULT 0,
  data_sources TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 9. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_onthisday_month_day ON onthisday(month, day);
CREATE INDEX IF NOT EXISTS idx_onthisday_year ON onthisday(year);
CREATE INDEX IF NOT EXISTS idx_onthisday_type ON onthisday(type);
CREATE INDEX IF NOT EXISTS idx_onthisday_wikidata_id ON onthisday(wikidata_id);
CREATE INDEX IF NOT EXISTS idx_onthisday_wikipedia_title ON onthisday(wikipedia_title);
CREATE INDEX IF NOT EXISTS idx_onthisday_star_sign ON onthisday(star_sign);
CREATE INDEX IF NOT EXISTS idx_onthisday_chinese_zodiac ON onthisday(chinese_zodiac);
CREATE INDEX IF NOT EXISTS idx_onthisday_generation ON onthisday(generation);
CREATE INDEX IF NOT EXISTS idx_onthisday_rank_score ON onthisday(rank_score DESC);
CREATE INDEX IF NOT EXISTS idx_onthisday_sitelinks ON onthisday(sitelinks DESC);
CREATE INDEX IF NOT EXISTS idx_onthisday_pageviews ON onthisday(pageviews_30d_avg DESC);
CREATE INDEX IF NOT EXISTS idx_onthisday_verified ON onthisday(verified);
CREATE INDEX IF NOT EXISTS idx_onthisday_verified_in ON onthisday(verified_in);
CREATE INDEX IF NOT EXISTS idx_onthisday_review_reason ON onthisday(review_reason);
CREATE INDEX IF NOT EXISTS idx_onthisday_is_today ON onthisday(is_today);
CREATE INDEX IF NOT EXISTS idx_onthisday_is_anniversary_today ON onthisday(is_anniversary_today);
CREATE INDEX IF NOT EXISTS idx_onthisday_anniversary_date ON onthisday(anniversary_date);
CREATE INDEX IF NOT EXISTS idx_onthisday_recurrence ON onthisday(recurrence);
CREATE INDEX IF NOT EXISTS idx_onthisday_entity2_id ON onthisday(entity2_id);
CREATE INDEX IF NOT EXISTS idx_onthisday_couple_id ON onthisday(couple_id);
CREATE INDEX IF NOT EXISTS idx_onthisday_holiday_type ON onthisday(holiday_type);
CREATE INDEX IF NOT EXISTS idx_onthisday_language ON onthisday(language);

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

CREATE INDEX IF NOT EXISTS idx_otd_observances_date ON otd_observances(observance_date);
CREATE INDEX IF NOT EXISTS idx_otd_observances_category ON otd_observances(category);
CREATE INDEX IF NOT EXISTS idx_otd_holidays_country_year ON otd_holidays(country_code, year);
CREATE INDEX IF NOT EXISTS idx_otd_holidays_date ON otd_holidays(date);
CREATE INDEX IF NOT EXISTS idx_otd_answer_cache_intent ON otd_answer_cache(query_intent);
CREATE INDEX IF NOT EXISTS idx_otd_pipeline_runs_started ON otd_pipeline_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_otd_couples_entity ON otd_couples(entity_id, entity2_id);
CREATE INDEX IF NOT EXISTS idx_otd_couples_date ON otd_couples(marriage_year, marriage_month, marriage_day);
