/**
 * AI Provider Service
 *
 * Model-agnostic AI completion service that resolves provider config from:
 * 1. Database table `ai_model_config` (cached 5 min, keyed by purpose)
 * 2. Environment variable fallback (AI_PROVIDER, AI_MODEL, etc.)
 *
 * Uses OpenAI SDK for all providers (OpenAI-compatible API format).
 * Handles system prompt nuances per model (e.g. deepseek-reasoner).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AiProviderConfig,
  AiProviderType,
  AiCompletionRequest,
  AiCompletionResponse,
  PROVIDER_PRESETS,
} from './ai-provider.types';

interface CachedConfig {
  config: AiProviderConfig;
  expiresAt: number;
}

const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly configCache = new Map<string, CachedConfig>();
  private readonly clientCache = new Map<string, OpenAI>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Execute an AI completion request for a given purpose.
   * Purpose maps to a config row in `ai_model_config` (e.g. "report_narrative").
   */
  async complete(
    purpose: string,
    request: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    const config = await this.resolveConfig(purpose);
    const client = this.getOrCreateClient(config);
    const startTime = Date.now();

    const messages = this.buildMessages(config, request);
    const temperature =
      request.temperature ??
      config.temperature ??
      PROVIDER_PRESETS[config.provider].defaultTemperature;

    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages,
        max_tokens: request.maxTokens,
        temperature,
        ...(request.responseFormat === 'json' && {
          response_format: { type: 'json_object' },
        }),
      });

      const durationMs = Date.now() - startTime;
      const choice = response.choices[0];
      const content = choice?.message?.content || '';

      this.logger.log(
        `[${purpose}] ${config.provider}/${config.model} completed in ${durationMs}ms` +
          (response.usage ? ` (${response.usage.total_tokens} tokens)` : ''),
      );

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
      this.logger.error(
        `[${purpose}] ${config.provider}/${config.model} failed after ${durationMs}ms: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Invalidate cached config. Call after admin updates ai_model_config.
   * Pass a purpose to invalidate a single entry, or omit to clear all.
   */
  invalidateCache(purpose?: string): void {
    if (purpose) {
      this.configCache.delete(purpose);
    } else {
      this.configCache.clear();
    }
    // Always clear client cache — API keys or base URLs may have changed.
    // Client creation is cheap so this is safe.
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
   * Resolve config: check cache -> DB -> env fallback.
   */
  private async resolveConfig(purpose: string): Promise<AiProviderConfig> {
    const cached = this.configCache.get(purpose);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.config;
    }

    const dbConfig = await this.loadConfigFromDb(purpose);
    if (dbConfig) {
      this.configCache.set(purpose, {
        config: dbConfig,
        expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
      });
      return dbConfig;
    }

    const fallbackConfig = this.buildFallbackConfig();
    this.configCache.set(purpose, {
      config: fallbackConfig,
      expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
    });
    return fallbackConfig;
  }

  /**
   * Load config from the `ai_model_config` DB table for a given purpose.
   */
  private async loadConfigFromDb(
    purpose: string,
  ): Promise<AiProviderConfig | null> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('ai_model_config')
        .select('provider, model, api_key, base_url, temperature, max_retries')
        .eq('purpose', purpose)
        .eq('is_active', true)
        .single();

      if (error || !data) return null;

      const provider = data.provider as AiProviderType;
      const preset = PROVIDER_PRESETS[provider];
      if (!preset) return null;

      // Resolve API key: DB value takes priority, then env var from preset
      const apiKey =
        data.api_key || this.configService.get<string>(preset.envKeyName);
      if (!apiKey) {
        this.logger.warn(
          `[${purpose}] DB config found for ${provider} but no API key available`,
        );
        return null;
      }

      return {
        provider,
        model: data.model || preset.defaultModel,
        apiKey,
        baseUrl: data.base_url || preset.baseUrl,
        temperature: data.temperature ?? preset.defaultTemperature,
        maxRetries: data.max_retries ?? 2,
      };
    } catch (error: any) {
      this.logger.warn(
        `Failed to load AI config from DB for "${purpose}": ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Build config from environment variables as a last resort.
   */
  private buildFallbackConfig(): AiProviderConfig {
    const providerName =
      (this.configService.get<string>('AI_PROVIDER') as AiProviderType) ||
      'deepseek';
    const preset = PROVIDER_PRESETS[providerName] || PROVIDER_PRESETS.deepseek;

    const apiKey = this.configService.get<string>(preset.envKeyName);
    if (!apiKey) {
      throw new Error(
        `No API key found for AI provider "${providerName}". ` +
          `Set ${preset.envKeyName} environment variable.`,
      );
    }

    return {
      provider: providerName,
      model: this.configService.get<string>('AI_MODEL') || preset.defaultModel,
      apiKey,
      baseUrl: this.configService.get<string>('AI_BASE_URL') || preset.baseUrl,
      temperature:
        parseFloat(this.configService.get<string>('AI_TEMPERATURE') || '') ||
        preset.defaultTemperature,
      maxRetries: 2,
    };
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
