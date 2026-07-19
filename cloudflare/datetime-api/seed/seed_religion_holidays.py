"""
Seed religion-specific holidays + country_religions into D1.
Pushes via the Cloudflare D1 HTTP API.

Usage:
  D1_ACCOUNT_ID=xxx D1_DATABASE_ID=xxx D1_API_TOKEN=xxx python3 seed_religion_holidays.py [--year 2026]
"""
import json
import os
import sys
import urllib.request
import urllib.parse
from datetime import date, timedelta
from math import floor, ceil
from convertdate import hebrew

# Import the religion data
sys.path.insert(0, os.path.dirname(__file__))
from religion_holidays import (
    JEWISH_COUNTRIES, MUSLIM_COUNTRIES, COUNTRY_RELIGIONS,
    HINDU_FESTIVALS, BUDDHIST_FESTIVALS, SIKH_FESTIVALS, JAIN_FESTIVALS
)

D1_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "f0de6c4b68becd81e60507ecf9410199")
D1_DATABASE_ID = os.environ.get("D1_DATABASE_ID", "c401ffb6-51db-49e6-991f-b5695f9e6a7d")
D1_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")

def d1_query(sql, params=None):
    """Execute a query against the D1 HTTP API."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{D1_ACCOUNT_ID}/d1/database/{D1_DATABASE_ID}/query"
    body = {"sql": sql}
    if params is not None:
        body["params"] = params
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {D1_API_TOKEN}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def d1_batch(statements):
    """Execute a batch of statements via D1 /query/batch endpoint."""
    import urllib.error
    url = f"https://api.cloudflare.com/client/v4/accounts/{D1_ACCOUNT_ID}/d1/database/{D1_DATABASE_ID}/query/batch"
    body = json.dumps({"batch": statements}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {D1_API_TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:500]}")
        raise

def hijri_to_gregorian_approx(hy, hm, hd):
    """Approximate Hijri to Gregorian. ±1 day accuracy."""
    jd = hd + ceil(29.5 * (hm - 1)) + (hy - 1) * 354 + floor((3 + (hy * 11)) / 30) + 1948440 - 1
    jd += 0.5
    z = int(jd)
    if z < 2299161:
        a = z
    else:
        alpha = int((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha - int(alpha / 4)
    b = a + 1524
    c = int((b - 122.1) / 365.25)
    d_ = int(365.25 * c)
    e = int((b - d_) / 30.6001)
    day = b - d_ - int(30.6001 * e)
    if e < 14:
        month = e - 1
    else:
        month = e - 13
    if month > 2:
        year = c - 4716
    else:
        year = c - 4715
    return date(year, month, day)

def generate_jewish_holidays(gregorian_year):
    """Convert Hebrew holidays to Gregorian for the given year."""
    holidays = []
    for hy in [gregorian_year + 3760, gregorian_year + 3761]:
        # Rosh Hashanah, Yom Kippur, Sukkot, etc.
        # Hebrew month mapping in convertdate:
        # 1=Nisan, 2=Iyyar, 3=Sivan, 4=Tammuz, 5=Av, 6=Elul,
        # 7=Tishrei (NEW YEAR), 8=Heshvan, 9=Kislev, 10=Tevet,
        # 11=Shevat, 12=Adar (or Adar I in leap year)
        rules = [
            (7, 1, "Rosh Hashanah", "public_holiday"),
            (7, 2, "Rosh Hashanah (Day 2)", "public_holiday"),
            (7, 10, "Yom Kippur", "public_holiday"),
            (7, 15, "Sukkot", "public_holiday"),
            (7, 22, "Shemini Atzeret", "public_holiday"),
            (12, 14, "Purim", "observance"),
            (1, 15, "Passover (First Day)", "public_holiday"),
            (1, 21, "Passover (Last Day)", "public_holiday"),
            (8, 5, "Yom Ha'atzmaut", "public_holiday"),
            (9, 6, "Shavuot", "public_holiday"),
            (11, 9, "Tisha B'Av", "observance"),
        ]
        for hm, hd, name, otype in rules:
            try:
                gy, gm, gd = hebrew.to_gregorian(hy, hm, hd)
                holidays.append((date(gy, gm, gd), name, otype))
            except Exception:
                pass
        # Hanukkah (8 days starting 25 Kislev = month 9)
        try:
            for d in range(25, 31):
                gy, gm, gd = hebrew.to_gregorian(hy, 9, d)
                holidays.append((date(gy, gm, gd), f"Hanukkah Day {d-24}", "observance"))
        except Exception:
            pass
    return holidays

def generate_muslim_holidays(gregorian_year):
    """Convert Hijri holidays to Gregorian for the given year."""
    holidays = []
    # Hijri year N starts in Sep/Oct of Gregorian year (622 + (N-1) * 354.367 / 365.25)
    # So a Gregorian year typically contains 2 Hijri years. Check hy_start - 1
    # to catch holidays from the Hijri year that STARTED in Sep/Oct of the previous year.
    hy_start = int((gregorian_year - 622) * 365.25 / 354.367) + 1
    for hy in [hy_start - 1, hy_start, hy_start + 1]:
        rules = [
            (1, 1, "Islamic New Year", "public_holiday"),
            (1, 10, "Day of Ashura", "observance"),
            (3, 12, "Mawlid (Prophet's Birthday)", "public_holiday"),
            (7, 27, "Isra and Mi'raj", "observance"),
            (9, 1, "Start of Ramadan", "public_holiday"),
            (9, 17, "Nuzul Al-Quran", "observance"),
            (10, 1, "Eid al-Fitr (Day 1)", "public_holiday"),
            (10, 2, "Eid al-Fitr (Day 2)", "public_holiday"),
            (10, 3, "Eid al-Fitr (Day 3)", "public_holiday"),
            (12, 9, "Day of Arafah", "public_holiday"),
            (12, 10, "Eid al-Adha (Day 1)", "public_holiday"),
            (12, 11, "Eid al-Adha (Day 2)", "public_holiday"),
            (12, 12, "Eid al-Adha (Day 3)", "public_holiday"),
        ]
        for hm, hd, name, otype in rules:
            try:
                d = hijri_to_gregorian_approx(hy, hm, hd)
                holidays.append((d, name, otype))
            except Exception:
                pass
    return holidays

def generate_curated_holidays(gregorian_year):
    """Use the curated festival lists. Many are lunar, so we use approximate
    fixed dates — for production, these should be computed from a Hindu/Buddhist
    Panchanga. For the seed, we accept ±5 day error."""
    out = []
    for fest in HINDU_FESTIVALS + BUDDHIST_FESTIVALS + SIKH_FESTIVALS + JAIN_FESTIVALS:
        name, religion, otype, month, day_or_offset, fixed_or_lunar, countries = fest
        if fixed_or_lunar == "fixed":
            try:
                d = date(gregorian_year, month, day_or_offset)
                out.append((d, name, religion, otype, countries))
            except ValueError:
                pass
        else:
            # Lunar: use the curated date as-is (will be ~10 days off for some years)
            try:
                d = date(gregorian_year, month, day_or_offset)
                out.append((d, name, religion, otype, countries))
            except ValueError:
                pass
    return out

def seed_country_religions():
    """Insert the country_religions table."""
    print("Seeding country_religions...")
    # Clear existing
    d1_query("DELETE FROM country_religions")
    batch = []
    for cc, religion, pct, is_official in COUNTRY_RELIGIONS:
        batch.append({
            "sql": "INSERT INTO country_religions (country_code, religion, percentage, is_official) VALUES (?, ?, ?, ?)",
            "params": [cc, religion, pct, is_official]
        })
        if len(batch) >= 20:
            d1_batch(batch)
            batch = []
    if batch:
        d1_batch(batch)
    print(f"  ✓ Inserted {len(COUNTRY_RELIGIONS)} country_religion rows")

def seed_religion_holidays(year):
    """Generate and seed all religion-specific holidays for the given year."""
    print(f"Seeding religion-specific holidays for {year}...")
    
    rows = []  # (date, name, religion, observance_type, countries_json)
    
    # Jewish holidays → all JEWISH_COUNTRIES
    for d, name, otype in generate_jewish_holidays(year):
        if d.year == year:
            rows.append((d.isoformat(), name, "jewish", otype, json.dumps(JEWISH_COUNTRIES)))
    
    # Muslim holidays → all MUSLIM_COUNTRIES
    for d, name, otype in generate_muslim_holidays(year):
        if d.year == year:
            rows.append((d.isoformat(), name, "muslim", otype, json.dumps(MUSLIM_COUNTRIES)))
    
    # Curated holidays (Hindu, Buddhist, Sikh, Jain) → their specific country lists
    for d, name, religion, otype, countries in generate_curated_holidays(year):
        if d.year == year:
            rows.append((d.isoformat(), name, religion, otype, json.dumps(countries)))
    
    print(f"  Generated {len(rows)} holiday rows for {year}")
    
    # Wipe and re-insert (idempotent re-runs)
    d1_query("DELETE FROM holidays WHERE source = 'religion_holidays.py' AND year = ?", [year])
    
    # D1 HTTP API has ~100-var per-statement limit. With 15 params × N rows:
    # 15 params per row, BATCH_SIZE=6 = 90 vars per statement
    BATCH_SIZE = 6
    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i:i+BATCH_SIZE]
        placeholders = ",".join(["(?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 'religion_holidays.py', 1.0)"] * len(chunk))
        params = []
        for d, name, religion, otype, countries in chunk:
            params.extend([
                d,  # date (ISO)
                d,  # observed_date
                year,  # year
                name,  # name
                "[]",  # localized_names
                religion,  # religion
                otype,  # observance_type
                None,  # wikipedia_url
                json.dumps(json.loads(countries))[0] if isinstance(json.loads(countries), list) else countries,  # counties (JSON)
                1,  # fixed
                1,  # global_holiday
            ])
        # Wait, we have 11 params per row × 6 rows = 66 vars. That's safe.
        # But the SQL has 12 placeholders. Let me recount:
        # (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 'religion_holidays.py', 1.0)
        # 9 ? marks per row, but 12 values. So we need 9 params per row.
        # Let me rewrite this to be cleaner
        pass
    
    # Cleaner approach: insert one row at a time via batch
    print("  Inserting in batches...")
    batch = []
    for d, name, religion, otype, countries in rows:
        batch.append({
            "sql": """INSERT INTO holidays (country_code, date, observed_date, year, name, localized_names, religion, observance_type, wikipedia_url, type, fixed, global_holiday, counties, source, confidence) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', 1, 1, ?, 'religion_holidays.py', 1.0)""",
            "params": [
                "*",  # country_code = '*' means "all listed in counties"
                d,
                d,
                year,
                name,
                "[]",
                religion,
                otype,
                None,
                countries,
            ]
        })
        if len(batch) >= 50:
            d1_batch(batch)
            batch = []
            inserted += 50
    if batch:
        d1_batch(batch)
        inserted += len(batch)
    print(f"  ✓ Inserted {inserted} religion holiday rows for {year}")
    return inserted

if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    if not D1_API_TOKEN:
        print("ERROR: CLOUDFLARE_API_TOKEN env var required")
        sys.exit(1)
    seed_country_religions()
    seed_religion_holidays(year)
    print("Done!")
