import { GeographyLevel, ScoreType } from './formula-weights';

export interface PredictionRecord {
  geography: GeographyLevel;
  location_id: string;
  location_name: string;
  score_type: ScoreType;
  prediction_date: string;
  predicted_score: number;
  predicted_grade: string;
  predicted_quintile: number;
  price_at_prediction: number | null;
}

export interface PerformanceMetrics {
  geography: string;
  score_type: string;
  validation_period: string;
  metrics: {
    top_quintile_beat_rate: number | null;
    top_quintile_return: number | null;
    bottom_quintile_beat_rate: number | null;
    bottom_quintile_return: number | null;
    spread: number | null;
    predictions_validated: number;
  };
  status: 'healthy' | 'warning' | 'critical';
  formula_version: string;
  last_validated: string | null;
}

export interface AlertResult {
  geography: string;
  score_type: string;
  metric: string;
  current_value: number;
  threshold: number;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

export interface ValidationResult {
  validated: number;
  errors: number;
  predictionDate: string;
}
