/**
 * React Query hooks for the admin AI model configuration page.
 * Wraps the @/lib/data fetchers so the page gets caching + invalidation.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAiModelConfigs,
  fetchProviderPresets,
  updateAiModelConfig,
  type AiModelConfig,
  type ProviderPresets,
} from "@/lib/data/fetchers/ai-models";

const AI_MODEL_CONFIG_KEY = ["admin", "ai-model-config"] as const;
const AI_PRESETS_KEY = ["admin", "ai-model-presets"] as const;

export function useAiModelConfigs() {
  return useQuery<AiModelConfig[]>({
    queryKey: AI_MODEL_CONFIG_KEY,
    queryFn: fetchAiModelConfigs,
    staleTime: 0, // admin edits should reflect immediately on refetch
  });
}

export function useProviderPresets() {
  return useQuery<ProviderPresets>({
    queryKey: AI_PRESETS_KEY,
    queryFn: fetchProviderPresets,
    staleTime: 60 * 60 * 1000, // presets change only on deploy
  });
}

export function useUpdateAiModelConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { purpose: string; update: Partial<AiModelConfig> }) =>
      updateAiModelConfig(vars.purpose, vars.update),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AI_MODEL_CONFIG_KEY });
    },
  });
}
