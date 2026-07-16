import { MarketExplorerService } from '../market-explorer.service';

describe('MarketExplorerService.getScopeSeries', () => {
  it('state scope: uses stateRegions + RPC and aligns to a shared axis', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: [
          { state_fips: '48', score_date: '2026-04-01', avg_score: 54 },
          { state_fips: '48', score_date: '2026-05-01', avg_score: 55 },
          { state_fips: '06', score_date: '2026-05-01', avg_score: 60 },
        ],
        error: null,
      }),
    } as any;
    const service = new MarketExplorerService(supabase);
    const res = await service.getScopeSeries('state', {
      metric: 'propertyiq_score',
      months: 3,
    } as any);
    expect(res.regions.length).toBe(51);
    expect(res.dates).toEqual(['2026-03-01', '2026-04-01', '2026-05-01']);
    expect(res.series['48']).toEqual([null, 54, 55]);
    expect(res.series['06']).toEqual([null, null, 60]);
  });

  it('national metro scope: roster from screener_snapshot, series from the metric table', async () => {
    const builder = (rows: any[]) => {
      const b: any = {
        select: () => b,
        eq: () => b,
        in: () => b,
        gte: () => b,
        not: () => b,
        order: () => b,
        limit: () => b,
        range: async (from: number) => ({
          data: from === 0 ? rows : [],
          error: null,
        }),
        then: (r: any) => Promise.resolve({ data: rows, error: null }).then(r),
      };
      return b;
    };
    const supabase = {
      from: (table: string) =>
        table === 'screener_snapshot'
          ? builder([
              {
                region_id: '35620',
                region_name: 'New York',
                state_code: 'NY',
                population: 20000000,
              },
            ])
          : builder([
              { cbsa_code: '35620', period_date: '2026-05-01', value: 700000 },
            ]),
      rpc: jest.fn(),
    } as any;
    const service = new MarketExplorerService(supabase);
    const res = await service.getScopeSeries('metro', {
      metric: 'home_value',
      months: 2,
    } as any);
    expect(res.regions[0].id).toBe('35620');
    expect(res.series['35620'][res.dates.length - 1]).toBe(700000);
  });
});
