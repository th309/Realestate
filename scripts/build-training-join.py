"""
Join feature parquet files with backtest outcomes to see what we actually have
for training XGBoost/LightGBM models.

Does NOT modify any source files - creates new joined datasets.

Usage:
    python scripts/build-training-join.py
"""
import numpy as np
import pandas as pd
from pathlib import Path

ML_CACHE = Path("D:/projects/propertyiq-ml/data/cache")
BACKTEST_DIR = Path("D:/projects/rei-platform/data/parquet")
OUTPUT_DIR = Path("D:/projects/propertyiq-ml/data/training")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def to_month_str(series):
    """Normalize any date column to first-of-month string YYYY-MM-01."""
    return pd.to_datetime(series).dt.to_period("M").dt.to_timestamp().dt.strftime("%Y-%m-%d")


def load_outcomes(geo_level):
    path = BACKTEST_DIR / f"backtest_{geo_level}.parquet"
    df = pd.read_parquet(path)
    df["score_date"] = to_month_str(df["score_date"])
    # Use homeready only (outcomes are identical across score types)
    df = df[df["score_type"] == "homeready"].copy()
    print(f"  Outcomes ({geo_level}): {len(df):,} rows, {df['score_date'].min()} to {df['score_date'].max()}")
    return df


def dedup(df, label=""):
    """Deduplicate by _geo_id + _period, keeping last."""
    before = len(df)
    df = df.drop_duplicates(subset=["_geo_id", "_period"], keep="last")
    dropped = before - len(df)
    if dropped:
        print(f"    [{label}] deduped: {before:,} -> {len(df):,} ({dropped:,} dupes)")
    return df


def load_realtor(geo_level):
    file_map = {"metro": "realtor_metro.parquet", "county": "realtor_county.parquet", "zip": "realtor_zip.parquet"}
    id_map = {"metro": "cbsa_code", "county": "county_fips", "zip": "postal_code"}
    path = ML_CACHE / file_map[geo_level]
    df = pd.read_parquet(path)

    id_col = id_map[geo_level]
    if id_col not in df.columns:
        for alt in ["fips_code", "cbsa_code", "postal_code", "zip_code"]:
            if alt in df.columns:
                id_col = alt
                break

    df["_period"] = to_month_str(df["period_date"])
    df["_geo_id"] = df[id_col].astype(str)

    drop = {"period_date", "created_at", "quality_flag", "_period", "_geo_id",
            "cbsa_code", "cbsa_title", "postal_code", "zip_name", "county_fips",
            "fips_code", "county_name", "state_code", "state_fips"}
    feat_cols = [c for c in df.columns if c not in drop]
    result = dedup(df[["_geo_id", "_period"] + feat_cols].copy(), "realtor")
    print(f"  Realtor ({geo_level}): {len(result):,} rows, {len(feat_cols)} features, {result['_period'].min()} to {result['_period'].max()}")
    return result, feat_cols, "realtor"


def load_redfin(geo_level):
    file_map = {"metro": "redfin_metro.parquet", "county": "redfin_county.parquet", "zip": "redfin_zip.parquet"}
    id_map = {"metro": "cbsa_code", "county": "fips_code", "zip": "zip_code"}
    path = ML_CACHE / file_map[geo_level]
    if not path.exists():
        return None, None, None
    df = pd.read_parquet(path)

    id_col = id_map[geo_level]
    if id_col not in df.columns:
        for alt in ["cbsa_code", "fips_code", "zip_code", "region_id"]:
            if alt in df.columns:
                id_col = alt
                break

    date_col = "period_end" if "period_end" in df.columns else "period_begin"
    df["_period"] = to_month_str(df[date_col])
    df["_geo_id"] = df[id_col].astype(str)

    drop = {"period_begin", "period_end", "period_date", "created_at", "last_updated",
            "_period", "_geo_id", "cbsa_code", "region_name", "redfin_table_id",
            "property_type", "parent_metro_region", "parent_metro_region_metro_code",
            "zip_code", "state_code", "fips_code", "county_name"}
    feat_cols = [c for c in df.columns if c not in drop]

    # Prefix to avoid name collisions
    rename = {c: f"rf_{c}" for c in feat_cols}
    df = df.rename(columns=rename)
    feat_cols = [f"rf_{c}" for c in feat_cols]

    result = dedup(df[["_geo_id", "_period"] + feat_cols].copy(), "redfin")
    print(f"  Redfin ({geo_level}): {len(result):,} rows, {len(feat_cols)} features, {result['_period'].min()} to {result['_period'].max()}")
    return result, feat_cols, "redfin"


def load_calculated(geo_level):
    path = ML_CACHE / "calculated_metrics.parquet"
    df = pd.read_parquet(path)
    df = df[df["geography_type"] == geo_level].copy()

    df["_period"] = to_month_str(df["period_date"])
    df["_geo_id"] = df["geography_id"].astype(str)

    drop = {"geography_id", "geography_type", "geography_name", "period_date",
            "calculated_at", "created_at", "_period", "_geo_id"}
    feat_cols = [c for c in df.columns if c not in drop]
    rename = {c: f"calc_{c}" for c in feat_cols}
    df = df.rename(columns=rename)
    feat_cols = [f"calc_{c}" for c in feat_cols]

    result = dedup(df[["_geo_id", "_period"] + feat_cols].copy(), "calculated")
    print(f"  Calculated ({geo_level}): {len(result):,} rows, {len(feat_cols)} features, {result['_period'].min()} to {result['_period'].max()}")
    return result, feat_cols, "calculated"


def load_census(geo_level):
    file_map = {"metro": "census_metro.parquet", "county": "census_county.parquet", "zip": "census_zip.parquet"}
    id_map = {"metro": "cbsa_code", "county": "county_fips", "zip": "zcta"}
    path = ML_CACHE / file_map[geo_level]
    df = pd.read_parquet(path)

    id_col = id_map[geo_level]
    if id_col not in df.columns:
        for alt in ["cbsa_code", "county_fips", "fips_code", "zcta"]:
            if alt in df.columns:
                id_col = alt
                break

    df["_period"] = df["year"].apply(lambda y: f"{int(y):04d}-01-01")
    df["_geo_id"] = df[id_col].astype(str)

    drop = {"year", "created_at", "_period", "_geo_id", "cbsa_code", "cbsa_title",
            "zcta", "state_fips", "state_name", "county_fips", "county_name"}
    feat_cols = [c for c in df.columns if c not in drop]
    rename = {c: f"cen_{c}" for c in feat_cols}
    df = df.rename(columns=rename)
    feat_cols = [f"cen_{c}" for c in feat_cols]

    result = dedup(df[["_geo_id", "_period"] + feat_cols].copy(), "census")
    print(f"  Census ({geo_level}): {len(result):,} rows, {len(feat_cols)} features, years {result['_period'].min()} to {result['_period'].max()}")
    return result, feat_cols, "census"


def load_economic(geo_level):
    if geo_level == "zip":
        return None, None, None
    path = ML_CACHE / f"economic_{geo_level}.parquet"
    if not path.exists():
        return None, None, None
    df = pd.read_parquet(path)

    id_col = "cbsa_code" if geo_level == "metro" else "county_fips"
    if id_col not in df.columns:
        for alt in ["cbsa_code", "county_fips", "fips_code"]:
            if alt in df.columns:
                id_col = alt
                break

    df["_period"] = to_month_str(df["period_date"])
    df["_geo_id"] = df[id_col].astype(str)

    drop = {"period_date", "created_at", "_period", "_geo_id", "cbsa_code", "cbsa_title",
            "county_fips", "county_name", "state_fips", "fips_code", "state_name"}
    feat_cols = [c for c in df.columns if c not in drop]
    rename = {c: f"econ_{c}" for c in feat_cols}
    df = df.rename(columns=rename)
    feat_cols = [f"econ_{c}" for c in feat_cols]

    result = dedup(df[["_geo_id", "_period"] + feat_cols].copy(), "economic")
    print(f"  Economic ({geo_level}): {len(result):,} rows, {len(feat_cols)} features, {result['_period'].min()} to {result['_period'].max()}")
    return result, feat_cols, "economic"


def load_zillow_wide(geo_level):
    path = ML_CACHE / f"zillow_{geo_level}.parquet"
    if not path.exists():
        return None, None, None
    df = pd.read_parquet(path)

    if geo_level == "zip":
        id_col = "region_name"
    elif geo_level == "metro":
        id_col = "cbsa_code"
    elif geo_level == "county":
        id_col = "county_fips" if "county_fips" in df.columns else "region_id"
    else:
        id_col = "region_id"

    if id_col not in df.columns:
        print(f"    Zillow {geo_level}: id col not found")
        return None, None, None

    df["_period"] = to_month_str(df["period_date"])
    df["_geo_id"] = df[id_col].astype(str)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    metrics = sorted(df["metric_name"].unique())
    print(f"  Zillow ({geo_level}): {len(df):,} rows, {len(metrics)} metrics, pivoting...", flush=True)

    wide = df.pivot_table(index=["_geo_id", "_period"], columns="metric_name", values="value", aggfunc="first")
    wide = wide.reset_index()
    feat_cols = [c for c in wide.columns if c not in ["_geo_id", "_period"]]
    rename = {c: f"z_{c}" for c in feat_cols}
    wide = wide.rename(columns=rename)
    feat_cols = [f"z_{c}" for c in feat_cols]

    wide = dedup(wide, "zillow")
    print(f"    Pivoted: {len(wide):,} rows x {len(feat_cols)} features")
    return wide, feat_cols, "zillow"


def load_fred():
    path = ML_CACHE / "fred_macro.parquet"
    df = pd.read_parquet(path)
    df["_period"] = to_month_str(df["date"])

    drop = {"date", "_period"}
    feat_cols = [c for c in df.columns if c not in drop]
    rename = {c: f"fred_{c}" for c in feat_cols}
    df = df.rename(columns=rename)
    feat_cols = [f"fred_{c}" for c in feat_cols]

    # FRED has multiple dates per month — keep last per month
    df = df.sort_values("_period").drop_duplicates(subset=["_period"], keep="last")
    print(f"  FRED macro: {len(df):,} rows, {len(feat_cols)} features, {df['_period'].min()} to {df['_period'].max()}")
    return df[["_period"] + feat_cols].copy(), feat_cols, "fred"


def load_permits(geo_level):
    if geo_level != "county":
        return None, None, None
    path = ML_CACHE / "permits_county.parquet"
    if not path.exists():
        return None, None, None
    df = pd.read_parquet(path)

    id_col = "fips_code"
    if id_col not in df.columns:
        return None, None, None

    df["_period"] = to_month_str(df["period_date"])
    df["_geo_id"] = df[id_col].astype(str)

    drop = {"period_date", "created_at", "_period", "_geo_id", "fips_code",
            "county_name", "state_fips", "region_code", "division_code"}
    feat_cols = [c for c in df.columns if c not in drop]
    rename = {c: f"perm_{c}" for c in feat_cols}
    df = df.rename(columns=rename)
    feat_cols = [f"perm_{c}" for c in feat_cols]

    result = dedup(df[["_geo_id", "_period"] + feat_cols].copy(), "permits")
    print(f"  Permits ({geo_level}): {len(result):,} rows, {len(feat_cols)} features, {result['_period'].min()} to {result['_period'].max()}")
    return result, feat_cols, "permits"


def build_training_set(geo_level):
    print(f"\n{'='*60}")
    print(f"  BUILDING TRAINING SET: {geo_level.upper()}")
    print(f"{'='*60}\n")

    # Load outcomes
    outcomes = load_outcomes(geo_level)
    outcome_cols = [c for c in outcomes.columns if "outcome" in c or "excess" in c or "return" in c or "rent" in c]
    outcomes["_period"] = outcomes["score_date"]
    outcomes["_geo_id"] = outcomes["geography_id"].astype(str)

    joined = outcomes[["_geo_id", "_period"] + outcome_cols].copy()
    print(f"\n  Starting rows (outcomes): {len(joined):,}")

    all_feature_cols = []

    # Load each feature source
    loaders = [
        load_realtor(geo_level),
        load_redfin(geo_level),
        load_calculated(geo_level),
        load_census(geo_level),
        load_economic(geo_level),
        load_zillow_wide(geo_level),
        load_fred(),
        load_permits(geo_level),
    ]

    for result in loaders:
        if result is None or result[0] is None:
            continue
        feat_df, feat_cols, source_name = result

        if source_name == "fred":
            joined = joined.merge(feat_df, on="_period", how="left")
        elif source_name == "census":
            # Annual — map each monthly row to its year
            joined["_cen_year"] = pd.to_datetime(joined["_period"]).dt.year.apply(lambda y: f"{int(y):04d}-01-01")
            feat_df = feat_df.rename(columns={"_period": "_cen_year"})
            joined = joined.merge(feat_df, on=["_geo_id", "_cen_year"], how="left")
            joined.drop(columns=["_cen_year"], inplace=True)
        else:
            joined = joined.merge(feat_df, on=["_geo_id", "_period"], how="left")

        all_feature_cols.extend(feat_cols)
        coverages = [joined[c].notna().mean() * 100 for c in feat_cols if c in joined.columns]
        avg_cov = np.mean(coverages) if coverages else 0
        print(f"    -> After {source_name}: {len(joined):,} rows, avg coverage {avg_cov:.1f}%")

    # Summary
    print(f"\n{'~'*50}")
    print(f"  FINAL: {len(joined):,} rows x {len(all_feature_cols)} feature columns")

    if "outcome_3y_value" in joined.columns:
        has_3y = joined["outcome_3y_value"].notna().sum()
        print(f"  Rows with 3Y outcome: {has_3y:,} ({has_3y/len(joined)*100:.1f}%)")
    if "outcome_5y_value" in joined.columns:
        has_5y = joined["outcome_5y_value"].notna().sum()
        print(f"  Rows with 5Y outcome: {has_5y:,} ({has_5y/len(joined)*100:.1f}%)")

    # Feature coverage tiers
    good, sparse, empty = [], [], []
    for c in all_feature_cols:
        if c in joined.columns:
            pct = joined[c].notna().mean() * 100
            if pct >= 50:
                good.append((c, round(pct, 1)))
            elif pct > 5:
                sparse.append((c, round(pct, 1)))
            else:
                empty.append((c, round(pct, 1)))

    print(f"\n  Features with >50% data: {len(good)}")
    print(f"  Features with 5-50% data: {len(sparse)}")
    print(f"  Features with <5% data: {len(empty)}")

    # Show the good features
    if good:
        print(f"\n  Top features (>50% coverage):")
        for name, pct in sorted(good, key=lambda x: -x[1])[:30]:
            print(f"    {pct:5.1f}%  {name}")
        if len(good) > 30:
            print(f"    ... and {len(good) - 30} more")

    # Trainable rows (have features + outcome)
    any_feat = joined[[c for c in all_feature_cols if c in joined.columns]].notna().any(axis=1)

    for horizon, col in [("3Y", "outcome_3y_value"), ("5Y", "outcome_5y_value")]:
        if col not in joined.columns:
            continue
        trainable = joined[joined[col].notna() & any_feat]
        n_geos = trainable["_geo_id"].nunique()
        n_months = trainable["_period"].nunique()
        print(f"\n  {horizon} TRAINABLE: {len(trainable):,} rows = {n_geos:,} geographies x {n_months} months")
        if len(trainable) > 0:
            print(f"    Dates: {trainable['_period'].min()} to {trainable['_period'].max()}")

    # Save
    out_path = OUTPUT_DIR / f"joined_{geo_level}.parquet"
    joined.to_parquet(out_path, engine="pyarrow", index=False)
    mb = out_path.stat().st_size / (1024 * 1024)
    print(f"\n  Saved: {out_path} ({mb:.1f} MB)")

    return joined, all_feature_cols


if __name__ == "__main__":
    for geo in ["metro", "county", "zip"]:
        build_training_set(geo)
    print("\n\nDone! All joined training sets saved to", OUTPUT_DIR)
