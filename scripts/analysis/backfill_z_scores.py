#!/usr/bin/env python3
"""
Backfill z_scores JSONB column in propertyiq_scores.

For each (geography, score_date) group:
  1. Pull raw metric values from source tables
  2. Compute z-scores: (value - mean) / stddev across all locations at that date
  3. Update propertyiq_scores.z_scores with the JSONB map

Usage:
    python backfill_z_scores.py                     # all geo levels
    python backfill_z_scores.py --geo-level metro    # metro only
    python backfill_z_scores.py --geo-level zip --dry-run  # preview only
"""

import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import psycopg2
import psycopg2.extras

SUPABASE_PROJECT_REF = "pysflbhpnqwoczyuaaif"

# All candidate metrics we want z-scores for (superset of all formulas)
ALL_METRICS = [
    "hotness_score",
    "demand_score",
    "supply_score",
    "pending_ratio",
    "price_reduced_share",
    "median_days_on_market",
    "active_listing_count_yy",
    "price_reduced_count_yy",
    "population_yoy",
    "unemployment_rate_yoy",
    "median_gross_rent",
    "homeownership_rate",
    "rent_price_ratio",
    "affordability_ratio",
    "zhvi_yoy",
    "zori_yoy",
    "inventory_yoy",
]


def get_db_connection():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        print("[DB] Connecting via DATABASE_URL ...")
        return psycopg2.connect(database_url)
    host = "aws-1-us-east-1.pooler.supabase.com"
    port = 6543
    user = f"postgres.{SUPABASE_PROJECT_REF}"
    password = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    conn_str = (
        f"host={host} port={port} dbname=postgres "
        f"user={user} password={password} sslmode=require"
    )
    print(f"[DB] Connecting to {host}:{port} ...")
    return psycopg2.connect(conn_str)


# ---------------------------------------------------------------------------
# Raw metric queries per geography level
# ---------------------------------------------------------------------------

def _build_metro_query(score_date: str) -> str:
    """SQL to pull raw metrics for all metros at a given score_date."""
    end_prev_month = (pd.Timestamp(score_date) - timedelta(days=1)).strftime("%Y-%m-%d")
    year = pd.Timestamp(score_date).year
    return f"""
        SELECT
            r.cbsa_code AS location_id,
            r.hotness_score,
            r.demand_score,
            r.supply_score,
            r.pending_ratio,
            r.price_reduced_share,
            r.median_days_on_market,
            r.active_listing_count_yy,
            r.price_reduced_count_yy,
            r.median_listing_price,
            c.population_yoy,
            c.median_gross_rent,
            c.homeownership_rate,
            e.unemployment_rate_yoy,
            COALESCE(cm1.rent_to_price_ratio, cm2.rent_to_price_ratio) AS rent_price_ratio,
            COALESCE(cm1.zhvi_yoy_change, cm2.zhvi_yoy_change) AS zhvi_yoy,
            COALESCE(cm1.zori_yoy_change, cm2.zori_yoy_change) AS zori_yoy,
            COALESCE(cm1.inventory_yoy_change, cm2.inventory_yoy_change) AS inventory_yoy
        FROM realtor_metro r
        LEFT JOIN census_metro c
            ON c.cbsa_code = r.cbsa_code AND c.year = {year}
        LEFT JOIN economic_metro e
            ON e.cbsa_code = r.cbsa_code AND e.period_date = '{score_date}'
        LEFT JOIN calculated_metrics cm1
            ON cm1.geography_id = r.cbsa_code
            AND cm1.geography_type = 'metro'
            AND cm1.period_date = '{score_date}'
        LEFT JOIN calculated_metrics cm2
            ON cm2.geography_id = r.cbsa_code
            AND cm2.geography_type = 'metro'
            AND cm2.period_date = '{end_prev_month}'
            AND cm1.id IS NULL
        WHERE r.period_date = '{score_date}'
    """


def _build_county_query(score_date: str) -> str:
    end_prev_month = (pd.Timestamp(score_date) - timedelta(days=1)).strftime("%Y-%m-%d")
    year = pd.Timestamp(score_date).year
    return f"""
        SELECT
            r.county_fips AS location_id,
            r.hotness_score,
            r.demand_score,
            r.supply_score,
            r.pending_ratio,
            r.price_reduced_share,
            r.median_days_on_market,
            r.active_listing_count_yy,
            r.price_reduced_count_yy,
            r.median_listing_price,
            c.population_yoy,
            c.median_gross_rent,
            c.homeownership_rate,
            e.unemployment_rate_yoy,
            COALESCE(cm1.rent_to_price_ratio, cm2.rent_to_price_ratio) AS rent_price_ratio,
            COALESCE(cm1.zhvi_yoy_change, cm2.zhvi_yoy_change) AS zhvi_yoy,
            COALESCE(cm1.zori_yoy_change, cm2.zori_yoy_change) AS zori_yoy,
            COALESCE(cm1.inventory_yoy_change, cm2.inventory_yoy_change) AS inventory_yoy
        FROM realtor_county r
        LEFT JOIN census_county c
            ON c.fips_code = r.county_fips AND c.year = {year}
        LEFT JOIN economic_county e
            ON e.fips_code = r.county_fips AND e.period_date = '{score_date}'
        LEFT JOIN calculated_metrics cm1
            ON cm1.geography_id = r.county_fips
            AND cm1.geography_type = 'county'
            AND cm1.period_date = '{score_date}'
        LEFT JOIN calculated_metrics cm2
            ON cm2.geography_id = r.county_fips
            AND cm2.geography_type = 'county'
            AND cm2.period_date = '{end_prev_month}'
            AND cm1.id IS NULL
        WHERE r.period_date = '{score_date}'
    """


def _build_zip_query(score_date: str) -> str:
    end_prev_month = (pd.Timestamp(score_date) - timedelta(days=1)).strftime("%Y-%m-%d")
    year = pd.Timestamp(score_date).year
    return f"""
        SELECT
            r.postal_code AS location_id,
            r.hotness_score,
            r.demand_score,
            r.supply_score,
            r.pending_ratio,
            r.price_reduced_share,
            r.median_days_on_market,
            r.active_listing_count_yy,
            r.price_reduced_count_yy,
            r.median_listing_price,
            c.population_yoy,
            c.median_gross_rent,
            c.homeownership_rate,
            NULL::numeric AS unemployment_rate_yoy,
            COALESCE(cm1.rent_to_price_ratio, cm2.rent_to_price_ratio) AS rent_price_ratio,
            COALESCE(cm1.zhvi_yoy_change, cm2.zhvi_yoy_change) AS zhvi_yoy,
            COALESCE(cm1.zori_yoy_change, cm2.zori_yoy_change) AS zori_yoy,
            COALESCE(cm1.inventory_yoy_change, cm2.inventory_yoy_change) AS inventory_yoy
        FROM realtor_zip r
        LEFT JOIN census_zip c
            ON c.zcta = r.postal_code AND c.year = {year}
        LEFT JOIN calculated_metrics cm1
            ON cm1.geography_id = r.postal_code
            AND cm1.geography_type = 'zip'
            AND cm1.period_date = '{score_date}'
        LEFT JOIN calculated_metrics cm2
            ON cm2.geography_id = r.postal_code
            AND cm2.geography_type = 'zip'
            AND cm2.period_date = '{end_prev_month}'
            AND cm1.id IS NULL
        WHERE r.period_date = '{score_date}'
    """


QUERY_BUILDERS = {
    "metro": _build_metro_query,
    "county": _build_county_query,
    "zip": _build_zip_query,
}


# ---------------------------------------------------------------------------
# Z-score computation
# ---------------------------------------------------------------------------

def compute_z_scores(df: pd.DataFrame, metric_cols: List[str]) -> Dict[str, Dict[str, float]]:
    """
    Compute z-scores for each location across all metric columns.
    Returns {location_id: {metric: z_score, ...}, ...}
    """
    result = {}
    # Compute affordability_ratio from median_listing_price and median_gross_rent
    if "median_listing_price" in df.columns and "median_gross_rent" in df.columns:
        mask = (df["median_listing_price"] > 0) & (df["median_gross_rent"] > 0)
        df.loc[mask, "affordability_ratio"] = (
            df.loc[mask, "median_listing_price"] / (df.loc[mask, "median_gross_rent"] * 12.0)
        )

    for loc_id in df["location_id"]:
        result[loc_id] = {}

    for metric in metric_cols:
        if metric not in df.columns:
            continue
        values = pd.to_numeric(df[metric], errors="coerce")
        valid = values.dropna()
        if len(valid) < 2:
            continue
        mean = valid.mean()
        std = valid.std(ddof=0)  # Population stddev (matches scoring engine)
        if std == 0 or np.isnan(std):
            continue
        for idx, row in df.iterrows():
            val = values.loc[idx]
            if pd.notna(val):
                z = float((val - mean) / std)
                result[row["location_id"]][metric] = round(z, 6)

    return result


# ---------------------------------------------------------------------------
# Main backfill logic
# ---------------------------------------------------------------------------

def get_score_dates(conn, geo_level: str) -> List[str]:
    """Get all distinct score_dates for a geography level."""
    cur = conn.cursor()
    cur.execute(
        "SELECT DISTINCT score_date FROM propertyiq_scores WHERE geography = %s ORDER BY score_date",
        (geo_level,),
    )
    dates = [row[0].strftime("%Y-%m-%d") if hasattr(row[0], "strftime") else str(row[0]) for row in cur.fetchall()]
    cur.close()
    return dates


def backfill_geo_level(conn, geo_level: str, dry_run: bool = False) -> int:
    """Backfill z_scores for all score_dates at a geography level."""
    score_dates = get_score_dates(conn, geo_level)
    print(f"\n{'='*60}")
    print(f"Backfilling z_scores for {geo_level}: {len(score_dates)} dates")
    print(f"{'='*60}")

    query_builder = QUERY_BUILDERS[geo_level]
    total_updated = 0
    t0 = time.time()

    for i, score_date in enumerate(score_dates):
        t1 = time.time()

        # 1. Pull raw metrics
        query = query_builder(score_date)
        try:
            df = pd.read_sql(query, conn)
        except Exception as e:
            print(f"  [{score_date}] ERROR pulling raw metrics: {e}")
            continue

        if df.empty:
            print(f"  [{score_date}] No raw data found, skipping")
            continue

        # Deduplicate (in case of multiple rows per location)
        df = df.drop_duplicates(subset=["location_id"], keep="first")

        # 2. Compute z-scores
        z_scores_map = compute_z_scores(df, ALL_METRICS)

        # Filter to only locations with at least 1 z-score
        updates = [(json.dumps(zs), loc_id, score_date, geo_level)
                    for loc_id, zs in z_scores_map.items() if zs]

        if not updates:
            print(f"  [{score_date}] No z-scores to write (0/{len(df)} locations)")
            continue

        # 3. Update database
        if not dry_run:
            cur = conn.cursor()
            psycopg2.extras.execute_batch(
                cur,
                """UPDATE propertyiq_scores
                   SET z_scores = %s::jsonb
                   WHERE location_id = %s
                     AND score_date = %s
                     AND geography = %s""",
                updates,
                page_size=500,
            )
            conn.commit()
            cur.close()

        total_updated += len(updates)
        elapsed = time.time() - t1
        total_elapsed = time.time() - t0

        avg_z = np.mean([len(zs) for _, zs in z_scores_map.items() if zs]) if z_scores_map else 0
        print(
            f"  [{score_date}] {len(updates):,} locations updated "
            f"(avg {avg_z:.1f} metrics/loc) "
            f"[{elapsed:.1f}s] "
            f"({i+1}/{len(score_dates)}, total: {total_updated:,}, "
            f"elapsed: {total_elapsed:.0f}s)"
        )

    print(f"\n  {geo_level} DONE: {total_updated:,} location-dates updated in {time.time()-t0:.0f}s")
    return total_updated


def verify_backfill(conn, geo_level: str):
    """Verify z_scores were populated."""
    cur = conn.cursor()
    cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(z_scores) as with_z,
            COUNT(*) - COUNT(z_scores) as without_z
        FROM propertyiq_scores
        WHERE geography = %s
    """, (geo_level,))
    total, with_z, without_z = cur.fetchone()
    pct = (with_z / total * 100) if total > 0 else 0
    print(f"  Verification [{geo_level}]: {with_z:,}/{total:,} rows have z_scores ({pct:.1f}%)")

    # Sample a z_scores value
    cur.execute("""
        SELECT location_id, score_date, z_scores
        FROM propertyiq_scores
        WHERE geography = %s AND z_scores IS NOT NULL
        LIMIT 1
    """, (geo_level,))
    row = cur.fetchone()
    if row:
        z = row[2] if isinstance(row[2], dict) else json.loads(row[2])
        print(f"  Sample ({row[0]}, {row[1]}): {len(z)} metrics: {list(z.keys())}")
    cur.close()


def main():
    parser = argparse.ArgumentParser(description="Backfill z_scores in propertyiq_scores")
    parser.add_argument(
        "--geo-level",
        choices=["metro", "county", "zip", "all"],
        default="all",
        help="Geography level to backfill",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    conn = get_db_connection()

    geo_levels = ["metro", "county", "zip"] if args.geo_level == "all" else [args.geo_level]

    grand_total = 0
    for geo in geo_levels:
        count = backfill_geo_level(conn, geo, dry_run=args.dry_run)
        grand_total += count

    # Verify
    print(f"\n{'='*60}")
    print("VERIFICATION")
    print(f"{'='*60}")
    for geo in geo_levels:
        verify_backfill(conn, geo)

    print(f"\nGrand total: {grand_total:,} location-dates updated")
    if args.dry_run:
        print("(DRY RUN - no actual updates were made)")

    conn.close()


if __name__ == "__main__":
    main()
