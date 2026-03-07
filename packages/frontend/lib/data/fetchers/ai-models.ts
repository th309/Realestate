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
