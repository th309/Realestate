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

