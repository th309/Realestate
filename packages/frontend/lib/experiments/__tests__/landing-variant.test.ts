import {
  parseLandingMode,
  hashToPercent,
  resolveVariant,
} from "../landing-variant";

describe("parseLandingMode", () => {
  it("defaults to off when unset or unknown", () => {
    expect(parseLandingMode(undefined)).toEqual({ kind: "off" });
    expect(parseLandingMode("garbage")).toEqual({ kind: "off" });
  });
  it("parses preview and on", () => {
    expect(parseLandingMode("preview")).toEqual({ kind: "preview" });
    expect(parseLandingMode("on")).toEqual({ kind: "on" });
  });
  it("parses ab:<n> and clamps 0-100", () => {
    expect(parseLandingMode("ab:50")).toEqual({ kind: "ab", percentB: 50 });
    expect(parseLandingMode("ab:150")).toEqual({ kind: "ab", percentB: 100 });
    expect(parseLandingMode("ab:0")).toEqual({ kind: "ab", percentB: 0 });
  });
});

describe("hashToPercent", () => {
  it("is deterministic and in range 0-99", () => {
    const a = hashToPercent("visitor-123");
    expect(a).toBe(hashToPercent("visitor-123"));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });
  it("spreads different seeds across the range", () => {
    const seen = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((s) =>
        hashToPercent(`visitor-${s}`),
      ),
    );
    // Not all identical — the hash actually varies by seed.
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("resolveVariant", () => {
  const seed = "seed-x";
  it("off -> A, on -> B", () => {
    expect(resolveVariant({ kind: "off" }, { splitSeed: seed })).toBe("A");
    expect(resolveVariant({ kind: "on" }, { splitSeed: seed })).toBe("B");
  });
  it("preview -> A unless override", () => {
    expect(resolveVariant({ kind: "preview" }, { splitSeed: seed })).toBe("A");
    expect(
      resolveVariant(
        { kind: "preview" },
        { splitSeed: seed, previewOverride: true },
      ),
    ).toBe("B");
  });
  it("ab honors existing cookie (sticky per visitor)", () => {
    expect(
      resolveVariant(
        { kind: "ab", percentB: 0 },
        { splitSeed: seed, existingCookie: "B" },
      ),
    ).toBe("B");
    expect(
      resolveVariant(
        { kind: "ab", percentB: 100 },
        { splitSeed: seed, existingCookie: "A" },
      ),
    ).toBe("A");
  });
  it("ab:100 assigns B, ab:0 assigns A for a new visitor", () => {
    expect(
      resolveVariant({ kind: "ab", percentB: 100 }, { splitSeed: seed }),
    ).toBe("B");
    expect(
      resolveVariant({ kind: "ab", percentB: 0 }, { splitSeed: seed }),
    ).toBe("A");
  });
});
