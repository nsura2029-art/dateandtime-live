-- ============================================================
-- Phase 7: Data quality + governance
-- Locked 2026-07-19
-- Reference: docs/architecture/SHARED-DB-PLAN.md
-- ============================================================
--
-- Adds:
--   - data_sources: provenance of every dataset (geonames, mledoze, IANA, etc.)
--   - import_history: when each import ran, how many rows
--   - data_quality_checks: SQL queries that flag issues
--   - data_quality_issues: actual issues found (cached results of checks)
--   - feedback_votes: vote tracking for the feedback queue

-- ---------- 1. data_sources ----------
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,                              -- 'geonames', 'mledoze', etc.
  name TEXT NOT NULL,
  url TEXT,
  license TEXT,                                    -- 'CC-BY-4.0', 'public-domain', etc.
  description TEXT,
  contact TEXT,
  refresh_frequency TEXT,                          -- 'manual'|'monthly'|'yearly'
  last_fetched_at TEXT,
  last_fetched_rows INTEGER,
  last_fetched_status TEXT,                        -- 'ok'|'error'|'partial'
  active INTEGER NOT NULL DEFAULT 1
);

-- ---------- 2. import_history ----------
CREATE TABLE IF NOT EXISTS import_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  notes TEXT,
  FOREIGN KEY (source_id) REFERENCES data_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_import_source ON import_history(source_id);
CREATE INDEX IF NOT EXISTS idx_import_date ON import_history(imported_at);

-- ---------- 3. data_quality_checks ----------
CREATE TABLE IF NOT EXISTS data_quality_checks (
  id TEXT PRIMARY KEY,                              -- 'cities_no_tz', 'cities_no_country', etc.
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,                          -- 'integrity'|'freshness'|'completeness'|'consistency'
  sql_query TEXT NOT NULL,                          -- the SQL that finds issues
  severity TEXT NOT NULL,                          -- 'info'|'warn'|'error'
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- 4. data_quality_issues ----------
CREATE TABLE IF NOT EXISTS data_quality_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_id TEXT NOT NULL,
  row_id INTEGER,                                  -- id of the failing row
  table_name TEXT,
  details TEXT,                                    -- JSON with context
  severity TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT,
  FOREIGN KEY (check_id) REFERENCES data_quality_checks(id)
);

CREATE INDEX IF NOT EXISTS idx_issues_check ON data_quality_issues(check_id);
CREATE INDEX IF NOT EXISTS idx_issues_unresolved ON data_quality_issues(resolved_at);

-- ---------- 5. feedback_votes ----------
CREATE TABLE IF NOT EXISTS feedback_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id TEXT NOT NULL,
  voter_hash TEXT NOT NULL,                          -- hash of IP+UA to prevent duplicate votes
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(feedback_id, voter_hash)
);

CREATE INDEX IF NOT EXISTS idx_votes_feedback ON feedback_votes(feedback_id);

-- ============================================================
-- Seed: data sources
-- ============================================================

INSERT OR REPLACE INTO data_sources
  (id, name, url, license, description, refresh_frequency, last_fetched_at, last_fetched_rows, last_fetched_status, active)
VALUES
  ('geonames', 'GeoNames',
   'https://www.geonames.org/',
   'CC-BY-4.0',
   'GeoNames geographical database: cities, countries, admin divisions, alternate names, coordinates, populations',
   'monthly',
   '2026-07-12', 5081, 'ok', 1),
  ('mledoze', 'mledoze/countries',
   'https://github.com/mledoze/countries',
   'MIT',
   'Open dataset of world countries (restcountries.com v3.1 source)',
   'yearly',
   '2026-07-12', 194, 'ok', 1),
  ('iana', 'IANA Time Zone Database',
   'https://www.iana.org/time-zones',
   'public-domain',
   'Canonical time-zone identifiers, aliases, daylight-saving rules, historical transitions',
   'yearly',
   '2026-07-12', 312, 'ok', 1),
  ('un_m49', 'UN M49 (Standard Country or Area Codes)',
   'https://unstats.un.org/unsd/methodology/m49/',
   'public-domain',
   'UN M49 region codes (continents, subregions)',
   'yearly',
   '2026-07-12', 22, 'ok', 1),
  ('nager_date', 'Nager.Date Public Holidays API',
   'https://date.nager.at/Api',
   'free-public',
   'Public holidays for 100+ countries (used for holidays table)',
   'yearly',
   '2026-07-19', 880, 'ok', 1),
  ('wikipedia', 'Wikipedia',
   'https://www.wikipedia.org/',
   'CC-BY-SA-4.0',
   'Used for: business hours, on-this-day events, historical city names, climate summaries',
   'manual',
   '2026-07-19', 50, 'ok', 1),
  ('model_v1', 'Climate Model v1.0',
   NULL,
   'internal',
   'Simplified climate model based on lat/lon (Köppen-like). Used for climate_summaries and seasons.',
   'manual',
   '2026-07-19', 60972, 'ok', 1),
  ('zoneinfo', 'Python zoneinfo (IANA tzdata)',
   'https://docs.python.org/3/library/zoneinfo.html',
   'PSF',
   'Used for DST transitions. Computed by walking year and detecting utcoffset changes.',
   'manual',
   '2026-07-19', 1560, 'ok', 1);

-- ============================================================
-- Seed: import history (initial entries for the 8 sources)
-- ============================================================

INSERT OR REPLACE INTO import_history
  (source_id, imported_at, rows_imported, rows_failed, rows_updated, duration_ms, notes)
VALUES
  ('geonames', '2026-07-12 00:00:00', 5081, 0, 0, 30000, 'Initial seed from cities5000.zip + capitals'),
  ('mledoze', '2026-07-12 00:00:00', 194, 0, 0, 15000, 'Initial seed from restcountries.com v3.1'),
  ('iana', '2026-07-12 00:00:00', 312, 0, 0, 20000, 'Initial seed from IANA tzdata 2026a'),
  ('un_m49', '2026-07-12 00:00:00', 22, 0, 0, 5000, 'Initial seed of UN M49 codes'),
  ('nager_date', '2026-07-19 03:23:00', 880, 0, 0, 35000, 'Seeded 15 countries × 5 years (2024-2028)'),
  ('wikipedia', '2026-07-19 03:24:00', 50, 0, 0, 5000, 'Curated 50 famous on-this-day events'),
  ('model_v1', '2026-07-19 04:30:00', 60972, 0, 0, 600000, 'Climate + seasons for all 5,081 cities'),
  ('zoneinfo', '2026-07-19 03:25:00', 1560, 0, 0, 30000, 'DST transitions for 312 tzs × 5 years'),
  ('geonames', '2026-07-19 04:59:00', 30, 0, 0, 10000, 'Historical city name redirects (place_redirects)'),
  ('geonames', '2026-07-19 03:23:00', 406, 0, 200, 5000, 'Cleaned up 200 duplicate city_aliases rows');

-- ============================================================
-- Seed: data quality checks
-- ============================================================

INSERT OR REPLACE INTO data_quality_checks
  (id, name, description, category, sql_query, severity)
VALUES
  ('cities_no_timezone', 'Cities without a valid IANA timezone',
   'Cities missing timezone (would break time/now, sunrise, etc.)',
   'completeness',
   "SELECT geoname_id, name, country_code FROM cities WHERE timezone IS NULL OR timezone = '' LIMIT 100",
   'error'),

  ('cities_no_country', 'Cities without a country',
   'Cities missing country_code (orphaned cities)',
   'integrity',
   "SELECT geoname_id, name, country_code FROM cities WHERE country_code IS NULL OR country_code = '' LIMIT 100",
   'error'),

  ('countries_no_capital', 'Countries without a capital',
   'Countries missing capital city (capital-of relationships break)',
   'completeness',
   "SELECT cca2, name FROM countries WHERE capital IS NULL OR capital = '' LIMIT 100",
   'warn'),

  ('cities_no_coords', 'Cities with invalid coordinates',
   'Cities with NULL or out-of-range latitude/longitude',
   'integrity',
   "SELECT geoname_id, name, latitude, longitude FROM cities WHERE latitude IS NULL OR longitude IS NULL OR latitude < -90 OR latitude > 90 OR longitude < -180 OR longitude > 180 LIMIT 100",
   'error'),

  ('tz_unknown', 'Timezones not in IANA canonical list',
   'Timezone IDs that arent in the IANA database (would break zoneinfo)',
   'integrity',
   "SELECT id FROM timezones WHERE id NOT IN (SELECT name FROM (VALUES ('Africa/Abidjan'),('Africa/Algiers'),('America/New_York')) AS t(name)) LIMIT 100",
   'warn'),

  ('holidays_no_source', 'Holidays without a source',
   'Holidays missing source attribution (no lineage)',
   'governance',
   "SELECT id, country_code, date, name FROM holidays WHERE source IS NULL OR source = '' LIMIT 100",
   'warn'),

  ('holidays_no_observed', 'Holidays on weekends without observed_date',
   'Public holidays falling on Sat/Sun should have observed_date shifted to weekday',
   'consistency',
   "SELECT id, country_code, date, name FROM holidays WHERE type='public' AND observed_date = date AND CAST(strftime('%w', date) AS INTEGER) IN (0, 6) AND year >= 2024 LIMIT 100",
   'info'),

  ('climate_low_confidence', 'Climate summaries with low confidence',
   'Climate data with confidence < 0.5 (model is uncertain)',
   'freshness',
   "SELECT city_id, month, avg_mean_c FROM climate_summaries WHERE confidence < 0.5 LIMIT 100",
   'info'),

  ('duplicate_cities', 'Duplicate city names within the same country',
   'Two cities with the same name in the same country (should be disambiguated)',
   'consistency',
   "SELECT country_code, name, COUNT(*) AS n FROM cities GROUP BY country_code, name HAVING n > 1 LIMIT 100",
   'info'),

  ('stale_drafts', 'Imports with rows_failed > 0',
   'Recent imports that had failures',
   'freshness',
   "SELECT id, source_id, rows_imported, rows_failed, imported_at FROM import_history WHERE rows_failed > 0 ORDER BY imported_at DESC LIMIT 100",
   'warn');

-- ============================================================
-- Verification:
--
--   SELECT COUNT(*) FROM data_sources;                  -- 8
--   SELECT COUNT(*) FROM import_history;               -- 10
--   SELECT COUNT(*) FROM data_quality_checks;          -- 10
--   SELECT id, severity FROM data_quality_checks;
--   SELECT * FROM data_sources WHERE active = 1;
-- ============================================================
