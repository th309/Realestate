import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import type { FunnelStep, FunnelStepDef } from './user-analytics.types';
import { isMultiStep } from './user-analytics.types';

@Injectable()
export class FunnelEngineService {
  private readonly logger = new Logger(FunnelEngineService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  async evaluateFunnel(funnelId: string, days: number): Promise<FunnelStep[]> {
    const cacheKey = `analytics:funnel:${funnelId}:${days}`;
    const cached = await this.redis.getByKey(cacheKey);
    if (cached) return cached as FunnelStep[];

    const client = this.supabase.getClient();
    const startDate = new Date(Date.now() - days * 86400000).toISOString();

    // Load funnel definition
    const { data: funnel } = await client
      .from('funnel_definitions')
      .select('*')
      .eq('id', funnelId)
      .single();

    if (!funnel) throw new Error(`Funnel ${funnelId} not found`);

    const steps = funnel.steps as FunnelStepDef[];

    // Precompute matchers per step: a step matches if a visitor fired ANY of its matchers.
    // Single-event steps collapse to a 1-element matcher array.
    const matchersPerStep = steps.map((step) =>
      isMultiStep(step)
        ? step.any_of
        : [
            {
              event_category: step.event_category,
              event_action: step.event_action,
            },
          ],
    );

    const stepName = (s: FunnelStepDef): string => {
      if (s.label) return s.label;
      if (isMultiStep(s)) {
        return s.any_of
          .map((m) => `${m.event_category}.${m.event_action}`)
          .join(' | ');
      }
      return `${s.event_category}.${s.event_action}`;
    };

    // For each step, find visitors who completed that step AND all previous steps
    const { data: events } = await client
      .from('user_events')
      .select('visitor_id, event_category, event_action')
      .gte('created_at', startDate);

    if (!events?.length) {
      return steps.map((s) => ({
        name: stepName(s),
        count: 0,
        rateFromPrevious: 0,
        rateFromFirst: 0,
      }));
    }

    // Build visitor sets per step using sequential intersection
    const visitorsByStep: Set<string>[] = [];
    for (let i = 0; i < steps.length; i++) {
      const matchers = matchersPerStep[i];
      const matchingVisitors = new Set(
        events
          .filter((e) =>
            matchers.some(
              (m) =>
                e.event_category === m.event_category &&
                e.event_action === m.event_action,
            ),
          )
          .map((e) => e.visitor_id),
      );

      if (i === 0) {
        visitorsByStep.push(matchingVisitors);
      } else {
        // Intersection with previous step's visitors
        const prev = visitorsByStep[i - 1];
        const intersected = new Set(
          [...matchingVisitors].filter((v) => prev.has(v)),
        );
        visitorsByStep.push(intersected);
      }
    }

    const firstCount = visitorsByStep[0]?.size || 0;
    const result: FunnelStep[] = steps.map((s, i) => {
      const count = visitorsByStep[i]?.size || 0;
      const prevCount = i > 0 ? visitorsByStep[i - 1]?.size || 0 : count;
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
