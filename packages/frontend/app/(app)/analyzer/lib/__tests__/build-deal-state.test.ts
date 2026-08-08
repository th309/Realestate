import { describe, it, expect } from "vitest";
import { buildDealState } from "../build-deal-state";
import { DEFAULT_ASSUMPTIONS } from "../analyzer-assumptions";

const ARGS = {
  input: {
    price: 300_000,
    rentMonthly: 2400,
    taxAnnual: 4200,
    insuranceAnnual: 1500,
    hoaMonthly: 0,
    financing: {
      downPaymentPct: 0.2,
      interestRatePct: 7.1,
      termYears: 30,
      closingCostsPct: 0.03,
    },
  },
  address: "123 Main St, Austin, TX",
  selectedZip: "78701",
  label: "Duplex deal",
  arvLocal: 345_000,
  rehabBudget: 45_000,
  propertyType: "sfh" as const,
  unitCount: 1,
  assumptions: DEFAULT_ASSUMPTIONS,
  analysisMode: "focused" as const,
  activeGoalAtSave: null,
  thresholds: undefined,
  provenance: {},
  rentcastEcho: {
    city: "Austin",
    state: "TX",
    zip: "78701",
    avmValue: 312_000,
  },
  piqByGeo: { zip: 62, county: 58, metro: 61 },
  notes: "Seller motivated",
  shareNotes: false,
  marketCapturedAt: "2026-08-08T00:00:00.000Z",
};

describe("buildDealState produces a versioned, fully-populated deal state", () => {
  it("stamps the version", () => {
    expect(buildDealState(ARGS).v).toBe(2);
  });

  it("round-trips every user-authored field", () => {
    const s = buildDealState(ARGS);
    expect(s.input.price).toBe(300_000);
    expect(s.selectedZip).toBe("78701");
    expect(s.label).toBe("Duplex deal");
    expect(s.arvLocal).toBe(345_000);
    expect(s.assumptions.marginalTaxRate).toBe(0.24);
    expect(s.notes).toBe("Seller motivated");
    expect(s.marketCapturedAt).toBe("2026-08-08T00:00:00.000Z");
  });

  it("omits thresholds when the user is on a stock preset", () => {
    expect(buildDealState(ARGS).thresholds).toBeUndefined();
  });

  it("records the active goal but never a bare selectedGoal (spec 4.6)", () => {
    const s = buildDealState({ ...ARGS, activeGoalAtSave: "cash_flow" });
    expect(s.activeGoalAtSave).toBe("cash_flow");
    expect(s).not.toHaveProperty("selectedGoal");
    expect(s).not.toHaveProperty("goal");
  });

  it("survives a JSON round-trip unchanged (it is stored as JSONB)", () => {
    const s = buildDealState(ARGS);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
