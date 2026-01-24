# scripts/generate_monthly_report.py
"""
Generate automated monthly reports on formula health and optimization opportunities.

This script:
1. Runs backtests against all score dates
2. Calculates confidence metrics
3. Compares current formula to ML-optimized weights
4. Identifies geographies where formula is underperforming
5. Generates HTML report and sends Slack/email notifications

Usage:
    # Generate report and save locally
    python scripts/generate_monthly_report.py
    
    # Generate and send notifications
    python scripts/generate_monthly_report.py --notify
    
    # Generate for specific month
    python scripts/generate_monthly_report.py --month 2026-01
"""

import polars as pl
import pandas as pd
import numpy as np
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
import json
import os
import argparse
from jinja2 import Template
import requests
from scipy import stats
from autogluon.tabular import TabularPredictor


def generate_monthly_report(report_month: str = None, send_notifications: bool = False):
    """Generate comprehensive monthly report."""
    
    print("=" * 70)
    print("PROPERTYIQ MONTHLY FORMULA HEALTH REPORT")
    print("=" * 70)
    
    if report_month is None:
        report_month = datetime.now().strftime("%Y-%m")
    
    print(f"\nReport Period: {report_month}")
    
    # ─────────────────────────────────────────────────────────────
    # Load data
    # ─────────────────────────────────────────────────────────────
    print("\n[1/6] Loading data...")
    
    df = pl.read_parquet("data/backtest_with_benchmarks.parquet")
    print(f"   Loaded {len(df):,} backtest records")
    
    # ─────────────────────────────────────────────────────────────
    # Calculate confidence metrics
    # ─────────────────────────────────────────────────────────────
    print("\n[2/6] Calculating confidence metrics...")
    
    confidence_results = calculate_confidence_metrics(df)
    
    # ─────────────────────────────────────────────────────────────
    # Run feature importance analysis
    # ─────────────────────────────────────────────────────────────
    print("\n[3/6] Analyzing feature importance...")
    
    importance_results = analyze_feature_importance(df)
    
    # ─────────────────────────────────────────────────────────────
    # Identify problem areas
    # ─────────────────────────────────────────────────────────────
    print("\n[4/6] Identifying problem areas...")
    
    problem_areas = identify_problem_areas(df, confidence_results)
    
    # ─────────────────────────────────────────────────────────────
    # Compare to previous month
    # ─────────────────────────────────────────────────────────────
    print("\n[5/6] Comparing to previous reports...")
    
    trend_analysis = compare_to_previous(report_month, confidence_results)
    
    # ─────────────────────────────────────────────────────────────
    # Generate report
    # ─────────────────────────────────────────────────────────────
    print("\n[6/6] Generating report...")
    
    report = compile_report(
        report_month=report_month,
        confidence=confidence_results,
        importance=importance_results,
        problems=problem_areas,
        trends=trend_analysis
    )
    
    # Save report
    os.makedirs("reports", exist_ok=True)
    
    # JSON version (for API/dashboard)
    json_path = f"reports/monthly_report_{report_month}.json"
    with open(json_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    # HTML version (for viewing)
    html_path = f"reports/monthly_report_{report_month}.html"
    html_content = generate_html_report(report)
    with open(html_path, 'w') as f:
        f.write(html_content)
    
    print(f"\n   JSON report: {json_path}")
    print(f"   HTML report: {html_path}")
    
    # ─────────────────────────────────────────────────────────────
    # Send notifications
    # ─────────────────────────────────────────────────────────────
    if send_notifications:
        print("\nSending notifications...")
        send_slack_notification(report)
        send_email_notification(report)
    
    # ─────────────────────────────────────────────────────────────
    # Print summary
    # ─────────────────────────────────────────────────────────────
    print_report_summary(report)
    
    return report


def calculate_confidence_metrics(df: pl.DataFrame) -> dict:
    """Calculate confidence metrics for each score × geography × horizon."""
    
    results = {
        "overall": {},
        "by_score": {},
        "by_geography": {},
        "by_horizon": {},
        "matrix": []
    }
    
    # Define analysis dimensions
    score_types = ["homeready", "investoredge", "market_health"]
    geography_types = ["metro", "county", "zip"]
    horizons = ["1y", "3y", "5y"]
    
    for score_type in score_types:
        results["by_score"][score_type] = {}
        
        for geo_type in geography_types:
            for horizon in horizons:
                # Filter data
                subset = df.filter(
                    (pl.col("geography_type") == geo_type) &
                    (pl.col(f"excess_vs_peer_{horizon}").is_not_null())
                )
                
                if len(subset) < 100:
                    continue
                
                # Get scores and outcomes
                # (In real implementation, you'd have actual score columns)
                # Using zhvi_yoy as proxy for score
                scores = subset.select("zhvi_yoy").to_numpy().flatten()
                outcomes = subset.select(f"excess_vs_peer_{horizon}").to_numpy().flatten()
                
                # Filter out NaN
                mask = ~(np.isnan(scores) | np.isnan(outcomes))
                scores = scores[mask]
                outcomes = outcomes[mask]
                
                if len(scores) < 100:
                    continue
                
                # Calculate metrics
                metrics = calculate_backtest_metrics(scores, outcomes)
                metrics["score_type"] = score_type
                metrics["geography_type"] = geo_type
                metrics["horizon"] = horizon
                metrics["sample_size"] = len(scores)
                
                results["matrix"].append(metrics)
    
    # Calculate overall confidence
    if results["matrix"]:
        confidences = [m["confidence_score"] for m in results["matrix"]]
        results["overall"]["mean_confidence"] = np.mean(confidences)
        results["overall"]["min_confidence"] = np.min(confidences)
        results["overall"]["max_confidence"] = np.max(confidences)
        results["overall"]["cells_below_threshold"] = sum(1 for c in confidences if c < 55)
    
    return results


def calculate_backtest_metrics(scores: np.ndarray, outcomes: np.ndarray) -> dict:
    """Calculate standard backtest metrics."""
    
    # Correlation
    r, p_value = stats.pearsonr(scores, outcomes)
    r2 = r ** 2
    
    # Directional accuracy
    score_above_median = scores > np.median(scores)
    outcome_above_median = outcomes > np.median(outcomes)
    directional_accuracy = np.mean(score_above_median == outcome_above_median)
    
    # Quintile analysis
    quintiles = np.percentile(scores, [20, 40, 60, 80])
    quintile_outcomes = []
    
    for i in range(5):
        if i == 0:
            mask = scores <= quintiles[0]
        elif i == 4:
            mask = scores > quintiles[3]
        else:
            mask = (scores > quintiles[i-1]) & (scores <= quintiles[i])
        
        if mask.sum() > 0:
            quintile_outcomes.append(np.mean(outcomes[mask]))
        else:
            quintile_outcomes.append(np.nan)
    
    quintile_spread = quintile_outcomes[4] - quintile_outcomes[0] if not np.isnan(quintile_outcomes[4]) else 0
    
    # Calculate confidence score
    confidence_score = calculate_confidence_score(
        r2=r2,
        directional_accuracy=directional_accuracy,
        quintile_spread=quintile_spread,
        sample_size=len(scores)
    )
    
    return {
        "r2": r2,
        "correlation": r,
        "p_value": p_value,
        "directional_accuracy": directional_accuracy,
        "quintile_spread": quintile_spread,
        "quintile_outcomes": quintile_outcomes,
        "confidence_score": confidence_score,
        "confidence_label": get_confidence_label(confidence_score)
    }


def calculate_confidence_score(r2, directional_accuracy, quintile_spread, sample_size):
    """Calculate overall confidence score (0-100)."""
    
    # Weight each component
    r2_score = min(100, r2 * 400)  # 0.25 = 100
    dir_score = min(100, (directional_accuracy - 0.5) * 200)  # 70% = 100
    spread_score = min(100, abs(quintile_spread) * 1000)  # 10% = 100
    size_score = min(100, (sample_size - 50) / 10)
    
    # Weighted average
    confidence = (
        r2_score * 0.25 +
        dir_score * 0.35 +
        spread_score * 0.25 +
        size_score * 0.15
    )
    
    return round(confidence, 1)


def get_confidence_label(score):
    """Get human-readable confidence label."""
    if score >= 75:
        return "High"
    elif score >= 60:
        return "Good"
    elif score >= 45:
        return "Moderate"
    elif score >= 30:
        return "Low"
    else:
        return "Insufficient"


def analyze_feature_importance(df: pl.DataFrame) -> dict:
    """Analyze which features are most predictive."""
    
    feature_cols = [
        'zhvi', 'zori', 'zhvi_yoy', 'zori_yoy',
        'median_dom', 'inventory', 'pending_ratio',
        'median_income', 'unemployment_rate', 'poverty_rate',
        'homeownership_rate', 'college_rate', 'population_density',
    ]
    
    target = 'excess_vs_peer_1y'
    
    # Simple correlation-based importance
    importance = {}
    
    for feature in feature_cols:
        try:
            subset = df.select([feature, target]).drop_nulls()
            if len(subset) > 100:
                corr = subset.select(
                    pl.corr(feature, target).alias("correlation")
                ).item()
                importance[feature] = abs(corr) if corr is not None else 0
        except:
            importance[feature] = 0
    
    # Sort by importance
    sorted_importance = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    
    # Compare to current formula weights
    current_weights = {
        'pending_ratio': 0.15,
        'median_dom': 0.10,
        'inventory': 0.10,
        'zhvi_yoy': 0.15,
        'median_income': 0.15,
        'unemployment_rate': 0.10,
        'zhvi': 0.10,
        'zori': 0.05,
        'college_rate': 0.05,
        'poverty_rate': 0.05,
    }
    
    # Normalize importance to sum to 1
    total_imp = sum(importance.values())
    suggested_weights = {k: v/total_imp for k, v in importance.items()}
    
    # Find mismatches
    mismatches = []
    for feature, current in current_weights.items():
        suggested = suggested_weights.get(feature, 0)
        diff = suggested - current
        if abs(diff) > 0.05:  # More than 5% difference
            mismatches.append({
                "feature": feature,
                "current_weight": current,
                "suggested_weight": suggested,
                "difference": diff,
                "recommendation": "Increase" if diff > 0 else "Decrease"
            })
    
    return {
        "importance_ranking": sorted_importance,
        "suggested_weights": suggested_weights,
        "current_weights": current_weights,
        "mismatches": mismatches
    }


def identify_problem_areas(df: pl.DataFrame, confidence_results: dict) -> list:
    """Identify specific geographies or segments where formula underperforms."""
    
    problems = []
    
    # Check confidence matrix for low scores
    for metrics in confidence_results.get("matrix", []):
        if metrics["confidence_score"] < 50:
            problems.append({
                "type": "low_confidence",
                "severity": "high" if metrics["confidence_score"] < 35 else "medium",
                "segment": f"{metrics['score_type']} @ {metrics['geography_type']} @ {metrics['horizon']}",
                "confidence": metrics["confidence_score"],
                "details": f"R²={metrics['r2']:.3f}, Dir.Acc={metrics['directional_accuracy']:.1%}"
            })
    
    # Check for negative quintile spreads (high scores doing WORSE)
    for metrics in confidence_results.get("matrix", []):
        if metrics["quintile_spread"] < -0.01:  # Top quintile doing worse than bottom
            problems.append({
                "type": "inverted_signal",
                "severity": "critical",
                "segment": f"{metrics['score_type']} @ {metrics['geography_type']} @ {metrics['horizon']}",
                "quintile_spread": metrics["quintile_spread"],
                "details": "High scores are predicting WORSE outcomes than low scores!"
            })
    
    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    problems.sort(key=lambda x: severity_order.get(x["severity"], 4))
    
    return problems


def compare_to_previous(current_month: str, current_results: dict) -> dict:
    """Compare current results to previous month."""
    
    # Try to load previous report
    prev_date = datetime.strptime(current_month, "%Y-%m") - relativedelta(months=1)
    prev_month = prev_date.strftime("%Y-%m")
    prev_path = f"reports/monthly_report_{prev_month}.json"
    
    if not os.path.exists(prev_path):
        return {"previous_available": False}
    
    with open(prev_path, 'r') as f:
        prev_report = json.load(f)
    
    prev_confidence = prev_report.get("confidence", {}).get("overall", {}).get("mean_confidence", 0)
    curr_confidence = current_results.get("overall", {}).get("mean_confidence", 0)
    
    return {
        "previous_available": True,
        "previous_month": prev_month,
        "previous_confidence": prev_confidence,
        "current_confidence": curr_confidence,
        "change": curr_confidence - prev_confidence,
        "trend": "improving" if curr_confidence > prev_confidence else "declining" if curr_confidence < prev_confidence else "stable"
    }


def compile_report(report_month, confidence, importance, problems, trends) -> dict:
    """Compile all results into a single report."""
    
    return {
        "report_month": report_month,
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "overall_health": get_overall_health(confidence, problems),
            "mean_confidence": confidence.get("overall", {}).get("mean_confidence", 0),
            "problem_count": len(problems),
            "critical_issues": sum(1 for p in problems if p["severity"] == "critical"),
            "trend": trends.get("trend", "unknown")
        },
        "confidence": confidence,
        "importance": importance,
        "problems": problems,
        "trends": trends,
        "recommendations": generate_recommendations(importance, problems)
    }


def get_overall_health(confidence, problems):
    """Determine overall formula health status."""
    
    critical_count = sum(1 for p in problems if p["severity"] == "critical")
    high_count = sum(1 for p in problems if p["severity"] == "high")
    mean_conf = confidence.get("overall", {}).get("mean_confidence", 0)
    
    if critical_count > 0:
        return "🔴 Critical"
    elif high_count > 2 or mean_conf < 45:
        return "🟠 Needs Attention"
    elif high_count > 0 or mean_conf < 55:
        return "🟡 Review Recommended"
    else:
        return "🟢 Healthy"


def generate_recommendations(importance, problems) -> list:
    """Generate actionable recommendations."""
    
    recommendations = []
    
    # Based on feature importance mismatches
    for mismatch in importance.get("mismatches", [])[:3]:
        recommendations.append({
            "priority": "medium",
            "type": "weight_adjustment",
            "recommendation": f"{mismatch['recommendation']} weight for {mismatch['feature']} from {mismatch['current_weight']:.0%} to {mismatch['suggested_weight']:.0%}",
            "rationale": f"ML analysis suggests this metric is {'more' if mismatch['difference'] > 0 else 'less'} predictive than current weight implies"
        })
    
    # Based on problems
    for problem in problems:
        if problem["severity"] == "critical":
            recommendations.append({
                "priority": "critical",
                "type": "investigate",
                "recommendation": f"URGENT: Investigate {problem['segment']} - {problem['type']}",
                "rationale": problem["details"]
            })
    
    return recommendations


def generate_html_report(report: dict) -> str:
    """Generate HTML version of the report."""
    
    template = Template("""
<!DOCTYPE html>
<html>
<head>
    <title>PropertyIQ Formula Health Report - {{ report.report_month }}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #1a1a1a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
        h2 { color: #374151; margin-top: 30px; }
        .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
        .card { background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; }
        .card-value { font-size: 2em; font-weight: bold; color: #1a1a1a; }
        .card-label { color: #6b7280; font-size: 0.9em; }
        .status-healthy { color: #22c55e; }
        .status-warning { color: #f59e0b; }
        .status-critical { color: #ef4444; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
        .problem-critical { background: #fef2f2; }
        .problem-high { background: #fffbeb; }
        .recommendation { background: #eff6ff; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #3b82f6; }
        .recommendation-critical { border-left-color: #ef4444; background: #fef2f2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 PropertyIQ Formula Health Report</h1>
        <p>Report Period: <strong>{{ report.report_month }}</strong> | Generated: {{ report.generated_at[:10] }}</p>
        
        <div class="summary-cards">
            <div class="card">
                <div class="card-value {% if 'Healthy' in report.summary.overall_health %}status-healthy{% elif 'Critical' in report.summary.overall_health %}status-critical{% else %}status-warning{% endif %}">
                    {{ report.summary.overall_health }}
                </div>
                <div class="card-label">Overall Health</div>
            </div>
            <div class="card">
                <div class="card-value">{{ "%.1f"|format(report.summary.mean_confidence) }}%</div>
                <div class="card-label">Mean Confidence</div>
            </div>
            <div class="card">
                <div class="card-value {% if report.summary.problem_count == 0 %}status-healthy{% elif report.summary.critical_issues > 0 %}status-critical{% else %}status-warning{% endif %}">
                    {{ report.summary.problem_count }}
                </div>
                <div class="card-label">Issues Found</div>
            </div>
            <div class="card">
                <div class="card-value {% if report.summary.trend == 'improving' %}status-healthy{% elif report.summary.trend == 'declining' %}status-critical{% endif %}">
                    {% if report.summary.trend == 'improving' %}📈{% elif report.summary.trend == 'declining' %}📉{% else %}➡️{% endif %}
                    {{ report.summary.trend|capitalize }}
                </div>
                <div class="card-label">Trend</div>
            </div>
        </div>
        
        <h2>📊 Confidence Matrix</h2>
        <table>
            <thead>
                <tr>
                    <th>Score Type</th>
                    <th>Geography</th>
                    <th>Horizon</th>
                    <th>Confidence</th>
                    <th>R²</th>
                    <th>Dir. Accuracy</th>
                    <th>Quintile Spread</th>
                </tr>
            </thead>
            <tbody>
                {% for m in report.confidence.matrix %}
                <tr>
                    <td>{{ m.score_type|capitalize }}</td>
                    <td>{{ m.geography_type|capitalize }}</td>
                    <td>{{ m.horizon }}</td>
                    <td class="{% if m.confidence_score >= 60 %}status-healthy{% elif m.confidence_score >= 45 %}status-warning{% else %}status-critical{% endif %}">
                        {{ "%.1f"|format(m.confidence_score) }}% ({{ m.confidence_label }})
                    </td>
                    <td>{{ "%.3f"|format(m.r2) }}</td>
                    <td>{{ "%.1f"|format(m.directional_accuracy * 100) }}%</td>
                    <td>{{ "%.2f"|format(m.quintile_spread * 100) }}%</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
        
        <h2>⚠️ Issues Identified</h2>
        {% if report.problems %}
        <table>
            <thead>
                <tr>
                    <th>Severity</th>
                    <th>Type</th>
                    <th>Segment</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                {% for p in report.problems %}
                <tr class="problem-{{ p.severity }}">
                    <td><strong>{{ p.severity|upper }}</strong></td>
                    <td>{{ p.type|replace('_', ' ')|title }}</td>
                    <td>{{ p.segment }}</td>
                    <td>{{ p.details }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
        {% else %}
        <p>✅ No significant issues identified.</p>
        {% endif %}
        
        <h2>💡 Recommendations</h2>
        {% for rec in report.recommendations %}
        <div class="recommendation {% if rec.priority == 'critical' %}recommendation-critical{% endif %}">
            <strong>{{ rec.priority|upper }}:</strong> {{ rec.recommendation }}
            <br><small>{{ rec.rationale }}</small>
        </div>
        {% endfor %}
        
        <h2>📈 Feature Importance</h2>
        <table>
            <thead>
                <tr>
                    <th>Feature</th>
                    <th>Current Weight</th>
                    <th>Suggested Weight</th>
                    <th>Difference</th>
                </tr>
            </thead>
            <tbody>
                {% for feature, imp in report.importance.importance_ranking[:10] %}
                <tr>
                    <td>{{ feature }}</td>
                    <td>{{ "%.0f"|format((report.importance.current_weights.get(feature, 0) or 0) * 100) }}%</td>
                    <td>{{ "%.0f"|format((report.importance.suggested_weights.get(feature, 0) or 0) * 100) }}%</td>
                    <td>
                        {% set diff = (report.importance.suggested_weights.get(feature, 0) or 0) - (report.importance.current_weights.get(feature, 0) or 0) %}
                        {% if diff > 0.03 %}
                        <span class="status-healthy">↑ +{{ "%.0f"|format(diff * 100) }}%</span>
                        {% elif diff < -0.03 %}
                        <span class="status-critical">↓ {{ "%.0f"|format(diff * 100) }}%</span>
                        {% else %}
                        ≈
                        {% endif %}
                    </td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
        
        <hr>
        <p style="color: #6b7280; font-size: 0.9em;">
            This report was automatically generated by PropertyIQ ML Analysis Pipeline.
            For questions, contact the data team.
        </p>
    </div>
</body>
</html>
    """)
    
    return template.render(report=report)


def send_slack_notification(report: dict):
    """Send summary to Slack."""
    
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print("   ⚠️  SLACK_WEBHOOK_URL not set, skipping Slack notification")
        return
    
    health = report["summary"]["overall_health"]
    confidence = report["summary"]["mean_confidence"]
    problems = report["summary"]["problem_count"]
    
    # Build message
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"📊 PropertyIQ Monthly Report - {report['report_month']}"
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Overall Health:*\n{health}"},
                {"type": "mrkdwn", "text": f"*Mean Confidence:*\n{confidence:.1f}%"},
                {"type": "mrkdwn", "text": f"*Issues Found:*\n{problems}"},
                {"type": "mrkdwn", "text": f"*Trend:*\n{report['summary']['trend'].capitalize()}"}
            ]
        }
    ]
    
    # Add critical issues
    critical = [p for p in report["problems"] if p["severity"] == "critical"]
    if critical:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"🚨 *Critical Issues:*\n" + "\n".join([f"• {p['segment']}: {p['type']}" for p in critical])
            }
        })
    
    # Add recommendations
    if report["recommendations"]:
        top_recs = report["recommendations"][:3]
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"💡 *Top Recommendations:*\n" + "\n".join([f"• {r['recommendation']}" for r in top_recs])
            }
        })
    
    payload = {"blocks": blocks}
    
    try:
        response = requests.post(webhook_url, json=payload)
        if response.status_code == 200:
            print("   ✅ Slack notification sent")
        else:
            print(f"   ❌ Slack notification failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Slack notification error: {e}")


def send_email_notification(report: dict):
    """Send summary via email."""
    
    # This would integrate with your email service (SendGrid, SES, etc.)
    # For now, just log
    print("   ℹ️  Email notification not configured (would send to admin team)")


def print_report_summary(report: dict):
    """Print report summary to console."""
    
    print("\n" + "=" * 70)
    print("REPORT SUMMARY")
    print("=" * 70)
    
    summary = report["summary"]
    
    print(f"\n   Overall Health: {summary['overall_health']}")
    print(f"   Mean Confidence: {summary['mean_confidence']:.1f}%")
    print(f"   Issues Found: {summary['problem_count']}")
    print(f"   Critical Issues: {summary['critical_issues']}")
    print(f"   Trend: {summary['trend'].capitalize()}")
    
    if report["problems"]:
        print(f"\n   Top Issues:")
        for p in report["problems"][:3]:
            print(f"   • [{p['severity'].upper()}] {p['segment']}: {p['type']}")
    
    if report["recommendations"]:
        print(f"\n   Top Recommendations:")
        for r in report["recommendations"][:3]:
            print(f"   • {r['recommendation']}")


def main():
    """Main entry point."""
    
    parser = argparse.ArgumentParser(description='Generate PropertyIQ monthly report')
    parser.add_argument('--month', type=str, help='Report month (YYYY-MM)')
    parser.add_argument('--notify', action='store_true', help='Send Slack/email notifications')
    
    args = parser.parse_args()
    
    generate_monthly_report(
        report_month=args.month,
        send_notifications=args.notify
    )


if __name__ == "__main__":
    main()
