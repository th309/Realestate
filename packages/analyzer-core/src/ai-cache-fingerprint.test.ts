import { describe, it, expect } from "vitest";
import {
  buildAiInsightsFingerprint,
  roundToBucket,
} from "./ai-cache-fingerprint";
import { baseInput } from "./ai-cache-fingerprint.test-fixtures";

/**
 * Core + top-level-field coverage for buildAiInsightsFingerprint(). DealInput,
 * RentalResult, FlipResult, and BrrrrResult coverage live in their own
 * *.test.ts files (same fixtures module) to keep each file under the
 * 500-line cap — see ai-cache-fingerprint.deal-input.test.ts,
 * .rental-result.test.ts, and .flip-brrrr.test.ts.
 */

describe("roundToBucket", () => {
  it("rounds to the nearest multiple of the bucket width", () => {
    expect(roundToBucket(412, 50)).toBe(400);
    expect(roundToBucket(426, 50)).toBe(450);
    expect(roundToBucket(425_000, 1000)).toBe(425_000);
    expect(roundToBucket(425_499, 1000)).toBe(425_000);
    expect(roundToBucket(425_500, 1000)).toBe(426_000);
  });

  it("defaults null/undefined to 0", () => {
    expect(roundToBucket(null, 50)).toBe(0);
    expect(roundToBucket(undefined, 50)).toBe(0);
  });
});

describe("buildAiInsightsFingerprint", () => {
  it("is deterministic for identical input", () => {
    expect(buildAiInsightsFingerprint(baseInput)).toBe(
      buildAiInsightsFingerprint({ ...baseInput }),
    );
  });

  it("changes when the PIQ score at any geography level changes", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        piqByGeo: { ...baseInput.piqByGeo, metro: 74 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        piqByGeo: { ...baseInput.piqByGeo, county: 69 },
      }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        piqByGeo: { ...baseInput.piqByGeo, zip: 43 },
      }),
    ).not.toBe(base);
  });

  it("changes when the resolved geo level changes", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({ ...baseInput, geoLevel: "county" }),
    ).not.toBe(base);
  });

  it("changes when the grading letter changes", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(buildAiInsightsFingerprint({ ...baseInput, letter: "A" })).not.toBe(
      base,
    );
  });

  it("changes when strategy or goal changes", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({ ...baseInput, strategy: "BRRRR" }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({ ...baseInput, goal: "fast_cash" }),
    ).not.toBe(base);
  });

  it("changes when auto-kill codes change (order and membership)", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({ ...baseInput, autoKillCodes: [] }),
    ).not.toBe(base);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        autoKillCodes: ["NEGATIVE_CASHFLOW", "REFI_NOT_FINANCEABLE"],
      }),
    ).not.toBe(base);
  });

  it("changes once the 30-year projection equity crosses a $1000 bucket", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        projectionFinalEquity:
          (baseInput.projectionFinalEquity as number) + 1000,
      }),
    ).not.toBe(base);
  });

  it("rounds finalGpa to fixed precision rather than truncating buckets", () => {
    const base = buildAiInsightsFingerprint(baseInput);
    // A tiny drift that rounds to the same fixed string is a no-op.
    expect(
      buildAiInsightsFingerprint({
        ...baseInput,
        finalGpa: (baseInput.finalGpa as number) + 0.0001,
      }),
    ).toBe(base);
    // A drift large enough to change the fixed string changes the fingerprint.
    expect(
      buildAiInsightsFingerprint({ ...baseInput, finalGpa: 3.3 }),
    ).not.toBe(base);
  });

  it("treats missing optional fields as safe defaults, not throwing", () => {
    expect(() =>
      buildAiInsightsFingerprint({
        input: null,
        rental: null,
        flip: null,
        brrrr: null,
        finalGpa: null,
        letter: undefined,
        autoKillCodes: null,
        strategy: undefined,
        goal: null,
        projectionFinalEquity: undefined,
        piqByGeo: null,
        geoLevel: undefined,
      }),
    ).not.toThrow();
  });
});
