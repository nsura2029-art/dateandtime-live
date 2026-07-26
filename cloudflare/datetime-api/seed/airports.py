#!/usr/bin/env python3
"""
Seed airports + city_airports tables from OurAirports data.

Inputs:
  - data/airports.csv (OurAirports)
  - D1 cities table (33,945 cities via /api/v1/cities/all)

Outputs:
  - airports table: ~5,300 large/medium airports (+ small w/ IATA)
  - city_airports table: top 5 nearest airports per city (~170K rows)

Usage:
  API=https://datetime-api-dev.nsura2029.workers.dev python3 seed/airports.py
  (uses env API to fetch cities; if not set, reads from data/cities.json)
"""
import csv
import json
import math
import os
import sys
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
AIRPORTS_CSV = DATA_DIR / "airports.csv"
CITIES_JSON = DATA_DIR / "cities.json"

# ============================================================================
# Haversine
# ============================================================================
EARTH_RADIUS_KM = 6371.0

def haversine_km(lat1, lon1, lat2, lon2):
    """Distance between two points on Earth in km."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_KM * c


# ============================================================================
# Step 1: Parse airports.csv
# ============================================================================
def load_airports():
    """Returns list of dicts: {id, iata, icao, name, city, country, lat, lon, type, elev, size_rank}"""
    airports = []
    with open(AIRPORTS_CSV) as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Filter: only large/medium airports, OR small with IATA code
            t = row.get('type', '')
            iata = (row.get('iata_code') or '').strip() or None
            if t == 'large_airport':
                size_rank = 0
            elif t == 'medium_airport':
                size_rank = 1
            elif t == 'small_airport' and iata:
                size_rank = 2
            else:
                continue  # skip heliports, seaplanes, closed, small w/o IATA
            try:
                lat = float(row['latitude_deg'])
                lon = float(row['longitude_deg'])
            except (ValueError, TypeError):
                continue
            try:
                elev = int(row.get('elevation_ft') or 0)
            except ValueError:
                elev = 0
            airports.append({
                'id': int(row['id']),
                'iata': iata,
                'icao': (row.get('icao_code') or '').strip() or None,
                'name': (row.get('name') or '').strip(),
                'city': (row.get('municipality') or '').strip(),
                'country': (row.get('iso_country') or '').strip(),
                'lat': lat,
                'lon': lon,
                'type': t,
                'elev': elev,
                'size_rank': size_rank,
            })
    return airports


# ============================================================================
# Step 2: Fetch cities
# ============================================================================
def load_cities():
    """Load cities from data/cities.json (33K)."""
    if CITIES_JSON.exists():
        print(f"  Reading from {CITIES_JSON}")
        with open(CITIES_JSON) as f:
            return json.load(f)
    # Fetch from API: iterate per-country since /cities/all needs ?country=
    api = os.environ.get('API') or os.environ.get('CITIES_API') or 'https://datetime-api-dev.nsura2029.workers.dev'
    print(f"  Fetching from {api}/api/v1/cities/all?country=XX (iterating countries)")
    # First get the list of countries
    countries_url = f"{api}/api/v1/countries?limit=300"
    try:
        req = urllib.request.Request(countries_url, headers={'User-Agent': 'airports-seed/1.0 (cloudflare-d1)'})
        with urllib.request.urlopen(req, timeout=30) as r:
            cd = json.loads(r.read())
        countries = (cd.get('data') or {}).get('countries') or cd.get('countries') or []
        if not countries:
            # Try other shape
            countries = cd.get('data') if isinstance(cd.get('data'), list) else []
    except Exception as e:
        print(f"  Could not fetch countries list: {e}. Falling back to hardcoded list.")
        countries = []
    print(f"  Got {len(countries)} countries")
    cities = []
    for i, co in enumerate(countries):
        cca2 = co.get('cca2') or co.get('code') or co.get('iso2')
        if not cca2:
            continue
        if i % 25 == 0:
            print(f"  [{i}/{len(countries)}] Fetching {cca2}...")
        try:
            url = f"{api}/api/v1/cities/all?country={cca2}"
            req = urllib.request.Request(url, headers={'User-Agent': 'airports-seed/1.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read())
            batch = (d.get('data') or {}).get('cities', [])
            cities.extend(batch)
        except Exception as e:
            print(f"  Failed {cca2}: {e}")
    print(f"  Got {len(cities)} cities total")
    # Cache to disk
    with open(CITIES_JSON, 'w') as f:
        json.dump(cities, f)
    return cities


# ============================================================================
# Step 3: Spatial index for airports (coarse grid for fast lookup)
# ============================================================================
# Grid spacing: 5° lat × 5° lon = ~555 km. Each cell holds airports in that
# rectangle. For a city, we only need to check the cell + 8 neighbors = 9 cells
# to find nearest airports within ~1500 km. This is much faster than O(N*M).
GRID_DEG = 5.0

def build_spatial_index(airports):
    """Returns dict[(cell_lat, cell_lon)] -> [airport]"""
    index = defaultdict(list)
    for a in airports:
        cl = int(a['lat'] // GRID_DEG)
        co = int(a['lon'] // GRID_DEG)
        index[(cl, co)].append(a)
    return index


def nearest_n_airports(city, airports, index, n=5, max_km=500):
    """Find N nearest airports to city, filtered to within max_km."""
    cl = int(city['latitude'] // GRID_DEG)
    co = int(city['longitude'] // GRID_DEG)
    candidates = []
    for dlat in (-1, 0, 1):
        for dlon in (-1, 0, 1):
            candidates.extend(index.get((cl + dlat, co + dlon), []))
    if not candidates:
        # Fallback: scan all airports (only for cities in extreme poles)
        candidates = airports
    dists = []
    for a in candidates:
        d = haversine_km(city['latitude'], city['longitude'], a['lat'], a['lon'])
        if d <= max_km:
            dists.append((d, a))
    dists.sort(key=lambda x: (x[0], x[1]['size_rank']))
    return dists[:n]


# ============================================================================
# Step 4: Generate SQL batches
# ============================================================================
def gen_airports_sql(airports, batch_size=16):
    """11-col inserts. Outputs SQL with literal values (no ? placeholders)
    so it can be applied via `wrangler d1 execute --file=...` without bindings."""
    BATCH = 9
    def fmt(v):
        if v is None:
            return 'NULL'
        if isinstance(v, str):
            return "'" + v.replace("'", "''") + "'"
        return str(v)
    for i in range(0, len(airports), BATCH):
        batch = airports[i:i+BATCH]
        rows = []
        for a in batch:
            rows.append('(' + ','.join([
                fmt(a['id']), fmt(a['iata']), fmt(a['icao']), fmt(a['name']),
                fmt(a['city']), fmt(a['country']),
                fmt(a['lat']), fmt(a['lon']),
                fmt(a['type']), fmt(a['elev']), fmt(a['size_rank'])
            ]) + ')')
        yield f"INSERT OR REPLACE INTO airports (id, iata, icao, name, city, country_code, latitude, longitude, type, elevation_ft, size_rank) VALUES {','.join(rows)};", []


def gen_city_airports_sql(pairs, batch_size=50):
    """4-col. Literal values, no ? placeholders. BATCH=25 (100 vars)."""
    BATCH = 25
    def fmt(v):
        if v is None: return 'NULL'
        if isinstance(v, str): return "'" + v.replace("'", "''") + "'"
        return str(v)
    for i in range(0, len(pairs), BATCH):
        batch = pairs[i:i+BATCH]
        rows = []
        for cid, rank, aid, dist in batch:
            rows.append('(' + ','.join([fmt(cid), fmt(rank), fmt(aid), fmt(dist)]) + ')')
        yield f"INSERT OR REPLACE INTO city_airports (city_id, rank, airport_id, distance_km) VALUES {','.join(rows)};", []


# ============================================================================
# Main
# ============================================================================
def main():
    print(f"📦 Loading airports from {AIRPORTS_CSV}...")
    airports = load_airports()
    print(f"  → {len(airports)} large/medium/small-IATA airports")
    
    # Skip cities if we have a cached version
    if not CITIES_JSON.exists():
        print(f"\n📦 Loading cities...")
        cities = load_cities()
        print(f"  → {len(cities)} cities")
    else:
        with open(CITIES_JSON) as f:
            cities = json.load(f)
        print(f"\n📦 Using cached cities: {len(cities)}")
    
    # Build spatial index
    print(f"\n🔍 Building spatial index...")
    index = build_spatial_index(airports)
    print(f"  → {len(index)} grid cells")
    
    # Compute nearest airports for each city
    print(f"\n🔢 Computing nearest 5 airports per city...")
    city_airport_pairs = []
    skipped = 0
    for i, city in enumerate(cities):
        if i % 5000 == 0 and i > 0:
            print(f"  {i}/{len(cities)} cities processed, {len(city_airport_pairs)} pairs so far...")
        lat = city.get('latitude')
        lon = city.get('longitude')
        if lat is None or lon is None:
            skipped += 1
            continue
        # Normalize: prod API uses 'latitude'/'longitude', some may use 'lat'/'lon'
        if 'lat' in city and lat is None:
            lat = city['lat']
            lon = city['lon']
        nearest = nearest_n_airports({'latitude': lat, 'longitude': lon}, airports, index, n=5, max_km=300)
        city_id = city.get('id') or city.get('city_id')
        if not city_id:
            skipped += 1
            continue
        for rank, (dist, a) in enumerate(nearest, 1):
            city_airport_pairs.append((city_id, rank, a['id'], dist))
    print(f"  → {len(city_airport_pairs)} city-airport pairs ({skipped} cities skipped)")
    
    # Generate SQL output
    out_dir = DATA_DIR / "sql"
    out_dir.mkdir(exist_ok=True)
    
    print(f"\n💾 Writing airports SQL...")
    a_sql = out_dir / "airports.sql"
    with open(a_sql, 'w') as f:
        for sql, params in gen_airports_sql(airports):
            f.write(sql + '\n')
    print(f"  → {a_sql}")
    
    print(f"\n💾 Writing city_airports SQL...")
    ca_sql = out_dir / "city_airports.sql"
    with open(ca_sql, 'w') as f:
        for sql, params in gen_city_airports_sql(city_airport_pairs):
            f.write(sql + '\n')
    print(f"  → {ca_sql}")
    
    # Stats
    print(f"\n📊 Stats:")
    avg_dist = sum(d for _, _, _, d in city_airport_pairs) / len(city_airport_pairs) if city_airport_pairs else 0
    no_match = len(cities) - len(set(c[0] for c in city_airport_pairs))
    print(f"  Avg nearest-airport distance: {avg_dist:.1f} km")
    print(f"  Cities with no airport within 300 km: {no_match}")
    
    print(f"\n✅ Done. Now run:")
    print(f"  cd cloudflare/datetime-api")
    print(f"  wrangler d1 execute timeandtimepro-dev --file=data/sql/airports.sql --remote")
    print(f"  wrangler d1 execute timeandtimepro-dev --file=data/sql/city_airports.sql --remote")


if __name__ == "__main__":
    main()
