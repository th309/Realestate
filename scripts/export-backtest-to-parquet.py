"""
Export propertyiq_backtest_outcomes to Parquet via Supabase REST API.

Paginates by year to avoid deep-offset scans, and streams to a ParquetWriter
so rows hit disk every 50K instead of accumulating in memory.

Usage:
    python scripts/export-backtest-to-parquet.py
    python scripts/export-backtest-to-parquet.py --geo-level county
    python scripts/export-backtest-to-parquet.py --geo-level zip --resume
"""

import argparse
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

SUPABASE_URL = "https://pysflbhpnqwoczyuaaif.supabase.co"
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

OUTPUT_DIR = Path(__file__).parent.parent / "data" / "parquet"
CHECKPOINT_DIR = Path(__file__).parent.parent / "data" / "checkpoints"

COLUMNS = [
    "geography_id", "geography_type", "score_type", "score_date",
    "score_value", "state_code",
    "outcome_6m_value", "outcome_1y_value", "outcome_3y_value", "outcome_5y_value",
    "state_return_1y", "state_return_3y_cagr", "state_return_5y_cagr",
    "national_return_1y", "national_return_3y_cagr", "national_return_5y_cagr",
    "excess_vs_state_1y", "excess_vs_state_3y", "excess_vs_state_5y",
    "excess_vs_national_1y", "excess_vs_national_3y", "excess_vs_national_5y",
    "rent_return_1y", "rent_return_3y_cagr",
    "state_rent_return_1y", "state_rent_return_3y_cagr",
    "national_rent_return_1y", "national_rent_return_3y_cagr",
]

SELECT = ",".join(COLUMNS)
FLUSH_EVERY = 50_000  # rows between parquet writes


def fetch_page(geo_type, offset, limit=1000, date_gte=None, date_lt=None,
               state_code=None, retries=3):
    """Fetch a page of data from the Supabase REST API with retries."""
    params = {
        "select": SELECT,
        "geography_type": f"eq.{geo_type}",
        "order": "score_date,geography_id",
        "offset": str(offset),
        "limit": str(limit),
    }
    if date_gte:
        params["score_date"] = f"gte.{date_gte}"
    if date_lt:
        params["and"] = f"(score_date.lt.{date_lt})"
    if state_code:
        params["state_code"] = f"eq.{state_code}"

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
    print(f"  [checkpoint] {len(rows):,} rows -> {path.name}", flush=True)


def merge_checkpoints(geo_type):
    """Merge all checkpoint files into the final parquet output."""
    checkpoint_files = sorted(CHECKPOINT_DIR.glob(f"backtest_{geo_type}_chunk_*.parquet"))
    if not checkpoint_files:
        print(f"  No checkpoints to merge for {geo_type}")
        return 0

    print(f"\n  Merging {len(checkpoint_files)} checkpoints...", flush=True)
    chunks = [pd.read_parquet(f) for f in checkpoint_files]
    combined = pd.concat(chunks, ignore_index=True)

    # Deduplicate
    before = len(combined)
    combined = combined.drop_duplicates(
        subset=["geography_id", "geography_type", "score_type", "score_date"],
        keep="last",
    )
    dupes = before - len(combined)
    if dupes:
        print(f"  Removed {dupes:,} duplicates", flush=True)

    combined = combined.sort_values(["score_date", "geography_id"]).reset_index(drop=True)

    output_path = OUTPUT_DIR / f"backtest_{geo_type}.parquet"
    combined.to_parquet(output_path, engine="pyarrow", index=False)
    mb = output_path.stat().st_size / (1024 * 1024)
    print(f"  Saved: {len(combined):,} rows, {mb:.1f} MB -> {output_path.name}", flush=True)

    # Clean up checkpoints
    for f in checkpoint_files:
        f.unlink()
    print(f"  Cleaned up {len(checkpoint_files)} checkpoint files", flush=True)

    return len(combined)


US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "PR",
    "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
    "WI", "WY",
]


def _paginate_partition(geo_type, year, state_code=None):
    """Fetch all rows for a (geo_type, year, state) partition."""
    date_gte = f"{year}-01-01"
    date_lt = f"{year + 1}-01-01"
    offset = 0
    rows_out = []
    while True:
        try:
            rows = fetch_page(geo_type, offset, date_gte=date_gte, date_lt=date_lt,
                              state_code=state_code)
        except Exception as e:
            tag = f"{year}/{state_code}" if state_code else str(year)
            print(f"  [STOP] {tag} offset {offset}: {e}", flush=True)
            break
        if not rows:
            break
        rows_out.extend(rows)
        offset += 1000
        if len(rows) < 1000:
            break
    return rows_out


def export_geo_level(geo_type, resume=False):
    """Export all backtest data for a geography level.

    metro/county: partition by year.
    zip: partition by year × state (avoids 500 errors on the large table).
    """
    use_state_partition = (geo_type == "zip")
    strategy = "by year × state" if use_state_partition else "by year"
    print(f"\nExporting {geo_type} ({strategy})...", flush=True)
    start = time.time()

    # Check existing checkpoints for resume
    existing_chunks = len(list(CHECKPOINT_DIR.glob(f"backtest_{geo_type}_chunk_*.parquet")))
    if resume and existing_chunks > 0:
        print(f"  Resuming: found {existing_chunks} existing checkpoints", flush=True)
    elif not resume:
        for f in CHECKPOINT_DIR.glob(f"backtest_{geo_type}_chunk_*.parquet"):
            f.unlink()
        existing_chunks = 0

    chunk_num = existing_chunks
    total_rows = 0
    buffer = []

    for year in range(2015, 2027):
        year_rows = 0

        if use_state_partition:
            for state in US_STATES:
                rows = _paginate_partition(geo_type, year, state_code=state)
                if rows:
                    buffer.extend(rows)
                    year_rows += len(rows)
                    total_rows += len(rows)

                if len(buffer) >= FLUSH_EVERY:
                    save_checkpoint(buffer, geo_type, chunk_num)
                    buffer = []
                    chunk_num += 1
        else:
            rows = _paginate_partition(geo_type, year)
            if rows:
                buffer.extend(rows)
                year_rows += len(rows)
                total_rows += len(rows)

            if len(buffer) >= FLUSH_EVERY:
                save_checkpoint(buffer, geo_type, chunk_num)
                buffer = []
                chunk_num += 1

        if year_rows > 0:
            print(f"  {year}: {year_rows:,} rows (total: {total_rows:,})", flush=True)

    if buffer:
        save_checkpoint(buffer, geo_type, chunk_num)

    elapsed = time.time() - start
    print(f"  Export complete: {total_rows:,} rows in {elapsed:.0f}s", flush=True)

    final_count = merge_checkpoints(geo_type)
    return final_count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--geo-level", choices=["metro", "county", "zip", "all"],
                        default="all")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from existing checkpoints instead of starting fresh")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Output: {OUTPUT_DIR}")
    print(f"Checkpoints: {CHECKPOINT_DIR}\n")

    geos = ["metro", "county", "zip"] if args.geo_level == "all" else [args.geo_level]

    total = 0
    for geo in geos:
        total += export_geo_level(geo, resume=args.resume)

    print(f"\nTotal: {total:,} rows exported")


if __name__ == "__main__":
    main()
