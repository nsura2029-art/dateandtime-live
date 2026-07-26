-- Migration 013: Airports
-- Adds airports + city_airports tables to power "Airports near {City}"
-- sections on every city page (Tier 3 of the world-time-hub roadmap).
--
-- Data source: OurAirports (public domain, no attribution required)
--   https://ourairports.com/data/
--   - airports.csv — 85,806 entries (large/medium/small/heliport/seaplane/balloonport/closed)
--   - We filter to type IN ('large_airport', 'medium_airport') plus
--     small_airports with an IATA code = ~5,300 rows.
--
-- Strategy:
--   1. airports table: global airport registry (IATA, ICAO, name, city,
--      country, lat, lon, type, elevation).
--   2. city_airports join: pre-computed nearest 3-5 airports for each
--      city in the cities table. Computed once at seed time, never
--      changes (unless city coords change, which is rare).
--
-- Why pre-compute:
--   - D1 doesn't have trig functions (sin/cos/acos) for haversine
--   - 33,945 cities × 5,000 airports = 170M comparisons, too slow at
--     query time
--   - Pre-computing once = simple SELECT JOIN at query time, fast
--   - Total rows: 33,945 × 5 = 170K, well within D1 limits
--
-- Distance: haversine on WGS84 sphere (6371 km radius)

CREATE TABLE IF NOT EXISTS airports (
  id            INTEGER PRIMARY KEY,
  iata          TEXT,           -- 3-letter IATA code (e.g. 'JFK'), nullable
  icao          TEXT,           -- 4-letter ICAO code (e.g. 'KJFK'), nullable
  name          TEXT NOT NULL,
  city          TEXT,           -- municipality from OurAirports
  country_code  TEXT,           -- 2-letter ISO country (e.g. 'US')
  latitude      REAL NOT NULL,
  longitude     REAL NOT NULL,
  type          TEXT NOT NULL,  -- 'large_airport' | 'medium_airport' | 'small_airport' | ...
  elevation_ft  INTEGER,
  size_rank     INTEGER NOT NULL DEFAULT 3  -- 0=large, 1=medium, 2=small w/ IATA, 3=other
);

CREATE INDEX IF NOT EXISTS idx_airports_iata ON airports(iata);
CREATE INDEX IF NOT EXISTS idx_airports_icao ON airports(icao);
CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(country_code);
CREATE INDEX IF NOT EXISTS idx_airports_size ON airports(size_rank);
CREATE INDEX IF NOT EXISTS idx_airports_lat_lon ON airports(latitude, longitude);

-- city_airports: pre-computed nearest 5 airports per city.
-- rank 1 = closest, 5 = furthest of the top 5.
CREATE TABLE IF NOT EXISTS city_airports (
  city_id       INTEGER NOT NULL,
  rank          INTEGER NOT NULL,   -- 1-5
  airport_id    INTEGER NOT NULL,
  distance_km   REAL NOT NULL,       -- haversine distance
  PRIMARY KEY (city_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_city_airports_airport ON city_airports(airport_id);
