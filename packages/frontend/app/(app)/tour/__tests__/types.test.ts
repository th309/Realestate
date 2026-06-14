import { describe, it, expect } from "vitest";
import { nextPhase, STEP_ORDER, type TourPhase } from "../types";

describe("nextPhase", () => {
  it("walks the canonical 7-phase order", () => {
    expect(nextPhase("persona")).toBe("market");
    expect(nextPhase("market")).toBe("step1");
    expect(nextPhase("step1")).toBe("step2");
    expect(nextPhase("step2")).toBe("step3");
    expect(nextPhase("step3")).toBe("step4");
    expect(nextPhase("step4")).toBe("celebrate");
  });

  it("returns null at the last phase", () => {
    expect(nextPhase("celebrate")).toBeNull();
  });

  it("returns null for unknown phases (defensive guard)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(nextPhase("not-a-phase" as any)).toBeNull();
  });
});

describe("STEP_ORDER", () => {
  it("contains exactly 7 phases in canonical order", () => {
    expect(STEP_ORDER).toEqual([
      "persona",
      "market",
      "step1",
      "step2",
      "step3",
      "step4",
      "celebrate",
    ] satisfies TourPhase[]);
  });
});
