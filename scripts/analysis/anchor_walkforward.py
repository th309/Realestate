#!/usr/bin/env python3
"""
READ-ONLY OUT-OF-SAMPLE WALK-FORWARD (Phase B0.5) — county.

Goal: irrefutable, leak-free comparison of three score bases:
  national       — single zero-crossing
  anchor_to_state— per-state zero-crossing (fallback: division -> global)
  within_state   — rank within (period, state), single zero-crossing

Leakage control: the ONLY thing fit on outcomes is the zero-crossing(s). For
each test year T we fit zc(s) using ONLY observations whose forward-return
window is fully realized BEFORE T begins (period_date + horizon <= T-01-01),
then score year-T markets and measure their ACTUAL realized excess return.
Contemporaneous percentile ranks (national / within-state) use no outcomes, so
they're computed once on the full panel without leakage.

Reports, per horizon, per method: pooled OOS Spearman IC, hit-rate, decile
monotonicity, top-vs-bottom spread, and the per-year IC series (% positive).
Writes nothing.
"""

import os, sys
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.isotonic import IsotonicRegression

sys.path.insert(0, os.path.dirname(__file__))
from county_backtest import load_and_score, get_engine

HORIZON_MONTHS = {"1y": 12, "3y": 36}
MIN_GROUP_OBS = 300   # per-group training obs needed to fit its own zero-crossing


def fit_zc(pct: np.ndarray, excess: np.ndarray) -> float:
    if len(pct) < 500:
        return 50.0
    iso = IsotonicRegression(increasing=True, out_of_bounds="clip")
    iso.fit(pct, excess)
    grid = np.linspace(1, 99, 9901)
    return float(grid[np.argmin(np.abs(iso.predict(grid)))])


def fit_group_zc(frame: pd.DataFrame, pct_col: str, ex_col: str, group_col: str) -> dict:
    out = {}
    for key, g in frame.groupby(group_col):
        if len(g) >= MIN_GROUP_OBS:
            out[key] = fit_zc(g[pct_col].values, g[ex_col].values)
    return out


def recenter(pct, zc):
    zc = np.asarray(zc, dtype=float)
    s = np.where(pct <= zc, 1 + (pct / zc) * 49, 50 + ((pct - zc) / (100 - zc)) * 49)
    return np.clip(np.round(s), 1, 99)


def pooled_metrics(score: np.ndarray, excess: np.ndarray) -> dict:
    ic, _ = stats.spearmanr(score, excess)
    hit = float(np.mean((score > 50) == (excess > 0)))
    d = pd.DataFrame({"s": score, "e": excess})
    d["dec"] = pd.cut(d["s"], bins=range(0, 101, 10), labels=range(10, 101, 10), include_lowest=True)
    dm = d.groupby("dec", observed=True)["e"].mean()
    top = dm[[x for x in dm.index if int(x) >= 80]].mean()
    bot = dm[[x for x in dm.index if int(x) <= 20]].mean()
    return {"ic": ic, "hit": hit, "mono": bool(dm.is_monotonic_increasing),
            "spread_pp": (top - bot) * 100}


def run_method(df, method, col, hm, w=1.0):
    """Walk-forward; return (per-year IC list, pooled test score+excess arrays).
    For method='anchor', w shrinks per-group zero-crossings toward national
    (w=0 -> identical to national; w=1 -> full per-state anchor)."""
    years = sorted(df["year"].unique())
    year_ics, scores, exes = [], [], []
    for T in years:
        t_start = pd.Timestamp(f"{T}-01-01")
        # training outcomes must be fully realized before test year starts
        train_mask = (df["period_date"] + pd.DateOffset(months=hm) <= t_start) & df[col].notna()
        test_mask = (df["year"] == T) & df[col].notna()
        train, test = df[train_mask], df[test_mask]
        if len(train) < 2000 or len(test) < 100:
            continue
        if method == "national":
            zc = fit_zc(train["pct_national"].values, train[col].values)
            ts = recenter(test["pct_national"].values, zc)
        elif method == "within_state":
            zc = fit_zc(train["pct_state"].values, train[col].values)
            ts = recenter(test["pct_state"].values, zc)
        else:  # anchor with shrinkage weight w
            g = fit_zc(train["pct_national"].values, train[col].values)
            szc = {k: w * v + (1 - w) * g
                   for k, v in fit_group_zc(train, "pct_national", col, "state_abbrev").items()}
            dzc = {k: w * v + (1 - w) * g
                   for k, v in fit_group_zc(train, "pct_national", col, "division").items()}
            zc_row = (test["state_abbrev"].map(szc)
                      .fillna(test["division"].map(dzc)).fillna(g).values)
            ts = recenter(test["pct_national"].values, zc_row)
        ic, _ = stats.spearmanr(ts, test[col].values)
        year_ics.append((T, ic, len(test)))
        scores.append(ts); exes.append(test[col].values)
    return year_ics, np.concatenate(scores), np.concatenate(exes)


def main():
    engine = get_engine()
    df = load_and_score(engine)
    div = pd.read_sql("SELECT state_code, division_name FROM census_division_mapping", engine)
    df["division"] = df["state_abbrev"].map(dict(zip(div["state_code"], div["division_name"]))).fillna("UNK")
    df["pct_national"] = df["pct_rank"]
    df["pct_state"] = df.groupby(["period_date", "state_abbrev"])["signal"].rank(pct=True) * 100
    engine.dispose()

    print("\n" + "=" * 84)
    print("PHASE B0.5 — OUT-OF-SAMPLE WALK-FORWARD (county, read-only, leak-free)")
    print("=" * 84)

    RECENT = [2022, 2023, 2024]  # full-fold recent regime (excludes thin 2025)

    def recent_ic(yics):
        v = [ic for y, ic, _ in yics if y in RECENT]
        return np.mean(v) if v else float("nan")

    def ic_for(yics, yr):
        for y, ic, _ in yics:
            if y == yr:
                return ic
        return float("nan")

    for h in ["1y", "3y"]:
        hm = HORIZON_MONTHS[h]
        col = f"excess_{h}"
        print(f"\n################  HORIZON {h.upper()}  ################")
        print(f"\n{'method':<18} {'pooledIC':>9} {'recent22-24':>12} {'2024':>8} {'hit':>7} {'spread':>9}")
        print("-" * 70)

        runs = [("national", run_method(df, "national", col, hm)),
                ("within_state", run_method(df, "within_state", col, hm))]
        for w in [0.25, 0.5, 0.75, 1.0]:
            runs.append((f"anchor(w={w})", run_method(df, "anchor", col, hm, w=w)))

        for name, (yics, s, e) in runs:
            m = pooled_metrics(s, e)
            print(f"{name:<18} {m['ic']:>+9.4f} {recent_ic(yics):>+12.4f} "
                  f"{ic_for(yics, 2024):>+8.3f} {m['hit']*100:>6.1f}% {m['spread_pp']:>+8.2f}pp")

    print("\nDONE (read-only).")


if __name__ == "__main__":
    main()
