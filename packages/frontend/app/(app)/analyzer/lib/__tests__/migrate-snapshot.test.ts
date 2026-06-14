import { describe, it, expect } from "vitest";
import { migrateSnapshot } from "../migrate-snapshot";

describe("migrateSnapshot", () => {
  it("current shape passes through unchanged (with hoaMonthly default = 0)", () => {
    const v1 = {
      price: 240000,
      rentMonthly: 2850,
      taxAnnual: 3800,
      insuranceAnnual: 1200,
      financing: {
        downPaymentPct: 0.2,
        interestRatePct: 7.1,
        termYears: 30,
        closingCostsPct: 0.03,
      },
    };
    expect(migrateSnapshot(v1)).toEqual({ ...v1, hoaMonthly: 0 });
  });

  it("is idempotent", () => {
    const v1 = {
      price: 240000,
      rentMonthly: 2850,
      taxAnnual: 3800,
      insuranceAnnual: 1200,
      financing: {
        downPaymentPct: 0.2,
        interestRatePct: 7.1,
        termYears: 30,
        closingCostsPct: 0.03,
      },
    };
    const once = migrateSnapshot(v1);
    expect(migrateSnapshot(once)).toEqual(once);
  });

  it("v0 pre-financing-defaults shape upgrades to v1", () => {
    const v0 = {
      price: 200000,
      rentMonthly: 2200,
      taxAnnual: 2400,
      insuranceAnnual: 1000,
    };
    const r = migrateSnapshot(v0);
    expect(r.financing).toBeDefined();
    expect(r.financing.downPaymentPct).toBe(0.2);
    expect(r.financing.interestRatePct).toBe(7.1);
    expect(r.financing.termYears).toBe(30);
  });

  it("anonymous shape with string numbers coerces to numbers", () => {
    const anon = {
      price: "240000",
      rentMonthly: "2850",
      taxAnnual: "3800",
      insuranceAnnual: "1200",
    } as unknown;
    const r = migrateSnapshot(anon);
    expect(typeof r.price).toBe("number");
    expect(r.price).toBe(240000);
    expect(typeof r.rentMonthly).toBe("number");
    expect(r.rentMonthly).toBe(2850);
  });

  it("missing fields default to null/0", () => {
    const r = migrateSnapshot({ price: 100000 });
    expect(r.rentMonthly).toBeNull();
    expect(r.taxAnnual).toBeNull();
    expect(r.insuranceAnnual).toBeNull();
    expect(r.hoaMonthly).toBe(0);
    expect(r.financing).toEqual({
      downPaymentPct: 0.2,
      interestRatePct: 7.1,
      termYears: 30,
      closingCostsPct: 0.03,
    });
  });

  it("null/undefined input returns sane defaults", () => {
    expect(migrateSnapshot(null).price).toBe(0);
    expect(migrateSnapshot(undefined).price).toBe(0);
  });
});
