import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: vi.fn() }));

import { trackEvent } from "@/lib/analytics/tracker";
import { emitGradeCoverageEvent } from "../use-grading-result";

describe("use-grading-result telemetry", () => {
  it("emits feature.analyzer_grade once per gradable submit", () => {
    emitGradeCoverageEvent({ strategy: "buy_hold", hasRent: true });
    expect(trackEvent).toHaveBeenCalledWith("feature.analyzer_grade", {
      strategy: "buy_hold",
      hasRent: true,
    });
  });
});
