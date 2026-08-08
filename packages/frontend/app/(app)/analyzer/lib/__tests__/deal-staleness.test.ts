import { describe, it, expect } from "vitest";
import { getDealStaleness, STALE_AFTER_DAYS } from "../deal-staleness";

const NOW = new Date("2026-08-08T12:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("getDealStaleness fires only past the threshold", () => {
  it("is not stale the day it was captured", () => {
    expect(getDealStaleness(daysAgo(0), NOW)).toEqual({
      stale: false,
      days: 0,
    });
  });

  it("is not stale one day short of the threshold", () => {
    expect(getDealStaleness(daysAgo(59), NOW).stale).toBe(false);
  });

  it("is not stale exactly at the threshold", () => {
    expect(getDealStaleness(daysAgo(STALE_AFTER_DAYS), NOW).stale).toBe(false);
  });

  it("is stale one day past the threshold", () => {
    expect(getDealStaleness(daysAgo(61), NOW)).toEqual({
      stale: true,
      days: 61,
    });
  });

  it("reports the real age for a long-abandoned deal", () => {
    expect(getDealStaleness(daysAgo(400), NOW)).toEqual({
      stale: true,
      days: 400,
    });
  });

  it("is not stale — and never reports a negative day count — for a future-dated capture (clock skew)", () => {
    const future = new Date(
      NOW.getTime() + 5 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(getDealStaleness(future, NOW)).toEqual({ stale: false, days: 0 });
  });
});

describe("getDealStaleness degrades safely on bad input", () => {
  it.each(["", "not-a-date", "2026-13-45T00:00:00Z"])(
    "treats %s as not stale rather than throwing",
    (bad) => {
      expect(getDealStaleness(bad, NOW)).toEqual({ stale: false, days: 0 });
    },
  );

  it.each([null, undefined])(
    "treats %s as not stale rather than evaluating `new Date(%s)` (which is epoch 1970, not NaN)",
    (bad) => {
      expect(getDealStaleness(bad, NOW)).toEqual({ stale: false, days: 0 });
    },
  );
});
