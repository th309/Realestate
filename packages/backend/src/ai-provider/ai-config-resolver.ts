/**
 * AI Config Resolver
 *
 * Resolves AI provider configuration from:
 * 1. In-memory cache (5 min TTL)
 * 2. Database table `ai_model_config` (keyed by purpose)
 * 3. Environment variable fallback (AI_PROVIDER, AI_MODEL, etc.)
 *
 * Extracted from AiProviderService to keep file sizes under the 300-line limit.
 */

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseService } from '../supabase/supabase.service';
import {
  AiProviderConfig,
  AiProviderType,
  PROVIDER_PRESETS,
} from './ai-provider.types';

interface CachedConfig {
  config: AiProviderConfig;
  expiresAt: number;
}

const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class AiConfigResolver {
  private readonly logger = new Logger(AiConfigResolver.name);
  private readonly cache = new Map<string, CachedConfig>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolve config: check cache -> DB -> env fallback.
   */
  async resolve(purpose: string): Promise<AiProviderConfig> {
    const cached = this.cache.get(purpose);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.config;
    }

    const dbConfig = await this.loadFromDb(purpose);
    if (dbConfig) {
      this.cache.set(purpose, {
        config: dbConfig,
        expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
      });
      return dbConfig;
    }

    this.logger.warn(
      `[${purpose}] DB config not usable — falling back to env defaults`,
    );
    const fallbackConfig = this.buildFallbackConfig();
    this.cache.set(purpose, {
      config: fallbackConfig,
      expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
    });
    return fallbackConfig;
  }

  /**
   * Invalidate cached config entries.
   * Pass a purpose to invalidate one, or omit to clear all.
   */
  invalidate(purpose?: string): void {
    if (purpose) {
      this.cache.delete(purpose);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Load config from the `ai_model_config` DB table for a given purpose.
   * API keys are always resolved from environment variables (never stored in DB).
   */
  private async loadFromDb(purpose: string): Promise<AiProviderConfig | null> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('ai_model_config')
        .select('provider, model, base_url, temperature')
        .eq('purpose', purpose)
        .eq('is_active', true)
        .single();

      if (error || !data) return null;

      const provider = data.provider as AiProviderType;
      const preset = PROVIDER_PRESETS[provider];
      if (!preset) return null;

      // API keys come from environment variables, keyed by provider preset
      const apiKey = this.configService.get<string>(preset.envKeyName);
      if (!apiKey) {
        this.logger.warn(
          `[${purpose}] DB config found for ${provider} but no API key (${preset.envKeyName}) in env`,
        );
        return null;
      }

      return {
        provider,
        model: data.model || preset.defaultModel,
        apiKey,
        baseUrl: data.base_url || preset.baseUrl,
        temperature: data.temperature ?? preset.defaultTemperature,
        maxRetries: 2,
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
}
