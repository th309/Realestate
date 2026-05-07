import { Test } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service';
import { TriggerRuleEvaluatorService } from './trigger-rule-evaluator.service';

describe('TriggerRuleEvaluatorService', () => {
  it('score_movement maps RPC rows to matches', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          geo_id: '12345',
          canonical_name: 'Cleveland, OH',
          current_score: 82,
          previous_score: 70,
          delta: 12,
        },
      ],
      error: null,
    });
    const client = { rpc };
    const supabase = { getClient: () => client };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggerRuleEvaluatorService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    const svc = moduleRef.get(TriggerRuleEvaluatorService);

    const matches = await svc.evaluate({
      id: 'r1',
      rule_name: 'move',
      trigger_type: 'score_movement',
      trigger_config: {
        min_delta_points: 10,
        direction: 'up',
        lookback_days: 30,
        geography: 'metro',
      },
      target_format: 'score_mover',
      enabled: true,
    } as any);

    expect(rpc).toHaveBeenCalledWith('auto_ideation_score_movement', expect.any(Object));
    expect(matches).toHaveLength(1);
    expect(matches[0].geo.canonical_name).toBe('Cleveland, OH');
    expect(matches[0].payload).toHaveProperty('delta', 12);
  });

  it('rank_change maps RPC rows to matches', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          geo_id: '12345',
          canonical_name: 'Cleveland, OH',
          current_rank: 3,
          previous_rank: 15,
          rank_delta: 12,
        },
      ],
      error: null,
    });
    const client = { rpc };
    const supabase = { getClient: () => client };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggerRuleEvaluatorService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    const svc = moduleRef.get(TriggerRuleEvaluatorService);

    const matches = await svc.evaluate({
      id: 'r1',
      rule_name: 'rank',
      trigger_type: 'rank_change',
      trigger_config: {
        min_rank_delta: 5,
        direction: 'up',
        geography: 'metro',
        top_n: 10,
      },
      target_format: 'top_10_ranking',
      enabled: true,
    } as any);

    expect(rpc).toHaveBeenCalledWith('auto_ideation_rank_change', expect.any(Object));
    expect(matches).toHaveLength(1);
    expect(matches[0].payload).toHaveProperty('rank_delta', 12);
  });

  it('threshold_cross rejects unknown metrics', async () => {
    const rpc = jest.fn();
    const client = { rpc };
    const supabase = { getClient: () => client };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggerRuleEvaluatorService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    const svc = moduleRef.get(TriggerRuleEvaluatorService);

    await expect(
      svc.evaluate({
        id: 'r1',
        rule_name: 'thr',
        trigger_type: 'threshold_cross',
        trigger_config: {
          threshold_value: 80,
          direction: 'up',
          metric: 'not_a_metric',
        },
        target_format: 'grade_reveal',
        enabled: true,
      } as any),
    ).rejects.toThrow('unsupported threshold metric');
    expect(rpc).not.toHaveBeenCalled();
  });
});

