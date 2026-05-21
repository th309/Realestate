import { describe, it, expect } from "vitest";
import * as N from "../nudges";

describe("nudges", () => {
  describe("nudgeForPrice", () => {
    it("warns on $0", () => expect(N.nudgeForPrice(0)?.level).toBe("warn"));
    it("warns on $20K", () =>
      expect(N.nudgeForPrice(20_000)?.level).toBe("warn"));
    it("warns on $6M", () =>
      expect(N.nudgeForPrice(6_000_000)?.level).toBe("warn"));
    it("no nudge mid-range", () => expect(N.nudgeForPrice(250_000)).toBeNull());
  });

  describe("nudgeForRent", () => {
    it("ok above 1% rule", () =>
      expect(N.nudgeForRent(2500, 200_000)?.level).toBe("ok"));
    it("warns below 0.6% rule", () =>
      expect(N.nudgeForRent(800, 200_000)?.level).toBe("warn"));
    it("no nudge mid", () => expect(N.nudgeForRent(1500, 200_000)).toBeNull());
  });

  describe("nudgeForTax", () => {
    it("warns on 3% of price", () =>
      expect(N.nudgeForTax(7500, 250_000)?.level).toBe("warn"));
    it("warns on 0", () =>
      expect(N.nudgeForTax(0, 250_000)?.level).toBe("warn"));
    it("no nudge typical", () =>
      expect(N.nudgeForTax(3000, 250_000)).toBeNull());
  });

  describe("nudgeForInsurance", () => {
    it("warns on 2% of price", () =>
      expect(N.nudgeForInsurance(5000, 250_000)?.level).toBe("warn"));
    it("warns on 0", () =>
      expect(N.nudgeForInsurance(0, 250_000)?.level).toBe("warn"));
    it("no nudge typical", () =>
      expect(N.nudgeForInsurance(1200, 250_000)).toBeNull());
  });

  describe("nudgeForVacancy", () => {
    it("warns on 1%", () =>
      expect(N.nudgeForVacancy(0.01)?.level).toBe("warn"));
    it("warns on 15%", () =>
      expect(N.nudgeForVacancy(0.15)?.level).toBe("warn"));
    it("ok at 5%", () => expect(N.nudgeForVacancy(0.05)).toBeNull());
  });

  describe("nudgeForRate", () => {
    it("warns on 3%", () => expect(N.nudgeForRate(3)?.level).toBe("warn"));
    it("warns on 14%", () => expect(N.nudgeForRate(14)?.level).toBe("warn"));
    it("ok at 7%", () => expect(N.nudgeForRate(7)).toBeNull());
  });

  describe("nudgeForArv", () => {
    it("warns when ARV ≤ price", () =>
      expect(N.nudgeForArv(200_000, 200_000)?.level).toBe("warn"));
    it("warns thin margin", () =>
      expect(N.nudgeForArv(220_000, 200_000)?.level).toBe("warn"));
    it("ok healthy margin", () =>
      expect(N.nudgeForArv(300_000, 200_000)).toBeNull());
  });
});
