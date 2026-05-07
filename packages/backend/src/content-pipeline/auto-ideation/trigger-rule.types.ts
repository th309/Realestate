export type TriggerType = 'score_movement' | 'rank_change' | 'threshold_cross';

export interface ScoreMovementConfig {
  min_delta_points: number;
  direction: 'up' | 'down' | 'both';
  lookback_days: number;
  geography: 'state' | 'metro' | 'county' | 'zip';
}

export interface RankChangeConfig {
  min_rank_delta: number;
  direction: 'up' | 'down' | 'both';
  geography: 'state' | 'metro' | 'county' | 'zip';
  top_n: number;
}

export interface ThresholdCrossConfig {
  threshold_value: number;
  direction: 'up' | 'down';
  metric: 'propertyiq_score';
}

export interface AutoIdeationRule {
  id: string;
  rule_name: string;
  trigger_type: TriggerType;
  trigger_config: ScoreMovementConfig | RankChangeConfig | ThresholdCrossConfig;
  target_format: string;
  approval_mode_override?: 'auto' | 'review' | 'draft';
  enabled: boolean;
  last_fired_at?: string | null;
}

export interface TriggerMatch {
  geo: { geography: string; id: string; canonical_name: string };
  payload: Record<string, unknown>;
}

