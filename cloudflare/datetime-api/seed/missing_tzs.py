#!/usr/bin/env python3
"""
Phase 8 helper: seed missing timezones so the cities15000 import
doesn't fail FK constraints.

The cities15000.txt has 356 unique timezones, but our DB only has
312. This script adds the missing 96.

For each missing tz, we:
1. Look up current_offset + abbreviation + is_dst via Python zoneinfo
2. Get country_codes (which countries use this tz) — best effort from
   the cities15000 data
3. Insert into timezones table
"""

import json
import os
import sys
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
if not CF_TOKEN:
  print("ERROR: CLOUDFLARE_API_TOKEN env var required", file=sys.stderr)
  sys.exit(1)

ACCOUNT = "f0de6c4b68becd81e60507ecf9410199"
DB = "c401ffb6-51db-49e6-991f-b5695f9e6a7d"
CITIES_FILE = "/tmp/cities15000/cities15000.txt"


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


def get_existing_tzs():
  result = d1_query("SELECT id FROM timezones")
  if not result.get("success"):
    return set()
  return {r["id"] for r in result.get("result", [{}])[0].get("results", [])}


def get_missing_tzs_from_file():
  """Parse cities15000.txt and return unique timezones."""
  tzs = set()
  with open(CITIES_FILE) as f:
    for line in f:
      parts = line.rstrip("\n").split("\t")
      if len(parts) < 19:
        continue
      tz = parts[17]
      if tz:
        tzs.add(tz)
  return tzs


def get_country_for_tz(tz_to_countries, tz_id):
  """Return list of country codes for a tz."""
  return tz_to_countries.get(tz_id, [])


def build_tz_to_countries():
  """Build a map of tz → list of country codes from the file."""
  tz_to_countries = {}
  with open(CITIES_FILE) as f:
    for line in f:
      parts = line.rstrip("\n").split("\t")
      if len(parts) < 19:
        continue
      tz = parts[17]
      cc = parts[8]
      if tz and cc:
        tz_to_countries.setdefault(tz, set()).add(cc)
  # Convert sets to sorted lists, then to JSON
  return {tz: sorted(ccs) for tz, ccs in tz_to_countries.items()}


def get_tz_metadata(tz_id):
  """Get current offset, abbreviation, is_dst from zoneinfo."""
  try:
    tz = ZoneInfo(tz_id)
  except Exception:
    return None, None, None
  now = datetime.now()
  offset = now.astimezone(tz).utcoffset()
  abbrev = now.astimezone(tz).tzname()
  is_dst = bool(now.astimezone(tz).dst())
  return offset, abbrev, is_dst


def fmt_offset(td):
  total_minutes = int(td.total_seconds() // 60)
  sign = '+' if total_minutes >= 0 else '-'
  total_minutes = abs(total_minutes)
  h, m = divmod(total_minutes, 60)
  return f"{sign}{h:02d}:{m:02d}"


def main():
  print("=== Phase 8: seeding missing timezones ===\n")

  print("Loading existing tzs from DB...")
  existing = get_existing_tzs()
  print(f"  DB has {len(existing)} tzs")

  print("Reading tzs from cities15000.txt...")
  file_tzs = get_missing_tzs_from_file()
  print(f"  File has {len(file_tzs)} tzs")

  missing = sorted(file_tzs - existing)
  print(f"  Missing: {len(missing)} tzs")
  if not missing:
    print("  Nothing to do!")
    return

  print("\nBuilding tz → countries map...")
  tz_to_countries = build_tz_to_countries()
  print(f"  mapped {len(tz_to_countries)} tzs to countries")

  print(f"\nFetching metadata for {len(missing)} missing tzs...")
  inserts = []
  for tz_id in missing:
    offset, abbrev, is_dst = get_tz_metadata(tz_id)
    if offset is None:
      print(f"  ✗ {tz_id} not in zoneinfo")
      continue
    countries = get_country_for_tz(tz_to_countries, tz_id)
    inserts.append({
      "id": tz_id,
      "region": tz_id.split("/")[0] if "/" in tz_id else None,
      "city": tz_id.split("/")[-1].replace("_", " ") if "/" in tz_id else None,
      "country_codes": json.dumps(countries),
      "countries": json.dumps([]),  # would need to look up country names
      "current_offset": fmt_offset(offset),
      "current_abbreviation": abbrev,
      "is_dst": 1 if is_dst else 0,
    })
  print(f"  built {len(inserts)} insert records")

  # Insert in batches (12 cols × 7 rows = 84 vars, under 100)
  BATCH_SIZE = 7
  print(f"\nInserting in batches of {BATCH_SIZE}...")
  for i in range(0, len(inserts), BATCH_SIZE):
    chunk = inserts[i:i + BATCH_SIZE]
    values_sql = ",".join(["(?,?,?,?,?,?,?,?,?,?,?,?)"] * len(chunk))
    params = []
    for r in chunk:
      params.extend([
        r["id"], r["region"], None, r["city"],
        r["country_codes"], r["countries"],
        None, None,  # latitude, longitude
        None,         # comments
        r["current_offset"], r["current_abbreviation"],
        r["is_dst"],
      ])
    sql = f"""INSERT OR IGNORE INTO timezones
      (id, region, subregion, city, country_codes, countries,
       latitude, longitude, comments, current_offset, current_abbreviation, is_dst)
      VALUES {values_sql}"""
    result = d1_query(sql, params)
    if not result.get("success"):
      print(f"  ✗ batch {i // BATCH_SIZE} failed: {result.get('errors', [])[:1]}")
  print(f"  ✅ inserted {len(inserts)} missing timezones")

  # Update import_history
  d1_query(
    """INSERT INTO import_history
       (source_id, imported_at, rows_imported, rows_failed, rows_updated, duration_ms, notes)
       VALUES ('iana', datetime('now'), ?, 0, 0, ?, 'Phase 8: missing tzs from cities15000.txt')""",
    [len(inserts), 0]
  )


if __name__ == "__main__":
  main()
