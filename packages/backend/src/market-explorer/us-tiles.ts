import { stateAbbrByFips, stateFipsByAbbr } from './us-states';

/** US state tile grid [col,row] — same geometry ported for the frontend tile map. */
export const US_STATE_TILES: Record<string, [number, number]> = {
  AK: [0, 0],
  ME: [11, 0],
  VT: [10, 1],
  NH: [11, 1],
  WA: [1, 2],
  ID: [2, 2],
  MT: [3, 2],
  ND: [4, 2],
  MN: [5, 2],
  WI: [6, 2],
  MI: [8, 2],
  NY: [9, 2],
  MA: [10, 2],
  RI: [11, 2],
  OR: [1, 3],
  NV: [2, 3],
  WY: [3, 3],
  SD: [4, 3],
  IA: [5, 3],
  IL: [6, 3],
  IN: [7, 3],
  OH: [8, 3],
  PA: [9, 3],
  NJ: [10, 3],
  CT: [11, 3],
  CA: [1, 4],
  UT: [2, 4],
  CO: [3, 4],
  NE: [4, 4],
  MO: [5, 4],
  KY: [6, 4],
  WV: [7, 4],
  VA: [8, 4],
  MD: [9, 4],
  DE: [10, 4],
  AZ: [2, 5],
  NM: [3, 5],
  KS: [4, 5],
  AR: [5, 5],
  TN: [6, 5],
  NC: [7, 5],
  SC: [8, 5],
  DC: [9, 5],
  OK: [3, 6],
  LA: [4, 6],
  MS: [5, 6],
  AL: [6, 6],
  GA: [7, 6],
  HI: [0, 7],
  TX: [3, 7],
  FL: [8, 7],
};

/** State FIPS codes whose tile is within one grid cell (Chebyshev ≤1) of `fips`. */
export function adjacentStateFips(fips: string): string[] {
  const abbr = stateAbbrByFips[fips];
  const t0 = abbr ? US_STATE_TILES[abbr] : undefined;
  if (!t0) return [];
  const out: string[] = [];
  for (const [a, [c, r]] of Object.entries(US_STATE_TILES)) {
    if (a === abbr) continue;
    if (Math.abs(c - t0[0]) <= 1 && Math.abs(r - t0[1]) <= 1) {
      const f = stateFipsByAbbr[a];
      if (f) out.push(f);
    }
  }
  return out;
}
