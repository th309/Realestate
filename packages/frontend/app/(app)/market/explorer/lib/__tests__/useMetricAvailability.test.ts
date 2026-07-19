import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMetricAvailability } from "../useMetricAvailability";

describe("useMetricAvailability", () => {
  it("disables propertyiq_score for state scope even though the backend's synthesized mean-of-metros proxy populates series.propertyiq_score with real (if sparse) values", () => {
    const dispatch = vi.fn();
    const series = {
      propertyiq_score: { "48": [55, 60] }, // sparse synthetic data — NOT a real reason to allow selection
      home_value: { "48": [300000, 310000] },
    } as any;
    const { result } = renderHook(() =>
      useMetricAvailability("state", true, series, "home_value_yoy", dispatch),
    );
    expect(result.current).toContain("score");
  });

  it("does not disable propertyiq_score for metro scope", () => {
    const dispatch = vi.fn();
    const series = {
      propertyiq_score: { "12420": [55, 60] },
      home_value: { "12420": [300000, 310000] },
    } as any;
    const { result } = renderHook(() =>
      useMetricAvailability("metro", false, series, "score", dispatch),
    );
    expect(result.current).not.toContain("score");
  });

  it("disables a FETCHED metric with no supported geo AND no fetched data (e.g. hotness_score at state scope) — derived metrics like rent_yield/home_value_yoy are never gated by this check at all, matching the pre-existing behavior this hook was extracted from verbatim", () => {
    const dispatch = vi.fn();
    const series = { home_value: { "48": [300000] } } as any; // no hotness_score at all
    const { result } = renderHook(() =>
      useMetricAvailability("state", true, series, "home_value_yoy", dispatch),
    );
    expect(result.current).toContain("hotness");
  });

  it("disables hotness_score at state scope when the backend returns an empty (but present) series object — the real shape merge-metric-series produces when realtor_state has no hotness_score column, as opposed to the key being entirely absent", () => {
    const dispatch = vi.fn();
    const series = {
      home_value: { "48": [300000] },
      hotness_score: {}, // present key, zero regions — NOT the same as undefined
    } as any;
    const { result } = renderHook(() =>
      useMetricAvailability("state", true, series, "home_value_yoy", dispatch),
    );
    expect(result.current).toContain("hotness");
  });

  it("auto-switches away from a metric that just became disabled, to the first still-valid one", () => {
    const dispatch = vi.fn();
    const series = {
      propertyiq_score: { "48": [55] },
      home_value: { "48": [300000] },
    } as any;
    renderHook(() =>
      useMetricAvailability("state", true, series, "score", dispatch),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_METRIC",
      metric: expect.not.stringMatching(/^score$/),
    });
  });

  it("does not dispatch when the active metric is already valid for this scope", () => {
    const dispatch = vi.fn();
    const series = {
      propertyiq_score: { "12420": [55] },
      home_value: { "12420": [300000] },
    } as any;
    renderHook(() =>
      useMetricAvailability("metro", false, series, "score", dispatch),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
});
