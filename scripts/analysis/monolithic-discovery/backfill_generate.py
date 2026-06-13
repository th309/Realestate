"""Generate the full PIQ score backfill (2001 -> present) as CSVs for \\copy.

Replicates packages/backend/src/scoring/propertyiq-scoring-engine.ts exactly:
  - z-scores with POPULATION std (ddof=0), skipped when <2 valid or std=0
  - signal = +z(zhvi_yoy) +z(zhvi_mom_3m) -z(median_days_on_market)
             -z(price_reduced_share), requiring >=2 of 4 features
  - percentile rank: average-rank method (pandas rank(pct=True)*100)
  - recenter: piecewise [0,50]->[1,50], [50,100]->[50,99]; round; clamp 1..99
  - confidence = round(n_features/4*100) -> letter via 80/65/45 thresholds
  - grade from GRADE_THRESHOLDS (A+ 97+, A 93+, A- 90+, B+ 87+, B 83+, B- 80+,
    C+ 77+, C 73+, C- 70+, D+ 67+, D 63+, D- 60+, F below)

Output: data/backfill_{level}.csv with columns matching propertyiq_scores_v2
(id and created_at omitted - DB defaults).

Usage:
    python backfill_generate.py --level metro
    python backfill_generate.py --level all
"""

import argparse
import csv
import json
from pathlib import Path

import numpy as np
import pandas as pd

from db import get_engine

DATA_DIR = Path(__file__).parent / "data"
ZERO_CROSSING = 50.0
MIN_FEATURES = 2
MIN_CROSS_SECTION = 30
FEATURES = ["zhvi_yoy", "zhvi_mom_3m", "median_days_on_market", "price_reduced_share"]
SIGNS = np.array([1, 1, -1, -1])

GRADE_STEPS = [
    (97, "A+"), (93, "A"), (90, "A-"), (87, "B+"), (83, "B"), (80, "B-"),
    (77, "C+"), (73, "C"), (70, "C-"), (67, "D+"), (63, "D"), (60, "D-"),
]

LEVELS = {
    "metro": dict(ztab="zillow_metro", zid="cbsa_code",
                  rtab="realtor_metro", rid="cbsa_code", rname="cbsa_title"),
    "county": dict(ztab="zillow_county", zid="fips_code",
                   rtab="realtor_county", rid="county_fips", rname="county_name"),
    "zip": dict(ztab="zillow_zip", zid="lpad(region_name, 5, '0')",
                rtab="realtor_zip", rid="postal_code", rname="zip_name"),
}


def grade_for(score: int) -> str:
    for floor, grade in GRADE_STEPS:
        if score >= floor:
            return grade
    return "F"


def confidence_letter(conf: int) -> str:
    if conf >= 80:
        return "A"
    if conf >= 65:
        return "B"
    if conf >= 45:
        return "C"
    return "F"


def load_zillow(engine, level):
    cfg = LEVELS[level]
    name_cols = {
        "metro": ", region_name AS zname, state_code",
        "county": ", region_name AS zname, state_code",
        "zip": ", region_name AS zname, state_code",
    }[level]
    df = pd.read_sql(
        f"""SELECT {cfg['zid']} AS location_id, period_date, value{name_cols}
            FROM {cfg['ztab']}
            WHERE metric_name='zhvi' AND {cfg['zid']} IS NOT NULL""",
        engine,
    )
    df["month"] = pd.to_datetime(df["period_date"]).dt.to_period("M")
    mat = df.pivot_table(index="month", columns="location_id", values="value",
                         aggfunc="last").sort_index()
    feats = pd.concat(
        {
            "zhvi_yoy": mat.pct_change(12, fill_method=None).stack(),
            "zhvi_mom_3m": mat.pct_change(3, fill_method=None).stack(),
            "zhvi": mat.stack(),
        },
        axis=1,
    ).reset_index()
    feats.columns = ["month", "location_id", "zhvi_yoy", "zhvi_mom_3m", "zhvi"]

    # Display-name map per the production convention.
    names = df.sort_values("period_date").drop_duplicates("location_id", keep="last")
    if level == "metro":
        name_map = dict(zip(names["location_id"], names["zname"]))
    elif level == "county":
        name_map = {
            r.location_id: f"{r.zname}, {r.state_code}"
            for r in names.itertuples()
        }
    else:
        name_map = dict(zip(names["location_id"], names["location_id"]))
    return feats, name_map


def load_realtor(engine, level):
    cfg = LEVELS[level]
    df = pd.read_sql(
        f"""SELECT {cfg['rid']} AS location_id, period_date,
                   median_days_on_market, price_reduced_share,
                   {cfg['rname']} AS rname
            FROM {cfg['rtab']}""",
        engine,
    )
    df["month"] = pd.to_datetime(df["period_date"]).dt.to_period("M")
    df = df.drop_duplicates(subset=["location_id", "month"], keep="last")

    names = df.sort_values("month").drop_duplicates("location_id", keep="last")
    if level == "metro":
        name_map = dict(zip(names["location_id"], names["rname"]))
    elif level == "county":
        # realtor county_name is lowercase "autauga, al" -> "Autauga County, AL"
        def fmt(n):
            try:
                base, st = n.rsplit(",", 1)
                return f"{base.strip().title()} County, {st.strip().upper()}"
            except (ValueError, AttributeError):
                return n
        name_map = {r.location_id: fmt(r.rname) for r in names.itertuples()}
    else:
        name_map = dict(zip(names["location_id"], names["location_id"]))
    return df[["location_id", "month", "median_days_on_market",
               "price_reduced_share"]], name_map


def compute(level, engine):
    zfeats, znames = load_zillow(engine, level)
    rfeats, rnames = load_realtor(engine, level)
    panel = zfeats.merge(rfeats, on=["location_id", "month"], how="outer")
    panel = panel[panel["month"] >= pd.Period("2001-01")]

    # Cross-sectional z-scores, POPULATION std (ddof=0), matching the engine.
    grouped = panel.groupby("month")
    zcols = []
    for col in FEATURES:
        mean = grouped[col].transform("mean")
        std = grouped[col].transform(lambda s: s.std(ddof=0))
        n = grouped[col].transform("count")
        z = (panel[col] - mean) / std
        z[(n < MIN_CROSS_SECTION) | (std == 0)] = np.nan
        zcols.append(f"z_{col}")
        panel[f"z_{col}"] = z

    zmat = panel[zcols].to_numpy()
    panel["n_features"] = np.isfinite(zmat).sum(axis=1)
    panel["signal"] = np.nansum(zmat * SIGNS, axis=1)
    panel = panel[panel["n_features"] >= MIN_FEATURES].copy()

    panel["pct_rank"] = (
        panel.groupby("month")["signal"].rank(method="average", pct=True) * 100
    )
    pct = panel["pct_rank"].to_numpy()
    raw = np.where(
        pct <= ZERO_CROSSING,
        1 + (pct / ZERO_CROSSING) * 49,
        50 + (pct - ZERO_CROSSING) / (100 - ZERO_CROSSING) * 49,
    )
    # np.round uses banker's rounding; Math.round rounds half UP. Match TS:
    panel["score"] = np.clip(np.floor(raw + 0.5), 1, 99).astype(int)

    panel["confidence"] = (panel["n_features"] / len(FEATURES) * 100).round().astype(int)
    panel["confidence_level"] = panel["confidence"].map(confidence_letter)
    panel["grade"] = panel["score"].map(grade_for)
    panel["location_name"] = panel["location_id"].map(
        lambda i: znames.get(i) or rnames.get(i) or i
    )
    panel["median_price"] = panel["zhvi"].round(2)
    panel["score_date"] = panel["month"].dt.to_timestamp("M").dt.date  # month-end

    def zjson(row):
        def val(c, nd):
            v = row[c]
            return None if pd.isna(v) else round(float(v), nd)
        return json.dumps({
            "zhvi_yoy": val("zhvi_yoy", 6),
            "zhvi_mom_3m": val("zhvi_mom_3m", 6),
            "median_days_on_market": val("median_days_on_market", 1),
            "price_reduced_share": val("price_reduced_share", 6),
        })
    panel["z_scores"] = panel.apply(zjson, axis=1)
    panel["geography"] = level
    panel["score_type"] = "propertyiq"

    out_cols = ["geography", "location_id", "location_name", "score_type",
                "score", "grade", "confidence", "confidence_level",
                "median_price", "score_date", "z_scores"]
    out = DATA_DIR / f"backfill_{level}.csv"
    panel[out_cols].to_csv(out, index=False, quoting=csv.QUOTE_MINIMAL)
    print(f"[{level}] wrote {out}: rows={len(panel):,} "
          f"regions={panel['location_id'].nunique():,} "
          f"months={panel['month'].nunique()} "
          f"latest={panel['score_date'].max()} "
          f"score_mean={panel['score'].mean():.1f}")
    return len(panel)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=[*LEVELS, "all"], required=True)
    args = parser.parse_args()
    engine = get_engine()
    for lvl in (list(LEVELS) if args.level == "all" else [args.level]):
        compute(lvl, engine)
