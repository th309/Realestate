import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import type { FunnelStep, FunnelStepDef } from './user-analytics.types';
import { isMultiStep } from './user-analytics.types';
import { DEFAULT_TRAFFIC_SEGMENT, TrafficSegment } from './traffic-segment';

/**
 * Evaluates a saved funnel definition.
 *
 * Rewritten to intersect step-by-step in SQL. The previous implementation
 * pulled `user_events` into Node and intersected there, which failed three ways
 * at once: no `is_bot` filter (crawler visitors counted as participants), no
 * `.range()` (PostgREST capped the fetch at 1,000 of ~127,000 events, chosen
 * arbitrarily since there was no ORDER BY), and the query error was
 * destructured away, so any failure produced a confident all-zero funnel.
 */
@Injectable()
export class FunnelEngineService {
  private readonly logger = new Logger(FunnelEngineService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  async evaluateFunnel(
    funnelId: string,
    days: number,
    traffic: TrafficSegment = DEFAULT_TRAFFIC_SEGMENT,
  ): Promise<FunnelStep[]> {
    const cacheKey = `analytics:funnel:v2:${funnelId}:${days}:${traffic}`;
    const cached = await this.redis.getByKey(cacheKey);
    if (cached) return cached as FunnelStep[];

    const client = this.supabase.getClient();
    const startDate = new Date(Date.now() - days * 86400000).toISOString();

    const { data: funnel, error: funnelError } = await client
      .from('funnel_definitions')
      .select('*')
      .eq('id', funnelId)
      .single();

    if (funnelError || !funnel) {
      throw new Error(`Funnel ${funnelId} not found`);
    }

    const steps = funnel.steps as FunnelStepDef[];

    // Each step becomes an array of "category.action" matchers, ORed together.
    const matchers = steps.map((step) =>
      isMultiStep(step)
        ? step.any_of.map((m) => `${m.event_category}.${m.event_action}`)
        : [`${step.event_category}.${step.event_action}`],
    );

    const { data, error } = await client.rpc('analytics_sequential_funnel', {
      p_start: startDate,
      p_steps: matchers,
      p_traffic: traffic,
    });

    if (error) {
      // Surfaced rather than swallowed: an all-zero funnel and a failed query
      // are indistinguishable to the reader, so the failure must be loud.
      this.logger.error(
        `[FunnelEngine] Evaluation failed for ${funnelId}: ${error.message}`,
      );
      throw new Error(`Funnel evaluation failed: ${error.message}`);
    }

    const countByIndex = new Map<number, number>();
    for (const row of (data ?? []) as {
      step_index: number;
      visitors: number;
    }[]) {
      countByIndex.set(Number(row.step_index), Number(row.visitors));
    }

    const firstCount = countByIndex.get(0) ?? 0;
    const result: FunnelStep[] = steps.map((s, i) => {
      const count = countByIndex.get(i) ?? 0;
      const prevCount = i > 0 ? (countByIndex.get(i - 1) ?? 0) : count;
      return {
        name: stepName(s),
        count,
        rateFromPrevious: prevCount > 0 ? count / prevCount : 0,
        rateFromFirst: firstCount > 0 ? count / firstCount : 0,
      };
    });

    await this.redis.setByKey(cacheKey, result, 600);
    return result;
  }
}

function stepName(s: FunnelStepDef): string {
  if (s.label) return s.label;
  if (isMultiStep(s)) {
    return s.any_of
      .map((m) => `${m.event_category}.${m.event_action}`)
      .join(' | ');
  }
  return `${s.event_category}.${s.event_action}`;
}
