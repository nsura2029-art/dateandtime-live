#!/usr/bin/env python3
"""Tag existing holidays with religion (fast batch)."""
import os, json, urllib.request

CF_ACCOUNT = "f0de6c4b68becd81e60507ecf9410199"
CF_D1 = "c401ffb6-51db-49e6-991f-b5695f9e6a7d"
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")

RELIGION_PATTERNS = [
  ("christian", "%Christmas%Easter%Good Friday%Epiphany%Ascension%Pentecost%All Saints%Assumption%Immaculate%Corpus%Maundy%Holy Saturday%Palm%Reformation%Boxing%Christmas%"),
  ("muslim", "%Eid%Ramadan%Mawlid%Hijri%Islamic%Ashura%Isra%Mi'raj%Muharram%Prophet%"),
  ("jewish", "%Passover%Yom Kippur%Rosh Hashanah%Hanukkah%Purim%Sukkot%Shavuot%Tisha%"),
  ("hindu", "%Diwali%Holi%Navratri%Dussehra%Janmashtami%Ganesh%Shivaratri%Raksha Bandhan%"),
  ("buddhist", "%Vesak%Buddha%Magha Puja%Asalha%"),
  ("sikh", "%Vaisakhi%Guru Nanak%Guru Gobind%Baisakhi%"),
]

# Build a single CASE statement
cases = []
for religion, _ in RELIGION_PATTERNS:
  pass

# Actually, use individual UPDATEs for each pattern
# Or use a simpler approach: just tag by country default religion + name check
# Let me use a Python loop with batch updates

url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/d1/database/{CF_D1}/query"

def d1_q(sql, params=None):
  body = {"sql": sql}
  if params: body["params"] = params
  data = json.dumps(body).encode("utf-8")
  req = urllib.request.Request(url, data=data, method="POST")
  req.add_header("Authorization", f"Bearer {CF_TOKEN}")
  req.add_header("Content-Type", "application/json")
  return json.loads(urllib.request.urlopen(req).read())

# Get all untagged holidays
r = d1_q("SELECT id, country_code, name FROM holidays WHERE religion IS NULL")
rows = r['result'][0]['results']
print(f"Need to tag: {len(rows)}", flush=True)

# Build batch update SQL with CASE
# Format: UPDATE holidays SET religion = CASE id WHEN 1 THEN 'christian' WHEN 2 THEN 'muslim' END WHERE id IN (1, 2)
# Max 50 IDs per batch to stay under 100-var limit (50 + 50 = 100 vars)

BATCH_SIZE = 50
for i in range(0, len(rows), BATCH_SIZE):
  chunk = rows[i:i+BATCH_SIZE]
  cases = " ".join(f"WHEN {r['id']} THEN ? " for r in chunk)
  ids = [r['id'] for r in chunk]
  params = []
  # Match each row to its religion
  for r in chunk:
    name = r['name'].lower()
    cc = r['country_code']
    religion = 'secular'
    for rel, patterns in RELIGION_PATTERNS:
      keywords = patterns.strip('%').split('%')
      for kw in keywords:
        if kw.lower() in name:
          religion = rel
          break
      if religion != 'secular': break
    # Country default
    if religion == 'secular':
      country_defaults = {
        'EG':'muslim','SA':'muslim','IR':'muslim','PK':'muslim','ID':'muslim',
        'TR':'muslim','DZ':'muslim','SD':'muslim','IQ':'muslim','AF':'muslim',
        'MA':'muslim','YE':'muslim','BD':'muslim','NG':'muslim','ET':'muslim',
        'NE':'muslim','GH':'muslim','CM':'muslim','AO':'muslim','MZ':'muslim',
        'IL':'jewish', 'IN':'hindu', 'NP':'hindu', 'TH':'buddhist',
        'MM':'buddhist', 'KH':'buddhist', 'LK':'buddhist',
      }
      religion = country_defaults.get(cc, 'secular')
    params.append(religion)
  sql = f"UPDATE holidays SET religion = CASE id {cases}END WHERE id IN ({','.join('?' * len(ids))})"
  d1_q(sql, params + ids)
  if i % 500 == 0:
    print(f"  Tagged {min(i + BATCH_SIZE, len(rows))}/{len(rows)}", flush=True)

# Also set observance_type
r = d1_q("UPDATE holidays SET observance_type = CASE type WHEN 'public' THEN 'public_holiday' WHEN 'bank' THEN 'bank_holiday' WHEN 'school' THEN 'school_holiday' WHEN 'observance' THEN 'observance' WHEN 'optional' THEN 'optional' ELSE 'observance' END WHERE observance_type IS NULL")
print(f"Set observance_type: {r.get('result', [{}])[0].get('meta', {}).get('changes', '?')}", flush=True)

# Final stats
r = d1_q("SELECT COUNT(*) as n, COUNT(DISTINCT country_code) as cc, COUNT(religion) as with_religion FROM holidays")
res = r['result'][0]['results'][0]
print(f"\n=== Final state ===", flush=True)
print(f"Total holidays: {res['n']}", flush=True)
print(f"Countries: {res['cc']}", flush=True)
print(f"With religion: {res['with_religion']}", flush=True)

r = d1_q("SELECT religion, COUNT(*) as n FROM holidays GROUP BY religion ORDER BY n DESC")
print(f"\nBy religion:", flush=True)
for row in r['result'][0]['results']:
  print(f"  {row['religion']}: {row['n']}", flush=True)
