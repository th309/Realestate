"""Compute the 1Y + 3Y claim statistics that feed the frontend
`packages/frontend/lib/data/validation-claims.ts` refresh (production-wiring
plan Task 3 / Task 8).

For every geography level (metro / county / zip) it joins the backfilled score
history (the analysis `*_score_history.parquet` files: location_id + month +
score) to `zhvi_forward_returns` (excess vs state, computed identically to
`score_backtest.py.load_outcomes`, generalized to carry BOTH `return_1y` ->
`excess_1y` and `return_3y_ann` -> `excess_3y`), then emits
`data/claims_stats.json` with, per level:

  - median yearly Spearman IC at the 1-year AND 3-year horizons
  - decile spread (pp) at the 1-year AND 3-year horizons
  - quintile mean excess (3y) for the five score bands 1-20 .. 81-99
  - hit rate (% of years the score-excess relationship was positive)
  - region coverage counts (distinct regions, scored rows, months)
  - score-99-vs-1 dollar examples on the level's median ZHVI (cumulative 3y)
  - within-state top-band (95-99) vs bottom-band (1-5) dollar example

All numbers are restricted to the 2016+ full-formula era (the production claims
window: Realtor.com DOM + price-cut inputs join the formula in 2016).

The IC / quintile / decile math is REUSED from `score_backtest.py` (same
Spearman-per-month -> yearly-median grouping, same band cuts, same
MIN_CROSS_SECTION) — see `_reused_*` helpers below. Nothing is reinvented.

The emitted JSON is self-describing: every number carries an `_meta` note
saying annualized vs cumulative and the horizon, so Task 8 can map fields onto
the validation-claims constants without ambiguity.

Usage (run from inside scripts/analysis/monolithic-discovery/):
    set PYTHONIOENCODING=utf-8   (Windows console)
    python claims_stats.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from db import get_engine

# Reuse the level config + thresholds from the backtest script (single source
# of truth for join keys and the >=30 cross-section gate). No math duplicated.
from score_backtest import LEVELS, MIN_CROSS_SECTION

DATA_DIR = Path(__file__).parent / "data"

# Production claims window: the full 4-feature formula only exists from 2016
# (Realtor.com DOM + price-cut share begin then). This is the window the
# committed backtests label "2016-2023 full formula".
CLAIMS_START = pd.Period("2016-01")

# Five score bands used everywhere (matches score_backtest quintile cuts).
BAND_EDGES = [0, 20, 40, 60, 80, 99]
BAND_LABELS = ["1-20", "21-40", "41-60", "61-80", "81-99"]

# Median ZHVI per level (latest month) for the dollar examples — supplied by
# the earlier analysis / defense doc so the published numbers stay consistent.
MEDIAN_HOME = {"metro": 251_629, "county": 230_458, "zip": 284_081}

# State base appreciation assumed for the within-state dollar example, matching
# the defense doc (docs/.../2026-06-12-piq-score-defense-and-explainer.md §2).
STATE_BASE_ANNUAL = 0.04

# Extreme-score sample window for the score-99-vs-1 example: the defense doc
# uses the literal extremes 99 and 1. We mirror that exactly.
SCORE_HIGH = 99
SCORE_LOW = 1
TOP_BAND = (95, 99)  # within-state top band
BOTTOM_BAND = (1, 5)  # within-state bottom band


# ---------------------------------------------------------------------------
# Outcomes: excess vs state at BOTH horizons (generalized load_outcomes).
# ---------------------------------------------------------------------------
def load_outcomes(engine, level: str) -> pd.DataFrame:
    """Own region return minus its state's return, at 1y and 3y_ann horizons.

    Mirrors score_backtest.load_outcomes exactly but carries return_1y too.
    State link via score_geo_state_map; state row is the state-level entry of
    zhvi_forward_returns for the same month.
    """
    own = pd.read_sql(
        f"""
        SELECT location_id, period_date, return_1y, return_3y_ann
        FROM zhvi_forward_returns
        WHERE geography_level = '{level}'
          AND (return_1y IS NOT NULL OR return_3y_ann IS NOT NULL)
        """,
        engine,
    )
    state = pd.read_sql(
        """
        SELECT location_id AS state_code, period_date,
               return_1y AS state_return_1y,
               return_3y_ann AS state_return_3y
        FROM zhvi_forward_returns
        WHERE geography_level = 'state'
        """,
        engine,
    )
    geo_map = pd.read_sql(
        f"SELECT location_id, state_code FROM score_geo_state_map WHERE geography='{level}'",
        engine,
    )
    own["month"] = pd.to_datetime(own["period_date"]).dt.to_period("M")
    state["month"] = pd.to_datetime(state["period_date"]).dt.to_period("M")
    df = own.merge(geo_map, on="location_id").merge(
        state[["state_code", "month", "state_return_1y", "state_return_3y"]],
        on=["state_code", "month"],
    )
    df["excess_1y"] = df["return_1y"] - df["state_return_1y"]
    df["excess_3y"] = df["return_3y_ann"] - df["state_return_3y"]
    return df[
        [
            "location_id",
            "month",
            "return_1y",
            "return_3y_ann",
            "excess_1y",
            "excess_3y",
        ]
    ]


def load_scores(level: str) -> pd.DataFrame:
    """Score history from the analysis parquet (location_id + month + score),
    restricted to the 2016+ full-formula claims window."""
    df = pd.read_parquet(DATA_DIR / f"{level}_score_history.parquet")
    df["month"] = pd.to_datetime(df["month"]).dt.to_period("M")
    return df[df["month"] >= CLAIMS_START][
        ["location_id", "month", "score"]
    ].copy()


# ---------------------------------------------------------------------------
# Reused math: monthly Spearman IC -> yearly median; decile spread; quintile.
# These mirror score_backtest.evaluate() exactly, parameterized by the excess
# column so the same routine serves both horizons.
# ---------------------------------------------------------------------------
def _reused_yearly_ic(scored: pd.DataFrame, excess_col: str) -> pd.Series:
    """Per-month Spearman(score, excess) -> median within each calendar year.
    Same grouping/threshold as score_backtest.evaluate()."""
    sub = scored.dropna(subset=[excess_col])
    monthly = {}
    for month, grp in sub.groupby("month"):
        if len(grp) >= MIN_CROSS_SECTION:
            ic, _ = spearmanr(grp["score"], grp[excess_col])
            if np.isfinite(ic):
                monthly[month] = ic
    ics = pd.Series(monthly).sort_index()
    if ics.empty:
        return pd.Series(dtype=float)
    return ics.groupby(ics.index.year).median()


def _reused_decile_spread(scored: pd.DataFrame, excess_col: str) -> float:
    """Median across months of (top decile mean excess - bottom decile mean
    excess) in percentage points. Same as score_backtest.evaluate()."""
    sub = scored.dropna(subset=[excess_col])
    spreads = []
    for _, grp in sub.groupby("month"):
        if len(grp) < 100:
            continue
        bins = pd.qcut(grp["score"], 10, labels=False, duplicates="drop")
        means = grp.groupby(bins)[excess_col].mean()
        if len(means) >= 8:
            spreads.append(means.iloc[-1] - means.iloc[0])
    if not spreads:
        return None
    return round(100 * float(np.median(spreads)), 2)


def _reused_quintile(scored: pd.DataFrame, excess_col: str) -> dict:
    """Mean excess (pp) + n per score band. Same cuts as score_backtest."""
    sub = scored.dropna(subset=[excess_col])
    agg = sub.groupby(
        pd.cut(sub["score"], BAND_EDGES, labels=BAND_LABELS),
        observed=True,
    )[excess_col].agg(["mean", "count"])
    return {
        str(band): {
            "mean_excess_pp": round(100 * float(row["mean"]), 2),
            "n": int(row["count"]),
        }
        for band, row in agg.iterrows()
    }


# ---------------------------------------------------------------------------
# Dollar examples.
# ---------------------------------------------------------------------------
def cumulative_3y_appreciation(scored: pd.DataFrame, score_value: int):
    """Mean cumulative 3-year appreciation = mean((1+return_3y_ann)^3 - 1)
    over every vintage that held `score_value`. Returns (appreciation, n)."""
    sub = scored[(scored["score"] == score_value)].dropna(subset=["return_3y_ann"])
    if sub.empty:
        return None, 0
    cum = (1.0 + sub["return_3y_ann"]) ** 3 - 1.0
    return float(cum.mean()), int(len(sub))


def band_mean_excess_3y(scored: pd.DataFrame, lo: int, hi: int):
    """Mean ANNUALIZED excess_3y (vs state) for scores in [lo, hi]."""
    sub = scored[(scored["score"] >= lo) & (scored["score"] <= hi)].dropna(
        subset=["excess_3y"]
    )
    if sub.empty:
        return None, 0
    return float(sub["excess_3y"].mean()), int(len(sub))


def dollar_examples(scored: pd.DataFrame, median_home: float) -> dict:
    """Two flavors, matching the defense doc §2:

    1. Simple (all-years): score 99 vs score 1 cumulative 3y appreciation,
       dollars on the median home.
    2. Within-state: top band (95-99) vs bottom band (1-5) mean annualized
       excess_3y, compounded onto a STATE_BASE_ANNUAL state over 3 years.
    """
    app99, n99 = cumulative_3y_appreciation(scored, SCORE_HIGH)
    app1, n1 = cumulative_3y_appreciation(scored, SCORE_LOW)
    simple = None
    if app99 is not None and app1 is not None:
        simple = {
            "score_99_appreciation_3y_cumulative": round(app99, 4),
            "score_99_dollar_gain": round(app99 * median_home),
            "score_99_n": n99,
            "score_1_appreciation_3y_cumulative": round(app1, 4),
            "score_1_dollar_gain": round(app1 * median_home),
            "score_1_n": n1,
            "dollar_delta": round((app99 - app1) * median_home),
        }

    # Within-state: own appreciation = (state_base + annual_excess) compounded.
    top_excess, top_n = band_mean_excess_3y(scored, *TOP_BAND)
    bot_excess, bot_n = band_mean_excess_3y(scored, *BOTTOM_BAND)
    within_state = None
    if top_excess is not None and bot_excess is not None:
        top_cum = (1.0 + STATE_BASE_ANNUAL + top_excess) ** 3 - 1.0
        bot_cum = (1.0 + STATE_BASE_ANNUAL + bot_excess) ** 3 - 1.0
        within_state = {
            "state_base_annual": STATE_BASE_ANNUAL,
            "top_band": f"{TOP_BAND[0]}-{TOP_BAND[1]}",
            "bottom_band": f"{BOTTOM_BAND[0]}-{BOTTOM_BAND[1]}",
            "top_band_annual_excess": round(top_excess, 4),
            "bottom_band_annual_excess": round(bot_excess, 4),
            "top_band_dollar_gain": round(top_cum * median_home),
            "bottom_band_dollar_gain": round(bot_cum * median_home),
            "top_band_n": top_n,
            "bottom_band_n": bot_n,
            "dollar_delta": round((top_cum - bot_cum) * median_home),
        }

    return {"simple_all_years": simple, "within_state": within_state}


# ---------------------------------------------------------------------------
# Per-level driver.
# ---------------------------------------------------------------------------
def compute_level(engine, level: str) -> dict:
    scores = load_scores(level)
    outcomes = load_outcomes(engine, level)
    scored = scores.merge(outcomes, on=["location_id", "month"], how="inner")

    ic_1y = _reused_yearly_ic(scored, "excess_1y")
    ic_3y = _reused_yearly_ic(scored, "excess_3y")

    median = MEDIAN_HOME[level]

    return {
        "_window": {
            "claims_window_start": str(CLAIMS_START),
            "vintage_range": [str(scored["month"].min()), str(scored["month"].max())],
            "note": "Full-formula era only (2016+); matches the committed "
            "2016-2023 full-formula backtest era.",
        },
        "coverage": {
            "n_regions": int(scored["location_id"].nunique()),
            "n_scored_rows": int(len(scored)),
            "n_months": int(scored["month"].nunique()),
            "_note": "Distinct regions / region-month rows / months with a score"
            " joined to a forward outcome in the claims window.",
        },
        "ic_1y_median_yearly": round(float(ic_1y.median()), 4) if len(ic_1y) else None,
        "ic_3y_median_yearly": round(float(ic_3y.median()), 4) if len(ic_3y) else None,
        "ic_1y_pct_positive_years": round(100 * float((ic_1y > 0).mean()), 1)
        if len(ic_1y)
        else None,
        "ic_3y_pct_positive_years": round(100 * float((ic_3y > 0).mean()), 1)
        if len(ic_3y)
        else None,
        "_ic_meta": "Median across calendar years of the per-month Spearman rank"
        " correlation between score and forward EXCESS-vs-state return. Higher"
        " horizon = stronger. pct_positive_years = share of years with positive"
        " median IC (the hit rate).",
        "hit_rate_3y_pct_positive_years": round(100 * float((ic_3y > 0).mean()), 1)
        if len(ic_3y)
        else None,
        "spread_1y_decile_pp": _reused_decile_spread(scored, "excess_1y"),
        "spread_3y_decile_pp": _reused_decile_spread(scored, "excess_3y"),
        "_spread_meta": "Median monthly (top-decile minus bottom-decile) mean"
        " excess-vs-state return, in percentage points. 1y is a 1-year excess;"
        " 3y is ANNUALIZED 3-year excess.",
        "quintile_mean_excess_3y_pp": _reused_quintile(scored, "excess_3y"),
        "_quintile_meta": "Mean ANNUALIZED 3-year excess-vs-state return (pp) per"
        " score band. Bands are the five validation-claims bands 1-20 .. 81-99.",
        "median_home_value": median,
        "dollar_examples": dollar_examples(scored, median),
        "_dollar_meta": "simple_all_years: cumulative 3-year ZHVI appreciation"
        " (NOT annualized, NOT excess) for score 99 vs score 1, dollars on the"
        " level's median home. within_state: top band (95-99) vs bottom band"
        " (1-5) mean annualized excess vs state, compounded onto a "
        f"{STATE_BASE_ANNUAL:.0%}/yr state base over 3 years.",
    }


def print_summary(report: dict) -> None:
    print("\n" + "=" * 78)
    print("CLAIMS STATS SUMMARY (2016+ full-formula era)")
    print("=" * 78)
    levels = [k for k in report if k != "_meta"]

    def cell(level, path):
        node = report[level]
        for p in path:
            node = node.get(p) if isinstance(node, dict) else None
            if node is None:
                return "—"
        return node

    rows = [
        ("Regions (distinct)", lambda l: cell(l, ["coverage", "n_regions"])),
        ("Scored region-months", lambda l: f"{cell(l, ['coverage', 'n_scored_rows']):,}"),
        ("Months", lambda l: cell(l, ["coverage", "n_months"])),
        ("IC 1Y (median yearly)", lambda l: cell(l, ["ic_1y_median_yearly"])),
        ("IC 3Y (median yearly)", lambda l: cell(l, ["ic_3y_median_yearly"])),
        ("Hit rate 3Y (% +years)", lambda l: cell(l, ["hit_rate_3y_pct_positive_years"])),
        ("Hit rate 1Y (% +years)", lambda l: cell(l, ["ic_1y_pct_positive_years"])),
        ("Decile spread 1Y (pp)", lambda l: cell(l, ["spread_1y_decile_pp"])),
        ("Decile spread 3Y (pp)", lambda l: cell(l, ["spread_3y_decile_pp"])),
        ("Q band 1-20 excess3y (pp)", lambda l: cell(l, ["quintile_mean_excess_3y_pp", "1-20", "mean_excess_pp"])),
        ("Q band 21-40 excess3y (pp)", lambda l: cell(l, ["quintile_mean_excess_3y_pp", "21-40", "mean_excess_pp"])),
        ("Q band 41-60 excess3y (pp)", lambda l: cell(l, ["quintile_mean_excess_3y_pp", "41-60", "mean_excess_pp"])),
        ("Q band 61-80 excess3y (pp)", lambda l: cell(l, ["quintile_mean_excess_3y_pp", "61-80", "mean_excess_pp"])),
        ("Q band 81-99 excess3y (pp)", lambda l: cell(l, ["quintile_mean_excess_3y_pp", "81-99", "mean_excess_pp"])),
        ("Median home ($)", lambda l: f"{cell(l, ['median_home_value']):,}"),
        ("Score99 apprec 3y (cum)", lambda l: cell(l, ["dollar_examples", "simple_all_years", "score_99_appreciation_3y_cumulative"])),
        ("Score1 apprec 3y (cum)", lambda l: cell(l, ["dollar_examples", "simple_all_years", "score_1_appreciation_3y_cumulative"])),
        ("Score99 gain ($)", lambda l: f"{cell(l, ['dollar_examples', 'simple_all_years', 'score_99_dollar_gain']):,}"),
        ("Score1 gain ($)", lambda l: f"{cell(l, ['dollar_examples', 'simple_all_years', 'score_1_dollar_gain']):,}"),
        ("99-vs-1 delta ($)", lambda l: f"{cell(l, ['dollar_examples', 'simple_all_years', 'dollar_delta']):,}"),
        ("WinState top gain ($)", lambda l: f"{cell(l, ['dollar_examples', 'within_state', 'top_band_dollar_gain']):,}"),
        ("WinState bot gain ($)", lambda l: f"{cell(l, ['dollar_examples', 'within_state', 'bottom_band_dollar_gain']):,}"),
        ("WinState delta ($)", lambda l: f"{cell(l, ['dollar_examples', 'within_state', 'dollar_delta']):,}"),
    ]

    header = f"{'Metric':<28}" + "".join(f"{l:>14}" for l in levels)
    print(header)
    print("-" * len(header))
    for label, fn in rows:
        line = f"{label:<28}"
        for l in levels:
            try:
                val = fn(l)
            except (TypeError, KeyError):
                val = "—"
            line += f"{str(val):>14}"
        print(line)
    print("=" * 78)


def main() -> None:
    engine = get_engine()
    report = {}
    for level in LEVELS:
        print(f"[{level}] computing claim stats…")
        report[level] = compute_level(engine, level)

    report["_meta"] = {
        "generated_for": "packages/frontend/lib/data/validation-claims.ts (Task 8)",
        "source": "data/{level}_score_history.parquet joined to zhvi_forward_returns",
        "claims_window": "2016+ full-formula era",
        "ic_definition": "median over years of per-month Spearman(score, excess-vs-state)",
        "excess_definition": "own forward return minus its state's forward return",
        "annualization": {
            "ic": "horizon-specific (1y vs 3y_ann), unitless",
            "decile_spread_3y_pp": "annualized 3y excess, percentage points",
            "decile_spread_1y_pp": "1-year excess, percentage points",
            "quintile_mean_excess_3y_pp": "annualized 3y excess, percentage points",
            "dollar_examples.simple_all_years": "CUMULATIVE 3-year appreciation (not annualized, not excess)",
            "dollar_examples.within_state": "annualized excess compounded over 3y on a 4%/yr state base",
        },
    }

    out = DATA_DIR / "claims_stats.json"
    out.write_text(json.dumps(report, indent=2))
    print_summary(report)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
