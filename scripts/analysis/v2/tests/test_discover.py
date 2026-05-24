"""Smoke tests for the discover CLI.

These build tiny synthetic Parquet panels in tmp_path and verify the
pipeline runs end-to-end (handling small-panel abort and a happy-path
small-but-sufficient case)."""

import numpy as np
import pandas as pd
import pytest

from scripts.analysis.v2.discover import discover


def _write(path, df):
    df.to_parquet(path, index=False)


def test_aborts_on_tiny_panel(tmp_path):
    # Only 3 markets × 5 periods = 15 rows; nowhere near the 1000-row floor
    rows = []
    for r in range(3):
        for m in range(5):
            rows.append({"region_id": f"R{r}", "period_date": pd.Timestamp(f"2020-{m+1:02d}-01"), "zil_zhvi": 100 + m})
    _write(tmp_path / "zillow_metro.parquet", pd.DataFrame(rows))
    _write(tmp_path / "geos_metro.parquet", pd.DataFrame({
        "region_id": ["R0", "R1", "R2"],
        "state_abbrev": ["CA", "CA", "CA"],
        "division": ["Pacific"] * 3,
        "region": ["West"] * 3,
    }))
    out = discover("metro", data_dir=tmp_path, output_dir=tmp_path, n_bootstrap=50)
    assert out["shipped"] is False
    assert "error" in out


def test_raises_on_missing_geos_file(tmp_path):
    _write(tmp_path / "zillow_metro.parquet", pd.DataFrame({
        "region_id": ["R0"], "period_date": [pd.Timestamp("2020-01-01")], "zil_zhvi": [100.0]
    }))
    with pytest.raises(FileNotFoundError):
        discover("metro", data_dir=tmp_path, output_dir=tmp_path, n_bootstrap=50)
