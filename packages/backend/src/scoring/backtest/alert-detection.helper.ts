/**
 * Alert Detection Helpers
 *
 * Pure detection logic for confidence alerts: threshold crossing,
 * degradation, anomalies, and the diagnostic/recommendation signals
 * that accompany a generated alert. No I/O — operates purely on
 * confidence scores.
 */

import type { ConfidenceScore } from './confidence-calculator.service';
import type { Alert, DiagnosticSignal } from './alert.types';
import { ALERT_THRESHOLDS } from './alert.types';

export function checkThresholdCrossing(
  newConfidence: ConfidenceScore,
  previousConfidence: ConfidenceScore | null,
): Omit<Alert, 'id' | 'createdAt'> | null {
  const prevScore = previousConfidence?.confidenceScore ?? 100;
  const newScore = newConfidence.confidenceScore;

  // Check critical threshold
  if (
    newScore < ALERT_THRESHOLDS.CRITICAL &&
    prevScore >= ALERT_THRESHOLDS.CRITICAL
  ) {
    return buildAlert(
      newConfidence,
      previousConfidence,
      'threshold',
      'critical',
      ALERT_THRESHOLDS.CRITICAL,
    );
  }

  // Check warning threshold
  if (
    newScore < ALERT_THRESHOLDS.WARNING &&
    prevScore >= ALERT_THRESHOLDS.WARNING
  ) {
    return buildAlert(
      newConfidence,
      previousConfidence,
      'threshold',
      'warning',
      ALERT_THRESHOLDS.WARNING,
    );
  }

  return null;
}

export function checkDegradation(
  newConfidence: ConfidenceScore,
  previousConfidence: ConfidenceScore | null,
): Omit<Alert, 'id' | 'createdAt'> | null {
  if (!previousConfidence) return null;

  const drop =
    previousConfidence.confidenceScore - newConfidence.confidenceScore;

  if (drop >= ALERT_THRESHOLDS.DEGRADATION_THRESHOLD) {
    const severity = drop >= 20 ? 'critical' : 'warning';
    return buildAlert(
      newConfidence,
      previousConfidence,
      'degradation',
      severity,
      previousConfidence.confidenceScore -
        ALERT_THRESHOLDS.DEGRADATION_THRESHOLD,
    );
  }

  return null;
}

export function checkAnomalies(
  newConfidence: ConfidenceScore,
): Omit<Alert, 'id' | 'createdAt'> | null {
  const anomalies: DiagnosticSignal[] = [];

  // Check for very low R²
  if (newConfidence.rSquared !== null && newConfidence.rSquared < 0.1) {
    anomalies.push({
      name: 'Low Correlation',
      description: 'Score has very weak correlation with outcomes',
      value: newConfidence.rSquared,
      severity: 'critical',
    });
  }

  // Check for low sample count
  if (newConfidence.sampleCount < 10) {
    anomalies.push({
      name: 'Insufficient Samples',
      description: 'Not enough data points to establish confidence',
      value: newConfidence.sampleCount,
      severity: 'warning',
    });
  }

  if (anomalies.length > 0) {
    const severity = anomalies.some((a) => a.severity === 'critical')
      ? 'critical'
      : 'warning';

    return {
      confidenceId: null,
      scoreType: newConfidence.scoreType,
      geographyType: newConfidence.geographyType,
      formulaVersion: newConfidence.formulaVersion,
      alertType: 'anomaly',
      severity,
      previousConfidence: null,
      currentConfidence: newConfidence.confidenceScore,
      thresholdCrossed: 0,
      diagnosticSignals: anomalies,
      recommendedActions: generateRecommendations('anomaly', anomalies),
      status: 'open',
    };
  }

  return null;
}

export function buildAlert(
  newConfidence: ConfidenceScore,
  previousConfidence: ConfidenceScore | null,
  alertType: 'threshold' | 'degradation' | 'anomaly',
  severity: 'warning' | 'critical',
  threshold: number,
): Omit<Alert, 'id' | 'createdAt'> {
  const diagnostics = generateDiagnostics(newConfidence, previousConfidence);
  const recommendations = generateRecommendations(alertType, diagnostics);

  return {
    confidenceId: null,
    scoreType: newConfidence.scoreType,
    geographyType: newConfidence.geographyType,
    formulaVersion: newConfidence.formulaVersion,
    alertType,
    severity,
    previousConfidence: previousConfidence?.confidenceScore ?? null,
    currentConfidence: newConfidence.confidenceScore,
    thresholdCrossed: threshold,
    diagnosticSignals: diagnostics,
    recommendedActions: recommendations,
    status: 'open',
  };
}

export function generateDiagnostics(
  newConfidence: ConfidenceScore,
  previousConfidence: ConfidenceScore | null,
): DiagnosticSignal[] {
  const signals: DiagnosticSignal[] = [];

  // Correlation analysis
  if (newConfidence.correlationScore < 50) {
    signals.push({
      name: 'Correlation Drop',
      description: 'Score correlation with outcomes is below expected',
      value: `${newConfidence.correlationScore.toFixed(1)}%`,
      severity: newConfidence.correlationScore < 30 ? 'critical' : 'warning',
    });
  }

  // Sample size analysis
  if (newConfidence.sampleSizeScore < 50) {
    signals.push({
      name: 'Sample Size',
      description: 'Insufficient sample size for reliable confidence',
      value: newConfidence.sampleCount,
      severity: 'warning',
    });
  }

  // Recency analysis
  if (newConfidence.recencyScore < 50) {
    signals.push({
      name: 'Data Staleness',
      description: 'Backtest data is becoming outdated',
      value: `${newConfidence.recencyScore.toFixed(1)}%`,
      severity: newConfidence.recencyScore < 25 ? 'critical' : 'warning',
    });
  }

  // R² analysis
  if (newConfidence.rSquared !== null) {
    if (newConfidence.rSquared < 0.2) {
      signals.push({
        name: 'R² Value',
        description: 'Very weak predictive power',
        value: newConfidence.rSquared.toFixed(4),
        severity: 'critical',
      });
    } else if (newConfidence.rSquared < 0.3) {
      signals.push({
        name: 'R² Value',
        description: 'Weak predictive power',
        value: newConfidence.rSquared.toFixed(4),
        severity: 'warning',
      });
    }
  }

  return signals;
}

export function generateRecommendations(
  alertType: string,
  diagnostics: DiagnosticSignal[],
): string[] {
  const recommendations: string[] = [];

  if (alertType === 'threshold' || alertType === 'degradation') {
    recommendations.push('Review recent formula changes');
    recommendations.push('Check for data quality issues in source metrics');
    recommendations.push('Consider running additional backtests');
  }

  for (const signal of diagnostics) {
    if (signal.name === 'Correlation Drop') {
      recommendations.push('Review metric weights and normalization');
      recommendations.push('Investigate if market conditions have changed');
    }
    if (signal.name === 'Sample Size') {
      recommendations.push('Wait for more data to accumulate');
      recommendations.push('Consider broadening geography scope');
    }
    if (signal.name === 'Data Staleness') {
      recommendations.push('Run fresh backtest with recent data');
    }
  }

  // Deduplicate
  return [...new Set(recommendations)];
}
