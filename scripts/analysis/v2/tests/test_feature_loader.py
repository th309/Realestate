"""Tests for the Parquet feature loader.

We write tiny synthetic Parquet files into a tmp_path and verify the loader
correctly outer-joins them by (region_id, period_date), forward-fills annual
sources, and gracefully handles missing source files.
"""

from pathlib import Path

import pandas as pd
import pytest

from scripts.analysis.v2.feature_loader import load_feature_panel


def _write_parquet(data_dir: Path, filename: str, rows: list[dict]):
    df = pd.DataFrame(rows)
    if "period_date" in df.columns:
        df["period_date"] = pd.to_datetime(df["period_date"])
    df.to_parquet(data_dir / filename, index=False)


def test_raises_when_no_files_exist(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_feature_panel("metro", data_dir=tmp_path)


def test_loads_single_monthly_source(tmp_path):
    _write_parquet(tmp_path, "zillow_metro.parquet", [
        {"region_id": "35620", "period_date": "2024-01-01", "zil_zhvi": 600_000.0},
        {"region_id": "35620", "period_date": "2024-02-01", "zil_zhvi": 605_000.0},
        {"region_id": "31080", "period_date": "2024-01-01", "zil_zhvi": 800_000.0},
    ])
    fp = load_feature_panel("metro", data_dir=tmp_path)
    assert "zil_zhvi" in fp.feature_cols
    assert fp.df["zil_zhvi"].notna().sum() == 3
    assert sorted(fp.df.columns) == sorted(["region_id", "period_date", "zil_zhvi"])


def test_outer_joins_multiple_monthly_sources(tmp_path):
    _write_parquet(tmp_path, "zillow_metro.parquet", [
        {"region_id": "35620", "period_date": "2024-01-01", "zil_zhvi": 600_000.0},
        {"region_id": "35620", "period_date": "2024-02-01", "zil_zhvi": 605_000.0},
    ])
    _write_parquet(tmp_path, "realtor_metro.parquet", [
        {"region_id": "35620", "period_date": "2024-01-01", "realtor_hotness_score": 72.0},
        # Note: 2024-02-01 has no realtor row -- outer join must still keep zillow row
    ])
    fp = load_feature_panel("metro", data_dir=tmp_path)
    assert set(fp.feature_cols) == {"zil_zhvi", "realtor_hotness_score"}
    assert len(fp.df) == 2  # two rows for region 35620
    feb_row = fp.df[fp.df["period_date"] == pd.Timestamp("2024-02-01")].iloc[0]
    assert feb_row["zil_zhvi"] == 605_000.0
    assert pd.isna(feb_row["realtor_hotness_score"])


def test_forward_fills_annual_source_within_13_month_cap(tmp_path):
    # Monthly source: 14 months of zillow
    monthly = [
        {"region_id": "35620", "period_date": f"2024-{m:02d}-01", "zil_zhvi": 600_000.0 + m}
        for m in range(1, 13)
    ] + [
        {"region_id": "35620", "period_date": "2025-01-01", "zil_zhvi": 612_000.0},
        {"region_id": "35620", "period_date": "2025-02-01", "zil_zhvi": 613_000.0},
    ]
    _write_parquet(tmp_path, "zillow_metro.parquet", monthly)
    # Annual census: one row at 2023-12-31 — should forward-fill 13 months max
    _write_parquet(tmp_path, "census_metro.parquet", [
        {"region_id": "35620", "period_date": "2023-12-31", "census_total_population": 19_000_000},
    ])

    fp = load_feature_panel("metro", data_dir=tmp_path)
    # Census value should appear filled at 2024-01-01 through 2025-01-01 (13 months after 2023-12-31)
    pops = fp.df.set_index("period_date")["census_total_population"]
    assert pops.loc[pd.Timestamp("2024-01-01")] == 19_000_000
    assert pops.loc[pd.Timestamp("2025-01-01")] == 19_000_000  # exactly at the 13-month edge
    assert pd.isna(pops.loc[pd.Timestamp("2025-02-01")])  # beyond the 13-month cap
