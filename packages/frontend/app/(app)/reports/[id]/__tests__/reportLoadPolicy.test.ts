import { describe, it, expect } from "vitest";
import {
  decideNextStep,
  DEFAULT_MAX_NETWORK_ERRORS,
  type PollContext,
} from "../reportLoadPolicy";

/**
 * Regression guard for the production "Report not found / Failed to fetch" wedge:
 * a transient network error during a multi-minute report generation must NOT
 * abort the viewer. A genuine 404 (null body) still resolves to "not found".
 */
const cold = (overrides: Partial<PollContext> = {}): PollContext => ({
  consecutiveNetworkErrors: 0,
  haveReport: false,
  maxNetworkErrors: DEFAULT_MAX_NETWORK_ERRORS,
  ...overrides,
});

describe("decideNextStep — report viewer load/poll policy", () => {
  it("renders a ready report (terminal)", () => {
    expect(decideNextStep({ kind: "report", status: "ready" }, cold())).toBe(
      "render",
    );
  });

  it("renders a failed report (terminal — shows the Generation Failed UI)", () => {
    expect(decideNextStep({ kind: "report", status: "failed" }, cold())).toBe(
      "render",
    );
  });

  it("keeps polling while the report is still generating", () => {
    expect(
      decideNextStep({ kind: "report", status: "generating" }, cold()),
    ).toBe("poll");
  });

  it("shows not-found for a genuine 404 (null body)", () => {
    expect(decideNextStep({ kind: "missing" }, cold())).toBe("notFound");
  });

  it("retries (polls) on a transient network error under budget on cold load", () => {
    expect(
      decideNextStep(
        { kind: "networkError" },
        cold({ consecutiveNetworkErrors: 1 }),
      ),
    ).toBe("poll");
  });

  it("gives up only after the network-error budget is exhausted on cold load", () => {
    expect(
      decideNextStep(
        { kind: "networkError" },
        cold({ consecutiveNetworkErrors: DEFAULT_MAX_NETWORK_ERRORS }),
      ),
    ).toBe("giveUp");
  });

  it("NEVER abandons a report it already has, even past the error budget", () => {
    // This is the exact production failure: report is generating fine, a blip
    // hits, and the old code wedged on "Report not found".
    expect(
      decideNextStep(
        { kind: "networkError" },
        cold({
          haveReport: true,
          consecutiveNetworkErrors: DEFAULT_MAX_NETWORK_ERRORS + 3,
        }),
      ),
    ).toBe("poll");
  });
});
