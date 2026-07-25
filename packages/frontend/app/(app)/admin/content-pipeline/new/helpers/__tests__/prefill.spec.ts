import { describe, it, expect } from "vitest";
import { resolvePrefill } from "../prefill";

describe("resolvePrefill", () => {
  it("no format → format step, nothing prefilled", () => {
    expect(resolvePrefill({})).toEqual({
      format: "",
      marketSeed: "",
      step: "format",
    });
  });

  it("invalid format → format step (market ignored)", () => {
    expect(resolvePrefill({ format: "image_post", market: "Austin" })).toEqual({
      format: "",
      marketSeed: "",
      step: "format",
    });
  });

  it("valid non-ranking format + market → market step with a trimmed seed (never confirm)", () => {
    expect(
      resolvePrefill({ format: "score_mover", market: "  Austin, TX  " }),
    ).toEqual({
      format: "score_mover",
      marketSeed: "Austin, TX",
      step: "market",
    });
  });

  it("valid non-ranking format, no market → market step, empty seed", () => {
    expect(resolvePrefill({ format: "grade_reveal" })).toEqual({
      format: "grade_reveal",
      marketSeed: "",
      step: "market",
    });
  });

  it("ranking format ignores market → ranking-params step", () => {
    expect(
      resolvePrefill({ format: "top_10_ranking", market: "Austin" }),
    ).toEqual({
      format: "top_10_ranking",
      marketSeed: "",
      step: "ranking-params",
    });
  });
});
