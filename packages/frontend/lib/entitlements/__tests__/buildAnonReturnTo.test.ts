// packages/frontend/lib/entitlements/__tests__/buildAnonReturnTo.test.ts
import { describe, it, expect } from "vitest";
import { buildAnonReturnTo } from "../buildAnonReturnTo";

describe("buildAnonReturnTo", () => {
  it("returns just the path when there is no state and no metric", () => {
    expect(buildAnonReturnTo("/map", "", undefined)).toBe("/map");
  });

  it("sets the metric param when provided on a bare path", () => {
    expect(buildAnonReturnTo("/map", "", "cap_rate")).toBe(
      "/map?metric=cap_rate",
    );
  });

  it("preserves existing map params and overrides metric", () => {
    expect(
      buildAnonReturnTo(
        "/map",
        "?level=county&st=TX&metric=home_value",
        "cap_rate",
      ),
    ).toBe("/map?level=county&st=TX&metric=cap_rate");
  });

  it("preserves existing params when no metric override is given", () => {
    expect(buildAnonReturnTo("/map", "?level=metro&st=CA", undefined)).toBe(
      "/map?level=metro&st=CA",
    );
  });
});
