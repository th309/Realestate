import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { shouldAutoFetchProperty } from "../use-analyzer-state";
import {
  pickMarketContext,
  useMarketRefreshGate,
} from "../use-analyzer-state.hydration";
import type { MarketContext } from "@/lib/data/fetchers/analyzer";

describe("shouldAutoFetchProperty gates the RentCast lookup on open", () => {
  const base = {
    isPro: true,
    address: "123 Main St, Austin TX",
    paramAddress: "123 Main St, Austin TX",
    alreadyFetched: false,
    isHydrated: false,
  };

  it("fetches for a Pro user deep-linked with ?address=", () => {
    expect(shouldAutoFetchProperty(base)).toBe(true);
  });

  it("does NOT fetch when hydrating a saved deal — RentCast is paid and quota-limited", () => {
    expect(shouldAutoFetchProperty({ ...base, isHydrated: true })).toBe(false);
  });

  it("does not fetch twice", () => {
    expect(shouldAutoFetchProperty({ ...base, alreadyFetched: true })).toBe(
      false,
    );
  });

  it("does not fetch for a free user", () => {
    expect(shouldAutoFetchProperty({ ...base, isPro: false })).toBe(false);
  });

  it("does not fetch without an ?address= param", () => {
    expect(shouldAutoFetchProperty({ ...base, paramAddress: undefined })).toBe(
      false,
    );
  });

  it("does not fetch on a too-short address", () => {
    expect(shouldAutoFetchProperty({ ...base, address: "abc" })).toBe(false);
  });
});

describe("useMarketRefreshGate keeps opening a saved deal a page VIEW", () => {
  it("leaves the market queries on for a fresh analysis", () => {
    const { result } = renderHook(() => useMarketRefreshGate(false));
    expect(result.current.enabled).toBe(true);
  });

  it("suppresses them on hydration — a view must not write", () => {
    // Left enabled, the queries resolve a second after open, piqByGeo
    // changes, deal-state content changes, and autosave PATCHes a row the
    // user only looked at. Spec §4.4: restored, not refetched.
    const { result } = renderHook(() => useMarketRefreshGate(true));
    expect(result.current.enabled).toBe(false);
  });

  it("opens them once — and only once — the user asks", () => {
    const { result } = renderHook(() => useMarketRefreshGate(true));
    act(() => result.current.requestMarketRefresh());
    expect(result.current.enabled).toBe(true);
  });
});

describe("pickMarketContext restores until the live answer arrives", () => {
  const restored = { geo_id: "61761" } as MarketContext;
  const live = { geo_id: "60601" } as MarketContext;

  it("shows the saved context while the query is suppressed", () => {
    expect(
      pickMarketContext({ restored, live: undefined, isLive: false }),
    ).toBe(restored);
  });

  it("holds the saved context through a refresh rather than blanking", () => {
    expect(pickMarketContext({ restored, live, isLive: false })).toBe(restored);
  });

  it("hands over to the live context once it owns the answer", () => {
    expect(pickMarketContext({ restored, live, isLive: true })).toBe(live);
  });

  it("does NOT resurrect a saved context the refresh proved absent", () => {
    // useMarketContext returns null as a loaded value (unknown geography,
    // 4xx). `live ?? restored` would keep showing data that no longer exists.
    expect(
      pickMarketContext({ restored, live: null, isLive: true }),
    ).toBeNull();
  });

  it("passes the live context straight through for a fresh analysis", () => {
    expect(pickMarketContext({ restored: null, live, isLive: true })).toBe(
      live,
    );
    expect(
      pickMarketContext({ restored: null, live: undefined, isLive: false }),
    ).toBeUndefined();
  });
});
