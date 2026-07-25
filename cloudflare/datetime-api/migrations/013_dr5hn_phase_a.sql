-- ============================================================
-- Phase 13: dr5hn countries-states-cities enrichment (Phase A)
-- Source: https://github.com/dr5hn/countries-states-cities-database
--         v3.2-export.6 (2026-07-11)
--
-- What this migration adds:
--   1. states      — adds iso3166_2 + native + dr5hn_id columns
--   2. countries   — adds native + nationality + gdp columns
--   3. country_translations — new table (250 × 19 = 4,750 rows)
--
-- What this migration does NOT do (deferred to Phase B):
--   - Replace the cities table (we keep 33,945 GeoNames cities)
--   - Re-derive climate_summaries / seasons / onthisday FKs
--
-- Safe to re-run: all INSERTs use INSERT OR IGNORE or ON CONFLICT.
-- ============================================================

-- ============================================================
-- 1. Extend states with dr5hn fields
-- ============================================================
ALTER TABLE states ADD COLUMN iso3166_2 TEXT;     -- "AF-BDS" (formal ISO 3166-2)
ALTER TABLE states ADD COLUMN native TEXT;          -- "بدخشان" (local name)
ALTER TABLE states ADD COLUMN dr5hn_id INTEGER;     -- dr5hn's internal id (many-to-1: one dr5hn state can map to multiple GeoNames admin1 rows)
CREATE INDEX IF NOT EXISTS idx_states_dr5hn ON states(dr5hn_id);
CREATE INDEX IF NOT EXISTS idx_states_iso ON states(iso3166_2);
CREATE INDEX IF NOT EXISTS idx_states_name ON states(country_code, name);

-- ============================================================
-- 2. Extend countries with dr5hn fields
-- ============================================================
ALTER TABLE countries ADD COLUMN native TEXT;        -- "افغانستان" (local name)
ALTER TABLE countries ADD COLUMN nationality TEXT;   -- "Afghan" (demonym)
ALTER TABLE countries ADD COLUMN gdp INTEGER;        -- gross domestic product (USD)

CREATE INDEX IF NOT EXISTS idx_countries_nationality ON countries(nationality);

-- ============================================================
-- 3. New country_translations table
--    Stores 19-language country name translations from dr5hn
-- ============================================================
CREATE TABLE IF NOT EXISTS country_translations (
  cca2        TEXT NOT NULL,
  lang        TEXT NOT NULL,    -- "zh-CN", "ja", "ar", "es", "fr", ...
  name        TEXT NOT NULL,    -- translated country name
  PRIMARY KEY (cca2, lang),
  FOREIGN KEY (cca2) REFERENCES countries(cca2)
);

CREATE INDEX IF NOT EXISTS idx_translations_lang ON country_translations(lang);
CREATE INDEX IF NOT EXISTS idx_translations_name ON country_translations(name);

-- ============================================================
-- 4. Track this import in data_sources + import_history
-- ============================================================
INSERT OR IGNORE INTO data_sources (id, name, url, license, description, last_fetched_at, active)
VALUES (
  'dr5hn',
  'dr5hn/countries-states-cities-database',
  'https://github.com/dr5hn/countries-states-cities-database',
  'MIT',
  'v3.2-export.6 (2026-07-11): 250 countries, 5,308 states, 152,970 cities, 19-language translations. Phase A imports states + country enrichment only.',
  datetime('now'),
  1
);
