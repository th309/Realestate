/**
 * Tests for the post-import metro-key guard (redfin-dc-metro-key-validator.ts).
 *
 * Covers the pure detector (clean / STATE_MISMATCH / NO_CANONICAL_CBSA /
 * NON_NUMERIC_KEY) and the DB wrapper against a minimal fake supabase client:
 * (a) empty metros -> passes, (b) a STATE_MISMATCH row -> throws.
 */

import {
  detectMetroKeyViolations,
  validateRedfinDcMetroKeys,
  type RedfinMetroRow,
} from "../redfin-dc-metro-key-validator";

// A geoid -> canonical CBSA name map, as built from tiger_cbsa.
const CBSA = new Map<string, string>([
  ["10900", "Allentown-Bethlehem-Easton, PA-NJ"],
  ["16740", "Charlotte-Concord-Gastonia, NC-SC"],
  ["16820", "Charlottesville, VA"],
]);

describe("detectMetroKeyViolations", () => {
  it("returns no violations when every metro state matches its CBSA state", () => {
    const metros: RedfinMetroRow[] = [
      // Redfin single-state name vs canonical multi-state suffix — PA ∈ [PA,NJ].
      { region_id: "10900", region_name: "Allentown, PA metro area" },
      // Charlotte correctly keyed to 16740 (NC-SC) — NC ∈ [NC,SC].
      { region_id: "16740", region_name: "Charlotte, NC metro area" },
    ];
    expect(detectMetroKeyViolations(metros, CBSA)).toEqual([]);
  });

  it("flags a STATE_MISMATCH when a metro is keyed to a wrong-state CBSA", () => {
    // The original bug: "Charlotte, NC" filed under 16820 = Charlottesville, VA.
    const metros: RedfinMetroRow[] = [
      { region_id: "16820", region_name: "Charlotte, NC metro area" },
    ];
    expect(detectMetroKeyViolations(metros, CBSA)).toEqual([
      {
        region_id: "16820",
        region_name: "Charlotte, NC metro area",
        canonical_name: "Charlottesville, VA",
        reason: "STATE_MISMATCH",
      },
    ]);
  });

  it("flags NO_CANONICAL_CBSA when the region_id has no tiger_cbsa entry", () => {
    const metros: RedfinMetroRow[] = [
      { region_id: "99999", region_name: "Nowhere, ZZ metro area" },
    ];
    const [v] = detectMetroKeyViolations(metros, CBSA);
    expect(v.reason).toBe("NO_CANONICAL_CBSA");
    expect(v.canonical_name).toBeNull();
  });

  it("flags NON_NUMERIC_KEY when the region_id is not all digits", () => {
    const metros: RedfinMetroRow[] = [
      { region_id: "REDFIN-METRO-X", region_name: "Somewhere, TX metro area" },
    ];
    expect(detectMetroKeyViolations(metros, CBSA)[0].reason).toBe(
      "NON_NUMERIC_KEY",
    );
  });
});

/**
 * Minimal fake supabase client. Each table returns all its rows on the first
 * range() page (test tables are < the 1000-row page size) and empty after.
 */
function makeFakeSupabase(tables: Record<string, unknown[]>): any {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder: any = {
        select: () => builder,
        order: () => builder,
        range: (from: number) =>
          Promise.resolve({ data: from === 0 ? rows : [], error: null }),
      };
      return builder;
    },
  };
}

const TIGER_ROWS = [
  { geoid: "16740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  { geoid: "16820", name: "Charlottesville, VA" },
];

describe("validateRedfinDcMetroKeys", () => {
  it("passes (no throw) when there are no metros to validate", async () => {
    const supabase = makeFakeSupabase({
      redfin_dc_housing_market_metro: [],
      tiger_cbsa: TIGER_ROWS,
    });
    await expect(validateRedfinDcMetroKeys(supabase)).resolves.toBeUndefined();
  });

  it("throws when a metro is mis-keyed to a wrong-state CBSA", async () => {
    const supabase = makeFakeSupabase({
      redfin_dc_housing_market_metro: [
        { region_id: "16820", region_name: "Charlotte, NC metro area" },
      ],
      tiger_cbsa: TIGER_ROWS,
    });
    await expect(validateRedfinDcMetroKeys(supabase)).rejects.toThrow(
      /metro key validation failed/i,
    );
  });
});
