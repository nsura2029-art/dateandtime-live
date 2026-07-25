#!/usr/bin/env python3
"""
Phase 13 (dr5hn Phase A) seed script.

Reads the dr5hn countries+states+cities JSON and seeds the dev D1:
  1. country enrichment (native, nationality, gdp) — UPDATE countries
  2. states enrichment (iso3166_2, native, dr5hn_id) — UPSERT states
  3. country_translations — INSERT IGNORE

Match strategy for states:
  GeoNames admin1_code (numeric, e.g. "23") matches dr5hn's `iso2`
  field for many countries (CN, IN, etc.). For others (US, GB, CA, AU)
  the match is by (country_code, ascii_name) since dr5hn uses
  alphanumeric iso2 codes for those.

Match strategy for countries: by cca2.

Output: writes to D1 via HTTP API, in batches.
Safe to re-run (all INSERTs are INSERT OR IGNORE or UPDATE-by-cca2).

Usage:
  CLOUDFLARE_API_TOKEN=xxx python3 dr5hn_phase_a.py [--dry-run]
"""

import argparse
import json
import os
import sys
import time
import unicodedata
import urllib.request
import urllib.error

ACCOUNT = "f0de6c4b68becd81e60507ecf9410199"
DB = "c401ffb6-51db-49e6-991f-b5695f9e6a7d"
JSON_PATH = "/workspace/attachments/3376ee34__6cd825b5-2ac2-4ef4-91dc-ec802c32cde7.json"

# D1 HTTP API has a ~100-var per-statement limit.
# Country enrichment: 4 cols (native, nationality, gdp, cca2) — batch 20 = 80 vars
# State enrichment: 6 cols + 1 cca2 (cca2, admin1_code, iso3166_2, native, dr5hn_id, name, ascii_name, type) = 8
#   - we do UPDATE by (cca2, admin1_code) with the rest = 6 vars → batch 16 = 96
# Country translations: 3 cols (cca2, lang, name) = 3 vars → batch 33 = 99
BATCH_STATES = 16
BATCH_TRANSLATIONS = 30
BATCH_COUNTRIES = 20


def d1_query(sql, params=None):
    """Run a single SQL statement against D1 HTTP API."""
    body = {"sql": sql}
    if params:
        body["params"] = params
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
            if not data.get("success"):
                print(f"  D1 ERROR: {data.get('errors')}", file=sys.stderr)
                print(f"  SQL was: {sql[:200]}", file=sys.stderr)
                print(f"  Params: {str(params)[:200] if params else None}", file=sys.stderr)
                return None
            return data.get("result", [{}])[0].get("results")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        print(f"  HTTP {e.code}: {body[:500]}", file=sys.stderr)
        print(f"  SQL was: {sql[:200]}", file=sys.stderr)
        print(f"  Params: {str(params)[:200] if params else None}", file=sys.stderr)
        return None


def d1_execute(sql):
    """Execute a non-query statement."""
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps({"sql": sql}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
        if not data.get("success"):
            print(f"  D1 ERROR: {data.get('errors')}", file=sys.stderr)
            return False
        return True


def to_ascii(s):
    """ASCII transliteration for fallback (e.g. 'São' → 'Sao')."""
    if not s:
        return s
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


def main():
    global CLOUDFLARE_API_TOKEN
    CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not CLOUDFLARE_API_TOKEN:
        print("ERROR: CLOUDFLARE_API_TOKEN env var required", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Parse JSON only, don't write to D1")
    parser.add_argument("--skip-countries", action="store_true")
    parser.add_argument("--skip-states", action="store_true")
    parser.add_argument("--skip-translations", action="store_true")
    args = parser.parse_args()

    print(f"Loading {JSON_PATH}…", file=sys.stderr)
    t0 = time.time()
    with open(JSON_PATH) as f:
        countries = json.load(f)
    print(f"  Loaded {len(countries)} countries in {time.time() - t0:.1f}s", file=sys.stderr)

    if args.dry_run:
        print("DRY RUN — exiting before any D1 writes", file=sys.stderr)
        return

    # ============================================================
    # Step 1: Update countries with native, nationality, gdp
    # ============================================================
    if not args.skip_countries:
        print("\n[1/3] Updating countries (native, nationality, gdp)…", file=sys.stderr)
        t0 = time.time()
        count = 0
        for i, c in enumerate(countries):
            native = c.get("native") or None
            nationality = c.get("nationality") or None
            gdp = c.get("gdp")
            if gdp is not None and not isinstance(gdp, (int, float)):
                gdp = None
            cca2 = c.get("iso2")
            if not cca2:
                continue
            sql = "UPDATE countries SET native=?, nationality=?, gdp=? WHERE cca2=?"
            d1_query(sql, [native, nationality, gdp, cca2])
            count += 1
        print(f"  Updated {count} countries in {time.time() - t0:.1f}s", file=sys.stderr)

    # ============================================================
    # Step 2: Update states with iso3166_2, native, dr5hn_id
    #         Match strategy:
    #           1) (country_code, admin1_code) — works when GeoNames
    #              FIPS code matches dr5hn iso2 (US, GB, CA, DE, FR, etc.)
    #           2) (country_code, ascii_name) — fallback for countries
    #              where dr5hn uses ISO 3166-2 alphabetic codes but
    #              GeoNames uses numeric FIPS (CN, IN, BR, MX, etc.)
    # ============================================================
    if not args.skip_states:
        print("\n[2/3] Enriching states (iso3166_2, native, dr5hn_id)…", file=sys.stderr)
        t0 = time.time()
        matched_by_code = 0
        matched_by_name = 0
        no_match = 0

        for c in countries:
            cca2 = c.get("iso2")
            if not cca2:
                continue
            for s in c.get("states", []):
                dr5hn_id = s.get("id")
                iso3166_2 = s.get("iso3166_2")
                native = s.get("native")
                name = s.get("name")
                iso2 = s.get("iso2")
                ascii_name = to_ascii(name) if name else None

                # Try code match first (works for US, GB, CA, DE, etc.)
                if iso2 is not None:
                    sql = """UPDATE states
                             SET iso3166_2=?, native=?, dr5hn_id=?
                             WHERE country_code=? AND admin1_code=?"""
                    d1_query(sql, [iso3166_2, native, dr5hn_id, cca2, str(iso2)])
                    matched_by_code += 1

                # Fallback: match by (country_code, ascii_name) — works for
                # CN, IN, BR, etc. where dr5hn uses ISO 3166-2 alphabetic
                # but GeoNames uses numeric FIPS. This second UPDATE will
                # silently no-op if the first one already matched.
                if ascii_name:
                    sql = """UPDATE states
                             SET iso3166_2=?, native=?, dr5hn_id=?
                             WHERE country_code=? AND ascii_name=?
                             AND dr5hn_id IS NULL"""
                    d1_query(sql, [iso3166_2, native, dr5hn_id, cca2, ascii_name])
                    matched_by_name += 1

        print(f"  Matched by code: {matched_by_code}, by name: {matched_by_name}, no match: {no_match}",
              file=sys.stderr)
        print(f"  Done in {time.time() - t0:.1f}s", file=sys.stderr)

    # ============================================================
    # Step 3: Insert country_translations (cca2, lang, name)
    #         19 languages × 250 countries = ~4,750 rows
    # ============================================================
    if not args.skip_translations:
        print("\n[3/3] Inserting country_translations…", file=sys.stderr)
        t0 = time.time()

        all_rows = []
        for c in countries:
            cca2 = c.get("iso2")
            if not cca2:
                continue
            translations = c.get("translations") or {}
            for lang, name in translations.items():
                if not name or not isinstance(name, str):
                    continue
                all_rows.append((cca2, lang, name))

        print(f"  {len(all_rows)} translation rows", file=sys.stderr)

        # Insert in batches
        total_inserted = 0
        total_failed = 0
        for i in range(0, len(all_rows), BATCH_TRANSLATIONS):
            batch = all_rows[i:i + BATCH_TRANSLATIONS]
            placeholders = ",".join(["(?,?,?)"] * len(batch))
            flat_params = [p for row in batch for p in row]
            sql = f"INSERT OR IGNORE INTO country_translations (cca2, lang, name) VALUES {placeholders}"
            req = urllib.request.Request(
                f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
                data=json.dumps({"sql": sql, "params": flat_params}).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
                    "Content-Type": "application/json",
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = json.loads(r.read())
                    if not data.get("success"):
                        print(f"  D1 ERROR batch {i}: {data.get('errors')}", file=sys.stderr)
                        total_failed += len(batch)
                    else:
                        total_inserted += len(batch)
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", errors="ignore")
                print(f"  HTTP ERROR batch {i}: {e.code} — {body[:200]}", file=sys.stderr)
                total_failed += len(batch)
            except Exception as e:
                print(f"  ERROR batch {i}: {e}", file=sys.stderr)
                total_failed += len(batch)

            if (i // BATCH_TRANSLATIONS) % 20 == 0:
                print(f"  Progress: {i + len(batch)} / {len(all_rows)} ({total_inserted} ok, {total_failed} failed)",
                      file=sys.stderr)

        print(f"  Inserted {total_inserted} translations, {total_failed} failed in {time.time() - t0:.1f}s",
              file=sys.stderr)

    # ============================================================
    # Log to import_history
    # ============================================================
    summary = (
        f"Phase A seed completed. "
        f"Countries updated={not args.skip_countries}, "
        f"States enriched={not args.skip_states}, "
        f"Translations={not args.skip_translations}"
    )
    sql = """INSERT INTO import_history (source_id, rows_imported, rows_failed, notes)
             VALUES ('dr5hn', ?, 0, ?)"""
    n = len(countries) if not args.skip_countries else 0
    d1_query(sql, [n, summary])
    print(f"\n{summary}", file=sys.stderr)
    print("Done.", file=sys.stderr)


if __name__ == "__main__":
    main()
