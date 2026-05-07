import { Test } from '@nestjs/testing';
import { CostCapService } from './cost-cap.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('CostCapService', () => {
  let svc: CostCapService;

  beforeEach(async () => {
    process.env.CONTENT_PIPELINE_DAILY_USD_MAX = '50';

    const client = {
      from: jest.fn().mockImplementation((tbl: string) => {
        if (tbl === 'cost_cap_daily') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { usd_spent: 45, usd_cap: 50 },
                    error: null,
                  }),
              }),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        if (tbl === 'format_daily_run_counts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { run_count: 5 }, error: null }),
                }),
              }),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };
    const supabase = { getClient: () => client };

    const module = await Test.createTestingModule({
      providers: [
        CostCapService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();

    svc = module.get(CostCapService);
  });

  it('allows when estimated cost fits remaining budget', async () => {
    const result = await svc.canEnqueue(2);
    expect(result.allowed).toBe(true);
    expect(result.remainingUsd).toBeCloseTo(5, 2);
  });

  it('blocks when estimate exceeds remaining', async () => {
    const result = await svc.canEnqueue(10);
    expect(result.allowed).toBe(false);
  });

  it('per-format cap respects env var', async () => {
    process.env.CONTENT_PIPELINE_FORMAT_DAILY_CAP_SCORE_MOVER = '5';
    const result = await svc.canEnqueueFormat('score_mover');
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(5);
    expect(result.cap).toBe(5);
  });
});

