"""
Automated Backtest Runner for PropertyIQ

Orchestrates monthly backtesting across all scores with stratified sampling.
Compares historical PropertyIQ scores against actual outcomes to calculate
confidence scores and generate alerts.

Key Features:
- Parallel batch processing with asyncio
- Confidence calculation: (R² × 0.5) + (Sample × 0.3) + (Recency × 0.2)
- Alert generation for low confidence scores
- Slack/email notifications
"""

import os
import json
import asyncio
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Tuple
from decimal import Decimal
import numpy as np
import pandas as pd
from psycopg2 import pool
from scipy import stats
from dotenv import load_dotenv
import requests

from .sampling import (
    SamplingConfig,
    SampleResult,
    create_backtest_sample,
    create_full_backtest_samples,
    get_connection_pool,
    execute_query,
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Score types and their configurations
SCORE_TYPES = {
    'market_health': {
        'horizons': ['6m', '1y'],
        'components': ['demand_strength', 'supply_balance', 'price_stability', 'economic_foundation'],
    },
    'homeready': {
        'horizons': ['6m', '1y', '3y', '5y'],
        'components': ['affordability', 'market_timing', 'growth_potential', 'stability', 'liquidity'],
    },
    'investoredge': {
        'horizons': ['6m', '1y', '3y', '5y'],
        'components': ['cash_flow', 'appreciation', 'rent_demand', 'entry_point', 'stability'],
    },
}

# Confidence thresholds
CONFIDENCE_THRESHOLDS = {
    'healthy': 70,
    'monitor': 55,
    'review': 40,
}


@dataclass
class BacktestConfig:
    """Configuration for automated backtest run."""
    score_types: List[str] = field(default_factory=lambda: ['market_health', 'homeready', 'investoredge'])
    horizons: List[str] = field(default_factory=lambda: ['6m', '1y', '3y', '5y'])
    geography_types: List[str] = field(default_factory=lambda: ['state', 'metro', 'county', 'zip'])
    county_sample: int = 500
    city_sample: int = 1000
    zip_sample: int = 2000
    random_seed: int = 42
    lookback_months: int = 12  # How far back to look for historical scores
    slack_webhook_url: Optional[str] = None
    email_recipients: Optional[List[str]] = None


@dataclass
class BacktestMetrics:
    """Metrics for a single backtest comparison."""
    r2: float
    directional_accuracy: float
    mae: float
    rmse: float
    quintile_spread: float
    sample_size: int


@dataclass
class ConfidenceResult:
    """Confidence calculation result."""
    confidence_score: float
    status: str  # 'healthy', 'monitor', 'review', 'broken'
    r2_component: float
    sample_component: float
    recency_component: float


@dataclass
class BacktestCellResult:
    """Result for a single cell in the backtest matrix (score × horizon × geo_type)."""
    score_type: str
    horizon: str
    geography_type: str
    metrics: BacktestMetrics
    confidence: ConfidenceResult
    geography_ids_tested: List[str]


@dataclass
class BacktestRunResult:
    """Complete result of an automated backtest run."""
    run_id: str
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: float
    config: BacktestConfig
    samples: Dict[str, SampleResult]
    results: List[BacktestCellResult]
    status: str  # 'healthy', 'review_needed', 'action_required'
    alert_count: int
    total_geographies_tested: int
    total_score_calculations: int


def generate_run_id() -> str:
    """Generate a unique run ID based on timestamp."""
    now = datetime.utcnow()
    return f"backtest_{now.strftime('%Y%m%d_%H%M%S')}"


def get_valid_horizons(score_type: str) -> List[str]:
    """Get valid horizons for a score type."""
    config = SCORE_TYPES.get(score_type, {})
    return config.get('horizons', ['6m', '1y'])


def horizon_to_months(horizon: str) -> int:
    """Convert horizon string to months."""
    mapping = {'6m': 6, '1y': 12, '3y': 36, '5y': 60}
    return mapping.get(horizon, 12)


def fetch_score_outcome_pairs(
    score_type: str,
    geography_type: str,
    geography_ids: List[str],
    horizon: str,
    lookback_months: int = 12,
) -> pd.DataFrame:
    """
    Fetch historical scores and their corresponding outcomes.

    Returns DataFrame with columns:
    - geography_id
    - score_date
    - score_value
    - outcome_date
    - outcome_value (actual price/rent change)
    """
    months = horizon_to_months(horizon)

    # Calculate date range
    end_date = datetime.utcnow() - timedelta(days=months * 30)  # Need time for outcome to materialize
    start_date = end_date - timedelta(days=lookback_months * 30)

    # Build geography filter
    if len(geography_ids) > 1000:
        # For large lists, use ANY with array
        geo_filter = "s.geography_id = ANY(%s)"
        geo_param = geography_ids
    else:
        geo_filter = f"s.geography_id IN ({','.join(['%s'] * len(geography_ids))})"
        geo_param = geography_ids

    # Query to get scores with outcomes
    # The outcome is the actual price/rent change over the horizon period
    query = f"""
        WITH scores AS (
            SELECT
                geography_id,
                calculated_at as score_date,
                CASE
                    WHEN %s = 'market_health' THEN market_health_score
                    WHEN %s = 'homeready' THEN homeready_score
                    WHEN %s = 'investoredge' THEN investoredge_score
                END as score_value
            FROM propertyiq_scores
            WHERE geography_type = %s
              AND {geo_filter}
              AND calculated_at BETWEEN %s AND %s
        ),
        outcomes AS (
            SELECT
                geography_id,
                period_date as outcome_date,
                zhvi_yoy_growth as price_change
            FROM (
                SELECT
                    zip_code as geography_id,
                    period_date,
                    zhvi_yoy_growth
                FROM zillow_zip_metrics
                WHERE zip_code IS NOT NULL
                UNION ALL
                SELECT
                    county_fips as geography_id,
                    period_date,
                    zhvi_yoy_growth
                FROM zillow_county_metrics
                WHERE county_fips IS NOT NULL
                UNION ALL
                SELECT
                    cbsa_code as geography_id,
                    period_date,
                    zhvi_yoy_growth
                FROM zillow_metro_metrics
                WHERE cbsa_code IS NOT NULL
            ) combined
        )
        SELECT
            s.geography_id,
            s.score_date,
            s.score_value,
            o.outcome_date,
            o.price_change as outcome_value
        FROM scores s
        JOIN outcomes o ON
            s.geography_id = o.geography_id
            AND o.outcome_date BETWEEN s.score_date + INTERVAL '%s months' - INTERVAL '15 days'
                                   AND s.score_date + INTERVAL '%s months' + INTERVAL '15 days'
        WHERE s.score_value IS NOT NULL
          AND o.price_change IS NOT NULL
    """

    params = (
        score_type, score_type, score_type,
        geography_type,
        *geo_param if isinstance(geo_param, list) else [geo_param],
        start_date, end_date,
        months, months,
    )

    try:
        results = execute_query(query, params)
        return pd.DataFrame(results)
    except Exception as e:
        logger.error(f"Error fetching score-outcome pairs: {e}")
        return pd.DataFrame()


def calculate_backtest_metrics(
    scores: np.ndarray,
    outcomes: np.ndarray,
) -> BacktestMetrics:
    """
    Calculate backtest metrics comparing scores to outcomes.

    Metrics:
    - R²: Coefficient of determination
    - Directional Accuracy: % of times score direction matched outcome direction
    - MAE: Mean Absolute Error
    - RMSE: Root Mean Squared Error
    - Quintile Spread: Difference in outcome between top and bottom quintile
    """
    n = len(scores)

    if n < 10:
        # Not enough samples for meaningful metrics
        return BacktestMetrics(
            r2=0.0,
            directional_accuracy=0.5,
            mae=float('inf'),
            rmse=float('inf'),
            quintile_spread=0.0,
            sample_size=n,
        )

    # R² (coefficient of determination)
    try:
        slope, intercept, r_value, p_value, std_err = stats.linregress(scores, outcomes)
        r2 = r_value ** 2
    except Exception:
        r2 = 0.0

    # Directional accuracy
    # High score should predict positive outcome, low score should predict negative
    score_median = np.median(scores)
    outcome_median = np.median(outcomes)
    score_direction = scores > score_median
    outcome_direction = outcomes > outcome_median
    directional_accuracy = np.mean(score_direction == outcome_direction)

    # MAE and RMSE (normalized)
    # Normalize scores and outcomes to 0-1 range for comparison
    score_norm = (scores - scores.min()) / (scores.max() - scores.min() + 1e-10)
    outcome_norm = (outcomes - outcomes.min()) / (outcomes.max() - outcomes.min() + 1e-10)
    mae = np.mean(np.abs(score_norm - outcome_norm))
    rmse = np.sqrt(np.mean((score_norm - outcome_norm) ** 2))

    # Quintile spread
    # Average outcome for top quintile vs bottom quintile
    quintiles = pd.qcut(scores, 5, labels=False, duplicates='drop')
    bottom_quintile_outcome = np.mean(outcomes[quintiles == 0]) if np.any(quintiles == 0) else 0
    top_quintile_outcome = np.mean(outcomes[quintiles == max(quintiles)]) if len(set(quintiles)) > 1 else 0
    quintile_spread = top_quintile_outcome - bottom_quintile_outcome

    return BacktestMetrics(
        r2=float(r2),
        directional_accuracy=float(directional_accuracy),
        mae=float(mae),
        rmse=float(rmse),
        quintile_spread=float(quintile_spread),
        sample_size=n,
    )


def calculate_confidence_score(
    metrics: BacktestMetrics,
    max_sample_size: int = 2000,
    days_since_last_update: int = 30,
) -> ConfidenceResult:
    """
    Calculate confidence score using weighted formula:
    Confidence = (R² × 0.5) + (Sample Size × 0.3) + (Recency × 0.2)

    Each component is normalized to 0-100 scale.
    """
    # R² component (0-100)
    # R² of 0.5+ is considered excellent for this domain
    r2_component = min(100, metrics.r2 * 200)  # R² of 0.5 = 100

    # Sample size component (0-100)
    # Normalize based on expected max sample size
    sample_component = min(100, (metrics.sample_size / max_sample_size) * 100)

    # Recency component (0-100)
    # Full score if updated within 30 days, decaying after
    if days_since_last_update <= 30:
        recency_component = 100
    elif days_since_last_update <= 90:
        recency_component = 100 - ((days_since_last_update - 30) / 60) * 50
    else:
        recency_component = max(0, 50 - ((days_since_last_update - 90) / 90) * 50)

    # Weighted combination
    confidence_score = (
        r2_component * 0.5 +
        sample_component * 0.3 +
        recency_component * 0.2
    )

    # Determine status
    if confidence_score >= CONFIDENCE_THRESHOLDS['healthy']:
        status = 'healthy'
    elif confidence_score >= CONFIDENCE_THRESHOLDS['monitor']:
        status = 'monitor'
    elif confidence_score >= CONFIDENCE_THRESHOLDS['review']:
        status = 'review'
    else:
        status = 'broken'

    return ConfidenceResult(
        confidence_score=round(confidence_score, 2),
        status=status,
        r2_component=round(r2_component, 2),
        sample_component=round(sample_component, 2),
        recency_component=round(recency_component, 2),
    )


async def run_backtest_cell(
    score_type: str,
    geography_type: str,
    horizon: str,
    geography_ids: List[str],
    lookback_months: int,
) -> Optional[BacktestCellResult]:
    """
    Run backtest for a single cell (score × horizon × geo_type).
    """
    logger.info(f"Running backtest: {score_type} / {geography_type} / {horizon}")

    # Fetch score-outcome pairs
    df = fetch_score_outcome_pairs(
        score_type=score_type,
        geography_type=geography_type,
        geography_ids=geography_ids,
        horizon=horizon,
        lookback_months=lookback_months,
    )

    if df.empty or len(df) < 10:
        logger.warning(f"Insufficient data for {score_type}/{geography_type}/{horizon}")
        return None

    # Calculate metrics
    scores = df['score_value'].values
    outcomes = df['outcome_value'].values
    metrics = calculate_backtest_metrics(scores, outcomes)

    # Calculate confidence
    confidence = calculate_confidence_score(
        metrics=metrics,
        max_sample_size=len(geography_ids),
        days_since_last_update=30,  # Assume recent for automated runs
    )

    return BacktestCellResult(
        score_type=score_type,
        horizon=horizon,
        geography_type=geography_type,
        metrics=metrics,
        confidence=confidence,
        geography_ids_tested=df['geography_id'].unique().tolist(),
    )


async def run_backtest_batch(
    cells: List[Tuple[str, str, str, List[str]]],  # (score_type, geo_type, horizon, geo_ids)
    lookback_months: int,
    max_concurrent: int = 5,
) -> List[BacktestCellResult]:
    """
    Run multiple backtest cells in parallel with concurrency limit.
    """
    semaphore = asyncio.Semaphore(max_concurrent)

    async def run_with_semaphore(score_type, geo_type, horizon, geo_ids):
        async with semaphore:
            return await run_backtest_cell(
                score_type, geo_type, horizon, geo_ids, lookback_months
            )

    tasks = [
        run_with_semaphore(score_type, geo_type, horizon, geo_ids)
        for score_type, geo_type, horizon, geo_ids in cells
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out None and exceptions
    valid_results = []
    for result in results:
        if isinstance(result, BacktestCellResult):
            valid_results.append(result)
        elif isinstance(result, Exception):
            logger.error(f"Backtest cell failed: {result}")

    return valid_results


def create_confidence_alerts(
    results: List[BacktestCellResult],
    run_id: str,
) -> int:
    """
    Create alerts for cells with low confidence.
    Returns count of alerts created.
    """
    alert_count = 0

    for result in results:
        if result.confidence.status in ('review', 'broken'):
            # Insert alert into database
            query = """
                INSERT INTO propertyiq_confidence_alerts (
                    score_type,
                    geography_type,
                    horizon,
                    confidence_score,
                    status,
                    diagnostic_signals,
                    run_id,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """
            diagnostic = {
                'r2': result.metrics.r2,
                'sample_size': result.metrics.sample_size,
                'directional_accuracy': result.metrics.directional_accuracy,
                'quintile_spread': result.metrics.quintile_spread,
            }

            try:
                conn_pool = get_connection_pool()
                conn = conn_pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute(query, (
                            result.score_type,
                            result.geography_type,
                            result.horizon,
                            result.confidence.confidence_score,
                            result.confidence.status,
                            json.dumps(diagnostic),
                            run_id,
                        ))
                    conn.commit()
                    alert_count += 1
                finally:
                    conn_pool.putconn(conn)
            except Exception as e:
                logger.error(f"Failed to create alert: {e}")

    return alert_count


def save_backtest_run(run_result: BacktestRunResult) -> bool:
    """Save backtest run to database."""
    try:
        conn_pool = get_connection_pool()
        conn = conn_pool.getconn()

        try:
            with conn.cursor() as cur:
                # Insert run metadata
                cur.execute("""
                    INSERT INTO propertyiq_backtest_runs (
                        id,
                        started_at,
                        completed_at,
                        duration_seconds,
                        config,
                        total_geographies_tested,
                        total_score_calculations,
                        status,
                        results,
                        alert_count,
                        created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """, (
                    run_result.run_id,
                    run_result.started_at,
                    run_result.completed_at,
                    run_result.duration_seconds,
                    json.dumps(asdict(run_result.config)),
                    run_result.total_geographies_tested,
                    run_result.total_score_calculations,
                    run_result.status,
                    json.dumps([{
                        'score_type': r.score_type,
                        'horizon': r.horizon,
                        'geography_type': r.geography_type,
                        'metrics': asdict(r.metrics),
                        'confidence': asdict(r.confidence),
                    } for r in run_result.results]),
                    run_result.alert_count,
                ))

                # Insert sample metadata
                for geo_type, sample in run_result.samples.items():
                    cur.execute("""
                        INSERT INTO propertyiq_backtest_samples (
                            run_id,
                            geography_type,
                            sample_size,
                            geography_ids,
                            sampling_method,
                            strata_config,
                            created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """, (
                        run_result.run_id,
                        geo_type,
                        sample.sample_size,
                        sample.geography_ids,
                        sample.sampling_method,
                        json.dumps(sample.strata_config),
                    ))

            conn.commit()
            logger.info(f"Saved backtest run: {run_result.run_id}")
            return True

        finally:
            conn_pool.putconn(conn)

    except Exception as e:
        logger.error(f"Failed to save backtest run: {e}")
        return False


def send_slack_notification(
    run_result: BacktestRunResult,
    webhook_url: str,
) -> bool:
    """Send Slack notification with backtest results."""
    if not webhook_url:
        return False

    # Determine emoji based on status
    status_emoji = {
        'healthy': ':white_check_mark:',
        'review_needed': ':warning:',
        'action_required': ':x:',
    }

    # Build message
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{status_emoji.get(run_result.status, ':question:')} PropertyIQ Backtest Complete",
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Run ID:*\n{run_result.run_id}"},
                {"type": "mrkdwn", "text": f"*Status:*\n{run_result.status.replace('_', ' ').title()}"},
                {"type": "mrkdwn", "text": f"*Duration:*\n{run_result.duration_seconds:.1f}s"},
                {"type": "mrkdwn", "text": f"*Alerts:*\n{run_result.alert_count}"},
            ]
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Summary:*\n- Geographies tested: {run_result.total_geographies_tested}\n- Score calculations: {run_result.total_score_calculations}",
            }
        },
    ]

    # Add alert details if any
    if run_result.alert_count > 0:
        alert_cells = [r for r in run_result.results if r.confidence.status in ('review', 'broken')]
        alert_text = "\n".join([
            f"• {r.score_type}/{r.geography_type}/{r.horizon}: {r.confidence.confidence_score}%"
            for r in alert_cells[:5]  # Limit to 5
        ])
        if len(alert_cells) > 5:
            alert_text += f"\n... and {len(alert_cells) - 5} more"

        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Low Confidence Alerts:*\n{alert_text}",
            }
        })

    try:
        response = requests.post(
            webhook_url,
            json={"blocks": blocks},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        return response.status_code == 200
    except Exception as e:
        logger.error(f"Failed to send Slack notification: {e}")
        return False


async def run_automated_backtest(config: BacktestConfig) -> BacktestRunResult:
    """
    Main orchestration function for automated backtest.

    Steps:
    1. Generate run ID
    2. Create samples for each geography type
    3. Build list of cells to test (score × horizon × geo_type)
    4. Run backtests in parallel batches
    5. Calculate overall status
    6. Create alerts for low confidence
    7. Save results to database
    8. Send notifications
    """
    run_id = generate_run_id()
    started_at = datetime.utcnow()
    logger.info(f"Starting automated backtest: {run_id}")

    # Create samples
    samples = create_full_backtest_samples(
        county_sample=config.county_sample,
        city_sample=config.city_sample,
        zip_sample=config.zip_sample,
        random_seed=config.random_seed,
    )

    # Build list of cells to test
    cells = []
    for score_type in config.score_types:
        valid_horizons = get_valid_horizons(score_type)
        for horizon in config.horizons:
            if horizon not in valid_horizons:
                continue
            for geo_type in config.geography_types:
                if geo_type in samples:
                    cells.append((
                        score_type,
                        geo_type,
                        horizon,
                        samples[geo_type].geography_ids,
                    ))

    logger.info(f"Running {len(cells)} backtest cells")

    # Run backtests
    results = await run_backtest_batch(cells, config.lookback_months)

    # Calculate overall status
    statuses = [r.confidence.status for r in results]
    if any(s == 'broken' for s in statuses):
        overall_status = 'action_required'
    elif any(s in ('review', 'monitor') for s in statuses):
        overall_status = 'review_needed'
    else:
        overall_status = 'healthy'

    # Create alerts
    alert_count = create_confidence_alerts(results, run_id)

    completed_at = datetime.utcnow()
    duration_seconds = (completed_at - started_at).total_seconds()

    # Build result
    run_result = BacktestRunResult(
        run_id=run_id,
        started_at=started_at,
        completed_at=completed_at,
        duration_seconds=duration_seconds,
        config=config,
        samples=samples,
        results=results,
        status=overall_status,
        alert_count=alert_count,
        total_geographies_tested=sum(s.sample_size for s in samples.values()),
        total_score_calculations=len(results),
    )

    # Save to database
    save_backtest_run(run_result)

    # Send notifications
    if config.slack_webhook_url:
        send_slack_notification(run_result, config.slack_webhook_url)

    logger.info(f"Backtest complete: {run_id} ({overall_status})")
    return run_result


def run_automated_backtest_sync(config: BacktestConfig) -> BacktestRunResult:
    """Synchronous wrapper for run_automated_backtest."""
    return asyncio.run(run_automated_backtest(config))


if __name__ == '__main__':
    """Run automated backtest from command line."""
    import argparse

    parser = argparse.ArgumentParser(description='Run automated PropertyIQ backtest')
    parser.add_argument('--score-types', type=str, default='market_health,homeready,investoredge',
                        help='Comma-separated list of score types')
    parser.add_argument('--horizons', type=str, default='6m,1y,3y,5y',
                        help='Comma-separated list of horizons')
    parser.add_argument('--county-sample', type=int, default=500,
                        help='Sample size for counties')
    parser.add_argument('--zip-sample', type=int, default=2000,
                        help='Sample size for ZIPs')
    parser.add_argument('--seed', type=int, default=42,
                        help='Random seed')
    parser.add_argument('--slack-webhook', type=str,
                        help='Slack webhook URL for notifications')

    args = parser.parse_args()

    config = BacktestConfig(
        score_types=args.score_types.split(','),
        horizons=args.horizons.split(','),
        county_sample=args.county_sample,
        zip_sample=args.zip_sample,
        random_seed=args.seed,
        slack_webhook_url=args.slack_webhook,
    )

    result = run_automated_backtest_sync(config)

    print(f"\n{'='*60}")
    print(f"Backtest Run: {result.run_id}")
    print(f"{'='*60}")
    print(f"Status: {result.status}")
    print(f"Duration: {result.duration_seconds:.1f} seconds")
    print(f"Geographies tested: {result.total_geographies_tested}")
    print(f"Score calculations: {result.total_score_calculations}")
    print(f"Alerts: {result.alert_count}")
    print(f"\nResults by cell:")
    for r in result.results:
        print(f"  {r.score_type}/{r.geography_type}/{r.horizon}: "
              f"R²={r.metrics.r2:.3f}, Conf={r.confidence.confidence_score}% ({r.confidence.status})")
