-- ============================================================
-- Phase 2: Holidays + business calendars
-- Locked 2026-07-19 (user: "go ahead with shared DB scoped to date & time")
-- Reference: docs/architecture/SHARED-DB-PLAN.md, global-reference-db-spec.pdf
-- ============================================================
--
-- Adds:
--   - holidays (public holidays per country, region, or city)
--   - holiday_rules (rule-based holidays: nth weekday, lunar, easter, observed)
--   - business_calendars (work hours/days per country)
--   - countries.weekend_days (JSON [0,6] = Sun+Sat, 5,6 = Sat+Sun, etc.)
--   - countries.work_open_hour, work_close_hour, work_lunch_break
--
-- Source data:
--   - nager.date API: https://date.nager.at/api/v3/PublicHolidays/{year}/{cc}
--   - ISO 4217 country codes (cca2)
--   - We populate 20 most-populous countries × 5 years (2024-2028) = 100 responses

-- ---------- 1. holidays ----------
CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL,                    -- ISO cca2 (e.g. 'US', 'JP')
  region_code TEXT,                              -- ISO subdivision (e.g. 'US-CA', 'JP-13'), NULL = national
  city_id INTEGER,                               -- GeoNames id, NULL = country/region
  name TEXT NOT NULL,                            -- English name
  localized_names TEXT,                          -- JSON map {lang: name}
  type TEXT NOT NULL,                            -- public|bank|school|authorities|optional|observance
  date TEXT NOT NULL,                            -- ISO date YYYY-MM-DD (the actual date)
  observed_date TEXT,                            -- ISO date YYYY-MM-DD (date observed, may differ if weekend)
  year INTEGER NOT NULL,                         -- YYYY for query convenience
  fixed INTEGER NOT NULL DEFAULT 0,              -- 1 = fixed date, 0 = rule-based
  global_holiday INTEGER NOT NULL DEFAULT 1,     -- 1 = national, 0 = regional only
  counties TEXT,                                 -- JSON array of region codes (if regional)
  launch_year INTEGER,                           -- when the holiday started
  source TEXT NOT NULL,                          -- e.g. 'nager.date:2024'
  confidence REAL NOT NULL DEFAULT 1.0,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_holidays_country_year ON holidays(country_code, year);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_city ON holidays(city_id);
CREATE INDEX IF NOT EXISTS idx_holidays_country_date ON holidays(country_code, date);

-- ---------- 2. holiday_rules ----------
-- Reusable rules for rule-based holidays. Allows computed holidays
-- (Easter, nth Monday of May, etc.) without storing every occurrence.
CREATE TABLE IF NOT EXISTS holiday_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL,                    -- which country this rule applies to
  name TEXT NOT NULL,                            -- English name
  localized_names TEXT,                          -- JSON
  rule_type TEXT NOT NULL,                       -- 'fixed'|'nth_weekday'|'easter_offset'|'lunar'|'observed'
  rule_definition TEXT NOT NULL,                 -- JSON: see below
  observed_rule TEXT,                            -- JSON: how to shift when falls on weekend
  description TEXT,
  source TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- rule_definition JSON shapes:
--   fixed:           {"month": 7, "day": 4}
--   nth_weekday:     {"month": 5, "week": 1, "weekday": 1}     (1st Monday of May)
--   easter_offset:   {"offset_days": -2}                         (Good Friday)
--   lunar:           {"lunar_month": 1, "lunar_day": 1}          (Lunar New Year)
--   observed:        {"when_weekday": 6, "shift_to": "next_monday"}

CREATE INDEX IF NOT EXISTS idx_holiday_rules_country ON holiday_rules(country_code);

-- ---------- 3. business_calendars ----------
CREATE TABLE IF NOT EXISTS business_calendars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL,
  region_code TEXT,                              -- NULL = national default
  work_days TEXT NOT NULL,                       -- JSON [1,2,3,4,5] (1=Mon, 7=Sun)
  work_open_hour INTEGER NOT NULL DEFAULT 9,
  work_close_hour INTEGER NOT NULL DEFAULT 17,
  work_lunch_break_hours INTEGER NOT NULL DEFAULT 1,
  lunch_start_hour INTEGER,                      -- e.g. 12
  friday_close_hour INTEGER,                     -- for early Friday close (e.g. 14 in IL)
  siesta_countries INTEGER NOT NULL DEFAULT 0,   -- 1 if siesta culture (closes afternoon)
  source TEXT NOT NULL,
  notes TEXT,
  UNIQUE(country_code, region_code)
);

-- ---------- 4. country columns (weekend_days, business hours) ----------
-- SQLite supports ALTER TABLE ADD COLUMN. Add columns if they don't exist.
-- We use pragma check to be safe.

-- For ALTER TABLE in SQLite, we need to check if the column exists.
-- A simpler approach: include weekend_days + work hours in business_calendars
-- with a 'national' marker. We'll just keep them there.

-- ---------- 5. Seed data sources for holidays ----------
-- (Will be populated by seed script)

-- ============================================================
-- Verification queries (run after seed):
--
--   SELECT COUNT(*) FROM holidays;                              -- ~1500
--   SELECT country_code, COUNT(*) FROM holidays GROUP BY 1;    -- per-country
--   SELECT * FROM holidays WHERE date = '2026-12-25' LIMIT 5;  -- Christmas
--   SELECT * FROM holiday_rules WHERE country_code = 'US';     -- rule-based
--   SELECT * FROM business_calendars WHERE country_code IN ('US','JP','DE');
-- ============================================================
