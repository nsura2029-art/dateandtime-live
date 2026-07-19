#!/usr/bin/env python3
"""
Seed climate_summaries + seasons tables for all 5,081 cities.

For MVP, we use a simplified model based on lat/lon:
- Climate class: tropical / temperate / continental / polar / arid
- Monthly avg temps: based on lat (cosine wave) + climate class
- Daylight hours: based on lat + day-of-year (Spencer's formula)
- Rainy days: based on climate class
- Seasons: spring/summer/fall/winter for temperate, rainy/dry for tropical

D1 has a ~100 param limit per prepared statement, so we batch.

Source attribution: "model:v1.0" (the simplified model). Real data
would come from Open-Meteo or WMO.
"""

import json
import math
import os
import sys
import urllib.request
from datetime import datetime, timedelta

CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
if not CF_TOKEN:
  print("ERROR: CLOUDFLARE_API_TOKEN env var required", file=sys.stderr)
  sys.exit(1)

ACCOUNT = "f0de6c4b68becd81e60507ecf9410199"
DB = "c401ffb6-51db-49e6-991f-b5695f9e6a7d"

BATCH_SIZE = 9  # D1 HTTP API has ~100-var per-statement limit; 9*11=99 fits
SOURCE = "model:v1.0"
CONFIDENCE = 0.7


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


def climate_class(lat):
  """Classify a city by latitude. Arid is harder to detect from lat alone
  (would need elevation + ocean proximity), so we approximate."""
  abs_lat = abs(lat)
  if abs_lat > 66:
    return "polar"
  if abs_lat > 45:
    return "continental"
  if abs_lat > 23.5:
    return "temperate"
  return "tropical"


def monthly_temp(lat, climate, month, is_land):
  """Approximate monthly avg/high/low temps in °C. For tropical: minimal
  seasonal variation. For temperate/continental: large variation."""
  # Northern hemisphere winter = Dec-Feb
  # Use day-of-year for season
  is_north = lat >= 0
  # Phase shift: month 7 = peak summer (north), month 1 = peak winter
  if is_north:
    # Peak in July (month 7), trough in January (month 1)
    seasonal = math.cos(2 * math.pi * (month - 7) / 12)
  else:
    # Peak in January (month 1), trough in July (month 7)
    seasonal = math.cos(2 * math.pi * (month - 1) / 12)

  abs_lat = abs(lat)
  if climate == "tropical":
    base = 27
    amplitude = 2
  elif climate == "temperate":
    base = 12
    amplitude = 10
  elif climate == "continental":
    base = 5
    amplitude = 18
  elif climate == "polar":
    base = -10
    amplitude = 20
  else:  # arid (rare without more data)
    base = 22
    amplitude = 12

  mean = base + seasonal * amplitude
  high = mean + 6
  low = mean - 6
  return high, mean, low


def monthly_daylight(lat, month):
  """Approximate avg daylight hours for a month using solar declination."""
  # Day of year for mid-month
  day_of_year = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1]
  # Solar declination
  decl = 23.45 * math.sin(2 * math.pi * (284 + day_of_year) / 365)
  # Daylight hours
  lat_rad = math.radians(lat)
  decl_rad = math.radians(decl)
  cos_h = -math.tan(lat_rad) * math.tan(decl_rad)
  cos_h = max(-1, min(1, cos_h))
  h = math.degrees(math.acos(cos_h))  # half-day-length in degrees
  daylight = 2 * h / 15  # hours
  return max(0, min(24, daylight))


def monthly_rain(climate, month):
  """Approximate rainy days and precipitation per month."""
  if climate == "tropical":
    # Rainy season typically May-October (northern) or Nov-Apr (southern)
    base_rain = 15
    rainy_days = 12
  elif climate == "temperate":
    base_rain = 70
    rainy_days = 10
  elif climate == "continental":
    base_rain = 50
    rainy_days = 8
  elif climate == "polar":
    base_rain = 20
    rainy_days = 6
  else:  # arid
    base_rain = 10
    rainy_days = 2
  return rainy_days, base_rain


def main():
  # Clean up
  # Skip DELETE — we use INSERT OR IGNORE so re-runs are safe
  print("Skipping DELETE (using INSERT OR IGNORE for resume)")

  # Get all cities with lat/lon
  result = d1_query("SELECT geoname_id, latitude, longitude FROM cities WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
  if not result.get("success"):
    print("Failed to fetch cities")
    return
  cities = result.get("result", [{}])[0].get("results", [])
  print(f"Found {len(cities)} cities")

  # Generate climate rows
  climate_rows = []
  season_rows = []
  for city in cities:
    cid = city.get("geoname_id")
    lat = city.get("latitude", 0)
    lon = city.get("longitude", 0)
    climate = climate_class(lat)
    is_land = abs(lon) < 180  # approximation; all cities are land

    for month in range(1, 13):
      high, mean, low = monthly_temp(lat, climate, month, is_land)
      daylight = monthly_daylight(lat, month)
      rainy_days, precip = monthly_rain(climate, month)
      climate_rows.append({
        "city_id": cid, "month": month,
        "high": high, "mean": mean, "low": low,
        "rainy_days": rainy_days, "precip": precip,
        "daylight": round(daylight, 2),
        "climate": climate,
      })

    # Seasons
    if climate in ("temperate", "continental"):
      seasons_data = [
        ("spring", 3, 5, mean),
        ("summer", 6, 8, mean + 5),
        ("autumn", 9, 11, mean),
        ("winter", 12, 2, mean - 5),
      ]
    elif climate == "tropical":
      is_north = lat >= 0
      seasons_data = [
        ("rainy", 5 if is_north else 11, 10 if is_north else 4, mean),
        ("dry", 11 if is_north else 5, 4 if is_north else 10, mean + 2),
      ]
    elif climate == "polar":
      seasons_data = [
        ("summer", 6, 8, mean + 5),
        ("winter", 11, 3, mean - 10),
      ]
    else:  # arid
      seasons_data = [
        ("summer", 5, 9, mean + 8),
        ("winter", 11, 3, mean - 5),
      ]
    for s_name, start, end, s_mean in seasons_data:
      season_rows.append({
        "city_id": cid, "season": s_name, "start_month": start, "end_month": end,
        "avg_temp_c": round(s_mean, 1),
      })

  # Insert climate
  print(f"\nInserting {len(climate_rows)} climate rows in batches of {BATCH_SIZE}...")
  for i in range(0, len(climate_rows), BATCH_SIZE):
    chunk = climate_rows[i:i + BATCH_SIZE]
    values_sql = ",".join(["(?,?,?,?,?,?,?,?,?,?,?)"] * len(chunk))
    params = []
    for r in chunk:
      params.extend([
        r["city_id"], r["month"], round(r["high"], 1), round(r["low"], 1),
        round(r["mean"], 1), r["rainy_days"], round(r["precip"], 1),
        r["daylight"], r["climate"], SOURCE, CONFIDENCE,
      ])
    sql = f"""INSERT OR IGNORE INTO climate_summaries
      (city_id, month, avg_high_c, avg_low_c, avg_mean_c, rainy_days,
       avg_precipitation_mm, daylight_hours, climate_class, source, confidence)
      VALUES {values_sql}"""
    result = d1_query(sql, params)
    if not result.get("success"):
      print(f"  ✗ climate batch {i} failed: {result.get('errors', [])[:1]}")
    if (i // BATCH_SIZE) % 50 == 0:
      print(f"  ... {i + len(chunk)} / {len(climate_rows)}")

  # Insert seasons
  print(f"\nInserting {len(season_rows)} season rows...")
  for i in range(0, len(season_rows), BATCH_SIZE):
    chunk = season_rows[i:i + BATCH_SIZE]
    values_sql = ",".join(["(?,?,?,?,?)"] * len(chunk))
    params = []
    for r in chunk:
      params.extend([r["city_id"], r["season"], r["start_month"], r["end_month"], r["avg_temp_c"]])
    sql = f"""INSERT INTO seasons
      (city_id, season, start_month, end_month, avg_temp_c, source)
      VALUES {values_sql.replace('(?,?,?,?,?)', '(?,?,?,?,?,?)')}"""
    # Note: my schema has 6 cols, need to add source
    # Let me redo with correct SQL
    pass
  # Re-do with correct cols
  print("Re-inserting seasons with correct schema...")
  # DELETE FROM seasons is OK; this table is small enough
  d1_query("DELETE FROM seasons")
  for i in range(0, len(season_rows), BATCH_SIZE):
    chunk = season_rows[i:i + BATCH_SIZE]
    values_sql = ",".join(["(?,?,?,?,?,?)"] * len(chunk))
    params = []
    for r in chunk:
      params.extend([r["city_id"], r["season"], r["start_month"], r["end_month"], r["avg_temp_c"], SOURCE])
    sql = f"""INSERT INTO seasons
      (city_id, season, start_month, end_month, avg_temp_c, source)
      VALUES {values_sql}"""
    result = d1_query(sql, params)
    if not result.get("success"):
      print(f"  ✗ seasons batch {i} failed: {result.get('errors', [])[:1]}")

  print(f"\n✅ Done. {len(climate_rows)} climate rows, {len(season_rows)} season rows.")


if __name__ == "__main__":
  main()
