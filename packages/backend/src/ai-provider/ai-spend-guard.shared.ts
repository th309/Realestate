/**
 * Shared (process-wide) AI spend guard.
 *
 * A single AiSpendGuard instance shared across the whole backend so that EVERY
 * AI call — whether it goes through AiProviderService or through a direct
 * provider client (content-pipeline, market-intelligence briefings/news,
 * ai-shadow, admin analytics, research-brief, Anthropic) — meters against ONE
 * daily-spend ledger and honors ONE cap. This closes the gap where direct
 * clients bypassed the per-service guard.
 *
 * Implemented as a module singleton (not a Nest provider) so any file can guard
 * its calls with a plain import — no DI-graph wiring, no module-boundary risk.
 * Config is read from process.env (Railway/`.env`); the cap defaults to $25/day
 * and 0 disables it. Mirrors the defaults in AiProviderService.
 */

import { Logger } from '@nestjs/common';
import { AiSpendGuard } from './ai-spend-guard';

const logger = new Logger('AiSpendGuard');
let shared: AiSpendGuard | null = null;

export function getSharedSpendGuard(): AiSpendGuard {
  if (!shared) {
    const parsed = Number(process.env.AI_DAILY_SPEND_CAP_USD);
    shared = new AiSpendGuard({
      dailyCapUsd: Number.isFinite(parsed) ? parsed : 25,
      warn: (m) => logger.warn(m),
    });
  }
  return shared;
}

/** Reset the singleton. TEST-ONLY — do not call from production code. */
export function __resetSharedSpendGuardForTests(): void {
  shared = null;
}

/**
 * Assert the shared daily budget before dispatching an AI call. Use directly for
 * streaming / audio calls whose token usage cannot be metered up front.
 */
export function assertAiBudget(): void {
  getSharedSpendGuard().assertUnderCap();
}

/** Record token usage against the shared budget (manual/streaming metering). */
export function recordAiUsage(
  model: string,
  promptTokens?: number | null,
  completionTokens?: number | null,
): void {
  getSharedSpendGuard().record(
    model,
    promptTokens ?? undefined,
    completionTokens ?? undefined,
  );
}

/**
 * Guard a non-streaming OpenAI-compatible chat completion: assert budget, run
 * the call, then record its usage. Wrap any `client.chat.completions.create`.
 */
export async function guardedChat<
  T extends {
    usage?: {
      prompt_tokens?: number | null;
      completion_tokens?: number | null;
    } | null;
  },
>(model: string, call: () => Promise<T>): Promise<T> {
  assertAiBudget();
  const result = await call();
  recordAiUsage(
    model,
    result.usage?.prompt_tokens,
    result.usage?.completion_tokens,
  );
  return result;
}

/**
 * Guard a non-streaming Anthropic `messages.create` call (usage is reported as
 * input_tokens / output_tokens).
 */
export async function guardedAnthropic<
  T extends {
    usage?: {
      input_tokens?: number | null;
      output_tokens?: number | null;
    } | null;
  },
>(model: string, call: () => Promise<T>): Promise<T> {
  assertAiBudget();
  const result = await call();
  recordAiUsage(model, result.usage?.input_tokens, result.usage?.output_tokens);
  return result;
}
