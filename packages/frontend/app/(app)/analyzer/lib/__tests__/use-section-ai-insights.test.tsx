import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type {
  DealGradingResult,
  DealInput,
  RentalResult,
} from "@propertyiq/analyzer-core";

/**
 * Covers the discriminator wiring in use-section-ai-insights.ts: it must be
 * built from buildAiInsightsFingerprint (packages/analyzer-core/src/
 * ai-cache-fingerprint.ts) so a re-render with materially different deal
 * input / rental / grading data fires a fresh batched fetch, while cosmetic
 * jitter within a rounding bucket reuses the cached response. The
 * fingerprint's own field-by-field sensitivity is exhaustively covered by
 * analyzer-core's ai-cache-fingerprint*.test.ts files — this test only
 * proves the hook actually wires it in as the react-query key.
 */
vi.mock("@/lib/data", () => ({
  fetchBatchedAiInsights: vi.fn(),
}));

import { fetchBatchedAiInsights } from "@/lib/data";
import { useSectionAiInsights } from "../use-section-ai-insights";

const mockFetch = vi.mocked(fetchBatchedAiInsights);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const dealInput: DealInput = {
  price: 425_000,
  rentMonthly: 2_950,
  taxAnnual: 6_400,
  insuranceAnnual: 1_400,
  financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
};

const rental: RentalResult = {
  noiAnnual: 24_000,
  capRatePct: 5.6,
  cashOnCashPct: 8.2,
  dscr: 1.23,
  cashflowMonthly: 412,
  onePctRulePct: 0.69,
  totalCashInvested: 95_000,
  monthlyDebtService: 1_650,
};

const grading: DealGradingResult = {
  letter: "B",
  label: "Buy",
  summary: "solid",
  rawGpa: 3.0,
  marketAdjustment: 0.1,
  finalGpa: 3.14,
  metrics: [],
  advisories: [],
  autoKills: [],
};

function baseArgs(
  overrides: Partial<Parameters<typeof useSectionAiInsights>[0]> = {},
) {
  return {
    enabled: true,
    input: dealInput,
    rental,
    flip: null,
    brrrr: null,
    rentcast: {},
    piq: { geo_level: "metro" },
    grading,
    strategy: "BUY_AND_HOLD" as const,
    piqByGeo: { zip: 42, county: 68, metro: 73 },
    goal: null,
    projection: null,
    ...overrides,
  };
}

const emptyBatch = {
  recommendation_analysis: {
    text: "a",
    threadId: "t",
    citedFacts: [],
    cacheHit: false,
  },
  projection: { text: "b", threadId: "t", citedFacts: [], cacheHit: false },
  expense_waterfall: {
    text: "c",
    threadId: "t",
    citedFacts: [],
    cacheHit: false,
  },
  sensitivity: { text: "d", threadId: "t", citedFacts: [], cacheHit: false },
  comps: { text: "e", threadId: "t", citedFacts: [], cacheHit: false },
  after_tax: { text: "f", threadId: "t", citedFacts: [], cacheHit: false },
};

describe("useSectionAiInsights discriminator wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(emptyBatch);
  });

  it("fetches once when enabled and grading is present", async () => {
    const { result } = renderHook(() => useSectionAiInsights(baseArgs()), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.projection.aiIsLoading).toBe(false),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when grading is absent", async () => {
    renderHook(() => useSectionAiInsights(baseArgs({ grading: null })), {
      wrapper,
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refetches when the grading letter changes", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useSectionAiInsights>[0]) =>
        useSectionAiInsights(props),
      { wrapper: localWrapper, initialProps: baseArgs() },
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender(baseArgs({ grading: { ...grading, letter: "A" } }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(result.current.projection.aiText).toBeTruthy();
  });

  it("refetches when rental.cashflowMonthly crosses the $50 fingerprint bucket", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { rerender } = renderHook(
      (props: Parameters<typeof useSectionAiInsights>[0]) =>
        useSectionAiInsights(props),
      { wrapper: localWrapper, initialProps: baseArgs() },
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender(
      baseArgs({
        rental: { ...rental, cashflowMonthly: rental.cashflowMonthly! + 50 },
      }),
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it("does NOT refetch on cashflow jitter within the same $50 bucket", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { rerender } = renderHook(
      (props: Parameters<typeof useSectionAiInsights>[0]) =>
        useSectionAiInsights(props),
      { wrapper: localWrapper, initialProps: baseArgs() },
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender(
      baseArgs({
        rental: { ...rental, cashflowMonthly: rental.cashflowMonthly! + 4 },
      }),
    );
    // Give react-query a tick to (not) fire a second request.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refetches on a flip-only result change when strategy is FIX_AND_FLIP", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const flipArgs = baseArgs({
      rental: null,
      strategy: "FIX_AND_FLIP",
      flip: {
        mao70: 280_000,
        wholetailMax: 320_000,
        projectedProfit: 45_000,
        projectedRoiPct: 24.5,
      },
    });
    const { rerender } = renderHook(
      (props: Parameters<typeof useSectionAiInsights>[0]) =>
        useSectionAiInsights(props),
      { wrapper: localWrapper, initialProps: flipArgs },
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender({
      ...flipArgs,
      flip: {
        ...flipArgs.flip!,
        projectedProfit: flipArgs.flip!.projectedProfit + 500,
      },
    });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
