import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCurrentDealState } from "../use-current-deal-state";
import { DEFAULT_ASSUMPTIONS } from "../analyzer-assumptions";
import type { DealStateV2 } from "../deal-state-types";

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
  } as unknown as Parameters<typeof useCurrentDealState>[0]["state"];
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDealState(initialState?: DealStateV2) {
  return renderHook(
    ({ state }) =>
      useCurrentDealState({
        state,
        initialState,
        dealId: "row-1",
        isPro: true,
        analysisMode: "focused",
        activeGoal: null,
        notes: "",
        shareNotes: false,
      }),
    { initialProps: { state: makeState() }, wrapper },
  );
}

describe("useCurrentDealState", () => {
  beforeEach(() => patchDealState.mockReset().mockResolvedValue(undefined));

  // The load-bearing invariant: useDealAutosave re-arms its debounce on every
  // change of the state object's IDENTITY, so a rebuilt-per-render object
  // would make its own "saving"/"saved" re-render schedule the next save —
  // an autosave loop writing forever with nothing edited.
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

  it("moves the staleness clock only on an explicit market refresh", async () => {
    const { result } = renderDealState();
    await act(async () => {
      result.current.refreshMarketData();
    });
    expect(result.current.marketCapturedAt).not.toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("records the active goal for audit but never restores one", () => {
    const { result } = renderDealState();
    expect(result.current.dealState.activeGoalAtSave).toBeNull();
  });
});
