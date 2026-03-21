"""
Export all Supabase tables to Parquet via the REST API.

Uses the Supabase REST API (not psycopg2) to avoid DNS/pooler issues.
Large tables are partitioned by state_code or geography_type for manageable chunks.

Usage:
    python scripts/export-large-tables-to-parquet.py
    python scripts/export-large-tables-to-parquet.py --table redfin_zip
    python scripts/export-large-tables-to-parquet.py --skip-small
"""

import argparse
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

SUPABASE_URL = "https://pysflbhpnqwoczyuaaif.supabase.co"
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

OUTPUT_DIR = Path(__file__).parent.parent / "data" / "parquet"
PAGE_SIZE = 1000
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

STATES = [
    "AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL",
    "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA",
    "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE",
    "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY",
]

STATE_PARTITIONED = {
    "redfin_zip": "state_code",
    "redfin_county": "state_code",
}

GEO_PARTITIONED = {
    "propertyiq_scores_v2": {"col": "geography", "values": ["metro", "county", "zip"]},
    "propertyiq_backtest_outcomes": {"col": "geography_type", "values": ["metro", "county", "zip"]},
}

SMALL_TABLES = [
    "market_briefings", "market_news", "paywall_events", "beta_feedback",
    "rankings_cache", "census_division_mapping", "daily_analytics",
    "user_events", "app_config", "reports", "user_sessions",
    "page_classifications", "user_profiles", "report_news_cache",
    "analytics_watchlist", "funnel_definitions", "beta_testers",
    "newsletter_signups", "ai_marketing_insights", "growth_goals",
    "score_performance_metrics",
]


def fetch_page(table: str, filters: dict | None = None, offset: int = 0,
               limit: int = PAGE_SIZE, select: str = "*") -> list:
    """Fetch a page of data with retries."""
    params = {"select": select, "offset": str(offset), "limit": str(limit)}
    if filters:
        params.update(filters)

    url = f"{SUPABASE_URL}/rest/v1/{table}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Accept": "application/json",
    })

    for attempt in range(MAX_RETRIES):
        try:
            resp = urllib.request.urlopen(req, timeout=120)
            return json.loads(resp.read())
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                print(f"      [FAIL] offset {offset} after {MAX_RETRIES} retries: {e}", flush=True)
                return []


def fetch_all_pages(table: str, filters: dict | None = None, label: str = "") -> list:
    """Paginate through all rows for a given table + filters."""
    all_rows = []
    offset = 0

    while True:
        rows = fetch_page(table, filters=filters, offset=offset)
        if not rows:
            break
        all_rows.extend(rows)
        offset += PAGE_SIZE
        if len(all_rows) % 10000 == 0 and len(all_rows) > 0:
            print(f"      {label}{len(all_rows):,} rows...", flush=True)
        if len(rows) < PAGE_SIZE:
            break

    return all_rows


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize types so schemas are consistent across partitions.

    - Convert all numeric-looking columns to float64 (prevents int64 vs float64 mismatches)
    - Convert dict/list columns to JSON strings
    - Convert null-only columns to string type
    """
    for col in df.columns:
        # Convert complex objects to JSON strings
        if df[col].dtype == object:
            sample = df[col].dropna().head(5)
            if any(isinstance(v, (dict, list)) for v in sample):
                df[col] = df[col].apply(lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x)

        # Coerce numeric columns to float64 (avoids int64 vs float64 schema mismatches)
        if pd.api.types.is_integer_dtype(df[col]):
            if col != "id":  # Keep integer id columns as-is
                df[col] = df[col].astype("float64")
        elif pd.api.types.is_float_dtype(df[col]):
            df[col] = df[col].astype("float64")

    return df


def rows_to_arrow(rows: list, schema: pa.Schema | None = None) -> pa.Table | None:
    """Convert rows to Arrow Table with normalized types."""
    if not rows:
        return None
    df = pd.DataFrame(rows)
    df = normalize_dataframe(df)

    if schema is not None:
        # Cast to match existing schema
        arrow = pa.Table.from_pandas(df, preserve_index=False)
        try:
            arrow = arrow.cast(schema)
        except (pa.ArrowInvalid, pa.ArrowNotImplementedError):
            # If cast fails, try column-by-column coercion
            new_columns = []
            for i, field in enumerate(schema):
                col = arrow.column(field.name)
                if col.type != field.type:
                    try:
                        col = col.cast(field.type)
                    except (pa.ArrowInvalid, pa.ArrowNotImplementedError):
                        # Last resort: cast both to string
                        col = col.cast(pa.string())
                new_columns.append(col)
            arrow = pa.table({field.name: col for field, col in zip(schema, new_columns)})
        return arrow
    else:
        return pa.Table.from_pandas(df, preserve_index=False)


def write_partition(writer_ref: list, output_path: Path, arrow: pa.Table):
    """Write a partition, creating writer on first call. writer_ref is [writer_or_None]."""
    if writer_ref[0] is None:
        writer_ref[0] = pq.ParquetWriter(str(output_path), arrow.schema)
    writer_ref[0].write_table(arrow)


def export_small_table(table: str):
    """Export a small table in one shot."""
    output_path = OUTPUT_DIR / f"{table}.parquet"
    print(f"[EXPORT] {table}...", end=" ", flush=True)
    start = time.time()

    rows = fetch_all_pages(table)
    if not rows:
        print("empty, skipped")
        return

    arrow = rows_to_arrow(rows)
    pq.write_table(arrow, str(output_path))
    elapsed = time.time() - start
    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"{len(rows):,} rows, {size_mb:.1f} MB, {elapsed:.1f}s")


def export_state_partitioned(table: str, state_col: str):
    """Export a large table by querying each state separately."""
    output_path = OUTPUT_DIR / f"{table}.parquet"
    writer_ref = [None]  # mutable ref for write_partition
    schema = None
    total_rows = 0
    start = time.time()

    print(f"\n[EXPORT] {table} (by {state_col})...")

    try:
        for i, state in enumerate(STATES):
            filters = {state_col: f"eq.{state}"}
            rows = fetch_all_pages(table, filters=filters)

            if not rows:
                continue

            arrow = rows_to_arrow(rows, schema=schema)
            if arrow is None:
                continue

            if schema is None:
                schema = arrow.schema

            write_partition(writer_ref, output_path, arrow)
            total_rows += len(rows)
            del rows, arrow

            elapsed = time.time() - start
            print(
                f"    [{i+1}/{len(STATES)}] {state}: {total_rows:>12,} rows total  ({elapsed:.0f}s)",
                flush=True,
            )
    finally:
        if writer_ref[0] is not None:
            writer_ref[0].close()

    elapsed = time.time() - start
    if output_path.exists():
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"    => {total_rows:,} rows, {size_mb:.1f} MB, {elapsed:.1f}s")

    return total_rows


def export_geo_partitioned(table: str, geo_col: str, geo_values: list):
    """Export a table partitioned by geography type, with state sub-partition for zip."""
    output_path = OUTPUT_DIR / f"{table}.parquet"
    writer_ref = [None]
    schema = None
    total_rows = 0
    start = time.time()

    print(f"\n[EXPORT] {table} (by {geo_col})...")

    try:
        for geo in geo_values:
            if geo == "zip":
                has_state = table == "propertyiq_backtest_outcomes"

                if has_state:
                    for i, state in enumerate(STATES):
                        filters = {geo_col: f"eq.{geo}", "state_code": f"eq.{state}"}
                        rows = fetch_all_pages(table, filters=filters)
                        if not rows:
                            continue
                        arrow = rows_to_arrow(rows, schema=schema)
                        if arrow is None:
                            continue
                        if schema is None:
                            schema = arrow.schema
                        write_partition(writer_ref, output_path, arrow)
                        total_rows += len(rows)
                        del rows, arrow
                        elapsed = time.time() - start
                        print(
                            f"    {geo}/{state} [{i+1}/{len(STATES)}]: {total_rows:>12,} rows  ({elapsed:.0f}s)",
                            flush=True,
                        )
                else:
                    # propertyiq_scores_v2 zip - 5.4M rows, no state_code
                    # Paginate through all of them
                    print(f"    {geo}: paginating...", flush=True)
                    rows = fetch_all_pages(table, filters={geo_col: f"eq.{geo}"}, label=f"{geo}: ")
                    if rows:
                        arrow = rows_to_arrow(rows, schema=schema)
                        if arrow is not None:
                            if schema is None:
                                schema = arrow.schema
                            write_partition(writer_ref, output_path, arrow)
                            total_rows += len(rows)
                            del rows, arrow
            else:
                filters = {geo_col: f"eq.{geo}"}
                rows = fetch_all_pages(table, filters=filters, label=f"{geo}: ")
                if not rows:
                    continue
                arrow = rows_to_arrow(rows, schema=schema)
                if arrow is None:
                    continue
                if schema is None:
                    schema = arrow.schema
                write_partition(writer_ref, output_path, arrow)
                total_rows += len(rows)
                del rows, arrow

            elapsed = time.time() - start
            print(f"    {geo} done: {total_rows:>12,} rows total  ({elapsed:.0f}s)", flush=True)

    finally:
        if writer_ref[0] is not None:
            writer_ref[0].close()

    elapsed = time.time() - start
    if output_path.exists():
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"    => {total_rows:,} rows, {size_mb:.1f} MB, {elapsed:.1f}s")

    return total_rows


def main():
    parser = argparse.ArgumentParser(description="Export Supabase tables to Parquet via REST API")
    parser.add_argument("--table", help="Export a specific table only")
    parser.add_argument("--skip-small", action="store_true", help="Skip small tables")
    parser.add_argument("--skip-large", action="store_true", help="Skip large tables")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {OUTPUT_DIR}\n")

    if not args.skip_small:
        for table in SMALL_TABLES:
            if args.table and args.table != table:
                continue
            try:
                export_small_table(table)
            except Exception as e:
                print(f"  [ERROR] {table}: {e}")

    if args.skip_large:
        print("\nSkipped large tables (--skip-large)")
        return

    for table, state_col in STATE_PARTITIONED.items():
        if args.table and args.table != table:
            continue
        try:
            export_state_partitioned(table, state_col)
        except Exception as e:
            print(f"  [ERROR] {table}: {e}")

    for table, config in GEO_PARTITIONED.items():
        if args.table and args.table != table:
            continue
        try:
            export_geo_partitioned(table, config["col"], config["values"])
        except Exception as e:
            print(f"  [ERROR] {table}: {e}")

    print("\nDone!")


if __name__ == "__main__":
    main()
