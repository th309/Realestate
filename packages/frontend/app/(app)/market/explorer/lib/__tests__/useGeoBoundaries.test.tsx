import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGeoBoundaries } from "../useGeoBoundaries";

const STATES_FC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { STATEFP: "48", STUSPS: "TX", name: "Texas" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-100, 30],
            [-99, 30],
            [-99.5, 31],
            [-100, 30],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { STATEFP: "02", STUSPS: "AK", name: "Alaska" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-150, 60],
            [-149, 60],
            [-149.5, 61],
            [-150, 60],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { STATEFP: "20", STUSPS: "KS", name: "Kansas" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-98, 39],
            [-97, 39],
            [-97.5, 40],
            [-98, 39],
          ],
        ],
      },
    },
  ],
};
const METROS_FC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        CBSAFP: "19100",
        NAME: "Dallas-Fort Worth-Arlington, TX",
        LSAD: "M1",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.9, 30.1],
            [-99.8, 30.1],
            [-99.85, 30.2],
            [-99.9, 30.1],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        CBSAFP: "28140",
        NAME: "Kansas City, MO-KS",
        LSAD: "M1",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-94.9, 39.0],
            [-94.5, 39.0],
            [-94.7, 39.3],
            [-94.9, 39.0],
          ],
        ],
      },
    },
  ],
};

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useGeoBoundaries", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes("states.json"))
        return { ok: true, json: async () => STATES_FC } as any;
      if (url.includes("metros.json"))
        return { ok: true, json: async () => METROS_FC } as any;
      throw new Error(`unexpected fetch: ${url}`);
    }) as any;
  });
  afterEach(() => vi.restoreAllMocks());

  it("national state view: excludes AK/HI/PR from the contiguous projection, parentOutline is null", async () => {
    const { result } = renderHook(
      () => useGeoBoundaries("state", undefined, undefined, undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.parentOutline).toBeNull();
    expect(result.current.features.map((f) => f.id).sort()).toEqual([
      "20",
      "48",
    ]); // AK (02) excluded
  });

  it("national metro scope: parentOutline is the merged contiguous-states background, features are every metro (no regionIds filter)", async () => {
    const { result } = renderHook(
      () => useGeoBoundaries("metro", undefined, undefined, undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.parentOutline).toContain("M");
    expect(result.current.features.map((f) => f.id).sort()).toEqual([
      "19100",
      "28140",
    ]);
  });

  it("state -> metro drill: parentOutline is the matching state, features filtered by NAME ending in the state abbreviation", async () => {
    const { result } = renderHook(
      () => useGeoBoundaries("metro", "state", "48", undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.features.map((f) => f.id)).toEqual(["19100"]);
  });

  it("state -> metro drill: matches a multi-state CBSA even when the state is not the first one listed (e.g. Kansas City, MO-KS for KS)", async () => {
    const { result } = renderHook(
      () => useGeoBoundaries("metro", "state", "20", undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.features.map((f) => f.id)).toEqual(["28140"]);
  });

  it("returns empty features (not a crash) when the parent id has no match", async () => {
    const { result } = renderHook(
      () => useGeoBoundaries("metro", "state", "99", undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.features).toEqual([]);
    expect(result.current.parentOutline).toBeNull();
  });
});
