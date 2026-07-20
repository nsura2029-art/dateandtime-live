-- ============================================================
-- Phase 4: Climate summaries + seasons + DST transitions + onthisday
-- Locked 2026-07-19
-- Reference: docs/architecture/SHARED-DB-PLAN.md
-- ============================================================

-- ---------- 1. climate_summaries ----------
-- Per-city, per-month average temperature, rainfall, daylight
-- Source: simplified Köppen-like model based on lat/lon. For MVP we
-- generate approximate values. Real data would come from WMO or
-- Open-Meteo (https://open-meteo.com/) — see Phase 7 data_sources.

CREATE TABLE IF NOT EXISTS climate_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL,
  month INTEGER NOT NULL,                         -- 1-12
  avg_high_c REAL NOT NULL,
  avg_low_c REAL NOT NULL,
  avg_mean_c REAL NOT NULL,
  rainy_days INTEGER NOT NULL,
  avg_precipitation_mm REAL NOT NULL,
  daylight_hours REAL NOT NULL,                   -- avg daylight hours for the month
  climate_class TEXT NOT NULL,                    -- tropical|temperate|continental|polar|arid
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.7,
  UNIQUE(city_id, month)
);
CREATE INDEX IF NOT EXISTS idx_climate_city ON climate_summaries(city_id);
CREATE INDEX IF NOT EXISTS idx_climate_class ON climate_summaries(climate_class);

-- ---------- 2. seasons ----------
-- Per-city, per-season months (start_month, end_month)
-- For tropical: rainy/dry; for temperate: spring/summer/fall/winter

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL,
  season TEXT NOT NULL,                           -- spring|summer|autumn|winter|rainy|dry
  start_month INTEGER NOT NULL,                   -- 1-12
  end_month INTEGER NOT NULL,                     -- 1-12 (inclusive)
  avg_temp_c REAL,                                -- rough avg temp for this season
  source TEXT NOT NULL,
  UNIQUE(city_id, season)
);
CREATE INDEX IF NOT EXISTS idx_seasons_city ON seasons(city_id);

-- ---------- 3. dst_transitions ----------
-- When does DST change in each timezone? Stored as discrete events
-- for upcoming years. Past transitions are inferable from IANA tz
-- database; we store the next 5 years for fast lookup.

CREATE TABLE IF NOT EXISTS dst_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tz_id TEXT NOT NULL,                            -- IANA name (e.g. 'America/New_York')
  year INTEGER NOT NULL,
  spring_forward_date TEXT,                       -- YYYY-MM-DD (when clocks go forward)
  spring_forward_offset_before TEXT,              -- e.g. '-05:00'
  spring_forward_offset_after TEXT,               -- e.g. '-04:00'
  fall_back_date TEXT,
  fall_back_offset_before TEXT,
  fall_back_offset_after TEXT,
  dst_observed INTEGER NOT NULL DEFAULT 1,        -- 0 if no DST in this tz in this year
  source TEXT NOT NULL,
  UNIQUE(tz_id, year)
);
CREATE INDEX IF NOT EXISTS idx_dst_tz ON dst_transitions(tz_id);
CREATE INDEX IF NOT EXISTS idx_dst_year ON dst_transitions(year);

-- ---------- 4. onthisday ----------
-- Curated "on this day" events
-- ~50-100 famous events (Moon landing, 9/11, etc.) per user spec

CREATE TABLE IF NOT EXISTS onthisday (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month INTEGER NOT NULL,                         -- 1-12
  day INTEGER NOT NULL,                           -- 1-31
  year INTEGER,                                   -- year of the event (NULL for recurring holidays)
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,                         -- historical|scientific|cultural|political|sports
  localized_titles TEXT,                          -- JSON
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0
);
CREATE INDEX IF NOT EXISTS idx_onthisday_md ON onthisday(month, day);
CREATE INDEX IF NOT EXISTS idx_onthisday_category ON onthisday(category);

-- ============================================================
-- Verification:
--
--   SELECT COUNT(*) FROM climate_summaries;   -- should be ~60,000 (5081 × 12)
--   SELECT climate_class, COUNT(DISTINCT city_id) FROM climate_summaries WHERE month=1 GROUP BY 1;
--   SELECT * FROM onthisday WHERE month=7 AND day=20;   -- Moon landing
--   SELECT * FROM dst_transitions WHERE tz_id='America/New_York' AND year=2026;
-- ============================================================
