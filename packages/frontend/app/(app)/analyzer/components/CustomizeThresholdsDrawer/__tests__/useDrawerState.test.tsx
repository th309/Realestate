import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  AGGRESSIVE_THRESHOLDS,
  BALANCED_THRESHOLDS,
} from "@propertyiq/analyzer-core";

// Mock the data-layer module so the hook doesn't try to hit network.
// Mirrors the mock scaffolding in CustomizeThresholdsDrawer.test.tsx.
const fetchThresholds = vi.fn();
const updateThresholds = vi.fn();
const deleteThresholds = vi.fn();
const fetchAnalyzerDefaults = vi.fn();
const updateAnalyzerDefaults = vi.fn();

vi.mock("@/lib/data", async () => {
  const { useQuery, useMutation, useQueryClient } =
    await import("@tanstack/react-query");
  return {
    useThresholds: (strategy: string) =>
      useQuery({
        queryKey: ["thresholds", strategy],
        queryFn: () => fetchThresholds(strategy),
      }),
    useUpdateThresholds: (strategy: string) => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (body: unknown) => updateThresholds(strategy, body),
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: ["thresholds", strategy] }),
      });
    },
    useDeleteThresholds: (strategy: string) => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: () => deleteThresholds(strategy),
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: ["thresholds", strategy] }),
      });
    },
    useAnalyzerDefaults: () =>
      useQuery({
        queryKey: ["analyzer-defaults"],
        queryFn: () => fetchAnalyzerDefaults(),
      }),
    useUpdateAnalyzerDefaults: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (body: unknown) => updateAnalyzerDefaults(body),
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: ["analyzer-defaults"] }),
      });
    },
  };
});

import { useDrawerState } from "../useDrawerState";

const baseDefaults = {
  vacancyPct: 0.05,
  maintenancePct: 0.05,
  capexPct: 0.05,
  pmPct: 0.08,
  rentGrowthPct: 0.03,
  appreciationPct: 0.03,
  holdYears: 10,
  closingCostsPct: 0.03,
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fetchThresholds.mockReset();
  fetchAnalyzerDefaults.mockReset();
  fetchThresholds.mockResolvedValue({
    ...BALANCED_THRESHOLDS,
    autoKills: { dscrFloor: { value: 0.8 } },
  });
  fetchAnalyzerDefaults.mockResolvedValue(baseDefaults);
});

describe("useDrawerState applyPreset", () => {
  it("preserves an existing autoKills block when switching presets", async () => {
    const { result } = renderHook(() => useDrawerState(true, "BUY_AND_HOLD"), {
      wrapper,
    });

    await waitFor(() =>
      expect(
        (result.current.draftThresholds as { autoKills?: unknown } | null)
          ?.autoKills,
      ).toEqual({ dscrFloor: { value: 0.8 } }),
    );

    act(() => result.current.applyPreset("aggressive"));

    await waitFor(() => {
      const { autoKills, ...rubric } = result.current.draftThresholds as {
        autoKills?: unknown;
      } & typeof AGGRESSIVE_THRESHOLDS;
      expect(autoKills).toEqual({ dscrFloor: { value: 0.8 } });
      expect(rubric).toEqual(AGGRESSIVE_THRESHOLDS);
    });
  });
});
