/**
 * AiInsightsCache — two-tier cache for analyzer AI insights.
 *
 * Composite key from rounded numeric inputs + sha1 hashes of piq + rentcast.avm
 * payloads. Read order is redis (hot) -> AiInsightsStore (durable Postgres) ->
 * caller regenerates. Writes go to both tiers.
 *
 * Entries are invalidated by KEY CHANGE, not by expiry: the key fingerprints
 * the entire deal plus the PIQ scores by geography, so any input edit or the
 * monthly rescore produces a different key and the old entry simply stops
 * being read. The Redis TTL is therefore a memory bound, not a correctness
 * mechanism — Postgres is what makes "same address, same scores, no rerun"
 * hold across restarts, evictions, and Redis being absent entirely.
 */

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { buildAiInsightsFingerprint } from '@propertyiq/analyzer-core';
import { RedisService } from '../redis/redis.service';
import { AiInsightsStore, type InsightRowMeta } from './ai-insights.store';

export interface CachedInsight {
  text: string;
  threadId: string;
  citedFacts: string[];
}

/**
 * Redis retention. Was 24h back when Redis was the ONLY layer, which threw
 * away ~29 days of still-valid narrative every month and re-billed the LLM
 * for it. With Postgres behind it a Redis miss now costs one indexed
 * primary-key lookup instead of an LLM call, so this is purely a
 * hot-set/memory tradeoff. 7 days keeps a returning user's deals warm without
 * letting the working set grow unbounded.
 */
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7d

/**
 * Prompt revision tag. Bump this whenever a prompt template change should
 * invalidate all existing cached AI responses. The cache key includes it so
 * a bump guarantees a fresh regeneration across every user/section without a
 * manual Redis flush.
 *
 *  v10 (2026-08-05): recommendation_analysis must now reconcile the USER GOAL
 *                    with the active STRATEGY in its opening sentence instead
 *                    of announcing the goal as though it were the strategy.
 *                    Fixes buy-and-hold analyses opening with "your goal is
 *                    fast cash within 12 months". Bump regenerates v9
 *                    narratives carrying the contradictory framing.
 *   v9 (2026-07-22): the cache key now covers the FULL DealInput /
 *                    RentalResult / FlipResult / BrrrrResult surface via the
 *                    shared analyzer-core fingerprint (buildAiInsightsFingerprint)
 *                    instead of a curated handful of headline figures
 *                    (price/rent/cashflow/dscr/gpa/auto-kills). Financing
 *                    terms, property class, unit count, vacancy/maintenance/
 *                    management %, and flip/BRRRR outputs now correctly
 *                    invalidate the cache instead of silently serving a
 *                    24h-stale narrative that cites the old numbers. Bump
 *                    forces every v8 entry to regenerate under the wider key.
 *   v8 (2026-07-12): recommendation_analysis now reconciles year-one economics
 *                    with the long-term projection when they diverge (names the
 *                    growth assumption doing the work). Bump regenerates v7
 *                    narratives that ignore the trajectory.
 *   v7 (2026-06-27): the prompt now includes a 30-YEAR WEALTH PROJECTION block
 *                    and the projection section cites the real wealth
 *                    components (was reporting "no projection supplied"). Bump
 *                    forces regeneration of all v6 entries that lack it.
 *   v6 (2026-05-20): six section annotations are now generated in a SINGLE
 *                    Anthropic call (see `completeAllSections`) and stored
 *                    under a single composite key (sectionId == 'batch').
 *                    Replaces the per-section pattern that fired 6 concurrent
 *                    requests and tripped Anthropic's upstream rate limit on
 *                    every analyzer page load.
 *   v5 (2026-05-18): goal-aware recommendation_analysis prompt; cache key
 *                    now includes the user's investor goal so each goal
 *                    gets its own cached narrative per deal.
 *   v4 (2026-05-18): reapplied the v2 prompt tightenings at user request —
 *                    PIQ Score reframed as probability of out/under-performing
 *                    the state average; "X percent excess return" language
 *                    explicitly banned in piq-by-geo-block + section-prompts;
 *                    recommendation_analysis CRITICAL geography guard
 *                    reinstated. If the narrative breaks again, isolate which
 *                    specific guard is responsible before reverting wholesale.
 *   v3 (2026-05-18): rolled back the v2 prompt tightenings — the long stack
 *                    of "NEVER do X" CRITICAL guards was breaking the
 *                    recommendation narrative and section lightbulb hints.
 *                    Restored the v1 prompts.
 *   v2 (2026-05-18): PIQ Score reframed as probability of out/under-performing
 *                    the state average; "X percent excess return" language
 *                    explicitly banned in piq-by-geo-block + section-prompts.
 *                    Broke the narrative for some prompts — rolled back in v3.
 *   v1 (initial)
 */
const PROMPT_REVISION = 'v10';

@Injectable()
export class AiInsightsCache {
  constructor(
    private readonly redis: RedisService,
    private readonly store: AiInsightsStore,
  ) {}

  computeKey(payload: any, sectionId: string): string {
    // Hash both the resolved-level PIQ context AND the per-geo PIQ scores so
    // a property with the same resolved geo but different metro/county/zip
    // signals (e.g., a freshly updated metro figure) gets a fresh response.
    const piqHash = createHash('sha1')
      .update(
        JSON.stringify({
          ctx: payload.piq ?? {},
          byGeo: payload.piqByGeo ?? {},
        }),
      )
      .digest('hex')
      .slice(0, 8);
    const rcHash = createHash('sha1')
      .update(JSON.stringify(payload.rentcast?.avm ?? {}))
      .digest('hex')
      .slice(0, 8);
    // Strategy is part of the key so switching between B&H / F&F / BRRRR on
    // the same property invalidates the prior response and re-asks the model
    // in the new strategy's terms.
    const strategy = payload.strategy ?? 'none';
    // Goal affects the recommendation_analysis prompt, which is one of the
    // six sections generated by the batched call. Include it for the batched
    // key (sectionId == 'batch') and for the legacy per-section recommendation
    // key. Other section keys ignore it so they reuse cached output across
    // goal switches.
    const includeGoal =
      sectionId === 'batch' || sectionId === 'recommendation_analysis';
    const goal = includeGoal ? (payload.goal ?? 'none') : 'none';
    // The projection section cites the 30-year wealth figures, which move with
    // appreciation/rent-growth assumptions. Fold rounded final equity into the
    // key (batch + projection sections) so an assumption edit regenerates the
    // tip instead of serving the prior projection's narrative.
    const includeProjection =
      sectionId === 'batch' || sectionId === 'projection';
    const proj = includeProjection
      ? Math.round((payload.projection?.finalEquity ?? 0) / 1000) * 1000
      : 'none';

    // The narrative cites the ENTIRE deal input plus whichever strategy
    // result(s) are populated (assemblePrompt JSON-stringifies both
    // verbatim into the prompt) — not just a handful of headline figures.
    // Built from the SAME canonical fingerprint the frontend's
    // use-section-ai-insights.ts discriminator calls (see
    // packages/analyzer-core/src/ai-cache-fingerprint.ts), so the two layers
    // can't independently drift on rounding rules or on which fields are
    // even tracked. Assumption/criteria edits (financing terms, vacancy
    // rate, flip/BRRRR outputs, etc.) move these while the resolved geo
    // stays identical, so they need their own key segment or an edit keeps
    // serving a narrative quoting the old numbers.
    const grading = payload.grading ?? {};
    const fingerprint = buildAiInsightsFingerprint({
      input: payload.input ?? null,
      rental: payload.result?.rental ?? null,
      flip: payload.result?.flip ?? null,
      brrrr: payload.result?.brrrr ?? null,
      finalGpa: grading.finalGpa,
      letter: grading.letter,
      autoKillCodes: (grading.autoKills ?? []).map(
        (k: { code?: string }) => k?.code ?? '',
      ),
      strategy,
      goal,
      projectionFinalEquity: includeProjection
        ? (payload.projection?.finalEquity ?? 0)
        : 0,
      piqByGeo: payload.piqByGeo,
      geoLevel:
        typeof payload.piq === 'object' &&
        payload.piq &&
        'geo_level' in payload.piq
          ? ((payload.piq as { geo_level?: string }).geo_level ?? '')
          : '',
    });
    const figuresHash = createHash('sha1')
      .update(fingerprint)
      .digest('hex')
      .slice(0, 8);
    return `ai-insights:${PROMPT_REVISION}:${sectionId}:${strategy}:${goal}:${proj}:${rcHash}:${piqHash}:${figuresHash}`;
  }

  /**
   * Parse the metadata segments back off a composite key. Lives next to
   * `computeKey` so the two can't drift on field order — a change to the key
   * format has to touch both, in one file, or the tests here fail.
   *
   * `computeKey` writes the literal string 'none' for an absent strategy or
   * goal; those become `null` columns rather than a magic string in the DB.
   */
  static parseKey(key: string, piqByGeo: unknown): InsightRowMeta {
    const [, promptRevision, sectionId, strategy, goal] = key.split(':');
    const denone = (v: string | undefined) => (v && v !== 'none' ? v : null);
    return {
      promptRevision: promptRevision ?? PROMPT_REVISION,
      sectionId: sectionId ?? 'unknown',
      strategy: denone(strategy),
      goal: denone(goal),
      piqByGeo,
    };
  }

  /**
   * Read order: Redis, then Postgres. A durable hit is promoted back into
   * Redis so the next read on this pod is hot again — that's what makes a
   * cold start (or a Redis restart) cost one Postgres lookup rather than one
   * LLM call per deal.
   *
   * Redis being unavailable is not an error here. `getClient()` returns null
   * when REDIS_URL is unset (local dev), and the durable tier alone is enough
   * to keep narratives stable across reloads.
   */
  async get(key: string): Promise<CachedInsight | null> {
    const client = this.redis.getClient();
    if (client) {
      const raw = await client.get(key);
      if (raw) return JSON.parse(raw);
    }

    const persisted = await this.store.get(key);
    if (!persisted) return null;

    if (client) {
      // Re-warm. Failure here is irrelevant — we already have the value.
      await client
        .set(key, JSON.stringify(persisted), 'EX', TTL_SECONDS)
        .catch(() => undefined);
    }
    return persisted;
  }

  /**
   * Write both tiers. Postgres is awaited (it's the one that has to survive);
   * `AiInsightsStore.set` already swallows its own failures, so a DB problem
   * degrades this to Redis-only rather than failing the request that
   * generated the narrative.
   */
  async set(
    key: string,
    value: CachedInsight,
    piqByGeo?: unknown,
  ): Promise<void> {
    const client = this.redis.getClient();
    if (client) {
      await client.set(key, JSON.stringify(value), 'EX', TTL_SECONDS);
    }
    await this.store.set(key, value, AiInsightsCache.parseKey(key, piqByGeo));
  }
}
