#!/usr/bin/env python3
"""
Faster Phase 8 climate+seasons re-seed: parallel inserts with
ThreadPoolExecutor to overcome the D1 HTTP API latency.

Schema reference:
- climate_summaries: 11 cols (UNIQUE on city_id+month, so re-runs are safe)
- seasons: 6 cols (UNIQUE on city_id+season)

Climate: 11 cols x 9 rows = 99 vars (just under 100)
Seasons: 6 cols x 16 rows = 96 vars
"""

import json
import math
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
if not CF_TOKEN:
  print("ERROR: CLOUDFLARE_API_TOKEN env var required", file=sys.stderr)
  sys.exit(1)

ACCOUNT = "f0de6c4b68becd81e60507ecf9410199"
DB = "c401ffb6-51db-49e6-991f-b5695f9e6a7d"
SOURCE = "model:v1.0"
CONFIDENCE = 0.7
MAX_WORKERS = 8  # parallel D1 HTTP calls


def d1_query(sql, params=None):
  body = {"sql": sql, "params": params or []}
  req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
    data=json.dumps(body).encode("utf-8"),
    headers={"Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"},
    method="POST",
  )
  try:
    with urllib.request.urlopen(req, timeout=60) as r:
      return json.load(r)
  except urllib.error.HTTPError as e:
    body_text = e.read().decode("utf-8", errors="ignore")
    return {"success": False, "errors": [{"code": e.code, "message": body_text[:200]}]}


def climate_class(lat):
  abs_lat = abs(lat)
  if abs_lat > 66: return "polar"
  if abs_lat > 45: return "continental"
  if abs_lat > 23.5: return "temperate"
  return "tropical"


def monthly_temp(lat, climate, month):
  is_north = lat >= 0
  if is_north:
    seasonal = math.cos(2 * math.pi * (month - 7) / 12)
  else:
    seasonal = math.cos(2 * math.pi * (month - 1) / 12)
  if climate == "tropical":   base, amp = 27, 2
  elif climate == "temperate": base, amp = 12, 10
  elif climate == "continental": base, amp = 5, 18
  elif climate == "polar":    base, amp = -10, 20
  else:                        base, amp = 22, 12
  mean = base + seasonal * amp
  return mean + 6, mean, mean - 6


def monthly_daylight(lat, month):
  day_of_year = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1]
  decl = 23.45 * math.sin(2 * math.pi * (284 + day_of_year) / 365)
  lat_rad, decl_rad = math.radians(lat), math.radians(decl)
  cos_h = max(-1, min(1, -math.tan(lat_rad) * math.tan(decl_rad)))
  h = math.degrees(math.acos(cos_h))
  return max(0, min(24, 2 * h / 15))


def monthly_rain(climate):
  if climate == "tropical":    return 12, 15.0
  if climate == "temperate":   return 10, 70.0
  if climate == "continental": return 8, 50.0
  if climate == "polar":       return 6, 20.0
  return 2, 10.0


def get_seasons(climate, is_north, mean):
  if climate in ("temperate", "continental"):
    return [
      ("spring", 3, 5, round(mean, 1)),
      ("summer", 6, 8, round(mean + 5, 1)),
      ("autumn", 9, 11, round(mean, 1)),
      ("winter", 12, 2, round(mean - 5, 1)),
    ]
  if climate == "tropical":
    return [
      ("rainy", 5 if is_north else 11, 10 if is_north else 4, round(mean, 1)),
      ("dry",   11 if is_north else 5,  4 if is_north else 10, round(mean + 2, 1)),
    ]
  if climate == "polar":
    return [
      ("summer", 6, 8, round(mean + 5, 1)),
      ("winter", 11, 3, round(mean - 10, 1)),
    ]
  return [
    ("summer", 5, 9, round(mean + 8, 1)),
    ("winter", 11, 3, round(mean - 5, 1)),
  ]


def main():
  print("=== Phase 8 fast climate+seasons seed ===\n")

  # Get only cities WITHOUT climate data
  print("Fetching cities without climate data...")
  result = d1_query("""
    SELECT c.geoname_id, c.latitude, c.longitude
    FROM cities c
    LEFT JOIN (
      SELECT DISTINCT city_id FROM climate_summaries
    ) cs ON c.geoname_id = cs.city_id
    WHERE cs.city_id IS NULL
      AND c.latitude IS NOT NULL
      AND c.longitude IS NOT NULL
  """)
  if not result.get("success"):
    print(f"Failed: {result.get('errors', [])[:1]}")
    return
  cities = result.get("result", [{}])[0].get("results", [])
  print(f"  Found {len(cities)} cities without climate data")
  if not cities:
    print("  Nothing to do!")
    return

  # Generate rows
  print("Generating rows in memory...")
  climate_rows = []
  season_rows = []
  for city in cities:
    cid = city["geoname_id"]
    lat = city["latitude"]
    lon = city["longitude"]
    climate = climate_class(lat)
    is_north = lat >= 0
    rainy_days, precip = monthly_rain(climate)

    for month in range(1, 13):
      high, mean, low = monthly_temp(lat, climate, month)
      daylight = monthly_daylight(lat, month)
      climate_rows.append([
        cid, month, round(high, 1), round(low, 1), round(mean, 1),
        rainy_days, precip, round(daylight, 2),
        climate, SOURCE, CONFIDENCE,
      ])

    for s_name, start, end, s_mean in get_seasons(climate, is_north, mean):
      season_rows.append([cid, s_name, start, end, s_mean, SOURCE])

  print(f"  {len(climate_rows)} climate rows, {len(season_rows)} season rows")

  # Climate: 11 cols x 9 rows = 99 vars
  CLIMATE_BATCH = 9
  # Seasons: 6 cols x 16 rows = 96 vars
  SEASONS_BATCH = 16

  def insert_climate_chunk(chunk):
    values_sql = ",".join(["(?,?,?,?,?,?,?,?,?,?,?)"] * len(chunk))
    params = [v for row in chunk for v in row]
    sql = f"""INSERT OR IGNORE INTO climate_summaries
      (city_id, month, avg_high_c, avg_low_c, avg_mean_c, rainy_days,
       avg_precipitation_mm, daylight_hours, climate_class, source, confidence)
      VALUES {values_sql}"""
    return d1_query(sql, params)

  def insert_seasons_chunk(chunk):
    values_sql = ",".join(["(?,?,?,?,?,?)"] * len(chunk))
    params = [v for row in chunk for v in row]
    sql = f"""INSERT OR IGNORE INTO seasons
      (city_id, season, start_month, end_month, avg_temp_c, source)
      VALUES {values_sql}"""
    return d1_query(sql, params)

  # Climate (parallel)
  print(f"\nInserting climate ({CLIMATE_BATCH}/batch, {MAX_WORKERS} workers)...")
  chunks = [climate_rows[i:i+CLIMATE_BATCH] for i in range(0, len(climate_rows), CLIMATE_BATCH)]
  done, failed = 0, 0
  with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
    futures = [ex.submit(insert_climate_chunk, c) for c in chunks]
    for fut in as_completed(futures):
      r = fut.result()
      done += 1
      if not r.get("success"):
        failed += 1
      if done % 200 == 0:
        print(f"  ... {done}/{len(chunks)}, failed={failed}")
  print(f"  climate: {done - failed}/{done} succeeded")

  # Seasons (parallel)
  print(f"\nInserting seasons ({SEASONS_BATCH}/batch, {MAX_WORKERS} workers)...")
  chunks = [season_rows[i:i+SEASONS_BATCH] for i in range(0, len(season_rows), SEASONS_BATCH)]
  done, failed = 0, 0
  with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
    futures = [ex.submit(insert_seasons_chunk, c) for c in chunks]
    for fut in as_completed(futures):
      r = fut.result()
      done += 1
      if not r.get("success"):
        failed += 1
      if done % 200 == 0:
        print(f"  ... {done}/{len(chunks)}, failed={failed}")
  print(f"  seasons: {done - failed}/{done} succeeded")


if __name__ == "__main__":
  main()
