"""
Build backtest_zip.parquet from local sources — no Supabase queries needed.

Pre-2020: Reconstructed from ZHVI cache (same logic as backfill script).
Post-2020: Extracted from the ML cache parquet.

Usage:
    python scripts/build-zip-backtest-parquet.py
"""

import calendar
import math
from pathlib import Path

import pandas as pd

ZHVI_CACHE = Path("data/checkpoints/zhvi_zip_cache.parquet")
ML_CACHE = Path("D:/projects/propertyiq-ml/data/cache/propertyiq_backtest_outcomes.parquet")
OUTPUT = Path("data/parquet/backtest_zip.parquet")

SCORE_TYPES = ["homeready", "investoredge", "markethealth"]

# Columns to output (matches export-backtest-to-parquet.py)
OUTPUT_COLUMNS = [
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


def score_date_to_zhvi_date(score_date_str):
    y, m = int(score_date_str[:4]), int(score_date_str[5:7])
    last_day = calendar.monthrange(y, m)[1]
    return f"{y:04d}-{m:02d}-{last_day:02d}"


def add_months(score_date_str, months):
    y, m = int(score_date_str[:4]), int(score_date_str[5:7])
    m += months
    while m > 12:
        y += 1
        m -= 12
    return f"{y:04d}-{m:02d}-01"


def build_pre2020():
    """Reconstruct pre-2020 ZIP outcomes from ZHVI cache."""
    print("Building pre-2020 ZIP outcomes from ZHVI cache...", flush=True)
    zhvi_df = pd.read_parquet(ZHVI_CACHE)
    print(f"  ZHVI cache: {len(zhvi_df):,} rows, {zhvi_df['region_name'].nunique():,} ZIPs", flush=True)

    # Build lookup
    zhvi_lookup = {}
    state_lookup = {}
    for _, row in zhvi_df.iterrows():
        zhvi_lookup[(row["region_name"], row["period_date"])] = row["value"]
        if pd.notna(row.get("state_code")):
            state_lookup[row["region_name"]] = row["state_code"]

    all_zips = sorted(zhvi_df["region_name"].unique())

    rows = []
    for year in range(2015, 2020):
        year_count = 0
        for month in range(1, 13):
            score_date = f"{year:04d}-{month:02d}-01"
            zhvi_date = score_date_to_zhvi_date(score_date)
            date_1y = score_date_to_zhvi_date(add_months(score_date, 12))
            date_3y = score_date_to_zhvi_date(add_months(score_date, 36))
            date_5y = score_date_to_zhvi_date(add_months(score_date, 60))

            for zip_code in all_zips:
                start_val = zhvi_lookup.get((zip_code, zhvi_date))
                if start_val is None or start_val <= 0:
                    continue

                val_1y = zhvi_lookup.get((zip_code, date_1y))
                val_3y = zhvi_lookup.get((zip_code, date_3y))
                val_5y = zhvi_lookup.get((zip_code, date_5y))

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

                if outcome_1y is None and outcome_3y is None and outcome_5y is None:
                    continue

                state_code = state_lookup.get(zip_code)

                for score_type in SCORE_TYPES:
                    rows.append({
                        "geography_id": zip_code,
                        "geography_type": "zip",
                        "score_type": score_type,
                        "score_date": score_date,
                        "score_value": None,
                        "state_code": state_code,
                        "outcome_1y_value": round(outcome_1y, 4) if outcome_1y is not None else None,
                        "outcome_3y_value": round(outcome_3y, 4) if outcome_3y is not None else None,
                        "outcome_5y_value": round(outcome_5y, 4) if outcome_5y is not None else None,
                    })
                    year_count += 1

        print(f"  {year}: {year_count:,} rows", flush=True)

    df = pd.DataFrame(rows)
    print(f"  Total pre-2020: {len(df):,} rows", flush=True)
    return df


def extract_post2020():
    """Extract post-2020 ZIP outcomes from ML cache."""
    print("Extracting post-2020 ZIP outcomes from ML cache...", flush=True)
    ml_df = pd.read_parquet(ML_CACHE)
    zip_df = ml_df[ml_df["geography_type"] == "zip"].copy()

    # Filter post-2020
    zip_df["_date"] = pd.to_datetime(zip_df["score_date"])
    post = zip_df[zip_df["_date"] >= "2020-01-01"].drop(columns=["_date"])

    print(f"  Post-2020 ZIP from ML cache: {len(post):,} rows", flush=True)
    return post


def main():
    print("=" * 60)
    print("  BUILD backtest_zip.parquet FROM LOCAL SOURCES")
    print("=" * 60)
    print()

    # Pre-2020 from ZHVI cache
    pre_df = build_pre2020()
    print()

    # Post-2020 from ML cache
    post_df = extract_post2020()
    print()

    # Normalize columns — add missing columns as None
    for col in OUTPUT_COLUMNS:
        if col not in pre_df.columns:
            pre_df[col] = None
        if col not in post_df.columns:
            post_df[col] = None

    # Keep only output columns
    pre_df = pre_df[[c for c in OUTPUT_COLUMNS if c in pre_df.columns]]
    post_df = post_df[[c for c in OUTPUT_COLUMNS if c in post_df.columns]]

    # Normalize types before concat — score_date may be date vs string
    pre_df["score_date"] = pre_df["score_date"].astype(str)
    post_df["score_date"] = post_df["score_date"].astype(str)
    # Force all numeric columns to float64 to avoid int/float conflicts
    numeric_cols = [c for c in OUTPUT_COLUMNS if c not in
                    ("geography_id", "geography_type", "score_type", "score_date", "state_code")]
    for col in numeric_cols:
        if col in pre_df.columns:
            pre_df[col] = pd.to_numeric(pre_df[col], errors="coerce")
        if col in post_df.columns:
            post_df[col] = pd.to_numeric(post_df[col], errors="coerce")

    # Combine
    print("Combining pre-2020 + post-2020...", flush=True)
    combined = pd.concat([pre_df, post_df], ignore_index=True)

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

    # Save
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    combined.to_parquet(OUTPUT, engine="pyarrow", index=False)
    mb = OUTPUT.stat().st_size / (1024 * 1024)
    print(f"\nSaved: {len(combined):,} rows, {mb:.1f} MB -> {OUTPUT}", flush=True)

    # Summary
    combined["_date"] = pd.to_datetime(combined["score_date"])
    pre = (combined["_date"] < "2020-01-01").sum()
    post = (combined["_date"] >= "2020-01-01").sum()
    print(f"  Pre-2020:  {pre:,}")
    print(f"  Post-2020: {post:,}")
    print(f"  Date range: {combined['score_date'].min()} to {combined['score_date'].max()}")


if __name__ == "__main__":
    main()
