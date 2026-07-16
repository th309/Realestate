import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/data/fetchers/market-explorer", () => ({
  fetchScopeSeries: vi.fn(),
}));

import { fetchScopeSeries } from "@/lib/data/fetchers/market-explorer";
import { useExplorerScopeData } from "../useExplorerScopeData";

const mockFetchScopeSeries = vi.mocked(fetchScopeSeries);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useExplorerScopeData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches once (not per-metric) and passes through dates/regions/series/totalAvailable unchanged", async () => {
    mockFetchScopeSeries.mockResolvedValue({
      success: true,
      geoLevel: "metro",
      months: 120,
      dates: ["2026-04-01", "2026-05-01"],
      regions: [{ id: "35620", name: "New York", state: "NY", population: 1 }],
      series: { propertyiq_score: { "35620": [71, 73] } },
      totalAvailable: 90,
    });

    const { result } = renderHook(
      () => useExplorerScopeData("metro", undefined, undefined, false),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFetchScopeSeries).toHaveBeenCalledTimes(1);
    expect(mockFetchScopeSeries).toHaveBeenCalledWith("metro", {
      parentLevel: undefined,
      parentId: undefined,
      months: 120,
      includeNearby: false,
    });
    expect(result.current.dates).toEqual(["2026-04-01", "2026-05-01"]);
    expect(result.current.regions[0].id).toBe("35620");
    expect(result.current.series.propertyiq_score["35620"]).toEqual([71, 73]);
    expect(result.current.totalAvailable).toBe(90);
    expect(result.current.error).toBeNull();
  });

  it("totalAvailable is undefined when the response doesn't include it (uncapped scopes)", async () => {
    mockFetchScopeSeries.mockResolvedValue({
      success: true,
      geoLevel: "state",
      months: 3,
      dates: [],
      regions: [],
      series: {},
    });
    const { result } = renderHook(
      () => useExplorerScopeData("state", undefined, undefined, undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalAvailable).toBeUndefined();
  });

  it("returns empty defaults before the query resolves", () => {
    mockFetchScopeSeries.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(
      () => useExplorerScopeData("state", undefined, undefined, undefined),
      { wrapper },
    );
    expect(result.current.dates).toEqual([]);
    expect(result.current.regions).toEqual([]);
    expect(result.current.series).toEqual({});
    expect(result.current.isLoading).toBe(true);
  });
});
