#!/usr/bin/env python3
"""
Phase 8: Bulk-import cities15000.zip from GeoNames to fill the tier 3+4 gap.

Source: https://download.geonames.org/export/dump/cities15000.zip
~34,025 cities with population ≥ 15,000 OR capital cities.

Uses INSERT OR IGNORE so re-runs are safe. The existing 5,081 cities
will not be overwritten.

Per D1 HTTP API limits:
- 14 cols * 7 rows = 98 vars (under 100 var limit)
- ~4,861 batches at ~50ms each = ~4 minutes total

Usage:
  python3 seed/cities15000.py
"""

import json
import os
import sys
import urllib.request

CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
if not CF_TOKEN:
  print("ERROR: CLOUDFLARE_API_TOKEN env var required", file=sys.stderr)
  sys.exit(1)

ACCOUNT = "f0de6c4b68becd81e60507ecf9410199"
DB = "c401ffb6-51db-49e6-991f-b5695f9e6a7d"

CITIES_FILE = "/tmp/cities15000/cities15000.txt"
BATCH_SIZE = 7  # 14 cols * 7 = 98 vars
SOURCE = "geonames:cities15000:2026-07-19"


def d1_query(sql, params=None):
  body = {"sql": sql}
  if params:
    body["params"] = params
  req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
    data=json.dumps(body).encode("utf-8"),
    headers={"Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"},
    method="POST",
  )
  try:
    with urllib.request.urlopen(req, timeout=30) as r:
      return json.load(r)
  except urllib.error.HTTPError as e:
    body_text = e.read().decode("utf-8", errors="ignore")
    print(f"  HTTP {e.code}: {body_text[:200]}", file=sys.stderr)
    return {"success": False, "errors": [{"code": e.code, "message": body_text}]}


def cache_countries():
  """Load all (cca2, name) into a dict for fast lookup."""
  result = d1_query("SELECT cca2, name FROM countries")
  if not result.get("success"):
    return {}
  countries = {}
  for row in result.get("result", [{}])[0].get("results", []):
    countries[row.get("cca2")] = row.get("name")
  print(f"  cached {len(countries)} country names")
  return countries


def parse_cities15000_file():
  """Parse the GeoNames cities15000.txt file. Returns a list of dicts.

  Format (tab-separated, 19 cols):
    0  geonameid
    1  name
    2  asciiname
    3  alternatenames
    4  latitude
    5  longitude
    6  feature_class
    7  feature_code
    8  country_code (cca2)
    9  cc2 (alternate country codes, comma-sep)
    10 admin1_code
    11 admin2_code
    12 admin3_code
    13 admin4_code
    14 population
    15 elevation
    16 dem (digital elevation model)
    17 timezone
    18 modification_date
  """
  rows = []
  if not os.path.exists(CITIES_FILE):
    print(f"  ERROR: {CITIES_FILE} not found. Run: curl -L -o /tmp/cities15000.zip https://download.geonames.org/export/dump/cities15000.zip && unzip -d /tmp/cities15000 /tmp/cities15000.zip")
    sys.exit(1)
  with open(CITIES_FILE, encoding="utf-8") as f:
    for line in f:
      parts = line.rstrip("\n").split("\t")
      if len(parts) < 19:
        continue
      try:
        # Skip rows with empty population (rare)
        pop = int(parts[14]) if parts[14] else 0
        if pop <= 0:
          continue
        rows.append({
          "geoname_id": int(parts[0]),
          "name": parts[1],
          "ascii_name": parts[2],
          "country_code": parts[8],
          "admin1_code": parts[10] or None,
          "admin2_code": parts[11] or None,
          "latitude": float(parts[4]),
          "longitude": float(parts[5]),
          "feature_code": parts[7] or None,
          "population": pop,
          "elevation": int(parts[15]) if parts[15] else None,
          "timezone": parts[17] or None,
        })
      except (ValueError, IndexError) as e:
        print(f"  skip malformed: {e}", file=sys.stderr)
  return rows


def insert_batch(chunk, country_lookup):
  """Insert a batch of cities. Look up country_name from cache."""
  values_sql = ",".join(["(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"] * len(chunk))
  params = []
  for r in chunk:
    params.extend([
      r["geoname_id"],
      r["name"],
      r["ascii_name"],
      r["country_code"],
      country_lookup.get(r["country_code"], ""),  # country_name
      r["admin1_code"],
      r["admin2_code"],
      r["latitude"],
      r["longitude"],
      r["timezone"],
      r["population"],
      r["elevation"],
      r["feature_code"],
      1 if r["feature_code"] in ("PPLC", "PPLA") else 0,  # is_capital heuristic
    ])
  sql = f"""INSERT OR IGNORE INTO cities
    (geoname_id, name, ascii_name, country_code, country_name,
     admin1_code, admin2_code, latitude, longitude, timezone,
     population, elevation, feature_code, is_capital)
    VALUES {values_sql}"""
  return d1_query(sql, params)


def main():
  print("=== Phase 8: cities15000 bulk import ===\n")

  # Cache country names
  print("Loading country cache...")
  country_lookup = cache_countries()

  # Parse the file
  print(f"Reading {CITIES_FILE}...")
  all_rows = parse_cities15000_file()
  print(f"  parsed {len(all_rows)} cities (pop > 0)")

  # Insert in batches
  total_inserted = 0
  total_batches = (len(all_rows) + BATCH_SIZE - 1) // BATCH_SIZE
  print(f"\nInserting in {total_batches} batches of {BATCH_SIZE}...")
  for i in range(0, len(all_rows), BATCH_SIZE):
    chunk = all_rows[i:i + BATCH_SIZE]
    result = insert_batch(chunk, country_lookup)
    if result.get("success"):
      # Get the actual change count
      changes = result.get("result", [{}])[0].get("meta", {}).get("changes", 0)
      total_inserted += changes
    else:
      print(f"  ✗ batch {i // BATCH_SIZE} failed: {result.get('errors', [])[:1]}")

    # Progress log every 100 batches
    batch_num = i // BATCH_SIZE + 1
    if batch_num % 100 == 0:
      print(f"  ... batch {batch_num}/{total_batches}, inserted {total_inserted:,}")

  print(f"\n✅ Inserted {total_inserted:,} new cities (skipped {len(all_rows) - total_inserted:,} duplicates)")

  # Update meta.cities_source
  print("\nUpdating meta.cities_source...")
  result = d1_query(
    "UPDATE meta SET value = ?, updated_at = ? WHERE key = 'cities_source'",
    [f"GeoNames cities5000.zip (top 5,081) + cities15000.zip (~{total_inserted:,} added 2026-07-19)", int(__import__('time').time())]
  )
  if result.get("success"):
    print("  ✅ meta updated")
  else:
    print(f"  ✗ meta update failed: {result.get('errors', [])[:1]}")

  # Add to import_history
  print("\nAdding to import_history...")
  result = d1_query(
    """INSERT INTO import_history
       (source_id, imported_at, rows_imported, rows_failed, rows_updated, duration_ms, notes)
       VALUES ('geonames', datetime('now'), ?, 0, 0, ?, 'Phase 8: cities15000.zip — tier 3+4 cities and villages around major metros')""",
    [total_inserted, int(__import__('time').time())]
  )
  if result.get("success"):
    print("  ✅ import_history updated")
  else:
    print(f"  ✗ import_history failed: {result.get('errors', [])[:1]}")


if __name__ == "__main__":
  main()
