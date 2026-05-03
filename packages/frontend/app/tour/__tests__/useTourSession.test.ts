import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTourSession } from "../hooks/useTourSession";

const setSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(
      (globalThis as unknown as { __params__?: string }).__params__ ?? "",
    ),
  useRouter: () => ({ replace: setSearchParams }),
  usePathname: () => "/tour",
}));

describe("useTourSession", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie =
      "piq_tour_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    setSearchParams.mockReset();
    (globalThis as unknown as { __params__?: string }).__params__ = "";
  });

  it("mints a sessionId on first call and stores it in cookie + localStorage", () => {
    const { result } = renderHook(() => useTourSession());
    expect(result.current.session.sessionId).toBeTruthy();
    expect(document.cookie).toContain("piq_tour_session=");
    expect(JSON.parse(localStorage.getItem("piq_tour") ?? "{}").sessionId).toBe(
      result.current.session.sessionId,
    );
  });

  it("reuses an existing sessionId from cookie across renders", () => {
    document.cookie = "piq_tour_session=existing-uuid; path=/";
    const { result } = renderHook(() => useTourSession());
    expect(result.current.session.sessionId).toBe("existing-uuid");
  });

  it("hydrates persona + market from URL params on first render", () => {
    (globalThis as unknown as { __params__?: string }).__params__ =
      "persona=agent&market=cbsa-39580";
    const { result } = renderHook(() => useTourSession());
    expect(result.current.session.persona).toBe("agent");
    expect(result.current.session.market?.geoId).toBe("39580");
  });

  it("updates the URL on phase transition", () => {
    const { result } = renderHook(() => useTourSession());
    act(() => result.current.advanceTo("market"));
    expect(setSearchParams).toHaveBeenCalledWith(
      expect.stringContaining("phase=market"),
    );
  });

  it("clears localStorage + cookie on ?resume=fresh and strips the param from URL", () => {
    // Pre-seed state as if a tour was in progress
    localStorage.setItem(
      "piq_tour",
      JSON.stringify({
        sessionId: "old-uuid",
        persona: "agent",
        market: { geoLevel: "metro", geoId: "39580", name: "Raleigh" },
        phase: "step3",
        reportId: "old-report",
        startedAt: 100,
      }),
    );
    document.cookie = "piq_tour_session=old-uuid; path=/";

    (globalThis as unknown as { __params__?: string }).__params__ =
      "resume=fresh";
    const { result } = renderHook(() => useTourSession());

    // New session minted (different UUID than the seeded one)
    expect(result.current.session.sessionId).not.toBe("old-uuid");
    // localStorage was cleared (then re-saved with the new session)
    expect(
      JSON.parse(localStorage.getItem("piq_tour") ?? "{}").sessionId,
    ).not.toBe("old-uuid");
    // URL strip happened — replace called without resume=fresh
    expect(setSearchParams).toHaveBeenCalledWith(
      expect.not.stringContaining("resume=fresh"),
    );
  });
});
