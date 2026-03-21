"""
Append 2015-2019 backtest outcomes to the existing propertyiq-ml parquet cache.

Uses the same REST API approach as export_data.py.
Filters for score_date < 2020-01-01 only.
Saves checkpoints every 50K rows so progress isn't lost on crash.
At the end, merges checkpoints + existing parquet into one file.

Usage:
    python scripts/backfill-backtest-to-parquet.py --geo-level county
    python scripts/backfill-backtest-to-parquet.py --geo-level zip
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

PARQUET_FILE = Path("D:/projects/propertyiq-ml/data/cache/propertyiq_backtest_outcomes.parquet")
CHECKPOINT_DIR = Path("D:/projects/rei-platform/data/checkpoints")


SELECT_COLUMNS = ",".join([
    "geography_id", "geography_type", "score_type", "score_date",
    "score_value", "state_code", "outcome_6m_value", "outcome_1y_value",
    "outcome_3y_value", "outcome_5y_value",
    "state_return_1y", "state_return_3y_cagr", "state_return_5y_cagr",
    "national_return_1y", "national_return_3y_cagr", "national_return_5y_cagr",
    "excess_vs_state_1y", "excess_vs_state_3y", "excess_vs_state_5y",
    "excess_vs_national_1y", "excess_vs_national_3y", "excess_vs_national_5y",
    "rent_return_1y", "rent_return_3y_cagr",
    "state_rent_return_1y", "state_rent_return_3y_cagr",
    "national_rent_return_1y", "national_rent_return_3y_cagr",
    "created_at",
])


def fetch_page(geo_type, offset, limit=1000, retries=3):
    """Fetch a page of pre-2020 data from the Supabase REST API with retries."""
    params = {
        "select": SELECT_COLUMNS,
        "geography_type": f"eq.{geo_type}",
        "score_date": "lt.2020-01-01",
        "order": "score_date,geography_id",
        "offset": str(offset),
        "limit": str(limit),
    }
    url = f"{SUPABASE_URL}/rest/v1/propertyiq_backtest_outcomes?{urllib.parse.urlencode(params)}"
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
                print(f"  [retry {attempt+1}] offset {offset}: {e} — waiting {wait}s", flush=True)
                time.sleep(wait)
            else:
                raise


def save_checkpoint(rows, geo_type, chunk_num):
    """Save a chunk of rows as a parquet checkpoint."""
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    path = CHECKPOINT_DIR / f"backtest_{geo_type}_chunk_{chunk_num:04d}.parquet"
    df.to_parquet(path, engine="pyarrow", index=False)
    print(f"  [checkpoint] saved {len(rows):,} rows -> {path.name}", flush=True)
    return path


def fetch_page_by_date(geo_type, date_start, date_end, offset, limit=1000, retries=3):
    """Fetch a page filtered by date range (avoids large offset scans)."""
    params = {
        "select": SELECT_COLUMNS,
        "geography_type": f"eq.{geo_type}",
        "score_date": f"gte.{date_start}",
        "and": f"(score_date.lt.{date_end})",
        "order": "score_date,geography_id",
        "offset": str(offset),
        "limit": str(limit),
    }
    url = f"{SUPABASE_URL}/rest/v1/propertyiq_backtest_outcomes?{urllib.parse.urlencode(params)}"
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
                print(f"  [retry {attempt+1}] {date_start} offset {offset}: {e} — waiting {wait}s", flush=True)
                time.sleep(wait)
            else:
                raise


def export_pre2020(geo_type):
    """Export all pre-2020 backtest data by year to avoid large offset scans."""
    print(f"\nExporting {geo_type} pre-2020 data (by year)...", flush=True)
    start = time.time()

    chunk_num = len(list(CHECKPOINT_DIR.glob(f"backtest_{geo_type}_chunk_*.parquet")))
    total_rows = 0
    all_rows = []
    checkpoint_size = 50_000

    for year in range(2015, 2020):
        date_start = f"{year}-01-01"
        date_end = f"{year + 1}-01-01"
        offset = 0
        year_rows = 0

        while True:
            try:
                rows = fetch_page_by_date(geo_type, date_start, date_end, offset)
            except Exception as e:
                print(f"  [STOP] {year} offset {offset}: {e}", flush=True)
                break
            if not rows:
                break
            all_rows.extend(rows)
            year_rows += len(rows)
            total_rows += len(rows)
            offset += 1000

            if len(all_rows) >= checkpoint_size:
                save_checkpoint(all_rows, geo_type, chunk_num)
                all_rows = []
                chunk_num += 1

            if len(rows) < 1000:
                break

        print(f"  {year}: {year_rows:,} rows", flush=True)

    # Save remaining rows
    if all_rows:
        save_checkpoint(all_rows, geo_type, chunk_num)

    elapsed = time.time() - start
    print(f"  Done: {total_rows:,} rows in {elapsed:.0f}s", flush=True)
    return total_rows


def merge_into_parquet():
    """Merge all checkpoints into the existing parquet file."""
    import pyarrow.parquet as pq

    checkpoint_files = sorted(CHECKPOINT_DIR.glob("backtest_*_chunk_*.parquet"))
    if not checkpoint_files:
        print("No checkpoint files to merge.")
        return

    print(f"\nMerging {len(checkpoint_files)} checkpoint files into {PARQUET_FILE.name}...")

    # Read existing parquet
    existing = pd.read_parquet(PARQUET_FILE)
    existing_schema = pq.read_schema(PARQUET_FILE)
    print(f"  Existing: {len(existing):,} rows")

    # Read all checkpoints
    chunks = [pd.read_parquet(f) for f in checkpoint_files]
    new_data = pd.concat(chunks, ignore_index=True)
    print(f"  New data: {len(new_data):,} rows")

    # Drop columns not in existing (e.g. 'id', 'updated_at')
    extra_cols = [c for c in new_data.columns if c not in existing.columns]
    if extra_cols:
        print(f"  Dropping extra columns: {extra_cols}")
        new_data = new_data.drop(columns=extra_cols)

    # Add missing columns
    for col in existing.columns:
        if col not in new_data.columns:
            new_data[col] = None

    # Reorder to match existing
    new_data = new_data[existing.columns]

    # Fix key type mismatches before concat
    # score_date: existing is date, checkpoint is string
    if new_data["score_date"].dtype == object:
        new_data["score_date"] = pd.to_datetime(new_data["score_date"]).dt.date
    if existing["score_date"].dtype == object:
        existing["score_date"] = pd.to_datetime(existing["score_date"]).dt.date

    # created_at: existing is datetime, checkpoint is string
    if "created_at" in new_data.columns and new_data["created_at"].dtype == object:
        new_data["created_at"] = pd.to_datetime(new_data["created_at"], utc=True, errors="coerce")

    # outcome_metrics: convert struct to string to avoid schema conflicts
    if "outcome_metrics" in existing.columns:
        existing["outcome_metrics"] = existing["outcome_metrics"].apply(
            lambda x: json.dumps(x) if isinstance(x, dict) else str(x) if x is not None else None
        )
        new_data["outcome_metrics"] = new_data["outcome_metrics"].apply(
            lambda x: json.dumps(x) if isinstance(x, dict) else str(x) if x is not None else None
        )

    # Cast numeric columns — force all to float64 to avoid int/float conflicts
    for col in new_data.columns:
        if col in ["geography_id", "geography_type", "score_type", "state_code",
                    "score_date", "created_at", "outcome_metrics"]:
            continue
        existing[col] = pd.to_numeric(existing[col], errors="coerce")
        new_data[col] = pd.to_numeric(new_data[col], errors="coerce")

    # Concat and deduplicate
    combined = pd.concat([existing, new_data], ignore_index=True)
    before = len(combined)
    combined = combined.drop_duplicates(
        subset=["geography_id", "geography_type", "score_type", "score_date"],
        keep="last"
    )
    dupes = before - len(combined)
    if dupes:
        print(f"  Removed {dupes:,} duplicates")

    # Sort
    combined = combined.sort_values(["geography_type", "score_date", "geography_id"]).reset_index(drop=True)

    # Save
    combined.to_parquet(PARQUET_FILE, engine="pyarrow", index=False)
    mb = PARQUET_FILE.stat().st_size / (1024 * 1024)
    print(f"  Saved: {len(combined):,} rows, {mb:.1f} MB -> {PARQUET_FILE}")

    # Clean up checkpoints
    for f in checkpoint_files:
        f.unlink()
    print(f"  Cleaned up {len(checkpoint_files)} checkpoint files")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--geo-level", choices=["metro", "county", "zip", "all"], required=True)
    parser.add_argument("--merge-only", action="store_true", help="Skip export, just merge existing checkpoints")
    args = parser.parse_args()

    if not args.merge_only:
        geos = ["metro", "county", "zip"] if args.geo_level == "all" else [args.geo_level]
        total = 0
        for geo in geos:
            total += export_pre2020(geo)
        print(f"\nTotal exported: {total:,} rows")

    merge_into_parquet()


if __name__ == "__main__":
    main()
