/**
 * AI MODEL CONFIGURATION FETCHERS
 *
 * API functions for managing AI model configurations used in report generation.
 * Each "purpose" (e.g., narrative, research, scoring) can be mapped to a
 * specific provider/model combination.
 */

import { fetchAPIRaw } from "./base";
import { getAuthHeaders } from "./auth-headers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiModelConfig {
  id: string;
  purpose: string;
  label: string;
  provider: string;
  model: string;
  base_url: string | null;
  temperature: number;
  max_tokens_override: number | null;
  is_active: boolean;
  notes: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch all AI model configurations.
 */
export async function fetchAiModelConfigs(): Promise<AiModelConfig[]> {
  const res = await fetchAPIRaw("/api/admin/ai-models");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[AI Models] Failed to fetch configs: ${res.status} ${res.statusText}`,
      body,
    );
    return [];
  }
  const data = await res.json();
  return data.data || data || [];
}

/**
 * Update an AI model configuration by purpose key.
 */
export async function updateAiModelConfig(
  purpose: string,
  update: Partial<AiModelConfig>,
): Promise<AiModelConfig | null> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(`/api/admin/ai-models/${purpose}`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data || data;
}

/**
 * Get the active test run ID for AI usage logging.
 */
export async function fetchTestRunId(): Promise<string | null> {
  const res = await fetchAPIRaw("/api/admin/ai-models/test-run-id");
  if (!res.ok) return null;
  const data = await res.json();
  return data.testRunId || null;
}

/**
 * Set or clear the active test run ID for AI usage logging.
 */
export async function setTestRunId(
  testRunId: string | null,
): Promise<string | null> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/admin/ai-models/test-run-id", {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ testRunId }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.testRunId || null;
}

/**
 * Fetch provider presets (default models per provider).
 */
export async function fetchProviderPresets(): Promise<
  Record<string, { defaultModel: string; models: string[] }>
> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/admin/ai-models/presets", {
    headers: authHeaders,
  });
  if (!res.ok) return {};
  const data = await res.json();
  return data.data || data || {};
}

// ---------------------------------------------------------------------------
// Evaluation Dashboard
// ---------------------------------------------------------------------------

export interface UsageSummary {
  test_run_id: string;
  model: string;
  provider: string;
  total_calls: number;
  successful_calls: number;
  total_cost_usd: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  first_call: string;
}

export interface EvaluationScore {
  id: string;
  test_run_id: string;
  model: string;
  provider: string;
  report_type: string | null;
  geography: string | null;
  depth_score: number | null;
  accuracy_score: number | null;
  writing_score: number | null;
  actionability_score: number | null;
  notes: string | null;
  report_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchUsageSummary(): Promise<UsageSummary[]> {
  const res = await fetchAPIRaw("/api/admin/ai-models/usage-summary");
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || data || [];
}

export async function fetchEvaluationScores(): Promise<EvaluationScore[]> {
  const res = await fetchAPIRaw("/api/admin/ai-models/evaluation-scores");
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || data || [];
}

export async function upsertEvaluationScore(
  score: Omit<EvaluationScore, "id" | "created_at" | "updated_at">,
): Promise<EvaluationScore | null> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/admin/ai-models/evaluation-scores", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(score),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data || data;
}

export async function deleteEvaluationScore(
  testRunId: string,
): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(
    `/api/admin/ai-models/evaluation-scores/${encodeURIComponent(testRunId)}`,
    { method: "DELETE", headers: authHeaders },
  );
  return res.ok;
}

/**
 * Clear all test usage logs and evaluation scores for a fresh rerun.
 */
export async function clearAllTestData(): Promise<boolean> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/admin/ai-models/test-data", {
    method: "DELETE",
    headers: authHeaders,
  });
  return res.ok;
}
