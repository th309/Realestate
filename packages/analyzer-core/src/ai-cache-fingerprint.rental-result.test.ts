import { describe, it, expect } from "vitest";
import { buildAiInsightsFingerprint } from "./ai-cache-fingerprint";
import { baseInput, rentalResult } from "./ai-cache-fingerprint.test-fixtures";

/**
 * RentalResult coverage, including the commercial-underwriting sub-object.
 * See ai-cache-fingerprint.test.ts for core/top-level coverage.
 */
describe("buildAiInsightsFingerprint — RentalResult coverage", () => {
  it("ignores cashflow jitter within the $50 bucket but changes across it", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: { ...rentalResult, cashflowMonthly: 416 },
      }),
    ).toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: { ...rentalResult, cashflowMonthly: 462 },
      }),
    ).not.toBe(base);
  });

  it("changes when dscr, capRatePct, cashOnCashPct, or onePctRulePct changes", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: { ...rentalResult, dscr: 1.3 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: { ...rentalResult, capRatePct: 6.1 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: { ...rentalResult, cashOnCashPct: 9.5 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: { ...rentalResult, onePctRulePct: 0.75 },
      }),
    ).not.toBe(base);
  });

  it("changes when noiAnnual, totalCashInvested, or monthlyDebtService crosses its bucket", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: { ...rentalResult, noiAnnual: rentalResult.noiAnnual! + 500 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: {
          ...rentalResult,
          totalCashInvested: rentalResult.totalCashInvested + 1000,
        },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: {
          ...rentalResult,
          monthlyDebtService: rentalResult.monthlyDebtService + 25,
        },
      }),
    ).not.toBe(base);
  });

  it("changes when the commercial-underwriting sub-object appears or its fields change", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    const withCommercial = buildAiInsightsFingerprint({
      ...baseInput,
      rental: {
        ...rentalResult,
        commercial: {
          impliedValueAtMarketCap: 500_000,
          maxLtvLoan: 400_000,
          maxDscrLoan: 380_000,
          effectiveLoan: 380_000,
          bindingConstraint: "dscr",
          balloonBalance: 350_000,
          capexReserveAnnual: 2_400,
        },
      },
    });
    expect(withCommercial).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: {
          ...rentalResult,
          commercial: {
            impliedValueAtMarketCap: 500_000,
            maxLtvLoan: 400_000,
            maxDscrLoan: 380_000,
            effectiveLoan: 400_000, // ltv now binds instead of dscr
            bindingConstraint: "ltv",
            balloonBalance: 350_000,
            capexReserveAnnual: 2_400,
          },
        },
      }),
    ).not.toBe(withCommercial);
  });

  it("distinguishes a rental result being present vs absent", () => {
    expect(buildAiInsightsFingerprint({ ...baseInput, rental: null })).not.toBe(
      buildAiInsightsFingerprint({ ...baseInput, rental: rentalResult }),
    );
  });

  it("is empty (no-throw) when rental is null/undefined", () => {
    expect(() =>
      buildAiInsightsFingerprint({ ...baseInput, rental: null }),
    ).not.toThrow();
  });
});
