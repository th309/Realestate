#!/usr/bin/env python3
"""
READ-ONLY PROTOTYPE (Phase B0): compare PropertyIQ county scoring under three
percentile-ranking bases, WITHOUT writing anything to the DB.

  1. national      — rank signal across all counties per period (current prod)
  2. within_state  — rank within (period, state)
  3. pooled(N)     — rank within (period, state) if the state has >= N counties
                     that period, else within (period, census_division)

For each: re-fit the zero-crossing (isotonic pct_rank -> excess_3y), build the
1-99 score, and report predictive validity (Spearman IC, hit-rate, decile
monotonicity, top-vs-bottom spread) plus how much scores shift vs national and
how small states behave. This tells us whether within-state ranking preserves
the signal and what min-N threshold to use.
"""

import os, sys
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.isotonic import IsotonicRegression

sys.path.insert(0, os.path.dirname(__file__))
from county_backtest import load_and_score, get_engine  # reuse canonical pipeline


def fit_recenter(pct_rank: pd.Series, excess_3y: pd.Series) -> tuple[float, pd.Series]:
    """Fit zero-crossing on pct_rank->excess_3y, return (zc, recentered score)."""
    mask = excess_3y.notna()
    if mask.sum() > 1000:
        iso = IsotonicRegression(increasing=True, out_of_bounds="clip")
        iso.fit(pct_rank[mask].values, excess_3y[mask].values)
        grid = np.linspace(1, 99, 9901)
        zc = grid[np.argmin(np.abs(iso.predict(grid)))]
    else:
        zc = 50.0
    return zc, apply_recenter(pct_rank, zc)


def apply_recenter(pct_rank: pd.Series, zc) -> pd.Series:
    """Two-segment recenter; zc may be a scalar or a per-row array/Series."""
    zc = np.asarray(zc, dtype=float)
    score = np.where(
        pct_rank <= zc,
        1 + (pct_rank / zc) * 49,
        50 + ((pct_rank - zc) / (100 - zc)) * 49,
    )
    return pd.Series(np.clip(np.round(score), 1, 99), index=pct_rank.index)


def fit_group_zc(df: pd.DataFrame, group_col: str, min_obs: int = 1000) -> dict:
    """Fit a per-group zero-crossing (national pct_rank -> excess_3y)."""
    out = {}
    for key, g in df.groupby(group_col):
        m = g["excess_3y"].notna()
        if m.sum() > min_obs:
            iso = IsotonicRegression(increasing=True, out_of_bounds="clip")
            iso.fit(g.loc[m, "pct_national"].values, g.loc[m, "excess_3y"].values)
            grid = np.linspace(1, 99, 9901)
            out[key] = grid[np.argmin(np.abs(iso.predict(grid)))]
    return out


def validate(df: pd.DataFrame, score_col: str) -> dict:
    out = {}
    for h in ["1y", "3y"]:
        col = f"excess_{h}"
        v = df.dropna(subset=[col, score_col])
        ic, _ = stats.spearmanr(v[score_col], v[col])
        hit = float(np.mean((v[score_col] > 50) == (v[col] > 0)))
        out[f"ic_{h}"] = ic
        out[f"hit_{h}"] = hit
    # decile monotonicity + spread on 3y
    v = df.dropna(subset=["excess_3y", score_col]).copy()
    v["dec"] = pd.cut(v[score_col], bins=range(0, 101, 10), labels=range(10, 101, 10),
                      include_lowest=True)
    dm = v.groupby("dec", observed=True)["excess_3y"].mean()
    out["monotonic_3y"] = bool(dm.is_monotonic_increasing)
    top = dm[[d for d in dm.index if int(d) >= 80]].mean()
    bot = dm[[d for d in dm.index if int(d) <= 20]].mean()
    out["spread_3y_pp"] = (top - bot) * 100
    return out


def main():
    engine = get_engine()
    df = load_and_score(engine)  # has: period_date, state_abbrev, signal, pct_rank(national), excess_*, score(national)

    div = pd.read_sql("SELECT state_code, division_name FROM census_division_mapping", engine)
    s2d = dict(zip(div["state_code"], div["division_name"]))
    df["division"] = df["state_abbrev"].map(s2d).fillna("UNKNOWN")

    # counties per (period, state) to drive the pooling threshold
    df["state_n"] = df.groupby(["period_date", "state_abbrev"])["signal"].transform("size")

    # --- variant 1: national (already computed as pct_rank/score) ---
    df["pct_national"] = df["pct_rank"]
    zc_nat, df["score_national"] = fit_recenter(df["pct_national"], df["excess_3y"])

    # --- variant 2: within-state ---
    df["pct_state"] = df.groupby(["period_date", "state_abbrev"])["signal"].rank(pct=True) * 100
    zc_st, df["score_state"] = fit_recenter(df["pct_state"], df["excess_3y"])

    # --- variant 2b: anchor-to-state (national rank, per-state zero-crossing) ---
    state_zc = fit_group_zc(df, "state_abbrev")
    div_zc = fit_group_zc(df, "division")
    zc_row = (
        df["state_abbrev"].map(state_zc)
        .fillna(df["division"].map(div_zc))
        .fillna(zc_nat)
    )
    df["score_anchor"] = apply_recenter(df["pct_national"], zc_row)

    # --- variant 3: pooled at thresholds ---
    results = {
        "national": validate(df, "score_national"),
        "anchor_to_state": validate(df, "score_anchor"),
        "within_state": validate(df, "score_state"),
    }
    zcs = {"national": zc_nat, "anchor_to_state": float(zc_row.mean()), "within_state": zc_st}
    shift = {}
    latest = df["period_date"].max()

    for N in [10, 15, 20]:
        peer = np.where(df["state_n"] >= N, "S:" + df["state_abbrev"], "D:" + df["division"])
        df[f"pct_pool{N}"] = (
            df.assign(_peer=peer).groupby(["period_date", "_peer"])["signal"].rank(pct=True) * 100
        )
        zc, df[f"score_pool{N}"] = fit_recenter(df[f"pct_pool{N}"], df["excess_3y"])
        results[f"pooled(N={N})"] = validate(df, f"score_pool{N}")
        zcs[f"pooled(N={N})"] = zc

    # score shift vs national on the latest period (snapshot AFTER all cols added)
    cur = df[df["period_date"] == latest]
    for col, label in [("score_anchor", "anchor_to_state"), ("score_state", "within_state"), ("score_pool15", "pooled(N=15)")]:
        d = (cur[col] - cur["score_national"]).abs()
        shift[label] = (d.mean(), (d > 5).mean() * 100, (d > 10).mean() * 100)

    # ---- report ----
    print("\n" + "=" * 78)
    print("PHASE B0 PROTOTYPE — COUNTY (read-only, nothing written)")
    print("=" * 78)
    print(f"\nObservations: {len(df):,}  | latest period: {latest.date()}  | counties(latest): {len(cur)}")

    print(f"\n{'variant':<16} {'zc':>6} {'IC_1y':>8} {'IC_3y':>8} {'hit_3y':>8} {'mono_3y':>8} {'spread_3y':>10}")
    print("-" * 70)
    for k, r in results.items():
        print(f"{k:<16} {zcs[k]:>6.1f} {r['ic_1y']:>+8.4f} {r['ic_3y']:>+8.4f} "
              f"{r['hit_3y']*100:>7.1f}% {str(r['monotonic_3y']):>8} {r['spread_3y_pp']:>+9.2f}pp")

    print("\nScore shift vs national (latest period):")
    for label, (mad, p5, p10) in shift.items():
        print(f"  {label:<16} mean_abs_delta={mad:5.2f}  moved>5:{p5:5.1f}%  moved>10:{p10:5.1f}%")

    print("\nSmall-state spotlight (latest period, score range within state):")
    small = cur.groupby("state_abbrev").filter(lambda g: g["state_abbrev"].size <= 6)
    for st in sorted(small["state_abbrev"].unique()):
        g = cur[cur["state_abbrev"] == st]
        print(f"  {st} (n={len(g)}): national=[{g['score_national'].min():.0f}-{g['score_national'].max():.0f}] "
              f"anchor=[{g['score_anchor'].min():.0f}-{g['score_anchor'].max():.0f}] "
              f"within_state=[{g['score_state'].min():.0f}-{g['score_state'].max():.0f}] "
              f"pooled15=[{g['score_pool15'].min():.0f}-{g['score_pool15'].max():.0f}]")

    engine.dispose()
    print("\nDONE (read-only).")


if __name__ == "__main__":
    main()
