import { describe, it, expect } from "vitest";
import {
  buildAiInsightsFingerprint,
  type AiInsightsFingerprintInput,
} from "./ai-cache-fingerprint";
import {
  baseInput,
  brrrrResult,
  flipResult,
} from "./ai-cache-fingerprint.test-fixtures";

/**
 * FlipResult + BrrrrResult coverage — proves a flip-only or BRRRR-only
 * result change actually moves the fingerprint (the headline gap this
 * module closes: neither strategy's results were tracked at all before).
 * See ai-cache-fingerprint.test.ts for core/top-level coverage.
 */
describe("buildAiInsightsFingerprint — FlipResult coverage", () => {
  const flipBase: AiInsightsFingerprintInput = {
    ...baseInput,
    rental: null,
    flip: flipResult,
    strategy: "FIX_AND_FLIP",
  };

  it("changes on mao70, wholetailMax, projectedProfit, or projectedRoiPct", () => {
    const base = buildAiInsightsFingerprint(flipBase);
    expect(
      buildAiInsightsFingerprint({
        ...flipBase,
        flip: { ...flipResult, mao70: flipResult.mao70 + 500 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...flipBase,
        flip: { ...flipResult, wholetailMax: flipResult.wholetailMax + 500 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...flipBase,
        flip: {
          ...flipResult,
          projectedProfit: flipResult.projectedProfit + 500,
        },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...flipBase,
        flip: {
          ...flipResult,
          projectedRoiPct: flipResult.projectedRoiPct + 1,
        },
      }),
    ).not.toBe(base);
  });

  it("distinguishes a flip result being present vs absent", () => {
    expect(
      buildAiInsightsFingerprint({ ...baseInput, rental: null, flip: null }),
    ).not.toBe(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: null,
        flip: flipResult,
      }),
    );
  });
});

describe("buildAiInsightsFingerprint — BrrrrResult coverage", () => {
  const brrrrBase: AiInsightsFingerprintInput = {
    ...baseInput,
    rental: null,
    brrrr: brrrrResult,
    strategy: "BRRRR",
  };

  it("changes on score, refinanceCashOut, remainingCashInDeal, postRefiCashflowMonthly, or rating", () => {
    const base = buildAiInsightsFingerprint(brrrrBase);
    expect(
      buildAiInsightsFingerprint({
        ...brrrrBase,
        brrrr: { ...brrrrResult, score: 8.1 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...brrrrBase,
        brrrr: {
          ...brrrrResult,
          refinanceCashOut: brrrrResult.refinanceCashOut + 1000,
        },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...brrrrBase,
        brrrr: {
          ...brrrrResult,
          remainingCashInDeal: brrrrResult.remainingCashInDeal + 1000,
        },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...brrrrBase,
        brrrr: {
          ...brrrrResult,
          postRefiCashflowMonthly: brrrrResult.postRefiCashflowMonthly + 50,
        },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...brrrrBase,
        brrrr: { ...brrrrResult, rating: "EXCELLENT" },
      }),
    ).not.toBe(base);
  });

  it("distinguishes a BRRRR result being present vs absent", () => {
    expect(
      buildAiInsightsFingerprint({ ...baseInput, rental: null, brrrr: null }),
    ).not.toBe(
      buildAiInsightsFingerprint({
        ...baseInput,
        rental: null,
        brrrr: brrrrResult,
      }),
    );
  });
});
