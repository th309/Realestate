import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAnonymousListingPresentation } from "../useAnonymousListingPresentation";
import { TourRateLimitError } from "../../fetchers/anonymous-listing-presentation";

// Mock the fetcher module
vi.mock("../../fetchers/anonymous-listing-presentation", async () => {
  const actual = await vi.importActual<
    typeof import("../../fetchers/anonymous-listing-presentation")
  >("../../fetchers/anonymous-listing-presentation");
  return {
    ...actual, // keeps TourRateLimitError as a real class
    generateAnonymousListingPresentation: vi.fn(),
  };
});

import { generateAnonymousListingPresentation } from "../../fetchers/anonymous-listing-presentation";

const mockedFetcher =
  generateAnonymousListingPresentation as unknown as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const validInput = {
  sessionId: "sess-test",
  persona: "agent" as const,
  market: { geoLevel: "city" as const, geoId: "cary-nc", name: "Cary, NC" },
};

const mockSuccess = {
  reportId: "anon-rpt-1",
  sessionId: "sess-test",
  watermark: "demo",
  expiresAt: "2030-01-01",
  claimable: true,
  report: { sections: [] },
};

describe("useAnonymousListingPresentation", () => {
  beforeEach(() => {
    mockedFetcher.mockReset();
  });

  it("forwards input to the fetcher and exposes the result on success", async () => {
    mockedFetcher.mockResolvedValue(mockSuccess);
    const { result } = renderHook(() => useAnonymousListingPresentation(), {
      wrapper,
    });

    result.current.mutate(validInput);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedFetcher).toHaveBeenCalledTimes(1);
    expect(mockedFetcher.mock.calls[0][0]).toEqual(validInput);
    expect(result.current.data?.reportId).toBe("anon-rpt-1");
  });

  it("exposes TourRateLimitError on rate-limit failure", async () => {
    const rateLimitErr = new TourRateLimitError(86400, "/auth/sign-up");
    mockedFetcher.mockRejectedValue(rateLimitErr);
    const { result } = renderHook(() => useAnonymousListingPresentation(), {
      wrapper,
    });

    result.current.mutate(validInput);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(TourRateLimitError);
    expect((result.current.error as TourRateLimitError).retryAfter).toBe(86400);
  });

  it("exposes generic Error on other failures", async () => {
    mockedFetcher.mockRejectedValue(
      new Error("Anon listing presentation failed: 503"),
    );
    const { result } = renderHook(() => useAnonymousListingPresentation(), {
      wrapper,
    });

    result.current.mutate(validInput);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("503");
  });
});
