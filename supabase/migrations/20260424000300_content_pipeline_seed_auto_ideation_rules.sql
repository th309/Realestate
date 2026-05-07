-- [P5] Seed starter auto-ideation rules (disabled by default)

INSERT INTO auto_ideation_rules (
  rule_name,
  trigger_type,
  trigger_config,
  target_format,
  approval_mode_override,
  enabled
)
VALUES
  (
    'PIQ moved +10 or more (month-over-month)',
    'score_movement',
    '{"min_delta_points": 10, "direction": "up", "lookback_days": 30, "geography": "metro"}'::jsonb,
    'score_mover',
    'review',
    false
  ),
  (
    'New market entered top 10 cashflow',
    'rank_change',
    '{"min_rank_delta": 1, "direction": "up", "geography": "metro", "top_n": 10}'::jsonb,
    'top_10_ranking',
    'review',
    false
  ),
  (
    'PIQ crossed 80 threshold',
    'threshold_cross',
    '{"threshold_value": 80, "direction": "up", "metric": "propertyiq_score"}'::jsonb,
    'grade_reveal',
    'review',
    false
  )
ON CONFLICT (rule_name) DO NOTHING;

