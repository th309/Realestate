/**
 * AI Provider Service
 *
 * Model-agnostic AI completion service. Resolves provider config via
 * AiConfigResolver (DB -> env fallback, cached 5 min).
 *
 * Uses OpenAI SDK for all providers (OpenAI-compatible API format).
 * Handles system prompt nuances per model (e.g. deepseek-reasoner).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AiCompletionRequest,
  AiCompletionResponse,
  PROVIDER_PRESETS,
} from './ai-provider.types';
import { AiConfigResolver } from './ai-config-resolver';
import { AiShadowService } from './ai-shadow.service';
import { executeStream } from './ai-stream-executor';
import { executeCompletion } from './ai-completion-executor';
import { AiCompletionCache } from './ai-completion-cache';
import { AiSpendGuard } from './ai-spend-guard';
import { getSharedSpendGuard } from './ai-spend-guard.shared';
import { runGuardedCompletion, envNumber } from './ai-guarded-completion';
import {
  buildMessages,
  getOrCreateClient,
  logProviderKeyStatus,
} from './ai-client-factory';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly clientCache = new Map<string, OpenAI>();
  private readonly configResolver: AiConfigResolver;
  private readonly supabase: SupabaseService;
  /** Global test run ID applied to all usage logs. Set via admin API. */
  private activeTestRunId: string | null = null;
  /** Short-TTL cache: identical requests reuse the answer, not re-bill. */
  private readonly completionCache: AiCompletionCache<AiCompletionResponse>;
  /** In-memory daily-spend backstop against runaway fan-out/retry loops. */
  private readonly spendGuard: AiSpendGuard;

  constructor(
    supabase: SupabaseService,
    configService: ConfigService,
    private readonly shadow: AiShadowService,
  ) {
    this.supabase = supabase;
    this.configResolver = new AiConfigResolver(supabase, configService);

    // Cost controls. Completion cache defaults to 10 min (AI_COMPLETION_CACHE_TTL_MS=0
    // disables). The spend cap is the SHARED process-wide ledger so direct-client
    // AI calls count against the same daily cap (see ai-spend-guard.shared).
    this.completionCache = new AiCompletionCache<AiCompletionResponse>({
      ttlMs: envNumber(
        configService.get('AI_COMPLETION_CACHE_TTL_MS'),
        600_000,
      ),
    });
    this.spendGuard = getSharedSpendGuard();

    logProviderKeyStatus(configService, this.logger);
  }

  /**
   * Execute an AI completion request for a given purpose.
   * Purpose maps to a config row in `ai_model_config` (e.g. "report_narrative").
   */
  async complete(
    purpose: string,
    request: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    const requestId = randomUUID();
    const config = await this.configResolver.resolve(purpose);
    const messages = buildMessages(config, request);
    const temperature =
      request.temperature ??
      config.temperature ??
      PROVIDER_PRESETS[config.provider].defaultTemperature;

    const client = getOrCreateClient(this.clientCache, config, this.logger);
    // Cache key must fully determine the output. Do NOT add user/tenant-specific
    // data to prompts for cached purposes without keying on it (see AiCompletionCache).
    const cacheKey = this.completionCache.enabled
      ? this.completionCache.makeKey({
          provider: config.provider,
          model: config.model,
          system: request.systemPrompt ?? '',
          user: request.userPrompt,
          maxTokens: request.maxTokens,
          temperature,
          responseFormat: request.responseFormat ?? 'text',
        })
      : null;

    const { response, fromCache } = await runGuardedCompletion({
      purpose,
      model: config.model,
      cacheKey,
      cache: this.completionCache,
      spendGuard: this.spendGuard,
      logger: this.logger,
      execute: () =>
        executeCompletion({
          client,
          supabase: this.supabase,
          logger: this.logger,
          purpose,
          config,
          messages,
          activeTestRunId: this.activeTestRunId,
          options: {
            maxTokens: request.maxTokens,
            temperature,
            responseFormat: request.responseFormat,
            testRunId: request.testRunId,
            reportId: request.reportId,
            sectionId: request.sectionId,
          },
        }),
    });

    // Cache hits have no new primary call to shadow-compare against.
    if (!fromCache) {
      void this.shadow.runShadow({
        purpose,
        requestId,
        primaryConfig: config,
        primaryResult: {
          content: response.content,
          usage: response.usage,
          durationMs: response.durationMs,
        },
        callArgs: {
          messages: messages as Array<{ role: string; content: unknown }>,
          options: { maxTokens: request.maxTokens, temperature },
        },
        primaryFailedOver: false,
      });
    }

    return response;
  }

  /**
   * Execute an AI completion with a raw messages array (for multi-turn conversations).
   * Purpose maps to a config row in `ai_model_config` (e.g. "conversation").
   */
  async completeWithMessages(
    purpose: string,
    messages: OpenAI.ChatCompletionMessageParam[],
    maxTokens: number,
  ): Promise<AiCompletionResponse> {
    const requestId = randomUUID();
    const config = await this.configResolver.resolve(purpose);
    const client = getOrCreateClient(this.clientCache, config, this.logger);
    // Multi-turn conversations are not cached (each turn is unique), but still
    // pass through the spend backstop.
    const { response } = await runGuardedCompletion({
      purpose,
      model: config.model,
      cacheKey: null,
      cache: this.completionCache,
      spendGuard: this.spendGuard,
      logger: this.logger,
      execute: () =>
        executeCompletion({
          client,
          supabase: this.supabase,
          logger: this.logger,
          purpose,
          config,
          messages,
          activeTestRunId: this.activeTestRunId,
          options: { maxTokens },
        }),
    });

    void this.shadow.runShadow({
      purpose,
      requestId,
      primaryConfig: config,
      primaryResult: {
        content: response.content,
        usage: response.usage,
        durationMs: response.durationMs,
      },
      callArgs: {
        messages: messages as Array<{ role: string; content: unknown }>,
        options: { maxTokens },
      },
      primaryFailedOver: false,
    });

    return response;
  }

  /**
   * Stream an AI completion as an async generator of text deltas.
   *
   * Resolves config the same way as `complete()` and re-uses `buildMessages()`
   * for system-prompt / reasoner-quirk handling. Yields each non-empty
   * `choices[0].delta.content` chunk from the OpenAI-compatible stream.
   * Usage telemetry is logged once when the stream ends (success or failure).
   */
  async *stream(
    purpose: string,
    request: AiCompletionRequest,
  ): AsyncGenerator<string> {
    const requestId = randomUUID();
    const config = await this.configResolver.resolve(purpose);
    // Backstop applies to streaming too: spend recorded by prior calls can trip
    // the cap and halt a runaway stream loop before it dispatches.
    this.spendGuard.assertUnderCap();
    const client = getOrCreateClient(this.clientCache, config, this.logger);
    const messages = buildMessages(config, request);
    const temperature =
      request.temperature ??
      config.temperature ??
      PROVIDER_PRESETS[config.provider].defaultTemperature;

    const startedAt = Date.now();
    let buffered = '';

    try {
      for await (const delta of executeStream({
        client,
        supabase: this.supabase,
        logger: this.logger,
        purpose,
        config,
        messages,
        request,
        temperature,
        activeTestRunId: this.activeTestRunId,
      })) {
        buffered += delta;
        yield delta;
      }
    } finally {
      const durationMs = Date.now() - startedAt;
      // Fire-and-forget shadow dispatch after stream completes, errors, or
      // the consumer disconnects. Usage tokens are not captured here because
      // the executor logs them internally; shadow runs without primary usage.
      void this.shadow.runShadow({
        purpose,
        requestId,
        primaryConfig: config,
        primaryResult: { content: buffered, usage: undefined, durationMs },
        callArgs: {
          messages: messages as Array<{ role: string; content: unknown }>,
          options: { maxTokens: request.maxTokens, temperature },
        },
        primaryFailedOver: false,
      });
    }
  }

  /**
   * Get a configured OpenAI client for a given purpose.
   * Use this when you need direct client access (e.g. tool-use loops)
   * instead of the simpler `complete()` method.
   */
  async getClientForPurpose(
    purpose: string,
  ): Promise<{ client: OpenAI; model: string; systemPrompt?: string }> {
    const config = await this.configResolver.resolve(purpose);
    return {
      client: getOrCreateClient(this.clientCache, config, this.logger),
      model: config.model,
    };
  }

  /**
   * Invalidate cached config. Call after admin updates ai_model_config.
   * Pass a purpose to invalidate a single entry, or omit to clear all.
   */
  setTestRunId(id: string | null): void {
    this.activeTestRunId = id;
    this.logger.log(`Test run ID set: ${id || '(cleared)'}`);
  }

  getTestRunId(): string | null {
    return this.activeTestRunId;
  }

  invalidateCache(purpose?: string): void {
    this.configResolver.invalidate(purpose);
    // Always clear client cache — API keys or base URLs may have changed.
    this.clientCache.clear();
    this.logger.log(`Cache invalidated: ${purpose || 'all'}`);
  }
}
