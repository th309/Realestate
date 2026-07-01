/**
 * Guarded completion orchestration.
 *
 * Wraps a single completion execution with the two cost controls so the
 * AiProviderService methods stay thin:
 *   1. Spend backstop — refuse new spend once the daily cap is hit.
 *   2. Short-TTL cache — reuse the answer for an identical request instead of
 *      re-billing the provider (kills repeated identical regenerations).
 *
 * Only successful, non-empty completions are cached. Cache hits skip the
 * executor entirely (no provider call, no spend).
 */

import type { AiCompletionCache } from './ai-completion-cache';
import type { AiSpendGuard } from './ai-spend-guard';
import type { AiCompletionResponse } from './ai-provider.types';

/** Parse a numeric env var, falling back to a default when unset/invalid. */
export function envNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export interface GuardedCompletionDeps {
  purpose: string;
  model: string;
  /** Cache key for this request, or null to bypass the cache entirely. */
  cacheKey: string | null;
  cache: AiCompletionCache<AiCompletionResponse>;
  spendGuard: AiSpendGuard;
  logger: { log: (message: string) => void };
  /** Performs the actual provider call (executeCompletion). */
  execute: () => Promise<AiCompletionResponse>;
}

export async function runGuardedCompletion(
  deps: GuardedCompletionDeps,
): Promise<{ response: AiCompletionResponse; fromCache: boolean }> {
  // 1. Backstop — throws AiSpendCapExceededError once the daily cap is reached.
  deps.spendGuard.assertUnderCap();

  // 2. Cache lookup.
  if (deps.cacheKey) {
    const cached = deps.cache.get(deps.cacheKey);
    if (cached) {
      deps.logger.log(`[${deps.purpose}] served from completion cache`);
      return { response: cached, fromCache: true };
    }
  }

  const response = await deps.execute();

  // 3. Meter spend (in-memory, independent of the fire-and-forget DB logger).
  deps.spendGuard.record(
    deps.model,
    response.usage?.promptTokens,
    response.usage?.completionTokens,
  );

  // 4. Cache only successful, non-empty answers.
  if (deps.cacheKey && response.content && response.content.trim().length > 0) {
    deps.cache.set(deps.cacheKey, response);
  }

  return { response, fromCache: false };
}
