import { describe, it, expect } from "vitest";
import {
  resolvePresetLabel,
  resolveDisplayAddress,
  pickCompsSource,
} from "../use-analyzer-view-model";

describe("resolvePresetLabel reports the user's saved rubric, not a hardcoded preset", () => {
  it("returns Balanced when the account has no saved thresholds row", () => {
    expect(resolvePresetLabel(undefined, null)).toBe("Balanced");
  });

  it("title-cases the detected preset name", () => {
    expect(resolvePresetLabel({ minCapRatePct: 6 }, "conservative")).toBe(
      "Conservative",
    );
  });

  it("reads as Custom when saved thresholds match no preset", () => {
    expect(resolvePresetLabel({ minCapRatePct: 6 }, null)).toBe("Custom");
  });
});

describe("resolveDisplayAddress prefers the RentCast-resolved address", () => {
  it("uses the resolved address when present", () => {
    expect(resolveDisplayAddress("123 Main St, Austin, TX", "123 main")).toBe(
      "123 Main St, Austin, TX",
    );
  });

  it("falls back to the trimmed typed address", () => {
    expect(resolveDisplayAddress(undefined, "  123 main  ")).toBe("123 main");
  });

  it("returns null when neither is usable", () => {
    expect(resolveDisplayAddress(undefined, "   ")).toBeNull();
  });
});

describe("pickCompsSource lets prefill populate comps without a Fetch click", () => {
  // Typed as the loose parcel shape the comps builder accepts; only identity
  // matters for precedence, so minimal stand-ins keep the intent visible.
  const fetched = { sales_comps: [{ address: "fetched" }] } as never;
  const prefilled = { sales_comps: [{ address: "prefilled" }] } as never;

  it("prefers an explicit Fetch over the prefill parcel", () => {
    expect(pickCompsSource(fetched, prefilled)).toBe(fetched);
  });

  it("falls back to the prefill parcel when nothing was fetched", () => {
    // The regression: autocomplete filled the money fields from RentCast while
    // the comps panel stayed empty, because comps read only the fetch result.
    expect(pickCompsSource(null, prefilled)).toBe(prefilled);
  });

  it("returns null when neither source has a parcel", () => {
    expect(pickCompsSource(null, null)).toBeNull();
    expect(pickCompsSource(null, undefined)).toBeNull();
  });
});
