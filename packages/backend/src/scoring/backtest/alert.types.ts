/**
 * Alert Types
 *
 * Shared types and thresholds for confidence alerting.
 */

import type { ScoreType, GeographyType } from '../scoring.types';

export interface Alert {
  id: string;
  confidenceId: string | null;
  scoreType: ScoreType;
  geographyType: GeographyType;
  formulaVersion: string;
  alertType: 'threshold' | 'degradation' | 'anomaly';
  severity: 'warning' | 'critical';
  previousConfidence: number | null;
  currentConfidence: number;
  thresholdCrossed: number;
  diagnosticSignals: DiagnosticSignal[];
  recommendedActions: string[];
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface DiagnosticSignal {
  name: string;
  description: string;
  value: number | string;
  severity: 'info' | 'warning' | 'critical';
}

// Alert thresholds
export const ALERT_THRESHOLDS = {
  WARNING: 55, // Below this triggers warning
  CRITICAL: 40, // Below this triggers critical
  DEGRADATION_THRESHOLD: 10, // % drop to trigger degradation alert
};
