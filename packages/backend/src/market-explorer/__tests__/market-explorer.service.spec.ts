import { MarketExplorerService } from '../market-explorer.service';
import { RedisService } from '../../redis/redis.service';

function fakeRedis(overrides: Partial<RedisService> = {}): RedisService {
  return {
    getByKey: jest.fn().mockResolvedValue(null),
    setByKey: jest.fn().mockResolvedValue(true),
    ...overrides,
  } as any;
}

describe('MarketExplorerService.getScopeSeries', () => {
  it('state scope: uses stateRegions + RPC and returns a combined multi-metric response, no totalAvailable', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: [
          { state_fips: '48', score_date: '2026-04-01', avg_score: 54 },
          { state_fips: '48', score_date: '2026-05-01', avg_score: 55 },
          { state_fips: '06', score_date: '2026-05-01', avg_score: 60 },
        ],
        error: null,
      }),
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gte() {
          return this;
        },
        not() {
          return this;
        },
        order() {
          return this;
        },
        range: async () => ({ data: [], error: null }),
      }),
    } as any;
    const service = new MarketExplorerService(supabase, fakeRedis());
    const res = await service.getScopeSeries('state', { months: 3 } as any);
    expect(res.regions.length).toBe(51);
    expect(res.dates).toEqual(['2026-03-01', '2026-04-01', '2026-05-01']);
    expect(res.series.propertyiq_score['48']).toEqual([null, 54, 55]);
    expect(res.series.propertyiq_score['06']).toEqual([null, null, 60]);
    expect(Object.keys(res.series).sort()).toEqual(
      [
        'days_on_market',
        'for_sale_inventory',
        'home_sales',
        'home_value',
        'hotness_score',
        'new_listings',
        'propertyiq_score',
        'rent_index',
      ].sort(),
    );
    expect((res as any).metric).toBeUndefined();
    expect(res.totalAvailable).toBeUndefined();
  });

  it('national metro scope: roster from screener_snapshot, at least one metric series populated per region', async () => {
    let snapshotCalls = 0;
    const supabase = {
      rpc: jest.fn(),
      from: (table: string) => {
        if (table === 'screener_snapshot') {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            order() {
              return this;
            },
            range: async (from: number) => {
              snapshotCalls++;
              return {
                data:
                  from === 0
                    ? [
                        {
                          region_id: '35620',
                          region_name: 'New York',
                          state_code: 'NY',
                          population: 20000000,
                        },
                      ]
                    : [],
                error: null,
              };
            },
          };
        }
        if (table === 'propertyiq_scores') {
          return {
            select() {
              return this;
            },
            in() {
              return this;
            },
            gte() {
              return this;
            },
            eq() {
              return this;
            },
            order() {
              return this;
            },
            range: async (from: number) => ({
              data:
                from === 0
                  ? [
                      {
                        location_id: '35620',
                        score_date: '2026-05-01',
                        score: 65,
                      },
                    ]
                  : [],
              error: null,
            }),
          };
        }
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          gte() {
            return this;
          },
          order() {
            return this;
          },
          range: async () => ({ data: [], error: null }),
        };
      },
    } as any;
    const service = new MarketExplorerService(supabase, fakeRedis());
    const res = await service.getScopeSeries('metro', { months: 2 } as any);
    expect(res.regions[0].id).toBe('35620');
    expect(snapshotCalls).toBeGreaterThan(0);
    expect(Object.keys(res.series)).toContain('propertyiq_score');
    expect(res.series.propertyiq_score['35620']).toEqual([null, 65]);
    expect(res.totalAvailable).toBeUndefined(); // national metro is uncapped, so no cap was applied
  });

  it('zip scope: includes totalAvailable when the roster was actually capped', async () => {
    const supabase = {
      rpc: jest.fn(),
      from: (table: string) => {
        if (table === 'geography_crosswalk') {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  limit: async () => ({
                    data: Array.from({ length: 90 }, (_, i) => ({
                      zip_code: `Z${i}`,
                    })),
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'screener_snapshot') {
          return {
            select: (_cols: string, opts?: { count?: string }) => {
              if (opts?.count) {
                return {
                  eq: () => ({ in: async () => ({ count: 90, error: null }) }),
                };
              }
              return {
                eq: () => ({
                  in: async (_c: string, ids: string[]) => ({
                    data: ids.slice(0, 70).map((id, i) => ({
                      region_id: id,
                      region_name: id,
                      state_code: 'CA',
                      population: 90 - i,
                    })),
                    error: null,
                  }),
                }),
              };
            },
          };
        }
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          gte() {
            return this;
          },
          order() {
            return this;
          },
          range: async () => ({ data: [], error: null }),
        };
      },
    } as any;
    const service = new MarketExplorerService(supabase, fakeRedis());
    const res = await service.getScopeSeries('zip', {
      parentLevel: 'county',
      parentId: '06037',
      months: 1,
    } as any);
    expect(res.regions.length).toBe(70);
    expect(res.totalAvailable).toBe(90);
  });
});

describe('MarketExplorerService caching', () => {
  it('returns the cached value on hit without touching Supabase', async () => {
    const cachedResponse = {
      success: true,
      geoLevel: 'state',
      months: 3,
      dates: ['2026-05-01'],
      regions: [],
      series: {},
    };
    const supabase = {
      rpc: jest
        .fn()
        .mockRejectedValue(new Error('should not be called on cache hit')),
    } as any;
    const redis = fakeRedis({
      getByKey: jest.fn().mockResolvedValue(cachedResponse),
    });
    const service = new MarketExplorerService(supabase, redis);
    const res = await service.getScopeSeries('state', { months: 3 } as any);
    expect(res).toEqual(cachedResponse);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('on cache miss, builds the response and writes it back with the pipeline-aligned TTL', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gte() {
          return this;
        },
        not() {
          return this;
        },
        order() {
          return this;
        },
        range: async () => ({ data: [], error: null }),
      }),
    } as any;
    const redis = fakeRedis();
    const service = new MarketExplorerService(supabase, redis);
    await service.getScopeSeries('state', { months: 3 } as any);
    expect(redis.setByKey).toHaveBeenCalledTimes(1);
    const [key, , ttlSeconds] = (redis.setByKey as jest.Mock).mock.calls[0];
    expect(key).toBe('market-explorer:v2:state:::false');
    expect(ttlSeconds).toBeGreaterThan(0);
  });

  it('still returns a correct built result when Redis is unavailable (getByKey/setByKey no-op)', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: [{ state_fips: '48', score_date: '2026-05-01', avg_score: 61 }],
        error: null,
      }),
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gte() {
          return this;
        },
        not() {
          return this;
        },
        order() {
          return this;
        },
        range: async () => ({ data: [], error: null }),
      }),
    } as any;
    const redis = fakeRedis({
      getByKey: jest.fn().mockResolvedValue(null),
      setByKey: jest.fn().mockResolvedValue(false),
    });
    const service = new MarketExplorerService(supabase, redis);
    const res = await service.getScopeSeries('state', { months: 1 } as any);
    expect(res.series.propertyiq_score['48']).toEqual([61]);
  });
});
