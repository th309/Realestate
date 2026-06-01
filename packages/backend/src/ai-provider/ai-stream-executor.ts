/**
 * AI Stream Executor
 *
 * Iterates an OpenAI-compatible streaming completion and yields each
 * non-empty text delta. Logs usage telemetry on completion (success or
 * failure) using the same pattern as `executeCompletion()` in the service.
 *
 * Extracted from AiProviderService to keep the service file under the
 * 300-line limit (CLAUDE.md §1.3), mirroring the `ai-usage-logger` and
 * `ai-config-resolver` extractions.
 */

import { Logger } from '@nestjs/common';
import type OpenAI from 'openai';
import type { SupabaseService } from '../supabase/supabase.service';
import {
  AiProviderConfig,
  AiCompletionRequest,
  modelRejectsSamplingParams,
} from './ai-provider.types';
import { logUsage } from './ai-usage-logger';

export interface StreamExecutorParams {
  client: OpenAI;
  supabase: SupabaseService;
  logger: Logger;
  purpose: string;
  config: AiProviderConfig;
  messages: OpenAI.ChatCompletionMessageParam[];
  request: AiCompletionRequest;
  temperature: number;
  /** Global test run ID applied to usage logs when request omits one. */
  activeTestRunId: string | null;
}

/**
 * Run a streaming completion and yield each non-empty content delta.
 * Logs success/failure telemetry exactly once when the stream ends.
 */
export async function* executeStream(
  params: StreamExecutorParams,
): AsyncGenerator<string> {
  const {
    client,
    supabase,
    logger,
    purpose,
    config,
    messages,
    request,
    temperature,
    activeTestRunId,
  } = params;

  const startTime = Date.now();
  let usage: any | undefined;

  try {
    const rejectsSampling = modelRejectsSamplingParams(
      config.provider,
      config.model,
    );
    const stream = (await client.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: request.maxTokens,
      ...(rejectsSampling ? {} : { temperature }),
      stream: true,
    } as any)) as any;

    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        yield delta;
      }
      if (chunk?.usage) usage = chunk.usage;
    }

    const durationMs = Date.now() - startTime;
    logger.log(
      `[${purpose}] ${config.provider}/${config.model} stream completed in ${durationMs}ms` +
        (usage ? ` (${usage.total_tokens} tokens)` : ''),
    );
    logUsage(supabase, {
      purpose,
      provider: config.provider,
      model: config.model,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      durationMs,
      success: true,
      testRunId: request.testRunId || activeTestRunId || undefined,
      reportId: request.reportId,
      sectionId: request.sectionId,
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    logger.error(
      `[${purpose}] ${config.provider}/${config.model} stream failed after ${durationMs}ms: ${error.message}`,
    );
    logUsage(supabase, {
      purpose,
      provider: config.provider,
      model: config.model,
      durationMs,
      success: false,
      errorMessage: error.message,
      testRunId: request.testRunId || activeTestRunId || undefined,
      reportId: request.reportId,
      sectionId: request.sectionId,
    });
    throw error;
  }
}
