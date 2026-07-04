"""
Path A panel-dump: converts MCP result files (JSON-wrapped) to Parquet.
Run after all MCP queries have completed and saved their result files.
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

TOOL_RESULTS_DIR = Path(
    r"C:\Users\troyh\.claude\projects\D--projects-rei-platform"
    r"\9b02e71e-cd40-41db-9162-8c6021744011\tool-results"
)

# Map of filename -> result file (fill in after running queries)
# Keys must match exactly
RESULT_FILES = {
    # geos: cbsa_code + state + division + region (~928 rows after dedup)
    "geos":            "mcp-plugin_supabase_supabase-execute_sql-1779632861107.txt",
    # zillow: two cbsa_code-based chunks (2010-2017, 2018+)
    "zillow_2010":     "mcp-plugin_supabase_supabase-execute_sql-1779632973474.txt",
    "zillow_2018":     "mcp-plugin_supabase_supabase-execute_sql-1779632979218.txt",
    # redfin DC tables (region_id = redfin metro ID, already numeric CBSA-like)
    "rfdc_housing":    "mcp-plugin_supabase_supabase-execute_sql-1779632903885.txt",
    "rfdc_price_drops":"mcp-plugin_supabase_supabase-execute_sql-1779632904753.txt",
    "rfdc_cancels":    "mcp-plugin_supabase_supabase-execute_sql-1779632905747.txt",
    "rfdc_delistings": "mcp-plugin_supabase_supabase-execute_sql-1779632907006.txt",
    "rfdc_investors":  "mcp-plugin_supabase_supabase-execute_sql-1779632909207.txt",
    "rfdc_cash_loan":  "mcp-plugin_supabase_supabase-execute_sql-1779632911658.txt",
    "rfdc_rhpi":       "mcp-plugin_supabase_supabase-execute_sql-1779632913969.txt",
    # realtor: cbsa_code, 2023+ (partial), 6 cols
    "realtor":         "mcp-plugin_supabase_supabase-execute_sql-1779633771301.txt",
    # census: cbsa_code, all years (duplicate file is same data)
    "census":          "mcp-plugin_supabase_supabase-execute_sql-1779632955897.txt",
}

# Economic: partial (2020+) — period_date >= 2020-01-01 only
ECONOMIC_FILE = "mcp-plugin_supabase_supabase-execute_sql-1779633216151.txt"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def load_result_file(filename: str) -> list[dict]:
    """Parse an MCP result file (JSON-wrapped) and return list of row dicts."""
    path = TOOL_RESULTS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Result file not found: {path}")
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    outer = json.loads(raw)
    result_str = outer["result"]
    m = re.search(r"\[.*\]", result_str, re.DOTALL)
    if not m:
        print(f"  WARNING: No JSON array found in {filename}")
        return []
    rows = json.loads(m.group(0))
    return rows


def save_parquet(df: pd.DataFrame, name: str) -> None:
    out = DATA_DIR / name
    df.to_parquet(out, index=False)
    size_kb = out.stat().st_size / 1024
    print(f"  Wrote {out.name}: {len(df):,} rows x {len(df.columns)} cols  ({size_kb:.1f} KB)")


def prefix_cols(df: pd.DataFrame, prefix: str, skip: list[str]) -> pd.DataFrame:
    return df.rename(columns={c: f"{prefix}{c}" for c in df.columns if c not in skip})


# ---------------------------------------------------------------------------
# 1. geos_metro.parquet
# ---------------------------------------------------------------------------
print("\n[1/12] geos_metro ...")
rows = load_result_file(RESULT_FILES["geos"])
geos = pd.DataFrame(rows)
geos["region_id"] = geos["region_id"].astype(str)
geos = geos.drop_duplicates(subset="region_id", keep="first")
save_parquet(geos, "geos_metro.parquet")


# ---------------------------------------------------------------------------
# 2. zillow_metro.parquet  (two chunks joined via cbsa_code)
# ---------------------------------------------------------------------------
print("\n[2/12] zillow_metro ...")
rows_a = load_result_file(RESULT_FILES["zillow_2010"])
rows_b = load_result_file(RESULT_FILES["zillow_2018"])
zil = pd.concat([pd.DataFrame(rows_a), pd.DataFrame(rows_b)], ignore_index=True)
zil["region_id"] = zil["region_id"].astype(str)
zil["period_date"] = pd.to_datetime(zil["period_date"])
zil["zil_zhvi"] = pd.to_numeric(zil["zil_zhvi"], errors="coerce")
zil = zil.drop_duplicates(subset=["region_id", "period_date"])
save_parquet(zil, "zillow_metro.parquet")


# ---------------------------------------------------------------------------
# 3. rfdc_housing_market_metro.parquet
# ---------------------------------------------------------------------------
print("\n[3/12] rfdc_housing_market_metro ...")
rows = load_result_file(RESULT_FILES["rfdc_housing"])
df = pd.DataFrame(rows)
df["region_id"] = df["region_id"].astype(str)
df["period_date"] = pd.to_datetime(df["period_date"])
df = prefix_cols(df, "rfdc_housing_market_", skip=["region_id", "period_date"])
save_parquet(df, "rfdc_housing_market_metro.parquet")


# ---------------------------------------------------------------------------
# 4. rfdc_price_drops_metro.parquet
# ---------------------------------------------------------------------------
print("\n[4/12] rfdc_price_drops_metro ...")
rows = load_result_file(RESULT_FILES["rfdc_price_drops"])
df = pd.DataFrame(rows)
df["region_id"] = df["region_id"].astype(str)
df["period_date"] = pd.to_datetime(df["period_date"])
df = prefix_cols(df, "rfdc_price_drops_", skip=["region_id", "period_date"])
save_parquet(df, "rfdc_price_drops_metro.parquet")


# ---------------------------------------------------------------------------
# 5. rfdc_contract_cancellations_metro.parquet
# ---------------------------------------------------------------------------
print("\n[5/12] rfdc_contract_cancellations_metro ...")
rows = load_result_file(RESULT_FILES["rfdc_cancels"])
df = pd.DataFrame(rows)
df["region_id"] = df["region_id"].astype(str)
df["period_date"] = pd.to_datetime(df["period_date"])
df = prefix_cols(df, "rfdc_contract_cancellations_", skip=["region_id", "period_date"])
save_parquet(df, "rfdc_contract_cancellations_metro.parquet")


# ---------------------------------------------------------------------------
# 6. rfdc_delistings_metro.parquet
# ---------------------------------------------------------------------------
print("\n[6/12] rfdc_delistings_metro ...")
rows = load_result_file(RESULT_FILES["rfdc_delistings"])
df = pd.DataFrame(rows)
df["region_id"] = df["region_id"].astype(str)
df["period_date"] = pd.to_datetime(df["period_date"])
df = prefix_cols(df, "rfdc_delistings_", skip=["region_id", "period_date"])
save_parquet(df, "rfdc_delistings_metro.parquet")


# ---------------------------------------------------------------------------
# 7. rfdc_investors_metro.parquet
# ---------------------------------------------------------------------------
print("\n[7/12] rfdc_investors_metro ...")
rows = load_result_file(RESULT_FILES["rfdc_investors"])
df = pd.DataFrame(rows)
df["region_id"] = df["region_id"].astype(str)
df["period_date"] = pd.to_datetime(df["period_date"])
df = prefix_cols(df, "rfdc_investors_", skip=["region_id", "period_date"])
save_parquet(df, "rfdc_investors_metro.parquet")


# ---------------------------------------------------------------------------
# 8. rfdc_cash_loan_metro.parquet
# ---------------------------------------------------------------------------
print("\n[8/12] rfdc_cash_loan_metro ...")
rows = load_result_file(RESULT_FILES["rfdc_cash_loan"])
df = pd.DataFrame(rows)
df["region_id"] = df["region_id"].astype(str)
df["period_date"] = pd.to_datetime(df["period_date"])
df = prefix_cols(df, "rfdc_cash_loan_", skip=["region_id", "period_date"])
save_parquet(df, "rfdc_cash_loan_metro.parquet")


# ---------------------------------------------------------------------------
# 9. rfdc_rhpi_metro.parquet
# ---------------------------------------------------------------------------
print("\n[9/12] rfdc_rhpi_metro ...")
rows = load_result_file(RESULT_FILES["rfdc_rhpi"])
df = pd.DataFrame(rows)
df["region_id"] = df["region_id"].astype(str)
df["period_date"] = pd.to_datetime(df["period_date"])
df = prefix_cols(df, "rfdc_rhpi_", skip=["region_id", "period_date"])
save_parquet(df, "rfdc_rhpi_metro.parquet")


# ---------------------------------------------------------------------------
# 10. realtor_metro.parquet
# ---------------------------------------------------------------------------
print("\n[10/12] realtor_metro ...")
rows = load_result_file(RESULT_FILES["realtor"])
df = pd.DataFrame(rows)
df["region_id"] = df["region_id"].astype(str)
df["period_date"] = pd.to_datetime(df["period_date"])
df = prefix_cols(df, "realtor_", skip=["region_id", "period_date"])
save_parquet(df, "realtor_metro.parquet")


# ---------------------------------------------------------------------------
# 11. economic_metro.parquet  (optional — may not have file yet)
# ---------------------------------------------------------------------------
print("\n[11/12] economic_metro ...")
if ECONOMIC_FILE and (TOOL_RESULTS_DIR / ECONOMIC_FILE).exists():
    rows = load_result_file(ECONOMIC_FILE)
    df = pd.DataFrame(rows)
    df["region_id"] = df["region_id"].astype(str)
    df["period_date"] = pd.to_datetime(df["period_date"])
    df = prefix_cols(df, "econ_", skip=["region_id", "period_date"])
    save_parquet(df, "economic_metro.parquet")
    print("  NOTE: economic_metro is partial (2020+ only due to session timeouts)")
else:
    print("  SKIPPED — no result file available (economic_metro query timed out)")


# ---------------------------------------------------------------------------
# 12. census_metro.parquet
# ---------------------------------------------------------------------------
print("\n[12/12] census_metro ...")
rows = load_result_file(RESULT_FILES["census"])
df = pd.DataFrame(rows)
df["region_id"] = df["region_id"].astype(str)
# Convert year int -> period_date (Dec 31)
df["period_date"] = pd.to_datetime(df["year"].astype(str) + "-12-31")
df = df.drop(columns=["year"])
df = prefix_cols(df, "census_", skip=["region_id", "period_date"])
save_parquet(df, "census_metro.parquet")


# ---------------------------------------------------------------------------
# Final summary
# ---------------------------------------------------------------------------
print("\n=== Data directory contents ===")
for f in sorted(DATA_DIR.glob("*.parquet")):
    size_kb = f.stat().st_size / 1024
    print(f"  {f.name:50s}  {size_kb:8.1f} KB")

print("\nDone.")
