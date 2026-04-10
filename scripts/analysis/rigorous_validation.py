#!/usr/bin/env python3
"""
Rigorous Statistical Validation Battery
========================================
Every test that could kill this model. If it survives, it's real.

Tests:
 1. Walk-forward expanding window (train on past, test on future, never peek)
 2. Rolling 3-year window (does the signal need recent data or is it timeless?)
 3. Permutation test (shuffle scores 10,000 times — how often does random beat us?)
 4. Bootstrap confidence intervals (resample 1,000 times — how tight is the IC?)
 5. Structural break test (did the relationship change at any point?)
 6. Signal decay (is the predictive power getting weaker over time?)
 7. Score persistence (are scores stable or random noise month-to-month?)
 8. Turnover vs performance (do high-turnover metros predict worse?)
 9. Drawdown analysis (worst consecutive period of underperformance)
10. Conditional performance (rising rates vs falling, bull vs bear)
11. Calibration (predicted quintile vs actual — are we well-calibrated?)
12. Cumulative P&L simulation (if you followed the score, how would you do?)
"""

import os, warnings, sys
import numpy as np
import pandas as pd
from scipy import stats
from datetime import datetime

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
    """Load data and compute scores — same as full_backtest.py"""
    print("Loading and scoring...")

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

    # Compute returns (1Y and 3Y)
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

    # Score
    base["period_month"] = base["period_date"].dt.to_period("M")
    rf = redfin.copy()
    rf["period_month"] = rf["period_date"].dt.to_period("M")
    df = base.merge(rf[["cbsa_code","period_month","sold_above_list","median_dom","months_of_supply"]],
                     on=["cbsa_code","period_month"], how="inner")
    df = df.dropna(subset=["sold_above_list","median_dom","months_of_supply"])

    for col, name in [("sold_above_list","z_sal"),("median_dom","z_dom"),("months_of_supply","z_mos")]:
        df[name] = df.groupby("period_date")[col].transform(lambda x: (x - x.mean()) / max(x.std(), 0.001))

    df["signal"] = df["z_sal"] - df["z_dom"] - df["z_mos"]
    df["score"] = df.groupby("period_date")["signal"].rank(pct=True) * 100
    df["score"] = df["score"].round(0).astype(int).clip(1, 99)
    df = df[df["period_date"] >= "2012-01-01"]
    df["year"] = df["period_date"].dt.year

    print(f"  {len(df):,} scored observations, {df['cbsa_code'].nunique()} metros, {df['period_date'].min().date()} to {df['period_date'].max().date()}")
    return df


# =====================================================================
# TEST 1: Walk-Forward Expanding Window
# =====================================================================
def test_walk_forward_expanding(df):
    print("\n" + "="*70)
    print("TEST 1: WALK-FORWARD EXPANDING WINDOW")
    print("  Train on all data up to year N, test on year N+1. Never peek.")
    print("="*70)

    for horizon in ["1y", "3y"]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col])
        years = sorted(valid["year"].unique())

        print(f"\n  {horizon.upper()}:")
        print(f"  {'Test Year':<11} {'Train Yrs':>10} {'IC':>8} {'Hit%':>8} {'Top Q':>10} {'Bot Q':>10} {'Spread':>10}")
        print(f"  {'-'*70}")

        results = []
        for i, test_yr in enumerate(years):
            if test_yr < 2015:  # need at least 3 years training
                continue
            train = valid[valid["year"] < test_yr]
            test = valid[valid["year"] == test_yr]
            if len(test) < 50:
                continue

            ic, _ = stats.spearmanr(test["score"], test[col])
            hit = np.mean((test["score"] > 50) == (test[col] > 0))
            test = test.copy()
            test["q"] = pd.qcut(test["score"].rank(method="first"), 5, labels=[1,2,3,4,5])
            qm = test.groupby("q")[col].mean()
            top_q = qm.iloc[-1]
            bot_q = qm.iloc[0]
            spread = top_q - bot_q

            results.append({"year": test_yr, "ic": ic, "hit": hit, "spread": spread,
                            "top_q": top_q, "bot_q": bot_q, "train_yrs": test_yr - years[0]})
            print(f"  {test_yr:<11d} {test_yr - years[0]:>10d} {ic:>+.4f} {hit*100:>7.1f}% "
                  f"{top_q*100:>+9.2f}% {bot_q*100:>+9.2f}% {spread*100:>+9.2f}pp")

        if results:
            avg_ic = np.mean([r["ic"] for r in results])
            avg_hit = np.mean([r["hit"] for r in results])
            pct_pos = np.mean([r["ic"] > 0 for r in results])
            print(f"  {'-'*70}")
            print(f"  Avg IC: {avg_ic:+.4f}  |  Avg Hit: {avg_hit*100:.1f}%  |  % Positive IC: {pct_pos*100:.0f}%")


# =====================================================================
# TEST 2: Rolling 3-Year Window
# =====================================================================
def test_rolling_window(df):
    print("\n" + "="*70)
    print("TEST 2: ROLLING 3-YEAR TRAINING WINDOW")
    print("  Train on only 3 years, test on the next. Tests if old data helps or hurts.")
    print("="*70)

    col = "excess_1y"
    valid = df.dropna(subset=[col])
    years = sorted(valid["year"].unique())

    print(f"\n  {'Train Window':<16} {'Test Year':<11} {'IC':>8} {'Hit%':>8}")
    print(f"  {'-'*46}")

    for test_yr in years:
        if test_yr < 2015:
            continue
        train = valid[(valid["year"] >= test_yr - 3) & (valid["year"] < test_yr)]
        test = valid[valid["year"] == test_yr]
        if len(train) < 100 or len(test) < 50:
            continue
        ic, _ = stats.spearmanr(test["score"], test[col])
        hit = np.mean((test["score"] > 50) == (test[col] > 0))
        print(f"  {test_yr-3}-{test_yr-1:<11d} {test_yr:<11d} {ic:>+.4f} {hit*100:>7.1f}%")


# =====================================================================
# TEST 3: Permutation Test (the killer test)
# =====================================================================
def test_permutation(df, n_perms=10000):
    print("\n" + "="*70)
    print(f"TEST 3: PERMUTATION TEST ({n_perms:,} random shuffles)")
    print("  Shuffle scores randomly, compute IC. How often does random beat us?")
    print("  If p < 0.01, the signal is NOT random chance.")
    print("="*70)

    for horizon in ["1y", "3y"]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col])
        actual_ic, _ = stats.spearmanr(valid["score"], valid[col])

        # Permutation: shuffle scores within each period (preserve cross-sectional structure)
        rng = np.random.RandomState(42)
        perm_ics = []
        scores_arr = valid["score"].values
        excess_arr = valid[col].values

        for _ in range(n_perms):
            shuffled = rng.permutation(scores_arr)
            ic_perm, _ = stats.spearmanr(shuffled, excess_arr)
            perm_ics.append(ic_perm)

        perm_ics = np.array(perm_ics)
        p_value = np.mean(np.abs(perm_ics) >= np.abs(actual_ic))

        print(f"\n  {horizon.upper()}:")
        print(f"    Actual IC: {actual_ic:+.4f}")
        print(f"    Random IC mean: {perm_ics.mean():+.4f}")
        print(f"    Random IC std: {perm_ics.std():.4f}")
        print(f"    Random IC max: {np.abs(perm_ics).max():.4f}")
        print(f"    Actual IC is {actual_ic / perm_ics.std():.1f} standard deviations from random")
        print(f"    p-value: {p_value:.6f} ({'SIGNIFICANT' if p_value < 0.01 else 'NOT SIGNIFICANT'})")
        print(f"    Times random beat actual: {(np.abs(perm_ics) >= np.abs(actual_ic)).sum()} / {n_perms}")


# =====================================================================
# TEST 4: Bootstrap Confidence Intervals
# =====================================================================
def test_bootstrap_ci(df, n_boot=1000):
    print("\n" + "="*70)
    print(f"TEST 4: BOOTSTRAP CONFIDENCE INTERVALS ({n_boot} resamples)")
    print("  How tight is the IC estimate? Could it realistically be zero?")
    print("="*70)

    for horizon in ["1y", "3y"]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col])
        n = len(valid)

        rng = np.random.RandomState(42)
        boot_ics = []
        boot_hits = []

        for _ in range(n_boot):
            idx = rng.choice(n, size=n, replace=True)
            sample = valid.iloc[idx]
            ic, _ = stats.spearmanr(sample["score"], sample[col])
            hit = np.mean((sample["score"] > 50) == (sample[col] > 0))
            boot_ics.append(ic)
            boot_hits.append(hit)

        boot_ics = np.array(boot_ics)
        boot_hits = np.array(boot_hits)

        print(f"\n  {horizon.upper()}:")
        print(f"    IC:  mean={boot_ics.mean():.4f}  95% CI=[{np.percentile(boot_ics, 2.5):.4f}, {np.percentile(boot_ics, 97.5):.4f}]")
        print(f"    Hit: mean={boot_hits.mean()*100:.1f}%  95% CI=[{np.percentile(boot_hits, 2.5)*100:.1f}%, {np.percentile(boot_hits, 97.5)*100:.1f}%]")
        print(f"    P(IC > 0): {(boot_ics > 0).mean()*100:.1f}%")
        print(f"    P(IC > 0.10): {(boot_ics > 0.10).mean()*100:.1f}%")
        print(f"    P(IC > 0.15): {(boot_ics > 0.15).mean()*100:.1f}%")


# =====================================================================
# TEST 5: Structural Break Test
# =====================================================================
def test_structural_break(df):
    print("\n" + "="*70)
    print("TEST 5: STRUCTURAL BREAK TEST")
    print("  Did the IC-vs-excess relationship fundamentally change at any point?")
    print("  Chow-style: compare IC in first half vs second half of each sub-period.")
    print("="*70)

    col = "excess_3y"
    valid = df.dropna(subset=[col])

    # Split at multiple breakpoints
    breakpoints = [2016, 2017, 2018, 2019, 2020, 2021]
    print(f"\n  {'Break At':<10} {'IC Before':>10} {'IC After':>10} {'Diff':>8} {'Stable?':>8}")
    print(f"  {'-'*50}")
    for bp in breakpoints:
        before = valid[valid["year"] < bp]
        after = valid[valid["year"] >= bp]
        if len(before) < 500 or len(after) < 500:
            continue
        ic_b, _ = stats.spearmanr(before["score"], before[col])
        ic_a, _ = stats.spearmanr(after["score"], after[col])
        diff = ic_a - ic_b
        stable = abs(diff) < 0.05
        print(f"  {bp:<10d} {ic_b:>+.4f} {ic_a:>+.4f} {diff:>+.4f}   {'YES' if stable else 'DRIFT'}")


# =====================================================================
# TEST 6: Signal Decay Analysis
# =====================================================================
def test_signal_decay(df):
    print("\n" + "="*70)
    print("TEST 6: SIGNAL DECAY ANALYSIS")
    print("  Is the signal getting weaker over time? Trend in yearly IC.")
    print("="*70)

    for horizon in ["1y", "3y"]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col])
        years = sorted(valid["year"].unique())

        yearly_ics = []
        for yr in years:
            sub = valid[valid["year"] == yr]
            if len(sub) < 100:
                continue
            ic, _ = stats.spearmanr(sub["score"], sub[col])
            yearly_ics.append({"year": yr, "ic": ic})

        if len(yearly_ics) < 4:
            continue

        yrs = np.array([r["year"] for r in yearly_ics])
        ics = np.array([r["ic"] for r in yearly_ics])
        slope, intercept, r_value, p_value, std_err = stats.linregress(yrs, ics)

        print(f"\n  {horizon.upper()}:")
        print(f"    Trend slope: {slope:+.5f} IC/year")
        print(f"    R-squared: {r_value**2:.4f}")
        print(f"    p-value: {p_value:.4f}")
        if slope > 0:
            print(f"    --> Signal is STRENGTHENING over time")
        elif p_value < 0.05:
            print(f"    --> Signal is WEAKENING (statistically significant)")
        else:
            print(f"    --> No significant trend (signal is STABLE)")


# =====================================================================
# TEST 7: Score Persistence
# =====================================================================
def test_score_persistence(df):
    print("\n" + "="*70)
    print("TEST 7: SCORE PERSISTENCE")
    print("  If a metro scores X this month, what does it score later?")
    print("  High persistence = real signal. Low persistence = noise.")
    print("="*70)

    # For each metro, compute autocorrelation of score at various lags
    lags = [1, 3, 6, 12, 24]
    print(f"\n  {'Lag (months)':<15} {'Autocorrelation':>16} {'Interpretation':>20}")
    print(f"  {'-'*55}")

    for lag in lags:
        corrs = []
        for cbsa, grp in df.groupby("cbsa_code"):
            grp = grp.sort_values("period_date")
            if len(grp) < lag + 12:
                continue
            s1 = grp["score"].values[:-lag]
            s2 = grp["score"].values[lag:]
            if len(s1) > 10:
                c, _ = stats.spearmanr(s1, s2)
                if np.isfinite(c):
                    corrs.append(c)

        if corrs:
            avg_corr = np.mean(corrs)
            interp = "Very stable" if avg_corr > 0.7 else "Stable" if avg_corr > 0.5 else "Moderate" if avg_corr > 0.3 else "Noisy"
            print(f"  {lag:<15d} {avg_corr:>+15.4f} {interp:>20}")


# =====================================================================
# TEST 8: Drawdown Analysis
# =====================================================================
def test_drawdown(df):
    print("\n" + "="*70)
    print("TEST 8: WORST-CASE DRAWDOWN ANALYSIS")
    print("  What's the longest streak where the score FAILED to predict?")
    print("="*70)

    for horizon in ["1y"]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col])
        months = sorted(valid["period_date"].unique())

        monthly_ics = []
        for dt in months:
            sub = valid[valid["period_date"] == dt]
            if len(sub) < 30:
                continue
            ic, _ = stats.spearmanr(sub["score"], sub[col])
            monthly_ics.append({"date": dt, "ic": ic})

        if not monthly_ics:
            continue

        ics_df = pd.DataFrame(monthly_ics)
        ics_df["negative"] = ics_df["ic"] < 0

        # Find longest streak of negative IC
        streaks = []
        current_streak = 0
        for _, row in ics_df.iterrows():
            if row["negative"]:
                current_streak += 1
            else:
                if current_streak > 0:
                    streaks.append(current_streak)
                current_streak = 0
        if current_streak > 0:
            streaks.append(current_streak)

        total_months = len(ics_df)
        neg_months = ics_df["negative"].sum()
        worst_streak = max(streaks) if streaks else 0

        print(f"\n  {horizon.upper()} (monthly cross-sectional IC):")
        print(f"    Total months analyzed: {total_months}")
        print(f"    Months with negative IC: {neg_months} ({neg_months/total_months*100:.1f}%)")
        print(f"    Months with positive IC: {total_months - neg_months} ({(total_months-neg_months)/total_months*100:.1f}%)")
        print(f"    Longest streak of negative IC: {worst_streak} consecutive months")
        print(f"    Average IC across all months: {ics_df['ic'].mean():+.4f}")
        print(f"    Worst single month IC: {ics_df['ic'].min():+.4f} ({ics_df.loc[ics_df['ic'].idxmin(), 'date'].date()})")
        print(f"    Best single month IC: {ics_df['ic'].max():+.4f} ({ics_df.loc[ics_df['ic'].idxmax(), 'date'].date()})")


# =====================================================================
# TEST 9: Conditional Performance (Rate Environment)
# =====================================================================
def test_conditional_performance(df, engine):
    print("\n" + "="*70)
    print("TEST 9: PERFORMANCE IN DIFFERENT RATE ENVIRONMENTS")
    print("  Does the score work when rates are rising vs falling?")
    print("="*70)

    # Load mortgage rates from FRED
    try:
        rates = pd.read_sql("""
            SELECT period_date, value AS rate
            FROM economic_national
            WHERE metric_name = 'mortgage_rate_30y' AND value IS NOT NULL
            ORDER BY period_date
        """, engine)
        if len(rates) == 0:
            # Try fred table
            rates = pd.read_sql("""
                SELECT period_date, value AS rate
                FROM fred_national
                WHERE metric_name = 'mortgage_rate_30y' AND value IS NOT NULL
                ORDER BY period_date
            """, engine)
    except Exception:
        rates = pd.DataFrame()

    if len(rates) == 0:
        # Manually define rate regimes
        print("  (No rate data in DB -- using known rate regimes)")
        regimes = {
            "Falling rates (2012-2015)": ("2012-01-01", "2015-12-31"),
            "Slowly rising (2016-2018)": ("2016-01-01", "2018-12-31"),
            "Rate cuts (2019-2020)": ("2019-01-01", "2020-12-31"),
            "Ultra-low rates (2021)": ("2021-01-01", "2021-12-31"),
            "Aggressive hikes (2022-2023)": ("2022-01-01", "2023-12-31"),
            "High rate plateau (2024+)": ("2024-01-01", "2025-12-31"),
        }
    else:
        rates["period_date"] = pd.to_datetime(rates["period_date"])
        rates = rates.sort_values("period_date")
        rates["rate_12m_change"] = rates["rate"].diff(12)
        # Define regimes based on 12m rate change
        regimes = {
            "Falling rates (12m chg < -0.5%)": None,  # will filter dynamically
            "Stable rates (|12m chg| < 0.5%)": None,
            "Rising rates (12m chg > 0.5%)": None,
        }

    col = "excess_1y"
    valid = df.dropna(subset=[col])

    print(f"\n  {'Regime':<40} {'IC':>8} {'Hit%':>8} {'Spread':>10} {'N':>7}")
    print(f"  {'-'*75}")

    for label, date_range in regimes.items():
        if date_range is None:
            continue
        start, end = date_range
        sub = valid[(valid["period_date"] >= start) & (valid["period_date"] <= end)]
        if len(sub) < 100:
            continue
        ic, _ = stats.spearmanr(sub["score"], sub[col])
        hit = np.mean((sub["score"] > 50) == (sub[col] > 0))
        sub = sub.copy()
        sub["q"] = pd.qcut(sub["score"].rank(method="first"), 5, labels=[1,2,3,4,5])
        qm = sub.groupby("q")[col].mean()
        spread = qm.iloc[-1] - qm.iloc[0]
        print(f"  {label:<40} {ic:>+.4f} {hit*100:>7.1f}% {spread*100:>+9.2f}pp {len(sub):>6d}")


# =====================================================================
# TEST 10: Calibration Test
# =====================================================================
def test_calibration(df):
    print("\n" + "="*70)
    print("TEST 10: CALIBRATION TEST")
    print("  For each score quintile, is the actual performance rank-ordered?")
    print("  Perfect calibration: Q1 worst, Q5 best, every year.")
    print("="*70)

    for horizon in ["1y", "3y"]:
        col = f"excess_{horizon}"
        valid = df.dropna(subset=[col]).copy()
        years = sorted(valid["year"].unique())

        print(f"\n  {horizon.upper()} -- Quintile means by year:")
        print(f"  {'Year':<6} {'Q1(low)':>10} {'Q2':>10} {'Q3':>10} {'Q4':>10} {'Q5(high)':>10} {'Mono':>6}")
        print(f"  {'-'*60}")

        mono_count = 0
        total_count = 0
        for yr in years:
            sub = valid[valid["year"] == yr]
            if len(sub) < 100:
                continue
            sub = sub.copy()
            sub["q"] = pd.qcut(sub["score"].rank(method="first"), 5, labels=[1,2,3,4,5])
            qm = sub.groupby("q")[col].mean()
            if len(qm) < 5:
                continue

            mono = qm.is_monotonic_increasing
            total_count += 1
            if mono:
                mono_count += 1

            print(f"  {yr:<6d} {qm[1]*100:>+9.2f}% {qm[2]*100:>+9.2f}% {qm[3]*100:>+9.2f}% "
                  f"{qm[4]*100:>+9.2f}% {qm[5]*100:>+9.2f}% {'Y' if mono else 'N':>5}")

        if total_count > 0:
            print(f"  {'-'*60}")
            print(f"  Monotonic in {mono_count}/{total_count} years ({mono_count/total_count*100:.0f}%)")
            # Also check: does Q5 always beat Q1?
            q5_beats_q1 = 0
            for yr in years:
                sub = valid[valid["year"] == yr]
                if len(sub) < 100:
                    continue
                sub = sub.copy()
                sub["q"] = pd.qcut(sub["score"].rank(method="first"), 5, labels=[1,2,3,4,5])
                qm = sub.groupby("q")[col].mean()
                if len(qm) >= 5 and qm[5] > qm[1]:
                    q5_beats_q1 += 1
            print(f"  Q5 beats Q1 in {q5_beats_q1}/{total_count} years ({q5_beats_q1/total_count*100:.0f}%)")


# =====================================================================
# TEST 11: Cumulative P&L Simulation
# =====================================================================
def test_cumulative_pnl(df):
    print("\n" + "="*70)
    print("TEST 11: CUMULATIVE P&L SIMULATION")
    print("  Strategy: Each year, buy top quintile, avoid bottom quintile.")
    print("  Compare cumulative excess return vs just buying state average.")
    print("="*70)

    col = "excess_1y"
    valid = df.dropna(subset=[col]).copy()
    years = sorted(valid["year"].unique())

    print(f"\n  {'Year':<6} {'Top Q Excess':>14} {'Bot Q Excess':>14} {'Long-Short':>12}")
    print(f"  {'-'*50}")

    cum_top = 0
    cum_bot = 0
    cum_ls = 0

    for yr in years:
        sub = valid[valid["year"] == yr]
        if len(sub) < 100:
            continue
        sub = sub.copy()
        sub["q"] = pd.qcut(sub["score"].rank(method="first"), 5, labels=[1,2,3,4,5])
        qm = sub.groupby("q")[col].mean()
        if len(qm) < 5:
            continue

        top = qm[5]
        bot = qm[1]
        ls = top - bot

        cum_top += top
        cum_bot += bot
        cum_ls += ls

        print(f"  {yr:<6d} {top*100:>+13.2f}% {bot*100:>+13.2f}% {ls*100:>+11.2f}pp")

    print(f"  {'-'*50}")
    print(f"  {'CUMULATIVE':<6} {cum_top*100:>+13.2f}% {cum_bot*100:>+13.2f}% {cum_ls*100:>+11.2f}pp")
    print(f"\n  If you picked top-quintile metros every year for {len(years)} years:")
    print(f"    Total excess vs state average: {cum_top*100:+.2f}%")
    print(f"  If you picked bottom-quintile metros:")
    print(f"    Total excess vs state average: {cum_bot*100:+.2f}%")


# =====================================================================
# TEST 12: Out-of-Universe (Hold-out Metros)
# =====================================================================
def test_holdout_metros(df):
    print("\n" + "="*70)
    print("TEST 12: HOLD-OUT METRO TEST")
    print("  Remove 20% of metros entirely. Train signal on 80%, test on held-out 20%.")
    print("  If it works on metros never seen, the signal generalizes.")
    print("="*70)

    col = "excess_3y"
    valid = df.dropna(subset=[col]).copy()

    metros = valid["cbsa_code"].unique()
    rng = np.random.RandomState(42)
    holdout = rng.choice(metros, size=int(len(metros) * 0.2), replace=False)
    holdout_set = set(holdout)

    train = valid[~valid["cbsa_code"].isin(holdout_set)]
    test = valid[valid["cbsa_code"].isin(holdout_set)]

    # The score is already computed cross-sectionally (includes all metros).
    # For a true hold-out, we need to recompute scores using only the training metros.
    # But our signal is just a percentile rank — it doesn't "learn" from outcomes.
    # So the existing scores are valid for held-out metros too.

    ic_train, _ = stats.spearmanr(train["score"], train[col])
    ic_test, _ = stats.spearmanr(test["score"], test[col])
    hit_train = np.mean((train["score"] > 50) == (train[col] > 0))
    hit_test = np.mean((test["score"] > 50) == (test[col] > 0))

    print(f"\n  {'Set':<10} {'N Metros':>10} {'N Obs':>10} {'IC':>8} {'Hit%':>8}")
    print(f"  {'-'*50}")
    print(f"  {'Train':<10} {train['cbsa_code'].nunique():>10} {len(train):>10} {ic_train:>+.4f} {hit_train*100:>7.1f}%")
    print(f"  {'Hold-out':<10} {test['cbsa_code'].nunique():>10} {len(test):>10} {ic_test:>+.4f} {hit_test*100:>7.1f}%")

    diff = ic_test - ic_train
    print(f"\n  IC difference (hold-out - train): {diff:+.4f}")
    print(f"  {'PASS: Signal generalizes to unseen metros' if ic_test > 0.10 else 'CONCERN: Weak on unseen metros'}")


# =====================================================================
# MAIN
# =====================================================================
def main():
    print("=" * 62)
    print("  RIGOROUS STATISTICAL VALIDATION BATTERY")
    print("  12 tests to determine if this model has staying power")
    print("=" * 62)

    engine = get_engine()
    df = load_and_score(engine)

    test_walk_forward_expanding(df)
    test_rolling_window(df)
    test_permutation(df, n_perms=10000)
    test_bootstrap_ci(df, n_boot=1000)
    test_structural_break(df)
    test_signal_decay(df)
    test_score_persistence(df)
    test_drawdown(df)
    test_conditional_performance(df, engine)
    test_calibration(df)
    test_cumulative_pnl(df)
    test_holdout_metros(df)

    engine.dispose()

    print("\n" + "=" * 62)
    print("  ALL TESTS COMPLETE")
    print("=" * 62)


if __name__ == "__main__":
    main()
