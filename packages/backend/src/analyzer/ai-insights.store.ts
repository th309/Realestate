/**
 * AiInsightsStore — durable (Postgres) layer for analyzer AI narratives.
 *
 * Sits behind `AiInsightsCache`, which owns the read order:
 *   redis (hot) -> this store (durable) -> LLM
 *
 * Why this exists: Redis alone lost still-valid narratives three ways — TTL
 * expiry (24h, when the narrative is actually valid until the deal or the
 * monthly PIQ rescore changes), eviction under memory pressure, and Redis
 * being absent entirely in local dev (`getClient()` returns null, so every
 * lookup was a miss and every page load re-billed the provider).
 *
 * Every method swallows its own errors and degrades to a cache miss. A cache
 * is never allowed to take down the request it was meant to speed up — if
 * Postgres is unreachable the caller just regenerates, exactly as before this
 * layer existed.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import type { CachedInsight } from './ai-insights.cache';

const TABLE = 'analyzer_ai_insights';

/** Row metadata parsed off the composite cache key, plus the raw PIQ scores
 *  the narrative was written against. Purely for pruning and audit — none of
 *  it participates in lookup, which is by `cache_key` alone. */
export interface InsightRowMeta {
  promptRevision: string;
  sectionId: string;
  strategy: string | null;
  goal: string | null;
  piqByGeo: unknown;
}

@Injectable()
export class AiInsightsStore {
  private readonly logger = new Logger(AiInsightsStore.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Fetch a persisted narrative. Returns `null` on miss OR on any error —
   * both mean "regenerate", and conflating them keeps the caller simple.
   *
   * `last_accessed_at` is bumped fire-and-forget so a slow write never adds
   * latency to a cache hit; the column only drives LRU pruning, so losing an
   * occasional bump is harmless.
   */
  async get(key: string): Promise<CachedInsight | null> {
    try {
      const { data, error } = await this.supabase
        .from(TABLE)
        .select('payload')
        .eq('cache_key', key)
        .maybeSingle();

      if (error || !data?.payload) return null;

      void this.touch(key);
      return data.payload as CachedInsight;
    } catch (err) {
      this.logger.warn(
        `[ai-insights] durable read failed (treating as miss): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /**
   * Persist a narrative. Upsert on `cache_key` because two concurrent
   * analyzer loads with an identical payload can both miss and both generate;
   * last write wins and either narrative is equally valid for the key.
   */
  async set(
    key: string,
    value: CachedInsight,
    meta: InsightRowMeta,
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from(TABLE).upsert(
        {
          cache_key: key,
          prompt_revision: meta.promptRevision,
          section_id: meta.sectionId,
          strategy: meta.strategy,
          goal: meta.goal,
          payload: value,
          piq_by_geo: meta.piqByGeo ?? null,
          last_accessed_at: new Date().toISOString(),
        },
        { onConflict: 'cache_key' },
      );
      if (error) {
        this.logger.warn(
          `[ai-insights] durable write failed (narrative still served): ${error.message}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `[ai-insights] durable write threw (narrative still served): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Bump LRU timestamp. Failures are ignored — see `get()`. */
  private async touch(key: string): Promise<void> {
    try {
      await this.supabase
        .from(TABLE)
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('cache_key', key);
    } catch {
      /* LRU bookkeeping only — never surfaced */
    }
  }
}
