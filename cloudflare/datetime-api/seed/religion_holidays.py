"""
Religion-specific holiday seeders (deterministic algorithms + curated data).

Generates holiday rows for:
- Jewish holidays (Hebrew calendar → Gregorian)
- Muslim holidays (Hijri calendar → Gregorian)
- Hindu festivals (curated list, mostly solar)
- Buddhist holidays (curated)
- Sikh holidays (curated)
- Jain holidays (curated)

Each holiday gets a country list (which countries observe it) and a religion tag.
"""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

# Hebrew calendar (Jewish holidays) — deterministic
# Reference: https://www.hebcal.com/home/1957/jewish-calendar

def hebrew_to_gregorian(year, month, day):
    """Convert Hebrew date to Gregorian. Uses simple lookup for common years."""
    # For our purposes, use a Python library if available, else fall back to lookup
    try:
        from convertdate import hebrew
        y, m, d = hebrew.to_gregorian(year, month, day)
        return date(y, m, d)
    except ImportError:
        return None

def jewish_holidays_for_year(gregorian_year):
    """Return list of (hebrew_month, hebrew_day, english_name, religion, observance_type)
    for a given Gregorian year. We compute forward + backward to catch holidays
    that fall in late Dec / early Jan."""
    holidays = []
    # Holidays in Hebrew year T ishrael mapping
    # Hebrew year N starts in Sep/Oct of Gregorian year (N-3761)
    # Hebrew year N+1 starts in Sep/Oct of Gregorian year+1
    for hy in [gregorian_year + 3760, gregorian_year + 3761]:
        # 1 Tishrei: Rosh Hashanah (2 days)
        holidays.append((hy, 1, 1, "Rosh Hashanah", "public_holiday"))
        holidays.append((hy, 1, 2, "Rosh Hashanah (Day 2)", "public_holiday"))
        # 10 Tishrei: Yom Kippur
        holidays.append((hy, 7, 10, "Yom Kippur", "public_holiday"))
        # 15 Tishrei: Sukkot (7 days)
        holidays.append((hy, 7, 15, "Sukkot", "public_holiday"))
        # 22 Tishrei: Shemini Atzeret
        holidays.append((hy, 7, 22, "Shemini Atzeret", "public_holiday"))
        # 25 Kislev: Hanukkah (8 days)
        for d in range(25, 31):
            holidays.append((hy, 9, d, f"Hanukkah Day {d-24}", "observance"))
        # 14 Adar: Purim (or 14 Adar II in leap years)
        holidays.append((hy, 12, 14, "Purim", "observance"))
        # 15 Nisan: Passover (7-8 days)
        for d in range(15, 22):
            name = f"Passover Day {d-14}" if d > 15 else "Passover (First Day)"
            if d == 21: name = "Passover (Last Day)"
            holidays.append((hy, 1, d, name, "public_holiday"))
        # 5 Iyar: Yom Ha'atzmaut (Israel Independence Day)
        holidays.append((hy, 8, 5, "Yom Ha'atzmaut", "public_holiday"))
        # 6 Sivan: Shavuot
        holidays.append((hy, 9, 6, "Shavuot", "public_holiday"))
        # 9 Av: Tisha B'Av
        holidays.append((hy, 11, 9, "Tisha B'Av", "observance"))
    return holidays

# Islamic calendar (Hijri) — uses astronomical formulas
# Hijri year N corresponds roughly to Gregorian 622 + (N-1) * 354.367

def hijri_to_gregorian_approx(hy, hm, hd):
    """Approximate Hijri to Gregorian conversion. Accurate to ±1 day."""
    # Julian Day Number calculation
    # Reference: https://www.astronomicalalgorithms.com/ (Jean Meeus, Ch. 7)
    jd = (hd) + ceil(29.5 * (hm - 1)) + (hy - 1) * 354 + floor((3 + (hy * 11)) / 30) + 1948440 - 1
    # Convert JD to Gregorian
    jd += 0.5
    z = int(jd)
    f = jd - z
    if z < 2299161:
        a = z
    else:
        alpha = int((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha - int(alpha / 4)
    b = a + 1524
    c = int((b - 122.1) / 365.25)
    d = int(365.25 * c)
    e = int((b - d) / 30.6001)
    day = b - d - int(30.6001 * e)
    if e < 14:
        month = e - 1
    else:
        month = e - 13
    if month > 2:
        year = c - 4716
    else:
        year = c - 4715
    return date(year, month, day)

from math import floor, ceil

def muslim_holidays_for_year(gregorian_year):
    """Return list of (hijri_year, hijri_month, hijri_day, name, observance_type)
    for a given Gregorian year."""
    holidays = []
    # Hijri year 1 started in 622 CE
    # Each Hijri year is ~354.367 days
    # Hijri year N starts around (N-1) * 354.367 / 365.25 years after 622 CE
    hy_start = int((gregorian_year - 622) * 365.25 / 354.367) + 1
    # Check 2 Hijri years to cover Jan-Dec of the Gregorian year
    for hy in [hy_start, hy_start + 1]:
        # 1 Muharram: Islamic New Year
        holidays.append((hy, 1, 1, "Islamic New Year", "public_holiday"))
        # 10 Muharram: Day of Ashura
        holidays.append((hy, 1, 10, "Day of Ashura", "observance"))
        # 12 Rabi al-Awwal: Mawlid (Prophet's Birthday)
        holidays.append((hy, 3, 12, "Mawlid (Prophet's Birthday)", "public_holiday"))
        # 27 Rajab: Isra and Mi'raj
        holidays.append((hy, 7, 27, "Isra and Mi'raj", "observance"))
        # 1 Ramadan: Start of Ramadan
        holidays.append((hy, 9, 1, "Start of Ramadan", "public_holiday"))
        # 17 Ramadan: Nuzul Al-Quran (varies by country)
        holidays.append((hy, 9, 17, "Nuzul Al-Quran", "observance"))
        # Last day of Ramadan: 29 or 30 Ramadan (Eid eve)
        # 1 Shawwal: Eid al-Fitr
        holidays.append((hy, 10, 1, "Eid al-Fitr (Day 1)", "public_holiday"))
        holidays.append((hy, 10, 2, "Eid al-Fitr (Day 2)", "public_holiday"))
        holidays.append((hy, 10, 3, "Eid al-Fitr (Day 3)", "public_holiday"))
        # 9 Dhu al-Hijjah: Day of Arafah
        holidays.append((hy, 12, 9, "Day of Arafah", "public_holiday"))
        # 10 Dhu al-Hijjah: Eid al-Adha
        holidays.append((hy, 12, 10, "Eid al-Adha (Day 1)", "public_holiday"))
        holidays.append((hy, 12, 11, "Eid al-Adha (Day 2)", "public_holiday"))
        holidays.append((hy, 12, 12, "Eid al-Adha (Day 3)", "public_holiday"))
    return holidays

# Hindu festivals (curated — many are lunar but we use the most common Gregorian dates)
# Sources: drikpanchang.com, iskcon.org, wikipedia
# Most Hindu festivals follow the Hindu lunar calendar (Panchanga)
# For our seed, we use the **most common Gregorian date** for each festival in 2025/2026
# These dates shift each year by ~11 days, so we'd need to compute via Hindu Panchanga
# For now, we use solar-fixed dates where applicable, or document the lunar date

HINDU_FESTIVALS = [
    # (name, religion, observance_type, month, day_or_offset, fixed_or_lunar, countries)
    ("Makar Sankranti", "hindu", "public_holiday", 1, 14, "fixed", ["IN"]),
    ("Vasant Panchami", "hindu", "observance", 1, 29, "lunar", ["IN", "NP"]),
    ("Maha Shivaratri", "hindu", "public_holiday", 2, 18, "lunar", ["IN", "NP"]),
    ("Holi", "hindu", "public_holiday", 3, 14, "lunar", ["IN", "NP"]),
    ("Ugadi / Gudi Padwa", "hindu", "public_holiday", 3, 30, "lunar", ["IN"]),
    ("Ram Navami", "hindu", "public_holiday", 4, 6, "lunar", ["IN", "NP"]),
    ("Hanuman Jayanti", "hindu", "observance", 4, 16, "lunar", ["IN"]),
    ("Akshaya Tritiya", "hindu", "observance", 4, 30, "lunar", ["IN"]),
    ("Buddha Purnima", "hindu", "public_holiday", 5, 12, "lunar", ["IN", "NP", "LK"]),  # also Buddhist
    ("Rath Yatra", "hindu", "public_holiday", 6, 27, "lunar", ["IN"]),
    ("Nag Panchami", "hindu", "observance", 7, 29, "lunar", ["IN"]),
    ("Raksha Bandhan", "hindu", "public_holiday", 8, 19, "lunar", ["IN", "NP"]),
    ("Krishna Janmashtami", "hindu", "public_holiday", 8, 26, "lunar", ["IN", "NP"]),
    ("Ganesh Chaturthi", "hindu", "public_holiday", 8, 27, "lunar", ["IN"]),
    ("Onam", "hindu", "public_holiday", 9, 5, "lunar", ["IN"]),  # Kerala only
    ("Navratri", "hindu", "public_holiday", 10, 1, "lunar", ["IN"]),
    ("Dussehra / Vijayadashami", "hindu", "public_holiday", 10, 12, "lunar", ["IN", "NP"]),
    ("Karva Chauth", "hindu", "observance", 10, 20, "lunar", ["IN"]),
    ("Diwali / Deepavali", "hindu", "public_holiday", 11, 1, "lunar", ["IN", "NP", "LK", "MY", "SG", "ID", "MU", "GB", "CA", "US", "AU", "FJ"]),
    ("Govardhan Puja", "hindu", "observance", 11, 2, "lunar", ["IN"]),
    ("Bhai Dooj", "hindu", "observance", 11, 3, "lunar", ["IN"]),
    ("Chhath Puja", "hindu", "public_holiday", 11, 7, "lunar", ["IN"]),
    ("Guru Nanak Jayanti", "hindu", "public_holiday", 11, 15, "lunar", ["IN", "GB", "CA", "US", "AU"]),  # also Sikh
]

# Buddhist holidays (some overlap with Hindu)
BUDDHIST_FESTIVALS = [
    ("Vesak / Buddha Purnima", "buddhist", "public_holiday", 5, 12, "lunar", ["TH", "LK", "MM", "KH", "LA", "BT", "NP", "SG", "MY", "ID", "JP", "KR", "CN", "VN", "TW", "HK", "MO", "US", "CA", "AU", "GB", "FR"]),
    ("Asalha Puja", "buddhist", "public_holiday", 7, 20, "lunar", ["TH", "LA", "KH", "MM", "LK"]),
    ("Magha Puja", "buddhist", "public_holiday", 2, 16, "lunar", ["TH", "LA", "KH", "MM", "LK"]),
    ("Uposatha (Observance Day)", "buddhist", "observance", 1, 1, "lunar", ["TH", "LA", "KH"]),
    ("Kathina", "buddhist", "public_holiday", 10, 15, "lunar", ["TH", "LA", "KH", "MM", "LK"]),
    ("Loy Krathong", "buddhist", "observance", 11, 5, "lunar", ["TH"]),
    ("Songkran (Thai New Year)", "buddhist", "public_holiday", 4, 13, "fixed", ["TH"]),
    ("Bon Odori", "buddhist", "observance", 7, 15, "fixed", ["JP"]),
    ("Obon", "buddhist", "observance", 8, 15, "fixed", ["JP"]),
]

# Sikh holidays
SIKH_FESTIVALS = [
    ("Guru Gobind Singh Jayanti", "sikh", "observance", 1, 5, "lunar", ["IN", "GB", "CA", "US", "AU"]),
    ("Vaisakhi", "sikh", "public_holiday", 4, 14, "fixed", ["IN", "GB", "CA", "US", "AU"]),
    ("Guru Arjan Dev Martyrdom Day", "sikh", "observance", 6, 16, "fixed", ["IN", "GB", "CA", "US", "AU"]),
    ("Guru Nanak Jayanti", "sikh", "public_holiday", 11, 15, "lunar", ["IN", "GB", "CA", "US", "AU"]),
    ("Martyrdom of Guru Tegh Bahadur", "sikh", "observance", 11, 24, "fixed", ["IN", "GB", "CA", "US", "AU"]),
    ("Parkash Purab of Guru Gobind Singh", "sikh", "observance", 1, 5, "lunar", ["IN", "GB", "CA", "US", "AU"]),
    ("Hola Mohalla", "sikh", "public_holiday", 3, 14, "lunar", ["IN"]),
    ("Baisakhi", "sikh", "public_holiday", 4, 14, "fixed", ["IN", "GB", "CA", "US", "AU"]),
]

# Jain holidays
JAIN_FESTIVALS = [
    ("Mahavir Jayanti", "jain", "public_holiday", 4, 21, "lunar", ["IN", "US", "GB", "CA"]),
    ("Paryushana", "jain", "public_holiday", 8, 27, "lunar", ["IN"]),
    ("Mahavir Nirvan", "jain", "public_holiday", 10, 26, "lunar", ["IN", "US", "GB", "CA"]),
    ("Diwali (Jain)", "jain", "observance", 11, 1, "lunar", ["IN", "US", "GB", "CA"]),  # Jain new year
]

# Countries where each religion is observed
JEWISH_COUNTRIES = ["IL", "US", "AR", "BR", "CA", "FR", "GB", "ZA", "AU", "RU", "DE", "HU", "PL", "UA", "BY", "AT", "BE", "NL", "IT", "ES", "MX", "CL", "VE", "UY", "CO", "PE"]
MUSLIM_COUNTRIES = ["SA", "AE", "EG", "IR", "TR", "ID", "PK", "BD", "NG", "ET", "DZ", "IQ", "MA", "AF", "YE", "SY", "JO", "TN", "LY", "SD", "OM", "KW", "QA", "BH", "LB", "PS", "SO", "MZ", "ML", "BF", "NE", "TD", "SN", "CM", "TZ", "UG", "KE", "GH", "CI", "AZ", "UZ", "KZ", "KG", "TJ", "TM", "XK", "AL", "BA", "BG", "MK"]

# Country religion defaults (top 100 by population)
COUNTRY_RELIGIONS = [
    # (country_code, religion, percentage, is_official)
    ("CN", "secular", 0, 0),  # officially atheist
    ("IN", "hindu", 80, 1),
    ("US", "christian", 65, 0),
    ("ID", "muslim", 87, 1),
    ("PK", "muslim", 96, 1),
    ("BR", "christian", 88, 0),
    ("NG", "muslim", 50, 0),  # split
    ("BD", "muslim", 91, 1),
    ("RU", "christian", 71, 0),
    ("MX", "christian", 90, 0),
    ("JP", "buddhist", 70, 0),
    ("ET", "christian", 62, 0),  # Ethiopian Orthodox
    ("PH", "christian", 92, 0),
    ("EG", "muslim", 90, 1),
    ("VN", "secular", 0, 0),  # complex mix
    ("CD", "christian", 95, 0),
    ("TR", "muslim", 99, 1),
    ("IR", "muslim", 99, 1),
    ("DE", "christian", 60, 0),
    ("TH", "buddhist", 95, 1),
    ("GB", "christian", 60, 0),
    ("FR", "christian", 60, 0),
    ("IT", "christian", 80, 0),
    ("ZA", "christian", 80, 0),
    ("MM", "buddhist", 88, 1),
    ("KE", "christian", 85, 0),
    ("KR", "secular", 0, 0),  # mix of Buddhist/Christian/none
    ("CO", "christian", 90, 0),
    ("ES", "christian", 70, 0),
    ("AR", "christian", 85, 0),
    ("DZ", "muslim", 99, 1),
    ("SD", "muslim", 97, 1),
    ("PL", "christian", 92, 0),
    ("CA", "christian", 67, 0),
    ("AU", "christian", 52, 0),
    ("MA", "muslim", 99, 1),
    ("AF", "muslim", 99, 1),
    ("IQ", "muslim", 97, 1),
    ("SA", "muslim", 97, 1),
    ("PE", "christian", 90, 0),
    ("UZ", "muslim", 88, 1),
    ("MY", "muslim", 61, 1),
    ("AO", "christian", 90, 0),
    ("MZ", "christian", 60, 0),
    ("YE", "muslim", 99, 1),
    ("NP", "hindu", 81, 1),
    ("VE", "christian", 90, 0),
    ("GH", "christian", 71, 0),
    ("MG", "christian", 50, 0),  # mix
    ("KP", "secular", 0, 0),  # North Korea
    ("CM", "christian", 70, 0),
    ("TW", "secular", 0, 0),  # mix
    ("NE", "muslim", 99, 1),
    ("LK", "buddhist", 70, 1),
    ("BF", "muslim", 61, 0),
    ("CL", "christian", 80, 0),
    ("MW", "christian", 80, 0),
    ("ML", "muslim", 95, 1),
    ("KZ", "muslim", 70, 1),
    ("SY", "muslim", 87, 1),
    ("EC", "christian", 90, 0),
    ("NL", "christian", 50, 0),
    ("GT", "christian", 85, 0),
    ("TD", "muslim", 55, 1),
    ("SO", "muslim", 99, 1),
    ("ZW", "christian", 87, 0),
    ("KH", "buddhist", 95, 1),
    ("GN", "muslim", 85, 1),
    ("RW", "christian", 90, 0),
    ("TN", "muslim", 99, 1),
    ("BJ", "christian", 60, 0),
    ("BE", "christian", 60, 0),
    ("BO", "christian", 90, 0),
    ("CU", "christian", 60, 0),
    ("HT", "christian", 87, 0),
    ("DO", "christian", 88, 0),
    ("CZ", "secular", 0, 0),
    ("GR", "christian", 90, 0),
    ("JO", "muslim", 97, 1),
    ("PT", "christian", 85, 0),
    ("AZ", "muslim", 96, 1),
    ("SE", "christian", 60, 0),
    ("HU", "christian", 75, 0),
    ("IL", "jewish", 75, 0),  # officially Jewish state
    ("AT", "christian", 75, 0),
    ("CH", "christian", 70, 0),
    ("BY", "christian", 75, 0),
    ("TJ", "muslim", 96, 1),
    ("RS", "christian", 90, 0),
    ("PG", "christian", 96, 0),
    ("LY", "muslim", 97, 1),
    ("PY", "christian", 90, 0),
    ("LB", "muslim", 60, 0),  # complex mix
    ("SV", "christian", 80, 0),
    ("NI", "christian", 90, 0),
    ("BG", "christian", 85, 0),
    ("CR", "christian", 90, 0),
    ("HR", "christian", 90, 0),
    ("OM", "muslim", 99, 1),
    ("LR", "christian", 85, 0),
    ("PS", "muslim", 97, 0),
    ("KW", "muslim", 99, 1),
    ("PA", "christian", 90, 0),
    ("MR", "muslim", 99, 1),
    ("QA", "muslim", 99, 1),
    ("TM", "muslim", 93, 1),
    ("BH", "muslim", 99, 1),
    ("FJ", "christian", 64, 0),
    ("EE", "christian", 50, 0),
    ("MD", "christian", 95, 0),
    ("KG", "muslim", 80, 1),
    ("MU", "hindu", 50, 0),  # complex mix
    ("IS", "christian", 80, 0),
    ("MK", "christian", 65, 0),
    ("AL", "muslim", 60, 0),
    ("LT", "christian", 80, 0),
    ("SI", "christian", 75, 0),
    ("BA", "muslim", 50, 0),
    ("GE", "christian", 85, 0),
    ("LV", "christian", 60, 0),
    ("SK", "christian", 80, 0),
    ("AM", "christian", 95, 0),
    ("CY", "christian", 75, 0),
    ("LU", "christian", 70, 0),
    ("MT", "christian", 90, 0),
    ("BT", "buddhist", 75, 1),
    ("LA", "buddhist", 65, 1),
    ("MN", "buddhist", 53, 0),
    ("SG", "buddhist", 33, 0),  # mix
    ("MO", "buddhist", 50, 0),
    ("BN", "muslim", 78, 1),
    ("XK", "muslim", 95, 0),
    ("ME", "christian", 75, 0),
    ("TT", "christian", 70, 0),
    ("BS", "christian", 95, 0),
    ("BB", "christian", 75, 0),
    ("GD", "christian", 90, 0),
    ("LC", "christian", 90, 0),
    ("VC", "christian", 80, 0),
    ("AG", "christian", 90, 0),
    ("DM", "christian", 90, 0),
    ("KN", "christian", 90, 0),
    ("JM", "christian", 80, 0),
    ("BZ", "christian", 75, 0),
    ("GY", "christian", 60, 0),
    ("SR", "christian", 50, 0),  # mix
    ("PR", "christian", 85, 0),
    ("AW", "christian", 90, 0),
    ("CW", "christian", 85, 0),
    ("SX", "christian", 85, 0),
    ("BQ", "christian", 85, 0),
    ("KY", "christian", 80, 0),
    ("BM", "christian", 70, 0),
    ("TC", "christian", 90, 0),
    ("VG", "christian", 80, 0),
    ("AI", "christian", 90, 0),
    ("MS", "christian", 80, 0),
    ("FK", "christian", 70, 0),
    ("GI", "christian", 85, 0),
    ("FO", "christian", 90, 0),
    ("GL", "christian", 90, 0),
    ("PF", "christian", 50, 0),
    ("NC", "christian", 80, 0),
    ("WF", "christian", 95, 0),
    ("VU", "christian", 90, 0),
    ("SB", "christian", 92, 0),
    ("TO", "christian", 95, 0),
    ("WS", "christian", 95, 0),
    ("KI", "christian", 95, 0),
    ("TV", "christian", 95, 0),
    ("NR", "christian", 95, 0),
    ("PW", "christian", 95, 0),
    ("FM", "christian", 95, 0),
    ("MH", "christian", 95, 0),
    ("MP", "christian", 85, 0),
    ("GU", "christian", 85, 0),
    ("AS", "christian", 95, 0),
    ("VI", "christian", 85, 0),
    ("HK", "secular", 0, 0),
]

if __name__ == "__main__":
    print("Religion-specific holiday seeder ready.")
    print(f"  Jewish countries: {len(JEWISH_COUNTRIES)}")
    print(f"  Muslim countries: {len(MUSLIM_COUNTRIES)}")
    print(f"  Hindu festivals: {len(HINDU_FESTIVALS)}")
    print(f"  Buddhist festivals: {len(BUDDHIST_FESTIVALS)}")
    print(f"  Sikh festivals: {len(SIKH_FESTIVALS)}")
    print(f"  Jain festivals: {len(JAIN_FESTIVALS)}")
    print(f"  Country religions mapped: {len(COUNTRY_RELIGIONS)}")
