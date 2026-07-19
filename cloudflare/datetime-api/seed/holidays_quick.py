#!/usr/bin/env python3
"""Quick Nager.Date seed — top 50 countries, unbuffered output, religion tagging."""
import json
import os
import sys
import time
import urllib.request
import urllib.error

# Top 50 countries by population + G20 + EU + GCC
COUNTRIES = [
  "CN", "IN", "US", "ID", "PK", "BR", "NG", "BD", "RU", "MX",
  "JP", "ET", "PH", "EG", "VN", "CD", "TR", "IR", "DE", "TH",
  "GB", "FR", "IT", "TZ", "ZA", "MM", "KE", "KR", "CO", "ES",
  "AR", "DZ", "SD", "PL", "UG", "CA", "MA", "AF", "IQ", "SA",
  "PE", "MY", "AO", "MZ", "GH", "YE", "NP", "VE", "MG", "CM",
]
YEARS = [2026, 2027]  # 2 years is enough (we have 2024/2025/2028 from the original run)

RELIGION_KEYWORDS = {
  "christian": ["Christmas", "Easter", "Good Friday", "Epiphany", "Ascension", "Pentecost", "All Saints", "Assumption", "Immaculate", "Corpus Christi", "Maundy Thursday", "Holy Saturday", "Palm Sunday", "Reformation Day", "Boxing Day"],
  "muslim": ["Eid", "Ramadan", "Mawlid", "Hijri", "Islamic", "Ashura", "Isra", "Mi'raj", "Muharram", "Prophet's Birthday"],
  "jewish": ["Passover", "Yom Kippur", "Rosh Hashanah", "Hanukkah", "Purim", "Sukkot", "Shavuot", "Tisha"],
  "hindu": ["Diwali", "Holi", "Navratri", "Dussehra", "Janmashtami", "Ganesh Chaturthi", "Maha Shivaratri", "Raksha Bandhan"],
  "buddhist": ["Vesak", "Buddha", "Magha Puja", "Asalha"],
  "sikh": ["Vaisakhi", "Guru Nanak", "Guru Gobind", "Baisakhi"],
  "secular": ["New Year", "Labour", "Labor", "Independence", "Republic", "National Day", "Bastille", "Constitution"],
}
COUNTRY_DEFAULT_RELIGION = {
  "EG": "muslim", "SA": "muslim", "IR": "muslim", "PK": "muslim", "ID": "muslim",
  "TR": "muslim", "DZ": "muslim", "SD": "muslim", "IQ": "muslim", "AF": "muslim",
  "MA": "muslim", "YE": "muslim", "BD": "muslim", "NG": "muslim", "ET": "muslim",
  "NE": "muslim", "GH": "muslim", "CM": "muslim", "AO": "muslim", "MZ": "muslim",
  "IL": "jewish",
  "IN": "hindu", "NP": "hindu",
  "TH": "buddhist", "MM": "buddhist", "KH": "buddhist", "LK": "buddhist",
}

def infer_religion(name, cc):
  nl = name.lower()
  for rel, kws in RELIGION_KEYWORDS.items():
    for kw in kws:
      if kw.lower() in nl:
        return rel
  return COUNTRY_DEFAULT_RELIGION.get(cc, "secular")

def infer_obs(h):
  types = h.get("types", [])
  if "Public" in types: return "public_holiday"
  if "Bank" in types: return "bank_holiday"
  if "School" in types: return "school_holiday"
  if "Observance" in types: return "observance"
  if "Optional" in types: return "optional"
  return "observance"

def fetch(cc, year):
  url = f"https://date.nager.at/api/v3/PublicHolidays/{year}/{cc}"
  try:
    with urllib.request.urlopen(url, timeout=10) as r:
      return json.loads(r.read())
  except Exception as e:
    return None

CF_ACCOUNT = "f0de6c4b68becd81e60507ecf9410199"
CF_D1 = "c401ffb6-51db-49e6-991f-b5695f9e6a7d"
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")

def d1_q(sql, params=None):
  url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/d1/database/{CF_D1}/query"
  body = {"sql": sql}
  if params: body["params"] = params
  data = json.dumps(body).encode("utf-8")
  req = urllib.request.Request(url, data=data, method="POST")
  req.add_header("Authorization", f"Bearer {CF_TOKEN}")
  req.add_header("Content-Type", "application/json")
  with urllib.request.urlopen(req) as r:
    return json.loads(r.read())

# Build the SET clause to add the new columns
# (Already done in migration 010)
# Just UPDATE existing rows to set religion based on name
print("=== Skipping tag (already done by tag_religion.py) ===", flush=True)

# For each existing holiday, set religion based on name
update_sql = """UPDATE holidays SET
  religion = ?,
  observance_type = CASE
    WHEN type = 'public' THEN 'public_holiday'
    WHEN type = 'bank' THEN 'bank_holiday'
    WHEN type = 'school' THEN 'school_holiday'
    WHEN type = 'observance' THEN 'observance'
    WHEN type = 'optional' THEN 'optional'
    ELSE 'observance'
  END
  WHERE id = ?"""

# Get all holidays without religion
r = d1_q("SELECT id, country_code, name FROM holidays WHERE religion IS NULL AND 1=0")
rows = r['result'][0]['results']
print(f"Need to tag: {len(rows)} rows", flush=True)
tagged = 0
for row in rows:
  rel = infer_religion(row['name'], row['country_code'])
  d1_q(update_sql, [rel, row['id']])
  tagged += 1
  if tagged % 100 == 0:
    print(f"  Tagged {tagged}/{len(rows)}", flush=True)
print(f"Done tagging {tagged} existing rows", flush=True)

# Now add new countries
print(f"\n=== Adding {len(COUNTRIES)} countries × {len(YEARS)} years ===", flush=True)
for cc in COUNTRIES:
  for year in YEARS:
    h = fetch(cc, year)
    if h is None: continue
    rows = []
    for holiday in h:
      d = holiday.get("date")
      n = holiday.get("name", "")
      if not d or not n: continue
      rows.append((
        cc, None, None, n, None,
        infer_obs(holiday), d, d, year, 1, 1, None, None,
        f"nager.date:{year}", 1.0,
        infer_religion(n, cc),  # religion
      ))
    if not rows: continue
    # Insert with religion field too
    BATCH = 5
    ph = ",".join(["(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"] * BATCH)
    for i in range(0, len(rows), BATCH):
      chunk = rows[i:i+BATCH]
      actual = ",".join(["(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"] * len(chunk))
      flat = [v for row in chunk for v in row]
      try:
        d1_q(
          f"INSERT OR IGNORE INTO holidays (country_code, region_code, city_id, name, localized_names, type, date, observed_date, year, fixed, global_holiday, counties, launch_year, source, confidence, religion) VALUES {actual}",
          flat
        )
      except Exception as e:
        print(f"  Failed {cc}/{year}: {str(e)[:100]}", flush=True)
    print(f"  ✓ {cc}/{year}: {len(rows)} rows", flush=True)
  time.sleep(0.05)

# Final stats
r = d1_q("SELECT COUNT(*) as n, COUNT(DISTINCT country_code) as cc, COUNT(religion) as with_religion FROM holidays")
res = r['result'][0]['results'][0]
print(f"\n=== Final state ===", flush=True)
print(f"Total holidays: {res['n']}", flush=True)
print(f"Countries: {res['cc']}", flush=True)
print(f"With religion tag: {res['with_religion']}", flush=True)
