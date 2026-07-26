import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  AutoIdeationRule,
  RankChangeConfig,
  ScoreMovementConfig,
  ThresholdCrossConfig,
  TriggerMatch,
} from './trigger-rule.types';

const THRESHOLD_METRICS: ReadonlySet<string> = new Set(['propertyiq_score']);

@Injectable()
export class TriggerRuleEvaluatorService {
  constructor(private readonly supabase: SupabaseService) {}

  async evaluate(rule: AutoIdeationRule): Promise<TriggerMatch[]> {
    switch (rule.trigger_type) {
      case 'score_movement':
        return this.evaluateScoreMovement(
          rule.trigger_config as ScoreMovementConfig,
        );
      case 'rank_change':
        return this.evaluateRankChange(rule.trigger_config as RankChangeConfig);
      case 'threshold_cross':
        return this.evaluateThresholdCross(
          rule.trigger_config as ThresholdCrossConfig,
        );
    }
  }

  private async evaluateScoreMovement(
    config: ScoreMovementConfig,
  ): Promise<TriggerMatch[]> {
    const client = this.supabase.getClient();
    // Guard against a missing/NaN lookback_days: new Date(NaN).toISOString() throws
    // a RangeError, which on the fire-now path would surface as an unshaped 500.
    if (!Number.isFinite(config.lookback_days) || config.lookback_days <= 0) {
      throw new BadRequestException(
        'score_movement lookback_days must be a positive number',
      );
    }
    const lookback = new Date(
      Date.now() - config.lookback_days * 24 * 3600 * 1000,
    ).toISOString();
    const { data, error } = await client.rpc('auto_ideation_score_movement', {
      p_geography: config.geography,
      p_lookback: lookback,
      p_min_delta: config.min_delta_points,
      p_direction: config.direction,
    });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      geo: {
        geography: config.geography,
        id: String(r.geo_id),
        canonical_name: String(r.canonical_name),
      },
      payload: {
        current_score: r.current_score,
        previous_score: r.previous_score,
        delta: r.delta,
      },
    }));
  }

  private async evaluateRankChange(
    config: RankChangeConfig,
  ): Promise<TriggerMatch[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('auto_ideation_rank_change', {
      p_geography: config.geography,
      p_top_n: config.top_n,
      p_min_delta: config.min_rank_delta,
      p_direction: config.direction,
    });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      geo: {
        geography: config.geography,
        id: String(r.geo_id),
        canonical_name: String(r.canonical_name),
      },
      payload: {
        current_rank: r.current_rank,
        previous_rank: r.previous_rank,
        rank_delta: r.rank_delta,
      },
    }));
  }

  private async evaluateThresholdCross(
    config: ThresholdCrossConfig,
  ): Promise<TriggerMatch[]> {
    if (!THRESHOLD_METRICS.has(config.metric)) {
      throw new Error(`unsupported threshold metric: ${config.metric}`);
    }
    const client = this.supabase.getClient();
    const { data, error } = await client.rpc('auto_ideation_threshold_cross', {
      p_metric: config.metric,
      p_threshold: config.threshold_value,
      p_direction: config.direction,
    });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      geo: {
        geography: 'mixed',
        id: String(r.geo_id),
        canonical_name: String(r.canonical_name),
      },
      payload: {
        metric: config.metric,
        threshold: config.threshold_value,
        direction: config.direction,
        current_value: r.current_value,
        previous_value: r.previous_value,
      },
    }));
  }
}
