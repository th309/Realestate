import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  BrrrrResult,
  FlipResult,
  ProjectionResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
import { useSelectedGoal } from "../use-selected-goal";
import type { AnalyzerAssumptions } from "../analyzer-assumptions";

/**
 * `activeGoal` is the guard against a goal the user cannot see framing their
 * analysis.
 *
 * The bug: `selectedGoal` persists to localStorage globally (a goal is a
 * standing preference, so it deliberately survives across deals and sessions)
 * and compare mode auto-infers one when none is set. The AI payload used to
 * read `selectedGoal` directly, so a `fast_cash` goal inferred during one
 * compare session went on framing every later focused-mode analysis — and the
 * recommendation prompt names the goal in its opening sentence. Buy-and-hold
 * deals opened with "your goal is fast cash within 12 months".
 *
 * `activeGoal` must therefore be null in every mode where GoalPicker is not
 * rendered, regardless of what is in localStorage.
 */

const rental = {
  noiAnnual: 24_000,
  capRatePct: 5.6,
  cashOnCashPct: 8.2,
  dscr: 1.23,
  cashflowMonthly: 412,
  onePctRulePct: 0.69,
  totalCashInvested: 95_000,
  monthlyDebtService: 1_650,
} as unknown as RentalResult;

const projection = {
  yearly: [],
  horizons: {
    y1: { equity: 100_000, irr: 0.05 },
    y10: { equity: 400_000, irr: 0.09 },
    y30: { equity: 812_345, irr: 0.11 },
  },
} as unknown as ProjectionResult;

const assumptions = {
  holdingMonths: 4,
  seasoningMonths: 6,
} as unknown as AnalyzerAssumptions;

const bundle = {
  rental,
  flip: null as FlipResult | null,
  brrrr: null as BrrrrResult | null,
};

function render(analysisMode: "focused" | "compare", hasGradable = true) {
  return renderHook(() =>
    useSelectedGoal(bundle, projection, assumptions, analysisMode, hasGradable),
  );
}

describe("useSelectedGoal exposes activeGoal only where the goal is visible", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns a null activeGoal in focused mode even with a goal saved from a previous session", () => {
    window.localStorage.setItem("analyzer.investorGoal", "fast_cash");

    const { result } = render("focused");

    // The picker state is still restored (the user's standing preference)...
    expect(result.current.selectedGoal).toBe("fast_cash");
    // ...but it must not frame an analysis whose strategy the user chose directly.
    expect(result.current.activeGoal).toBeNull();
  });

  it("surfaces the saved goal as activeGoal in compare mode", () => {
    window.localStorage.setItem("analyzer.investorGoal", "fast_cash");

    const { result } = render("compare");

    expect(result.current.activeGoal).toBe("fast_cash");
  });

  it("does not let the compare-mode auto-infer clobber an explicitly saved goal", () => {
    // Both the localStorage hydrate and the auto-infer fire in the same mount
    // commit. The inference must wait for hydration, or its setter lands last
    // and silently replaces the goal the user picked on their previous visit.
    window.localStorage.setItem("analyzer.investorGoal", "recycle_capital");

    const { result } = render("compare");

    expect(result.current.selectedGoal).toBe("recycle_capital");
    expect(window.localStorage.getItem("analyzer.investorGoal")).toBe(
      "recycle_capital",
    );
  });

  it("keeps activeGoal null in focused mode after compare auto-infers a goal", () => {
    // Compare mode pre-selects a goal so the user always sees a recommendation
    // tied to one; that inference is what seeded the stale localStorage value.
    const { result: compare } = render("compare");
    expect(compare.current.selectedGoal).not.toBeNull();

    const { result: focused } = render("focused");
    expect(focused.current.selectedGoal).not.toBeNull();
    expect(focused.current.activeGoal).toBeNull();
  });

  it("drops activeGoal when the user leaves compare mode", () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "focused" | "compare" }) =>
        useSelectedGoal(bundle, projection, assumptions, mode, true),
      { initialProps: { mode: "compare" as "focused" | "compare" } },
    );

    act(() => result.current.setSelectedGoal("fast_cash"));
    expect(result.current.activeGoal).toBe("fast_cash");

    // Clicking a strategy tile in StrategyCompare switches to focused mode.
    rerender({ mode: "focused" });
    expect(result.current.activeGoal).toBeNull();
  });

  it("returns a null activeGoal in focused mode when nothing was ever selected", () => {
    const { result } = render("focused");
    expect(result.current.activeGoal).toBeNull();
  });
});
