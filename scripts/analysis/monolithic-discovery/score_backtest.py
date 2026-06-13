"""Monthly PIQ score backtest per geo level, 2001 → present.

Replicates the production engine's score construction with the discovered
Candidate B formula:

    signal = z(zhvi_yoy) + z(zhvi_mom_3m) - z(median_days_on_market)
             - z(price_reduced_share)

    signal -> percentile rank within month -> re-center at the zero-crossing
    percentile (where signal = 0, mapped to score 50) -> clamp 1-99

Like the current engine's 2-of-3 rule, a region is scored when >=2 of the 4
features are present. ZHVI momentum exists from 2001; Realtor DOM and
price-cut share join in 2016-07, so 2001-2016 scores are momentum-only
(would carry a C confidence in production).

Evaluation: monthly Spearman IC of score vs 3Y forward excess return vs
state, yearly tables, quintile/decile mean excess, calibration around score
50, and era splits (2001-07 boom-bust / 2008-15 recovery / 2016-23 full
formula).

Usage:
    python score_backtest.py --level metro
    python score_backtest.py --level county
    python score_backtest.py --level zip
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from db import get_engine

DATA_DIR = Path(__file__).parent / "data"
MIN_CROSS_SECTION = 30
MIN_FEATURES = 2

FEATURE_SIGNS = {
    "zhvi_yoy": 1,
    "zhvi_mom_3m": 1,
    "median_days_on_market": -1,
    "price_reduced_share": -1,
}

ERAS = {
    "2001-2007 boom": ("2001-01", "2007-12"),
    "2008-2015 bust+recovery": ("2008-01", "2015-12"),
    "2016-2023 full formula": ("2016-01", "2023-02"),
}

# Per-level source tables and join keys (see MEMORY.md: zillow_zip.region_id
# is Zillow-internal; the postal code lives in region_name).
LEVELS = {
    "metro": {
        "zillow_table": "zillow_metro",
        "zillow_id": "cbsa_code",
        "realtor_table": "realtor_metro",
        "realtor_id": "cbsa_code",
    },
    "county": {
        "zillow_table": "zillow_county",
        "zillow_id": "fips_code",
        "realtor_table": "realtor_county",
        "realtor_id": "county_fips",
    },
    "zip": {
        "zillow_table": "zillow_zip",
        "zillow_id": "lpad(region_name, 5, '0')",
        "realtor_table": "realtor_zip",
        "realtor_id": "postal_code",
    },
}


def load_features(engine, level: str) -> pd.DataFrame:
    cfg = LEVELS[level]
    zhvi = pd.read_sql(
        f"""
        SELECT {cfg['zillow_id']} AS location_id, period_date, value
        FROM {cfg['zillow_table']}
        WHERE metric_name = 'zhvi' AND {cfg['zillow_id']} IS NOT NULL
        """,
        engine,
    )
    zhvi["month"] = pd.to_datetime(zhvi["period_date"]).dt.to_period("M")
    mat = zhvi.pivot_table(
        index="month", columns="location_id", values="value", aggfunc="last"
    ).sort_index()
    feats = pd.concat(
        {
            "zhvi_yoy": mat.pct_change(12, fill_method=None).stack(),
            "zhvi_mom_3m": mat.pct_change(3, fill_method=None).stack(),
        },
        axis=1,
    ).reset_index()

    realtor = pd.read_sql(
        f"""
        SELECT {cfg['realtor_id']} AS location_id, period_date,
               median_days_on_market, price_reduced_share
        FROM {cfg['realtor_table']}
        """,
        engine,
    )
    realtor["month"] = pd.to_datetime(realtor["period_date"]).dt.to_period("M")
    realtor = realtor.drop(columns=["period_date"]).drop_duplicates(
        subset=["location_id", "month"], keep="last"
    )
    df = feats.merge(realtor, on=["location_id", "month"], how="left")
    return df[df["month"] >= pd.Period("2001-01")]


def compute_scores(df: pd.DataFrame) -> pd.DataFrame:
    cols = list(FEATURE_SIGNS)
    grouped = df.groupby("month")
    for col in cols:
        mean = grouped[col].transform("mean")
        std = grouped[col].transform("std")
        n = grouped[col].transform("count")
        z = (df[col] - mean) / std
        z[(n < MIN_CROSS_SECTION) | (std == 0)] = np.nan
        df[f"z_{col}"] = z

    z_cols = [f"z_{c}" for c in cols]
    signs = np.array([FEATURE_SIGNS[c] for c in cols])
    zmat = df[z_cols].to_numpy()
    n_present = np.isfinite(zmat).sum(axis=1)
    df["signal"] = np.nansum(zmat * signs, axis=1)
    df["n_features"] = n_present
    df = df[df["n_features"] >= MIN_FEATURES].copy()

    # Percentile rank within month (average-rank, matches the engine/pandas).
    df["pct_rank"] = (
        df.groupby("month")["signal"].rank(method="average", pct=True) * 100
    )

    # Zero-crossing percentile: where signal = 0 lands each month; the global
    # median becomes the fixed re-centering point (engine uses a constant).
    monthly_zc = df.groupby("month")["signal"].apply(
        lambda s: 100 * (s < 0).mean() + 50 * (s == 0).mean() / max(len(s), 1)
    )
    zc = float(monthly_zc.median())

    pct = df["pct_rank"].to_numpy()
    below = pct <= zc
    score = np.where(below, 1 + (pct / zc) * 49, 50 + (pct - zc) / (100 - zc) * 49)
    df["score"] = np.clip(np.round(score), 1, 99).astype(int)
    df.attrs["zero_crossing"] = zc
    return df


def load_outcomes(engine, level: str) -> pd.DataFrame:
    own = pd.read_sql(
        f"""
        SELECT location_id, period_date, return_3y_ann
        FROM zhvi_forward_returns
        WHERE geography_level = '{level}' AND return_3y_ann IS NOT NULL
        """,
        engine,
    )
    state = pd.read_sql(
        """
        SELECT location_id AS state_code, period_date, return_3y_ann AS state_return
        FROM zhvi_forward_returns
        WHERE geography_level = 'state' AND return_3y_ann IS NOT NULL
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
        state[["state_code", "month", "state_return"]], on=["state_code", "month"]
    )
    df["excess_3y"] = df["return_3y_ann"] - df["state_return"]
    return df[["location_id", "month", "excess_3y"]]


def evaluate(scored: pd.DataFrame) -> dict:
    monthly_ic = {}
    for month, grp in scored.groupby("month"):
        if len(grp) >= MIN_CROSS_SECTION:
            monthly_ic[month], _ = spearmanr(grp["score"], grp["excess_3y"])
    ics = pd.Series(monthly_ic).sort_index()
    yearly = ics.groupby(ics.index.year).median()

    quintile = scored.groupby(pd.cut(
        scored["score"], [0, 20, 40, 60, 80, 99],
        labels=["1-20", "21-40", "41-60", "61-80", "81-99"],
    ), observed=True)["excess_3y"].agg(["mean", "count"])

    decile_spreads = []
    for _, grp in scored.groupby("month"):
        if len(grp) < 100:
            continue
        bins = pd.qcut(grp["score"], 10, labels=False, duplicates="drop")
        means = grp.groupby(bins)["excess_3y"].mean()
        if len(means) >= 8:
            decile_spreads.append(means.iloc[-1] - means.iloc[0])

    near_50 = scored[scored["score"].between(45, 55)]["excess_3y"]

    eras = {}
    for name, (start, end) in ERAS.items():
        window = ics[(ics.index >= pd.Period(start)) & (ics.index <= pd.Period(end))]
        sub = scored[
            (scored["month"] >= pd.Period(start)) & (scored["month"] <= pd.Period(end))
        ]
        q = sub.groupby(pd.cut(
            sub["score"], [0, 20, 40, 60, 80, 99],
            labels=["1-20", "21-40", "41-60", "61-80", "81-99"],
        ), observed=True)["excess_3y"].mean()
        eras[name] = {
            "median_ic": round(float(window.median()), 4) if len(window) else None,
            "pct_positive_months": round(100 * (window > 0).mean(), 1) if len(window) else None,
            "n_months": int(len(window)),
            "quintile_mean_excess_pp": {k: round(100 * v, 2) for k, v in q.items()},
        }

    return {
        "n_scored_rows": int(len(scored)),
        "n_regions": int(scored["location_id"].nunique()),
        "vintage_range": [str(scored["month"].min()), str(scored["month"].max())],
        "median_yearly_ic": round(float(yearly.median()), 4),
        "pct_positive_years": round(100 * (yearly > 0).mean(), 1),
        "yearly_ic": {int(y): round(float(v), 4) for y, v in yearly.items()},
        "quintile_mean_excess_pp": {
            str(k): {"mean_pp": round(100 * v["mean"], 2), "n": int(v["count"])}
            for k, v in quintile.iterrows()
        },
        "median_decile_spread_pp": round(100 * float(np.median(decile_spreads)), 2),
        "calibration_score_45_55_mean_excess_pp": round(100 * float(near_50.mean()), 3),
        "eras": eras,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=list(LEVELS), required=True)
    args = parser.parse_args()
    level = args.level

    engine = get_engine()
    print(f"[{level}] loading features…")
    features = load_features(engine, level)
    print(f"  rows={len(features):,} regions={features['location_id'].nunique():,} "
          f"months={features['month'].nunique()}")

    print(f"[{level}] computing scores…")
    scores = compute_scores(features)
    zc = scores.attrs["zero_crossing"]
    print(f"  scored rows={len(scores):,} zero-crossing percentile={zc:.1f}")
    dist = scores["score"].describe()
    print(f"  score distribution: mean={dist['mean']:.1f} p25={dist['25%']:.0f} "
          f"p50={dist['50%']:.0f} p75={dist['75%']:.0f}")

    out_scores = DATA_DIR / f"{level}_score_history.parquet"
    save = scores[["location_id", "month", "n_features", "signal", "score"]].copy()
    save["month"] = save["month"].dt.to_timestamp()
    save.to_parquet(out_scores, index=False)
    print(f"wrote {out_scores}")

    print(f"[{level}] evaluating vs excess_3y…")
    outcomes = load_outcomes(engine, level)
    scored = scores.merge(outcomes, on=["location_id", "month"], how="inner")
    report = evaluate(scored)
    report["zero_crossing_percentile"] = round(zc, 1)

    out = DATA_DIR / f"{level}_score_backtest.json"
    out.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
