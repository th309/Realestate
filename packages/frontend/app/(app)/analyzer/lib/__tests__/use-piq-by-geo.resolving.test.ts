import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * `isResolving` exists because a null PIQ score is ambiguous: it means both
 * "this level has no score" and "this level hasn't loaded yet".
 *
 * The batched AI call fingerprints these scores into its cache key. Firing
 * mid-resolution therefore burns an LLM generation on a snapshot that is about
 * to change, under a key nothing will ever hit again — measured at three
 * `/ai-insights/batch` POSTs per single page load before this gate existed.
 */
vi.mock("@/lib/data", () => ({ useMarketContext: vi.fn() }));

import { useMarketContext } from "@/lib/data";
import { usePiqByGeo } from "../use-piq-by-geo";

const mockUseMarketContext = vi.mocked(useMarketContext);

/** Build a useMarketContext return for a given score / loading state. */
function ctx(score: number | null, isLoading: boolean) {
  return {
    data:
      score == null ? null : { piq_score: { value: score, label: "STEADY" } },
    quotaExceeded: false,
    isLoading,
    isFetching: isLoading,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useMarketContext>;
}

/** usePiqByGeo calls useMarketContext three times: zip, county, metro. */
function queueLevels(
  zip: ReturnType<typeof ctx>,
  county: ReturnType<typeof ctx>,
  metro: ReturnType<typeof ctx>,
) {
  mockUseMarketContext
    .mockReturnValueOnce(zip)
    .mockReturnValueOnce(county)
    .mockReturnValueOnce(metro);
}

const fullChain = {
  zip: "80212",
  county_fips: "08031",
  cbsa_code: "19740",
};

describe("usePiqByGeo.isResolving gates on every enabled level settling", () => {
  beforeEach(() => mockUseMarketContext.mockReset());

  it("resolves as pending until the chain itself arrives", () => {
    queueLevels(ctx(null, false), ctx(null, false), ctx(null, false));
    const { result } = renderHook(() => usePiqByGeo(undefined));
    // No chain means no ids to query, so all three read null — which is
    // indistinguishable from "no scores anywhere" without this guard.
    expect(result.current.isResolving).toBe(true);
  });

  it("stays pending while any enabled level is still loading", () => {
    queueLevels(ctx(11, false), ctx(null, true), ctx(5, false));
    const { result } = renderHook(() => usePiqByGeo(fullChain));
    expect(result.current.isResolving).toBe(true);
  });

  it("settles once every enabled level has loaded", () => {
    queueLevels(ctx(11, false), ctx(7, false), ctx(5, false));
    const { result } = renderHook(() => usePiqByGeo(fullChain));

    expect(result.current.isResolving).toBe(false);
    expect(result.current.piqByGeo).toEqual({ zip: 11, county: 7, metro: 5 });
  });

  it("does not wait on levels the chain never supplied", () => {
    // An unmetropolitan ZIP has no cbsa_code, so the metro query is disabled
    // and can never load. Waiting on it would hang the gate forever and the
    // analyzer would never request its narrative at all.
    queueLevels(ctx(11, false), ctx(7, false), ctx(null, true));
    const { result } = renderHook(() =>
      usePiqByGeo({ zip: "80212", county_fips: "08031" }),
    );

    expect(result.current.isResolving).toBe(false);
    expect(result.current.piqByGeo.metro).toBeNull();
  });

  it("settles when a level legitimately has no score", () => {
    // Loaded, but the geography genuinely has no PIQ score. Distinct from
    // "still loading" — this must NOT hold the gate.
    queueLevels(ctx(null, false), ctx(7, false), ctx(5, false));
    const { result } = renderHook(() => usePiqByGeo(fullChain));

    expect(result.current.isResolving).toBe(false);
    expect(result.current.piqByGeo.zip).toBeNull();
  });
});
