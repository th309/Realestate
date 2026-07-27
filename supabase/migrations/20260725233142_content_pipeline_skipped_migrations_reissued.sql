-- Re-issue of five backdated migrations silently skipped by the migration runner
-- (versions below ledger max when they landed; out-of-order files are not applied).
-- Applied to the live DB 2026-07-25 as version 20260725233142. Originals:
--   20260424000040_content_pipeline_hook_archetypes.sql
--   20260424000080_content_pipeline_style_ab.sql
--   20260424000100_content_pipeline_auto_ideation_rules.sql
--   20260424000300_content_pipeline_seed_auto_ideation_rules.sql
--   20260427153000_metro_hero_images.sql + 20260427160000_metro_hero_images_option_id.sql
-- Symptom fixed: /admin/content-pipeline dashboard 500 (previewUpcoming threw
-- 'relation auto_ideation_rules does not exist').

CREATE TABLE IF NOT EXISTS hook_archetypes (
  format TEXT PRIMARY KEY REFERENCES format_templates(format),
  active_archetype TEXT NOT NULL,
  active_prompt_append TEXT,
  last_promoted_at TIMESTAMPTZ,
  last_winner_variant TEXT,
  last_winner_confidence NUMERIC,
  last_winner_lift NUMERIC
);

ALTER TABLE hook_archetypes ENABLE ROW LEVEL SECURITY;

-- Content pipeline uses service_role for backend automations.
CREATE POLICY service_role_all ON hook_archetypes FOR ALL USING (true);
GRANT ALL ON hook_archetypes TO service_role;

-- Admin UIs can read promotion state for visibility.
GRANT ALL ON hook_archetypes TO authenticated;

CREATE TABLE IF NOT EXISTS format_style_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  style_reference_id UUID NOT NULL REFERENCES style_references(id) ON DELETE CASCADE,
  weight REAL NOT NULL DEFAULT 1.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (format, style_reference_id)
);

ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS selected_style_binding_id UUID REFERENCES format_style_bindings(id);

ALTER TABLE format_style_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON format_style_bindings FOR ALL USING (true);
GRANT ALL ON format_style_bindings TO service_role;
GRANT ALL ON format_style_bindings TO authenticated;

-- [P5] Auto-ideation rules + capped events + score movement RPC

CREATE TABLE IF NOT EXISTS auto_ideation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('score_movement', 'rank_change', 'threshold_cross')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_format TEXT NOT NULL REFERENCES format_templates(format),
  approval_mode_override TEXT CHECK (approval_mode_override IN ('auto', 'review', 'draft')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_ideation_rules_enabled
  ON auto_ideation_rules (enabled) WHERE enabled = true;

ALTER TABLE auto_ideation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON auto_ideation_rules FOR ALL USING (true);
GRANT ALL ON auto_ideation_rules TO service_role;
GRANT ALL ON auto_ideation_rules TO authenticated;

CREATE TABLE IF NOT EXISTS auto_ideation_capped_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES auto_ideation_rules(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE auto_ideation_capped_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON auto_ideation_capped_events FOR ALL USING (true);
GRANT ALL ON auto_ideation_capped_events TO service_role;

-- RPC: score movement
CREATE OR REPLACE FUNCTION auto_ideation_score_movement(
  p_geography TEXT,
  p_lookback TIMESTAMPTZ,
  p_min_delta NUMERIC,
  p_direction TEXT
)
RETURNS TABLE(
  geo_id TEXT,
  canonical_name TEXT,
  current_score NUMERIC,
  previous_score NUMERIC,
  delta NUMERIC
)
LANGUAGE sql STABLE AS $$
  WITH recent AS (
    SELECT DISTINCT ON (s.location_id)
      s.location_id,
      s.location_name,
      s.score AS score,
      s.score_date
    FROM propertyiq_scores s
    WHERE s.geography = p_geography
      AND s.score_type = 'propertyiq'
      AND s.score_date >= (CURRENT_DATE - INTERVAL '7 days')::date
    ORDER BY s.location_id, s.score_date DESC
  ),
  baseline AS (
    SELECT DISTINCT ON (s.location_id)
      s.location_id,
      s.score AS score
    FROM propertyiq_scores s
    WHERE s.geography = p_geography
      AND s.score_type = 'propertyiq'
      AND s.score_date < (p_lookback::date)
    ORDER BY s.location_id, s.score_date DESC
  )
  SELECT
    r.location_id AS geo_id,
    r.location_name AS canonical_name,
    r.score AS current_score,
    b.score AS previous_score,
    (r.score - b.score) AS delta
  FROM recent r
  JOIN baseline b USING (location_id)
  WHERE
    (p_direction = 'up' AND (r.score - b.score) >= p_min_delta)
    OR (p_direction = 'down' AND (b.score - r.score) >= p_min_delta)
    OR (p_direction = 'both' AND abs(r.score - b.score) >= p_min_delta);
$$;

-- RPC: rank change (within top N)
CREATE OR REPLACE FUNCTION auto_ideation_rank_change(
  p_geography TEXT,
  p_top_n INTEGER,
  p_min_delta INTEGER,
  p_direction TEXT
)
RETURNS TABLE(
  geo_id TEXT,
  canonical_name TEXT,
  current_rank INTEGER,
  previous_rank INTEGER,
  rank_delta INTEGER
)
LANGUAGE sql STABLE AS $$
  WITH ranked_now AS (
    SELECT
      location_id,
      location_name,
      RANK() OVER (ORDER BY score DESC) AS rank
    FROM propertyiq_scores
    WHERE geography = p_geography
      AND score_type = 'propertyiq'
      AND score_date >= (CURRENT_DATE - INTERVAL '7 days')::date
  ),
  ranked_then AS (
    SELECT
      location_id,
      RANK() OVER (ORDER BY score DESC) AS rank
    FROM propertyiq_scores
    WHERE geography = p_geography
      AND score_type = 'propertyiq'
      AND score_date >= (CURRENT_DATE - INTERVAL '37 days')::date
      AND score_date < (CURRENT_DATE - INTERVAL '30 days')::date
  )
  SELECT
    n.location_id AS geo_id,
    n.location_name AS canonical_name,
    n.rank AS current_rank,
    t.rank AS previous_rank,
    (t.rank - n.rank) AS rank_delta
  FROM ranked_now n
  JOIN ranked_then t USING (location_id)
  WHERE n.rank <= p_top_n
    AND (
      (p_direction = 'up' AND (t.rank - n.rank) >= p_min_delta)
      OR (p_direction = 'down' AND (n.rank - t.rank) >= p_min_delta)
      OR (p_direction = 'both' AND abs(t.rank - n.rank) >= p_min_delta)
    );
$$;

-- RPC: threshold cross (metric column on propertyiq_scores)
CREATE OR REPLACE FUNCTION auto_ideation_threshold_cross(
  p_metric TEXT,
  p_threshold NUMERIC,
  p_direction TEXT
)
RETURNS TABLE(
  geo_id TEXT,
  canonical_name TEXT,
  current_value NUMERIC,
  previous_value NUMERIC
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_metric <> 'propertyiq_score' THEN
    RAISE EXCEPTION 'unsupported metric: %', p_metric;
  END IF;
  RETURN QUERY EXECUTE format($q$
    WITH curr AS (
      SELECT DISTINCT ON (location_id)
        location_id,
        location_name,
        score::numeric AS value
      FROM propertyiq_scores
      WHERE score_type = 'propertyiq'
        AND score_date >= (CURRENT_DATE - INTERVAL '7 days')::date
      ORDER BY location_id, score_date DESC
    ),
    prev AS (
      SELECT DISTINCT ON (location_id)
        location_id,
        score::numeric AS value
      FROM propertyiq_scores
      WHERE score_type = 'propertyiq'
        AND score_date < (CURRENT_DATE - INTERVAL '7 days')::date
      ORDER BY location_id, score_date DESC
    )
    SELECT c.location_id AS geo_id, c.location_name AS canonical_name, c.value AS current_value, p.value AS previous_value
    FROM curr c
    JOIN prev p USING (location_id)
    WHERE (
      ($2 = 'up' AND c.value >= $1 AND p.value < $1)
      OR ($2 = 'down' AND c.value <= $1 AND p.value > $1)
    )
  $q$) USING p_threshold, p_direction;
END $$;

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

-- Cached long-form metro skyline images (downloaded once per CBSA, reused on render).
CREATE TABLE IF NOT EXISTS metro_hero_images (
  cbsa_code TEXT PRIMARY KEY,
  storage_path TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metro_hero_images_updated ON metro_hero_images (updated_at DESC);

ALTER TABLE metro_hero_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON metro_hero_images;
CREATE POLICY service_role_all ON metro_hero_images FOR ALL USING (true);
GRANT ALL ON metro_hero_images TO service_role;
GRANT SELECT ON metro_hero_images TO authenticated;
-- Multiple skyline variants per metro (operator picks in admin wizard).
ALTER TABLE metro_hero_images
  ADD COLUMN IF NOT EXISTS option_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE metro_hero_images DROP CONSTRAINT IF EXISTS metro_hero_images_pkey;

ALTER TABLE metro_hero_images
  ADD PRIMARY KEY (cbsa_code, option_id);
