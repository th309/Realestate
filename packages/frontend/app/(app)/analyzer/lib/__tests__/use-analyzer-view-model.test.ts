import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  resolvePresetLabel,
  resolveDisplayAddress,
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
