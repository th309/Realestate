"""
Generate Monthly Report

Produces a comprehensive formula health report with:
1. Overall Health - Healthy/Review/Attention/Critical
2. Confidence Matrix - Score x Geography x Horizon grid
3. Issues Identified - Low confidence cells, inverted signals
4. Recommendations - Weight adjustments, investigation needed
5. Feature Importance - Current vs suggested weights
6. Trend Analysis - Comparison to previous month

Outputs:
- reports/monthly_report_YYYY-MM.json (for API/dashboard)
- reports/monthly_report_YYYY-MM.html (for viewing in browser)

Usage:
    python generate_monthly_report.py                 # Current month
    python generate_monthly_report.py --month 2026-01 # Specific month
    python generate_monthly_report.py --notify        # Send Slack/email
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import Optional
import pandas as pd
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import report_progress, get_output_dir, get_reports_dir


# Health status thresholds
HEALTH_THRESHOLDS = {
    'healthy': 0.7,     # >= 70% correlation
    'review': 0.5,      # >= 50% correlation
    'attention': 0.3,   # >= 30% correlation
    'critical': 0.0,    # < 30% correlation
}

# Score types to analyze
SCORE_TYPES = ['growth', 'stability', 'yield', 'value', 'momentum']

# Geography types
GEO_TYPES = ['zip', 'county', 'metro', 'state']

# Time horizons
HORIZONS = ['1y', '3y', '5y']


def load_data() -> dict:
    """Load all required data for report generation."""
    data_dir = get_output_dir()

    data = {}

    # Load backtest with benchmarks
    backtest_path = os.path.join(data_dir, 'backtest_with_benchmarks.parquet')
    if os.path.exists(backtest_path):
        data['backtest'] = pd.read_parquet(backtest_path)
    else:
        data['backtest'] = None

    # Load feature importance
    importance_files = [f for f in os.listdir(data_dir) if f.startswith('feature_importance_')]
    if importance_files:
        latest = sorted(importance_files)[-1]
        data['feature_importance'] = pd.read_csv(os.path.join(data_dir, latest))
    else:
        data['feature_importance'] = None

    # Load SHAP explanations
    explanation_files = [f for f in os.listdir(data_dir) if f.startswith('explanations_')]
    if explanation_files:
        latest = sorted(explanation_files)[-1]
        with open(os.path.join(data_dir, latest)) as f:
            data['explanations'] = json.load(f)
    else:
        data['explanations'] = None

    return data


def calculate_confidence_matrix(backtest_df: Optional[pd.DataFrame]) -> dict:
    """
    Calculate confidence matrix showing correlation between scores and outcomes.
    """
    report_progress(20, "Calculating confidence matrix...")

    if backtest_df is None:
        return {'error': 'No backtest data available'}

    matrix = {}

    # For each geography type
    for geo_type in GEO_TYPES:
        matrix[geo_type] = {}

        # Filter to geography type (if column exists)
        if 'geography_type' in backtest_df.columns:
            geo_df = backtest_df[backtest_df['geography_type'] == geo_type]
        else:
            geo_df = backtest_df

        if len(geo_df) == 0:
            continue

        # For each horizon
        for horizon in HORIZONS:
            return_col = f'return_{horizon}'
            excess_col = f'composite_excess_{horizon}'

            if return_col not in geo_df.columns:
                continue

            # Calculate correlation with key features
            correlations = {}
            for feature in ['zhvi_yoy', 'pending_ratio', 'median_household_income']:
                if feature in geo_df.columns:
                    valid = geo_df[[feature, return_col]].dropna()
                    if len(valid) > 10:
                        corr = valid[feature].corr(valid[return_col])
                        correlations[feature] = float(corr) if pd.notna(corr) else 0

            matrix[geo_type][horizon] = {
                'sample_size': len(geo_df),
                'correlations': correlations,
                'avg_correlation': np.mean(list(correlations.values())) if correlations else 0
            }

    return matrix


def identify_issues(backtest_df: Optional[pd.DataFrame], confidence_matrix: dict) -> list:
    """
    Identify issues with current formula.
    """
    report_progress(40, "Identifying issues...")

    issues = []

    # Check for low confidence cells
    for geo_type, horizons in confidence_matrix.items():
        if isinstance(horizons, dict) and 'error' not in horizons:
            for horizon, data in horizons.items():
                if isinstance(data, dict) and 'avg_correlation' in data:
                    corr = data['avg_correlation']
                    if corr < HEALTH_THRESHOLDS['review']:
                        issues.append({
                            'type': 'low_confidence',
                            'severity': 'high' if corr < HEALTH_THRESHOLDS['attention'] else 'medium',
                            'geo_type': geo_type,
                            'horizon': horizon,
                            'correlation': corr,
                            'description': f"Low correlation ({corr:.2f}) for {geo_type} at {horizon} horizon"
                        })

    # Check for inverted signals (negative correlation when positive expected)
    if backtest_df is not None:
        for feature in ['zhvi_yoy', 'pending_ratio']:
            if feature in backtest_df.columns and 'return_1y' in backtest_df.columns:
                valid = backtest_df[[feature, 'return_1y']].dropna()
                if len(valid) > 100:
                    corr = valid[feature].corr(valid['return_1y'])
                    if corr < -0.1:  # Inverted signal
                        issues.append({
                            'type': 'inverted_signal',
                            'severity': 'high',
                            'feature': feature,
                            'correlation': float(corr),
                            'description': f"Feature '{feature}' shows inverted signal (corr: {corr:.2f})"
                        })

    return issues


def generate_recommendations(issues: list, feature_importance: Optional[pd.DataFrame]) -> list:
    """
    Generate recommendations based on issues and feature importance.
    """
    report_progress(60, "Generating recommendations...")

    recommendations = []

    # Recommendations from issues
    for issue in issues:
        if issue['type'] == 'low_confidence':
            recommendations.append({
                'priority': 'high' if issue['severity'] == 'high' else 'medium',
                'action': 'investigate',
                'description': f"Investigate formula performance for {issue['geo_type']} at {issue['horizon']} horizon",
                'related_issue': issue
            })
        elif issue['type'] == 'inverted_signal':
            recommendations.append({
                'priority': 'high',
                'action': 'review_weight',
                'description': f"Review weight for '{issue['feature']}' - may need sign change or removal",
                'related_issue': issue
            })

    # Recommendations from feature importance
    if feature_importance is not None:
        for _, row in feature_importance.iterrows():
            if 'recommendation' in row and row['recommendation'] not in ['KEEP', 'IGNORE']:
                recommendations.append({
                    'priority': 'medium',
                    'action': row['recommendation'].lower(),
                    'description': f"{row['recommendation']} weight for '{row['feature']}' "
                                   f"(current: {row['current_weight']:.2f}, suggested: {row['suggested_weight']:.2f})",
                    'feature': row['feature']
                })

    return recommendations


def calculate_overall_health(confidence_matrix: dict, issues: list) -> dict:
    """
    Calculate overall health status.
    """
    report_progress(75, "Calculating overall health...")

    # Get average correlation across all cells
    correlations = []
    for geo_type, horizons in confidence_matrix.items():
        if isinstance(horizons, dict) and 'error' not in horizons:
            for horizon, data in horizons.items():
                if isinstance(data, dict) and 'avg_correlation' in data:
                    correlations.append(data['avg_correlation'])

    avg_correlation = np.mean(correlations) if correlations else 0

    # Count high severity issues
    high_severity_count = sum(1 for i in issues if i.get('severity') == 'high')

    # Determine status
    if avg_correlation >= HEALTH_THRESHOLDS['healthy'] and high_severity_count == 0:
        status = 'healthy'
        icon = '🟢'
        message = "Formula is performing well across all dimensions"
    elif avg_correlation >= HEALTH_THRESHOLDS['review'] and high_severity_count <= 2:
        status = 'review'
        icon = '🟡'
        message = "Some areas need attention but overall performance is acceptable"
    elif avg_correlation >= HEALTH_THRESHOLDS['attention']:
        status = 'attention'
        icon = '🟠'
        message = "Multiple areas need attention - recommend investigation"
    else:
        status = 'critical'
        icon = '🔴'
        message = "Formula performance is degraded - immediate action recommended"

    return {
        'status': status,
        'icon': icon,
        'message': message,
        'avg_correlation': avg_correlation,
        'high_severity_issues': high_severity_count,
        'total_issues': len(issues)
    }


def generate_html_report(report_data: dict, month: str) -> str:
    """
    Generate HTML version of the report.
    """
    health = report_data['overall_health']
    matrix = report_data['confidence_matrix']
    issues = report_data['issues']
    recommendations = report_data['recommendations']

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PropertyIQ Formula Health Report - {month}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .card {{ background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        h1 {{ font-size: 24px; margin-bottom: 8px; }}
        h2 {{ font-size: 18px; margin-bottom: 16px; color: #333; }}
        .health-status {{ display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 8px; margin-bottom: 16px; }}
        .health-healthy {{ background: #dcfce7; }}
        .health-review {{ background: #fef9c3; }}
        .health-attention {{ background: #fed7aa; }}
        .health-critical {{ background: #fecaca; }}
        .health-icon {{ font-size: 32px; }}
        .health-text {{ flex: 1; }}
        .health-title {{ font-weight: 600; font-size: 18px; }}
        .health-message {{ color: #666; font-size: 14px; }}
        .matrix-table {{ width: 100%; border-collapse: collapse; }}
        .matrix-table th, .matrix-table td {{ padding: 12px; text-align: center; border: 1px solid #e5e7eb; }}
        .matrix-table th {{ background: #f9fafb; font-weight: 500; }}
        .corr-high {{ background: #dcfce7; color: #166534; }}
        .corr-medium {{ background: #fef9c3; color: #854d0e; }}
        .corr-low {{ background: #fecaca; color: #991b1b; }}
        .issue {{ padding: 12px; border-radius: 8px; margin-bottom: 8px; }}
        .issue-high {{ background: #fecaca; }}
        .issue-medium {{ background: #fef9c3; }}
        .recommendation {{ padding: 12px; border-left: 3px solid #3b82f6; background: #eff6ff; margin-bottom: 8px; }}
        .timestamp {{ color: #666; font-size: 12px; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>PropertyIQ Formula Health Report</h1>
            <p style="color: #666;">Month: {month}</p>
        </div>

        <div class="card">
            <h2>Overall Health</h2>
            <div class="health-status health-{health['status']}">
                <span class="health-icon">{health['icon']}</span>
                <div class="health-text">
                    <div class="health-title">{health['status'].upper()}</div>
                    <div class="health-message">{health['message']}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px;">
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: 600;">{health['avg_correlation']:.2f}</div>
                    <div style="color: #666; font-size: 12px;">Avg Correlation</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: 600;">{health['total_issues']}</div>
                    <div style="color: #666; font-size: 12px;">Issues Found</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: 600;">{health['high_severity_issues']}</div>
                    <div style="color: #666; font-size: 12px;">High Severity</div>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>Confidence Matrix</h2>
            <table class="matrix-table">
                <tr>
                    <th>Geography</th>
                    <th>1-Year</th>
                    <th>3-Year</th>
                    <th>5-Year</th>
                </tr>
"""

    for geo_type in GEO_TYPES:
        html += f"                <tr><td><strong>{geo_type.title()}</strong></td>"
        for horizon in HORIZONS:
            data = matrix.get(geo_type, {}).get(horizon, {})
            corr = data.get('avg_correlation', 0) if isinstance(data, dict) else 0
            css_class = 'corr-high' if corr >= 0.5 else 'corr-medium' if corr >= 0.3 else 'corr-low'
            html += f"<td class='{css_class}'>{corr:.2f}</td>"
        html += "</tr>\n"

    html += """            </table>
        </div>

        <div class="card">
            <h2>Issues Identified</h2>
"""

    if issues:
        for issue in issues:
            css_class = 'issue-high' if issue.get('severity') == 'high' else 'issue-medium'
            html += f"""            <div class="issue {css_class}">
                <strong>{issue['type'].replace('_', ' ').title()}</strong>: {issue['description']}
            </div>
"""
    else:
        html += "            <p style='color: #666;'>No issues identified</p>\n"

    html += """        </div>

        <div class="card">
            <h2>Recommendations</h2>
"""

    if recommendations:
        for rec in recommendations:
            html += f"""            <div class="recommendation">
                <strong>{rec['action'].replace('_', ' ').title()}</strong>: {rec['description']}
            </div>
"""
    else:
        html += "            <p style='color: #666;'>No recommendations at this time</p>\n"

    html += f"""        </div>

        <p class="timestamp">Generated: {report_data['generated_at']}</p>
    </div>
</body>
</html>
"""

    return html


def send_notifications(report_data: dict, notify_slack: bool = True, notify_email: bool = False):
    """
    Send notifications via Slack and/or email.
    """
    report_progress(90, "Sending notifications...")

    health = report_data['overall_health']

    # Slack notification
    if notify_slack:
        webhook_url = os.getenv('SLACK_WEBHOOK_URL')
        if webhook_url:
            import requests

            message = {
                "text": f"{health['icon']} PropertyIQ Formula Health: {health['status'].upper()}",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f"{health['icon']} PropertyIQ Monthly Report"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Status:* {health['status'].upper()}\n*Message:* {health['message']}\n"
                                    f"*Issues:* {health['total_issues']} ({health['high_severity_issues']} high severity)"
                        }
                    }
                ]
            }

            try:
                requests.post(webhook_url, json=message)
                print("  Slack notification sent")
            except Exception as e:
                print(f"  Failed to send Slack notification: {e}")
        else:
            print("  SLACK_WEBHOOK_URL not set, skipping Slack notification")


def main():
    """Main report generation."""
    parser = argparse.ArgumentParser(description='Generate monthly formula health report')
    parser.add_argument('--month', type=str, default=None,
                        help='Month to report on (YYYY-MM format)')
    parser.add_argument('--notify', action='store_true',
                        help='Send notifications (Slack/email)')
    args = parser.parse_args()

    # Determine month
    if args.month:
        month = args.month
    else:
        month = datetime.now().strftime('%Y-%m')

    print("=" * 60)
    print("PropertyIQ ML - Monthly Report Generation")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Report month: {month}")
    print("=" * 60)

    report_progress(0, "Loading data...")

    # Load data
    data = load_data()

    # Calculate confidence matrix
    confidence_matrix = calculate_confidence_matrix(data['backtest'])

    # Identify issues
    issues = identify_issues(data['backtest'], confidence_matrix)

    # Generate recommendations
    recommendations = generate_recommendations(issues, data['feature_importance'])

    # Calculate overall health
    overall_health = calculate_overall_health(confidence_matrix, issues)

    # Compile report
    report_data = {
        'month': month,
        'generated_at': datetime.now().isoformat(),
        'overall_health': overall_health,
        'confidence_matrix': confidence_matrix,
        'issues': issues,
        'recommendations': recommendations,
        'feature_importance': data['feature_importance'].to_dict('records') if data['feature_importance'] is not None else None,
    }

    report_progress(80, "Saving reports...")

    # Ensure reports directory exists
    reports_dir = get_reports_dir()
    os.makedirs(reports_dir, exist_ok=True)

    # Save JSON report
    json_path = os.path.join(reports_dir, f'monthly_report_{month}.json')
    with open(json_path, 'w') as f:
        json.dump(report_data, f, indent=2, default=str)
    print(f"  Saved: {json_path}")

    # Generate and save HTML report
    html_content = generate_html_report(report_data, month)
    html_path = os.path.join(reports_dir, f'monthly_report_{month}.html')
    with open(html_path, 'w') as f:
        f.write(html_content)
    print(f"  Saved: {html_path}")

    # Send notifications if requested
    if args.notify:
        send_notifications(report_data)

    report_progress(100, "Complete!")

    print("\n" + "=" * 60)
    print(f"Report Summary for {month}")
    print("=" * 60)
    print(f"  {overall_health['icon']} Status: {overall_health['status'].upper()}")
    print(f"  Message: {overall_health['message']}")
    print(f"  Average correlation: {overall_health['avg_correlation']:.2f}")
    print(f"  Issues found: {overall_health['total_issues']}")
    print(f"  High severity: {overall_health['high_severity_issues']}")
    print(f"\n  View report: file://{os.path.abspath(html_path)}")
    print("=" * 60)


if __name__ == '__main__':
    main()
