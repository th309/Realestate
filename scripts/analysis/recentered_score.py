#!/usr/bin/env python3
"""
Re-centered Score: 50 = State Average
======================================
Find the exact percentile rank where excess return = 0 (state average),
then remap the score so that point = 50.
"""

import os, warnings
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.isotonic import IsotonicRegression

warnings.filterwarnings("ignore")


def get_engine():
    from sqlalchemy import create_engine
    from urllib.parse import quote_plus
    ref = "pysflbhpnqwoczyuaaif"
    pw = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    host = "aws-1-us-east-1.pooler.supabase.com"
    url = f"postgresql://postgres.{ref}:{quote_plus(pw)}@{host}:6543/postgres?sslmode=require"
    return create_engine(url)


def load_and_score(engine):
    """Same data loading as previous scripts."""
    print("Loading data...")
    metro_zhvi = pd.read_sql("""
        SELECT region_id::text AS region_id, region_name, period_date, value AS zhvi
        FROM zillow_metro WHERE metric_name = 'zhvi' AND value IS NOT NULL
    """, engine)
    metro_zhvi["period_date"] = pd.to_datetime(metro_zhvi["period_date"])

    state_zhvi = pd.read_sql("""
        SELECT region_id::text AS region_id, region_name, period_date, value AS zhvi
        FROM zillow_state WHERE metric_name = 'zhvi' AND value IS NOT NULL
    """, engine)
    state_zhvi["period_date"] = pd.to_datetime(state_zhvi["period_date"])

    xwalk = pd.read_sql("""
        SELECT DISTINCT zillow_metro_region_id::text AS metro_region_id,
               cbsa_code, cbsa_name, state_abbrev,
               zillow_state_region_id::text AS state_region_id
        FROM geography_crosswalk
        WHERE zillow_metro_region_id IS NOT NULL AND zillow_state_region_id IS NOT NULL
    """, engine)
    ms = xwalk.drop_duplicates(subset="metro_region_id", keep="first")

    cbsa_str = ",".join([f"'{c}'" for c in ms["cbsa_code"].dropna().unique()])
    redfin = pd.read_sql(f"""
        SELECT cbsa_code, period_end AS period_date,
               sold_above_list, median_dom, months_of_supply
        FROM redfin_metro
        WHERE cbsa_code IN ({cbsa_str}) AND property_type = 'All Residential'
    """, engine)
    redfin["period_date"] = pd.to_datetime(redfin["period_date"])

    # Returns
    mp = metro_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")
    sp = state_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")

    frames = []
    for h, lab in [(12, "1y"), (36, "3y")]:
        mr = (mp.shift(-h) / mp - 1).stack().reset_index()
        mr.columns = ["period_date", "region_id", f"metro_return_{lab}"]
        sr = (sp.shift(-h) / sp - 1).stack().reset_index()
        sr.columns = ["period_date", "state_region_id", f"state_return_{lab}"]
        m = mr.merge(ms[["metro_region_id","state_region_id","cbsa_code","cbsa_name","state_abbrev"]],
                      left_on="region_id", right_on="metro_region_id", how="inner")
        m = m.merge(sr, on=["period_date","state_region_id"], how="inner")
        m[f"excess_{lab}"] = m[f"metro_return_{lab}"] - m[f"state_return_{lab}"]
        frames.append(m[["period_date","region_id","cbsa_code","cbsa_name","state_abbrev",
                         f"metro_return_{lab}", f"state_return_{lab}", f"excess_{lab}"]])

    base = frames[0].merge(frames[1], on=["period_date","region_id","cbsa_code","cbsa_name","state_abbrev"], how="outer")
    base = base.dropna(subset=["cbsa_code"])

    # Score signal
    base["period_month"] = base["period_date"].dt.to_period("M")
    rf = redfin.copy()
    rf["period_month"] = rf["period_date"].dt.to_period("M")
    df = base.merge(rf[["cbsa_code","period_month","sold_above_list","median_dom","months_of_supply"]],
                     on=["cbsa_code","period_month"], how="inner")
    df = df.dropna(subset=["sold_above_list","median_dom","months_of_supply"])

    for col, name in [("sold_above_list","z_sal"),("median_dom","z_dom"),("months_of_supply","z_mos")]:
        df[name] = df.groupby("period_date")[col].transform(lambda x: (x - x.mean()) / max(x.std(), 0.001))

    df["signal"] = df["z_sal"] - df["z_dom"] - df["z_mos"]
    df["pct_rank"] = df.groupby("period_date")["signal"].rank(pct=True) * 100
    df = df[df["period_date"] >= "2012-01-01"]
    df["year"] = df["period_date"].dt.year

    print(f"  {len(df):,} observations, {df['cbsa_code'].nunique()} metros")
    return df


def find_zero_crossing(df):
    """Find the percentile rank where excess return crosses zero."""
    print("\n" + "="*70)
    print("FINDING THE ZERO CROSSING (where excess return = 0)")
    print("="*70)

    for horizon in ["1y", "3y"]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col])

        # Fit isotonic regression: pct_rank -> excess_return
        iso = IsotonicRegression(increasing=True, out_of_bounds="clip")
        iso.fit(valid["pct_rank"].values, valid[col].values)

        # Find where calibrated excess = 0
        test_pcts = np.linspace(1, 99, 9901)
        test_excess = iso.predict(test_pcts)
        zero_idx = np.argmin(np.abs(test_excess))
        zero_pct = test_pcts[zero_idx]

        print(f"\n  {horizon.upper()}: Zero crossing at percentile rank = {zero_pct:.1f}")
        print(f"    (Metros at this percentile historically matched their state average)")

        # Also check by direct bucketing
        valid = valid.copy()
        valid["pct_bucket"] = (valid["pct_rank"] // 5) * 5
        bucket_means = valid.groupby("pct_bucket")[col].mean()
        # Find bucket closest to 0
        closest_bucket = bucket_means.abs().idxmin()
        print(f"    Bucket check: pct_rank ~{closest_bucket} has excess = {bucket_means[closest_bucket]*100:+.3f}%")

    return zero_pct  # return 3y crossing as the anchor


def build_recentered_score(df, zero_crossing_pct):
    """
    Remap so that:
      - pct_rank = zero_crossing_pct  ->  score = 50
      - pct_rank = 0                  ->  score = 1
      - pct_rank = 100                ->  score = 99

    Use two linear segments:
      Below state avg: [0, zero_crossing] -> [1, 50]
      Above state avg: [zero_crossing, 100] -> [50, 99]
    """
    print("\n" + "="*70)
    print(f"BUILDING RE-CENTERED SCORE (zero crossing at pct_rank={zero_crossing_pct:.1f})")
    print("="*70)

    zc = zero_crossing_pct

    df = df.copy()
    df["score"] = np.where(
        df["pct_rank"] <= zc,
        1 + (df["pct_rank"] / zc) * 49,            # [0, zc] -> [1, 50]
        50 + ((df["pct_rank"] - zc) / (100 - zc)) * 49  # [zc, 100] -> [50, 99]
    )
    df["score"] = df["score"].round(0).astype(int).clip(1, 99)

    # Verify: score 50 should now correspond to ~0% excess
    print("\n  Verification: excess return at each score decile")
    for horizon in ["1y", "3y"]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col]).copy()
        valid["decile"] = pd.cut(valid["score"],
                                  bins=[0,10,20,30,40,50,60,70,80,90,100],
                                  labels=[10,20,30,40,50,60,70,80,90,100],
                                  include_lowest=True)

        tbl = valid.groupby("decile", observed=True).agg(
            mean_excess=(col, "mean"),
            median_excess=(col, "median"),
            std=(col, "std"),
            hit_rate=(col, lambda x: (x > 0).mean()),
            n=(col, "count"),
        ).reset_index()

        mono = tbl["mean_excess"].is_monotonic_increasing

        print(f"\n  {horizon.upper()} (monotonic: {'YES' if mono else 'NO'}):")
        print(f"  {'Score':<8} {'Mean Excess':>12} {'Median':>10} {'Std':>8} {'P(Beat)':>10} {'N':>8}")
        print(f"  {'-'*58}")
        for _, r in tbl.iterrows():
            d = int(r["decile"])
            marker = "  <-- STATE AVG" if d == 50 else ""
            print(f"  {d:<8d} {r['mean_excess']*100:>+11.2f}% "
                  f"{r['median_excess']*100:>+9.2f}% {r['std']*100:>7.1f}% "
                  f"{r['hit_rate']*100:>9.1f}% {int(r['n']):>7d}{marker}")

        # Check score 50 bucket specifically
        s50 = valid[(valid["score"] >= 47) & (valid["score"] <= 53)]
        if len(s50) > 0:
            print(f"\n  Score 47-53 zone: excess = {s50[col].mean()*100:+.3f}%  (target: ~0%)")

    return df


def run_validation(df):
    """Quick re-validation with recentered scores."""
    print("\n" + "="*70)
    print("RE-VALIDATION WITH RECENTERED SCORES")
    print("="*70)

    for horizon in ["1y", "3y"]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col])
        ic, pval = stats.spearmanr(valid["score"], valid[col])
        hit = np.mean((valid["score"] > 50) == (valid[col] > 0))
        print(f"\n  {horizon.upper()}: IC={ic:.4f} (p={pval:.2e})  Hit={hit*100:.1f}%")

    # Year-by-year
    print("\n  Year-by-year (1Y):")
    print(f"  {'Year':<6} {'IC':>8} {'Hit%':>8} {'Q5 beats Q1':>13}")
    print(f"  {'-'*38}")
    col = "excess_1y"
    valid = df.dropna(subset=[col]).copy()
    for yr in sorted(valid["year"].unique()):
        sub = valid[valid["year"] == yr]
        if len(sub) < 100:
            continue
        ic, _ = stats.spearmanr(sub["score"], sub[col])
        hit = np.mean((sub["score"] > 50) == (sub[col] > 0))
        sub = sub.copy()
        sub["q"] = pd.qcut(sub["score"].rank(method="first"), 5, labels=[1,2,3,4,5])
        qm = sub.groupby("q")[col].mean()
        q5_beats = "YES" if qm[5] > qm[1] else "NO"
        print(f"  {yr:<6d} {ic:>+.4f} {hit*100:>7.1f}% {q5_beats:>13}")

    # Permutation test (quick, 1000 shuffles)
    print("\n  Quick permutation test (1,000 shuffles, 3Y):")
    col = "excess_3y"
    valid = df.dropna(subset=[col])
    actual_ic, _ = stats.spearmanr(valid["score"], valid[col])
    rng = np.random.RandomState(42)
    perm_ics = []
    scores_arr = valid["score"].values
    excess_arr = valid[col].values
    for _ in range(1000):
        shuffled = rng.permutation(scores_arr)
        ic_p, _ = stats.spearmanr(shuffled, excess_arr)
        perm_ics.append(ic_p)
    perm_ics = np.array(perm_ics)
    n_sigma = actual_ic / perm_ics.std()
    times_beat = (np.abs(perm_ics) >= np.abs(actual_ic)).sum()
    print(f"    Actual IC: {actual_ic:+.4f}")
    print(f"    {n_sigma:.0f} sigma from random")
    print(f"    Times random beat actual: {times_beat}/1000")

    # Final score -> excess table for the website copy
    print("\n" + "="*70)
    print("FINAL SCORE TABLE -- READY FOR THE SITE")
    print("="*70)
    for horizon, label in [("1y", "1-Year"), ("3y", "3-Year")]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col]).copy()
        valid["decile"] = pd.cut(valid["score"],
                                  bins=[0,10,20,30,40,50,60,70,80,90,100],
                                  labels=[10,20,30,40,50,60,70,80,90,100],
                                  include_lowest=True)
        tbl = valid.groupby("decile", observed=True).agg(
            excess=(col, "mean"),
            hit=(col, lambda x: (x > 0).mean()),
            n=(col, "count"),
        ).reset_index()

        print(f"\n  {label} Horizon:")
        print(f"  +{'='*52}+")
        print(f"  | {'Score':^8} | {'Excess vs State':^16} | {'P(Beat State)':^14} |")
        print(f"  +{'-'*52}+")
        for _, r in tbl.iterrows():
            d = int(r["decile"])
            marker = " *" if d == 50 else "  "
            print(f"  | {d:^8d} | {r['excess']*100:>+13.2f}%   | {r['hit']*100:>11.1f}%   |{marker}")
        print(f"  +{'='*52}+")
        print(f"  * Score 50 = State Average")


def main():
    engine = get_engine()
    df = load_and_score(engine)

    # Step 1: Find where excess return = 0
    zero_pct = find_zero_crossing(df)

    # Step 2: Build recentered score
    df = build_recentered_score(df, zero_pct)

    # Step 3: Validate
    run_validation(df)

    engine.dispose()
    print("\nDONE.")


if __name__ == "__main__":
    main()
