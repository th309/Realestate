import { describe, it, expect } from "vitest";
import {
  getStepContent,
  nextSandboxStep,
  SANDBOX_STEP_ORDER,
} from "../step-content";

describe("sandbox step content (Score → Why)", () => {
  it("has exactly two spotlight steps in order", () => {
    expect(SANDBOX_STEP_ORDER).toEqual(["step1", "step2"]);
  });
  it("step1 targets the PropertyIQ score; step2 the AI assessment", () => {
    expect(getStepContent("step1", null).targetSelector).toBe(
      '[data-tour="propertyiq-score"]',
    );
    expect(getStepContent("step2", null).targetSelector).toBe(
      '[data-tour="ai-assessment"]',
    );
  });
  it("uses persona-specific score copy for investors", () => {
    expect(getStepContent("step1", "investor").body).toMatch(
      /investment signal/i,
    );
  });
});

describe("getStepContent", () => {
  it("returns persona-specific body for agent on step1", () => {
    const c = getStepContent("step1", "agent");
    expect(c.body).toMatch(/score|client|listing/i);
  });

  it("falls back to default body when persona variant missing", () => {
    const c = getStepContent("step1", null);
    expect(c.body).toBeTruthy();
  });

  it("returns selector + placement metadata for each step", () => {
    SANDBOX_STEP_ORDER.forEach((id) => {
      const c = getStepContent(id, "investor");
      expect(c.targetSelector).toMatch(/^\[data-tour=/);
      expect(["top", "bottom", "left", "right"]).toContain(c.placement);
    });
  });

  it("throws on unknown step id", () => {
    expect(() => getStepContent("step99" as never, "agent")).toThrow();
  });
});

describe("nextSandboxStep", () => {
  it("returns the next step in order", () => {
    expect(nextSandboxStep("step1")).toBe("step2");
  });

  it("returns null at the last step", () => {
    expect(nextSandboxStep("step2")).toBe(null);
  });
});
