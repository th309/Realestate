import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCurrentDealState } from "../use-current-deal-state";
import { DEFAULT_ASSUMPTIONS } from "../analyzer-assumptions";
import type { DealStateV2 } from "../deal-state-types";
import type { InvestorGoal } from "../goal-types";

const requestMarketRefresh = vi.fn();

const patchDealState = vi.fn();
vi.mock("@/lib/data", () => ({
  patchDealState: (...a: unknown[]) => patchDealState(...a),
}));

// Mirrors what useAnalyzerState actually hands over: `input`, `assumptions`
// and `provenance` are useState values and keep their identity between
// renders, while the wrapper and `piqByGeo` are rebuilt on every render
// (see usePiqByGeo). Getting this wrong in the fixture would test a hook
// nobody ships.
const INPUT_300K = { price: 300_000 };
const PROVENANCE = {};

function makeState(input: object = INPUT_300K) {
  return {
    analyzer: { input },
    address: "1 A St",
    selectedZip: "78701",
    arvLocal: 0,
    rehabBudget: 45_000,
    propertyType: "sfh",
    unitCount: 1,
    assumptions: DEFAULT_ASSUMPTIONS,
    provenance: PROVENANCE,
    rentcastData: null,
    piqByGeo: { zip: 61, county: 58, metro: 63 },
    marketCapturedAt: "2026-01-01T00:00:00.000Z",
    requestMarketRefresh,
  } as unknown as Parameters<typeof useCurrentDealState>[0]["state"];
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDealState(
  initialState?: DealStateV2,
  activeGoal: InvestorGoal | null = null,
) {
  return renderHook(
    ({ state }) =>
      useCurrentDealState({
        state,
        initialState,
        dealId: "row-1",
        isPro: true,
        analysisMode: "focused",
        activeGoal,
        notes: "",
        shareNotes: false,
      }),
    { initialProps: { state: makeState() }, wrapper },
  );
}

describe("useCurrentDealState", () => {
  beforeEach(() => {
    patchDealState.mockReset().mockResolvedValue(undefined);
    requestMarketRefresh.mockReset();
    localStorage.clear();
  });

  // The load-bearing invariant: useDealAutosave re-arms its debounce on every
  // change of the state object's IDENTITY. It cannot loop — the fingerprint
  // gate returns early whenever the CONTENT is unchanged — but while a PATCH
  // is in flight, the hook's own "saving" re-render would hand a rebuilt
  // object to an effect whose saved baseline has not advanced yet, re-arming
  // the timer and sending a second, identical write.
  it("keeps one state object across re-renders that changed nothing", () => {
    const { result, rerender } = renderDealState();
    const first = result.current.dealState;
    rerender({ state: makeState() });
    expect(result.current.dealState).toBe(first);
  });

  it("produces a new state object when the deal actually changes", () => {
    const { result, rerender } = renderDealState();
    const first = result.current.dealState;
    rerender({ state: makeState({ price: 310_000 }) });
    expect(result.current.dealState).not.toBe(first);
    expect(result.current.dealState.input.price).toBe(310_000);
  });

  it("carries the saved market-capture time rather than stamping now", () => {
    const { result } = renderDealState();
    expect(result.current.marketCapturedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.current.dealState.marketCapturedAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("leaves the staleness clock alone when the user merely edits", () => {
    const { result, rerender } = renderDealState();
    rerender({ state: makeState({ price: 310_000 }) });
    // Autosave writes on this edit; the clock must not follow it, or a
    // 74-day-old deal looks freshly captured after one keystroke (spec §4.5).
    expect(result.current.marketCapturedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.current.dealState.marketCapturedAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("moves the staleness clock only on an explicit market refresh", async () => {
    const { result } = renderDealState();
    await act(async () => {
      result.current.refreshMarketData();
    });
    expect(result.current.marketCapturedAt).not.toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("opens the market-refresh gate before invalidating the queries", async () => {
    // On a hydrated deal those queries are DISABLED, and invalidating a
    // disabled query is a no-op — so a refresh that only invalidated would
    // silently do nothing at all.
    const { result } = renderDealState();
    await act(async () => {
      result.current.refreshMarketData();
    });
    expect(requestMarketRefresh).toHaveBeenCalledOnce();
  });

  it("records the LIVE active goal for audit and never restores a saved one", () => {
    // Spec §4.6. The goal is a standing preference owned by
    // localStorage["analyzer.investorGoal"]; a saved deal's goal is an audit
    // record of what framed its narratives, nothing more. Restoring it once
    // let one compare session's "fast cash" frame every later analysis.
    localStorage.setItem("analyzer.investorGoal", "cash_flow");
    const { result } = renderDealState(
      { activeGoalAtSave: "fast_cash" } as DealStateV2,
      "long_term_wealth",
    );

    expect(result.current.dealState.activeGoalAtSave).toBe("long_term_wealth");
    expect(localStorage.getItem("analyzer.investorGoal")).toBe("cash_flow");
  });

  it("seeds the deal label from the saved row and persists edits to it", () => {
    const { result } = renderDealState({
      label: "Duplex deal",
    } as DealStateV2);
    expect(result.current.label).toBe("Duplex deal");
    act(() => result.current.setLabel("Renamed"));
    expect(result.current.dealState.label).toBe("Renamed");
  });
});
