import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: vi.fn() }));

import { trackEvent } from "@/lib/analytics/tracker";
import { useAnalyzerAutoFetch } from "../use-analyzer-state.hydration";

const deepLinkedFreeUser = {
  isPro: false,
  address: "123 Main St, Austin TX",
  paramAddress: "123 Main St, Austin TX",
  isHydrated: false,
};

describe("useAnalyzerAutoFetch reports the free-tier auto-fetch suppression", () => {
  beforeEach(() => vi.mocked(trackEvent).mockClear());

  it("emits paywall.view once, not once per render, for a blocked deep link", () => {
    const mutate = vi.fn();
    const { rerender } = renderHook(() =>
      useAnalyzerAutoFetch({ ...deepLinkedFreeUser, mutate }),
    );
    rerender();
    rerender();

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("paywall.view", {
      surface: "analyzer_auto_fetch",
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("stays silent when the Pro gate is not what blocked the fetch", () => {
    // No ?address= — nothing would have been fetched for a Pro user either,
    // so this is not a paywall encounter.
    const mutate = vi.fn();
    renderHook(() =>
      useAnalyzerAutoFetch({
        ...deepLinkedFreeUser,
        paramAddress: undefined,
        mutate,
      }),
    );

    expect(trackEvent).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("fetches for a Pro user without emitting a paywall event", () => {
    const mutate = vi.fn();
    renderHook(() =>
      useAnalyzerAutoFetch({ ...deepLinkedFreeUser, isPro: true, mutate }),
    );

    expect(mutate).toHaveBeenCalledWith({ address: "123 Main St, Austin TX" });
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
