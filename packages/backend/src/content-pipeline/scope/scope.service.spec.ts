import { ScopeService } from './scope.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('ScopeService.resolve', () => {
  function buildHarness(rows: any[]) {
    const queryFn = jest.fn().mockResolvedValue({ data: rows, error: null });
    const supabase = {
      getClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: () => ({
                then: (cb: any) => cb({ data: rows, error: null }),
              }),
            }),
            in: () => ({
              limit: () => ({
                then: (cb: any) => cb({ data: rows, error: null }),
              }),
            }),
          }),
        }),
        rpc: queryFn,
      }),
    } as unknown as SupabaseService;
    return { svc: new ScopeService(supabase), queryFn };
  }

  it('rejects metros_in_state with no state', async () => {
    const { svc } = buildHarness([]);
    await expect(
      svc.resolve({ type: 'metros_in_state' } as any),
    ).rejects.toThrow(/state required/);
  });

  it('rejects zips_in_metro with no cbsaCode', async () => {
    const { svc } = buildHarness([]);
    await expect(svc.resolve({ type: 'zips_in_metro' } as any)).rejects.toThrow(
      /cbsaCode required/,
    );
  });

  it('rejects custom with empty codes', async () => {
    const { svc } = buildHarness([]);
    await expect(
      svc.resolve({ type: 'custom', codes: [] } as any),
    ).rejects.toThrow(/codes required/);
  });

  it('separates valid from unrecognized for custom type', async () => {
    const validCbsa = {
      id: '12420',
      geography: 'metro',
      canonical_name: 'Austin, TX',
      population: 2295303,
      score: 72,
    };
    const validZip = {
      id: '78704',
      geography: 'zip',
      canonical_name: 'ZIP 78704 (Austin, TX)',
      population: 50000,
      score: 80,
    };
    const { svc } = buildHarness([validCbsa, validZip]);
    const spy = jest.spyOn(svc as any, 'resolveCustom').mockResolvedValue({
      markets: [validCbsa, validZip],
      truncated: false,
      unrecognized: ['99999'],
    });
    const result = await svc.resolve({
      type: 'custom',
      codes: ['12420', '78704', '99999'],
    });
    expect(result.markets).toHaveLength(2);
    expect(result.unrecognized).toEqual(['99999']);
    spy.mockRestore();
  });
});
