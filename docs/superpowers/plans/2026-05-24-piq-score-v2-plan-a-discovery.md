# PropertyIQ Score V2 — Plan A: Discovery (P0–P4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empirically discover the minimum-feature predictive model for each geo level (metro/county/ZIP/state) using LightGBM+SHAP feature ranking plus forward-add ridge with bootstrap-95% CI stopping rule. Produce per-level reports documenting which features survive the strict bar.

**Architecture:** Five reusable Python modules in `scripts/analysis/v2/` — `peer_cascade.py` (peer-set cascade resolver), `target_builder.py` (forward-return target construction), `feature_loader.py` (load full candidate library from DB), `feature_ranker.py` (LightGBM+SHAP importance), `forward_add.py` (bootstrap-CI stopping). Driven by a top-level `discover.py` CLI that takes `--geo-level {metro,county,zip,state}`. Each geo level runs independently and writes a markdown report to `docs/superpowers/results/`.

**Tech Stack:** Python 3.11+, pandas, numpy, scipy, scikit-learn (Ridge + IsotonicRegression), LightGBM, SHAP, sqlalchemy + psycopg2 for Supabase Postgres. Tests via pytest.

**Spec:** `docs/superpowers/specs/2026-05-24-propertyiq-score-v2-empirical-design.md` (commits `f4f61abb`, `00f405ce`)

---

## File structure (what gets created)

| Path                                                        | Purpose                                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `scripts/analysis/v2/__init__.py`                           | Package marker                                                                          |
| `scripts/analysis/v2/db.py`                                 | Single SQLAlchemy engine factory (replaces duplicated `get_engine()` in legacy scripts) |
| `scripts/analysis/v2/peer_cascade.py`                       | Cascade resolver: state → division → region → national                                  |
| `scripts/analysis/v2/target_builder.py`                     | Compute `excess_3y` per (geo, period) using cascade                                     |
| `scripts/analysis/v2/feature_loader.py`                     | Load all candidate features per geo level                                               |
| `scripts/analysis/v2/feature_ranker.py`                     | LightGBM + SHAP global importance ranking                                               |
| `scripts/analysis/v2/forward_add.py`                        | Forward-add ridge with bootstrap-95% CI gate                                            |
| `scripts/analysis/v2/validation.py`                         | 9-test diagnostic battery + report-writing helpers                                      |
| `scripts/analysis/v2/discover.py`                           | CLI entrypoint: `python -m scripts.analysis.v2.discover --geo-level metro`              |
| `scripts/analysis/v2/tests/__init__.py`                     | Test package marker                                                                     |
| `scripts/analysis/v2/tests/test_peer_cascade.py`            | Unit tests for cascade logic                                                            |
| `scripts/analysis/v2/tests/test_forward_add.py`             | Unit tests for stopping rule (synthetic data)                                           |
| `scripts/analysis/v2/tests/test_target_builder.py`          | Unit tests for excess return math                                                       |
| `docs/superpowers/results/2026-05-24-metro-discovery.md`    | P1 output                                                                               |
| `docs/superpowers/results/2026-05-24-county-discovery.md`   | P2 output                                                                               |
| `docs/superpowers/results/2026-05-24-zip-discovery.md`      | P3 output                                                                               |
| `docs/superpowers/results/2026-05-24-state-discovery.md`    | P4 output                                                                               |
| `docs/superpowers/results/2026-05-24-cascade-thresholds.md` | P1 sub-output: chosen N_state/N_division/N_region                                       |

---

## P0 — Foundation

### Task 1: DB engine factory + package skeleton

**Files:**

- Create: `scripts/analysis/v2/__init__.py`
- Create: `scripts/analysis/v2/db.py`
- Create: `scripts/analysis/v2/tests/__init__.py`

- [ ] **Step 1: Create package markers**

```bash
mkdir -p scripts/analysis/v2/tests
```

```python
# scripts/analysis/v2/__init__.py
"""PropertyIQ Score V2 — empirical discovery pipeline."""
```

```python
# scripts/analysis/v2/tests/__init__.py
```

- [ ] **Step 2: Create the DB engine factory**

```python
# scripts/analysis/v2/db.py
"""Single source of truth for the analysis-time DB engine.

Reads SUPABASE_DB_PASSWORD from env. Statement timeout is 5 minutes —
discovery queries can pull large panels (ZIP level is ~1.2M rows).
"""

import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

REF = "pysflbhpnqwoczyuaaif"
HOST = "aws-1-us-east-1.pooler.supabase.com"
STATEMENT_TIMEOUT_MS = 300_000  # 5 minutes


def get_engine() -> Engine:
    pw = os.environ.get("SUPABASE_DB_PASSWORD")
    if not pw:
        raise RuntimeError(
            "SUPABASE_DB_PASSWORD env var is required. "
            "Get it from 1Password or `supabase status` locally."
        )
    url = (
        f"postgresql://postgres.{REF}:{quote_plus(pw)}"
        f"@{HOST}:6543/postgres?sslmode=require"
    )
    return create_engine(
        url,
        connect_args={"options": f"-c statement_timeout={STATEMENT_TIMEOUT_MS}"},
    )
```

- [ ] **Step 3: Smoke-test the connection**

Run: `SUPABASE_DB_PASSWORD=<pw> python -c "from scripts.analysis.v2.db import get_engine; e = get_engine(); print(e.execute('SELECT 1').scalar()); e.dispose()"`

Expected: prints `1`. (If the password env var isn't set, you should get the RuntimeError from Step 2.)

- [ ] **Step 4: Commit**

```bash
git add scripts/analysis/v2/__init__.py scripts/analysis/v2/db.py scripts/analysis/v2/tests/__init__.py
git commit -m "feat(piq-v2): db engine factory + package skeleton"
```

---

### Task 2: Peer-cascade resolver — failing tests first

**Files:**

- Create: `scripts/analysis/v2/tests/test_peer_cascade.py`

- [ ] **Step 1: Write failing tests for the cascade resolver**

```python
# scripts/analysis/v2/tests/test_peer_cascade.py
"""Tests for the peer-set cascade resolver.

The resolver answers: given a market (g, t, geo_level), what's the
peer set we should rank it within? The cascade is:
  tier 1: state          (if state has >= N_state markets that period)
  tier 2: census division (if division has >= N_division markets)
  tier 3: census region   (if region has >= N_region markets)
  tier 4: national        (always — final fallback)
"""

import pandas as pd
import pytest

from scripts.analysis.v2.peer_cascade import resolve_peer_tier, build_peer_index


def _df(rows):
    return pd.DataFrame(rows, columns=["region_id", "state_abbrev", "division", "region", "period_date"])


def test_returns_tier_1_when_state_has_enough_markets():
    # 15 California counties, N_state=10 → tier 1 (state)
    panel = _df([
        (f"CA-{i:03d}", "CA", "Pacific", "West", "2024-01-01") for i in range(15)
    ])
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=20, n_region=40)
    tier, peer_key = resolve_peer_tier("CA-000", pd.Timestamp("2024-01-01"), idx)
    assert tier == 1
    assert peer_key == ("state", "CA")


def test_falls_back_to_division_when_state_too_small():
    # Rhode Island has 5 counties; Pacific division gets 25 from other states
    panel = _df(
        [(f"RI-{i:03d}", "RI", "New England", "Northeast", "2024-01-01") for i in range(5)]
        + [(f"MA-{i:03d}", "MA", "New England", "Northeast", "2024-01-01") for i in range(20)]
    )
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=20, n_region=40)
    tier, peer_key = resolve_peer_tier("RI-000", pd.Timestamp("2024-01-01"), idx)
    assert tier == 2
    assert peer_key == ("division", "New England")


def test_falls_back_to_region_when_division_too_small():
    # Tiny division but enough markets in the region
    panel = _df(
        [(f"HI-{i:03d}", "HI", "Pacific", "West", "2024-01-01") for i in range(5)]
        + [(f"CA-{i:03d}", "CA", "Pacific", "West", "2024-01-01") for i in range(8)]
        + [(f"WA-{i:03d}", "WA", "Pacific", "West", "2024-01-01") for i in range(8)]
        + [(f"AZ-{i:03d}", "AZ", "Mountain", "West", "2024-01-01") for i in range(25)]
    )
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=30, n_region=40)
    tier, peer_key = resolve_peer_tier("HI-000", pd.Timestamp("2024-01-01"), idx)
    assert tier == 3
    assert peer_key == ("region", "West")


def test_falls_back_to_national_when_everything_too_small():
    panel = _df([("X-001", "XX", "FakeDiv", "FakeReg", "2024-01-01")])
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=20, n_region=40)
    tier, peer_key = resolve_peer_tier("X-001", pd.Timestamp("2024-01-01"), idx)
    assert tier == 4
    assert peer_key == ("national", "US")


def test_unknown_region_id_raises():
    panel = _df([("A-001", "CA", "Pacific", "West", "2024-01-01")])
    panel["period_date"] = pd.to_datetime(panel["period_date"])
    idx = build_peer_index(panel, n_state=10, n_division=20, n_region=40)
    with pytest.raises(KeyError):
        resolve_peer_tier("Z-999", pd.Timestamp("2024-01-01"), idx)
```

- [ ] **Step 2: Run the tests — they must fail (module doesn't exist yet)**

Run: `pytest scripts/analysis/v2/tests/test_peer_cascade.py -v`

Expected: ImportError on `from scripts.analysis.v2.peer_cascade import ...`

- [ ] **Step 3: Implement `peer_cascade.py` to make tests pass**

```python
# scripts/analysis/v2/peer_cascade.py
"""Peer-set cascade resolver for PropertyIQ Score V2.

Markets in small states (e.g. RI with 5 counties) can't be reliably scored
against just their state. The cascade evaluates: state → Census division →
Census region → national, picking the first tier with enough peers.

Thresholds N_state / N_division / N_region are calibrated empirically in P1.
"""

from dataclasses import dataclass

import pandas as pd

NATIONAL_KEY = ("national", "US")


@dataclass
class PeerIndex:
    """Resolved peer assignments + per-period counts for every market."""
    # row -> (state, division, region) labels and a period_date
    labels: pd.DataFrame
    # (period_date, level, group_key) -> count
    counts: pd.Series
    n_state: int
    n_division: int
    n_region: int


def build_peer_index(panel: pd.DataFrame, *, n_state: int, n_division: int, n_region: int) -> PeerIndex:
    """Pre-compute per-period peer counts at every cascade tier.

    `panel` must have columns: region_id, state_abbrev, division, region, period_date.
    Returns a PeerIndex you pass to resolve_peer_tier().
    """
    required = {"region_id", "state_abbrev", "division", "region", "period_date"}
    missing = required - set(panel.columns)
    if missing:
        raise ValueError(f"panel missing columns: {missing}")

    labels = panel.set_index("region_id")[["state_abbrev", "division", "region", "period_date"]]

    state_counts = (
        panel.groupby(["period_date", "state_abbrev"], observed=True).size().rename("n")
    )
    div_counts = (
        panel.groupby(["period_date", "division"], observed=True).size().rename("n")
    )
    reg_counts = (
        panel.groupby(["period_date", "region"], observed=True).size().rename("n")
    )

    # Combine into a single MultiIndex Series keyed by (period_date, level, group_key)
    state_counts = state_counts.reset_index().assign(level="state").rename(columns={"state_abbrev": "group_key"})
    div_counts = div_counts.reset_index().assign(level="division").rename(columns={"division": "group_key"})
    reg_counts = reg_counts.reset_index().assign(level="region").rename(columns={"region": "group_key"})
    combined = pd.concat([state_counts, div_counts, reg_counts], ignore_index=True)
    counts = combined.set_index(["period_date", "level", "group_key"])["n"]

    return PeerIndex(
        labels=labels, counts=counts,
        n_state=n_state, n_division=n_division, n_region=n_region,
    )


def resolve_peer_tier(region_id: str, period_date: pd.Timestamp, idx: PeerIndex) -> tuple[int, tuple[str, str]]:
    """Resolve which cascade tier and peer key applies to (region_id, period_date).

    Returns (tier, (level, group_key)) where tier in {1,2,3,4}.
    Tier 4 ('national', 'US') is the always-available fallback.

    Raises KeyError if region_id is not in the panel.
    """
    if region_id not in idx.labels.index:
        raise KeyError(f"region_id {region_id!r} not in peer index")

    row = idx.labels.loc[region_id]
    # If region_id is duplicated across periods we may get a frame; pick this period
    if isinstance(row, pd.DataFrame):
        row = row[row["period_date"] == period_date].iloc[0]

    state, division, region = row["state_abbrev"], row["division"], row["region"]

    def count_at(level: str, key: str) -> int:
        try:
            return int(idx.counts.loc[(period_date, level, key)])
        except KeyError:
            return 0

    if count_at("state", state) >= idx.n_state:
        return 1, ("state", state)
    if count_at("division", division) >= idx.n_division:
        return 2, ("division", division)
    if count_at("region", region) >= idx.n_region:
        return 3, ("region", region)
    return 4, NATIONAL_KEY
```

- [ ] **Step 4: Run the tests — they must pass**

Run: `pytest scripts/analysis/v2/tests/test_peer_cascade.py -v`

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/analysis/v2/peer_cascade.py scripts/analysis/v2/tests/test_peer_cascade.py
git commit -m "feat(piq-v2): peer-set cascade resolver

state -> Census division -> region -> national. Thresholds passed
in by caller (locked empirically in P1). All four tiers + KeyError
behavior unit-tested."
```

---

### Task 3: Target builder — `excess_3y` with cascade-based peer returns

**Files:**

- Create: `scripts/analysis/v2/target_builder.py`
- Create: `scripts/analysis/v2/tests/test_target_builder.py`

- [ ] **Step 1: Write failing tests for excess return math**

```python
# scripts/analysis/v2/tests/test_target_builder.py
"""Tests for excess-return target construction.

The target is excess_3y = own_return_3y - peer_return_3y, where peer_return_3y
is averaged over whatever cascade tier the market falls into.
"""

import numpy as np
import pandas as pd

from scripts.analysis.v2.peer_cascade import build_peer_index
from scripts.analysis.v2.target_builder import compute_forward_returns, compute_excess


def _zhvi_panel(values):
    """Build a long-format ZHVI panel: list of (region_id, period_date, zhvi) tuples."""
    df = pd.DataFrame(values, columns=["region_id", "period_date", "zhvi"])
    df["period_date"] = pd.to_datetime(df["period_date"])
    return df


def test_forward_return_is_simple_pct_change_over_36_months():
    # Two markets, 37 months. Return = (t+36) / (t0) - 1.
    rows = []
    for region in ["A", "B"]:
        for i in range(37):
            rows.append((region, f"2020-{(i % 12) + 1:02d}-01" if i < 12 else f"{2020 + i // 12}-{(i % 12) + 1:02d}-01", 100 + i))
    panel = _zhvi_panel(rows)
    fr = compute_forward_returns(panel, horizon_months=36)
    # At t0 = 2020-01-01, zhvi=100; at t+36 = 2023-01-01, zhvi=136; return = 0.36
    val = fr[(fr["region_id"] == "A") & (fr["period_date"] == pd.Timestamp("2020-01-01"))]["return_3y"].iloc[0]
    assert abs(val - 0.36) < 1e-9


def test_excess_is_own_return_minus_peer_mean():
    # 10 CA counties with known returns; peer mean is their average; excess is each minus the average.
    panel_rows = [(f"CA-{i:03d}", "2020-01-01", 100) for i in range(10)]
    panel_rows += [(f"CA-{i:03d}", "2023-01-01", 100 * (1 + (i + 1) / 10)) for i in range(10)]
    # returns: CA-000=0.10, CA-001=0.20, ..., CA-009=1.00 → mean = 0.55
    panel = _zhvi_panel(panel_rows)
    fr = compute_forward_returns(panel, horizon_months=36)

    geos = pd.DataFrame({
        "region_id": [f"CA-{i:03d}" for i in range(10)],
        "state_abbrev": ["CA"] * 10,
        "division": ["Pacific"] * 10,
        "region": ["West"] * 10,
        "period_date": pd.to_datetime(["2020-01-01"] * 10),
    })
    idx = build_peer_index(geos, n_state=5, n_division=20, n_region=40)
    ex = compute_excess(fr, idx, horizon_months=36)

    e_000 = ex[(ex["region_id"] == "CA-000") & (ex["period_date"] == pd.Timestamp("2020-01-01"))]["excess_3y"].iloc[0]
    assert abs(e_000 - (0.10 - 0.55)) < 1e-9
    # Every market's peer_tier should be 1 (state CA has 10 ≥ 5)
    assert (ex["peer_tier"] == 1).all()
```

- [ ] **Step 2: Run tests — must fail (module missing)**

Run: `pytest scripts/analysis/v2/tests/test_target_builder.py -v`

Expected: ImportError.

- [ ] **Step 3: Implement `target_builder.py`**

```python
# scripts/analysis/v2/target_builder.py
"""Forward-return + excess-return computation.

excess_<H>(g, t) = own_return - peer_return where peer_return is the mean
forward return over the cascade-resolved peer set for (g, t).
"""

import pandas as pd

from scripts.analysis.v2.peer_cascade import PeerIndex, resolve_peer_tier


def compute_forward_returns(zhvi_panel: pd.DataFrame, *, horizon_months: int) -> pd.DataFrame:
    """Take a long ZHVI panel and emit per (region_id, period_date) a forward return.

    Input: columns region_id, period_date, zhvi.
    Output: columns region_id, period_date, zhvi_t0, zhvi_t36, return_3y (or _1y).
    """
    if horizon_months not in (12, 36):
        raise ValueError("Use horizon_months=12 or 36")

    label = "1y" if horizon_months == 12 else "3y"
    piv = zhvi_panel.pivot_table(index="period_date", columns="region_id", values="zhvi")
    shifted = piv.shift(-horizon_months)
    ret = (shifted / piv) - 1.0
    out = ret.stack().rename(f"return_{label}").reset_index()
    out_t0 = piv.stack().rename("zhvi_t0").reset_index()
    out_tH = shifted.stack().rename(f"zhvi_t{horizon_months}").reset_index()
    merged = out_t0.merge(out_tH, on=["period_date", "region_id"]).merge(out, on=["period_date", "region_id"])
    return merged.dropna(subset=[f"return_{label}"])


def compute_excess(returns_df: pd.DataFrame, idx: PeerIndex, *, horizon_months: int) -> pd.DataFrame:
    """Attach peer_tier, peer_mean_return, and excess_<H> to each row."""
    label = "1y" if horizon_months == 12 else "3y"
    ret_col = f"return_{label}"

    # Resolve tier for every (region_id, period_date) row
    rows = returns_df[["region_id", "period_date"]].drop_duplicates()
    resolved = rows.apply(
        lambda r: resolve_peer_tier(r["region_id"], r["period_date"], idx),
        axis=1,
    )
    rows["peer_tier"] = resolved.map(lambda x: x[0])
    rows["peer_level"] = resolved.map(lambda x: x[1][0])
    rows["peer_key"] = resolved.map(lambda x: x[1][1])

    annotated = returns_df.merge(rows, on=["region_id", "period_date"])

    # Compute peer mean per (period_date, peer_level, peer_key)
    # Need to attach the same peer level/key to the panel used for the mean
    labels = idx.labels.reset_index()  # region_id, state, division, region, period_date

    # For each cascade level the "peer" panel is filtered by that level's grouping
    def peer_mean_for_level(level: str) -> pd.Series:
        # Map region -> group_key at this level for each period
        key_col = {"state": "state_abbrev", "division": "division", "region": "region"}[level]
        with_key = returns_df.merge(
            labels[["region_id", "period_date", key_col]],
            on=["region_id", "period_date"],
        )
        return with_key.groupby(["period_date", key_col])[ret_col].mean().rename("peer_mean")

    state_means = peer_mean_for_level("state").reset_index().rename(columns={"state_abbrev": "peer_key"}).assign(peer_level="state")
    div_means = peer_mean_for_level("division").reset_index().rename(columns={"division": "peer_key"}).assign(peer_level="division")
    reg_means = peer_mean_for_level("region").reset_index().rename(columns={"region": "peer_key"}).assign(peer_level="region")
    nat_means = returns_df.groupby("period_date")[ret_col].mean().rename("peer_mean").reset_index().assign(peer_level="national", peer_key="US")
    all_means = pd.concat([state_means, div_means, reg_means, nat_means], ignore_index=True)

    annotated = annotated.merge(
        all_means, on=["period_date", "peer_level", "peer_key"], how="left"
    )
    annotated[f"excess_{label}"] = annotated[ret_col] - annotated["peer_mean"]
    return annotated
```

- [ ] **Step 4: Run tests — must pass**

Run: `pytest scripts/analysis/v2/tests/test_target_builder.py -v`

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/analysis/v2/target_builder.py scripts/analysis/v2/tests/test_target_builder.py
git commit -m "feat(piq-v2): target builder with cascade-aware excess returns

excess_3y per (region, period) computed against the cascade-resolved
peer set, not a fixed state. Excess values for RI counties may be
measured vs Census division when state has too few markets."
```

---

### Task 4: P0 sanity check — reproduce existing county IC ≈ 0.10

**Files:**

- Modify: `scripts/analysis/v2/discover.py` (create stub for sanity check first)

- [ ] **Step 1: Create a P0-only sanity script**

```python
# scripts/analysis/v2/p0_sanity.py
"""P0 sanity check: load county ZHVI + the three legacy Redfin features,
build the existing 3-feature signal, score within state using cascade
(thresholds locked to N_state=10/20/40 — same as previous chat's working
point), measure IC vs excess_3y. We expect roughly the same county IC
(~0.10) the existing county_backtest.py produces — proves the new
pipeline doesn't break the old result before we touch features.
"""

import pandas as pd
import numpy as np
from scipy import stats

from scripts.analysis.v2.db import get_engine
from scripts.analysis.v2.peer_cascade import build_peer_index
from scripts.analysis.v2.target_builder import compute_forward_returns, compute_excess


def load_county_panel(engine):
    crosswalk = pd.read_sql("""
        SELECT DISTINCT county_fips, state_abbrev,
               zillow_county_region_id::text AS zc_id,
               zillow_state_region_id::text AS zs_id
        FROM geography_crosswalk
        WHERE county_fips IS NOT NULL
          AND zillow_county_region_id IS NOT NULL
    """, engine).drop_duplicates(subset="county_fips")

    div = pd.read_sql("SELECT state_code, division_name FROM census_division_mapping", engine)
    state_to_div = dict(zip(div["state_code"], div["division_name"]))
    # Hard-coded 4-region mapping (Census Bureau)
    DIV_TO_REGION = {
        "New England": "Northeast", "Middle Atlantic": "Northeast",
        "East North Central": "Midwest", "West North Central": "Midwest",
        "South Atlantic": "South", "East South Central": "South", "West South Central": "South",
        "Mountain": "West", "Pacific": "West",
    }

    zhvi = pd.read_sql("""
        SELECT region_id::text AS region_id, period_date, value AS zhvi
        FROM zillow_county
        WHERE metric_name = 'zhvi' AND value IS NOT NULL AND period_date >= '2012-01-01'
    """, engine)
    zhvi["period_date"] = pd.to_datetime(zhvi["period_date"])

    zhvi = zhvi.merge(crosswalk[["zc_id", "county_fips", "state_abbrev"]],
                      left_on="region_id", right_on="zc_id")
    zhvi["division"] = zhvi["state_abbrev"].map(state_to_div).fillna("UNKNOWN")
    zhvi["region"] = zhvi["division"].map(DIV_TO_REGION).fillna("UNKNOWN")
    return zhvi


def load_redfin_3_features(engine):
    return pd.read_sql("""
        SELECT fips_code AS county_fips, period_end AS period_date,
               sold_above_list, median_dom, months_of_supply
        FROM redfin_county
        WHERE property_type = 'All Residential'
          AND period_end >= '2012-01-01'
          AND sold_above_list IS NOT NULL
          AND median_dom IS NOT NULL
          AND months_of_supply IS NOT NULL
    """, engine).assign(period_date=lambda d: pd.to_datetime(d["period_date"]))


def main():
    engine = get_engine()
    print("Loading county ZHVI panel...")
    zhvi = load_county_panel(engine)

    print("Computing forward returns (36m)...")
    fr = compute_forward_returns(
        zhvi.rename(columns={"region_id": "_zillow_id"})  # avoid name collision
            .assign(region_id=zhvi["county_fips"])[["region_id", "period_date", "zhvi"]],
        horizon_months=36,
    )

    print("Building peer index (N_state=10, N_division=20, N_region=40)...")
    # Use the latest period for the peer index (cascade thresholds are static)
    geos = zhvi[["county_fips", "state_abbrev", "division", "region", "period_date"]].rename(columns={"county_fips": "region_id"}).drop_duplicates()
    idx = build_peer_index(geos, n_state=10, n_division=20, n_region=40)

    print("Computing excess_3y vs cascade peer means...")
    ex = compute_excess(fr, idx, horizon_months=36)

    print("Loading legacy 3-feature Redfin data...")
    rf = load_redfin_3_features(engine)
    rf["period_month"] = rf["period_date"].dt.to_period("M")
    ex["period_month"] = ex["period_date"].dt.to_period("M")
    df = ex.merge(rf[["county_fips", "period_month", "sold_above_list", "median_dom", "months_of_supply"]],
                  left_on=["region_id", "period_month"], right_on=["county_fips", "period_month"]).dropna(
        subset=["sold_above_list", "median_dom", "months_of_supply", "excess_3y"]
    )

    print(f"Joined panel: {len(df):,} rows")

    # Build legacy signal: z(SAL) - z(DOM) - z(MOS)
    for col, name in [("sold_above_list", "z_sal"), ("median_dom", "z_dom"), ("months_of_supply", "z_mos")]:
        df[name] = df.groupby("period_date")[col].transform(
            lambda x: (x - x.mean()) / max(x.std(), 1e-9)
        )
    df["signal"] = df["z_sal"] - df["z_dom"] - df["z_mos"]

    ic_pooled, _ = stats.spearmanr(df["signal"], df["excess_3y"])
    print(f"\nPooled IC (signal vs excess_3y, cascade peers): {ic_pooled:+.4f}")
    print("Existing county_backtest.py reports IC ~0.10 against state peers.")
    print("Within ±0.03 here is a pass for P0.")

    by_tier = df.groupby("peer_tier")["excess_3y"].agg(["count", "mean", "std"])
    print(f"\nPeer tier distribution:\n{by_tier}")

    engine.dispose()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run P0 sanity check**

Run: `SUPABASE_DB_PASSWORD=<pw> python -m scripts.analysis.v2.p0_sanity`

Expected: prints a pooled IC value. Pass condition: within ±0.03 of the existing `county_backtest.py` IC (~0.10 — verify by running the existing script for the comparison number). If wildly off, the cascade joins or excess computation is wrong — debug before P1.

- [ ] **Step 3: Save the P0 result to a markdown record**

Create `docs/superpowers/results/2026-05-24-p0-sanity.md` with the printed output as evidence:

```markdown
# P0 sanity — county pipeline reproduces existing IC

**Run date:** 2026-05-24
**Command:** `python -m scripts.analysis.v2.p0_sanity`

## Result

(paste the script output here — pooled IC + peer tier distribution)

## Comparison to existing county_backtest.py

| Source                                              | IC                   |
| --------------------------------------------------- | -------------------- |
| Existing `county_backtest.py` (state-only peer)     | (paste reference IC) |
| New v2 pipeline (cascade peer, thresholds 10/20/40) | (paste result)       |

Within ±0.03: PASS / FAIL

## P0 gate

- [x] Cascade resolver unit tests pass
- [x] Target builder unit tests pass
- [ ] County IC within ±0.03 of legacy
```

- [ ] **Step 4: Commit P0 foundation**

```bash
git add scripts/analysis/v2/p0_sanity.py docs/superpowers/results/2026-05-24-p0-sanity.md
git commit -m "feat(piq-v2): P0 sanity check reproduces county IC

New v2 pipeline (cascade peer + raw-ZHVI excess) produces county IC
within ±0.03 of the existing county_backtest.py result, with thresholds
10/20/40. Foundation verified before feature discovery starts in P1."
```

---

## P1 — Cascade thresholds + Metro discovery

### Task 5: Feature loader for new Redfin DC + non-Redfin sources

**Files:**

- Create: `scripts/analysis/v2/feature_loader.py`

- [ ] **Step 1: Implement the per-geo feature loader**

```python
# scripts/analysis/v2/feature_loader.py
"""Load the full candidate feature library per geo level.

Returns a single wide DataFrame keyed by (region_id, period_date).
Features that don't exist at a given geo level are simply absent
from the returned columns.

Spec §5 defines the universe. This module implements the joins.
"""

from dataclasses import dataclass
from typing import Literal

import pandas as pd

GeoLevel = Literal["metro", "county", "zip", "state"]


REDFIN_DC_DASHBOARDS_ALL_LEVELS = [
    "housing_market", "price_drops", "contract_cancellations", "delistings_relistings",
]
REDFIN_DC_DASHBOARDS_METRO_ONLY = [
    "investors", "cash_loan", "buyers_sellers", "rhpi",
]

HOUSING_MARKET_NUMERIC_COLS = [
    "homes_sold", "homes_sold_yoy", "median_sale_price", "median_sale_price_yoy",
    "median_days_on_market", "median_days_on_market_yoy",
    "average_sale_to_list_ratio", "average_sale_to_list_ratio_yoy",
    "share_sold_above_original_list", "share_sold_above_original_list_yoy",
    "new_listings", "new_listings_yoy", "active_listings", "active_listings_yoy",
    "pending_sales", "pending_sales_yoy",
]
# Similar lists for other Redfin DC dashboards — keep them here so the loader
# is the single source of "which columns become features"
PRICE_DROPS_COLS = [
    "price_drops", "price_drops_yoy",
    "average_size_of_price_drop", "average_size_of_price_drop_yoy",
    "percent_active_with_price_drops", "percent_active_with_price_drops_yoy",
]
CONTRACT_CANCEL_COLS = [
    "home_purchase_cancellations", "home_purchase_cancellations_yoy",
    "percent_of_pending_sales", "percent_of_pending_sales_yoy",
]
DELISTINGS_COLS = [
    "total_delistings", "total_delistings_yoy",
    "total_relistings", "total_relistings_yoy",
    "share_of_listings_delisted", "share_of_listings_delisted_yoy",
    "share_of_listings_relisted", "share_of_listings_relisted_yoy",
]
INVESTORS_COLS = ["investor_home_purchases_yoy", "investor_market_share", "share_of_investor_home_purchases"]
CASH_LOAN_COLS = [
    "percent_all_cash", "median_down_payment", "median_down_payment_pct",
    "percent_fha_loan", "percent_va_loan",
    "percent_conventional_loan", "percent_conventional_conforming_loan", "percent_conventional_jumbo_loan",
]
BUYERS_SELLERS_COLS = ["buyers", "sellers", "buyer_seller_ratio", "seller_buyer_difference"]
RHPI_COLS = ["redfin_home_price_index", "redfin_home_price_index_yoy"]


def load_redfin_dc(engine, geo_level: GeoLevel) -> pd.DataFrame:
    """Load Redfin DC dashboards for the requested geo level. Returns a wide
    DataFrame keyed by (region_id, period_date). Missing dashboards produce
    missing columns (no error)."""
    frames = []

    for dash, cols in [
        ("housing_market", HOUSING_MARKET_NUMERIC_COLS),
        ("price_drops", PRICE_DROPS_COLS),
        ("contract_cancellations", CONTRACT_CANCEL_COLS),
        ("delistings_relistings", DELISTINGS_COLS),
    ]:
        col_select = ", ".join(cols)
        df = pd.read_sql(
            f"SELECT region_id::text AS region_id, period_end AS period_date, {col_select} "
            f"FROM redfin_dc_{dash}_{geo_level}",
            engine,
        )
        df["period_date"] = pd.to_datetime(df["period_date"])
        df = df.rename(columns={c: f"rfdc_{dash}_{c}" for c in cols})
        frames.append(df)

    if geo_level == "metro":
        for dash, cols in [
            ("investors", INVESTORS_COLS),
            ("cash_loan", CASH_LOAN_COLS),
            ("buyers_sellers", BUYERS_SELLERS_COLS),
            ("rhpi", RHPI_COLS),
        ]:
            col_select = ", ".join(cols)
            # buyers_sellers carries property_type — filter to All Residential
            where = "WHERE property_type = 'All Residential'" if dash == "buyers_sellers" else ""
            df = pd.read_sql(
                f"SELECT region_id::text AS region_id, period_end AS period_date, {col_select} "
                f"FROM redfin_dc_{dash}_{geo_level} {where}",
                engine,
            )
            df["period_date"] = pd.to_datetime(df["period_date"])
            df = df.rename(columns={c: f"rfdc_{dash}_{c}" for c in cols})
            frames.append(df)

    if not frames:
        return pd.DataFrame(columns=["region_id", "period_date"])
    merged = frames[0]
    for f in frames[1:]:
        merged = merged.merge(f, on=["region_id", "period_date"], how="outer")
    return merged


def load_zillow(engine, geo_level: GeoLevel) -> pd.DataFrame:
    """Pivot the long-format zillow_<level> table to wide."""
    table = f"zillow_{geo_level}"
    metrics_to_keep = [
        "zhvi", "zori", "inventory", "dom", "sale_to_list", "price_cuts",
        "market_heat", "list_price", "sale_price", "new_listings", "pending_sales",
        "years_to_save", "homeowner_afford", "renter_afford",
    ]
    placeholders = ",".join([f"'{m}'" for m in metrics_to_keep])
    df = pd.read_sql(
        f"SELECT region_id::text AS region_id, period_date, metric_name, value "
        f"FROM {table} WHERE metric_name IN ({placeholders}) AND value IS NOT NULL",
        engine,
    )
    df["period_date"] = pd.to_datetime(df["period_date"])
    wide = df.pivot_table(index=["region_id", "period_date"], columns="metric_name", values="value").reset_index()
    wide.columns = ["region_id", "period_date"] + [f"zil_{c}" for c in wide.columns[2:]]
    return wide


# Placeholder loaders — fill in with the other Section 5 sources before merging.
# Each must return a DataFrame keyed by ('region_id', 'period_date') with
# feature columns prefixed by source (e.g. 'realtor_', 'census_', 'permits_', 'hud_', 'irs_').
def load_realtor(engine, geo_level: GeoLevel) -> pd.DataFrame:
    table = f"realtor_{geo_level}"
    # Realtor tables are wide already
    cols = [
        "hotness_score", "supply_score", "demand_score",
        "median_listing_price", "median_listing_price_yy",
        "active_listing_count", "active_listing_count_yy",
        "median_days_on_market", "median_days_on_market_yy",
        "price_reduced_share", "pending_listing_count_yy",
        "pending_ratio", "new_listing_count_yy",
    ]
    col_select = ", ".join(cols)
    # Realtor's region_id column varies by table — use cbsa_code for metro, county_fips for county, etc.
    id_col = {
        "metro": "cbsa_code", "county": "county_fips", "zip": "postal_code", "state": "state_id",
    }[geo_level]
    df = pd.read_sql(
        f"SELECT {id_col}::text AS region_id, period_date, {col_select} FROM {table}",
        engine,
    )
    df["period_date"] = pd.to_datetime(df["period_date"])
    df = df.rename(columns={c: f"realtor_{c}" for c in cols})
    return df


def load_economic(engine, geo_level: GeoLevel) -> pd.DataFrame:
    """unemployment, employment, GDP, RPP, QCEW/CES sectors. ZIP not available."""
    if geo_level == "zip":
        return pd.DataFrame(columns=["region_id", "period_date"])
    table = f"economic_{geo_level}"
    id_col = {"metro": "cbsa_code", "county": "fips_code", "state": "state_fips"}[geo_level]
    # Pull all numeric columns dynamically
    cols_df = pd.read_sql(
        f"SELECT column_name FROM information_schema.columns "
        f"WHERE table_name = '{table}' AND data_type IN ('numeric', 'double precision', 'integer', 'bigint')",
        engine,
    )
    feature_cols = [c for c in cols_df["column_name"] if c not in ("id",)]
    if not feature_cols:
        return pd.DataFrame(columns=["region_id", "period_date"])
    col_select = ", ".join(feature_cols)
    df = pd.read_sql(
        f"SELECT {id_col}::text AS region_id, period_date, {col_select} FROM {table}",
        engine,
    )
    df["period_date"] = pd.to_datetime(df["period_date"])
    df = df.rename(columns={c: f"econ_{c}" for c in feature_cols})
    return df


def load_permits(engine, geo_level: GeoLevel) -> pd.DataFrame:
    """Building permits — county + state only."""
    if geo_level not in ("county", "state"):
        return pd.DataFrame(columns=["region_id", "period_date"])
    table = f"permits_{geo_level}"
    id_col = "fips_code" if geo_level == "county" else "state_fips"
    cols = [
        "sf_units", "sf_value", "duplex_units", "small_multi_units",
        "large_multi_units", "total_units", "total_value", "sf_units_yoy", "total_units_yoy",
    ]
    df = pd.read_sql(
        f"SELECT {id_col}::text AS region_id, period_date, {', '.join(cols)} FROM {table}",
        engine,
    )
    df["period_date"] = pd.to_datetime(df["period_date"])
    df = df.rename(columns={c: f"permits_{c}" for c in cols})
    return df


def load_hud_fmr(engine, geo_level: GeoLevel) -> pd.DataFrame:
    """HUD FMR — county + metro only. Annual snapshots; we forward-fill to month."""
    if geo_level not in ("county", "metro"):
        return pd.DataFrame(columns=["region_id", "period_date"])
    id_col = "fips_code" if geo_level == "county" else "metro_code"
    df = pd.read_sql(
        f"SELECT {id_col}::text AS region_id, year, fmr_0br, fmr_1br, fmr_2br, fmr_3br, fmr_4br FROM hud_fmr",
        engine,
    )
    df["period_date"] = pd.to_datetime(df["year"].astype(str) + "-12-31")
    df = df.drop(columns=["year"]).rename(columns={
        f"fmr_{br}": f"hud_fmr_{br}" for br in ["0br", "1br", "2br", "3br", "4br"]
    })
    return df


def load_irs_migration(engine, geo_level: GeoLevel) -> pd.DataFrame:
    """IRS migration aggregates — county only, annual."""
    if geo_level != "county":
        return pd.DataFrame(columns=["region_id", "period_date"])
    df = pd.read_sql(
        "SELECT county_fips::text AS region_id, year, "
        "net_returns, net_exemptions, in_avg_agi, out_avg_agi "
        "FROM irs_migration_county_aggregates",
        engine,
    )
    df["period_date"] = pd.to_datetime(df["year"].astype(str) + "-12-31")
    df = df.drop(columns=["year"]).rename(columns={
        c: f"irs_{c}" for c in ["net_returns", "net_exemptions", "in_avg_agi", "out_avg_agi"]
    })
    return df


def load_census_acs(engine, geo_level: GeoLevel) -> pd.DataFrame:
    """Census ACS demographics + economics + housing — all levels. Annual; forward-filled."""
    geoid_table = f"census_{geo_level}"
    # The detailed tables (census_demographics/economics/housing) key by 'geoid' globally;
    # the per-level tables key by region. Use the per-level for parity with existing code.
    df = pd.read_sql(
        f"SELECT cbsa_code::text AS region_id, year, "
        f"total_population, population_yoy, median_age, median_household_income, "
        f"income_yoy, homeownership_rate, median_home_value, median_gross_rent, "
        f"rent_as_pct_of_income FROM {geoid_table}",
        engine,
    ) if geo_level == "metro" else pd.read_sql(
        f"SELECT * FROM {geoid_table} LIMIT 0",  # placeholder for county/zip/state — fill per actual schema
        engine,
    )
    df["period_date"] = pd.to_datetime(df["year"].astype(str) + "-12-31")
    feature_cols = [c for c in df.columns if c not in ("region_id", "period_date", "year")]
    df = df.drop(columns=["year"]).rename(columns={c: f"census_{c}" for c in feature_cols})
    return df


@dataclass
class FeaturePanel:
    df: pd.DataFrame  # wide: (region_id, period_date) + N feature columns
    feature_cols: list[str]


def load_feature_panel(engine, geo_level: GeoLevel) -> FeaturePanel:
    """Load every candidate feature for `geo_level`. Outer-join, monthly-snapped.
    Annual sources forward-fill to monthly within each region_id.
    """
    monthly = [load_redfin_dc(engine, geo_level), load_zillow(engine, geo_level), load_realtor(engine, geo_level)]
    if geo_level != "zip":
        monthly.append(load_economic(engine, geo_level))
        monthly.append(load_permits(engine, geo_level))

    merged = monthly[0]
    for f in monthly[1:]:
        if len(f.columns) > 2:  # has features beyond keys
            merged = merged.merge(f, on=["region_id", "period_date"], how="outer")

    # Annual sources — forward-fill per region
    annual = [load_hud_fmr(engine, geo_level), load_irs_migration(engine, geo_level), load_census_acs(engine, geo_level)]
    for a in annual:
        if len(a.columns) > 2:
            # Join then ffill by region
            merged = merged.merge(a, on=["region_id", "period_date"], how="outer")

    merged = merged.sort_values(["region_id", "period_date"])
    annual_cols = [c for c in merged.columns if c.startswith(("hud_", "irs_", "census_"))]
    if annual_cols:
        merged[annual_cols] = merged.groupby("region_id")[annual_cols].ffill(limit=13)  # max 13 months stale

    feature_cols = [c for c in merged.columns if c not in ("region_id", "period_date")]
    return FeaturePanel(df=merged, feature_cols=feature_cols)
```

- [ ] **Step 2: Smoke-test the loader on metro**

Run: `SUPABASE_DB_PASSWORD=<pw> python -c "from scripts.analysis.v2.db import get_engine; from scripts.analysis.v2.feature_loader import load_feature_panel; e = get_engine(); p = load_feature_panel(e, 'metro'); print(f'rows={len(p.df):,} cols={len(p.feature_cols)}'); print(p.feature_cols[:10]); e.dispose()"`

Expected: prints ≥ 50,000 rows and ≥ 60 feature columns. The first 10 column names should include `rfdc_housing_market_*`, `zil_*`, `realtor_*`.

If the count is below 30 columns the loader is dropping sources — fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add scripts/analysis/v2/feature_loader.py
git commit -m "feat(piq-v2): feature loader assembles full candidate library

Per geo level: Redfin DC (8 dashboards), Zillow (long), Realtor (wide),
economic (BLS+BEA), permits, HUD FMR, IRS migration, Census ACS. Annual
sources forward-fill 13 months max. Returns (region_id, period_date) +
N feature columns ready for LightGBM ingestion."
```

---

### Task 6: Cascade-threshold sweep — empirically lock N_state/N_division/N_region

**Files:**

- Create: `scripts/analysis/v2/p1_threshold_sweep.py`

- [ ] **Step 1: Implement the sweep**

```python
# scripts/analysis/v2/p1_threshold_sweep.py
"""Sweep N_state x N_division x N_region thresholds. Score the existing
3-feature signal under each combination; pick the combo that maximizes
OOS Spearman IC against excess_3y (cascade-resolved). Lock the winning
thresholds in docs/superpowers/results/2026-05-24-cascade-thresholds.md.

The 3-feature signal is just a probe — we re-run discovery in subsequent
tasks. This step is only about choosing thresholds.
"""

import pandas as pd
import numpy as np
from scipy import stats

from scripts.analysis.v2.db import get_engine
from scripts.analysis.v2.peer_cascade import build_peer_index
from scripts.analysis.v2.target_builder import compute_forward_returns, compute_excess
from scripts.analysis.v2.p0_sanity import load_county_panel, load_redfin_3_features

GRID = [
    {"n_state": ns, "n_division": nd, "n_region": nr}
    for ns in [5, 8, 10, 12, 15, 20]
    for nd in [15, 20, 25, 30]
    for nr in [30, 40, 50]
    if ns <= nd <= nr  # monotonic constraint: each tier needs more peers than the last
]


def evaluate(thresholds, fr, geos, redfin):
    idx = build_peer_index(geos, **thresholds)
    ex = compute_excess(fr, idx, horizon_months=36)
    ex["period_month"] = ex["period_date"].dt.to_period("M")
    redfin = redfin.copy()
    redfin["period_month"] = redfin["period_date"].dt.to_period("M")
    df = ex.merge(redfin[["county_fips", "period_month", "sold_above_list", "median_dom", "months_of_supply"]],
                  left_on=["region_id", "period_month"], right_on=["county_fips", "period_month"]).dropna(
        subset=["sold_above_list", "median_dom", "months_of_supply", "excess_3y"]
    )
    for col, name in [("sold_above_list", "z_sal"), ("median_dom", "z_dom"), ("months_of_supply", "z_mos")]:
        df[name] = df.groupby("period_date")[col].transform(lambda x: (x - x.mean()) / max(x.std(), 1e-9))
    df["signal"] = df["z_sal"] - df["z_dom"] - df["z_mos"]
    ic, _ = stats.spearmanr(df["signal"], df["excess_3y"])
    tier_dist = df["peer_tier"].value_counts(normalize=True).sort_index()
    return ic, dict(tier_dist), len(df)


def main():
    engine = get_engine()
    zhvi = load_county_panel(engine)
    fr = compute_forward_returns(
        zhvi.rename(columns={"region_id": "_zillow_id"}).assign(region_id=zhvi["county_fips"])[["region_id", "period_date", "zhvi"]],
        horizon_months=36,
    )
    geos = zhvi[["county_fips", "state_abbrev", "division", "region", "period_date"]].rename(columns={"county_fips": "region_id"}).drop_duplicates()
    redfin = load_redfin_3_features(engine)

    print(f"{'n_state':>7} {'n_div':>7} {'n_reg':>7} {'IC':>8} {'%T1':>6} {'%T2':>6} {'%T3':>6} {'%T4':>6} {'N':>8}")
    print("-" * 80)
    results = []
    for t in GRID:
        ic, dist, n = evaluate(t, fr, geos, redfin)
        results.append({**t, "ic": ic, "n": n, **{f"t{k}_pct": v for k, v in dist.items()}})
        print(f"{t['n_state']:>7} {t['n_division']:>7} {t['n_region']:>7} {ic:>+.4f} "
              f"{dist.get(1, 0)*100:>5.1f}% {dist.get(2, 0)*100:>5.1f}% "
              f"{dist.get(3, 0)*100:>5.1f}% {dist.get(4, 0)*100:>5.1f}% {n:>7,}")

    best = max(results, key=lambda r: r["ic"])
    print(f"\nBEST: n_state={best['n_state']} n_division={best['n_division']} n_region={best['n_region']} ic={best['ic']:+.4f}")
    engine.dispose()
    return best, results


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the sweep and capture output**

Run: `SUPABASE_DB_PASSWORD=<pw> python -m scripts.analysis.v2.p1_threshold_sweep | tee /tmp/cascade-sweep.log`

Expected: prints a table of ~72 (n_state, n_division, n_region) combinations with their IC and tier distribution. Best combo printed at the end.

- [ ] **Step 3: Lock the chosen thresholds in a result doc**

Create `docs/superpowers/results/2026-05-24-cascade-thresholds.md`:

```markdown
# Cascade thresholds — empirically locked

**Run date:** 2026-05-24
**Script:** `scripts/analysis/v2/p1_threshold_sweep.py`

## Chosen values

| Threshold    | Value                 |
| ------------ | --------------------- |
| N_state      | (paste winning value) |
| N_division   | (paste winning value) |
| N_region     | (paste winning value) |
| Pooled IC    | (paste IC)            |
| Tier 1 share | (paste %)             |
| Tier 2 share | (paste %)             |
| Tier 3 share | (paste %)             |
| Tier 4 share | (paste %)             |

## Full sweep results

(paste the full table from /tmp/cascade-sweep.log)

## Reasoning

The 3-feature legacy signal serves as a probe — these thresholds are NOT
calibrated to the V2 feature set, only to "where does the cascade work
best given the data shape." We use these locked values for all downstream
P1-P4 discovery.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/analysis/v2/p1_threshold_sweep.py docs/superpowers/results/2026-05-24-cascade-thresholds.md
git commit -m "feat(piq-v2): cascade thresholds locked from empirical sweep

N_state / N_division / N_region chosen by maximizing pooled IC of the
legacy 3-feature probe signal across ~72 grid points. Locked values
apply to all P1-P4 discovery runs."
```

---

### Task 7: LightGBM + SHAP feature ranker

**Files:**

- Create: `scripts/analysis/v2/feature_ranker.py`

- [ ] **Step 1: Implement the ranker**

```python
# scripts/analysis/v2/feature_ranker.py
"""LightGBM + SHAP feature importance ranker.

Inputs: a (region_id, period_date) feature panel and an excess_3y target.
Output: a ranked list of features by mean(|SHAP|) computed over 5 walk-
forward folds.

LightGBM with default monotonic constraints OFF — we let the tree discover
direction. Discovery is forgiving; the production model is ridge.
"""

import numpy as np
import pandas as pd
import lightgbm as lgb
import shap

LGB_PARAMS = {
    "objective": "regression",
    "learning_rate": 0.05,
    "n_estimators": 500,
    "max_depth": 6,
    "num_leaves": 31,
    "min_data_in_leaf": 50,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "verbose": -1,
}


def rank_features(panel: pd.DataFrame, target_col: str, feature_cols: list[str], year_col: str = "year") -> pd.DataFrame:
    """Walk-forward LightGBM, SHAP global importance, returned ranked.

    Returns columns: feature, mean_abs_shap, ranked_position.
    """
    years = sorted(panel[year_col].dropna().unique())
    if len(years) < 4:
        raise ValueError(f"Need at least 4 distinct years for walk-forward; got {len(years)}")

    shap_sums = pd.Series(0.0, index=feature_cols)
    n_obs_seen = 0

    for i in range(2, len(years)):
        train_years = years[: i]
        test_year = years[i]
        train = panel[panel[year_col].isin(train_years)].dropna(subset=[target_col])
        test = panel[panel[year_col] == test_year].dropna(subset=[target_col])
        if len(train) < 500 or len(test) < 100:
            continue
        X_tr = train[feature_cols].values
        y_tr = train[target_col].values
        X_te = test[feature_cols].values

        model = lgb.LGBMRegressor(**LGB_PARAMS)
        model.fit(X_tr, y_tr)

        explainer = shap.TreeExplainer(model)
        sv = explainer.shap_values(X_te)
        shap_sums = shap_sums.add(pd.Series(np.abs(sv).mean(axis=0), index=feature_cols), fill_value=0)
        n_obs_seen += 1

    if n_obs_seen == 0:
        raise RuntimeError("No usable walk-forward folds — check panel size and year coverage")

    mean_abs_shap = (shap_sums / n_obs_seen).sort_values(ascending=False)
    return pd.DataFrame({
        "feature": mean_abs_shap.index,
        "mean_abs_shap": mean_abs_shap.values,
        "ranked_position": range(1, len(mean_abs_shap) + 1),
    })
```

- [ ] **Step 2: Smoke-test on synthetic data**

```python
# scripts/analysis/v2/tests/test_feature_ranker.py
"""Smoke test: ranker correctly identifies a known strong feature."""

import numpy as np
import pandas as pd

from scripts.analysis.v2.feature_ranker import rank_features


def test_ranker_picks_known_strong_feature():
    rng = np.random.default_rng(42)
    n = 5000
    df = pd.DataFrame({
        "year": rng.integers(2018, 2024, size=n),
        "strong": rng.normal(0, 1, size=n),
        "weak": rng.normal(0, 1, size=n),
        "noise_1": rng.normal(0, 1, size=n),
        "noise_2": rng.normal(0, 1, size=n),
        "noise_3": rng.normal(0, 1, size=n),
    })
    df["target"] = 0.7 * df["strong"] + 0.1 * df["weak"] + rng.normal(0, 0.5, size=n)
    ranked = rank_features(df, "target", ["strong", "weak", "noise_1", "noise_2", "noise_3"])
    assert ranked.iloc[0]["feature"] == "strong"
    assert ranked[ranked["feature"] == "weak"]["ranked_position"].iloc[0] <= 3
```

- [ ] **Step 3: Run the smoke test**

Run: `pytest scripts/analysis/v2/tests/test_feature_ranker.py -v`

Expected: 1 passed. (If LightGBM or SHAP isn't installed: `pip install lightgbm shap`.)

- [ ] **Step 4: Commit**

```bash
git add scripts/analysis/v2/feature_ranker.py scripts/analysis/v2/tests/test_feature_ranker.py
git commit -m "feat(piq-v2): LightGBM + SHAP feature ranker

Walk-forward LightGBM over year cohorts; SHAP global importance summed
across folds. Returns ranked feature list with mean(|SHAP|). Synthetic-
data smoke test verifies strong features rank above noise."
```

---

### Task 8: Forward-add ridge with bootstrap-95% CI gate

**Files:**

- Create: `scripts/analysis/v2/forward_add.py`
- Create: `scripts/analysis/v2/tests/test_forward_add.py`

- [ ] **Step 1: Write failing test for the stopping rule**

```python
# scripts/analysis/v2/tests/test_forward_add.py
"""Stopping rule tests on synthetic data with known signal strength.

When we feed in a strong feature followed by pure noise, the forward-add
should stop at K=1. When we feed pure noise we should never clear the bar
and return K=0 (or hit K_max).
"""

import numpy as np
import pandas as pd

from scripts.analysis.v2.forward_add import forward_add_with_ci_gate, StrictBar


def _panel(features_dict, target):
    df = pd.DataFrame(features_dict)
    df["target"] = target
    df["year"] = np.tile(np.arange(2017, 2024), int(np.ceil(len(df) / 7)))[: len(df)]
    return df


def test_stops_at_k_1_when_one_feature_carries_signal():
    rng = np.random.default_rng(0)
    n = 8000
    strong = rng.normal(0, 1, n)
    target = 1.2 * strong + rng.normal(0, 0.4, n)
    df = _panel({
        "strong": strong,
        "noise_a": rng.normal(0, 1, n),
        "noise_b": rng.normal(0, 1, n),
    }, target)
    result = forward_add_with_ci_gate(
        df, target_col="target",
        ranked_features=["strong", "noise_a", "noise_b"],
        bar=StrictBar(ic_min=0.15, hit_min=0.60, spread_min=0.04, mono_freq_min=0.95, k_max=12),
        n_bootstrap=200,
    )
    assert result.k == 1
    assert result.selected == ["strong"]


def test_returns_k_zero_when_bar_unreachable_on_pure_noise():
    rng = np.random.default_rng(0)
    n = 8000
    target = rng.normal(0, 1, n)
    df = _panel({
        "noise_a": rng.normal(0, 1, n),
        "noise_b": rng.normal(0, 1, n),
        "noise_c": rng.normal(0, 1, n),
    }, target)
    result = forward_add_with_ci_gate(
        df, target_col="target",
        ranked_features=["noise_a", "noise_b", "noise_c"],
        bar=StrictBar(ic_min=0.15, hit_min=0.60, spread_min=0.04, mono_freq_min=0.95, k_max=12),
        n_bootstrap=200,
    )
    assert result.k == 0
    assert result.shipped is False
```

- [ ] **Step 2: Run tests — must fail (module missing)**

Run: `pytest scripts/analysis/v2/tests/test_forward_add.py -v`

Expected: ImportError.

- [ ] **Step 3: Implement forward-add**

```python
# scripts/analysis/v2/forward_add.py
"""Minimum-feature forward add with bootstrap-95% CI stopping rule.

Per spec §6.3. The K we ship is the smallest such that ALL four
metrics' bootstrap-95% lower CI bounds clear the strict bar.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler


@dataclass
class StrictBar:
    ic_min: float
    hit_min: float
    spread_min: float
    mono_freq_min: float
    k_max: int


@dataclass
class ForwardAddResult:
    selected: list[str]
    k: int
    shipped: bool
    last_bootstrap: dict  # {ic_5pct, hit_5pct, spread_5pct, mono_freq}
    ridge_alpha: float
    feature_means: dict
    feature_stdevs: dict
    ridge_weights: dict


def _bootstrap_metrics(df, feature_cols, target_col, year_col, n_bootstrap, rng):
    years = sorted(df[year_col].unique())
    metrics = {"ic": [], "hit": [], "spread": [], "mono": []}

    for _ in range(n_bootstrap):
        chosen_years = rng.choice(years, size=len(years), replace=True)
        sample = pd.concat([df[df[year_col] == y] for y in chosen_years])
        # Hold out latest year of the sample as OOS proxy
        holdout_year = sample[year_col].max()
        train = sample[sample[year_col] < holdout_year]
        test = sample[sample[year_col] == holdout_year]
        if len(train) < 200 or len(test) < 50:
            continue

        scaler = StandardScaler()
        X_tr = scaler.fit_transform(train[feature_cols].values)
        X_te = scaler.transform(test[feature_cols].values)

        model = Ridge(alpha=1.0)
        model.fit(X_tr, train[target_col].values)
        pred = model.predict(X_te)
        y = test[target_col].values

        ic, _ = stats.spearmanr(pred, y)
        if not np.isfinite(ic):
            continue
        hit = float(np.mean((pred > 0) == (y > 0)))
        # Decile spread
        try:
            t = test.copy()
            t["pred"] = pred
            t["dec"] = pd.qcut(t["pred"].rank(method="first"), 10, labels=range(1, 11))
            dm = t.groupby("dec", observed=True)[target_col].mean()
            spread = float(dm.iloc[-1] - dm.iloc[0])
            mono = bool(dm.is_monotonic_increasing)
        except Exception:
            spread, mono = 0.0, False

        metrics["ic"].append(ic)
        metrics["hit"].append(hit)
        metrics["spread"].append(spread)
        metrics["mono"].append(1.0 if mono else 0.0)

    if not metrics["ic"]:
        return None

    return {
        "ic_5pct": float(np.percentile(metrics["ic"], 5)),
        "hit_5pct": float(np.percentile(metrics["hit"], 5)),
        "spread_5pct": float(np.percentile(metrics["spread"], 5)),
        "mono_freq": float(np.mean(metrics["mono"])),
    }


def _clears_bar(b: dict, bar: StrictBar) -> bool:
    return (
        b["ic_5pct"] >= bar.ic_min
        and b["hit_5pct"] >= bar.hit_min
        and b["spread_5pct"] >= bar.spread_min
        and b["mono_freq"] >= bar.mono_freq_min
    )


def forward_add_with_ci_gate(
    panel: pd.DataFrame,
    *,
    target_col: str,
    ranked_features: list[str],
    bar: StrictBar,
    year_col: str = "year",
    n_bootstrap: int = 1000,
    seed: int = 42,
) -> ForwardAddResult:
    rng = np.random.default_rng(seed)
    selected: list[str] = []
    last_b = None

    for f in ranked_features:
        selected.append(f)
        df = panel.dropna(subset=selected + [target_col])
        if len(df) < 500:
            selected.pop()
            continue

        b = _bootstrap_metrics(df, selected, target_col, year_col, n_bootstrap, rng)
        if b is None:
            selected.pop()
            continue
        last_b = b

        if _clears_bar(b, bar):
            scaler = StandardScaler().fit(df[selected].values)
            model = Ridge(alpha=1.0).fit(scaler.transform(df[selected].values), df[target_col].values)
            return ForwardAddResult(
                selected=selected, k=len(selected), shipped=True,
                last_bootstrap=b, ridge_alpha=1.0,
                feature_means=dict(zip(selected, scaler.mean_)),
                feature_stdevs=dict(zip(selected, scaler.scale_)),
                ridge_weights=dict(zip(selected, model.coef_)),
            )

        if len(selected) >= bar.k_max:
            break

    return ForwardAddResult(
        selected=selected, k=0, shipped=False, last_bootstrap=last_b or {},
        ridge_alpha=1.0, feature_means={}, feature_stdevs={}, ridge_weights={},
    )
```

- [ ] **Step 4: Run tests — must pass**

Run: `pytest scripts/analysis/v2/tests/test_forward_add.py -v`

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/analysis/v2/forward_add.py scripts/analysis/v2/tests/test_forward_add.py
git commit -m "feat(piq-v2): forward-add ridge with bootstrap-95% CI gate

Implements spec §6.3 stopping rule. Smallest K such that bootstrap-95%
lower CIs on IC/hit/spread/monotonicity all clear the strict bar. K=0
returned (with shipped=False) when bar is unreachable. Unit-tested with
synthetic signal-vs-noise."
```

---

### Task 8b: Validation battery — year-by-year IC + permutation test

**Files:**

- Create: `scripts/analysis/v2/validation.py`
- Create: `scripts/analysis/v2/tests/test_validation.py`

These are spec §6.4 tests 2 and 4. Tests 1, 3, 5 are already covered by the bootstrap in `forward_add.py`; tests 6-9 are descriptive (Plan B).

- [ ] **Step 1: Write failing tests**

```python
# scripts/analysis/v2/tests/test_validation.py
"""Tests for the validation battery (year-by-year IC, permutation)."""

import numpy as np
import pandas as pd

from scripts.analysis.v2.validation import year_by_year_ic, permutation_significance


def test_year_by_year_ic_counts_positive_years():
    rng = np.random.default_rng(0)
    df = pd.DataFrame({
        "score": np.concatenate([rng.normal(0, 1, 100) for _ in range(5)]),
        "excess_3y": np.concatenate([rng.normal(0, 1, 100) for _ in range(5)]),
        "year": np.repeat([2018, 2019, 2020, 2021, 2022], 100),
    })
    # Force 4/5 years positive by aligning score and target
    df.loc[df["year"] != 2020, "excess_3y"] = df.loc[df["year"] != 2020, "score"] * 0.5 + rng.normal(0, 0.3, len(df[df["year"] != 2020]))
    result = year_by_year_ic(df, score_col="score", target_col="excess_3y", year_col="year")
    assert result["n_years"] == 5
    assert result["pct_positive_years"] >= 0.6


def test_permutation_significance_detects_real_signal():
    rng = np.random.default_rng(0)
    n = 2000
    score = rng.normal(0, 1, n)
    excess = 0.5 * score + rng.normal(0, 0.5, n)
    result = permutation_significance(score, excess, n_shuffles=500, rng=rng)
    assert result["sigma"] > 3
    assert result["p_value"] < 0.01
```

- [ ] **Step 2: Run tests — must fail (module missing)**

Run: `pytest scripts/analysis/v2/tests/test_validation.py -v`

Expected: ImportError.

- [ ] **Step 3: Implement validation.py**

```python
# scripts/analysis/v2/validation.py
"""Spec §6.4 validation battery — gate tests not already in forward_add.

Test 2: year-by-year IC (≥80% of years must show positive IC).
Test 4: 5000-shuffle permutation significance (model IC must be ≥3σ above
the null distribution of shuffled-target ICs).
"""

import numpy as np
import pandas as pd
from scipy import stats


def year_by_year_ic(df: pd.DataFrame, *, score_col: str, target_col: str, year_col: str) -> dict:
    """For each year, compute Spearman IC of score vs target. Report fraction
    of years with positive IC. Gate (spec §6.4 test 2): ≥80% positive."""
    by_year = []
    for yr, sub in df.dropna(subset=[score_col, target_col]).groupby(year_col):
        if len(sub) < 30:
            continue
        ic, _ = stats.spearmanr(sub[score_col], sub[target_col])
        if np.isfinite(ic):
            by_year.append({"year": yr, "ic": float(ic), "n": len(sub)})
    if not by_year:
        return {"n_years": 0, "pct_positive_years": 0.0, "years": []}
    pct_pos = sum(1 for y in by_year if y["ic"] > 0) / len(by_year)
    return {"n_years": len(by_year), "pct_positive_years": pct_pos, "years": by_year}


def permutation_significance(score: np.ndarray, target: np.ndarray, *, n_shuffles: int = 5000, rng=None) -> dict:
    """Shuffle the score vector n_shuffles times; compute Spearman IC each
    time to build a null distribution. Report how many sigma the actual IC
    is above the null. Gate (spec §6.4 test 4): ≥3σ."""
    rng = rng if rng is not None else np.random.default_rng(42)
    actual_ic, _ = stats.spearmanr(score, target)
    nulls = np.empty(n_shuffles)
    score = np.asarray(score)
    target = np.asarray(target)
    for i in range(n_shuffles):
        nulls[i], _ = stats.spearmanr(rng.permutation(score), target)
    nulls = nulls[np.isfinite(nulls)]
    null_std = float(np.std(nulls)) if len(nulls) > 1 else 1e-9
    sigma = float(actual_ic) / max(null_std, 1e-9)
    p = float(np.mean(np.abs(nulls) >= abs(actual_ic)))
    return {"actual_ic": float(actual_ic), "null_mean": float(np.mean(nulls)), "null_std": null_std, "sigma": sigma, "p_value": p, "n_shuffles": len(nulls)}


def passes_battery(yby: dict, perm: dict, *, year_pct_min: float = 0.80, sigma_min: float = 3.0) -> tuple[bool, str]:
    """Combined gate check. Returns (passes, reason_if_failed)."""
    if yby["n_years"] < 3:
        return False, f"too few years ({yby['n_years']}) — need ≥3"
    if yby["pct_positive_years"] < year_pct_min:
        return False, f"year-by-year positive share {yby['pct_positive_years']:.0%} < {year_pct_min:.0%}"
    if perm["sigma"] < sigma_min:
        return False, f"permutation sigma {perm['sigma']:.2f} < {sigma_min}"
    return True, "passes"
```

- [ ] **Step 4: Run tests — must pass**

Run: `pytest scripts/analysis/v2/tests/test_validation.py -v`

Expected: 2 passed.

- [ ] **Step 5: Wire battery into `discover.py`**

In `scripts/analysis/v2/discover.py`, after the forward-add result (Step 1's code, just after `result = forward_add_with_ci_gate(...)`), add:

```python
# Validation battery gates (spec §6.4 tests 2 and 4)
if result.shipped:
    from scripts.analysis.v2.validation import year_by_year_ic, permutation_significance, passes_battery

    # Build the production score on the joined panel using the persisted ridge weights
    scaler_means = np.array([result.feature_means[f] for f in result.selected])
    scaler_stds = np.array([result.feature_stdevs[f] for f in result.selected])
    weights = np.array([result.ridge_weights[f] for f in result.selected])
    Z = (joined[result.selected].values - scaler_means) / scaler_stds
    joined["v2_score_raw"] = Z @ weights

    yby = year_by_year_ic(joined, score_col="v2_score_raw", target_col="excess_3y", year_col="year")
    perm = permutation_significance(joined["v2_score_raw"].values, joined["excess_3y"].values, n_shuffles=5000)
    battery_pass, reason = passes_battery(yby, perm, year_pct_min=0.80, sigma_min=3.0)

    print("\n=== VALIDATION BATTERY ===")
    print(f"  Year-by-year: {yby['n_years']} years, {yby['pct_positive_years']:.0%} positive")
    print(f"  Permutation: actual IC {perm['actual_ic']:+.4f}, sigma {perm['sigma']:.2f}, p={perm['p_value']:.4f}")
    print(f"  Battery: {'PASS' if battery_pass else f'FAIL ({reason})'}")

    if not battery_pass:
        print(f"\nMODEL DOWNGRADED TO DOES-NOT-SHIP — bar cleared but battery failed: {reason}")
        result.shipped = False
```

Add the battery section to the report-writing block in the same file:

```python
# ... in the report-writing section, after bootstrap CIs
f.write(f"\n## Validation battery (spec §6.4)\n\n")
if result.shipped or 'yby' in dir():
    f.write(f"- Year-by-year IC: **{yby['n_years']} years, {yby['pct_positive_years']:.0%} positive** (gate: ≥80%)\n")
    f.write(f"- Permutation significance: **{perm['sigma']:.2f}σ** (gate: ≥3σ), p={perm['p_value']:.4f}\n")
    f.write(f"- Battery: **{'PASS' if battery_pass else 'FAIL — ' + reason}**\n")
else:
    f.write("(model did not ship — battery not run)\n")
```

- [ ] **Step 6: Commit**

```bash
git add scripts/analysis/v2/validation.py scripts/analysis/v2/tests/test_validation.py scripts/analysis/v2/discover.py
git commit -m "feat(piq-v2): validation battery (spec §6.4 tests 2 + 4)

Year-by-year IC ≥80% positive years AND 5000-shuffle permutation ≥3σ
gate model shipping. Models that pass the bootstrap-CI bar but fail
the battery get downgraded to DOES-NOT-SHIP."
```

---

### Task 9: Metro discovery — run the full pipeline

**Files:**

- Create: `scripts/analysis/v2/discover.py`

- [ ] **Step 1: Implement the discovery CLI**

```python
# scripts/analysis/v2/discover.py
"""End-to-end discovery: pick features, validate, write report.

CLI:
  python -m scripts.analysis.v2.discover --geo-level metro
  python -m scripts.analysis.v2.discover --geo-level county
  python -m scripts.analysis.v2.discover --geo-level zip
  python -m scripts.analysis.v2.discover --geo-level state
"""

import argparse
import json
from datetime import date

import pandas as pd

from scripts.analysis.v2.db import get_engine
from scripts.analysis.v2.peer_cascade import build_peer_index
from scripts.analysis.v2.target_builder import compute_forward_returns, compute_excess
from scripts.analysis.v2.feature_loader import load_feature_panel
from scripts.analysis.v2.feature_ranker import rank_features
from scripts.analysis.v2.forward_add import forward_add_with_ci_gate, StrictBar

# Locked by P1 cascade sweep (paste real numbers after Task 6 completes)
THRESHOLDS = {"n_state": 10, "n_division": 20, "n_region": 40}

STRICT = StrictBar(ic_min=0.15, hit_min=0.60, spread_min=0.04, mono_freq_min=0.95, k_max=12)
RELAXED = StrictBar(ic_min=0.10, hit_min=0.55, spread_min=0.02, mono_freq_min=0.0, k_max=6)


def load_geos_with_division(engine, geo_level):
    div = pd.read_sql("SELECT state_code, division_name FROM census_division_mapping", engine)
    state_to_div = dict(zip(div["state_code"], div["division_name"]))
    DIV_TO_REGION = {
        "New England": "Northeast", "Middle Atlantic": "Northeast",
        "East North Central": "Midwest", "West North Central": "Midwest",
        "South Atlantic": "South", "East South Central": "South", "West South Central": "South",
        "Mountain": "West", "Pacific": "West",
    }

    if geo_level == "metro":
        gx = pd.read_sql("""
            SELECT DISTINCT cbsa_code::text AS region_id, state_abbrev,
                   zillow_metro_region_id::text AS zillow_id
            FROM geography_crosswalk
            WHERE cbsa_code IS NOT NULL AND zillow_metro_region_id IS NOT NULL
        """, engine).drop_duplicates(subset="region_id")
    elif geo_level == "county":
        gx = pd.read_sql("""
            SELECT DISTINCT county_fips::text AS region_id, state_abbrev,
                   zillow_county_region_id::text AS zillow_id
            FROM geography_crosswalk
            WHERE county_fips IS NOT NULL AND zillow_county_region_id IS NOT NULL
        """, engine).drop_duplicates(subset="region_id")
    elif geo_level == "zip":
        gx = pd.read_sql("""
            SELECT DISTINCT zip_code::text AS region_id, state_abbrev,
                   zillow_zip_region_id::text AS zillow_id
            FROM geography_crosswalk
            WHERE zip_code IS NOT NULL AND zillow_zip_region_id IS NOT NULL
        """, engine).drop_duplicates(subset="region_id")
    else:  # state
        gx = pd.read_sql("""
            SELECT DISTINCT state_abbrev::text AS region_id, state_abbrev,
                   zillow_state_region_id::text AS zillow_id
            FROM geography_crosswalk
            WHERE state_abbrev IS NOT NULL AND zillow_state_region_id IS NOT NULL
        """, engine).drop_duplicates(subset="region_id")

    gx["division"] = gx["state_abbrev"].map(state_to_div).fillna("UNKNOWN")
    gx["region"] = gx["division"].map(DIV_TO_REGION).fillna("UNKNOWN")
    return gx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geo-level", required=True, choices=["metro", "county", "zip", "state"])
    args = ap.parse_args()
    level = args.geo_level

    bar = RELAXED if level == "state" else STRICT
    print(f"=== Discovery for {level} (bar: {'RELAXED' if level == 'state' else 'STRICT'}) ===")

    engine = get_engine()

    # 1. Load ZHVI panel + compute returns
    print("Loading ZHVI...")
    zhvi = pd.read_sql(
        f"SELECT region_id::text AS region_id, period_date, value AS zhvi "
        f"FROM zillow_{level} WHERE metric_name = 'zhvi' AND value IS NOT NULL "
        f"AND period_date >= '2010-01-01'",
        engine,
    )
    zhvi["period_date"] = pd.to_datetime(zhvi["period_date"])

    geos = load_geos_with_division(engine, level)
    # Attach geo metadata to ZHVI for excess computation
    zhvi = zhvi.merge(geos[["zillow_id", "region_id"]].rename(columns={"region_id": "geo_id"}),
                       left_on="region_id", right_on="zillow_id", how="inner")
    panel_for_excess = zhvi[["geo_id", "period_date", "zhvi"]].rename(columns={"geo_id": "region_id"})

    print("Computing forward returns (36mo)...")
    fr = compute_forward_returns(panel_for_excess, horizon_months=36)

    panel_geos = geos.assign(period_date=fr["period_date"].min())  # cascade only needs labels
    full_geos = pd.concat([
        geos[["region_id", "state_abbrev", "division", "region"]].assign(period_date=d)
        for d in fr["period_date"].unique()
    ], ignore_index=True)
    print(f"Building peer index with thresholds {THRESHOLDS}...")
    idx = build_peer_index(full_geos, **THRESHOLDS)

    print("Computing excess returns vs cascade peers...")
    ex = compute_excess(fr, idx, horizon_months=36)

    # 2. Load features
    print("Loading feature panel...")
    fp = load_feature_panel(engine, level)
    print(f"  {len(fp.df):,} rows × {len(fp.feature_cols)} feature columns")

    # 3. Join target to features
    ex["period_month"] = ex["period_date"].dt.to_period("M")
    fp.df["period_month"] = fp.df["period_date"].dt.to_period("M")
    joined = ex.merge(fp.df[["region_id", "period_month"] + fp.feature_cols],
                       on=["region_id", "period_month"], how="inner")
    joined["year"] = joined["period_date"].dt.year
    joined = joined.dropna(subset=["excess_3y"])
    print(f"  joined panel: {len(joined):,} rows")

    if len(joined) < 1000:
        print(f"ERROR: panel too small ({len(joined)}) — discovery aborted")
        engine.dispose()
        return

    # 4. Rank features via LightGBM+SHAP (drop columns that are >50% null)
    usable = [c for c in fp.feature_cols if joined[c].notna().mean() >= 0.5]
    print(f"  {len(usable)} features with >=50% non-null coverage")
    # Fill remaining nulls with column median for ranker
    for c in usable:
        joined[c] = joined[c].fillna(joined[c].median())

    print("Ranking features with LightGBM+SHAP (walk-forward)...")
    ranking = rank_features(joined, target_col="excess_3y", feature_cols=usable, year_col="year")
    print(f"  Top 15 features by mean(|SHAP|):")
    print(ranking.head(15).to_string(index=False))

    # 5. Forward-add with CI gate
    print(f"\nForward-add (bar: ic>={bar.ic_min}, hit>={bar.hit_min}, spread>={bar.spread_min}pp, mono>={bar.mono_freq_min}, K_max={bar.k_max})...")
    result = forward_add_with_ci_gate(
        joined, target_col="excess_3y",
        ranked_features=ranking["feature"].tolist(),
        bar=bar,
    )

    print(f"\n=== RESULT ===")
    print(f"K = {result.k} ({'SHIPS' if result.shipped else 'DOES NOT SHIP'})")
    print(f"Selected: {result.selected}")
    print(f"Bootstrap CIs (lower-5%):")
    for k, v in result.last_bootstrap.items():
        print(f"  {k}: {v:+.4f}")

    # 6. Write report
    out_path = f"docs/superpowers/results/{date.today().isoformat()}-{level}-discovery.md"
    with open(out_path, "w") as f:
        f.write(f"# {level.capitalize()} discovery results\n\n")
        f.write(f"**Run date:** {date.today().isoformat()}\n")
        f.write(f"**Bar:** {'RELAXED' if level == 'state' else 'STRICT'} ({json.dumps(bar.__dict__)})\n")
        f.write(f"**Cascade thresholds:** {THRESHOLDS}\n")
        f.write(f"**Panel size:** {len(joined):,} rows\n")
        f.write(f"**Usable features:** {len(usable)} / {len(fp.feature_cols)} (>=50% non-null)\n\n")
        f.write(f"## Outcome\n\n")
        f.write(f"- **K = {result.k}** ({'SHIPS' if result.shipped else 'DOES NOT SHIP'})\n")
        f.write(f"- Selected features: {result.selected}\n\n")
        f.write(f"## Bootstrap lower-5% CIs\n\n")
        for k, v in result.last_bootstrap.items():
            f.write(f"- {k}: **{v:+.4f}**\n")
        f.write(f"\n## Top 15 features by LightGBM+SHAP\n\n")
        f.write(ranking.head(15).to_markdown(index=False))
        f.write(f"\n\n## Ridge weights (production model)\n\n")
        if result.ridge_weights:
            wdf = pd.DataFrame({
                "feature": list(result.ridge_weights.keys()),
                "ridge_weight": list(result.ridge_weights.values()),
                "feature_mean": [result.feature_means[f] for f in result.ridge_weights],
                "feature_stdev": [result.feature_stdevs[f] for f in result.ridge_weights],
            })
            f.write(wdf.to_markdown(index=False))
        else:
            f.write("(model did not ship — no weights to record)\n")

    print(f"\nReport written to {out_path}")
    engine.dispose()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run metro discovery**

Run: `SUPABASE_DB_PASSWORD=<pw> python -m scripts.analysis.v2.discover --geo-level metro 2>&1 | tee /tmp/metro-discovery.log`

Expected: completes in 5–15 minutes. Produces `docs/superpowers/results/2026-05-24-metro-discovery.md` with K, selected features, bootstrap CIs, top-15 SHAP ranking.

- [ ] **Step 3: Inspect the metro report**

Open `docs/superpowers/results/2026-05-24-metro-discovery.md`. Verify:

- K is a small integer (typically 3–8 expected)
- Selected features have intuitive economic meaning (not e.g. random census categorical IDs)
- Bootstrap CIs all positive
- Either SHIPS (good) or clear documentation of why DOES NOT SHIP

- [ ] **Step 4: Commit metro results**

```bash
git add scripts/analysis/v2/discover.py docs/superpowers/results/2026-05-24-metro-discovery.md
git commit -m "feat(piq-v2): metro discovery complete

K=<N>. Selected features: <list>. Bootstrap CIs all clear strict bar:
IC=<X>, hit=<X>, spread=<X>pp, mono=<X>. (or DOES NOT SHIP with reasons)"
```

---

## P2 — County discovery

### Task 10: Run discovery on county

**Files:**

- Output: `docs/superpowers/results/2026-05-24-county-discovery.md`

- [ ] **Step 1: Run county discovery**

Run: `SUPABASE_DB_PASSWORD=<pw> python -m scripts.analysis.v2.discover --geo-level county 2>&1 | tee /tmp/county-discovery.log`

Expected: produces `docs/superpowers/results/2026-05-24-county-discovery.md`. County has ~3k geos vs metro's ~750 — discovery runs 3–5x longer (15–45 min).

- [ ] **Step 2: Inspect report and verify result is honest**

If county fails the bar, the report MUST explain why. Plausible reasons: (a) features available at county level are weaker than metro (no investor/cash/RHPI signals), (b) data sparsity in early years pre-2017, (c) wider variance across small counties.

If county ships, compare its selected feature set to metro's — significant overlap is expected (housing_market basics) but differences (e.g., metro picks investor_market_share, county can't) are informative.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/results/2026-05-24-county-discovery.md
git commit -m "feat(piq-v2): county discovery complete

K=<N>. (or DOES NOT SHIP — reasons documented in report.)"
```

---

## P3 — ZIP discovery

### Task 11: Run discovery on ZIP

- [ ] **Step 1: Pre-flight check — confirm ZIP panel size is tractable**

ZIP has ~1.2M observations. The LightGBM ranker has `n_estimators=500` and 5 walk-forward folds — at ZIP scale this could take 1–2 hours. Before running blind:

Run: `SUPABASE_DB_PASSWORD=<pw> python -c "from scripts.analysis.v2.db import get_engine; from scripts.analysis.v2.feature_loader import load_feature_panel; e = get_engine(); p = load_feature_panel(e, 'zip'); print(f'rows={len(p.df):,} cols={len(p.feature_cols)}'); e.dispose()"`

Expected: prints panel size. If > 1M rows, optionally sub-sample to 200k rows for the ranker (modify the script to add `--sample-frac 0.2` if needed).

- [ ] **Step 2: Run ZIP discovery**

Run: `SUPABASE_DB_PASSWORD=<pw> python -m scripts.analysis.v2.discover --geo-level zip 2>&1 | tee /tmp/zip-discovery.log`

- [ ] **Step 3: Inspect and commit**

```bash
git add docs/superpowers/results/2026-05-24-zip-discovery.md
git commit -m "feat(piq-v2): ZIP discovery complete

K=<N>. ZIP has the thinnest feature coverage (no economic, no investor,
no permits). (or DOES NOT SHIP — likely outcome given coverage.)"
```

---

## P4 — State discovery (relaxed bar)

### Task 12: Run discovery on state

- [ ] **Step 1: Run state discovery**

Run: `SUPABASE_DB_PASSWORD=<pw> python -m scripts.analysis.v2.discover --geo-level state 2>&1 | tee /tmp/state-discovery.log`

State runs the **relaxed bar** automatically (the CLI selects it based on `--geo-level state`). K_max = 6.

- [ ] **Step 2: Inspect — state is the most likely level to fail**

n=50 means the bootstrap CI is wide; even with relaxed thresholds the bar can be unreachable. If state DOES NOT SHIP, the report must clearly say so — we ship metro/county/ZIP without state and document the gap.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/results/2026-05-24-state-discovery.md
git commit -m "feat(piq-v2): state discovery complete

K=<N>. (or DOES NOT SHIP, gap documented; geo levels proceed without state.)"
```

---

## P4.5 — Discovery summary

### Task 13: Roll up the four discovery reports into a single summary

**Files:**

- Create: `docs/superpowers/results/2026-05-24-discovery-summary.md`

- [ ] **Step 1: Write the summary doc**

Write to `docs/superpowers/results/2026-05-24-discovery-summary.md` (no script needed — manual digest of the four per-level reports). Required content:

- Table: geo_level | K | shipped | top features | bootstrap IC lower-5%
- Cross-cutting observations: which features show up at multiple levels, which are level-specific
- Decisions for Plan B: which levels we productionize, where the gaps are
- Anything surprising or counterintuitive — call it out for stakeholder review

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/results/2026-05-24-discovery-summary.md
git commit -m "docs(piq-v2): discovery summary rolling up metro/county/ZIP/state"
```

---

## P5 handoff

### Task 14: Write Plan B for productionization

**Files:**

- Create: `docs/superpowers/plans/2026-XX-XX-piq-score-v2-plan-b-productionization.md`

- [ ] **Step 1: Invoke writing-plans skill**

After Plan A's discovery results are in hand, invoke the writing-plans skill with this prompt:

> Spec: `docs/superpowers/specs/2026-05-24-propertyiq-score-v2-empirical-design.md` (P5-P8). Plan A discovery results: `docs/superpowers/results/2026-05-24-discovery-summary.md`. Produce the implementation plan for P5 (persist artifacts + parallel-write scores) through P8 (vintaging cron). The set of geo levels that productionize is whatever Plan A showed shipped. Specific feature lists come from the per-level discovery reports.

- [ ] **Step 2: Update the project memory entry**

After Plan B is written, update `~/.claude/projects/D--projects-rei-platform/memory/project_piq-score-v2.md`:

- Mark Plan A complete
- Add the Plan B file path
- Update status section

- [ ] **Step 3: Commit Plan B + memory update**

```bash
git add docs/superpowers/plans/2026-XX-XX-piq-score-v2-plan-b-productionization.md
git commit -m "docs(piq-v2): Plan B for productionization (P5-P8)

Builds on Plan A's discovery results. Productionizes whichever geo
levels passed their bar; documents gaps for the rest."
```

---

## Notes for the executing engineer

- **DB password:** Set `SUPABASE_DB_PASSWORD` in your shell environment. Get it from 1Password or `supabase status` locally. **Never** hardcode in scripts.
- **Run time per discovery:** metro ~5–15 min, county ~15–45 min, ZIP 30 min – 2 hr, state ~5 min. Expect total Plan A execution to take a working day.
- **If bootstrap CI is unstable across re-runs:** the rng seed is fixed; if you see > ±0.02 variance on IC_5pct across re-runs, increase `n_bootstrap` from 1000 to 5000 in `discover.py`.
- **Discovery results that fail the bar are still valuable.** Document them in the report — Plan B then knows which levels to skip.
- **Don't rerun a discovery after seeing the result and tweaking thresholds to make it pass.** That's data-snooping. The thresholds in `THRESHOLDS` are locked by Task 6 before any discovery runs.

## Self-review checklist (run before declaring plan complete)

- [ ] Every task has explicit file paths
- [ ] Every code step has the actual code (no "implement X" placeholders)
- [ ] Every command has expected output
- [ ] Tests precede implementation where the work is code (TDD)
- [ ] Plan A's terminal task is "write Plan B" — explicit handoff
- [ ] Spec sections §2 (target), §5 (features), §6 (methodology), §7 (revisions) all mapped to tasks
- [ ] Cascade thresholds locked empirically (Task 6) BEFORE any discovery runs (Tasks 9–12)
