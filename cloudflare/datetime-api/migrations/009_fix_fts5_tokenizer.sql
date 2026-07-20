-- ============================================================
-- Phase 8 fix: drop Porter stemmer from cities_fts tokenizer
-- Locked 2026-07-19
--
-- The Porter stemmer (e.g. "paris" → "pari") caused the search to match
-- random substrings like "Pariyāpuram" when the user searched "paris".
-- The stemmer is too aggressive for city names.
--
-- We drop and recreate the FTS5 table without Porter. The "unicode61
-- remove_diacritics 2" parts stay (so "munchen" still matches "München"
-- and "sao paulo" still matches "São Paulo").
--
-- Trade-off: stemming helped match plurals ("city" → "cities"). For
-- city names, that's a non-issue (people don't search "Berlin" expecting
-- "Berliner" to match). The next migration adds server-side deduplication
-- and ranking to compensate.
-- ============================================================

DROP TABLE IF EXISTS cities_fts;

CREATE VIRTUAL TABLE cities_fts USING fts5(
  name, ascii_name, country_name, aliases,
  content='v_cities', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- Repopulate from v_cities view
INSERT INTO cities_fts(cities_fts) VALUES('rebuild');
