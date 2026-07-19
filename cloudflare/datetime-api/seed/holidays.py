#!/usr/bin/env python3
"""
Seed holidays table from Nager.Date API for top 20 countries × 5 years (2024-2028).

Per user 2026-07-19, scope is date & time only. Holidays + business calendars
are Phase 2 of the shared DB plan.

Nager.Date API: https://date.nager.at/api/v3/PublicHolidays/{year}/{cc}
Free, no auth, no rate limit (but we rate-limit anyway).
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

CF_ACCOUNT = "f0de6c4b68becd81e60507ecf9410199"
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
if not CF_TOKEN:
  print("ERROR: CLOUDFLARE_API_TOKEN env var required", file=sys.stderr)
  sys.exit(1)

FULL_DB = "c401ffb6-51db-49e6-991f-b5695f9e6a7d"

# Top 20 most-populous countries (ISO cca2)
COUNTRIES = [
  "CN",  # China
  "IN",  # India
  "US",  # United States
  "ID",  # Indonesia
  "PK",  # Pakistan
  "BR",  # Brazil
  "NG",  # Nigeria
  "BD",  # Bangladesh
  "RU",  # Russia
  "MX",  # Mexico
  "JP",  # Japan
  "ET",  # Ethiopia
  "PH",  # Philippines
  "EG",  # Egypt
  "VN",  # Vietnam
  "CD",  # DR Congo
  "TR",  # Turkey
  "IR",  # Iran
  "DE",  # Germany
  "TH",  # Thailand
]

YEARS = [2024, 2025, 2026, 2027, 2028]


def d1_query(sql: str, params: list = None) -> dict:
  """Execute a SQL query against the D1 database via Cloudflare HTTP API."""
  body = {"sql": sql}
  if params:
    body["params"] = params
  req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/d1/database/{FULL_DB}/query",
    data=json.dumps(body).encode("utf-8"),
    headers={
      "Authorization": f"Bearer {CF_TOKEN}",
      "Content-Type": "application/json",
    },
    method="POST",
  )
  try:
    with urllib.request.urlopen(req, timeout=30) as r:
      return json.load(r)
  except urllib.error.HTTPError as e:
    body_text = e.read().decode("utf-8", errors="ignore") if e.fp else ""
    print(f"  HTTP {e.code}: {body_text[:500]}", file=sys.stderr)
    return {"success": False, "errors": [{"code": e.code, "message": body_text}]}


def fetch_holidays(cc: str, year: int) -> list:
  """Fetch public holidays from Nager.Date for a country + year."""
  url = f"https://date.nager.at/api/v3/PublicHolidays/{year}/{cc}"
  try:
    with urllib.request.urlopen(url, timeout=15) as r:
      return json.load(r)
  except urllib.error.HTTPError as e:
    print(f"  ✗ {cc}/{year} HTTP {e.code}", file=sys.stderr)
    return []
  except Exception as e:
    print(f"  ✗ {cc}/{year} {e}", file=sys.stderr)
    return []


def insert_batch(rows: list):
  """Insert a batch of holiday rows. D1 has a SQLITE_MAX_VARIABLE_NUMBER
  limit (default 999 in SQLite, but the HTTP API may have a stricter cap),
  so we chunk into batches of 4 rows max (4 × 15 cols = 60 params, safe)."""
  if not rows:
    return
  BATCH_SIZE = 4
  for i in range(0, len(rows), BATCH_SIZE):
    chunk = rows[i:i + BATCH_SIZE]
    values_sql = ",".join(["(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"] * len(chunk))
    params = []
    for r in chunk:
      params.extend([
        r["country_code"],
        r.get("region_code"),
        r.get("city_id"),
        r["name"],
        r.get("localized_names"),
        r["type"],
        r["date"],
        r.get("observed_date"),
        r["year"],
        1 if r.get("fixed") else 0,
        1 if r.get("global_holiday") else 0,
        r.get("counties"),
        r.get("launch_year"),
        r["source"],
        r.get("confidence", 1.0),
      ])
    sql = f"""INSERT OR REPLACE INTO holidays
      (country_code, region_code, city_id, name, localized_names, type, date,
       observed_date, year, fixed, global_holiday, counties, launch_year, source, confidence)
      VALUES {values_sql}"""
    result = d1_query(sql, params)
    if not result.get("success"):
      errs = result.get("errors", [])
      print(f"  ✗ Insert chunk {i} failed: {errs[:2]}", file=sys.stderr)


def main():
  # Clean up previous partial inserts
  d1_query("DELETE FROM holidays WHERE source LIKE 'nager.date:%'")
  total = 0
  t0 = time.time()
  for cc in COUNTRIES:
    print(f"--- {cc} ---")
    for year in YEARS:
      holidays = fetch_holidays(cc, year)
      if not holidays:
        continue
      rows = []
      for h in holidays:
        # Nager.Date types: Public, Bank, School, Authorities, Optional, Observance
        # Map to our type (lowercase); first type wins
        types = h.get("types", ["Public"])
        nager_type = types[0] if types else "Public"
        type_lower = nager_type.lower()

        # Determine if date is a weekend → observed date shifts
        # Nager.Date sometimes provides 'observed' field but not always
        # We compute observed_date if it falls on Sat/Sun and the holiday is 'public'
        from datetime import datetime
        d = datetime.strptime(h["date"], "%Y-%m-%d")
        weekday = d.weekday()  # 0=Mon, 6=Sun
        observed = h["date"]
        if type_lower == "public" and weekday >= 5:  # Sat or Sun
          if weekday == 5:
            from datetime import timedelta
            observed = (d + timedelta(days=2)).strftime("%Y-%m-%d")  # Monday
          else:
            from datetime import timedelta
            observed = (d + timedelta(days=1)).strftime("%Y-%m-%d")  # Monday

        rows.append({
          "country_code": cc,
          "name": h.get("name") or h.get("localName") or "Unknown",
          "localized_names": json.dumps({"local": h.get("localName")}),
          "type": type_lower,
          "date": h["date"],
          "observed_date": observed,
          "year": year,
          "fixed": h.get("fixed", True),
          "global_holiday": h.get("global", True),
          "counties": json.dumps(h.get("counties")) if h.get("counties") else None,
          "launch_year": h.get("launchYear"),
          "source": f"nager.date:{year}",
          "confidence": 1.0,
        })
      if rows:
        insert_batch(rows)
        print(f"  {year}: {len(rows)} holidays")
        total += len(rows)
      else:
        print(f"  {year}: 0 holidays")
      time.sleep(0.2)  # rate limit

  elapsed = time.time() - t0
  print(f"\n✅ Seeded {total} holidays for {len(COUNTRIES)} countries × {len(YEARS)} years in {elapsed:.1f}s")


if __name__ == "__main__":
  main()
