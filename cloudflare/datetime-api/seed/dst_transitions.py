#!/usr/bin/env python3
"""
Seed dst_transitions table for all DST-observing timezones × 5 years (2024-2028).

For each tz we compute the spring_forward and fall_back dates by walking
the year one day at a time and detecting utcoffset changes.

Uses Python's zoneinfo module.
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
if not CF_TOKEN:
  print("ERROR: CLOUDFLARE_API_TOKEN env var required", file=sys.stderr)
  sys.exit(1)

ACCOUNT = "f0de6c4b68becd81e60507ecf9410199"
DB = "c401ffb6-51db-49e6-991f-b5695f9e6a7d"

YEARS = [2024, 2025, 2026, 2027, 2028]


def fmt_offset(td):
  """Format a timedelta as offset string like '+05:30'."""
  total_minutes = int(td.total_seconds() // 60)
  sign = '+' if total_minutes >= 0 else '-'
  total_minutes = abs(total_minutes)
  h, m = divmod(total_minutes, 60)
  return f"{sign}{h:02d}:{m:02d}"


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


def find_transitions(tz_id, year):
  """Find spring_forward and fall_back dates for a tz in a given year.
  Returns ((spring_date, before, after), (fall_date, before, after))."""
  try:
    tz = ZoneInfo(tz_id)
  except Exception:
    return None, None

  start = datetime(year, 1, 1, 12, 0, 0, tzinfo=tz)
  end = datetime(year + 1, 1, 1, 12, 0, 0, tzinfo=tz)

  prev_offset = start.utcoffset()
  spring = None
  fall = None

  dt = start
  while dt < end:
    next_dt = dt + timedelta(days=1)
    if next_dt >= end:
      break
    next_offset = next_dt.utcoffset()
    if next_offset != prev_offset:
      delta = next_offset - prev_offset
      if delta.total_seconds() > 0 and spring is None:
        spring = (next_dt.date().isoformat(), fmt_offset(prev_offset), fmt_offset(next_offset))
      elif delta.total_seconds() < 0 and fall is None:
        fall = (next_dt.date().isoformat(), fmt_offset(prev_offset), fmt_offset(next_offset))
    prev_offset = next_offset
    dt = next_dt

  return spring, fall


def insert_dst(row):
  sql = """INSERT INTO dst_transitions
    (tz_id, year, spring_forward_date, spring_forward_offset_before, spring_forward_offset_after,
     fall_back_date, fall_back_offset_before, fall_back_offset_after, dst_observed, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
  params = [row["tz_id"], row["year"], row["spring_date"], row["spring_before"], row["spring_after"],
            row["fall_date"], row["fall_before"], row["fall_after"], row["dst_observed"], row["source"]]
  d1_query(sql, params)


def main():
  # Clean up
  d1_query("DELETE FROM dst_transitions")
  print("Cleaned dst_transitions")

  # Get all timezones
  result = d1_query("SELECT id, current_offset, current_abbreviation, is_dst FROM timezones")
  if not result.get("success"):
    print("Failed to fetch tzs")
    return
  all_tzs = result.get("result", [{}])[0].get("results", [])
  print(f"Found {len(all_tzs)} timezones")

  total_inserted = 0
  for tz_row in all_tzs:
    tz_id = tz_row.get("id")
    if not tz_id:
      continue
    for year in YEARS:
      spring, fall = find_transitions(tz_id, year)
      row = {
        "tz_id": tz_id,
        "year": year,
        "spring_date": spring[0] if spring else None,
        "spring_before": spring[1] if spring else None,
        "spring_after": spring[2] if spring else None,
        "fall_date": fall[0] if fall else None,
        "fall_before": fall[1] if fall else None,
        "fall_after": fall[2] if fall else None,
        "dst_observed": 1 if (spring or fall) else 0,
        "source": "zoneinfo:2026-07-19",
      }
      insert_dst(row)
      total_inserted += 1

  print(f"\n✅ Inserted {total_inserted} DST transition records")


if __name__ == "__main__":
  main()
