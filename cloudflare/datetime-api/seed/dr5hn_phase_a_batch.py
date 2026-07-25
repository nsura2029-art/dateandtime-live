#!/usr/bin/env python3
"""
Phase 13 (dr5hn Phase A) seed script — BATCHED version.

Faster than the per-row version: builds a CASE expression for each
state we want to update, then sends ONE big UPDATE per ~100 states.

Reads the dr5hn countries+states+cities JSON and seeds the dev D1:
  1. country enrichment (native, nationality, gdp) — UPDATE countries
  2. states enrichment (iso3166_2, native, dr5hn_id) — batched UPDATE states
  3. country_translations — INSERT OR IGNORE (already batched)

Match strategy for states:
  Two passes:
    Pass A: match by (country_code, admin1_code) — covers ~50% of states
    Pass B: match by (country_code, ascii_name) — covers the rest
  Each pass is one big UPDATE with CASE expressions.

Usage:
  CLOUDFLARE_API_TOKEN=xxx python3 dr5hn_phase_a_batch.py [--dry-run]
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

# D1 SQL limit: ~100KB per statement + max expression tree depth 100.
# Each CASE WHEN in our UPDATE counts as a depth node, so we cap at
# ~30 WHEN clauses per column. With 3 columns (iso/native/dr5hn_id)
# that's ~90 nodes per statement, under the 100 limit.
BATCH_STATES = 30
BATCH_TRANSLATIONS = 30
BATCH_COUNTRIES = 50


def d1_execute(sql, params=None, dry=False):
    """Execute a SQL statement (UPDATE/INSERT)."""
    if dry:
        print(f"  [DRY] SQL: {sql[:200]}", file=sys.stderr)
        return True
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
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
            if not data.get("success"):
                print(f"  D1 ERROR: {data.get('errors')}", file=sys.stderr)
                return False
            return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        print(f"  HTTP {e.code}: {body[:300]}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  ERROR: {e}", file=sys.stderr)
        return False


def to_ascii(s):
    if not s:
        return s
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


def quote_sql(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def main():
    global CLOUDFLARE_API_TOKEN
    CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not CLOUDFLARE_API_TOKEN:
        print("ERROR: CLOUDFLARE_API_TOKEN env var required", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-countries", action="store_true")
    parser.add_argument("--skip-states", action="store_true")
    parser.add_argument("--skip-translations", action="store_true")
    args = parser.parse_args()

    print(f"Loading {JSON_PATH}…", file=sys.stderr)
    t0 = time.time()
    with open(JSON_PATH) as f:
        countries = json.load(f)
    print(f"  Loaded {len(countries)} countries in {time.time() - t0:.1f}s", file=sys.stderr)

    # ============================================================
    # Step 1: country enrichment (batched UPDATE)
    # ============================================================
    if not args.skip_countries:
        print("\n[1/3] Updating countries (native, nationality, gdp)…", file=sys.stderr)
        t0 = time.time()
        # Build a single big UPDATE with CASE expressions
        case_clauses = []
        for c in countries:
            cca2 = c.get("iso2")
            if not cca2:
                continue
            native = c.get("native") or None
            nationality = c.get("nationality") or None
            gdp = c.get("gdp")
            if gdp is not None and not isinstance(gdp, (int, float)):
                gdp = None
            case_clauses.append(
                f"WHEN cca2 = {quote_sql(cca2)} THEN {quote_sql(native)}"
            )
        native_cases = " ".join(case_clauses)

        nat_clauses = []
        for c in countries:
            cca2 = c.get("iso2")
            if not cca2:
                continue
            nationality = c.get("nationality") or None
            nat_clauses.append(
                f"WHEN cca2 = {quote_sql(cca2)} THEN {quote_sql(nationality)}"
            )
        nat_cases = " ".join(nat_clauses)

        gdp_clauses = []
        for c in countries:
            cca2 = c.get("iso2")
            if not cca2:
                continue
            gdp = c.get("gdp")
            if gdp is not None and not isinstance(gdp, (int, float)):
                gdp = None
            gdp_clauses.append(
                f"WHEN cca2 = {quote_sql(cca2)} THEN {gdp if gdp is not None else 'NULL'}"
            )
        gdp_cases = " ".join(gdp_clauses)

        sql = f"""UPDATE countries SET
                    native = CASE {native_cases} ELSE native END,
                    nationality = CASE {nat_cases} ELSE nationality END,
                    gdp = CASE {gdp_cases} ELSE gdp END"""
        if d1_execute(sql, dry=args.dry_run):
            print(f"  Updated {len(countries)} countries in {time.time() - t0:.1f}s", file=sys.stderr)

    # ============================================================
    # Step 2: states enrichment (batched CASE UPDATE)
    # Two passes: by code first, then by name
    # ============================================================
    if not args.skip_states:
        print("\n[2/3] Enriching states (iso3166_2, native, dr5hn_id)…", file=sys.stderr)
        t0 = time.time()

        # Pass A: match by (country_code, admin1_code) where admin1_code = dr5hn.iso2
        # Build the (cca2, admin1_code) -> (iso3166_2, native, dr5hn_id) map
        code_map = {}  # (cca2, admin1_code) -> (iso3166_2, native, dr5hn_id)
        name_map = {}  # (cca2, ascii_name) -> (iso3166_2, native, dr5hn_id, dr5hn_state_name)
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
                if iso2 is not None:
                    code_map[(cca2, str(iso2))] = (iso3166_2, native, dr5hn_id)
                if ascii_name:
                    name_map[(cca2, ascii_name)] = (iso3166_2, native, dr5hn_id, name)

        print(f"  Built {len(code_map)} code matches, {len(name_map)} name matches",
              file=sys.stderr)

        # Pass A: build CASE expressions for code matches
        def build_case_update(key_pairs, key_sql):
            """Build a big UPDATE with CASE expressions.
            key_pairs: list of (key_tuple, (val1, val2, val3))
            key_sql: function that takes key_tuple and returns SQL string for WHERE
            """
            # Group by chunks to avoid massive SQL
            iso_cases, nat_cases, id_cases = [], [], []
            where_conditions = []
            for (key_tuple, (iso3166_2, native, dr5hn_id)) in key_pairs:
                # Build the WHEN clause using the key
                # For code_map: (cca2, admin1_code) → "country_code = 'X' AND admin1_code = 'Y'"
                # For name_map: (cca2, ascii_name) → "country_code = 'X' AND ascii_name = 'Y'"
                where_cond = key_sql(key_tuple)
                iso_cases.append(f"WHEN {where_cond} THEN {quote_sql(iso3166_2)}")
                nat_cases.append(f"WHEN {where_cond} THEN {quote_sql(native)}")
                id_cases.append(f"WHEN {where_cond} THEN {dr5hn_id if dr5hn_id is not None else 'NULL'}")
                where_conditions.append(f"({where_cond})")

            # Build the SQL
            where_clause = " OR ".join(where_conditions)
            sql = f"""UPDATE states SET
                        iso3166_2 = CASE {' '.join(iso_cases)} ELSE iso3166_2 END,
                        native = CASE {' '.join(nat_cases)} ELSE native END,
                        dr5hn_id = CASE {' '.join(id_cases)} ELSE dr5hn_id END
                      WHERE {where_clause}"""
            return sql

        # Pass A — code matches
        code_pairs = list(code_map.items())
        for i in range(0, len(code_pairs), BATCH_STATES):
            batch = code_pairs[i:i + BATCH_STATES]
            def code_sql(key):
                return f"(country_code = {quote_sql(key[0])} AND admin1_code = {quote_sql(key[1])})"
            sql = build_case_update(batch, code_sql)
            d1_execute(sql, dry=args.dry_run)
            print(f"    Code batch {i // BATCH_STATES + 1}/{(len(code_pairs) + BATCH_STATES - 1) // BATCH_STATES}",
                  file=sys.stderr)
        print(f"  Code-match pass done in {time.time() - t0:.1f}s", file=sys.stderr)

        # Pass B — name matches (only for rows where dr5hn_id is still NULL)
        t1 = time.time()
        name_pairs = list(name_map.items())
        for i in range(0, len(name_pairs), BATCH_STATES):
            batch = name_pairs[i:i + BATCH_STATES]
            # Strip the 4th element (name) — only pass the (key, (val, val, val)) format
            batch = [(k, v[:3]) for (k, v) in batch]
            def name_sql(key):
                return f"(country_code = {quote_sql(key[0])} AND ascii_name = {quote_sql(key[1])})"
            sql = build_case_update(batch, name_sql)
            # Add the dr5hn_id IS NULL filter
            sql = sql.replace("WHERE", "WHERE dr5hn_id IS NULL AND (", 1)
            # The replace only happens once; need to close the paren
            sql = sql.rstrip() + ")"
            d1_execute(sql, dry=args.dry_run)
            print(f"    Name batch {i // BATCH_STATES + 1}/{(len(name_pairs) + BATCH_STATES - 1) // BATCH_STATES}",
                  file=sys.stderr)
        print(f"  Name-match pass done in {time.time() - t1:.1f}s", file=sys.stderr)
        print(f"  Total states enrichment: {time.time() - t0:.1f}s", file=sys.stderr)

    # ============================================================
    # Step 3: country_translations
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

        total_inserted = 0
        total_failed = 0
        for i in range(0, len(all_rows), BATCH_TRANSLATIONS):
            batch = all_rows[i:i + BATCH_TRANSLATIONS]
            placeholders = ",".join(["(?,?,?)"] * len(batch))
            flat_params = [p for row in batch for p in row]
            sql = f"INSERT OR IGNORE INTO country_translations (cca2, lang, name) VALUES {placeholders}"
            if d1_execute(sql, params=flat_params, dry=args.dry_run):
                total_inserted += len(batch)
            else:
                total_failed += len(batch)

            if (i // BATCH_TRANSLATIONS) % 20 == 0:
                print(f"  Progress: {i + len(batch)} / {len(all_rows)} ({total_inserted} ok)",
                      file=sys.stderr)

        print(f"  Inserted {total_inserted} translations, {total_failed} failed in {time.time() - t0:.1f}s",
              file=sys.stderr)

    print("\nDone.", file=sys.stderr)


if __name__ == "__main__":
    main()
