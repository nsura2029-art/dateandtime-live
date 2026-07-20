-- ============================================================
-- Migration 010: Holidays + OnThisDay expansion
-- 2026-07-19 — user: "build all holidays for all countries, religion-specific,
-- onthisday country-specific, famous people, popular events, birthdays, sports"
-- Reference: docs/architecture/HOLIDAYS-AND-ONTHISDAY-PLAN.md
-- ============================================================

-- ---------- 1. Expand holidays table ----------
-- Add religion, observance_type, wikipedia_url, description, translations
ALTER TABLE holidays ADD COLUMN religion TEXT;  -- christian|jewish|muslim|hindu|buddhist|sikh|jain|bahai|chinese|secular|national|observance
ALTER TABLE holidays ADD COLUMN observance_type TEXT;  -- public_holiday|bank_holiday|school_holiday|observance|optional|flag_day|unofficial
ALTER TABLE holidays ADD COLUMN wikipedia_url TEXT;
ALTER TABLE holidays ADD COLUMN description TEXT;
ALTER TABLE holidays ADD COLUMN translations TEXT;  -- JSON {lang: name}

CREATE INDEX IF NOT EXISTS idx_holidays_religion ON holidays(religion);
CREATE INDEX IF NOT EXISTS idx_holidays_religion_date ON holidays(religion, date);
CREATE INDEX IF NOT EXISTS idx_holidays_observance ON holidays(observance_type);

-- ---------- 2. Rebuild onthisday_events ----------
-- Old schema was 50 rows, 5 cols. New schema: rich, filterable, country-tagged.
DROP TABLE IF EXISTS onthisday_events;
CREATE TABLE IF NOT EXISTS onthisday_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month INTEGER NOT NULL,                -- 1-12
  day INTEGER NOT NULL,                  -- 1-31
  year INTEGER,                          -- year of event (NULL for recurring/unspecified)
  end_year INTEGER,                      -- for date ranges / dynasties
  category TEXT NOT NULL,                -- event|birth|death|holiday|sports|art|science|politics|disaster|discovery|treaty|space
  subcategory TEXT,                      -- olympics|world_cup|election|battle|invention|expedition|nobel|first_flight|grammy|oscar|premiere
  country_codes TEXT,                    -- JSON array of cca2 codes, NULL = global
  religion TEXT,                         -- same enum as holidays
  title TEXT NOT NULL,                   -- short headline
  description TEXT,                      -- 1-2 sentence summary
  importance INTEGER NOT NULL DEFAULT 1, -- 1-5 ranking
  wikipedia_url TEXT,
  image_url TEXT,                        -- Wikimedia Commons thumbnail (optional)
  source TEXT NOT NULL,                  -- 'wikipedia' | 'curated' | 'computed'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_onthisday_md ON onthisday_events(month, day);
CREATE INDEX IF NOT EXISTS idx_onthisday_category ON onthisday_events(category);
CREATE INDEX IF NOT EXISTS idx_onthisday_religion ON onthisday_events(religion);
CREATE INDEX IF NOT EXISTS idx_onthisday_importance ON onthisday_events(importance DESC);
CREATE INDEX IF NOT EXISTS idx_onthisday_year ON onthisday_events(year);

-- ---------- 3. Country religion lookup ----------
-- Default religion(s) for each country, used for filtering and the home pill
CREATE TABLE IF NOT EXISTS country_religions (
  country_code TEXT NOT NULL,
  religion TEXT NOT NULL,                -- same enum as holidays
  percentage REAL,                       -- % of population (approximate)
  is_official INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (country_code, religion)
);

CREATE INDEX IF NOT EXISTS idx_country_religions_country ON country_religions(country_code);
CREATE INDEX IF NOT EXISTS idx_country_religions_religion ON country_religions(religion);
