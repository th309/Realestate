-- AI Usage Log Summary Query
-- Run against Supabase SQL Editor after test phases to aggregate results.
--
-- Summarizes cost, speed, and token usage by test run, model, and purpose.

-- ============================================================================
-- 1. Per-test-run summary (main comparison view)
-- ============================================================================
SELECT
  test_run_id,
  model,
  provider,
  COUNT(*) AS total_calls,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful_calls,
  ROUND(SUM(estimated_cost_usd)::numeric, 4) AS total_cost_usd,
  ROUND(AVG(estimated_cost_usd)::numeric, 6) AS avg_cost_per_call,
  ROUND(AVG(duration_ms)::numeric, 0) AS avg_duration_ms,
  SUM(prompt_tokens) AS total_prompt_tokens,
  SUM(completion_tokens) AS total_completion_tokens,
  SUM(total_tokens) AS total_tokens
FROM ai_usage_log
WHERE test_run_id IS NOT NULL
GROUP BY test_run_id, model, provider
ORDER BY test_run_id;

-- ============================================================================
-- 2. Per-model cost comparison (across all test runs)
-- ============================================================================
SELECT
  model,
  provider,
  COUNT(DISTINCT test_run_id) AS test_runs,
  COUNT(*) AS total_calls,
  ROUND(SUM(estimated_cost_usd)::numeric, 4) AS total_cost_usd,
  ROUND(AVG(estimated_cost_usd)::numeric, 6) AS avg_cost_per_call,
  ROUND(AVG(duration_ms)::numeric, 0) AS avg_duration_ms,
  ROUND(AVG(total_tokens)::numeric, 0) AS avg_tokens_per_call
FROM ai_usage_log
WHERE test_run_id IS NOT NULL AND success = true
GROUP BY model, provider
ORDER BY total_cost_usd;

-- ============================================================================
-- 3. Per-purpose breakdown (which purposes cost the most)
-- ============================================================================
SELECT
  purpose,
  model,
  COUNT(*) AS calls,
  ROUND(SUM(estimated_cost_usd)::numeric, 4) AS total_cost_usd,
  ROUND(AVG(estimated_cost_usd)::numeric, 6) AS avg_cost_per_call,
  ROUND(AVG(duration_ms)::numeric, 0) AS avg_duration_ms,
  ROUND(AVG(prompt_tokens)::numeric, 0) AS avg_prompt_tokens,
  ROUND(AVG(completion_tokens)::numeric, 0) AS avg_completion_tokens
FROM ai_usage_log
WHERE test_run_id IS NOT NULL AND success = true
GROUP BY purpose, model
ORDER BY purpose, total_cost_usd;

-- ============================================================================
-- 4. Estimated total cost per report (group by test_run_id = one report)
-- ============================================================================
SELECT
  test_run_id,
  model,
  ROUND(SUM(estimated_cost_usd)::numeric, 4) AS report_total_cost_usd,
  SUM(duration_ms) AS report_total_duration_ms,
  SUM(total_tokens) AS report_total_tokens,
  COUNT(*) AS ai_calls_per_report
FROM ai_usage_log
WHERE test_run_id IS NOT NULL AND success = true
GROUP BY test_run_id, model
ORDER BY report_total_cost_usd;

-- ============================================================================
-- 5. Error rate by model
-- ============================================================================
SELECT
  model,
  COUNT(*) AS total_calls,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS failed_calls,
  ROUND(
    100.0 * SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    1
  ) AS error_rate_pct
FROM ai_usage_log
WHERE test_run_id IS NOT NULL
GROUP BY model
ORDER BY error_rate_pct DESC;
