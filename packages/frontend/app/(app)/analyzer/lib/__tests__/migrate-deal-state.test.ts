import { describe, it, expect } from "vitest";
import { migrateDealState } from "../migrate-snapshot";
import { getDealStaleness } from "../deal-staleness";
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

  it("does not produce a stale-deal banner for a legacy row with no updated_at — the epoch sentinel must read as unknown, not ~20,000 days old", () => {
    const { updated_at: _drop, ...rowWithoutUpdatedAt } = V1_ROW;
    const s = migrateDealState(rowWithoutUpdatedAt);
    expect(getDealStaleness(s.marketCapturedAt).stale).toBe(false);
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

  // A v2 `input` is a full AnalyzerInputState, not the six-field DealInput
  // that `migrateSnapshot` reduces a legacy blob to. Reducing it here dropped
  // these fields on read; `use-analyzer-state`'s input-sync effect then put
  // them back on mount, so the rebuilt state never matched the restored one
  // and autosave PATCHed the row on every OPEN of a saved deal.
  it("preserves the v2 input fields that migrateSnapshot would drop", () => {
    const input = {
      ...validV2.input,
      arv: 415_000,
      rehabBudget: 62_500,
      propertyClass: "commercial_mf",
      unitCount: 8,
      marketCapRatePct: 6.25,
      targetDSCR: 1.25,
      capexReserveAnnualPerUnit: 300,
      holdingMonths: 9,
      sellingCostsPct: 0.07,
      refinanceLTVPct: 0.75,
      financing: { ...validV2.input.financing, amortizationYears: 25 },
    };
    const row = { ...V1_ROW, input_snapshot: { ...validV2, input } };

    expect(migrateDealState(row).input).toEqual(input);
  });

  it("still coerces stringified numbers on the v2 input", () => {
    const row = {
      ...V1_ROW,
      input_snapshot: {
        ...validV2,
        input: { ...validV2.input, price: "425000", arv: 500_000 },
      },
    };
    const s = migrateDealState(row);
    expect(s.input.price).toBe(425_000);
    expect(s.input.arv).toBe(500_000);
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
