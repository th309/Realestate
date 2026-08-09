/**
 * AI Provider Streaming Methods
 *
 * Streaming orchestration extracted from AiProviderService to keep that file
 * under the 300-line limit (CLAUDE.md §1.3) — the same reason
 * executeCompletion/executeStream were already extracted into their own
 * files. Each function here mirrors a non-streaming AiProviderService method
 * (streamCompletion ~ complete(), streamMessagesCompletion ~
 * completeWithMessages()) but yields text deltas instead of returning one
 * response.
 */

import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type OpenAI from 'openai';
import type { SupabaseService } from '../supabase/supabase.service';
import type { AiConfigResolver } from './ai-config-resolver';
import type { AiShadowService } from './ai-shadow.service';
import type { AiSpendGuard } from './ai-spend-guard';
import {
  AiCompletionRequest,
  AiProviderConfig,
  PROVIDER_PRESETS,
} from './ai-provider.types';
import { executeStream } from './ai-stream-executor';
import { buildMessages, getOrCreateClient } from './ai-client-factory';

export interface StreamMethodDeps {
  configResolver: AiConfigResolver;
  clientCache: Map<string, OpenAI>;
  supabase: SupabaseService;
  logger: Logger;
  spendGuard: AiSpendGuard;
  shadow: AiShadowService;
  activeTestRunId: string | null;
}

/**
 * Re-yields each delta from `run()` and dispatches the shadow-mode
 * comparison once (success, failure, or early consumer disconnect) —
 * mirrors the try/finally pattern AiProviderService.stream() used inline.
 */
async function* streamAndShadow(
  deps: StreamMethodDeps,
  purpose: string,
  config: AiProviderConfig,
  messages: OpenAI.ChatCompletionMessageParam[],
  temperature: number,
  maxTokens: number,
  run: () => AsyncGenerator<string>,
): AsyncGenerator<string> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let buffered = '';

  try {
    for await (const delta of run()) {
      buffered += delta;
      yield delta;
    }
  } finally {
    const durationMs = Date.now() - startedAt;
    void deps.shadow.runShadow({
      purpose,
      requestId,
      primaryConfig: config,
      primaryResult: { content: buffered, usage: undefined, durationMs },
      callArgs: {
        messages: messages as Array<{ role: string; content: unknown }>,
        options: { maxTokens, temperature },
      },
      primaryFailedOver: false,
    });
  }
}

/** Streaming counterpart of AiProviderService.complete(). */
export async function* streamCompletion(
  deps: StreamMethodDeps,
  purpose: string,
  request: AiCompletionRequest,
): AsyncGenerator<string> {
  const config = await deps.configResolver.resolve(purpose);
  // Backstop applies to streaming too: spend recorded by prior calls can trip
  // the cap and halt a runaway stream loop before it dispatches.
  deps.spendGuard.assertUnderCap();
  const client = getOrCreateClient(deps.clientCache, config, deps.logger);
  const messages = buildMessages(config, request);
  const temperature =
    request.temperature ??
    config.temperature ??
    PROVIDER_PRESETS[config.provider].defaultTemperature;

  yield* streamAndShadow(
    deps,
    purpose,
    config,
    messages,
    temperature,
    request.maxTokens,
    () =>
      executeStream({
        client,
        supabase: deps.supabase,
        logger: deps.logger,
        purpose,
        config,
        messages,
        request,
        temperature,
        activeTestRunId: deps.activeTestRunId,
      }),
  );
}

/** Streaming counterpart of AiProviderService.completeWithMessages(). */
export async function* streamMessagesCompletion(
  deps: StreamMethodDeps,
  purpose: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  maxTokens: number,
): AsyncGenerator<string> {
  const config = await deps.configResolver.resolve(purpose);
  deps.spendGuard.assertUnderCap();
  const client = getOrCreateClient(deps.clientCache, config, deps.logger);
  const temperature =
    config.temperature ?? PROVIDER_PRESETS[config.provider].defaultTemperature;

  yield* streamAndShadow(
    deps,
    purpose,
    config,
    messages,
    temperature,
    maxTokens,
    () =>
      executeStream({
        client,
        supabase: deps.supabase,
        logger: deps.logger,
        purpose,
        config,
        messages,
        // executeStream only reads request.maxTokens/testRunId/reportId/sectionId —
        // messages are passed separately, so a minimal request object is enough.
        request: { userPrompt: '', maxTokens },
        temperature,
        activeTestRunId: deps.activeTestRunId,
      }),
  );
}
