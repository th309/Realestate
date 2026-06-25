import {
  pickWindows,
  computePublishedIds,
  computeRedirectIds,
  assertNonEmpty,
  PUBLISH_WINDOW_MONTHS,
  REDIRECT_LOOKBACK_MONTHS,
} from "./published-set";

describe("pickWindows", () => {
  it("splits newest-first periods into publish (2) and lookback (6)", () => {
    const periods = [
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
    ];
    const { publish, lookback } = pickWindows(periods);
    expect(publish).toEqual(["2026-05", "2026-04"]);
    expect(lookback).toEqual([
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
      "2025-12",
    ]);
  });
});

describe("computePublishedIds", () => {
  it("unions scored IDs across the publish window (grace = scored in either month)", () => {
    const byPeriod = new Map([
      ["2026-05", new Set(["a", "b"])],
      ["2026-04", new Set(["b", "c"])], // c is in grace (not in latest)
    ]);
    const out = computePublishedIds(byPeriod, ["2026-05", "2026-04"]);
    expect([...out].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("computeRedirectIds", () => {
  it("is lookback-union minus published", () => {
    const byPeriod = new Map([
      ["2026-05", new Set(["a"])],
      ["2026-04", new Set(["a"])],
      ["2026-03", new Set(["d"])], // aged out of publish window → redirect
      ["2026-02", new Set(["a", "e"])], // e aged out → redirect
    ]);
    const publish = ["2026-05", "2026-04"];
    const lookback = ["2026-05", "2026-04", "2026-03", "2026-02"];
    const out = computeRedirectIds(byPeriod, publish, lookback);
    expect([...out].sort()).toEqual(["d", "e"]);
  });
});

describe("assertNonEmpty", () => {
  it("throws on empty set (fail-closed)", () => {
    expect(() => assertNonEmpty("zip", new Set())).toThrow(/fail-closed/i);
  });
  it("does not throw on a populated set", () => {
    expect(() => assertNonEmpty("zip", new Set(["a"]))).not.toThrow();
  });
});
