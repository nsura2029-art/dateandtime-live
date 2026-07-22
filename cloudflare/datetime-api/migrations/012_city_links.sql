-- Migration 012: Link OTD events + persons to cities
-- Adds city foreign keys to onthisday and otd_entities so we can query
-- "OTD events in Tampa", "people born in Tampa", etc.
--
-- Strategy: nullable FKs (no referential integrity to avoid blocking
-- seed loads). Use city_id (matches cities.id PK, GeoNames-style).

-- ============================================================================
-- 1. onthisday: primary city for the event
-- ============================================================================
-- For events: city where it happened
-- For births: birth city (usually the person was born here)
-- For deaths: death city
-- For holidays: city of origin (e.g. "Independence Day" → Philadelphia)

ALTER TABLE onthisday ADD COLUMN city_id INTEGER;
ALTER TABLE onthisday ADD COLUMN city_name TEXT;       -- denormalized for resilience
ALTER TABLE onthisday ADD COLUMN country_name TEXT;    -- denormalized for resilience

CREATE INDEX IF NOT EXISTS idx_onthisday_city_id ON onthisday(city_id);
CREATE INDEX IF NOT EXISTS idx_onthisday_country_code ON onthisday(country_code);

-- ============================================================================
-- 2. otd_entities: birth_city_id + death_city_id
-- ============================================================================

ALTER TABLE otd_entities ADD COLUMN birth_city_id INTEGER;
ALTER TABLE otd_entities ADD COLUMN death_city_id INTEGER;
ALTER TABLE otd_entities ADD COLUMN birth_city_name TEXT;
ALTER TABLE otd_entities ADD COLUMN death_city_name TEXT;

CREATE INDEX IF NOT EXISTS idx_otd_entities_birth_city_id ON otd_entities(birth_city_id);
CREATE INDEX IF NOT EXISTS idx_otd_entities_death_city_id ON otd_entities(death_city_id);
CREATE INDEX IF NOT EXISTS idx_otd_entities_country_code ON otd_entities(country_code);

-- ============================================================================
-- 3. FTS5 extension for city search (faster than LIKE)
-- ============================================================================
-- (Falls back to existing cities_fts if it exists, or creates if not)
-- Skipped for now — cities already have FTS5 via Phase 0

-- ============================================================================
-- 4. Helpful view: today's events with city info
-- ============================================================================

DROP VIEW IF EXISTS v_otd_with_city;
CREATE VIEW IF NOT EXISTS v_otd_with_city AS
SELECT
  o.id,
  o.month,
  o.day,
  o.year,
  o.title,
  o.description,
  o.type,
  o.category,
  o.country_code,
  o.city_id,
  o.city_name,
  o.country_name,
  o.wikipedia_url,
  o.image_url,
  o.image_license,
  o.image_credit,
  o.rank_score,
  o.verified,
  o.wikidata_id,
  o.wikipedia_title
FROM onthisday o
WHERE o.city_id IS NOT NULL;

-- ============================================================================
-- 5. Helpful view: people with birth/death city info
-- ============================================================================

DROP VIEW IF EXISTS v_entities_with_cities;
CREATE VIEW IF NOT EXISTS v_entities_with_cities AS
SELECT
  e.entity_id,
  e.label,
  e.entity_type,
  e.birth_date,
  e.birth_year,
  e.death_date,
  e.death_year,
  e.birth_city_id,
  e.birth_city_name,
  e.death_city_id,
  e.death_city_name,
  e.country_code,
  e.profession,
  e.star_sign,
  e.chinese_zodiac,
  e.image_url,
  e.image_license,
  e.image_credit,
  e.wikipedia_url
FROM otd_entities e
WHERE e.birth_city_id IS NOT NULL OR e.death_city_id IS NOT NULL;

-- End of migration 012
