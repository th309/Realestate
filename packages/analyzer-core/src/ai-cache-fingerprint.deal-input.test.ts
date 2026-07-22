import { describe, it, expect } from "vitest";
import { buildAiInsightsFingerprint } from "./ai-cache-fingerprint";
import { baseInput, dealInput } from "./ai-cache-fingerprint.test-fixtures";

/**
 * DealInput coverage — assemblePrompt JSON-stringifies the entire DealInput
 * verbatim, so every field here can move the AI narrative and must move the
 * fingerprint. See ai-cache-fingerprint.test.ts for core/top-level coverage.
 */
describe("buildAiInsightsFingerprint — DealInput coverage", () => {
  it("ignores price jitter within the $1000 bucket but changes across it", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, price: dealInput.price + 100 },
      }),
    ).toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, price: dealInput.price + 1000 },
      }),
    ).not.toBe(base);
  });

  it("ignores rent jitter within the $25 bucket but changes across it", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, rentMonthly: dealInput.rentMonthly! + 5 },
      }),
    ).toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, rentMonthly: dealInput.rentMonthly! + 25 },
      }),
    ).not.toBe(base);
  });

  it("changes when a financing term changes (down payment, rate, term years)", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: {
          ...dealInput,
          financing: { ...dealInput.financing, downPaymentPct: 0.25 },
        },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: {
          ...dealInput,
          financing: { ...dealInput.financing, interestRatePct: 7.5 },
        },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: {
          ...dealInput,
          financing: { ...dealInput.financing, termYears: 15 },
        },
      }),
    ).not.toBe(base);
  });

  it("changes when taxAnnual, insuranceAnnual, or hoaMonthly cross their bucket", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, taxAnnual: dealInput.taxAnnual! + 100 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: {
          ...dealInput,
          insuranceAnnual: dealInput.insuranceAnnual! + 100,
        },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, hoaMonthly: dealInput.hoaMonthly! + 25 },
      }),
    ).not.toBe(base);
  });

  it("changes when propertyClass or unitCount changes (commercial underwriting swap)", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, propertyClass: "commercial_mf" },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, unitCount: 8 },
      }),
    ).not.toBe(base);
  });

  it("changes when vacancy/maintenance/management percentages change", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, vacancyPctOfRent: 0.1 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, maintenancePctOfRent: 0.12 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, managementPctOfRent: 0.1 },
      }),
    ).not.toBe(base);
  });

  it("changes when marketCapRatePct, targetDSCR, or capexReserveAnnualPerUnit changes", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, marketCapRatePct: 6.5 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: { ...dealInput, targetDSCR: 1.4 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        input: {
          ...dealInput,
          capexReserveAnnualPerUnit: dealInput.capexReserveAnnualPerUnit! + 50,
        },
      }),
    ).not.toBe(base);
  });

  it("is empty (no-throw) when input is null/undefined", () => {
    expect(() =>
      buildAiInsightsFingerprint({ ...baseInput, input: null }),
    ).not.toThrow();
    expect(() =>
      buildAiInsightsFingerprint({ ...baseInput, input: undefined }),
    ).not.toThrow();
  });
});
