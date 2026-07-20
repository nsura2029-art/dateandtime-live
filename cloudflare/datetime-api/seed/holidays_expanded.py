#!/usr/bin/env python3
"""
Expanded Nager.Date seed — 100+ countries, religion tagging, 5 years.
Replaces the old 15-country script.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse

# 100+ countries — top 100 by population + G20 + EU + GCC + important diaspora
COUNTRIES = [
  # Top 30 by population
  "CN", "IN", "US", "ID", "PK", "BR", "NG", "BD", "RU", "MX",
  "JP", "ET", "PH", "EG", "VN", "CD", "TR", "IR", "DE", "TH",
  "GB", "FR", "IT", "TZ", "ZA", "MM", "KE", "KR", "CO", "ES",
  # 30-60
  "AR", "DZ", "SD", "PL", "UG", "CA", "MA", "AF", "IQ", "SA",
  "PE", "MY", "AO", "MZ", "GH", "YE", "NP", "VE", "MG", "CM",
  "AU", "NE", "LK", "BF", "CL", "RO", "NL", "EC", "GT", "CM",
  # 60-90
  "MU", "SO", "ZW", "KH", "RW", "TN", "BO", "BE", "SE", "CZ",
  "PT", "GR", "HU", "IL", "AT", "CH", "NO", "DK", "FI", "IE",
  "NZ", "SG", "HK", "TW", "JO", "LB", "AE", "KW", "OM", "QA",
  "BH", "LU", "IS", "MT", "CY",
  # Americas
  "CR", "PA", "DO", "CU", "PY", "UY", "HN", "SV", "NI", "PR",
  "JM", "TT", "BS", "BB", "GD",
  # Europe (extra)
  "BG", "HR", "RS", "SK", "SI", "LT", "LV", "EE", "AL", "MK",
  "BA", "MD", "UA", "BY", "GE", "AM", "AZ", "KZ", "UZ",
]
YEARS = [2024, 2025, 2026, 2027, 2028]

# Religion inference from holiday name (English)
RELIGION_KEYWORDS = {
  "christian": ["Christmas", "Easter", "Good Friday", "Epiphany", "Ascension", "Pentecost", "All Saints", "Assumption", "Immaculate", "Corpus Christi", "Maundy Thursday", "Holy Saturday", "Palm Sunday", "Reformation Day", "Boxing Day"],
  "muslim": ["Eid", "Ramadan", "Mawlid", "Hijri", "Islamic", "Ashura", "Isra", "Mi'raj", "Muharram", "Prophet's Birthday"],
  "jewish": ["Passover", "Yom Kippur", "Rosh Hashanah", "Hanukkah", "Purim", "Sukkot", "Shavuot", "Tisha"],
  "hindu": ["Diwali", "Holi", "Navratri", "Dussehra", "Janmashtami", "Ganesh Chaturthi", "Maha Shivaratri", "Raksha Bandhan"],
  "buddhist": ["Vesak", "Buddha", "Magha Puja", "Asalha"],
  "sikh": ["Vaisakhi", "Guru Nanak", "Guru Gobind", "Baisakhi"],
  "secular": ["New Year", "Labour", "Labor", "Independence", "Republic", "National Day", "Bastille", "Constitution"],
}

# Country default religion
COUNTRY_DEFAULT_RELIGION = {
  "EG": "muslim", "SA": "muslim", "IR": "muslim", "PK": "muslim", "ID": "muslim",
  "TR": "muslim", "DZ": "muslim", "SD": "muslim", "IQ": "muslim", "AF": "muslim",
  "MA": "muslim", "YE": "muslim", "TN": "muslim", "AE": "muslim", "JO": "muslim",
  "LB": "muslim", "KW": "muslim", "OM": "muslim", "QA": "muslim", "BH": "muslim",
  "BD": "muslim", "NG": "muslim", "ET": "muslim", "SO": "muslim", "MR": "muslim",
  "NE": "muslim", "ML": "muslim", "SN": "muslim", "CM": "muslim", "BF": "muslim",
  "IL": "jewish",
  "IN": "hindu", "NP": "hindu",
  "TH": "buddhist", "MM": "buddhist", "KH": "buddhist", "LA": "buddhist", "BT": "buddhist",
  "LK": "buddhist",
}

def infer_religion(name, country_code):
  """Best-effort religion inference from holiday name."""
  nl = name.lower()
  for rel, keywords in RELIGION_KEYWORDS.items():
    for kw in keywords:
      if kw.lower() in nl:
        return rel
  # Default to country primary religion if known
  return COUNTRY_DEFAULT_RELIGION.get(country_code, "secular")

def infer_observance_type(holiday):
  """Map Nager.Date types to our observance_type enum."""
  types = holiday.get("types", [])
  if "Public" in types and "Bank" in types:
    return "public_holiday"
  if "Public" in types:
    return "public_holiday"
  if "Bank" in types:
    return "bank_holiday"
  if "School" in types:
    return "school_holiday"
  if "Authorities" in types:
    return "authorities_holiday"
  if "Observance" in types:
    return "observance"
  if "Optional" in types:
    return "optional"
  return "observance"

def fetch_holidays(cc, year):
  url = f"https://date.nager.at/api/v3/PublicHolidays/{year}/{cc}"
  try:
    with urllib.request.urlopen(url, timeout=10) as r:
      return json.loads(r.read())
  except Exception as e:
    print(f"  Failed {cc}/{year}: {e}")
    return []

CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "f0de6c4b68becd81e60507ecf9410199")
CF_D1_DB = os.environ.get("D1_DATABASE_ID", "c401ffb6-51db-49e6-991f-b5695f9e6a7d")
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")

def d1_query(sql, params=None):
  url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/d1/database/{CF_D1_DB}/query"
  body = {"sql": sql}
  if params is not None:
    body["params"] = params
  data = json.dumps(body).encode("utf-8")
  req = urllib.request.Request(url, data=data, method="POST")
  req.add_header("Authorization", f"Bearer {CF_TOKEN}")
  req.add_header("Content-Type", "application/json")
  with urllib.request.urlopen(req) as r:
    return json.loads(r.read())

def d1_batch(statements):
  url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/d1/database/{CF_D1_DB}/query/batch"
  data = json.dumps({"batch": statements}).encode("utf-8")
  req = urllib.request.Request(url, data=data, method="POST")
  req.add_header("Authorization", f"Bearer {CF_TOKEN}")
  req.add_header("Content-Type", "application/json")
  with urllib.request.urlopen(req) as r:
    return json.loads(r.read())

def main():
  print(f"=== Nager.Date expanded seed ===")
  print(f"Countries: {len(COUNTRIES)}")
  print(f"Years: {YEARS}")
  print()
  
  total_rows = 0
  total_countries_added = 0
  for cc in COUNTRIES:
    rows = []
    for year in YEARS:
      holidays = fetch_holidays(cc, year)
      if not holidays:
        continue
      for h in holidays:
        date_str = h.get("date")
        name = h.get("name", "")
        if not date_str or not name:
          continue
        observance = infer_observance_type(h)
        religion = infer_religion(name, cc)
        # Holiday rows: 13 params each
        # Skip if it has been deleted (D1) — INSERT OR IGNORE
        rows.append((
          cc,           # country_code
          None,         # region_code
          None,         # city_id
          name,         # name
          None,         # localized_names
          observance,   # type (was 'public', now more granular via observance_type)
          date_str,     # date
          date_str,     # observed_date
          year,         # year
          1,            # fixed
          1,            # global_holiday
          None,         # counties
          None,         # launch_year
          f"nager.date:{year}",  # source
          1.0,          # confidence
          None,         # imported_at
        ))
    
    if not rows:
      continue
    
    # Insert in batches of 7 (13 params × 7 = 91 vars, under 100 limit)
    BATCH = 6
    placeholders = ",".join(["(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"] * BATCH)
    for i in range(0, len(rows), BATCH):
      chunk = rows[i:i+BATCH]
      actual_ph = ",".join(["(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"] * len(chunk))
      flat = [v for row in chunk for v in row]
      try:
        d1_query(
          f"INSERT OR IGNORE INTO holidays (country_code, region_code, city_id, name, localized_names, type, date, observed_date, year, fixed, global_holiday, counties, launch_year, source, confidence, imported_at) VALUES {actual_ph}",
          flat
        )
        total_rows += len(chunk)
      except Exception as e:
        print(f"  Batch failed for {cc}: {str(e)[:200]}")
    
    total_countries_added += 1
    print(f"  ✓ {cc}: {len(rows)} rows")
    time.sleep(0.1)
  
  print()
  print(f"=== Done ===")
  print(f"Countries added: {total_countries_added}")
  print(f"Total rows processed: {total_rows}")

if __name__ == "__main__":
  main()
