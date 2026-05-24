import { mergeMosFallback } from '../v4-scoring-data-fetcher';

describe('mergeMosFallback', () => {
  it('fills missing months_of_supply from the calculated map; legacy wins', () => {
    const locs = [
      { location_id: '35620', months_of_supply: 2.5 }, // legacy present -> keep
      { location_id: '16980' }, // missing -> fill 4.0
      { location_id: '31080', months_of_supply: undefined }, // missing -> fill 1.2
    ] as any[];
    const calc = new Map<string, number>([
      ['35620', 9.9],
      ['16980', 4.0],
      ['31080', 1.2],
    ]);
    mergeMosFallback(locs, calc);
    expect(locs[0].months_of_supply).toBe(2.5); // legacy preserved
    expect(locs[1].months_of_supply).toBe(4.0);
    expect(locs[2].months_of_supply).toBe(1.2);
  });

  it('is a no-op when no calculated value exists for the region', () => {
    const locs = [{ location_id: '99999' }] as any[];
    mergeMosFallback(locs, new Map());
    expect(locs[0].months_of_supply).toBeUndefined();
  });
});
