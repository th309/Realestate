import { describe, it, expect } from "vitest";
import {
  FORMAT_PICKER_STEP,
  UNIMPLEMENTED_STEPS,
  firstStep,
  nextStep,
  previousStep,
  stepPosition,
  stepsForFormat,
} from "../wizard-steps";

/**
 * The wizard's step order used to be hardcoded branching in page.tsx. These
 * pin the behaviour that branching had, so the manifest-driven version is a
 * refactor rather than a rewrite with a different flow.
 */
describe("stepsForFormat", () => {
  it("sends market-data formats to the market picker first", () => {
    expect(stepsForFormat("grade_reveal")[0]).toBe("market");
    expect(stepsForFormat("head_to_head")[0]).toBe("market");
  });

  it("sends ranking formats to params instead of a market search", () => {
    expect(stepsForFormat("top_10_ranking")[0]).toBe("params");
    expect(stepsForFormat("bottom_10_ranking")[0]).toBe("params");
  });

  it("keeps the resolved-rankings preview, which ranking formats really have", () => {
    expect(stepsForFormat("top_10_ranking")).toContain("preview");
  });

  it("skips the preview step where no renderer exists yet", () => {
    // Declared in the manifest, but the live <Player> preview is a later
    // milestone. Skipping is explicit and listed, never silent.
    expect(UNIMPLEMENTED_STEPS).toContain("preview");
    expect(stepsForFormat("grade_reveal")).not.toContain("preview");
  });

  it("never asks the product demo for a market — it has none", () => {
    const steps = stepsForFormat("product_demo_vertical");
    expect(steps).not.toContain("market");
    expect(steps[0]).toBe("copy");
    expect(steps).toContain("media");
  });

  it("handles infographic, which has no video manifest entry", () => {
    expect(stepsForFormat("infographic")).toEqual(["params", "confirm"]);
  });

  it("gives an unknown format a usable flow rather than a blank screen", () => {
    expect(stepsForFormat("something_new")).toEqual(["market", "confirm"]);
  });

  it("always ends on confirm", () => {
    for (const f of [
      "grade_reveal",
      "top_10_ranking",
      "product_demo_vertical",
      "infographic",
      "unknown_format",
    ]) {
      const steps = stepsForFormat(f);
      expect(steps[steps.length - 1]).toBe("confirm");
    }
  });
});

describe("navigation", () => {
  it("advances through a ranking flow in order", () => {
    expect(firstStep("top_10_ranking")).toBe("params");
    expect(nextStep("top_10_ranking", "params")).toBe("preview");
    expect(nextStep("top_10_ranking", "preview")).toBe("confirm");
  });

  it("returns null past the last step, so submit is unambiguous", () => {
    expect(nextStep("grade_reveal", "confirm")).toBeNull();
  });

  it("falls back to the format picker from the first step", () => {
    // An operator must never be able to strand themselves with no way back.
    expect(previousStep("grade_reveal", "market")).toBe(FORMAT_PICKER_STEP);
    expect(previousStep("top_10_ranking", "params")).toBe(FORMAT_PICKER_STEP);
  });

  it("steps backwards through the middle of a flow", () => {
    expect(previousStep("top_10_ranking", "confirm")).toBe("preview");
    expect(previousStep("product_demo_vertical", "media")).toBe("copy");
  });

  it("reports position for a progress indicator", () => {
    expect(stepPosition("top_10_ranking", "params")).toEqual({
      index: 1,
      total: 3,
    });
    expect(stepPosition("product_demo_vertical", "confirm")).toEqual({
      index: 3,
      total: 3,
    });
  });
});
