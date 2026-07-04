/**
 * Tests for the safety-critical Redfin DC metro name -> canonical CBSA crosswalk
 * (redfin-dc-metro-crosswalk.ts). The existing redfin-dc-geo-resolver.spec.ts
 * only covers string helpers; this file exercises resolveMetroCanonicalId, whose
 * correctness decides whether a metro is keyed to the right CBSA (a mis-key
 * silently blanks the metro's cards) — plus the FIX 1 range-pagination that keeps
 * the tiger_cbsa cache from truncating at the PostgREST ~1000-row cap.
 *
 * A minimal fake supabase returns fixture tiger_cbsa rows through the paginated
 * .select().order().range() shape the crosswalk uses (range() is terminal and
 * slices by [from, to], so a short final page ends the loop — matching real
 * PostgREST semantics).
 */

import {
  resolveMetroCanonicalId,
  clearMetroCanonCache,
} from "../redfin-dc-metro-crosswalk";

interface CbsaRow {
  geoid: string;
  name: string;
}

/**
 * Fake supabase whose tiger_cbsa reads honor `.range(from, to)` by slicing the
 * fixture, so the crosswalk's pagination loop terminates on a short page exactly
 * as it would against PostgREST. `rangeCalls` records each page's `from` offset.
 */
function makeFakeSupabase(cbsaRows: CbsaRow[]): {
  supabase: any;
  rangeCalls: number[];
} {
  const rangeCalls: number[] = [];
  const supabase = {
    from(table: string) {
      if (table !== "tiger_cbsa") {
        throw new Error(`unexpected table read: ${table}`);
      }
      const builder: any = {
        select: () => builder,
        order: () => builder,
        range: (from: number, to: number) => {
          rangeCalls.push(from);
          return Promise.resolve({
            data: cbsaRows.slice(from, to + 1),
            error: null,
          });
        },
      };
      return builder;
    },
  };
  return { supabase, rangeCalls };
}

const SAMPLE_CBSA: CbsaRow[] = [
  { geoid: "16740", name: "Charlotte-Concord-Gastonia, NC-SC" },
  { geoid: "16820", name: "Charlottesville, VA" },
  { geoid: "38900", name: "Portland-Vancouver-Hillsboro, OR-WA" },
  { geoid: "38860", name: "Portland-South Portland, ME" },
  { geoid: "31080", name: "Los Angeles-Long Beach-Anaheim, CA" },
  // Constructed same-state collision (two "ZZ" CBSAs both containing the token
  // "springfield") to exercise the fail-closed ambiguous path deterministically.
  { geoid: "90001", name: "Springfield-North, ZZ" },
  { geoid: "90002", name: "Springfield-South, ZZ" },
];

describe("resolveMetroCanonicalId (redfin-dc metro crosswalk)", () => {
  beforeEach(() => clearMetroCanonCache());

  it("disambiguates same-city/different-state metros by the state token", async () => {
    const { supabase } = makeFakeSupabase(SAMPLE_CBSA);
    // Charlotte, NC -> Charlotte-Concord-Gastonia (16740), NOT Charlottesville, VA (16820).
    expect(await resolveMetroCanonicalId(supabase, "charlotte", "NC")).toBe(
      "16740",
    );
    // Portland, OR -> Portland-Vancouver-Hillsboro (38900), NOT Portland-South Portland, ME (38860).
    expect(await resolveMetroCanonicalId(supabase, "portland", "OR")).toBe(
      "38900",
    );
  });

  it("resolves a metro DIVISION city to its parent CBSA", async () => {
    const { supabase } = makeFakeSupabase(SAMPLE_CBSA);
    // Anaheim is a division of Los Angeles-Long Beach-Anaheim, CA (31080).
    expect(await resolveMetroCanonicalId(supabase, "anaheim", "CA")).toBe(
      "31080",
    );
  });

  it("returns null (fail-closed) when >1 in-state CBSA matches the city", async () => {
    const { supabase } = makeFakeSupabase(SAMPLE_CBSA);
    // Two "ZZ" CBSAs contain "springfield" -> ambiguous -> null, never an arbitrary pick.
    expect(
      await resolveMetroCanonicalId(supabase, "springfield", "ZZ"),
    ).toBeNull();
  });

  it("returns null for an unmatched city or a missing state token", async () => {
    const { supabase } = makeFakeSupabase(SAMPLE_CBSA);
    expect(
      await resolveMetroCanonicalId(supabase, "nowheresville", "CA"),
    ).toBeNull();
    // No trailing state parsed by the caller -> empty stateCode.
    expect(await resolveMetroCanonicalId(supabase, "charlotte", "")).toBeNull();
    expect(await resolveMetroCanonicalId(supabase, "", "NC")).toBeNull();
  });

  it("range-paginates so CBSAs beyond the ~1000-row cap still resolve", async () => {
    // 1100 filler rows in an unused state, THEN the real rows — so 16740 sits
    // past index 1000, unreachable by an unpaginated select capped at ~1000.
    const filler: CbsaRow[] = Array.from({ length: 1100 }, (_, i) => ({
      geoid: `70${String(i).padStart(4, "0")}`,
      name: `Filler${i}, ZY`,
    }));
    const { supabase, rangeCalls } = makeFakeSupabase([
      ...filler,
      ...SAMPLE_CBSA,
    ]);

    // Only reachable if pagination continues past the first ~1000 rows.
    expect(await resolveMetroCanonicalId(supabase, "charlotte", "NC")).toBe(
      "16740",
    );
    // 1107 rows at 500/page -> pages start at 0, 500, 1000 (3rd page is short).
    expect(rangeCalls).toEqual([0, 500, 1000]);
  });
});
