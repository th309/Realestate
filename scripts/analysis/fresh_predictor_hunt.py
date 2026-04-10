#!/usr/bin/env python3
"""
Fresh Predictor Hunt — From-Scratch Analysis
=============================================
Goal: Find the simplest formula (even a single metric) that predicts
which metros will outperform their state average over 3 years.

Score semantics:
  50 = predicted to match state average
  >50 = predicted to outperform
  <50 = predicted to underperform

No existing PIQ scores used. Pure raw data → returns → predictors.
"""

import os
import sys
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import Ridge, Lasso
from sklearn.preprocessing import StandardScaler
from sklearn.isotonic import IsotonicRegression

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────
# DB Connection
# ─────────────────────────────────────────────────────────────────────
def get_engine():
    from sqlalchemy import create_engine
    from urllib.parse import quote_plus
    ref = "pysflbhpnqwoczyuaaif"
    pw = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    host = "aws-1-us-east-1.pooler.supabase.com"
    url = f"postgresql://postgres.{ref}:{quote_plus(pw)}@{host}:6543/postgres?sslmode=require"
    return create_engine(url)


# ─────────────────────────────────────────────────────────────────────
# STEP 1: Pull ZHVI time series (metros + states)
# ─────────────────────────────────────────────────────────────────────
def load_zhvi(engine):
    print("\n" + "="*70)
    print("STEP 1: Loading ZHVI (home values) for metros and states...")
    print("="*70)

    metro_zhvi = pd.read_sql("""
        SELECT region_id, region_name, period_date, value AS zhvi
        FROM zillow_metro
        WHERE metric_name = 'zhvi' AND value IS NOT NULL
        ORDER BY region_id, period_date
    """, engine)
    metro_zhvi["period_date"] = pd.to_datetime(metro_zhvi["period_date"])
    print(f"  Metro ZHVI: {len(metro_zhvi):,} rows, {metro_zhvi['region_id'].nunique()} metros")
    print(f"  Date range: {metro_zhvi['period_date'].min().date()} to {metro_zhvi['period_date'].max().date()}")

    state_zhvi = pd.read_sql("""
        SELECT region_id, region_name, period_date, value AS zhvi
        FROM zillow_state
        WHERE metric_name = 'zhvi' AND value IS NOT NULL
        ORDER BY region_id, period_date
    """, engine)
    state_zhvi["period_date"] = pd.to_datetime(state_zhvi["period_date"])
    print(f"  State ZHVI: {len(state_zhvi):,} rows, {state_zhvi['region_id'].nunique()} states")

    return metro_zhvi, state_zhvi


# ─────────────────────────────────────────────────────────────────────
# STEP 2: Build metro→state mapping
# ─────────────────────────────────────────────────────────────────────
def load_crosswalk(engine):
    print("\n" + "="*70)
    print("STEP 2: Loading geography crosswalk (metro → state)...")
    print("="*70)

    xwalk = pd.read_sql("""
        SELECT DISTINCT
            zillow_metro_region_id::text AS metro_region_id,
            cbsa_code,
            cbsa_name,
            state_fips,
            state_abbrev,
            zillow_state_region_id::text AS state_region_id
        FROM geography_crosswalk
        WHERE zillow_metro_region_id IS NOT NULL
          AND zillow_state_region_id IS NOT NULL
    """, engine)

    # De-duplicate: one row per metro (a metro can span states; pick the primary)
    metro_state = xwalk.drop_duplicates(subset="metro_region_id", keep="first")
    print(f"  {len(metro_state)} metro→state mappings")
    print(f"  Sample: {metro_state[['metro_region_id','cbsa_name','state_abbrev']].head(3).to_string(index=False)}")

    return metro_state


# ─────────────────────────────────────────────────────────────────────
# STEP 3: Compute 3-year forward returns & excess vs state
# ─────────────────────────────────────────────────────────────────────
def compute_returns(metro_zhvi, state_zhvi, metro_state, horizon_months=36):
    print("\n" + "="*70)
    print(f"STEP 3: Computing {horizon_months}-month forward returns & excess vs state...")
    print("="*70)

    h = horizon_months

    # --- Metro returns ---
    metro_piv = metro_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")
    metro_ret = metro_piv.shift(-h) / metro_piv - 1  # forward return
    metro_ret = metro_ret.stack().reset_index()
    metro_ret.columns = ["period_date", "region_id", "metro_return"]

    # --- State returns ---
    state_piv = state_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")
    state_ret = state_piv.shift(-h) / state_piv - 1
    state_ret = state_ret.stack().reset_index()
    state_ret.columns = ["period_date", "state_region_id", "state_return"]

    # --- Join metro returns to state returns via crosswalk ---
    metro_ret["region_id"] = metro_ret["region_id"].astype(str)
    metro_state["metro_region_id"] = metro_state["metro_region_id"].astype(str)
    merged = metro_ret.merge(
        metro_state[["metro_region_id", "state_region_id", "cbsa_code", "cbsa_name", "state_abbrev"]],
        left_on="region_id", right_on="metro_region_id", how="inner"
    )
    merged["state_region_id"] = merged["state_region_id"].astype(str)
    state_ret["state_region_id"] = state_ret["state_region_id"].astype(str)
    merged = merged.merge(state_ret, on=["period_date", "state_region_id"], how="inner")

    # --- Excess return ---
    merged["excess_return"] = merged["metro_return"] - merged["state_return"]

    merged = merged.dropna(subset=["metro_return", "state_return", "excess_return"])

    print(f"  {len(merged):,} metro-date observations with {h}m forward returns")
    print(f"  {merged['region_id'].nunique()} unique metros")
    print(f"  Date range: {merged['period_date'].min().date()} to {merged['period_date'].max().date()}")
    print(f"  Excess return distribution:")
    print(f"    Mean: {merged['excess_return'].mean()*100:.2f}%")
    print(f"    StdDev: {merged['excess_return'].std()*100:.2f}%")
    print(f"    25th pctl: {merged['excess_return'].quantile(0.25)*100:.2f}%")
    print(f"    75th pctl: {merged['excess_return'].quantile(0.75)*100:.2f}%")

    return merged


# ─────────────────────────────────────────────────────────────────────
# STEP 4: Pull ALL candidate predictor metrics
# ─────────────────────────────────────────────────────────────────────
def load_predictors(engine, metro_state):
    print("\n" + "="*70)
    print("STEP 4: Loading candidate predictor metrics...")
    print("="*70)

    cbsa_codes = metro_state["cbsa_code"].dropna().unique().tolist()
    cbsa_str = ",".join([f"'{c}'" for c in cbsa_codes])

    frames = {}

    # --- Zillow metrics (long format → pivot) ---
    zillow_metrics_to_test = [
        "zhvi", "zori", "inventory", "dom", "sale_to_list", "price_cuts",
        "market_heat", "list_price", "sale_price", "new_listings", "pending_sales",
        "zordi", "years_to_save", "homeowner_afford", "renter_afford",
        "affordable_price", "homeowner_income", "renter_income"
    ]
    for zm in zillow_metrics_to_test:
        df = pd.read_sql(f"""
            SELECT region_id, period_date, value AS val
            FROM zillow_metro
            WHERE metric_name = '{zm}' AND value IS NOT NULL
        """, engine)
        if len(df) > 0:
            df["period_date"] = pd.to_datetime(df["period_date"])
            df["region_id"] = df["region_id"].astype(str)
            df = df.merge(
                metro_state[["metro_region_id", "cbsa_code"]],
                left_on="region_id", right_on="metro_region_id", how="inner"
            )
            frames[f"z_{zm}"] = df[["cbsa_code", "period_date", "val"]].rename(columns={"val": f"z_{zm}"})
            print(f"  z_{zm}: {len(df):,} rows")

    # --- Redfin metrics (wide format) ---
    redfin_cols = [
        "median_sale_price", "median_dom", "avg_sale_to_list", "sold_above_list",
        "off_market_in_two_weeks", "homes_sold_yoy", "inventory", "months_of_supply",
        "new_listings_yoy", "price_drops", "pending_sales_yoy",
        "median_ppsf", "median_sale_price_yoy"
    ]
    redfin_select = ", ".join(redfin_cols)
    rf = pd.read_sql(f"""
        SELECT cbsa_code, period_end AS period_date, {redfin_select}
        FROM redfin_metro
        WHERE cbsa_code IN ({cbsa_str})
          AND property_type = 'All Residential'
    """, engine)
    rf["period_date"] = pd.to_datetime(rf["period_date"])
    for col in redfin_cols:
        sub = rf[["cbsa_code", "period_date", col]].dropna(subset=[col]).rename(columns={col: f"rf_{col}"})
        if len(sub) > 0:
            frames[f"rf_{col}"] = sub
            print(f"  rf_{col}: {len(sub):,} rows")

    # --- Census metrics (annual, wide format) ---
    census_cols = [
        "total_population", "population_yoy", "median_age",
        "median_household_income", "income_yoy", "homeownership_rate",
        "median_home_value", "median_gross_rent", "rent_as_pct_of_income"
    ]
    cen_select = ", ".join(census_cols)
    cen = pd.read_sql(f"""
        SELECT cbsa_code, year, {cen_select}
        FROM census_metro
        WHERE cbsa_code IN ({cbsa_str})
    """, engine)
    # Census is annual — create a period_date as Dec 31 of each year
    cen["period_date"] = pd.to_datetime(cen["year"].astype(str) + "-12-31")
    for col in census_cols:
        sub = cen[["cbsa_code", "period_date", col]].dropna(subset=[col]).rename(columns={col: f"cen_{col}"})
        if len(sub) > 0:
            frames[f"cen_{col}"] = sub
            print(f"  cen_{col}: {len(sub):,} rows")

    # --- Realtor metrics (monthly, wide format) ---
    realtor_cols = [
        "hotness_score", "supply_score", "demand_score",
        "median_listing_price", "active_listing_count", "active_listing_count_yy",
        "median_days_on_market", "median_days_on_market_yy",
        "price_reduced_share", "pending_listing_count_yy",
        "pending_ratio", "new_listing_count_yy"
    ]
    rl_select = ", ".join(realtor_cols)
    rl = pd.read_sql(f"""
        SELECT cbsa_code, period_date, {rl_select}
        FROM realtor_metro
        WHERE cbsa_code IN ({cbsa_str})
    """, engine)
    rl["period_date"] = pd.to_datetime(rl["period_date"])
    for col in realtor_cols:
        sub = rl[["cbsa_code", "period_date", col]].dropna(subset=[col]).rename(columns={col: f"rl_{col}"})
        if len(sub) > 0:
            frames[f"rl_{col}"] = sub
            print(f"  rl_{col}: {len(sub):,} rows")

    # --- Economic metrics (monthly/quarterly, wide format) ---
    econ_cols = [
        "unemployment_rate", "unemployment_rate_yoy",
        "employment_yoy", "gdp_yoy", "rpp_all_items", "rpp_housing"
    ]
    ec_select = ", ".join(econ_cols)
    ec = pd.read_sql(f"""
        SELECT cbsa_code, period_date, {ec_select}
        FROM economic_metro
        WHERE cbsa_code IN ({cbsa_str})
    """, engine)
    ec["period_date"] = pd.to_datetime(ec["period_date"])
    for col in econ_cols:
        sub = ec[["cbsa_code", "period_date", col]].dropna(subset=[col]).rename(columns={col: f"ec_{col}"})
        if len(sub) > 0:
            frames[f"ec_{col}"] = sub
            print(f"  ec_{col}: {len(sub):,} rows")

    print(f"\n  Total candidate metrics loaded: {len(frames)}")
    return frames


# ─────────────────────────────────────────────────────────────────────
# STEP 5: Join predictors to returns & test each one
# ─────────────────────────────────────────────────────────────────────
def test_univariate_predictors(returns_df, predictor_frames):
    print("\n" + "="*70)
    print("STEP 5: Testing each metric's predictive power...")
    print("  (Spearman IC between metric value and 3Y excess return vs state)")
    print("="*70)

    results = []

    for metric_name, pred_df in predictor_frames.items():
        value_col = metric_name  # column name matches metric_name

        # Merge predictor to returns on (cbsa_code, period_date)
        # For census (annual), use nearest-date merge
        if "cen_" in metric_name:
            # Forward-fill annual census data to monthly
            pred_monthly = pred_df.copy()
            # For each cbsa, create monthly dates by reindexing
            # Simpler: just merge on year
            returns_df["year"] = returns_df["period_date"].dt.year
            pred_monthly["year"] = pred_monthly["period_date"].dt.year
            merged = returns_df.merge(
                pred_monthly[["cbsa_code", "year", value_col]],
                on=["cbsa_code", "year"], how="inner"
            )
        else:
            # Monthly merge: snap to nearest month
            pred_df = pred_df.copy()
            pred_df["period_month"] = pred_df["period_date"].dt.to_period("M")
            returns_with_month = returns_df.copy()
            returns_with_month["period_month"] = returns_with_month["period_date"].dt.to_period("M")
            merged = returns_with_month.merge(
                pred_df[["cbsa_code", "period_month", value_col]],
                on=["cbsa_code", "period_month"], how="inner"
            )

        valid = merged.dropna(subset=[value_col, "excess_return"])
        n = len(valid)

        if n < 100:
            continue

        # Overall Spearman IC
        ic, pval = stats.spearmanr(valid[value_col], valid["excess_return"])

        # Per-period IC (cross-sectional at each date)
        period_ics = []
        for dt, grp in valid.groupby("period_date"):
            if len(grp) >= 20:
                c, _ = stats.spearmanr(grp[value_col], grp["excess_return"])
                if np.isfinite(c):
                    period_ics.append(c)

        mean_cs_ic = np.mean(period_ics) if period_ics else 0
        std_cs_ic = np.std(period_ics) if len(period_ics) > 1 else 999
        ir = mean_cs_ic / std_cs_ic if std_cs_ic > 0 else 0
        hit_rate = np.mean([1 for x in period_ics if x > 0]) / max(len(period_ics), 1) * 100 if period_ics else 0

        # Quintile analysis
        try:
            valid = valid.copy()
            valid["quintile"] = pd.qcut(valid[value_col].rank(method="first"), 5, labels=[1,2,3,4,5])
            q_excess = valid.groupby("quintile")["excess_return"].mean()
            top_q = q_excess.iloc[-1]
            bot_q = q_excess.iloc[0]
            spread = top_q - bot_q
            monotonic = q_excess.is_monotonic_increasing or q_excess.is_monotonic_decreasing
        except Exception:
            top_q = 0
            bot_q = 0
            spread = 0
            monotonic = False

        results.append({
            "metric": metric_name,
            "n_obs": n,
            "n_periods": len(period_ics),
            "overall_ic": round(ic, 4),
            "p_value": pval,
            "mean_cross_sectional_ic": round(mean_cs_ic, 4),
            "ic_ir": round(ir, 3),
            "ic_hit_rate_pct": round(hit_rate, 1),
            "quintile_spread": round(spread * 100, 2),
            "top_quintile_excess_pct": round(top_q * 100, 2) if 'top_q' in dir() else 0,
            "bot_quintile_excess_pct": round(bot_q * 100, 2) if 'bot_q' in dir() else 0,
            "monotonic": monotonic,
        })

    results_df = pd.DataFrame(results)
    results_df = results_df.sort_values("mean_cross_sectional_ic", ascending=False, key=abs)

    print(f"\n  Tested {len(results_df)} metrics with sufficient data (100+ obs)")
    print("\n  TOP 20 METRICS BY |CROSS-SECTIONAL IC|:")
    print("  " + "-"*120)
    top = results_df.head(20)
    for _, r in top.iterrows():
        sig = "***" if r["p_value"] < 0.001 else "**" if r["p_value"] < 0.01 else "*" if r["p_value"] < 0.05 else ""
        mono = "Y" if r["monotonic"] else "N"
        print(f"  {r['metric']:<35s} IC={r['mean_cross_sectional_ic']:+.4f}  IR={r['ic_ir']:+.3f}  "
              f"Hit={r['ic_hit_rate_pct']:5.1f}%  Spread={r['quintile_spread']:+6.2f}pp  "
              f"Mono={mono}  n={r['n_obs']:>7,}  {sig}")

    return results_df


# ─────────────────────────────────────────────────────────────────────
# STEP 6: Walk-forward validation of top metrics (individual)
# ─────────────────────────────────────────────────────────────────────
def walk_forward_univariate(returns_df, predictor_frames, top_metrics, n_folds=5):
    print("\n" + "="*70)
    print("STEP 6: Walk-forward out-of-sample validation of top metrics...")
    print("="*70)

    returns_df = returns_df.copy()
    returns_df["year"] = returns_df["period_date"].dt.year

    all_years = sorted(returns_df["year"].unique())
    # Use last n_folds years as test sets
    if len(all_years) < n_folds + 3:
        n_folds = max(1, len(all_years) - 3)
    test_years = all_years[-n_folds:]

    results = []
    for metric_name in top_metrics:
        pred_df = predictor_frames.get(metric_name)
        if pred_df is None:
            continue

        value_col = metric_name

        # Merge
        if "cen_" in metric_name:
            pred_df = pred_df.copy()
            pred_df["year"] = pred_df["period_date"].dt.year
            merged = returns_df.merge(
                pred_df[["cbsa_code", "year", value_col]],
                on=["cbsa_code", "year"], how="inner"
            )
        else:
            pred_df = pred_df.copy()
            pred_df["period_month"] = pred_df["period_date"].dt.to_period("M")
            rm = returns_df.copy()
            rm["period_month"] = rm["period_date"].dt.to_period("M")
            merged = rm.merge(
                pred_df[["cbsa_code", "period_month", value_col]],
                on=["cbsa_code", "period_month"], how="inner"
            )
            merged["year"] = merged["period_date"].dt.year

        valid = merged.dropna(subset=[value_col, "excess_return"])

        oos_ics = []
        oos_hit_rates = []
        oos_spreads = []

        for test_year in test_years:
            train = valid[valid["year"] < test_year]
            test = valid[valid["year"] == test_year]

            if len(train) < 50 or len(test) < 20:
                continue

            # In walk-forward: we just measure the rank correlation in the test set
            # (univariate — no fitting needed, just direction from train)
            train_ic, _ = stats.spearmanr(train[value_col], train["excess_return"])
            direction = 1 if train_ic > 0 else -1

            test_ic, _ = stats.spearmanr(test[value_col], test["excess_return"])
            oos_ics.append(test_ic * direction)  # Align to trained direction

            # Hit rate: does the metric correctly identify above-state-average?
            test_sorted = test.copy()
            test_sorted["predicted_above"] = (test_sorted[value_col] * direction) > test_sorted[value_col].median() * direction
            test_sorted["actual_above"] = test_sorted["excess_return"] > 0
            hit = (test_sorted["predicted_above"] == test_sorted["actual_above"]).mean()
            oos_hit_rates.append(hit)

            # Quintile spread in test set
            try:
                test_sorted["q"] = pd.qcut(test_sorted[value_col].rank(method="first") * direction, 5, labels=[1,2,3,4,5])
                q_means = test_sorted.groupby("q")["excess_return"].mean()
                if len(q_means) >= 2:
                    oos_spreads.append(q_means.max() - q_means.min())
            except Exception:
                pass

        if not oos_ics:
            continue

        results.append({
            "metric": metric_name,
            "oos_mean_ic": round(np.mean(oos_ics), 4),
            "oos_std_ic": round(np.std(oos_ics), 4),
            "oos_ir": round(np.mean(oos_ics) / max(np.std(oos_ics), 0.001), 3),
            "oos_hit_rate_pct": round(np.mean(oos_hit_rates) * 100, 1),
            "oos_mean_spread_pct": round(np.mean(oos_spreads) * 100, 2) if oos_spreads else 0,
            "n_folds": len(oos_ics),
        })

    results_df = pd.DataFrame(results).sort_values("oos_mean_ic", ascending=False, key=abs)
    print("\n  WALK-FORWARD OUT-OF-SAMPLE RESULTS:")
    print("  " + "-"*100)
    for _, r in results_df.iterrows():
        print(f"  {r['metric']:<35s} OOS_IC={r['oos_mean_ic']:+.4f}  IR={r['oos_ir']:+.3f}  "
              f"Hit={r['oos_hit_rate_pct']:5.1f}%  Spread={r['oos_mean_spread_pct']:+.2f}pp  "
              f"folds={r['n_folds']}")

    return results_df


# ─────────────────────────────────────────────────────────────────────
# STEP 7: Build multi-metric model & calibrate score
# ─────────────────────────────────────────────────────────────────────
def build_and_calibrate_model(returns_df, predictor_frames, top_n_metrics, n_folds=5):
    print("\n" + "="*70)
    print("STEP 7: Building multi-metric model with walk-forward validation...")
    print("="*70)

    returns_df = returns_df.copy()
    returns_df["year"] = returns_df["period_date"].dt.year

    # Assemble feature matrix
    master = returns_df[["cbsa_code", "period_date", "year", "excess_return", "region_id",
                          "state_abbrev", "cbsa_name", "metro_return", "state_return"]].copy()
    master["period_month"] = master["period_date"].dt.to_period("M")

    for metric_name in top_n_metrics:
        pred_df = predictor_frames.get(metric_name)
        if pred_df is None:
            continue
        value_col = metric_name
        if "cen_" in metric_name:
            pred_df = pred_df.copy()
            pred_df["year"] = pred_df["period_date"].dt.year
            master = master.merge(
                pred_df[["cbsa_code", "year", value_col]],
                on=["cbsa_code", "year"], how="left"
            )
        else:
            pred_df = pred_df.copy()
            pred_df["period_month"] = pred_df["period_date"].dt.to_period("M")
            master = master.merge(
                pred_df[["cbsa_code", "period_month", value_col]],
                on=["cbsa_code", "period_month"], how="left"
            )

    feature_cols = [m for m in top_n_metrics if m in master.columns]
    master_clean = master.dropna(subset=feature_cols + ["excess_return"])
    print(f"  Feature matrix: {len(master_clean):,} rows × {len(feature_cols)} features")
    print(f"  Features: {feature_cols}")

    all_years = sorted(master_clean["year"].unique())
    test_years = all_years[-n_folds:] if len(all_years) > n_folds + 2 else all_years[-2:]

    all_oos_preds = []
    fold_results = []

    for test_year in test_years:
        train = master_clean[master_clean["year"] < test_year]
        test = master_clean[master_clean["year"] == test_year]
        if len(train) < 100 or len(test) < 20:
            continue

        X_train = train[feature_cols].values
        y_train = train["excess_return"].values
        X_test = test[feature_cols].values
        y_test = test["excess_return"].values

        scaler = StandardScaler()
        X_train_s = scaler.fit_transform(X_train)
        X_test_s = scaler.transform(X_test)

        # Ridge regression (robust, handles collinearity)
        model = Ridge(alpha=1.0)
        model.fit(X_train_s, y_train)
        preds = model.predict(X_test_s)

        ic, _ = stats.spearmanr(preds, y_test)
        hit = np.mean((preds > 0) == (y_test > 0))

        # Quintile spread
        test_with_pred = test.copy()
        test_with_pred["predicted_excess"] = preds
        try:
            test_with_pred["q"] = pd.qcut(pd.Series(preds).rank(method="first"), 5, labels=[1,2,3,4,5])
            q_means = test_with_pred.groupby("q")["excess_return"].mean()
            spread = q_means.max() - q_means.min()
        except Exception:
            spread = 0

        fold_results.append({
            "test_year": test_year,
            "n_test": len(test),
            "ic": round(ic, 4),
            "hit_rate": round(hit * 100, 1),
            "spread_pct": round(spread * 100, 2),
        })

        oos_rows = test.copy()
        oos_rows["predicted_excess"] = preds
        all_oos_preds.append(oos_rows)

        print(f"  Fold {test_year}: IC={ic:.4f}  Hit={hit*100:.1f}%  Spread={spread*100:.2f}pp  (n={len(test)})")

    # Overall OOS stats
    if all_oos_preds:
        all_oos = pd.concat(all_oos_preds)
        oos_ic, _ = stats.spearmanr(all_oos["predicted_excess"], all_oos["excess_return"])
        oos_hit = np.mean((all_oos["predicted_excess"] > 0) == (all_oos["excess_return"] > 0))
        print(f"\n  OVERALL OUT-OF-SAMPLE:")
        print(f"    IC = {oos_ic:.4f}")
        print(f"    Hit Rate = {oos_hit*100:.1f}% (>50% = better than random)")
        print(f"    N = {len(all_oos):,}")

        # Calibration: map predicted excess → actual excess by decile
        all_oos["pred_decile"] = pd.qcut(all_oos["predicted_excess"], 10, labels=range(1,11), duplicates="drop")
        cal = all_oos.groupby("pred_decile").agg(
            mean_predicted=("predicted_excess", "mean"),
            mean_actual=("excess_return", "mean"),
            std_actual=("excess_return", "std"),
            n=("excess_return", "count"),
            pct_positive=("excess_return", lambda x: (x > 0).mean()),
        ).reset_index()

        print("\n  CALIBRATION TABLE (predicted decile → actual excess return vs state):")
        print("  " + "-"*90)
        print(f"  {'Decile':<8} {'Pred Excess':>12} {'Actual Excess':>14} {'StdDev':>8} {'Hit Rate':>10} {'N':>6}")
        print("  " + "-"*90)
        for _, row in cal.iterrows():
            print(f"  {int(row['pred_decile']):<8d} {row['mean_predicted']*100:>+11.2f}% {row['mean_actual']*100:>+13.2f}% "
                  f"{row['std_actual']*100:>7.2f}% {row['pct_positive']*100:>9.1f}% {int(row['n']):>5d}")

        # Score construction: map predicted_excess to 0-100 scale, centered at 50
        print("\n  SCORE → EXPECTED EXCESS RETURN MAPPING:")
        print("  " + "-"*70)
        all_oos["raw_score"] = 50 + (all_oos["predicted_excess"] / all_oos["predicted_excess"].abs().quantile(0.95)) * 40
        all_oos["raw_score"] = all_oos["raw_score"].clip(0, 100)
        all_oos["score_bucket"] = pd.cut(all_oos["raw_score"], bins=[0,10,20,30,40,50,60,70,80,90,100], labels=[5,15,25,35,45,55,65,75,85,95])
        score_map = all_oos.groupby("score_bucket").agg(
            mean_actual_excess=("excess_return", "mean"),
            std=("excess_return", "std"),
            hit_rate=("excess_return", lambda x: (x > 0).mean()),
            n=("excess_return", "count"),
        ).reset_index()

        print(f"  {'Score':<8} {'Expected Excess':>16} {'Std':>8} {'P(Beat State)':>14} {'N':>6}")
        print("  " + "-"*70)
        for _, row in score_map.iterrows():
            print(f"  {int(float(row['score_bucket'])):<8d} {row['mean_actual_excess']*100:>+15.2f}% "
                  f"{row['std']*100:>7.2f}% {row['hit_rate']*100:>13.1f}% {int(row['n']):>5d}")

        # Final model coefficients (train on all data)
        X_all = master_clean[feature_cols].values
        y_all = master_clean["excess_return"].values
        scaler_final = StandardScaler()
        X_all_s = scaler_final.fit_transform(X_all)
        model_final = Ridge(alpha=1.0)
        model_final.fit(X_all_s, y_all)

        print("\n  FINAL MODEL COEFFICIENTS (standardized):")
        print("  " + "-"*60)
        coef_df = pd.DataFrame({
            "feature": feature_cols,
            "coefficient": model_final.coef_,
            "abs_coef": np.abs(model_final.coef_),
        }).sort_values("abs_coef", ascending=False)
        for _, r in coef_df.iterrows():
            direction = "+" if r["coefficient"] > 0 else "-"
            print(f"  {r['feature']:<35s} {direction} {r['abs_coef']:.6f}")
        print(f"  intercept: {model_final.intercept_:.6f}")

        return all_oos, fold_results, model_final, scaler_final, feature_cols
    else:
        print("  ERROR: No out-of-sample predictions generated!")
        return None, fold_results, None, None, feature_cols


# ─────────────────────────────────────────────────────────────────────
# STEP 8: Single-metric "can we do it with just ONE number?" test
# ─────────────────────────────────────────────────────────────────────
def test_single_metric_score(returns_df, predictor_frames, best_metric):
    print("\n" + "="*70)
    print(f"STEP 8: Can we do it with JUST '{best_metric}'?")
    print("="*70)

    pred_df = predictor_frames[best_metric].copy()
    value_col = best_metric

    returns_df = returns_df.copy()
    returns_df["year"] = returns_df["period_date"].dt.year

    if "cen_" in best_metric:
        pred_df["year"] = pred_df["period_date"].dt.year
        merged = returns_df.merge(pred_df[["cbsa_code", "year", value_col]], on=["cbsa_code", "year"], how="inner")
    else:
        pred_df["period_month"] = pred_df["period_date"].dt.to_period("M")
        returns_df["period_month"] = returns_df["period_date"].dt.to_period("M")
        merged = returns_df.merge(pred_df[["cbsa_code", "period_month", value_col]], on=["cbsa_code", "period_month"], how="inner")

    valid = merged.dropna(subset=[value_col, "excess_return"])

    # Determine direction from full sample
    ic_full, pval = stats.spearmanr(valid[value_col], valid["excess_return"])
    direction = 1 if ic_full > 0 else -1
    print(f"  Full-sample IC: {ic_full:.4f} (p={pval:.2e}), direction: {'positive' if direction > 0 else 'negative'}")

    # State-relative z-score: within each (state, date), z-score the metric
    valid["state_z"] = valid.groupby(["state_abbrev", "period_date"])[value_col].transform(
        lambda x: (x - x.mean()) / x.std() if x.std() > 0 else 0
    )

    # Also try simple cross-sectional z-score
    valid["xs_z"] = valid.groupby("period_date")[value_col].transform(
        lambda x: (x - x.mean()) / x.std() if x.std() > 0 else 0
    )

    # Test both
    for z_col, label in [("state_z", "State-Relative Z"), ("xs_z", "Cross-Sectional Z")]:
        ic_z, pval_z = stats.spearmanr(valid[z_col] * direction, valid["excess_return"])
        print(f"\n  {label}:")
        print(f"    IC with excess return: {ic_z:.4f} (p={pval_z:.2e})")

        # Quintile spread
        valid = valid.copy()
        valid["q"] = pd.qcut((valid[z_col] * direction).rank(method="first"), 5, labels=[1,2,3,4,5])
        q_means = valid.groupby("q")["excess_return"].mean()
        print(f"    Quintile excess returns:")
        for q, v in q_means.items():
            print(f"      Q{q}: {v*100:+.2f}%")
        if len(q_means) >= 2:
            print(f"    Spread (Q5 - Q1): {(q_means.iloc[-1] - q_means.iloc[0])*100:+.2f}pp")

        # Score mapping: z_score → 50-centered score
        valid["score"] = 50 + valid[z_col] * direction * 15  # ~15 pts per stddev
        valid["score"] = valid["score"].clip(5, 95)
        valid["score_bucket"] = pd.cut(valid["score"], bins=[0,20,30,40,45,50,55,60,70,80,100],
                                        labels=[10,25,35,42,47,52,57,65,75,90])
        sm = valid.groupby("score_bucket").agg(
            excess=("excess_return", "mean"),
            std=("excess_return", "std"),
            hit=("excess_return", lambda x: (x > 0).mean()),
            n=("excess_return", "count"),
        ).reset_index()
        print(f"\n    Score → Actual Performance:")
        print(f"    {'Score':<8} {'Excess vs State':>16} {'P(Beat State)':>14} {'N':>8}")
        print(f"    {'-'*50}")
        for _, r in sm.iterrows():
            s = int(float(r["score_bucket"]))
            print(f"    {s:<8d} {r['excess']*100:>+15.2f}% {r['hit']*100:>13.1f}% {int(r['n']):>7d}")


# ─────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 62)
    print("  FRESH PREDICTOR HUNT -- From-Scratch Analysis")
    print("  Goal: Find what predicts outperformance vs state average")
    print("=" * 62)

    engine = get_engine()

    # Load base data
    metro_zhvi, state_zhvi = load_zhvi(engine)
    metro_state = load_crosswalk(engine)

    # Compute 3-year forward returns & excess vs state
    returns_df = compute_returns(metro_zhvi, state_zhvi, metro_state, horizon_months=36)

    # Load all candidate predictors
    predictor_frames = load_predictors(engine, metro_state)

    # Test each metric individually
    univariate_results = test_univariate_predictors(returns_df, predictor_frames)

    # Walk-forward validation of top 15
    top_15 = univariate_results.head(15)["metric"].tolist()
    wf_results = walk_forward_univariate(returns_df, predictor_frames, top_15)

    # Build multi-metric model with top 5 metrics
    top_5 = univariate_results.head(5)["metric"].tolist()
    all_oos, fold_res, model, scaler, features = build_and_calibrate_model(
        returns_df, predictor_frames, top_5
    )

    # Single-metric test with the absolute best
    best_metric = univariate_results.iloc[0]["metric"]
    test_single_metric_score(returns_df, predictor_frames, best_metric)

    # Also test with Realtor hotness score if available (intuitive metric)
    if "rl_hotness_score" in predictor_frames:
        test_single_metric_score(returns_df, predictor_frames, "rl_hotness_score")

    # Also try 1-year horizon
    print("\n\n" + "="*70)
    print("BONUS: Repeating with 12-month horizon...")
    print("="*70)
    returns_1y = compute_returns(metro_zhvi, state_zhvi, metro_state, horizon_months=12)
    univariate_1y = test_univariate_predictors(returns_1y, predictor_frames)

    engine.dispose()
    print("\n\nDONE.")


if __name__ == "__main__":
    main()
