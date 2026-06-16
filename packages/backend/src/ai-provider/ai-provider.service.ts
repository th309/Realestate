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
  AiProviderConfig,
  AiCompletionResponse,
  PROVIDER_PRESETS,
} from './ai-provider.types';
import { AiConfigResolver } from './ai-config-resolver';
import { AiShadowService } from './ai-shadow.service';
import { executeStream } from './ai-stream-executor';
import { executeCompletion } from './ai-completion-executor';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly clientCache = new Map<string, OpenAI>();
  private readonly configResolver: AiConfigResolver;
  private readonly supabase: SupabaseService;
  /** Global test run ID applied to all usage logs. Set via admin API. */
  private activeTestRunId: string | null = null;

  constructor(
    supabase: SupabaseService,
    configService: ConfigService,
    private readonly shadow: AiShadowService,
  ) {
    this.supabase = supabase;
    this.configResolver = new AiConfigResolver(supabase, configService);

    // Log which provider API keys are available at startup
    const keys = [
      'DEEPSEEK_API_KEY',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GOOGLE_AI_API_KEY',
    ];
    const status = keys
      .map((k) => `${k}: ${configService.get(k) ? 'SET' : 'MISSING'}`)
      .join(', ');
    this.logger.log(`API keys at startup: ${status}`);
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
    const messages = this.buildMessages(config, request);
    const temperature =
      request.temperature ??
      config.temperature ??
      PROVIDER_PRESETS[config.provider].defaultTemperature;

    const client = this.getOrCreateClient(config);
    const response = await executeCompletion({
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
        options: { maxTokens: request.maxTokens, temperature },
      },
      primaryFailedOver: false,
    });

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
    const client = this.getOrCreateClient(config);
    const response = await executeCompletion({
      client,
      supabase: this.supabase,
      logger: this.logger,
      purpose,
      config,
      messages,
      activeTestRunId: this.activeTestRunId,
      options: { maxTokens },
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
    const client = this.getOrCreateClient(config);
    const messages = this.buildMessages(config, request);
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
    return { client: this.getOrCreateClient(config), model: config.model };
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

  /**
   * Build the messages array, handling system prompt support per model.
   * deepseek-reasoner doesn't support system role — prepend to user message.
   */
  private buildMessages(
    config: AiProviderConfig,
    request: AiCompletionRequest,
  ): OpenAI.ChatCompletionMessageParam[] {
    const modelSupportsSystemRole = !config.model.includes('reasoner');

    if (request.systemPrompt && modelSupportsSystemRole) {
      return [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ];
    }

    if (request.systemPrompt && !modelSupportsSystemRole) {
      const combinedPrompt = `[System Instructions]\n${request.systemPrompt}\n\n[User Request]\n${request.userPrompt}`;
      return [{ role: 'user', content: combinedPrompt }];
    }

    return [{ role: 'user', content: request.userPrompt }];
  }

  /**
   * Get or create an OpenAI client, cached by provider+baseUrl key.
   */
  private getOrCreateClient(config: AiProviderConfig): OpenAI {
    const cacheKey = `${config.provider}::${config.baseUrl}`;
    const existing = this.clientCache.get(cacheKey);
    if (existing) return existing;

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 2,
    });

    this.clientCache.set(cacheKey, client);
    this.logger.log(
      `OpenAI client created for ${config.provider} at ${config.baseUrl}`,
    );
    return client;
  }
}
