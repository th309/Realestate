"""
Backfill ZIP pre-2020 backtest outcomes (1Y, 3Y, 5Y price appreciation).

Calculates actual price returns from Zillow ZHVI data and upserts into
propertyiq_backtest_outcomes. Does NOT require scores — score_value is NULL,
matching how metro/county pre-2020 outcomes were generated.

Phase 1: Download ZHVI data for all ZIPs (2015-2024) into local cache.
Phase 2: Calculate 1Y/3Y/5Y returns, upsert to Supabase with monthly checkpoints.

Usage:
    python scripts/backfill-zip-pre2020-outcomes.py
    python scripts/backfill-zip-pre2020-outcomes.py --resume
    python scripts/backfill-zip-pre2020-outcomes.py --phase 1   # Only download cache
    python scripts/backfill-zip-pre2020-outcomes.py --phase 2   # Only calculate+upload
"""

import argparse
import calendar
import json
import math
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SUPABASE_URL = "https://pysflbhpnqwoczyuaaif.supabase.co"
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

CACHE_DIR = Path("data/checkpoints")
ZHVI_CACHE = CACHE_DIR / "zhvi_zip_cache.parquet"
PROGRESS_FILE = CACHE_DIR / "zip_outcome_progress.json"

# Score dates to generate: 2015-01 through 2019-12
SCORE_YEARS = range(2015, 2020)
SCORE_TYPES = ["homeready", "investoredge", "markethealth"]

# We need ZHVI data from 2015-01 through 2024-12 (for 5Y outcomes from 2019-12)
ZHVI_START_YEAR = 2015
ZHVI_END_YEAR = 2024

UPSERT_BATCH_SIZE = 500


# ---------------------------------------------------------------------------
# Supabase REST helpers
# ---------------------------------------------------------------------------

def fetch_page(table, params, retries=3):
    """Fetch a page from Supabase REST API with retries."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Accept": "application/json",
    })
    for attempt in range(retries):
        try:
            resp = urllib.request.urlopen(req, timeout=60)
            return json.loads(resp.read())
        except Exception as e:
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f"    [retry {attempt+1}] {e} — waiting {wait}s", flush=True)
                time.sleep(wait)
            else:
                raise


def upsert_rows(rows, retries=3):
    """Upsert rows to propertyiq_backtest_outcomes via REST API."""
    url = f"{SUPABASE_URL}/rest/v1/propertyiq_backtest_outcomes"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    })
    for attempt in range(retries):
        try:
            resp = urllib.request.urlopen(req, timeout=120)
            return resp.status
        except Exception as e:
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f"    [upsert retry {attempt+1}] {e} — waiting {wait}s", flush=True)
                time.sleep(wait)
            else:
                raise


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def score_date_to_zhvi_date(score_date_str):
    """Convert first-of-month score_date to end-of-month zillow period_date.
    '2015-01-01' -> '2015-01-31'
    """
    y, m = int(score_date_str[:4]), int(score_date_str[5:7])
    last_day = calendar.monthrange(y, m)[1]
    return f"{y:04d}-{m:02d}-{last_day:02d}"


def add_months(score_date_str, months):
    """Add months to a first-of-month date string. Returns first-of-month."""
    y, m = int(score_date_str[:4]), int(score_date_str[5:7])
    m += months
    while m > 12:
        y += 1
        m -= 12
    return f"{y:04d}-{m:02d}-01"


# ---------------------------------------------------------------------------
# Phase 1: Download ZHVI cache
# ---------------------------------------------------------------------------

def download_zhvi_cache():
    """Download all ZHVI ZIP data for the needed date range."""
    if ZHVI_CACHE.exists():
        existing = pd.read_parquet(ZHVI_CACHE)
        print(f"  Existing cache: {len(existing):,} rows", flush=True)
        cached_dates = set(existing["period_date"].unique())
    else:
        existing = None
        cached_dates = set()

    all_chunks = []
    if existing is not None:
        all_chunks.append(existing)

    # Generate all end-of-month dates we need
    needed_dates = []
    for year in range(ZHVI_START_YEAR, ZHVI_END_YEAR + 1):
        for month in range(1, 13):
            last_day = calendar.monthrange(year, month)[1]
            date_str = f"{year:04d}-{month:02d}-{last_day:02d}"
            if date_str not in cached_dates:
                needed_dates.append(date_str)

    if not needed_dates:
        print("  ZHVI cache is complete — no dates to download.", flush=True)
        return existing if existing is not None else pd.DataFrame()

    print(f"  Downloading ZHVI for {len(needed_dates)} months...", flush=True)
    total_rows = 0

    for i, date in enumerate(needed_dates):
        rows = []
        offset = 0
        while True:
            page = fetch_page("zillow_zip", {
                "select": "region_name,state_code,value",
                "metric_name": "eq.zhvi",
                "period_date": f"eq.{date}",
                "order": "region_name",
                "offset": str(offset),
                "limit": "1000",
            })
            if not page:
                break
            rows.extend(page)
            offset += 1000
            if len(page) < 1000:
                break

        if rows:
            df = pd.DataFrame(rows)
            df["period_date"] = date
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
            all_chunks.append(df)
            total_rows += len(rows)

        if (i + 1) % 12 == 0 or i == len(needed_dates) - 1:
            print(f"    [{i+1}/{len(needed_dates)}] {date}: {len(rows):,} ZIPs "
                  f"(cumulative: {total_rows:,})", flush=True)
            # Save intermediate cache
            combined = pd.concat(all_chunks, ignore_index=True)
            combined.to_parquet(ZHVI_CACHE, engine="pyarrow", index=False)

    combined = pd.concat(all_chunks, ignore_index=True)
    combined.to_parquet(ZHVI_CACHE, engine="pyarrow", index=False)
    print(f"  Cache saved: {len(combined):,} rows -> {ZHVI_CACHE}", flush=True)
    return combined


# ---------------------------------------------------------------------------
# Phase 2: Calculate outcomes and upsert
# ---------------------------------------------------------------------------

def load_progress():
    """Load checkpoint of completed score_dates."""
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"completed_months": []}


def save_progress(progress):
    """Save checkpoint."""
    PROGRESS_FILE.write_text(json.dumps(progress, indent=2))


def calculate_and_upload_outcomes(zhvi_df, resume=False):
    """Calculate 1Y/3Y/5Y outcomes from ZHVI data and upsert to Supabase."""

    # Build lookup: (region_name, period_date) -> value
    print("  Building ZHVI lookup table...", flush=True)
    zhvi_lookup = {}
    for _, row in zhvi_df.iterrows():
        key = (row["region_name"], row["period_date"])
        zhvi_lookup[key] = row["value"]

    # Build state_code lookup: region_name -> state_code
    state_lookup = {}
    for _, row in zhvi_df.dropna(subset=["state_code"]).iterrows():
        state_lookup[row["region_name"]] = row["state_code"]

    # Get distinct ZIPs
    all_zips = sorted(zhvi_df["region_name"].unique())
    print(f"  Total ZIPs in cache: {len(all_zips):,}", flush=True)

    # Load progress
    progress = load_progress() if resume else {"completed_months": []}
    completed = set(progress["completed_months"])

    # Generate all score dates
    score_dates = []
    for year in SCORE_YEARS:
        for month in range(1, 13):
            score_dates.append(f"{year:04d}-{month:02d}-01")

    remaining = [d for d in score_dates if d not in completed]
    print(f"  Score dates: {len(score_dates)} total, {len(completed)} completed, "
          f"{len(remaining)} remaining", flush=True)

    if not remaining:
        print("  All months already completed!", flush=True)
        return

    total_upserted = 0
    overall_start = time.time()

    for idx, score_date in enumerate(remaining):
        month_start = time.time()
        zhvi_date = score_date_to_zhvi_date(score_date)

        # Future dates for each horizon
        date_1y = score_date_to_zhvi_date(add_months(score_date, 12))
        date_3y = score_date_to_zhvi_date(add_months(score_date, 36))
        date_5y = score_date_to_zhvi_date(add_months(score_date, 60))

        rows_to_upsert = []

        for zip_code in all_zips:
            start_val = zhvi_lookup.get((zip_code, zhvi_date))
            if start_val is None or start_val <= 0:
                continue

            val_1y = zhvi_lookup.get((zip_code, date_1y))
            val_3y = zhvi_lookup.get((zip_code, date_3y))
            val_5y = zhvi_lookup.get((zip_code, date_5y))

            # Calculate returns
            outcome_1y = ((val_1y - start_val) / start_val * 100) if val_1y and val_1y > 0 else None
            outcome_3y = None
            if val_3y and val_3y > 0:
                try:
                    outcome_3y = (math.pow(val_3y / start_val, 1.0 / 3) - 1) * 100
                except (ValueError, ZeroDivisionError):
                    pass
            outcome_5y = None
            if val_5y and val_5y > 0:
                try:
                    outcome_5y = (math.pow(val_5y / start_val, 1.0 / 5) - 1) * 100
                except (ValueError, ZeroDivisionError):
                    pass

            # Skip if no outcomes at all
            if outcome_1y is None and outcome_3y is None and outcome_5y is None:
                continue

            state_code = state_lookup.get(zip_code)

            # Create one row per score_type (matching metro/county pattern)
            for score_type in SCORE_TYPES:
                row = {
                    "geography_id": zip_code,
                    "geography_type": "zip",
                    "score_type": score_type,
                    "score_date": score_date,
                    "score_value": None,
                    "state_code": state_code,
                    "outcome_1y_value": round(outcome_1y, 4) if outcome_1y is not None else None,
                    "outcome_3y_value": round(outcome_3y, 4) if outcome_3y is not None else None,
                    "outcome_5y_value": round(outcome_5y, 4) if outcome_5y is not None else None,
                }
                rows_to_upsert.append(row)

        # Upsert in batches
        month_upserted = 0
        for i in range(0, len(rows_to_upsert), UPSERT_BATCH_SIZE):
            batch = rows_to_upsert[i:i + UPSERT_BATCH_SIZE]
            try:
                upsert_rows(batch)
                month_upserted += len(batch)
            except Exception as e:
                print(f"    [ERROR] batch at offset {i}: {e}", flush=True)

        total_upserted += month_upserted
        elapsed = time.time() - month_start

        # Save checkpoint
        progress["completed_months"].append(score_date)
        save_progress(progress)

        zips_with_data = month_upserted // len(SCORE_TYPES) if month_upserted > 0 else 0
        print(f"  [{idx+1}/{len(remaining)}] {score_date}: "
              f"{zips_with_data:,} ZIPs × 3 types = {month_upserted:,} rows "
              f"({elapsed:.1f}s)", flush=True)

    total_elapsed = time.time() - overall_start
    mins = total_elapsed / 60
    print(f"\n  Done: {total_upserted:,} rows upserted in {mins:.1f} minutes", flush=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume", action="store_true",
                        help="Resume from checkpoint, skip completed months")
    parser.add_argument("--phase", type=int, choices=[1, 2],
                        help="Run only phase 1 (download) or phase 2 (calculate+upload)")
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("  ZIP PRE-2020 BACKTEST OUTCOME BACKFILL")
    print("=" * 65)
    print(f"  Score dates:  2015-01 to 2019-12 (60 months)")
    print(f"  ZHVI range:   2015-01 to 2024-12 (for 5Y horizon)")
    print(f"  Score types:  {', '.join(SCORE_TYPES)}")
    print(f"  Resume:       {args.resume}")
    print()

    # Phase 1: Download ZHVI cache
    if args.phase is None or args.phase == 1:
        print("PHASE 1: Download ZHVI ZIP data")
        print("-" * 40)
        zhvi_df = download_zhvi_cache()
        print()
    else:
        zhvi_df = None

    # Phase 2: Calculate and upload
    if args.phase is None or args.phase == 2:
        print("PHASE 2: Calculate outcomes and upload")
        print("-" * 40)
        if zhvi_df is None:
            if not ZHVI_CACHE.exists():
                print("  ERROR: ZHVI cache not found. Run phase 1 first.", flush=True)
                return
            zhvi_df = pd.read_parquet(ZHVI_CACHE)
            print(f"  Loaded cache: {len(zhvi_df):,} rows", flush=True)
        calculate_and_upload_outcomes(zhvi_df, resume=args.resume)

    print("\nBackfill complete.")


if __name__ == "__main__":
    main()
