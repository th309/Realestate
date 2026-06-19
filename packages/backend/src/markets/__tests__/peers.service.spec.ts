import { Test } from '@nestjs/testing';
import { PeersService } from '../peers.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('PeersService', () => {
  let service: PeersService;
  let supabase: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PeersService,
        { provide: SupabaseService, useValue: { from: jest.fn() } },
      ],
    }).compile();
    service = module.get(PeersService);
    supabase = module.get(SupabaseService);
  });

  // A chainable + thenable Supabase query stub. The real PostgREST builder is
  // awaited at its terminal method, so the stub records which methods were
  // called and resolves via `resolver(calls)` when awaited.
  function builder(
    resolver: (calls: Set<string>) => { data: unknown; error: unknown },
  ) {
    const calls = new Set<string>();
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'order', 'limit', 'in']) {
      chain[m] = jest.fn(() => {
        calls.add(m);
        return chain;
      });
    }
    (chain as { then: unknown }).then = (
      onFulfilled: (v: unknown) => unknown,
    ) => Promise.resolve(resolver(calls)).then(onFulfilled);
    return chain;
  }

  it('returns top-3 peers ranked by score-similarity within parent metro', async () => {
    supabase.from.mockImplementation(
      (table: string) =>
        builder((calls) => {
          if (table === 'geographies') {
            return {
              data: [
                {
                  geography_id: 'apex-nc',
                  name: 'Apex, NC',
                  population: 22000,
                },
                {
                  geography_id: 'holly-springs-nc',
                  name: 'Holly Springs, NC',
                  population: 14000,
                },
                {
                  geography_id: 'morrisville-nc',
                  name: 'Morrisville, NC',
                  population: 12000,
                },
              ],
              error: null,
            };
          }
          // propertyiq_scores: the `.in(...)` chunk fetches candidate scores;
          // the `.order(...)` chain is the latest-score-date probe.
          if (calls.has('in')) {
            return {
              data: [
                { location_id: 'apex-nc', score: 81 },
                { location_id: 'holly-springs-nc', score: 79 },
                { location_id: 'morrisville-nc', score: 84 },
              ],
              error: null,
            };
          }
          return { data: [{ score_date: '2026-05-31' }], error: null };
        }) as never,
    );

    const peers = await service.findPeers({
      geoLevel: 'city',
      geoId: 'cary-nc',
      score: 87,
      parentMetro: '39580',
      householdCount: 62000,
    });

    expect(peers).toHaveLength(3);
    // Combined distance = scoreDist + sizeDist*10. Input score=87, hh=62000:
    //   Morrisville (84, 12000): 3 + (50000/62000)*10 = ~11.06
    //   Apex        (81, 22000): 6 + (40000/62000)*10 = ~12.45
    //   Holly Spr.  (79, 14000): 8 + (48000/62000)*10 = ~15.74
    expect(peers.map((p) => p.geoId)).toEqual([
      'morrisville-nc',
      'apex-nc',
      'holly-springs-nc',
    ]);
  });

  it('getScore returns the latest PropertyIQ score', async () => {
    supabase.from.mockImplementation(
      () => builder(() => ({ data: [{ score: 73 }], error: null })) as never,
    );
    expect(await service.getScore('metro', '16740')).toBe(73);
  });

  it('getScore returns null for an unscored market', async () => {
    supabase.from.mockImplementation(
      () => builder(() => ({ data: [], error: null })) as never,
    );
    expect(await service.getScore('metro', '99999')).toBeNull();
  });
});
