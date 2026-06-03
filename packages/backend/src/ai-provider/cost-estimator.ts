/**
 * Cost estimation in USD from token counts and MODEL_PRICING constants.
 * Shared by ai-usage-logger and ai-shadow.service so the two cost ledgers
 * stay consistent.
 */

import { MODEL_PRICING } from './ai-provider.types';

export function estimateCostUsd(
  model: string,
  promptTokens?: number,
  completionTokens?: number,
): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing || promptTokens == null || completionTokens == null) return null;

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}
