/**
 * AI Shadow Service
 *
 * Fires a parallel "shadow" provider call after the primary returns,
 * stores both outputs paired in ai_shadow_log for side-by-side review.
 * Gated by: per-purpose sample rate, global kill switch, daily $ ceiling,
 * and the "primary failed over" flag (skip if primary already used Anthropic).
 *
 * Approach B execution model: fire-and-forget via `void` from caller. Adds
 * zero latency to the user-facing request.
 *
 * Task T6 lands the gate logic; T7 implements fireShadowCall + insertLog.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import OpenAI from 'openai';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  AiProviderConfig,
  AiCompletionResponse,
  AiProviderType,
} from './ai-provider.types';
import { PROVIDER_PRESETS, AI_PURPOSES } from './ai-provider.types';
import { estimateCostUsd } from './cost-estimator';
import { guardedChat } from './ai-spend-guard.shared';

const SHADOW_CONFIG_CACHE_MS = 30_000;
const INPUT_PREVIEW_MAX_LEN = 1024;

export interface ShadowContext {
  purpose: string;
  requestId: string;
  primaryConfig: AiProviderConfig;
  primaryResult: {
    content: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    durationMs: number;
  };
  callArgs: {
    messages: Array<{ role: string; content: string | unknown }>;
    options: Record<string, unknown>;
  };
  primaryFailedOver: boolean;
}

interface ShadowGlobalConfig {
  enabled: boolean;
  dailyUsdCeiling: number;
  fetchedAt: number;
}

@Injectable()
export class AiShadowService {
  private readonly logger = new Logger('AiShadowService');
  private cachedGlobalConfig: ShadowGlobalConfig | null = null;
  private redis: Redis | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, { lazyConnect: true });
    }
  }

  async runShadow(ctx: ShadowContext): Promise<void> {
    try {
      const cfg = ctx.primaryConfig;
      if (!cfg.shadowProvider || !cfg.shadowModel) return;
      if (ctx.primaryFailedOver) return;
      if (!(await this.shadowGloballyEnabled())) return;
      const sampleRate = cfg.shadowSampleRate ?? 0;
      if (Math.random() >= sampleRate) return;
      if (await this.dailyCeilingExceeded()) return;

      const shadowResult = await this.fireShadowCall(
        cfg.shadowProvider,
        cfg.shadowModel,
        ctx,
      );

      const cost = estimateCostUsd(
        cfg.shadowModel,
        shadowResult.usage?.promptTokens,
        shadowResult.usage?.completionTokens,
      );
      if (cost != null) await this.incrementDailyCost(cost);

      await this.insertLog(ctx, shadowResult, cost);
    } catch (err) {
      this.logger.warn(
        `Shadow run failed for purpose=${ctx.purpose}: ${(err as Error).message}`,
      );
      await this.insertLog(ctx, null, null, (err as Error).message).catch(
        () => {},
      );
    }
  }

  /** Cached at SHADOW_CONFIG_CACHE_MS; tests stub this. */
  protected async shadowGloballyEnabled(): Promise<boolean> {
    const now = Date.now();
    if (
      this.cachedGlobalConfig &&
      now - this.cachedGlobalConfig.fetchedAt < SHADOW_CONFIG_CACHE_MS
    ) {
      return this.cachedGlobalConfig.enabled;
    }
    const { data } = await this.supabase
      .getClient()
      .from('ai_shadow_config')
      .select('enabled, daily_usd_ceiling')
      .eq('id', 1)
      .maybeSingle();

    this.cachedGlobalConfig = {
      enabled: data?.enabled ?? false,
      dailyUsdCeiling: Number(data?.daily_usd_ceiling ?? 0),
      fetchedAt: now,
    };
    return this.cachedGlobalConfig.enabled;
  }

  /** Tests stub this. */
  protected async dailyCeilingExceeded(): Promise<boolean> {
    if (!this.redis) return false;
    const ceiling = this.cachedGlobalConfig?.dailyUsdCeiling ?? 0;
    if (ceiling <= 0) return false;
    const key = this.dailyCostKey();
    const raw = await this.redis.get(key);
    const spent = Number(raw ?? 0);
    return spent >= ceiling;
  }

  /** Tests stub this. */
  protected async incrementDailyCost(usd: number): Promise<void> {
    if (!this.redis || usd <= 0) return;
    const key = this.dailyCostKey();
    await this.redis.incrbyfloat(key, usd);
    await this.redis.expire(key, 26 * 60 * 60);
  }

  private dailyCostKey(): string {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `shadow:daily_cost:${yyyy}-${mm}-${dd}`;
  }

  protected async fireShadowCall(
    provider: AiProviderType,
    model: string,
    ctx: ShadowContext,
  ): Promise<AiCompletionResponse> {
    const preset = PROVIDER_PRESETS[provider];
    const apiKey = this.configService.get<string>(preset.envKeyName);
    if (!apiKey) {
      throw new Error(
        `No API key for shadow provider ${provider} (${preset.envKeyName})`,
      );
    }

    const client = new OpenAI({ apiKey, baseURL: preset.baseUrl });

    // Tool-use replay: research_agent must not issue new tool calls — the
    // shadow generates its final assistant turn from the same evidence the
    // primary collected. Suppression syntax differs by provider.
    const isResearchAgent = ctx.purpose === AI_PURPOSES.RESEARCH_AGENT;
    const toolChoice = isResearchAgent
      ? provider === 'anthropic'
        ? ({ type: 'none' } as unknown)
        : 'none'
      : undefined;

    const startedAt = Date.now();
    const completion = await guardedChat(model, () =>
      client.chat.completions.create({
        model,
        messages: ctx.callArgs.messages as never,
        ...(toolChoice !== undefined
          ? { tool_choice: toolChoice as never }
          : {}),
        stream: false,
      }),
    );

    return {
      content: completion.choices[0]?.message?.content ?? '',
      provider,
      model,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
      durationMs: Date.now() - startedAt,
    };
  }

  protected async insertLog(
    ctx: ShadowContext,
    shadowResult: AiCompletionResponse | null,
    shadowCostUsd: number | null,
    errorMessage?: string,
  ): Promise<void> {
    const primaryCost = estimateCostUsd(
      ctx.primaryConfig.model,
      ctx.primaryResult.usage?.promptTokens,
      ctx.primaryResult.usage?.completionTokens,
    );

    const inputPreview = JSON.stringify(ctx.callArgs.messages).slice(
      0,
      INPUT_PREVIEW_MAX_LEN,
    );

    const { error } = await this.supabase
      .getClient()
      .from('ai_shadow_log')
      .insert({
        request_id: ctx.requestId,
        purpose: ctx.purpose,
        primary_provider: ctx.primaryConfig.provider,
        primary_model: ctx.primaryConfig.model,
        primary_output: ctx.primaryResult.content,
        primary_duration_ms: ctx.primaryResult.durationMs,
        primary_cost_usd: primaryCost,
        primary_tokens_in: ctx.primaryResult.usage?.promptTokens ?? null,
        primary_tokens_out: ctx.primaryResult.usage?.completionTokens ?? null,
        shadow_provider: ctx.primaryConfig.shadowProvider,
        shadow_model: ctx.primaryConfig.shadowModel,
        shadow_output: shadowResult?.content ?? null,
        shadow_duration_ms: shadowResult?.durationMs ?? null,
        shadow_cost_usd: shadowCostUsd,
        shadow_tokens_in: shadowResult?.usage?.promptTokens ?? null,
        shadow_tokens_out: shadowResult?.usage?.completionTokens ?? null,
        shadow_error: errorMessage ?? null,
        input_preview: inputPreview,
      });

    if (error) {
      this.logger.warn(
        `Failed to insert ai_shadow_log row: ${(error as { message?: string }).message ?? String(error)}`,
      );
    }
  }
}
