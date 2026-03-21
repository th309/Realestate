"""
Export all Supabase data to Parquet files via REST API.

Same approach as export_data.py — paginate REST API at 1000 rows/page,
partition large tables by geography_type or state_code.

Usage:
    python scripts/export-all-to-parquet.py
    python scripts/export-all-to-parquet.py --table redfin_zip
"""

import argparse
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

SUPABASE_URL = "https://pysflbhpnqwoczyuaaif.supabase.co"
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

OUTPUT_DIR = Path(__file__).parent.parent / "data" / "parquet"
PAGE_SIZE = 1000

STATES = [
    "AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL",
    "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA",
    "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE",
    "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY",
]


def fetch_page(table, params):
    """Fetch one page from Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Accept": "application/json",
    })
    resp = urllib.request.urlopen(req, timeout=60)
    return json.loads(resp.read())


def fetch_all(table, filters=None, order="id"):
    """Paginate through a table. Returns list of dicts."""
    all_rows = []
    offset = 0
    params = {"select": "*", "order": order, "limit": str(PAGE_SIZE)}
    if filters:
        params.update(filters)

    while True:
        params["offset"] = str(offset)
        rows = fetch_page(table, params)
        if not rows:
            break
        all_rows.extend(rows)
        offset += PAGE_SIZE
        if len(all_rows) % 10000 == 0:
            print(f"      {len(all_rows):,} rows...", flush=True)
        if len(rows) < PAGE_SIZE:
            break

    return all_rows


def save_parquet(rows, output_path):
    """Save rows to parquet, handling JSONB columns."""
    df = pd.DataFrame(rows)
    for col in df.columns:
        if df[col].dtype == object:
            sample = df[col].dropna().head(5)
            if any(isinstance(v, (dict, list)) for v in sample):
                df[col] = df[col].apply(
                    lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x
                )
        # Coerce ints to float to prevent schema mismatches across partitions
        if pd.api.types.is_integer_dtype(df[col]) and col not in ("id",):
            df[col] = df[col].astype("float64")
    df.to_parquet(output_path, engine="pyarrow", index=False)
    return len(df)


def export_simple(table):
    """Export a small table directly."""
    print(f"[EXPORT] {table}...", end=" ", flush=True)
    start = time.time()
    rows = fetch_all(table)
    if not rows:
        print("empty")
        return
    path = OUTPUT_DIR / f"{table}.parquet"
    n = save_parquet(rows, path)
    mb = path.stat().st_size / (1024 * 1024)
    print(f"{n:,} rows, {mb:.1f} MB ({time.time()-start:.0f}s)")


def export_by_geo(table, geo_col, geo_values, state_col=None):
    """Export partitioned by geography, with optional state sub-partition."""
    print(f"\n[EXPORT] {table} (by {geo_col})...")
    start = time.time()
    all_rows = []

    for geo in geo_values:
        if geo == "zip" and state_col:
            for i, state in enumerate(STATES):
                rows = fetch_all(table, filters={
                    geo_col: f"eq.{geo}",
                    state_col: f"eq.{state}",
                })
                all_rows.extend(rows)
                elapsed = time.time() - start
                print(f"    {geo}/{state} [{i+1}/{len(STATES)}]: {len(all_rows):>12,} rows  ({elapsed:.0f}s)", flush=True)
        else:
            rows = fetch_all(table, filters={geo_col: f"eq.{geo}"})
            all_rows.extend(rows)
            elapsed = time.time() - start
            print(f"    {geo}: {len(all_rows):>12,} rows  ({elapsed:.0f}s)", flush=True)

    if all_rows:
        path = OUTPUT_DIR / f"{table}.parquet"
        n = save_parquet(all_rows, path)
        mb = path.stat().st_size / (1024 * 1024)
        print(f"    => {n:,} rows, {mb:.1f} MB ({time.time()-start:.0f}s)")


def export_by_state(table, state_col="state_code"):
    """Export partitioned by state."""
    print(f"\n[EXPORT] {table} (by {state_col})...")
    start = time.time()
    all_rows = []

    for i, state in enumerate(STATES):
        rows = fetch_all(table, filters={state_col: f"eq.{state}"})
        all_rows.extend(rows)
        elapsed = time.time() - start
        print(f"    [{i+1}/{len(STATES)}] {state}: {len(all_rows):>12,} rows  ({elapsed:.0f}s)", flush=True)

    if all_rows:
        path = OUTPUT_DIR / f"{table}.parquet"
        n = save_parquet(all_rows, path)
        mb = path.stat().st_size / (1024 * 1024)
        print(f"    => {n:,} rows, {mb:.1f} MB ({time.time()-start:.0f}s)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", help="Export specific table only")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Output: {OUTPUT_DIR}\n")

    # Define all tables and their export strategy
    tables = {
        # Small tables - direct export
        "market_briefings": "simple",
        "market_news": "simple",
        "paywall_events": "simple",
        "beta_feedback": "simple",
        "rankings_cache": "simple",
        "census_division_mapping": "simple",
        "daily_analytics": "simple",
        "user_events": "simple",
        "app_config": "simple",
        "reports": "simple",
        "user_sessions": "simple",
        "page_classifications": "simple",
        "user_profiles": "simple",
        "report_news_cache": "simple",
        "analytics_watchlist": "simple",
        "funnel_definitions": "simple",
        "beta_testers": "simple",
        "newsletter_signups": "simple",
        "ai_marketing_insights": "simple",
        "growth_goals": "simple",
        "score_performance_metrics": "simple",
        # Large tables - partitioned export
        "redfin_zip": "by_state",
        "redfin_county": "by_state",
        "propertyiq_scores_v2": "by_geo",
        "propertyiq_backtest_outcomes": "by_geo_state",
    }

    for table, strategy in tables.items():
        if args.table and args.table != table:
            continue
        try:
            if strategy == "simple":
                export_simple(table)
            elif strategy == "by_state":
                export_by_state(table)
            elif strategy == "by_geo":
                export_by_geo(table, "geography", ["metro", "county", "zip"])
            elif strategy == "by_geo_state":
                export_by_geo(table, "geography_type", ["metro", "county", "zip"], state_col="state_code")
        except Exception as e:
            print(f"  [ERROR] {table}: {e}")

    print("\nDone!")


if __name__ == "__main__":
    main()
