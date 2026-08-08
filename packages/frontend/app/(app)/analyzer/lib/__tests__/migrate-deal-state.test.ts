import { describe, it, expect } from "vitest";
import { migrateDealState } from "../migrate-snapshot";
import { DEFAULT_ASSUMPTIONS } from "../analyzer-assumptions";

const V1_ROW = {
  id: "row-1",
  label: null,
  address_full: "99 Oak Ave, Dallas, TX",
  address_city: "Dallas",
  address_state: "TX",
  address_zip: "75201",
  updated_at: "2026-05-01T00:00:00.000Z",
  input_snapshot: {
    price: 250_000,
    rentMonthly: 2000,
    financing: { interestRatePct: 6.5 },
  },
  result_snapshot: {
    input: { price: 250_000, rentMonthly: 2000 },
    assumptions: { ...DEFAULT_ASSUMPTIONS, marginalTaxRate: 0.32 },
    arvLocal: 300_000,
    rehabBudget: 20_000,
    propertyType: "mf",
    unitCount: 4,
    notes: "legacy note",
    shareNotes: true,
  },
  market_context: null,
};

describe("migrateDealState upconverts a legacy v1 row", () => {
  it("stamps version 2", () => {
    expect(migrateDealState(V1_ROW).v).toBe(2);
  });

  it("harvests panel state out of result_snapshot", () => {
    const s = migrateDealState(V1_ROW);
    expect(s.arvLocal).toBe(300_000);
    expect(s.rehabBudget).toBe(20_000);
    expect(s.propertyType).toBe("mf");
    expect(s.unitCount).toBe(4);
    expect(s.assumptions.marginalTaxRate).toBe(0.32);
    expect(s.notes).toBe("legacy note");
    expect(s.shareNotes).toBe(true);
  });

  it("recovers address and zip from the row columns", () => {
    const s = migrateDealState(V1_ROW);
    expect(s.address).toBe("99 Oak Ave, Dallas, TX");
    expect(s.selectedZip).toBe("75201");
    expect(s.rentcastEcho).toEqual({
      city: "Dallas",
      state: "TX",
      zip: "75201",
      avmValue: null,
    });
  });

  it("clocks staleness off the row's updated_at", () => {
    expect(migrateDealState(V1_ROW).marketCapturedAt).toBe(
      "2026-05-01T00:00:00.000Z",
    );
  });

  it("defaults the fields that genuinely do not exist in v1", () => {
    const s = migrateDealState(V1_ROW);
    expect(s.analysisMode).toBe("focused");
    expect(s.activeGoalAtSave).toBeNull();
    expect(s.thresholds).toBeUndefined();
    expect(s.provenance).toEqual({});
    expect(s.piqByGeo).toBeNull();
  });
});

describe("migrateDealState repairs a v2 blob without discarding valid state", () => {
  it("returns the stored state as-is", () => {
    const v2 = {
      ...migrateDealState(V1_ROW),
      label: "renamed",
      notes: "edited",
    };
    const out = migrateDealState({ ...V1_ROW, input_snapshot: v2 });
    expect(out.label).toBe("renamed");
    expect(out.notes).toBe("edited");
  });
});

describe("migrateDealState hardens the v2 fast path", () => {
  const validV2 = migrateDealState(V1_ROW);

  it("repairs an empty assumptions object back to full defaults", () => {
    const row = { ...V1_ROW, input_snapshot: { ...validV2, assumptions: {} } };
    expect(migrateDealState(row).assumptions).toEqual(DEFAULT_ASSUMPTIONS);
  });

  it("repairs a v2 row missing assumptions entirely", () => {
    const { assumptions: _drop, ...withoutAssumptions } = validV2;
    const row = { ...V1_ROW, input_snapshot: withoutAssumptions };
    expect(migrateDealState(row).assumptions).toEqual(DEFAULT_ASSUMPTIONS);
  });

  it("preserves a partial assumptions override and defaults the rest", () => {
    const row = {
      ...V1_ROW,
      input_snapshot: { ...validV2, assumptions: { marginalTaxRate: 0.37 } },
    };
    const s = migrateDealState(row);
    expect(s.assumptions.marginalTaxRate).toBe(0.37);
    expect(s.assumptions.landValuePct).toBe(DEFAULT_ASSUMPTIONS.landValuePct);
  });

  it("round-trips a valid, complete v2 state unchanged", () => {
    const row = { ...V1_ROW, input_snapshot: validV2 };
    expect(migrateDealState(row)).toEqual(validV2);
  });
});

describe("migrateDealState never throws on malformed input", () => {
  it.each([
    ["empty row", { input_snapshot: {}, result_snapshot: {} }],
    ["null blobs", { input_snapshot: null, result_snapshot: null }],
    ["wrong types", { input_snapshot: "nope", result_snapshot: 42 }],
    ["nothing at all", {}],
  ])("returns a usable default state for %s", (_label, row) => {
    const s = migrateDealState(row as never);
    expect(s.v).toBe(2);
    expect(s.assumptions).toEqual(DEFAULT_ASSUMPTIONS);
    expect(typeof s.marketCapturedAt).toBe("string");
  });
});
