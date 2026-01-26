"""
Backtest Service - Score Validation Analysis

Validates PropertyIQ scores by measuring how well they predict
benchmark-beating performance across multiple time horizons.

Key validation: High scores should outperform benchmarks,
               Low scores should underperform benchmarks.

Uses DataCache for efficient access to full historical dataset.
"""

import logging
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy import stats
from supabase import create_client, Client

from app.config import get_settings
from app.models.requests import BacktestRequest
from app.models.responses import BacktestResponse, BacktestMetrics
from app.services.data_cache import get_data_cache, DataCache

logger = logging.getLogger(__name__)


@dataclass
class DecileResult:
    """Results for a single score decile."""
    decile: str
    score_min: float
    score_max: float
    avg_actual_return: float
    avg_benchmark_return: float
    avg_excess_return: float
    observations: int
    std_dev: float
    t_statistic: float
    p_value: float
    beats_benchmark: bool


@dataclass
class HorizonResult:
    """Results for a single time horizon."""
    horizon_months: int
    decile_results: list[DecileResult]
    top_decile_excess: float
    bottom_decile_excess: float
    spread: float
    pearson_r: float
    spearman_r: float
    r_squared: float
    validated: bool
    sample_size: int


@dataclass
class QuintileResult:
    """Results for a single score quintile."""
    quintile: int  # 1-5 (1=bottom, 5=top)
    score_min: float
    score_max: float
    avg_excess_return: float
    beat_market_rate: float  # % of observations that beat benchmark
    observations: int
    t_statistic: float
    p_value: float


@dataclass
class ValidationSummary:
    """Summary metrics for score validation."""
    score_type: str
    top_quintile_excess: float
    bottom_quintile_excess: float
    spread: float
    top_quintile_beat_rate: float
    bottom_quintile_beat_rate: float
    t_test_pvalue: float
    spearman_correlation: float
    observations: int
    validated: bool


@dataclass
class BacktestAnalysisResult:
    """Complete backtest analysis result."""
    score_type: str
    geography_type: str
    benchmark_type: str
    analysis_date: str
    horizons: list[HorizonResult]
    overall_validated: bool
    confidence_grade: str
    total_observations: int
    date_range_start: str
    date_range_end: str
    data_source: str = "database"  # 'cache' or 'database'
    validation_summary: Optional[ValidationSummary] = None
    quintile_results: list[QuintileResult] = field(default_factory=list)


class BacktestService:
    """Service for running backtests on scoring models."""

    def __init__(self):
        self.settings = get_settings()
        self._supabase: Optional[Client] = None
        self._cache: Optional[DataCache] = None

    @property
    def supabase(self) -> Client:
        """Lazy-load Supabase client."""
        if self._supabase is None:
            if not self.settings.supabase_url or not self.settings.supabase_service_key:
                raise ValueError("Supabase credentials not configured")
            self._supabase = create_client(
                self.settings.supabase_url,
                self.settings.supabase_service_key
            )
        return self._supabase

    @property
    def cache(self) -> DataCache:
        """Get data cache instance."""
        if self._cache is None:
            self._cache = get_data_cache()
        return self._cache

    async def run_full_backtest(
        self,
        score_type: str = "investoredge",
        geography_type: str = "metro",
        benchmark_type: str = "national",
        horizons: list[int] = None,
        use_cache: bool = True,
    ) -> BacktestAnalysisResult:
        """
        Run comprehensive backtest analysis.
        
        Args:
            score_type: 'investoredge', 'homeready', or 'market_health'
            geography_type: 'zip', 'county', 'metro', or 'state'
            benchmark_type: 'national', 'regional', or 'peer'
            horizons: List of months to test (default: [6, 12, 36, 60])
            use_cache: Whether to use cached data (default: True)
        
        Returns:
            BacktestAnalysisResult with decile breakdown for each horizon
        """
        horizons = horizons or [12, 36, 60]
        logger.info(f"Running backtest: {score_type} / {geography_type} / {benchmark_type}")
        
        # Fetch data (from cache or database)
        df, data_source = await self._fetch_backtest_data(
            score_type, geography_type, use_cache
        )
        
        if df.empty:
            logger.warning("No data found for backtest")
            return self._empty_result(score_type, geography_type, benchmark_type)
        
        logger.info(f"Loaded {len(df)} records for analysis from {data_source}")
        
        # Analyze each horizon
        horizon_results = []
        for horizon in horizons:
            result = self._analyze_horizon(
                df, score_type, horizon, benchmark_type
            )
            if result:
                horizon_results.append(result)
        
        # Determine overall validation
        validated_horizons = [h for h in horizon_results if h.validated]
        overall_validated = len(validated_horizons) >= len(horizon_results) * 0.5
        
        # Calculate confidence grade
        confidence_grade = self._calculate_confidence_grade(horizon_results)
        
        # Get date range
        date_range_start = df['period_date'].min() if 'period_date' in df.columns else "N/A"
        date_range_end = df['period_date'].max() if 'period_date' in df.columns else "N/A"
        
        # Calculate quintile analysis with beat rates (use 36m horizon as primary)
        primary_horizon = 36 if 36 in horizons else horizons[0] if horizons else 12
        quintile_results, validation_summary = self._calculate_quintile_validation(
            df, score_type, primary_horizon
        )
        
        return BacktestAnalysisResult(
            score_type=score_type,
            geography_type=geography_type,
            benchmark_type=benchmark_type,
            analysis_date=datetime.utcnow().isoformat(),
            horizons=horizon_results,
            overall_validated=overall_validated,
            confidence_grade=confidence_grade,
            total_observations=len(df),
            date_range_start=str(date_range_start),
            date_range_end=str(date_range_end),
            data_source=data_source,
            validation_summary=validation_summary,
            quintile_results=quintile_results,
        )

    async def _fetch_backtest_data(
        self,
        score_type: str,
        geography_type: str,
        use_cache: bool = True,
    ) -> tuple[pd.DataFrame, str]:
        """
        Fetch historical scores with outcomes.
        
        Uses cache if available and enabled, otherwise fetches from database
        using pagination to get the full dataset.
        
        Returns:
            Tuple of (DataFrame, data_source)
        """
        score_col = f"{score_type}_score"
        
        # Try cache first
        if use_cache:
            try:
                df = self.cache.get_cached_data(geography_type, auto_sync=True)
                if df is not None and len(df) > 0:
                    # Filter to records with the requested score
                    if score_col in df.columns:
                        df = df[df[score_col].notna()]
                    logger.info(f"Loaded {len(df)} records from cache")
                    return df, "cache"
            except Exception as e:
                logger.warning(f"Cache load failed, falling back to database: {e}")
        
        # Fall back to paginated database fetch
        return await self._fetch_from_database_paginated(score_type, geography_type), "database"

    async def _fetch_from_database_paginated(
        self,
        score_type: str,
        geography_type: str,
        batch_size: int = 10000,
    ) -> pd.DataFrame:
        """Fetch full dataset from database using pagination."""
        score_col = f"{score_type}_score"
        
        columns = [
            'id', 'geography_id', 'geography_type', 'period_date',
            score_col,
            'actual_appreciation_12m', 'actual_appreciation_36m',
            'actual_appreciation_60m',
        ]
        
        all_data = []
        offset = 0
        
        logger.info(f"Fetching full dataset for {geography_type} using pagination...")
        
        while True:
            try:
                # Build query step by step for supabase-py v2 compatibility
                query = self.supabase.table('propertyiq_scores_history').select(','.join(columns))
                query = query.eq('geography_type', geography_type)
                query = query.range(offset, offset + batch_size - 1)
                response = query.execute()
            except Exception as e:
                logger.error(f"Error fetching batch at offset {offset}: {e}")
                break
            
            if not response.data:
                break
            
            all_data.extend(response.data)
            logger.info(f"Fetched batch: {len(response.data)} records (total: {len(all_data)})")
            
            if len(response.data) < batch_size:
                break
            
            offset += batch_size
        
        if not all_data:
            logger.warning(f"No data returned for {geography_type}")
            return pd.DataFrame()
        
        df = pd.DataFrame(all_data)
        
        # Filter to records with valid scores
        if score_col in df.columns:
            df = df[df[score_col].notna()]
        
        logger.info(f"Total: {len(df)} valid records for {geography_type}/{score_type}")
        return df

    def _analyze_horizon(
        self,
        df: pd.DataFrame,
        score_type: str,
        horizon_months: int,
        benchmark_type: str,
    ) -> Optional[HorizonResult]:
        """Analyze a single time horizon."""
        score_col = f"{score_type}_score"
        outcome_col = f"actual_appreciation_{horizon_months}m"
        
        # Check if outcome column exists and has data
        if outcome_col not in df.columns:
            logger.warning(f"Missing column: {outcome_col}")
            return None
        
        # Filter to rows with valid scores and outcomes
        valid_df = df[[score_col, outcome_col]].dropna()
        
        if len(valid_df) < 100:
            logger.warning(f"Insufficient data for {horizon_months}m: {len(valid_df)} rows")
            return None
        
        logger.info(f"Analyzing {horizon_months}m horizon with {len(valid_df)} records")
        
        scores = valid_df[score_col].values
        outcomes = valid_df[outcome_col].values
        
        # Calculate benchmark (mean of all outcomes for this horizon)
        benchmark_return = np.mean(outcomes)
        
        # Create deciles (0-10, 11-20, ..., 91-100)
        decile_results = self._calculate_decile_results(
            scores, outcomes, benchmark_return
        )
        
        # Get top and bottom decile excess
        top_decile = decile_results[-1] if decile_results else None
        bottom_decile = decile_results[0] if decile_results else None
        
        top_excess = top_decile.avg_excess_return if top_decile else 0
        bottom_excess = bottom_decile.avg_excess_return if bottom_decile else 0
        spread = top_excess - bottom_excess
        
        # Correlation analysis (handle NaN/constant data)
        try:
            pearson_r, _ = stats.pearsonr(scores, outcomes)
            if np.isnan(pearson_r):
                pearson_r = 0.0
        except Exception:
            pearson_r = 0.0
            
        try:
            spearman_r, _ = stats.spearmanr(scores, outcomes)
            if np.isnan(spearman_r):
                spearman_r = 0.0
        except Exception:
            spearman_r = 0.0
            
        r_squared = pearson_r ** 2
        
        # Validation: top decile beats benchmark, bottom trails
        # Use bool() to convert numpy.bool_ to native Python bool for JSON serialization
        validated = bool(
            top_decile and top_decile.beats_benchmark and
            bottom_decile and not bottom_decile.beats_benchmark and
            spread > 0.01  # At least 1% spread
        )
        
        return HorizonResult(
            horizon_months=horizon_months,
            decile_results=decile_results,
            top_decile_excess=float(top_excess) if not np.isnan(top_excess) else 0.0,
            bottom_decile_excess=float(bottom_excess) if not np.isnan(bottom_excess) else 0.0,
            spread=float(spread) if not np.isnan(spread) else 0.0,
            pearson_r=float(pearson_r),
            spearman_r=float(spearman_r),
            r_squared=float(r_squared),
            validated=bool(validated),
            sample_size=len(valid_df),
        )

    def _calculate_decile_results(
        self,
        scores: np.ndarray,
        outcomes: np.ndarray,
        benchmark_return: float,
    ) -> list[DecileResult]:
        """Calculate results for each score decile."""
        results = []
        
        # Define decile boundaries
        decile_bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        decile_labels = ['0-10', '11-20', '21-30', '31-40', '41-50',
                        '51-60', '61-70', '71-80', '81-90', '91-100']
        
        for i in range(len(decile_bins) - 1):
            low = decile_bins[i]
            high = decile_bins[i + 1]
            label = decile_labels[i]
            
            # Filter to this decile
            if i == len(decile_bins) - 2:  # Last decile includes 100
                mask = (scores >= low) & (scores <= high)
            else:
                mask = (scores >= low) & (scores < high)
            
            decile_outcomes = outcomes[mask]
            
            if len(decile_outcomes) < 10:
                continue
            
            # Calculate statistics
            avg_actual = float(np.mean(decile_outcomes))
            avg_excess = avg_actual - benchmark_return
            std_dev = float(np.std(decile_outcomes, ddof=1))
            
            # T-test: is the excess return significantly different from 0?
            if std_dev > 0 and len(decile_outcomes) > 1:
                t_stat, p_value = stats.ttest_1samp(
                    decile_outcomes - benchmark_return, 0
                )
            else:
                t_stat, p_value = 0.0, 1.0
            
            results.append(DecileResult(
                decile=label,
                score_min=float(low),
                score_max=float(high),
                avg_actual_return=float(avg_actual),
                avg_benchmark_return=float(benchmark_return),
                avg_excess_return=float(avg_excess),
                observations=int(len(decile_outcomes)),
                std_dev=float(std_dev),
                t_statistic=float(t_stat),
                p_value=float(p_value),
                # Use bool() to convert numpy.bool_ to native Python bool for JSON serialization
                beats_benchmark=bool(avg_excess > 0 and p_value < 0.05),
            ))
        
        return results

    def _calculate_quintile_validation(
        self,
        df: pd.DataFrame,
        score_type: str,
        horizon_months: int,
    ) -> tuple[list[QuintileResult], Optional[ValidationSummary]]:
        """
        Calculate quintile-based validation with beat-market rates.
        
        Returns:
            Tuple of (quintile_results, validation_summary)
        """
        score_col = f"{score_type}_score"
        outcome_col = f"actual_appreciation_{horizon_months}m"
        
        if outcome_col not in df.columns or score_col not in df.columns:
            return [], None
        
        # Filter to valid data
        valid_df = df[[score_col, outcome_col]].dropna()
        
        if len(valid_df) < 100:
            return [], None
        
        scores = valid_df[score_col].values
        outcomes = valid_df[outcome_col].values
        
        # Benchmark is the mean return
        benchmark = np.mean(outcomes)
        excess_returns = outcomes - benchmark
        
        # Calculate quintile boundaries using percentiles
        quintile_edges = np.percentile(scores, [0, 20, 40, 60, 80, 100])
        
        quintile_results = []
        
        for q in range(1, 6):
            low = quintile_edges[q - 1]
            high = quintile_edges[q]
            
            # Filter to this quintile
            if q == 5:  # Include max value
                mask = (scores >= low) & (scores <= high)
            else:
                mask = (scores >= low) & (scores < high)
            
            q_outcomes = outcomes[mask]
            q_excess = excess_returns[mask]
            
            if len(q_outcomes) < 10:
                continue
            
            avg_excess = float(np.mean(q_excess))
            
            # Beat market rate = % of observations with positive excess return
            beat_rate = float(np.sum(q_excess > 0) / len(q_excess) * 100)
            
            # T-test for significance
            if len(q_excess) > 1 and np.std(q_excess) > 0:
                t_stat, p_value = stats.ttest_1samp(q_excess, 0)
            else:
                t_stat, p_value = 0.0, 1.0
            
            quintile_results.append(QuintileResult(
                quintile=int(q),
                score_min=float(low),
                score_max=float(high),
                avg_excess_return=float(avg_excess),
                beat_market_rate=float(beat_rate),
                observations=int(len(q_outcomes)),
                t_statistic=float(t_stat) if not np.isnan(t_stat) else 0.0,
                p_value=float(p_value) if not np.isnan(p_value) else 1.0,
            ))
        
        # Build validation summary
        if len(quintile_results) >= 2:
            top_q = quintile_results[-1]  # Quintile 5
            bottom_q = quintile_results[0]  # Quintile 1
            
            # Overall t-test comparing top vs bottom quintile
            top_mask = scores >= quintile_edges[4]
            bottom_mask = scores < quintile_edges[1]
            
            top_outcomes = outcomes[top_mask]
            bottom_outcomes = outcomes[bottom_mask]
            
            if len(top_outcomes) > 1 and len(bottom_outcomes) > 1:
                _, overall_pvalue = stats.ttest_ind(top_outcomes, bottom_outcomes)
            else:
                overall_pvalue = 1.0
            
            # Spearman correlation
            try:
                spearman_r, _ = stats.spearmanr(scores, outcomes)
                if np.isnan(spearman_r):
                    spearman_r = 0.0
            except Exception:
                spearman_r = 0.0
            
            spread = top_q.avg_excess_return - bottom_q.avg_excess_return
            
            # Validated if:
            # - Top quintile has positive excess
            # - Bottom quintile has negative excess
            # - Statistically significant (p < 0.05)
            # Use bool() to convert numpy.bool_ to native Python bool for JSON serialization
            validated = bool(
                top_q.avg_excess_return > 0 and
                bottom_q.avg_excess_return < 0 and
                overall_pvalue < 0.05
            )
            
            validation_summary = ValidationSummary(
                score_type=score_type,
                top_quintile_excess=float(top_q.avg_excess_return),
                bottom_quintile_excess=float(bottom_q.avg_excess_return),
                spread=float(spread),
                top_quintile_beat_rate=float(top_q.beat_market_rate),
                bottom_quintile_beat_rate=float(bottom_q.beat_market_rate),
                t_test_pvalue=float(overall_pvalue) if not np.isnan(overall_pvalue) else 1.0,
                spearman_correlation=float(spearman_r),
                observations=int(len(valid_df)),
                validated=bool(validated),
            )
            
            return quintile_results, validation_summary
        
        return quintile_results, None

    def _calculate_confidence_grade(
        self,
        horizon_results: list[HorizonResult],
    ) -> str:
        """Calculate overall confidence grade based on validation results."""
        if not horizon_results:
            return "F"
        
        # Factors:
        # 1. Validation rate (how many horizons are validated)
        # 2. Average spread (difference between top and bottom deciles)
        # 3. R-squared (correlation strength)
        
        validation_rate = sum(1 for h in horizon_results if h.validated) / len(horizon_results)
        avg_spread = np.mean([h.spread for h in horizon_results])
        avg_r_squared = np.mean([h.r_squared for h in horizon_results])
        
        # Weighted score (0-100)
        score = (
            validation_rate * 40 +  # 40% weight
            min(avg_spread * 500, 30) +  # 30% weight (0.06 spread = full points)
            min(avg_r_squared * 100, 30)  # 30% weight
        )
        
        if score >= 80:
            return "A"
        elif score >= 65:
            return "B"
        elif score >= 50:
            return "C"
        elif score >= 35:
            return "D"
        else:
            return "F"

    def _empty_result(
        self,
        score_type: str,
        geography_type: str,
        benchmark_type: str,
    ) -> BacktestAnalysisResult:
        """Return empty result when no data available."""
        return BacktestAnalysisResult(
            score_type=score_type,
            geography_type=geography_type,
            benchmark_type=benchmark_type,
            analysis_date=datetime.utcnow().isoformat(),
            horizons=[],
            overall_validated=False,
            confidence_grade="F",
            total_observations=0,
            date_range_start="N/A",
            date_range_end="N/A",
            data_source="none",
        )

    async def run_backtest(self, request: BacktestRequest) -> BacktestResponse:
        """
        Run a backtest on historical data (legacy API compatibility).
        """
        logger.info(
            f"Running {request.score_type} backtest from {request.start_date} to {request.end_date}"
        )
        
        # Run full analysis
        result = await self.run_full_backtest(
            score_type=request.score_type.replace("-", ""),
            geography_type="metro",
            benchmark_type="national",
            horizons=[12, 36, 60],
        )
        
        # Convert to legacy response format
        metrics = BacktestMetrics(
            total_predictions=result.total_observations,
            accuracy=0.0,  # Not applicable in new model
            precision=0.0,
            recall=0.0,
            f1_score=0.0,
            avg_return_high_score=result.horizons[0].top_decile_excess * 100 if result.horizons else 0,
            avg_return_low_score=result.horizons[0].bottom_decile_excess * 100 if result.horizons else 0,
            excess_return=result.horizons[0].spread * 100 if result.horizons else 0,
        )
        
        return BacktestResponse(
            score_type=request.score_type,
            start_date=request.start_date.isoformat(),
            end_date=request.end_date.isoformat(),
            holding_period_months=request.holding_period_months,
            metrics=metrics,
            state_breakdown=None,
            completed_at=datetime.utcnow(),
            execution_time_ms=0,
        )

    async def get_data_status(self) -> dict:
        """Check the status of backtest data in the database and cache."""
        status = {
            "database": {},
            "cache": {},
        }
        
        # Get cache status
        try:
            status["cache"] = self.cache.get_cache_status()
        except Exception as e:
            status["cache"]["error"] = str(e)
        
        # Get database summary (use materialized view if available)
        try:
            # Try materialized view first
            query = self.supabase.table('mv_backtest_summary').select('*')
            response = query.execute()
            
            if response.data:
                status["database"]["from_view"] = True
                status["database"]["summary"] = response.data
            else:
                # Fall back to sample query
                status["database"]["from_view"] = False
                query = self.supabase.table('propertyiq_scores_history').select('geography_type')
                query = query.limit(1000)
                sample = query.execute()
                
                if sample.data:
                    df = pd.DataFrame(sample.data)
                    status["database"]["sample_by_geo"] = df['geography_type'].value_counts().to_dict()
                    
        except Exception as e:
            logger.warning(f"Could not get database status: {e}")
            status["database"]["error"] = str(e)
        
        return status

    async def sync_cache(self, geo_type: str = None, force_full: bool = False) -> dict:
        """Synchronize cache with database."""
        if geo_type:
            return self.cache.sync_cache(geo_type, force_full)
        else:
            return self.cache.sync_all(force_full)


# Singleton instance
_backtest_service: Optional[BacktestService] = None


def get_backtest_service() -> BacktestService:
    """Get or create backtest service singleton."""
    global _backtest_service
    if _backtest_service is None:
        _backtest_service = BacktestService()
    return _backtest_service
