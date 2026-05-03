/**
 * useMigrationFlows + fetchMigrationFlows — Unit Tests
 *
 * Verifies the migration flows fetcher hits the correct backend endpoint
 * and that the React Query hook caches results by (fips, source, direction, limit).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import {
  fetchMigrationFlows,
  useMigrationFlows,
  type MigrationFlowsResult,
} from "../migration-flows";

// --- Test fixtures -----------------------------------------------------------

const WAKE_COUNTY_IRS_INFLOW: MigrationFlowsResult = {
  geography: { fips: "37183", name: "Wake County, NC", level: "county" },
  source: "irs",
  direction: "in",
  as_of: "2022-01-01",
  flows: [
    {
      origin_fips: "36061",
      origin_name: "New York County, NY",
      num_returns: 412,
      num_exemptions: 833,
      avg_agi: 92500,
    },
    {
      origin_fips: "06037",
      origin_name: "Los Angeles County, CA",
      num_returns: 305,
      num_exemptions: 612,
      avg_agi: 88100,
    },
  ],
};

// --- Helpers -----------------------------------------------------------------

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// --- Tests -------------------------------------------------------------------

describe("fetchMigrationFlows", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls /api/migration/flows/:source/:fips with direction + limit query params", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse(WAKE_COUNTY_IRS_INFLOW),
    );

    const result = await fetchMigrationFlows("37183", "irs", "in", 5);

    expect(result).toEqual(WAKE_COUNTY_IRS_INFLOW);

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(calledUrl).toContain("/api/migration/flows/irs/37183");
    expect(calledUrl).toContain("direction=in");
    expect(calledUrl).toContain("limit=5");
  });
});

describe("useMigrationFlows", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns flows for Wake County IRS inflow", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(WAKE_COUNTY_IRS_INFLOW),
    );

    const wrapper = makeWrapper();
    const { result } = renderHook(
      () => useMigrationFlows("37183", "irs", "in", 5),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(WAKE_COUNTY_IRS_INFLOW);
    expect(result.current.data?.flows).toHaveLength(2);
    expect(result.current.data?.flows[0]).toMatchObject({
      origin_fips: "36061",
      num_returns: 412,
    });
  });

  it("caches by (fips, source, direction, limit) — same args reuse cache, different args refetch", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(jsonResponse(WAKE_COUNTY_IRS_INFLOW));

    // Share a single QueryClient across hook renders so cache lookups happen.
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);

    // First call: should fetch.
    const first = renderHook(() => useMigrationFlows("37183", "irs", "in", 5), {
      wrapper,
    });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call with identical args: should hit cache, no new fetch.
    const second = renderHook(
      () => useMigrationFlows("37183", "irs", "in", 5),
      { wrapper },
    );
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Third call with different direction: should refetch (new cache key).
    const third = renderHook(
      () => useMigrationFlows("37183", "irs", "out", 5),
      { wrapper },
    );
    await waitFor(() => expect(third.result.current.isLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
