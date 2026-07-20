-- ============================================================
-- Phase 2: business_calendars + holiday_rules seed
-- Locked 2026-07-19
-- Reference: docs/architecture/SHARED-DB-PLAN.md
-- ============================================================
--
-- Adds business_calendars for top 15 Nager.Date countries + a handful of
-- rule-based holiday_rules for the most common Western holidays.
--
-- The 5 missing top-20 countries (IN, PK, ET, IR, TH) are skipped because
-- Nager.Date doesn't serve them. We'll add their business_calendars below
-- from Wikipedia/research data.

-- ---------- 1. business_calendars (15 + 5 = 20 countries) ----------
-- Nager.Date covered (15)
INSERT OR REPLACE INTO business_calendars
  (country_code, work_days, work_open_hour, work_close_hour, work_lunch_break_hours,
   lunch_start_hour, friday_close_hour, siesta_countries, source, notes)
VALUES
  ('US', '[1,2,3,4,5]', 9, 17, 1, 12, NULL, 0, 'common', 'Mon-Fri 9-5 with 1hr lunch'),
  ('GB', '[1,2,3,4,5]', 9, 17, 1, 12, NULL, 0, 'common', 'Mon-Fri 9-5'),
  ('JP', '[1,2,3,4,5]', 9, 18, 1, 12, NULL, 0, 'common', 'Mon-Fri 9-18 (longer hours common)'),
  ('CN', '[1,2,3,4,5]', 9, 18, 2, 12, NULL, 0, 'common', 'Mon-Fri 9-18 with 2hr lunch (long lunch common)'),
  ('DE', '[1,2,3,4,5]', 8, 16, 1, 12, NULL, 0, 'common', 'Mon-Fri 8-16 (earlier close common)'),
  ('BR', '[1,2,3,4,5]', 8, 17, 2, 12, 17, 1, 'common', 'Mon-Fri 8-17 with 2hr lunch, some regions have siesta'),
  ('MX', '[1,2,3,4,5]', 8, 17, 2, 14, NULL, 1, 'common', 'Mon-Fri 8-17 with 2hr siesta lunch'),
  ('RU', '[1,2,3,4,5]', 9, 18, 1, 13, NULL, 0, 'common', 'Mon-Fri 9-18'),
  ('ID', '[1,2,3,4,5,6]', 8, 16, 1, 12, NULL, 0, 'common', 'Mon-Sat 8-16 (Saturday half-day common)'),
  ('NG', '[1,2,3,4,5]', 8, 17, 1, 13, NULL, 0, 'common', 'Mon-Fri 8-17'),
  ('BD', '[1,2,3,4,5,6]', 9, 17, 1, 13, NULL, 0, 'common', 'Mon-Sat 9-17 (Friday is half day in some sectors)'),
  ('EG', '[1,2,3,4,5]', 9, 17, 1, 13, NULL, 0, 'common', 'Sun-Thu 9-17 (weekend is Fri+Sat)'),
  ('TR', '[1,2,3,4,5]', 8, 17, 1, 12, NULL, 0, 'common', 'Mon-Fri 8-17'),
  ('VN', '[1,2,3,4,5]', 8, 17, 1, 12, NULL, 0, 'common', 'Mon-Fri 8-17'),
  ('CD', '[1,2,3,4,5]', 8, 17, 1, 12, NULL, 0, 'common', 'Mon-Fri 8-17'),
  ('PH', '[1,2,3,4,5]', 8, 17, 1, 12, NULL, 0, 'common', 'Mon-Fri 8-17'),
  -- Top-20 countries Nager.Date doesn't cover (from research)
  ('IN', '[1,2,3,4,5,6]', 10, 18, 1, 13, 14, 0, 'wikipedia', 'Mon-Sat 10-18, many businesses close early on Saturday'),
  ('PK', '[1,2,3,4,5,6]', 9, 17, 1, 13, 13, 0, 'wikipedia', 'Mon-Sat 9-17, Friday is prayer day with earlier close'),
  ('ET', '[1,2,3,4,5]', 8, 17, 1, 12, NULL, 0, 'wikipedia', 'Mon-Fri 8-17'),
  ('IR', '[1,2,3,4]', 8, 16, 1, 12, NULL, 0, 'wikipedia', 'Sat-Wed 8-16 (Iranian week: Fri=weekend)'),
  ('TH', '[1,2,3,4,5]', 8, 17, 1, 12, NULL, 0, 'wikipedia', 'Mon-Fri 8-17');

-- ---------- 2. holiday_rules (rule-based holidays) ----------
-- These are the holidays that follow patterns rather than fixed dates.
-- Storing the rule lets the API compute the actual date for any year.

INSERT OR REPLACE INTO holiday_rules
  (country_code, name, localized_names, rule_type, rule_definition, observed_rule, description, source)
VALUES
  -- US: nth Monday holidays
  ('US', 'Martin Luther King, Jr. Day', '{"en":"Martin Luther King, Jr. Day"}',
   'nth_weekday', '{"month": 1, "week": 3, "weekday": 1}',
   '{"when_weekday": 0, "shift_to": "next_monday"}',
   '3rd Monday of January',
   'wikipedia:us_federal_holidays'),
  ('US', 'Presidents Day', '{"en":"Presidents Day","local":"Washington''s Birthday"}',
   'nth_weekday', '{"month": 2, "week": 3, "weekday": 1}',
   NULL,
   '3rd Monday of February',
   'wikipedia:us_federal_holidays'),
  ('US', 'Memorial Day', '{"en":"Memorial Day"}',
   'nth_weekday', '{"month": 5, "week": -1, "weekday": 1}',
   NULL,
   'Last Monday of May',
   'wikipedia:us_federal_holidays'),
  ('US', 'Labor Day', '{"en":"Labor Day"}',
   'nth_weekday', '{"month": 9, "week": 1, "weekday": 1}',
   NULL,
   '1st Monday of September',
   'wikipedia:us_federal_holidays'),
  ('US', 'Columbus Day', '{"en":"Columbus Day"}',
   'nth_weekday', '{"month": 10, "week": 2, "weekday": 1}',
   NULL,
   '2nd Monday of October',
   'wikipedia:us_federal_holidays'),
  ('US', 'Thanksgiving', '{"en":"Thanksgiving"}',
   'nth_weekday', '{"month": 11, "week": 4, "weekday": 4}',
   NULL,
   '4th Thursday of November',
   'wikipedia:us_federal_holidays'),

  -- GB: Easter-based
  ('GB', 'Good Friday', '{"en":"Good Friday"}',
   'easter_offset', '{"offset_days": -2}',
   NULL,
   '2 days before Easter Sunday',
   'wikipedia:uk_bank_holidays'),
  ('GB', 'Easter Monday', '{"en":"Easter Monday"}',
   'easter_offset', '{"offset_days": 1}',
   NULL,
   'Day after Easter Sunday',
   'wikipedia:uk_bank_holidays'),
  ('GB', 'Early May Bank Holiday', '{"en":"Early May Bank Holiday"}',
   'nth_weekday', '{"month": 5, "week": 1, "weekday": 1}',
   NULL,
   '1st Monday of May',
   'wikipedia:uk_bank_holidays'),
  ('GB', 'Spring Bank Holiday', '{"en":"Spring Bank Holiday"}',
   'nth_weekday', '{"month": 5, "week": -1, "weekday": 1}',
   NULL,
   'Last Monday of May',
   'wikipedia:uk_bank_holidays'),
  ('GB', 'Summer Bank Holiday', '{"en":"Summer Bank Holiday"}',
   'nth_weekday', '{"month": 8, "week": -1, "weekday": 1}',
   NULL,
   'Last Monday of August',
   'wikipedia:uk_bank_holidays');

-- ============================================================
-- Verification:
--
--   SELECT COUNT(*) FROM business_calendars;            -- ~20
--   SELECT country_code, work_days, work_open_hour, work_close_hour FROM business_calendars;
--   SELECT * FROM holiday_rules WHERE country_code = 'US';
-- ============================================================
