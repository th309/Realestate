#!/usr/bin/env python3
"""Test if Realtor supply_score can substitute for Redfin months_of_supply at ZIP level."""
import os, sys, warnings
import numpy as np
import pandas as pd
from scipy import stats
warnings.filterwarnings("ignore")
_print = print
def print(*a, **k): _print(*a, **k); sys.stdout.flush()

def get_engine():
    from sqlalchemy import create_engine
    from urllib.parse import quote_plus
    ref = "pysflbhpnqwoczyuaaif"
    pw = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    host = "aws-1-us-east-1.pooler.supabase.com"
    url = f"postgresql://postgres.{ref}:{quote_plus(pw)}@{host}:5432/postgres?sslmode=require"
    return create_engine(url)

engine = get_engine()

# 1. Skip coverage count (times out on big table) — go straight to data load
print("=== Skipping coverage count (table too large for COUNT DISTINCT) ===")

# 2. Correlation: Realtor supply_score vs Redfin months_of_supply at METRO
print("\n=== Cross-check at metro: supply_score vs months_of_supply ===")
rf = pd.read_sql("""SELECT cbsa_code, period_end AS period_date, months_of_supply
    FROM redfin_metro WHERE property_type = 'All Residential'
    AND months_of_supply IS NOT NULL AND period_end >= '2018-01-01'""", engine)
rf["period_date"] = pd.to_datetime(rf["period_date"])
rf["period_month"] = rf["period_date"].dt.to_period("M")

rl = pd.read_sql("""SELECT cbsa_code, period_date, supply_score
    FROM realtor_metro WHERE supply_score IS NOT NULL AND period_date >= '2018-01-01'""", engine)
rl["period_date"] = pd.to_datetime(rl["period_date"])
rl["period_month"] = rl["period_date"].dt.to_period("M")

merged = rf.merge(rl[["cbsa_code","period_month","supply_score"]], on=["cbsa_code","period_month"], how="inner")
merged = merged.dropna(subset=["months_of_supply","supply_score"])
corr, pval = stats.spearmanr(merged["months_of_supply"], merged["supply_score"])
print(f"  Matched rows: {len(merged):,}")
print(f"  Spearman correlation: {corr:+.4f} (p={pval:.2e})")
print(f"  Direction: {'higher supply_score = LESS supply (tighter)' if corr < 0 else 'higher supply_score = MORE supply (looser)'}")

# 3. Load ZIP data and test
print("\n=== Loading ZIP data for 3-metric test ===")

xw = pd.read_sql("""SELECT DISTINCT zip_code, state_abbrev, zillow_state_region_id::text AS zs_id
    FROM geography_crosswalk WHERE zip_code IS NOT NULL AND zillow_state_region_id IS NOT NULL""", engine)
xw = xw.drop_duplicates(subset="zip_code", keep="first")

zip_zhvi = pd.read_sql("""SELECT region_name AS zip_code, period_date, value AS zhvi
    FROM zillow_zip WHERE metric_name = 'zhvi' AND value IS NOT NULL AND period_date >= '2016-01-01'""", engine)
zip_zhvi["period_date"] = pd.to_datetime(zip_zhvi["period_date"])
print(f"  ZHVI: {len(zip_zhvi):,} rows")

state_zhvi = pd.read_sql("""SELECT region_id::text AS region_id, period_date, value AS zhvi
    FROM zillow_state WHERE metric_name = 'zhvi' AND value IS NOT NULL AND period_date >= '2016-01-01'""", engine)
state_zhvi["period_date"] = pd.to_datetime(state_zhvi["period_date"])

# 1Y returns
print("  Computing 1Y returns...")
zp = zip_zhvi.pivot_table(index="period_date", columns="zip_code", values="zhvi")
sp = state_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")
zr = (zp.shift(-12)/zp-1).stack().reset_index(); zr.columns=["period_date","zip_code","zip_return"]
sr = (sp.shift(-12)/sp-1).stack().reset_index(); sr.columns=["period_date","zs_id","state_return"]
m = zr.merge(xw[["zs_id","zip_code","state_abbrev"]], on="zip_code", how="inner")
m = m.merge(sr, on=["period_date","zs_id"], how="inner")
m["excess_1y"] = m["zip_return"] - m["state_return"]
m = m.dropna(subset=["excess_1y"])
m["period_month"] = m["period_date"].dt.to_period("M")
print(f"  Returns: {len(m):,}")

# 3Y returns
print("  Computing 3Y returns...")
zr3 = (zp.shift(-36)/zp-1).stack().reset_index(); zr3.columns=["period_date","zip_code","zip_return_3y"]
sr3 = (sp.shift(-36)/sp-1).stack().reset_index(); sr3.columns=["period_date","zs_id","state_return_3y"]
m3 = zr3.merge(xw[["zs_id","zip_code"]], on="zip_code", how="inner")
m3 = m3.merge(sr3, on=["period_date","zs_id"], how="inner")
m3["excess_3y"] = m3["zip_return_3y"] - m3["state_return_3y"]
m3 = m3.dropna(subset=["excess_3y"])
m3["period_month"] = m3["period_date"].dt.to_period("M")

m = m.merge(m3[["zip_code","period_month","excess_3y"]], on=["zip_code","period_month"], how="left")

# Redfin ZIP
print("  Loading Redfin ZIP...")
rf_zip = pd.read_sql("""SELECT zip_code, period_end AS period_date, sold_above_list, median_dom
    FROM redfin_zip WHERE property_type = 'All Residential' AND period_end >= '2016-01-01'
    AND sold_above_list IS NOT NULL AND median_dom IS NOT NULL""", engine)
rf_zip["period_date"] = pd.to_datetime(rf_zip["period_date"])
rf_zip["period_month"] = rf_zip["period_date"].dt.to_period("M")
print(f"  Redfin ZIP: {len(rf_zip):,}")

# Realtor ZIP
print("  Loading Realtor ZIP supply_score...")
rl_zip = pd.read_sql("""SELECT postal_code AS zip_code, period_date, supply_score
    FROM realtor_zip WHERE supply_score IS NOT NULL AND period_date >= '2016-01-01'""", engine)
rl_zip["period_date"] = pd.to_datetime(rl_zip["period_date"])
rl_zip["period_month"] = rl_zip["period_date"].dt.to_period("M")
print(f"  Realtor ZIP: {len(rl_zip):,} rows, {rl_zip['zip_code'].nunique()} zips")

# Join
df = m.merge(rf_zip[["zip_code","period_month","sold_above_list","median_dom"]],
             on=["zip_code","period_month"], how="inner")
df = df.dropna(subset=["sold_above_list","median_dom"])
print(f"  After Redfin join: {len(df):,}")

df_with_ss = df.merge(rl_zip[["zip_code","period_month","supply_score"]],
                       on=["zip_code","period_month"], how="inner")
df_with_ss = df_with_ss.dropna(subset=["supply_score"])
print(f"  After Realtor join: {len(df_with_ss):,}")

# Z-scores on the matched subset
for col, name in [("sold_above_list","z_sal"),("median_dom","z_dom"),("supply_score","z_ss")]:
    df_with_ss[name] = df_with_ss.groupby("period_date")[col].transform(
        lambda x: (x - x.mean()) / max(x.std(), 0.001))

# The direction question: does higher supply_score mean tighter market?
# From metro cross-check: if corr with months_of_supply is negative, then yes
# supply_score UP = supply DOWN = tighter = should be POSITIVE for appreciation
direction = 1 if corr < 0 else -1
print(f"\n  Supply score direction: {'+' if direction > 0 else '-'} (higher score = {'tighter' if direction > 0 else 'looser'} market)")

df_with_ss["signal_2m"] = df_with_ss["z_sal"] - df_with_ss["z_dom"]
df_with_ss["signal_3m"] = df_with_ss["z_sal"] - df_with_ss["z_dom"] + direction * df_with_ss["z_ss"]

# Overall IC comparison
print("\n=== RESULTS: 2-metric vs 3-metric (same sample) ===")
for horizon, col in [("1Y", "excess_1y"), ("3Y", "excess_3y")]:
    v = df_with_ss.dropna(subset=[col])
    if len(v) < 100:
        print(f"  {horizon}: insufficient data")
        continue
    ic2, _ = stats.spearmanr(v["signal_2m"], v[col])
    ic3, _ = stats.spearmanr(v["signal_3m"], v[col])
    print(f"\n  {horizon} ({len(v):,} observations):")
    print(f"    2-metric (sold_above + inv_DOM):         IC = {ic2:+.4f}")
    print(f"    3-metric (+ Realtor supply_score):       IC = {ic3:+.4f}")
    print(f"    Improvement:                             {ic3-ic2:+.4f}")

# Year-by-year
print("\n=== Year-by-year comparison (1Y) ===")
df_with_ss["year"] = df_with_ss["period_date"].dt.year
print(f"  {'Year':<6} {'2-metric':>10} {'3-metric':>10} {'Diff':>8} {'N':>8}")
print(f"  {'-'*44}")
for yr in sorted(df_with_ss["year"].unique()):
    s = df_with_ss[df_with_ss["year"]==yr].dropna(subset=["excess_1y"])
    if len(s) < 100: continue
    ic2, _ = stats.spearmanr(s["signal_2m"], s["excess_1y"])
    ic3, _ = stats.spearmanr(s["signal_3m"], s["excess_1y"])
    print(f"  {yr:<6d} {ic2:>+10.4f} {ic3:>+10.4f} {ic3-ic2:>+8.4f} {len(s):>7d}")

# 3Y year-by-year
print(f"\n=== Year-by-year comparison (3Y) ===")
print(f"  {'Year':<6} {'2-metric':>10} {'3-metric':>10} {'Diff':>8} {'N':>8}")
print(f"  {'-'*44}")
for yr in sorted(df_with_ss["year"].unique()):
    s = df_with_ss[df_with_ss["year"]==yr].dropna(subset=["excess_3y"])
    if len(s) < 100: continue
    ic2, _ = stats.spearmanr(s["signal_2m"], s["excess_3y"])
    ic3, _ = stats.spearmanr(s["signal_3m"], s["excess_3y"])
    print(f"  {yr:<6d} {ic2:>+10.4f} {ic3:>+10.4f} {ic3-ic2:>+8.4f} {len(s):>7d}")

engine.dispose()
print("\nDONE.")
