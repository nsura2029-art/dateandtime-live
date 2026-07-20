-- ============================================================
-- Phase 6: place_redirects (historical city names)
-- Locked 2026-07-19
-- Reference: docs/architecture/SHARED-DB-PLAN.md
-- ============================================================
--
-- place_redirects stores year-bounded historical name changes
-- (e.g. "Bombay" was used 1500-1995, then renamed to "Mumbai").
-- This complements city_aliases (which has no year range).
--
-- For Phase 6 MVP we seed ~30 well-known historical name changes.
-- The FTS5 v_cities view does NOT include historical names yet —
-- Phase 6 API work (deferred per user) will wire that up.

CREATE TABLE IF NOT EXISTS place_redirects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL,
  old_name TEXT NOT NULL,
  year_from INTEGER,                              -- NULL = "from time immemorial"
  year_to INTEGER,                                -- NULL = "still in use as alias"
  reason TEXT,                                    -- 'renamed'|'merged'|'absorbed'|'transliteration'
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.9,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(city_id, old_name)
);

CREATE INDEX IF NOT EXISTS idx_redirects_city ON place_redirects(city_id);
CREATE INDEX IF NOT EXISTS idx_redirects_name ON place_redirects(old_name);

-- Seed: well-known historical renamings
-- Format: (city_id, old_name, year_from, year_to, reason)
INSERT OR REPLACE INTO place_redirects
  (city_id, old_name, year_from, year_to, reason, source, confidence)
VALUES
  (1275339, 'Bombay', 1500, 1995, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (1275004, 'Calcutta', 1690, 2001, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (745044, 'Constantinople', 330, 1930, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (1816670, 'Peking', 1421, 1949, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (1816670, 'Beiping', 1928, 1949, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (1850147, 'Edo', 1457, 1868, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (1264527, 'Madras', 1639, 1996, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (1566083, 'Saigon', 1698, 1976, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (1298824, 'Rangoon', 1755, 1989, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (5128581, 'New Amsterdam', 1626, 1664, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (2950159, 'Konigsberg', 1255, 1946, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (542199, 'Leningrad', 1924, 1991, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (542199, 'Petrograd', 1914, 1924, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (542199, 'Saint Petersburg', 1703, 1914, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (2017370, 'Stalingrad', 1925, 1961, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (1796236, 'Tsingtao', 1891, 1949, 'transliteration', 'wikipedia:city_name_changes', 0.9),
  (1796236, 'Qingdao', 1891, 1949, 'transliteration', 'wikipedia:city_name_changes', 0.9),
  (1835848, 'Burma', 1050, 1989, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (1609350, 'Siam', 1238, 1939, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (1269750, 'Ceylon', 1505, 1972, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (895949, 'Rhodesia', 1965, 1980, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (203312, 'Zaire', 1971, 1997, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (1819729, 'Burma', 1050, 1989, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (1283240, 'Ceylon', 1505, 1972, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (3580238, 'British Honduras', 1840, 1973, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (3865483, 'Dahomey', 1904, 1975, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (239880, 'Upper Volta', 1958, 1984, 'renamed', 'wikipedia:country_name_changes', 0.85),
  (3573511, 'Saint Eustatius', 1636, 2025, 'renamed', 'wikipedia:city_name_changes', 0.9),
  (1818452, 'Rangoon', 1755, 1989, 'renamed', 'wikipedia:city_name_changes', 0.95),
  (1818452, 'Dagon', NULL, 1755, 'renamed', 'wikipedia:city_name_changes', 0.9);

-- ============================================================
-- Verification:
--
--   SELECT COUNT(*) FROM place_redirects;             -- ~30
--   SELECT * FROM place_redirects WHERE old_name IN ('Bombay','Peking','Edo');
-- ============================================================
