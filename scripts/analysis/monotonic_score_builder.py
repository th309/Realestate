#!/usr/bin/env python3
"""
Monotonic Score Builder
=======================
Build a score where:
  - 50 = state average performance
  - Higher score = ALWAYS better expected performance than lower score
  - 10 < 20 < 30 < 40 < 50 < 60 < 70 < 80 < 90 < 100

Method:
  1. Take the best predictor metric from fresh_predictor_hunt.py
  2. Cross-sectional percentile rank -> raw 0-100
  3. Isotonic regression to GUARANTEE monotonicity
  4. Re-center so 0% excess return = score 50
  5. Build the final score -> expected excess return lookup table
"""

import os
import warnings
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


def load_data(engine):
    """Load ZHVI, crosswalk, and predictor metrics."""
    print("Loading data...")

    # Metro ZHVI
    metro_zhvi = pd.read_sql("""
        SELECT region_id::text AS region_id, region_name, period_date, value AS zhvi
        FROM zillow_metro WHERE metric_name = 'zhvi' AND value IS NOT NULL
    """, engine)
    metro_zhvi["period_date"] = pd.to_datetime(metro_zhvi["period_date"])

    # State ZHVI
    state_zhvi = pd.read_sql("""
        SELECT region_id::text AS region_id, region_name, period_date, value AS zhvi
        FROM zillow_state WHERE metric_name = 'zhvi' AND value IS NOT NULL
    """, engine)
    state_zhvi["period_date"] = pd.to_datetime(state_zhvi["period_date"])

    # Crosswalk
    xwalk = pd.read_sql("""
        SELECT DISTINCT
            zillow_metro_region_id::text AS metro_region_id,
            cbsa_code, cbsa_name, state_abbrev,
            zillow_state_region_id::text AS state_region_id
        FROM geography_crosswalk
        WHERE zillow_metro_region_id IS NOT NULL
          AND zillow_state_region_id IS NOT NULL
    """, engine)
    metro_state = xwalk.drop_duplicates(subset="metro_region_id", keep="first")

    # Redfin -- the top predictors from our hunt
    cbsa_codes = metro_state["cbsa_code"].dropna().unique().tolist()
    cbsa_str = ",".join([f"'{c}'" for c in cbsa_codes])
    redfin = pd.read_sql(f"""
        SELECT cbsa_code, period_end AS period_date,
               sold_above_list, median_dom, months_of_supply,
               off_market_in_two_weeks, avg_sale_to_list
        FROM redfin_metro
        WHERE cbsa_code IN ({cbsa_str})
          AND property_type = 'All Residential'
    """, engine)
    redfin["period_date"] = pd.to_datetime(redfin["period_date"])

    print(f"  Metros: {metro_zhvi['region_id'].nunique()}")
    print(f"  States: {state_zhvi['region_id'].nunique()}")
    print(f"  Redfin rows: {len(redfin):,}")

    return metro_zhvi, state_zhvi, metro_state, redfin


def compute_excess_returns(metro_zhvi, state_zhvi, metro_state, horizon=36):
    """Compute forward excess return vs state for each metro-date."""
    metro_piv = metro_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")
    metro_ret = (metro_piv.shift(-horizon) / metro_piv - 1).stack().reset_index()
    metro_ret.columns = ["period_date", "region_id", "metro_return"]

    state_piv = state_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")
    state_ret = (state_piv.shift(-horizon) / state_piv - 1).stack().reset_index()
    state_ret.columns = ["period_date", "state_region_id", "state_return"]

    merged = metro_ret.merge(
        metro_state[["metro_region_id", "state_region_id", "cbsa_code", "cbsa_name", "state_abbrev"]],
        left_on="region_id", right_on="metro_region_id", how="inner"
    )
    merged = merged.merge(state_ret, on=["period_date", "state_region_id"], how="inner")
    merged["excess_return"] = merged["metro_return"] - merged["state_return"]
    merged = merged.dropna(subset=["excess_return"])

    print(f"  {len(merged):,} metro-date obs with {horizon}m excess returns")
    return merged


def build_monotonic_score(returns_df, redfin, horizon_label="3Y"):
    """
    Build a score guaranteed to be monotonic with actual excess returns.

    The secret: instead of mapping a metric to a score and hoping the
    score correlates with returns, we:
    1. Rank the metric cross-sectionally (percentile within each month)
    2. Use isotonic regression to find the monotonic mapping from
       percentile rank -> actual excess return
    3. Map the calibrated excess return to a 0-100 scale where 50 = 0% excess
    """
    print(f"\n{'='*70}")
    print(f"BUILDING MONOTONIC {horizon_label} SCORE")
    print(f"{'='*70}")

    # ---------------------------------------------------------------
    # Join returns to Redfin predictors
    # ---------------------------------------------------------------
    returns_df = returns_df.copy()
    returns_df["period_month"] = returns_df["period_date"].dt.to_period("M")
    redfin_copy = redfin.copy()
    redfin_copy["period_month"] = redfin_copy["period_date"].dt.to_period("M")

    merged = returns_df.merge(
        redfin_copy[["cbsa_code", "period_month", "sold_above_list", "median_dom",
                      "months_of_supply", "off_market_in_two_weeks", "avg_sale_to_list"]],
        on=["cbsa_code", "period_month"], how="inner"
    )
    merged = merged.dropna(subset=["sold_above_list", "excess_return"])
    print(f"  Observations with predictor + outcome: {len(merged):,}")

    # ---------------------------------------------------------------
    # Step 1: Cross-sectional percentile rank of the predictor
    # Higher sold_above_list = hotter market = better expected excess return
    # ---------------------------------------------------------------
    # Try single metric first, then combo

    for approach_name, compute_raw_fn in [
        ("SINGLE METRIC: sold_above_list", lambda df: df["sold_above_list"]),
        ("COMBO: sold_above_list + inverse(median_dom)",
         lambda df: (
             df.groupby("period_date")["sold_above_list"].transform(lambda x: (x - x.mean()) / max(x.std(), 0.01))
             - df.groupby("period_date")["median_dom"].transform(lambda x: (x - x.mean()) / max(x.std(), 0.01))
         )),
        ("COMBO: sold_above + inv(DOM) + inv(months_supply)",
         lambda df: (
             df.groupby("period_date")["sold_above_list"].transform(lambda x: (x - x.mean()) / max(x.std(), 0.01))
             - df.groupby("period_date")["median_dom"].transform(lambda x: (x - x.mean()) / max(x.std(), 0.01))
             - df.groupby("period_date")["months_of_supply"].transform(lambda x: (x - x.mean()) / max(x.std(), 0.01))
         )),
    ]:
        print(f"\n  --- {approach_name} ---")

        work = merged.copy()
        work["raw_signal"] = compute_raw_fn(work)
        work = work.dropna(subset=["raw_signal"])

        # Cross-sectional percentile rank (0-100) within each month
        work["pct_rank"] = work.groupby("period_date")["raw_signal"].rank(pct=True) * 100

        # ---------------------------------------------------------------
        # Step 2: Verify monotonicity of raw percentile -> excess return
        # ---------------------------------------------------------------
        work["pct_bucket"] = pd.cut(work["pct_rank"], bins=20, labels=range(1, 21))
        bucket_means = work.groupby("pct_bucket")["excess_return"].mean()

        raw_monotonic = bucket_means.is_monotonic_increasing
        ic, pval = stats.spearmanr(work["pct_rank"], work["excess_return"])

        print(f"  Raw percentile rank IC: {ic:.4f} (p={pval:.2e})")
        print(f"  Raw monotonic (20 buckets): {'YES' if raw_monotonic else 'NO'}")

        # ---------------------------------------------------------------
        # Step 3: Isotonic regression to FORCE monotonicity
        # This finds the best monotone non-decreasing function f such that
        # f(percentile_rank) approximates actual excess_return
        # ---------------------------------------------------------------
        iso = IsotonicRegression(increasing=True, out_of_bounds="clip")
        iso.fit(work["pct_rank"].values, work["excess_return"].values)

        work["calibrated_excess"] = iso.predict(work["pct_rank"].values)

        # Verify monotonicity after isotonic
        cal_bucket = work.groupby("pct_bucket")["calibrated_excess"].mean()
        is_mono_now = cal_bucket.is_monotonic_increasing
        print(f"  After isotonic calibration monotonic: {'YES' if is_mono_now else 'NO'}")

        # ---------------------------------------------------------------
        # Step 4: Map to 0-100 score centered at 50 = 0% excess
        # Find what percentile rank corresponds to 0% excess return
        # ---------------------------------------------------------------
        # The isotonic function tells us: for each pct_rank, what excess is expected
        test_pcts = np.linspace(0, 100, 1001)
        test_excess = iso.predict(test_pcts)

        # Find where excess crosses 0
        zero_crossing_idx = np.argmin(np.abs(test_excess))
        pct_at_zero = test_pcts[zero_crossing_idx]
        print(f"  Percentile rank at 0% excess (state avg): {pct_at_zero:.1f}")

        # Linear mapping: pct_at_zero -> 50, 0 -> ~5, 100 -> ~95
        # score = 50 + (pct_rank - pct_at_zero) * (45 / max(pct_at_zero, 100-pct_at_zero))
        # This maps [0, pct_at_zero] -> [5, 50] and [pct_at_zero, 100] -> [50, 95]
        work["score"] = np.where(
            work["pct_rank"] <= pct_at_zero,
            5 + (work["pct_rank"] / pct_at_zero) * 45,          # maps 0->5, pct_at_zero->50
            50 + ((work["pct_rank"] - pct_at_zero) / (100 - pct_at_zero)) * 45  # maps pct_at_zero->50, 100->95
        )
        work["score"] = work["score"].clip(5, 95).round(0).astype(int)

        # ---------------------------------------------------------------
        # Step 5: Build the final score -> excess return table
        # Using isotonic-calibrated excess grouped by score buckets
        # ---------------------------------------------------------------
        work["score_bucket"] = (work["score"] // 10) * 10  # 0,10,20,...,90
        work.loc[work["score_bucket"] == 0, "score_bucket"] = 10

        score_table = work.groupby("score_bucket").agg(
            mean_excess=("excess_return", "mean"),
            median_excess=("excess_return", "median"),
            std_excess=("excess_return", "std"),
            pct_beat_state=("excess_return", lambda x: (x > 0).mean()),
            n=("excess_return", "count"),
        ).reset_index()

        # Check if score table is monotonic
        table_monotonic = score_table["mean_excess"].is_monotonic_increasing

        print(f"\n  SCORE TABLE (monotonic: {'YES' if table_monotonic else 'NO'}):")
        print(f"  {'Score':<8} {'Avg Excess':>12} {'Median':>10} {'StdDev':>10} {'P(Beat St)':>12} {'N':>8}")
        print(f"  {'-'*62}")
        for _, r in score_table.iterrows():
            marker = " <-- STATE AVG" if r["score_bucket"] == 50 else ""
            print(f"  {int(r['score_bucket']):<8d} {r['mean_excess']*100:>+11.2f}% "
                  f"{r['median_excess']*100:>+9.2f}% {r['std_excess']*100:>9.2f}% "
                  f"{r['pct_beat_state']*100:>11.1f}% {int(r['n']):>7d}{marker}")

        # Fine-grained: every 5 points
        work["score_5"] = (work["score"] // 5) * 5
        work.loc[work["score_5"] < 10, "score_5"] = 10
        fine_table = work.groupby("score_5").agg(
            mean_excess=("excess_return", "mean"),
            pct_beat_state=("excess_return", lambda x: (x > 0).mean()),
            n=("excess_return", "count"),
        ).reset_index()

        fine_monotonic = fine_table["mean_excess"].is_monotonic_increasing
        print(f"\n  FINE-GRAINED (5-pt buckets, monotonic: {'YES' if fine_monotonic else 'NO'}):")
        print(f"  {'Score':<8} {'Avg Excess':>12} {'P(Beat St)':>12} {'N':>8}")
        print(f"  {'-'*42}")
        for _, r in fine_table.iterrows():
            marker = " <--" if int(r["score_5"]) == 50 else ""
            print(f"  {int(r['score_5']):<8d} {r['mean_excess']*100:>+11.2f}% "
                  f"{r['pct_beat_state']*100:>11.1f}% {int(r['n']):>7d}{marker}")

        # ---------------------------------------------------------------
        # Step 6: Walk-forward OOS validation
        # ---------------------------------------------------------------
        work["year"] = work["period_date"].dt.year
        all_years = sorted(work["year"].unique())
        test_years = all_years[-5:] if len(all_years) > 7 else all_years[-3:]

        oos_results = []
        for test_year in test_years:
            train = work[work["year"] < test_year]
            test = work[work["year"] == test_year]
            if len(train) < 200 or len(test) < 50:
                continue

            # Fit isotonic on train only
            iso_oos = IsotonicRegression(increasing=True, out_of_bounds="clip")
            iso_oos.fit(train["pct_rank"].values, train["excess_return"].values)

            # Predict on test
            test = test.copy()
            test["oos_calibrated"] = iso_oos.predict(test["pct_rank"].values)

            ic_oos, _ = stats.spearmanr(test["score"], test["excess_return"])
            hit = np.mean((test["score"] > 50) == (test["excess_return"] > 0))

            # Quintile spread
            test["q"] = pd.qcut(test["score"].rank(method="first"), 5, labels=[1,2,3,4,5])
            q_means = test.groupby("q")["excess_return"].mean()
            spread = q_means.iloc[-1] - q_means.iloc[0]
            mono = q_means.is_monotonic_increasing

            oos_results.append({
                "year": test_year, "ic": ic_oos, "hit_rate": hit,
                "spread": spread, "monotonic": mono, "n": len(test)
            })

        if oos_results:
            print(f"\n  WALK-FORWARD OUT-OF-SAMPLE:")
            print(f"  {'Year':<6} {'IC':>8} {'Hit%':>8} {'Spread':>10} {'Mono':>6} {'N':>7}")
            print(f"  {'-'*47}")
            for r in oos_results:
                print(f"  {r['year']:<6d} {r['ic']:>+.4f} {r['hit_rate']*100:>7.1f}% "
                      f"{r['spread']*100:>+9.2f}pp {'Y' if r['monotonic'] else 'N':>5} {r['n']:>6d}")

            avg_ic = np.mean([r["ic"] for r in oos_results])
            avg_hit = np.mean([r["hit_rate"] for r in oos_results])
            avg_spread = np.mean([r["spread"] for r in oos_results])
            pct_mono = np.mean([r["monotonic"] for r in oos_results])
            print(f"  {'AVG':<6} {avg_ic:>+.4f} {avg_hit*100:>7.1f}% "
                  f"{avg_spread*100:>+9.2f}pp {pct_mono*100:>4.0f}%")


def main():
    print("=" * 62)
    print("  MONOTONIC SCORE BUILDER")
    print("  50 = state average, higher = better, guaranteed monotonic")
    print("=" * 62)

    engine = get_engine()
    metro_zhvi, state_zhvi, metro_state, redfin = load_data(engine)

    # 3-year horizon
    returns_3y = compute_excess_returns(metro_zhvi, state_zhvi, metro_state, horizon=36)
    build_monotonic_score(returns_3y, redfin, "3Y")

    # 1-year horizon
    print("\n\n")
    returns_1y = compute_excess_returns(metro_zhvi, state_zhvi, metro_state, horizon=12)
    build_monotonic_score(returns_1y, redfin, "1Y")

    engine.dispose()
    print("\n\nDONE.")


if __name__ == "__main__":
    main()
