import { describe, it, expect } from "vitest";
import { resolvePrefill } from "../prefill";

describe("resolvePrefill", () => {
  it("no format → format step, nothing prefilled", () => {
    expect(resolvePrefill({})).toEqual({
      format: "",
      market: "",
      step: "format",
    });
  });

  it("invalid format → format step", () => {
    expect(resolvePrefill({ format: "image_post", market: "Austin" })).toEqual({
      format: "",
      market: "",
      step: "format",
    });
  });

  it("valid non-ranking format + market → confirm step", () => {
    expect(
      resolvePrefill({ format: "score_mover", market: "  Austin, TX  " }),
    ).toEqual({ format: "score_mover", market: "Austin, TX", step: "confirm" });
  });

  it("valid non-ranking format, no market → market step", () => {
    expect(resolvePrefill({ format: "grade_reveal" })).toEqual({
      format: "grade_reveal",
      market: "",
      step: "market",
    });
  });

  it("ranking format ignores market → ranking-params step", () => {
    expect(
      resolvePrefill({ format: "top_10_ranking", market: "Austin" }),
    ).toEqual({ format: "top_10_ranking", market: "", step: "ranking-params" });
  });
});
