"""
PropertyIQ Automated Backtest Pipeline

This package provides tools for automated backtesting of PropertyIQ scores:
- Stratified sampling for efficient geography selection
- Automated backtest runner with parallel processing
- Statistical analysis and confidence calculation
- Notification system for alerts
"""

from .sampling import (
    SamplingConfig,
    SampleResult,
    create_backtest_sample,
    get_all_geography_ids,
    get_geography_attributes,
    stratified_sample,
)

from .automated_runner import (
    BacktestConfig,
    BacktestRunResult,
    run_automated_backtest,
)

__all__ = [
    'SamplingConfig',
    'SampleResult',
    'create_backtest_sample',
    'get_all_geography_ids',
    'get_geography_attributes',
    'stratified_sample',
    'BacktestConfig',
    'BacktestRunResult',
    'run_automated_backtest',
]
