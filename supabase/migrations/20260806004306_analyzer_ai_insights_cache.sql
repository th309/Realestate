-- ---------------------------------------------------------------------------
-- analyzer_ai_insights — durable store for analyzer AI narratives.
--
-- Redis (24h TTL) was the only layer holding these. Three ways that lost work
-- that was still perfectly valid:
--   1. TTL expiry — the narrative is only invalid once the DEAL or the PIQ
--      SCORES change, and scores move monthly. A 24h TTL threw away ~29 days
--      of still-correct output and re-billed the LLM for it.
--   2. Redis eviction / restart — maxmemory pressure silently drops entries.
--   3. Redis absent entirely (local dev, REDIS_URL unset) — RedisService
--      degrades to `getClient() === null`, so AiInsightsCache.get() returned a
--      cache miss on EVERY request and every page load hit the provider.
--
-- Redis stays as the hot path; this table is the durable one. Read order is
-- redis -> postgres -> LLM; writes go to both.
--
-- Invalidation is by KEY, not by time. `cache_key` already fingerprints the
-- full deal input, strategy, goal, grading, projection and the PIQ scores by
-- geography (see AiInsightsCache.computeKey + analyzer-core
-- buildAiInsightsFingerprint), so a monthly rescore or any input edit yields a
-- different key and the stale row simply stops being read. Rows are pruned by
-- age/prompt-revision rather than expired.
--
-- NOTE ON `piq_by_geo`: the original sketch for this table carried a
-- `score_period date` column. MarketContextDto carries no period date — the
-- analyzer never receives one — so populating it would have meant either an
-- extra query per write or a fabricated value. The PIQ scores themselves are
-- the score-update signal and they are already inside `cache_key`, so the raw
-- score snapshot is stored instead. Pruning "everything written before the
-- last rescore" is `created_at < <rescore date>`, which needs no extra column.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS analyzer_ai_insights (
  cache_key        text PRIMARY KEY,
  prompt_revision  text        NOT NULL,
  section_id       text        NOT NULL,
  strategy         text,
  goal             text,
  -- { text, threadId, citedFacts } — the CachedInsight shape, stored verbatim
  -- so the Redis and Postgres layers deserialize identically.
  payload          jsonb       NOT NULL,
  -- PIQ scores the narrative was written against. Audit trail for "why does
  -- this deal read differently than last month".
  piq_by_geo       jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE analyzer_ai_insights IS
  'Durable cache of analyzer AI narratives. Keyed by the same composite fingerprint as the Redis layer; invalidated by key change (deal edit or monthly rescore), not by TTL.';
COMMENT ON COLUMN analyzer_ai_insights.cache_key IS
  'AiInsightsCache.computeKey() output. Encodes prompt revision, section, strategy, goal, projection, rentcast AVM, PIQ scores and the full deal fingerprint.';
COMMENT ON COLUMN analyzer_ai_insights.section_id IS
  'batch | header_verdict | recommendation_analysis | projection | expense_waterfall | sensitivity | comps | market_context | after_tax';
COMMENT ON COLUMN analyzer_ai_insights.last_accessed_at IS
  'Bumped on every cache hit. Drives LRU pruning so cold deals age out before hot ones.';

-- Prune by prompt revision: a PROMPT_REVISION bump orphans every prior row at
-- once, and those are dead weight the moment the new revision ships.
CREATE INDEX IF NOT EXISTS analyzer_ai_insights_prompt_revision_idx
  ON analyzer_ai_insights (prompt_revision);

-- LRU pruning.
CREATE INDEX IF NOT EXISTS analyzer_ai_insights_last_accessed_idx
  ON analyzer_ai_insights (last_accessed_at);

-- ---------------------------------------------------------------------------
-- Access. This table is written and read exclusively by the backend through
-- the service-role client (AiInsightsStore). No browser ever touches it, so
-- RLS is on with no permissive policy and only service_role is granted —
-- `authenticated` deliberately gets nothing.
-- ---------------------------------------------------------------------------
ALTER TABLE analyzer_ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analyzer_ai_insights_service_role_all ON analyzer_ai_insights;
CREATE POLICY analyzer_ai_insights_service_role_all
  ON analyzer_ai_insights FOR ALL USING (true);

GRANT ALL ON analyzer_ai_insights TO service_role;

-- ---------------------------------------------------------------------------
-- prune_analyzer_ai_insights — housekeeping.
--
-- Drops (a) every row from a superseded prompt revision and (b) rows not read
-- in `p_stale_days`. Safe to run any time: a pruned row is a cache miss, not
-- data loss.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prune_analyzer_ai_insights(
  p_current_revision text,
  p_stale_days       integer DEFAULT 90
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM analyzer_ai_insights
     WHERE prompt_revision IS DISTINCT FROM p_current_revision
        OR last_accessed_at < now() - make_interval(days => p_stale_days)
    RETURNING 1
  )
  SELECT COALESCE(count(*), 0)::integer FROM deleted;
$$;

COMMENT ON FUNCTION prune_analyzer_ai_insights(text, integer) IS
  'Delete analyzer AI insight rows from superseded prompt revisions or untouched for p_stale_days. Returns the row count removed.';

REVOKE EXECUTE ON FUNCTION prune_analyzer_ai_insights(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prune_analyzer_ai_insights(text, integer) TO service_role;
