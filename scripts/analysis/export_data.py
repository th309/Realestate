"""
Export PropertyIQ backtest data from Supabase REST API to local CSV files.
Bypasses PostgreSQL connection issues (IPv6-only DNS).

Usage:
    python export_data.py
    python export_data.py --output-dir ./data
"""

import argparse
import csv
import json
import os
import sys
import urllib.request
import urllib.parse
from pathlib import Path

SUPABASE_URL = "https://pysflbhpnqwoczyuaaif.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I",
)

COLUMNS = [
    "geography_id", "geography_type", "score_type", "score_date",
    "score_value", "state_code", "outcome_1y_value", "outcome_3y_value",
    "excess_vs_state_1y", "excess_vs_state_3y",
    "excess_vs_national_1y", "excess_vs_national_3y",
    "rent_return_1y", "rent_return_3y_cagr",
]

SELECT = ",".join(COLUMNS)


def fetch_page(table: str, geo_type: str, offset: int, limit: int = 1000) -> list:
    """Fetch a page of data from the Supabase REST API."""
    params = {
        "select": SELECT,
        "geography_type": f"eq.{geo_type}",
        "order": "score_date,geography_id",
        "offset": str(offset),
        "limit": str(limit),
    }
    url = f"{SUPABASE_URL}/rest/v1/{table}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Accept": "application/json",
        "Prefer": "count=exact",
    })
    resp = urllib.request.urlopen(req, timeout=60)
    data = json.loads(resp.read())
    return data


def export_geo_level(geo_type: str, output_dir: Path) -> int:
    """Export all backtest data for a geography level to CSV."""
    output_file = output_dir / f"backtest_{geo_type}.csv"
    print(f"Exporting {geo_type} data to {output_file}...")

    total_rows = 0
    page_size = 1000
    offset = 0

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()

        while True:
            rows = fetch_page("propertyiq_backtest_outcomes", geo_type, offset, page_size)
            if not rows:
                break
            writer.writerows(rows)
            total_rows += len(rows)
            offset += page_size
            if total_rows % 10000 == 0:
                print(f"  ... {total_rows:,} rows exported")
            if len(rows) < page_size:
                break

    print(f"  Done: {total_rows:,} rows -> {output_file}")
    return total_rows


def export_census_division_mapping(output_dir: Path) -> int:
    """Export census division mapping."""
    output_file = output_dir / "census_division_mapping.csv"
    print(f"Exporting census division mapping to {output_file}...")

    url = f"{SUPABASE_URL}/rest/v1/census_division_mapping?select=state_code,division_id,division_name&order=state_code&limit=100"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Accept": "application/json",
    })
    resp = urllib.request.urlopen(req, timeout=30)
    rows = json.loads(resp.read())

    if rows:
        with open(output_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["state_code", "division_id", "division_name"])
            writer.writeheader()
            writer.writerows(rows)

    print(f"  Done: {len(rows)} rows -> {output_file}")
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="Export PropertyIQ data to CSV")
    parser.add_argument("--output-dir", default="scripts/analysis/data",
                        help="Output directory for CSV files")
    parser.add_argument("--geo-level", choices=["metro", "county", "zip", "all"],
                        default="all", help="Geography level to export")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    geo_levels = ["metro", "county", "zip"] if args.geo_level == "all" else [args.geo_level]

    grand_total = 0
    for geo in geo_levels:
        count = export_geo_level(geo, output_dir)
        grand_total += count

    export_census_division_mapping(output_dir)

    print(f"\nTotal: {grand_total:,} rows exported to {output_dir}")
    print("CSV files ready for analysis scripts with --csv-dir flag")


if __name__ == "__main__":
    main()
