import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * The global analyzer defaults are a starting point for a NEW analysis, not a
 * correction to be applied to an old one. Left ungated they land on a
 * hydrated saved deal too — silently reverting four input fields and five
 * assumptions the user tuned for that deal, and then (because the content
 * changed) autosaving the reversion. Opening a deal would destroy it.
 */
vi.mock("@/lib/data", () => ({ useAnalyzerDefaults: vi.fn() }));

import { useAnalyzerDefaults } from "@/lib/data";
import { useAnalyzerDefaultsPrefill } from "../use-analyzer-defaults-prefill";
import type { DealInput } from "@propertyiq/analyzer-core";

const mockUseAnalyzerDefaults = vi.mocked(useAnalyzerDefaults);

const SAVED_DEFAULTS = {
  vacancyPct: 3,
  maintenancePct: 4,
  pmPct: 6,
  closingCostsPct: 2,
  rentGrowthPct: 5,
};

/** A deal whose owner deliberately tuned away from those defaults. */
const TUNED_INPUT = {
  price: 300_000,
  vacancyPctOfRent: 12,
  financing: { closingCostsPct: 7 },
} as unknown as DealInput;

function renderPrefill(enabled?: boolean) {
  const setInput = vi.fn();
  const setAssumption = vi.fn();
  renderHook(() =>
    useAnalyzerDefaultsPrefill({
      setInput,
      setAssumption,
      currentInput: TUNED_INPUT,
      enabled,
    }),
  );
  return { setInput, setAssumption };
}

describe("useAnalyzerDefaultsPrefill leaves a resumed deal's tuning alone", () => {
  beforeEach(() => {
    mockUseAnalyzerDefaults.mockReset();
    mockUseAnalyzerDefaults.mockReturnValue({
      data: SAVED_DEFAULTS,
    } as unknown as ReturnType<typeof useAnalyzerDefaults>);
  });

  it("applies the defaults to a fresh analysis", () => {
    const { setInput, setAssumption } = renderPrefill(true);
    expect(setInput).toHaveBeenCalledWith(
      expect.objectContaining({ vacancyPctOfRent: 3 }),
    );
    expect(setAssumption).toHaveBeenCalledWith("rentGrowthPct", 5);
  });

  it("applies them by default, so a caller that omits the flag is unchanged", () => {
    const { setInput } = renderPrefill(undefined);
    expect(setInput).toHaveBeenCalled();
  });

  it("writes nothing at all when hydrating a saved deal", () => {
    const { setInput, setAssumption } = renderPrefill(false);
    expect(setInput).not.toHaveBeenCalled();
    expect(setAssumption).not.toHaveBeenCalled();
  });
});
