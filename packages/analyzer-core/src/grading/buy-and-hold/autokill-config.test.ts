import { describe, it, expect } from "vitest";
import type { DealInput } from "../../types";
import { BUY_AND_HOLD_DEFAULTS } from "./thresholds";
import { gradeBuyAndHoldDeal } from "./grade";

/**
 * Frederick-style failing deal: DSCR < 1.0, negative cash flow, and
 * tax+insurance > 40% of rent — trips 3 of the 4 B&H auto-kills.
 */
const KILLED_DEAL: DealInput = {
  price: 695_000,
  rentMonthly: 3_320,
  taxAnnual: 8_941,
  // Bumped from the brief's 3,823: at 3,823 taxAnnual+insuranceAnnual is only
  // 32% of annual rent, so TAX_INS_OVER_40 never fires under the 40% default
  // and the "trips 3 of the 4" auto-kills below is unreachable. 7,823 pushes
  // the combined share to ~42%, so DSCR_BELOW_1, TAX_INS_OVER_40, and
  // NEG_CF_NO_APPRECIATION_ACK all trip under default config as intended.
  insuranceAnnual: 7_823,
  financing: {
    downPaymentPct: 0.2,
    interestRatePct: 7.1,
    termYears: 30,
    closingCostsPct: 0.03,
  },
};

const codes = (r: ReturnType<typeof gradeBuyAndHoldDeal>) =>
  r.autoKills.map((k) => k.code).sort();

describe("B&H auto-kill config", () => {
  it("no config is behavior-identical to explicit default config", () => {
    const bare = gradeBuyAndHoldDeal(KILLED_DEAL, {});
    const configured = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: {
          dscrFloor: { enabled: true, value: 1.0 },
          taxInsShareOfRent: { enabled: true, value: 0.4 },
          floodNoInsurance: { enabled: true },
          negativeCashflowNoAck: { enabled: true },
        },
      },
    );
    expect(configured).toEqual(bare);
  });

  it("custom DSCR floor below actual DSCR suppresses DSCR_BELOW_1", () => {
    const r = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: { dscrFloor: { value: 0.1 } },
      },
    );
    expect(codes(r)).not.toContain("DSCR_BELOW_1");
  });

  it("custom DSCR floor message reflects the configured value", () => {
    const r = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: { dscrFloor: { value: 0.85 } },
      },
    );
    const kill = r.autoKills.find((k) => k.code === "DSCR_BELOW_1");
    expect(kill?.message).toContain("0.85");
  });

  it("disabling every rule yields zero auto-kills (letter no longer forced F)", () => {
    const r = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: {
          dscrFloor: { enabled: false },
          taxInsShareOfRent: { enabled: false },
          floodNoInsurance: { enabled: false },
          negativeCashflowNoAck: { enabled: false },
        },
      },
    );
    expect(r.autoKills).toEqual([]);
  });

  it("custom tax+ins share message reflects the configured percent", () => {
    const r = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: { taxInsShareOfRent: { value: 0.25 } },
      },
    );
    const kill = r.autoKills.find((k) => k.code === "TAX_INS_OVER_40");
    expect(kill?.message).toContain("25%");
  });

  it("default message text is byte-identical to the historical literals", () => {
    const r = gradeBuyAndHoldDeal(KILLED_DEAL, {});
    const dscr = r.autoKills.find((k) => k.code === "DSCR_BELOW_1");
    const taxIns = r.autoKills.find((k) => k.code === "TAX_INS_OVER_40");
    expect(dscr?.message).toBe(
      "DSCR below 1.0 — property cannot service its own debt.",
    );
    expect(taxIns?.message).toBe(
      "Taxes + insurance exceed 40% of gross annual rent.",
    );
  });
});
