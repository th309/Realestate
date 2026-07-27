import { Test } from '@nestjs/testing';
import { AutoIdeationService } from './auto-ideation.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TriggerRuleEvaluatorService } from './trigger-rule-evaluator.service';
import { ContentRunsService } from '../content-runs.service';

describe('AutoIdeationService', () => {
  it('for each enabled rule, evaluates matches and creates runs', async () => {
    const rules = [
      {
        id: 'rule-1',
        rule_name: 'Rule 1',
        trigger_type: 'score_movement',
        trigger_config: {},
        target_format: 'score_mover',
        enabled: true,
      },
    ];
    const rulesQuery: any = {
      eq: jest.fn().mockReturnThis(),
      then: (resolve: any, reject: any) =>
        Promise.resolve({ data: rules, error: null }).then(resolve, reject),
    };
    const client = {
      from: jest.fn((tbl: string) => {
        if (tbl === 'auto_ideation_rules') {
          return {
            select: () => rulesQuery,
            update: () => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${tbl}`);
      }),
    };

    const evaluator = {
      evaluate: jest
        .fn()
        .mockResolvedValue([
          { geo: { canonical_name: 'Cleveland, OH' } },
          { geo: { canonical_name: 'Boise, ID' } },
        ]),
    };

    const createRun = jest.fn().mockResolvedValue({
      id: 'run-1',
      idempotencyKey: 'k',
      status: 'queued',
    });
    const runs = { createRun };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AutoIdeationService,
        { provide: SupabaseService, useValue: { getClient: () => client } },
        { provide: TriggerRuleEvaluatorService, useValue: evaluator },
        { provide: ContentRunsService, useValue: runs },
      ],
    }).compile();

    const svc = moduleRef.get(AutoIdeationService);
    await svc.runEnabledRules('score_movement');

    expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledTimes(2);
    expect(createRun.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        format: 'score_mover',
        marketQuery: 'Cleveland, OH',
        triggeredBy: 'auto_ideation',
        autoIdeationRuleName: 'Rule 1',
        autoIdeationRuleId: 'rule-1',
      }),
    );
  });

  it('stops enqueuing further matches when capped', async () => {
    const rules = [
      {
        id: 'rule-1',
        rule_name: 'Rule 1',
        trigger_type: 'score_movement',
        trigger_config: {},
        target_format: 'score_mover',
        enabled: true,
      },
    ];
    const rulesQuery: any = {
      eq: jest.fn().mockReturnThis(),
      then: (resolve: any, reject: any) =>
        Promise.resolve({ data: rules, error: null }).then(resolve, reject),
    };
    const client = {
      from: jest.fn((tbl: string) => {
        if (tbl === 'auto_ideation_rules') {
          return {
            select: () => rulesQuery,
            update: () => ({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${tbl}`);
      }),
    };

    const evaluator = {
      evaluate: jest
        .fn()
        .mockResolvedValue([
          { geo: { canonical_name: 'Cleveland, OH' } },
          { geo: { canonical_name: 'Boise, ID' } },
        ]),
    };

    const createRun = jest
      .fn()
      .mockResolvedValueOnce({ id: '', idempotencyKey: 'k', status: 'capped' });
    const runs = { createRun };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AutoIdeationService,
        { provide: SupabaseService, useValue: { getClient: () => client } },
        { provide: TriggerRuleEvaluatorService, useValue: evaluator },
        { provide: ContentRunsService, useValue: runs },
      ],
    }).compile();

    const svc = moduleRef.get(AutoIdeationService);
    await svc.runEnabledRules('score_movement');

    expect(createRun).toHaveBeenCalledTimes(1);
  });

  it('returns honest {matches, runsCreated} counts (capped runs not counted)', async () => {
    const evaluator = {
      evaluate: jest
        .fn()
        .mockResolvedValue([
          { geo: { canonical_name: 'Cleveland, OH' } },
          { geo: { canonical_name: 'Boise, ID' } },
          { geo: { canonical_name: 'Akron, OH' } },
        ]),
    };
    const createRun = jest
      .fn()
      .mockResolvedValueOnce({ status: 'queued' })
      .mockResolvedValueOnce({ status: 'queued' })
      .mockResolvedValueOnce({ status: 'capped' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AutoIdeationService,
        { provide: SupabaseService, useValue: { getClient: () => ({}) } },
        { provide: TriggerRuleEvaluatorService, useValue: evaluator },
        { provide: ContentRunsService, useValue: { createRun } },
      ],
    }).compile();

    const svc = moduleRef.get(AutoIdeationService);
    const result = await svc.evaluateAndEnqueue({
      id: 'r1',
      rule_name: 'R',
      target_format: 'score_mover',
    } as any);

    // 3 matched, 3rd was capped → only 2 runs created.
    expect(result).toEqual({ matches: 3, runsCreated: 2 });
  });
});
