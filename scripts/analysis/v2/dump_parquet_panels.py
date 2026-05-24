#!/usr/bin/env python3
"""
Path A panel dump for PropertyIQ Score V2 discovery.

Reads source tables from Supabase via SQLAlchemy, produces Parquet panels
in scripts/analysis/v2/data/ keyed by (source, geo_level). Uses chunked reads
(50k rows/chunk) to stay memory-bounded on the ZIP-level tables.

Requires SUPABASE_DB_PASSWORD env var. The script reads it from
the project's .env.local file automatically.
"""

import os
import sys
import time
import traceback
from pathlib import Path
from urllib.parse import quote_plus

import pandas as pd
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Load .env.local to populate SUPABASE_DB_PASSWORD
ENV_FILE = ROOT / ".env.local"
if ENV_FILE.exists():
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k.strip(), v)

PW = os.environ.get("SUPABASE_DB_PASSWORD")
if not PW:
    sys.exit("FATAL: SUPABASE_DB_PASSWORD not set (and not in .env.local)")

REF = "pysflbhpnqwoczyuaaif"
HOST = "aws-1-us-east-1.pooler.supabase.com"
URL = (
    f"postgresql://postgres.{REF}:{quote_plus(PW)}@{HOST}:6543/postgres"
    "?sslmode=require"
)
engine = create_engine(
    URL,
    connect_args={"options": "-c statement_timeout=900000"},  # 15 min
    pool_pre_ping=True,
)

CENSUS_DIV_TO_REGION = {
    "New England": "Northeast",
    "Middle Atlantic": "Northeast",
    "East North Central": "Midwest",
    "West North Central": "Midwest",
    "South Atlantic": "South",
    "East South Central": "South",
    "West South Central": "South",
    "Mountain": "West",
    "Pacific": "West",
}

# Track failures for final summary
FAILURES: list[tuple[str, str]] = []  # (filename, error_summary)
WRITTEN: list[str] = []


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def write_parquet(df: pd.DataFrame, name: str) -> None:
    """Write to disk, validate non-empty, log row x col count."""
    if df.empty:
        raise ValueError(f"DataFrame is empty — refusing to write {name}")
    out = DATA_DIR / name
    df.to_parquet(out, index=False)
    kb = out.stat().st_size / 1024
    log(f"  -> {out.name}  ({len(df):,} rows x {len(df.columns)} cols, {kb:.0f} KB)")
    WRITTEN.append(name)


def read_chunked(sql: str) -> pd.DataFrame:
    """Read a potentially-large query in 50k-row chunks."""
    chunks = []
    with engine.connect() as conn:
        for chunk in pd.read_sql(text(sql), conn, chunksize=50_000):
            chunks.append(chunk)
    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()


def read_direct(sql: str) -> pd.DataFrame:
    """Read a smaller query directly."""
    with engine.connect() as conn:
        return pd.read_sql(text(sql), conn)


def prefix_cols(df: pd.DataFrame, prefix: str, skip: list) -> pd.DataFrame:
    return df.rename(columns={c: f"{prefix}{c}" for c in df.columns if c not in skip})


def safe_run(label: str, fn) -> None:
    """Run fn(), catch any exception, log it, continue."""
    log(f"\n[{label}] starting...")
    try:
        fn()
    except Exception as exc:
        msg = f"{type(exc).__name__}: {exc}"
        log(f"  ERROR in {label}: {msg}")
        traceback.print_exc()
        FAILURES.append((label, msg))


# ---------------------------------------------------------------------------
# Build division/region lookup from census_division_mapping + geography_crosswalk
# ---------------------------------------------------------------------------
def build_div_lookup() -> pd.DataFrame:
    """
    Returns DataFrame with (state_abbrev, division_name, region).
    Joins census_division_mapping (state_code, division_name) to crosswalk state_abbrev.
    """
    sql = """
    SELECT DISTINCT
        cdm.state_code     AS state_abbrev,
        cdm.division_name
    FROM census_division_mapping cdm
    ORDER BY cdm.state_code
    """
    df = read_direct(sql)
    df["region"] = df["division_name"].map(CENSUS_DIV_TO_REGION).fillna("Unknown")
    return df


# ---------------------------------------------------------------------------
# 1. geos_<level>.parquet
# ---------------------------------------------------------------------------
def dump_geos_metro(div_lookup: pd.DataFrame) -> None:
    sql = """
    SELECT DISTINCT ON (cbsa_code)
        cbsa_code   AS region_id,
        state_abbrev
    FROM geography_crosswalk
    WHERE cbsa_code IS NOT NULL
    ORDER BY cbsa_code, state_abbrev
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df = df.merge(div_lookup, on="state_abbrev", how="left")
    df = df.rename(columns={"division_name": "division"})
    write_parquet(df[["region_id", "state_abbrev", "division", "region"]], "geos_metro.parquet")


def dump_geos_county(div_lookup: pd.DataFrame) -> None:
    sql = """
    SELECT DISTINCT ON (county_fips)
        county_fips AS region_id,
        state_abbrev
    FROM geography_crosswalk
    WHERE county_fips IS NOT NULL
    ORDER BY county_fips, state_abbrev
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df = df.merge(div_lookup, on="state_abbrev", how="left")
    df = df.rename(columns={"division_name": "division"})
    write_parquet(df[["region_id", "state_abbrev", "division", "region"]], "geos_county.parquet")


def dump_geos_zip(div_lookup: pd.DataFrame) -> None:
    sql = """
    SELECT DISTINCT ON (zip_code)
        zip_code    AS region_id,
        state_abbrev
    FROM geography_crosswalk
    WHERE zip_code IS NOT NULL
    ORDER BY zip_code, state_abbrev
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df = df.merge(div_lookup, on="state_abbrev", how="left")
    df = df.rename(columns={"division_name": "division"})
    write_parquet(df[["region_id", "state_abbrev", "division", "region"]], "geos_zip.parquet")


def dump_geos_state(div_lookup: pd.DataFrame) -> None:
    sql = """
    SELECT DISTINCT
        state_abbrev AS region_id,
        state_abbrev
    FROM geography_crosswalk
    WHERE state_abbrev IS NOT NULL
    ORDER BY state_abbrev
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df = df.merge(div_lookup, on="state_abbrev", how="left")
    df = df.rename(columns={"division_name": "division"})
    write_parquet(df[["region_id", "state_abbrev", "division", "region"]], "geos_state.parquet")


# ---------------------------------------------------------------------------
# 2. zillow_<level>.parquet
# ---------------------------------------------------------------------------
def dump_zillow(geo_level: str) -> None:
    """Dump ZHVI from zillow_<geo_level>, mapping to natural region_id."""
    if geo_level == "metro":
        # zillow_metro already has cbsa_code
        sql = """
        SELECT
            cbsa_code::text AS region_id,
            period_date,
            value           AS zil_zhvi
        FROM zillow_metro
        WHERE metric_name = 'zhvi'
          AND value IS NOT NULL
          AND period_date >= '2000-01-01'
          AND cbsa_code IS NOT NULL
        """
        df = read_chunked(sql)

    elif geo_level == "county":
        # zillow_county has fips_code
        sql = """
        SELECT
            fips_code::text AS region_id,
            period_date,
            value           AS zil_zhvi
        FROM zillow_county
        WHERE metric_name = 'zhvi'
          AND value IS NOT NULL
          AND period_date >= '2000-01-01'
          AND fips_code IS NOT NULL
        """
        df = read_chunked(sql)

    elif geo_level == "zip":
        # zillow_zip has no postal_code column; region_name IS the ZIP code
        sql = """
        SELECT
            region_name::text AS region_id,
            period_date,
            value             AS zil_zhvi
        FROM zillow_zip
        WHERE metric_name = 'zhvi'
          AND value IS NOT NULL
          AND period_date >= '2000-01-01'
          AND region_name IS NOT NULL
        """
        df = read_chunked(sql)

    elif geo_level == "state":
        # zillow_state has region_name = full state name; join to get state_abbrev
        sql = """
        SELECT
            zs.region_name::text AS zil_state_name,
            zs.period_date,
            zs.value             AS zil_zhvi
        FROM zillow_state zs
        WHERE zs.metric_name = 'zhvi'
          AND zs.value IS NOT NULL
          AND zs.period_date >= '2000-01-01'
        """
        df = read_chunked(sql)
        # Map state_name -> state_abbrev via crosswalk
        mapping_sql = """
        SELECT DISTINCT state_name, state_abbrev
        FROM geography_crosswalk
        WHERE state_name IS NOT NULL AND state_abbrev IS NOT NULL
        """
        mapping = read_direct(mapping_sql)
        df = df.merge(mapping, left_on="zil_state_name", right_on="state_name", how="left")
        df = df.rename(columns={"state_abbrev": "region_id"})
        df = df.drop(columns=["zil_state_name", "state_name"], errors="ignore")
        df = df[df["region_id"].notna()]

    else:
        raise ValueError(f"Unknown geo_level: {geo_level}")

    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["period_date"])
    df["zil_zhvi"] = pd.to_numeric(df["zil_zhvi"], errors="coerce")
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, f"zillow_{geo_level}.parquet")


# ---------------------------------------------------------------------------
# 3. RFDC dashboard dumps
# ---------------------------------------------------------------------------
RFDC_DASHBOARDS = {
    "housing_market": {
        "geos": ["metro", "county", "zip", "state"],
        "table_tpl": "redfin_dc_housing_market_{geo}",
        "output_tpl": "rfdc_housing_market_{geo}.parquet",
        "prefix": "rfdc_housing_market_",
    },
    "price_drops": {
        "geos": ["metro", "county", "zip", "state"],
        "table_tpl": "redfin_dc_price_drops_{geo}",
        "output_tpl": "rfdc_price_drops_{geo}.parquet",
        "prefix": "rfdc_price_drops_",
    },
    "contract_cancellations": {
        "geos": ["metro", "county", "zip", "state"],
        "table_tpl": "redfin_dc_contract_cancellations_{geo}",
        "output_tpl": "rfdc_contract_cancellations_{geo}.parquet",
        "prefix": "rfdc_contract_cancellations_",
    },
    "delistings_relistings": {
        "geos": ["metro", "county", "zip", "state"],
        "table_tpl": "redfin_dc_delistings_relistings_{geo}",
        "output_tpl": "rfdc_delistings_{geo}.parquet",
        "prefix": "rfdc_delistings_",
    },
    "investors": {
        "geos": ["metro"],
        "table_tpl": "redfin_dc_investors_{geo}",
        "output_tpl": "rfdc_investors_{geo}.parquet",
        "prefix": "rfdc_investors_",
    },
    "cash_loan": {
        "geos": ["metro"],
        "table_tpl": "redfin_dc_cash_loan_{geo}",
        "output_tpl": "rfdc_cash_loan_{geo}.parquet",
        "prefix": "rfdc_cash_loan_",
    },
    "rhpi": {
        "geos": ["metro"],
        "table_tpl": "redfin_dc_rhpi_{geo}",
        "output_tpl": "rfdc_rhpi_{geo}.parquet",
        "prefix": "rfdc_rhpi_",
    },
}


def get_numeric_columns(table_name: str) -> list:
    """Query information_schema for numeric columns (exclude metadata cols)."""
    sql = f"""
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '{table_name}'
      AND data_type IN ('numeric', 'integer', 'bigint', 'smallint', 'real',
                        'double precision', 'decimal')
    ORDER BY ordinal_position
    """
    df = read_direct(sql)
    return df["column_name"].tolist()


def dump_rfdc(dashboard_name: str, geo_level: str) -> None:
    cfg = RFDC_DASHBOARDS[dashboard_name]
    table = cfg["table_tpl"].format(geo=geo_level)
    output = cfg["output_tpl"].format(geo=geo_level)
    prefix = cfg["prefix"]

    numeric_cols = get_numeric_columns(table)
    if not numeric_cols:
        raise ValueError(f"No numeric columns found in {table}")

    cols_sql = ", ".join(f'"{c}"' for c in numeric_cols)
    sql = f"""
    SELECT
        region_id::text AS region_id,
        period_end      AS period_date,
        {cols_sql}
    FROM {table}
    WHERE period_end IS NOT NULL
    """

    # ZIP tables are ~2.4M rows — use chunked reads
    if geo_level == "zip":
        df = read_chunked(sql)
    else:
        df = read_direct(sql)

    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["period_date"])
    df = prefix_cols(df, prefix, skip=["region_id", "period_date"])
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, output)


def dump_rfdc_buyers_sellers_metro() -> None:
    """buyers_sellers: metro only, filter to All Residential, drop property_type."""
    table = "redfin_dc_buyers_sellers_metro"
    numeric_cols = get_numeric_columns(table)
    if not numeric_cols:
        raise ValueError(f"No numeric columns found in {table}")

    cols_sql = ", ".join(f'"{c}"' for c in numeric_cols)
    sql = f"""
    SELECT
        region_id::text AS region_id,
        period_end      AS period_date,
        {cols_sql}
    FROM {table}
    WHERE property_type = 'All Residential'
      AND period_end IS NOT NULL
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["period_date"])
    df = prefix_cols(df, "rfdc_buyers_sellers_", skip=["region_id", "period_date"])
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, "rfdc_buyers_sellers_metro.parquet")


# ---------------------------------------------------------------------------
# 4. realtor_<level>.parquet
# ---------------------------------------------------------------------------
# Requested columns (skip if absent at a given level)
REALTOR_WANTED = [
    "hotness_score", "supply_score", "demand_score",
    "median_listing_price", "median_listing_price_yy",
    "active_listing_count", "active_listing_count_yy",
    "median_days_on_market", "median_days_on_market_yy",
    "price_reduced_share", "pending_listing_count_yy",
    "pending_ratio", "new_listing_count_yy",
]

REALTOR_ID_COL = {
    "metro": "cbsa_code",
    "county": "county_fips",
    "zip": "postal_code",
    "state": "state_id",
}


def dump_realtor(geo_level: str) -> None:
    table = f"realtor_{geo_level}"
    id_col = REALTOR_ID_COL[geo_level]

    # Discover which of the wanted columns actually exist
    avail_sql = f"""
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '{table}'
    """
    avail_df = read_direct(avail_sql)
    avail = set(avail_df["column_name"].tolist())

    cols_to_pull = [c for c in REALTOR_WANTED if c in avail]
    if not cols_to_pull:
        raise ValueError(f"None of the wanted realtor columns exist in {table}")

    cols_sql = ", ".join(f'"{c}"' for c in cols_to_pull)
    sql = f"""
    SELECT
        {id_col}::text AS region_id,
        period_date,
        {cols_sql}
    FROM {table}
    WHERE {id_col} IS NOT NULL
      AND period_date IS NOT NULL
    """

    # ZIP realtor is 56k rows — direct read is fine
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["period_date"])
    df = prefix_cols(df, "realtor_", skip=["region_id", "period_date"])
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, f"realtor_{geo_level}.parquet")


# ---------------------------------------------------------------------------
# 5. economic_<level>.parquet (metro/county/state only)
# ---------------------------------------------------------------------------
ECON_ID_COL = {
    "metro": "cbsa_code",
    "county": "fips_code",
    "state": "state_abbrev",
}
ECON_SKIP_COLS = {
    "id", "created_at", "updated_at", "cbsa_title", "state_fips",
    "state_name", "county_name", "fips_code", "cbsa_code",
    "state_abbrev", "period_date", "ces_period_date",
}


def dump_economic(geo_level: str) -> None:
    table = f"economic_{geo_level}"
    id_col = ECON_ID_COL[geo_level]

    # Discover numeric columns (excluding metadata)
    avail_sql = f"""
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '{table}'
    ORDER BY ordinal_position
    """
    avail_df = read_direct(avail_sql)
    numeric_types = {
        "numeric", "integer", "bigint", "smallint", "real",
        "double precision", "decimal",
    }
    numeric_cols = [
        row["column_name"] for _, row in avail_df.iterrows()
        if row["data_type"] in numeric_types
        and row["column_name"] not in ECON_SKIP_COLS
    ]

    if not numeric_cols:
        raise ValueError(f"No numeric columns found in {table}")

    cols_sql = ", ".join(f'"{c}"' for c in numeric_cols)
    sql = f"""
    SELECT
        {id_col}::text AS region_id,
        period_date,
        {cols_sql}
    FROM {table}
    WHERE {id_col} IS NOT NULL
      AND period_date IS NOT NULL
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["period_date"])
    df = prefix_cols(df, "econ_", skip=["region_id", "period_date"])
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, f"economic_{geo_level}.parquet")


# ---------------------------------------------------------------------------
# 6. permits_<level>.parquet (county/state only)
# ---------------------------------------------------------------------------
PERMITS_COLS = [
    "sf_units", "sf_value", "duplex_units", "small_multi_units",
    "large_multi_units", "total_units", "total_value",
    "sf_units_yoy", "total_units_yoy",
]
PERMITS_ID_COL = {
    "county": "fips_code",
    "state": "state_fips",
}


def dump_permits(geo_level: str) -> None:
    table = f"permits_{geo_level}"
    id_col = PERMITS_ID_COL[geo_level]

    # Only pull columns that actually exist
    avail_sql = f"""
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '{table}'
    """
    avail_df = read_direct(avail_sql)
    avail = set(avail_df["column_name"].tolist())
    cols_to_pull = [c for c in PERMITS_COLS if c in avail]

    if not cols_to_pull:
        raise ValueError(f"None of the wanted permits columns exist in {table}")

    cols_sql = ", ".join(f'"{c}"' for c in cols_to_pull)
    sql = f"""
    SELECT
        {id_col}::text AS region_id,
        period_date,
        {cols_sql}
    FROM {table}
    WHERE {id_col} IS NOT NULL
      AND period_date IS NOT NULL
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["period_date"])
    df = prefix_cols(df, "permits_", skip=["region_id", "period_date"])
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, f"permits_{geo_level}.parquet")


# ---------------------------------------------------------------------------
# 7. hud_fmr_<level>.parquet (county/metro only — annual)
# ---------------------------------------------------------------------------
def dump_hud_fmr_county() -> None:
    sql = """
    SELECT
        fips_code::text  AS region_id,
        year,
        fmr_0br, fmr_1br, fmr_2br, fmr_3br, fmr_4br
    FROM hud_fmr
    WHERE fips_code IS NOT NULL AND year IS NOT NULL
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["year"].astype(str) + "-12-31")
    df = df.drop(columns=["year"])
    df = prefix_cols(df, "hud_fmr_", skip=["region_id", "period_date"])
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, "hud_fmr_county.parquet")


def dump_hud_fmr_metro() -> None:
    sql = """
    SELECT
        metro_code::text AS region_id,
        year,
        AVG(fmr_0br)::numeric AS fmr_0br,
        AVG(fmr_1br)::numeric AS fmr_1br,
        AVG(fmr_2br)::numeric AS fmr_2br,
        AVG(fmr_3br)::numeric AS fmr_3br,
        AVG(fmr_4br)::numeric AS fmr_4br
    FROM hud_fmr
    WHERE metro_code IS NOT NULL AND year IS NOT NULL
    GROUP BY metro_code, year
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["year"].astype(str) + "-12-31")
    df = df.drop(columns=["year"])
    df = prefix_cols(df, "hud_fmr_", skip=["region_id", "period_date"])
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, "hud_fmr_metro.parquet")


# ---------------------------------------------------------------------------
# 8. irs_migration_county.parquet (county only)
# ---------------------------------------------------------------------------
def dump_irs_migration_county() -> None:
    sql = """
    SELECT
        county_fips::text AS region_id,
        tax_year          AS year,
        in_returns, out_returns, net_returns,
        in_exemptions, out_exemptions,
        in_agi_thousands, out_agi_thousands,
        in_avg_agi, out_avg_agi
    FROM irs_migration_county_aggregates
    WHERE county_fips IS NOT NULL AND tax_year IS NOT NULL
    """
    df = read_direct(sql)
    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["year"].astype(str) + "-12-31")
    df = df.drop(columns=["year"])
    df = prefix_cols(df, "irs_", skip=["region_id", "period_date"])
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, "irs_migration_county.parquet")


# ---------------------------------------------------------------------------
# 9. census_<level>.parquet (all 4 geos — annual)
# ---------------------------------------------------------------------------
CENSUS_ID_COL = {
    "metro": "cbsa_code",
    "county": "fips_code",
    "zip": "zcta",        # census_zip uses zcta
    "state": "state_abbrev",
}
CENSUS_SKIP_COLS = {
    "id", "created_at", "updated_at",
    "cbsa_code", "cbsa_title", "state_fips", "state_name",
    "fips_code", "county_name", "zcta", "state_abbrev",
    "year",
}


def dump_census(geo_level: str) -> None:
    table = f"census_{geo_level}"
    id_col = CENSUS_ID_COL[geo_level]

    avail_sql = f"""
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '{table}'
    ORDER BY ordinal_position
    """
    avail_df = read_direct(avail_sql)
    numeric_types = {
        "numeric", "integer", "bigint", "smallint", "real",
        "double precision", "decimal",
    }
    numeric_cols = [
        row["column_name"] for _, row in avail_df.iterrows()
        if row["data_type"] in numeric_types
        and row["column_name"] not in CENSUS_SKIP_COLS
    ]

    if not numeric_cols:
        raise ValueError(f"No numeric columns found in {table}")

    cols_sql = ", ".join(f'"{c}"' for c in numeric_cols)
    sql = f"""
    SELECT
        {id_col}::text AS region_id,
        year,
        {cols_sql}
    FROM {table}
    WHERE {id_col} IS NOT NULL AND year IS NOT NULL
    """

    # census_zip has 432k rows — chunked to be safe
    if geo_level == "zip":
        df = read_chunked(sql)
    else:
        df = read_direct(sql)

    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["year"].astype(str) + "-12-31")
    df = df.drop(columns=["year"])
    df = prefix_cols(df, "census_", skip=["region_id", "period_date"])
    df = df.drop_duplicates(subset=["region_id", "period_date"])
    write_parquet(df, f"census_{geo_level}.parquet")


# ---------------------------------------------------------------------------
# Main driver
# ---------------------------------------------------------------------------
def main() -> None:
    t0 = time.time()
    log("=== PropertyIQ V2 Parquet panel dump starting ===")
    log(f"Output dir: {DATA_DIR}")

    # Build division lookup once
    log("\n[0] Building census division lookup...")
    div_lookup = build_div_lookup()
    log(f"  {len(div_lookup)} state mappings loaded")

    # --- geos ---
    safe_run("geos_metro",   lambda: dump_geos_metro(div_lookup))
    safe_run("geos_county",  lambda: dump_geos_county(div_lookup))
    safe_run("geos_zip",     lambda: dump_geos_zip(div_lookup))
    safe_run("geos_state",   lambda: dump_geos_state(div_lookup))

    # --- zillow ---
    safe_run("zillow_metro",   lambda: dump_zillow("metro"))
    safe_run("zillow_county",  lambda: dump_zillow("county"))
    safe_run("zillow_zip",     lambda: dump_zillow("zip"))    # ~500k rows after filter
    safe_run("zillow_state",   lambda: dump_zillow("state"))

    # --- RFDC dashboards (all geos per dashboard) ---
    for dashboard in ["housing_market", "price_drops", "contract_cancellations", "delistings_relistings"]:
        for geo in ["metro", "county", "zip", "state"]:
            safe_run(
                f"rfdc_{dashboard}_{geo}",
                lambda d=dashboard, g=geo: dump_rfdc(d, g),
            )

    # Metro-only RFDC
    for dashboard in ["investors", "cash_loan", "rhpi"]:
        safe_run(
            f"rfdc_{dashboard}_metro",
            lambda d=dashboard: dump_rfdc(d, "metro"),
        )

    # buyers_sellers (special: property_type filter)
    safe_run("rfdc_buyers_sellers_metro", dump_rfdc_buyers_sellers_metro)

    # --- realtor ---
    for geo in ["metro", "county", "zip", "state"]:
        safe_run(f"realtor_{geo}", lambda g=geo: dump_realtor(g))

    # --- economic (metro/county/state — no ZIP) ---
    for geo in ["metro", "county", "state"]:
        safe_run(f"economic_{geo}", lambda g=geo: dump_economic(g))

    # --- permits (county/state) ---
    for geo in ["county", "state"]:
        safe_run(f"permits_{geo}", lambda g=geo: dump_permits(g))

    # --- hud_fmr (county/metro) ---
    safe_run("hud_fmr_county", dump_hud_fmr_county)
    safe_run("hud_fmr_metro",  dump_hud_fmr_metro)

    # --- irs_migration (county only) ---
    safe_run("irs_migration_county", dump_irs_migration_county)

    # --- census (all 4 geos) ---
    for geo in ["metro", "county", "zip", "state"]:
        safe_run(f"census_{geo}", lambda g=geo: dump_census(g))

    # ---------------------------------------------------------------------------
    # Final summary
    # ---------------------------------------------------------------------------
    elapsed = time.time() - t0
    log(f"\n{'='*60}")
    log(f"Dump complete in {elapsed/60:.1f} min")
    log(f"\n=== Files written ({len(WRITTEN)}) ===")
    for f in sorted(DATA_DIR.glob("*.parquet")):
        kb = f.stat().st_size / 1024
        rows_hint = ""
        try:
            pf = pd.read_parquet(f, columns=["region_id"])
            rows_hint = f"{len(pf):>10,} rows"
        except Exception:
            pass
        log(f"  {f.name:<55s}  {rows_hint}  {kb:>8.0f} KB")

    if FAILURES:
        log(f"\n=== FAILURES ({len(FAILURES)}) ===")
        for label, err in FAILURES:
            log(f"  FAILED {label}: {err}")
    else:
        log("\nAll targets completed successfully.")


if __name__ == "__main__":
    main()
