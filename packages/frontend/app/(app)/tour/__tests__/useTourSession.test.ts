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
    // cbsa alias normalizes to metro at the data layer
    expect(result.current.session.market?.geoLevel).toBe("metro");
  });

  it("returns null market when URL geoLevel is unrecognized", () => {
    (globalThis as unknown as { __params__?: string }).__params__ =
      "persona=agent&market=invalid-12345";
    const { result } = renderHook(() => useTourSession());
    expect(result.current.session.persona).toBe("agent");
    expect(result.current.session.market).toBeNull();
  });

  it("backfills the stored name when a bare-URL market matches the stored one", () => {
    // Tour was in progress with the real name persisted from the picker.
    localStorage.setItem(
      "piq_tour",
      JSON.stringify({
        sessionId: "uuid-1",
        persona: "investor",
        market: { geoLevel: "metro", geoId: "39580", name: "Boise City, ID" },
        phase: "step1",
        reportId: null,
        startedAt: 100,
      }),
    );
    document.cookie = "piq_tour_session=uuid-1; path=/";

    // Hard nav to a bare-URL market (parseMarket yields name: "").
    (globalThis as unknown as { __params__?: string }).__params__ =
      "persona=investor&market=metro-39580&phase=step4";
    const { result } = renderHook(() => useTourSession());

    expect(result.current.session.market?.geoId).toBe("39580");
    // The empty URL name must NOT clobber the stored real name.
    expect(result.current.session.market?.name).toBe("Boise City, ID");
  });

  it("does NOT backfill when the stored market is a different geography", () => {
    localStorage.setItem(
      "piq_tour",
      JSON.stringify({
        sessionId: "uuid-2",
        persona: "investor",
        market: { geoLevel: "metro", geoId: "16980", name: "Chicago, IL" },
        phase: "step1",
        reportId: null,
        startedAt: 100,
      }),
    );
    document.cookie = "piq_tour_session=uuid-2; path=/";

    (globalThis as unknown as { __params__?: string }).__params__ =
      "persona=investor&market=metro-39580&phase=step4";
    const { result } = renderHook(() => useTourSession());

    // URL market wins (different geoId); name stays empty, not Chicago's.
    expect(result.current.session.market?.geoId).toBe("39580");
    expect(result.current.session.market?.name).toBe("");
  });

  it("sets secure flag on cookie write when location is https", () => {
    const cookieWrites: string[] = [];
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "cookie",
    );
    Object.defineProperty(document, "cookie", {
      configurable: true,
      set(value: string) {
        cookieWrites.push(value);
      },
      get() {
        return cookieWrites.join("; ");
      },
    });
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { protocol: "https:", href: "https://example.com/tour" },
    });

    try {
      renderHook(() => useTourSession());
      const sessionWrite = cookieWrites.find((c) =>
        c.startsWith("piq_tour_session="),
      );
      expect(sessionWrite).toBeDefined();
      expect(sessionWrite).toContain("secure");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
      if (originalDescriptor) {
        Object.defineProperty(document, "cookie", originalDescriptor);
      }
    }
  });

  it("omits secure flag on cookie write when location is http", () => {
    const cookieWrites: string[] = [];
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "cookie",
    );
    Object.defineProperty(document, "cookie", {
      configurable: true,
      set(value: string) {
        cookieWrites.push(value);
      },
      get() {
        return cookieWrites.join("; ");
      },
    });
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { protocol: "http:", href: "http://localhost:3000/tour" },
    });

    try {
      renderHook(() => useTourSession());
      const sessionWrite = cookieWrites.find((c) =>
        c.startsWith("piq_tour_session="),
      );
      expect(sessionWrite).toBeDefined();
      expect(sessionWrite).not.toContain("secure");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
      if (originalDescriptor) {
        Object.defineProperty(document, "cookie", originalDescriptor);
      }
    }
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
