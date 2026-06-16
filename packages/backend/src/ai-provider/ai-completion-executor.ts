/**
 * AI Completion Executor
 *
 * Single-shot completion call + usage logging, extracted from
 * AiProviderService to keep that file under the 300-line limit.
 * Handles provider quirks: Anthropic sampling-param rejection and
 * json_object support.
 */

import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { SupabaseService } from '../supabase/supabase.service';
import {
  AiProviderConfig,
  AiCompletionResponse,
  PROVIDER_PRESETS,
  modelRejectsSamplingParams,
  providerSupportsJsonObjectFormat,
} from './ai-provider.types';
import { logUsage } from './ai-usage-logger';

export async function executeCompletion(deps: {
  client: OpenAI;
  supabase: SupabaseService;
  logger: Logger;
  purpose: string;
  config: AiProviderConfig;
  messages: OpenAI.ChatCompletionMessageParam[];
  activeTestRunId: string | null;
  options: {
    maxTokens: number;
    temperature?: number;
    responseFormat?: 'text' | 'json';
    testRunId?: string;
    reportId?: string;
    sectionId?: string;
  };
}): Promise<AiCompletionResponse> {
  const { client, supabase, logger, purpose, config, messages, options } = deps;
  const startTime = Date.now();
  const temperature =
    options.temperature ??
    config.temperature ??
    PROVIDER_PRESETS[config.provider].defaultTemperature;

  try {
    const rejectsSampling = modelRejectsSamplingParams(
      config.provider,
      config.model,
    );
    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: options.maxTokens,
      ...(rejectsSampling ? {} : { temperature }),
      ...(options.responseFormat === 'json' &&
        providerSupportsJsonObjectFormat(config.provider) && {
          response_format: { type: 'json_object' },
        }),
    });

    const durationMs = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';

    logger.log(
      `[${purpose}] ${config.provider}/${config.model} completed in ${durationMs}ms` +
        (response.usage ? ` (${response.usage.total_tokens} tokens)` : ''),
    );

    logUsage(supabase, {
      purpose,
      provider: config.provider,
      model: config.model,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
      durationMs,
      success: true,
      testRunId: options.testRunId || deps.activeTestRunId || undefined,
      reportId: options.reportId,
      sectionId: options.sectionId,
    });

    return {
      content,
      model: config.model,
      provider: config.provider,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    logger.error(
      `[${purpose}] ${config.provider}/${config.model} failed after ${durationMs}ms: ${error.message}`,
    );
    logUsage(supabase, {
      purpose,
      provider: config.provider,
      model: config.model,
      durationMs,
      success: false,
      errorMessage: error.message,
      testRunId: options.testRunId || deps.activeTestRunId || undefined,
      reportId: options.reportId,
      sectionId: options.sectionId,
    });
    throw error;
  }
}
