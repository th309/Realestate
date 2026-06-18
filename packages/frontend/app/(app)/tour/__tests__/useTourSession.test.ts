import { describe, it, expect, beforeEach, vi } from "vitest";
import { createElement } from "react";
import { renderHook, act, render } from "@testing-library/react";
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

// The hook scopes persisted tour state to the authenticated user via useAuth().
// Drive the current user id through a global so individual tests can set it.
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: (globalThis as unknown as { __userId__?: string | null }).__userId__
      ? {
          id: (globalThis as unknown as { __userId__?: string | null })
            .__userId__,
        }
      : null,
  }),
}));

function setCurrentUserId(id: string | null) {
  (globalThis as unknown as { __userId__?: string | null }).__userId__ = id;
}

describe("useTourSession", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie =
      "piq_tour_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    setSearchParams.mockReset();
    (globalThis as unknown as { __params__?: string }).__params__ = "";
    setCurrentUserId(null);
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

  it("does NOT read the stored market name during the first (SSR-matching) render", () => {
    // Regression for the finale hydration mismatch: the server has no
    // localStorage, so it renders an empty market name ("your market"). The
    // client's FIRST render must therefore also be empty — the stored name may
    // only be restored AFTER mount, never in the render-phase initializer.
    // (renderHook hides this because it reports the post-effect value.)
    localStorage.setItem(
      "piq_tour",
      JSON.stringify({
        sessionId: "uuid-1",
        persona: "investor",
        market: { geoLevel: "metro", geoId: "39580", name: "Boise City, ID" },
        phase: "step4",
        reportId: null,
        startedAt: 100,
      }),
    );
    document.cookie = "piq_tour_session=uuid-1; path=/";
    (globalThis as unknown as { __params__?: string }).__params__ =
      "persona=investor&market=metro-39580&phase=step4";

    const seenNames: (string | undefined)[] = [];
    function Probe() {
      const { session } = useTourSession();
      seenNames.push(session.market?.name);
      return null;
    }
    render(createElement(Probe));

    // First render must match SSR output (no localStorage) → empty name.
    expect(seenNames[0]).toBe("");
    // After mount, the stored name is restored, so resume still works.
    expect(seenNames[seenNames.length - 1]).toBe("Boise City, ID");
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

  it("resets to persona/null when a different user's tour is persisted", () => {
    // User A finished a Bloomington tour at step4 on this browser.
    localStorage.setItem(
      "piq_tour",
      JSON.stringify({
        sessionId: "uuid-a",
        persona: "investor",
        market: { geoLevel: "metro", geoId: "14010", name: "Bloomington, IL" },
        phase: "step4",
        reportId: "report-a",
        startedAt: 100,
        userId: "user-A",
      }),
    );
    document.cookie = "piq_tour_session=uuid-a; path=/";

    // User B is now the authenticated user — must NOT resume A's tour.
    setCurrentUserId("user-B");
    const { result } = renderHook(() => useTourSession());

    expect(result.current.session.phase).toBe("persona");
    expect(result.current.session.persona).toBeNull();
    expect(result.current.session.market).toBeNull();
    // The freshly minted session is owned by B and persisted as such.
    expect(result.current.session.userId).toBe("user-B");
    expect(result.current.session.sessionId).not.toBe("uuid-a");
    expect(JSON.parse(localStorage.getItem("piq_tour") ?? "{}").userId).toBe(
      "user-B",
    );
  });

  it("preserves a legacy/anonymous (userId-null) tour for any signed-in user", () => {
    // Pre-signup tour: market picked before the account existed, no userId tag.
    // The auth/callback ?phase=celebrate flow depends on this surviving sign-in.
    localStorage.setItem(
      "piq_tour",
      JSON.stringify({
        sessionId: "uuid-anon",
        persona: "investor",
        market: { geoLevel: "metro", geoId: "39580", name: "Boise City, ID" },
        phase: "step4",
        reportId: null,
        startedAt: 100,
        // no userId
      }),
    );
    document.cookie = "piq_tour_session=uuid-anon; path=/";
    (globalThis as unknown as { __params__?: string }).__params__ =
      "persona=investor&market=metro-39580&phase=step4";

    setCurrentUserId("user-C");
    const { result } = renderHook(() => useTourSession());

    // Tour is preserved (not reset to persona) and now claimed by the user.
    expect(result.current.session.persona).toBe("investor");
    expect(result.current.session.market?.geoId).toBe("39580");
    expect(result.current.session.phase).toBe("step4");
    expect(result.current.session.sessionId).toBe("uuid-anon");
    expect(result.current.session.userId).toBe("user-C");
  });

  it("preserves the tour when the stored userId matches the current user", () => {
    localStorage.setItem(
      "piq_tour",
      JSON.stringify({
        sessionId: "uuid-d",
        persona: "agent",
        market: { geoLevel: "metro", geoId: "39580", name: "Boise City, ID" },
        phase: "step3",
        reportId: "report-d",
        startedAt: 100,
        userId: "user-D",
      }),
    );
    document.cookie = "piq_tour_session=uuid-d; path=/";
    (globalThis as unknown as { __params__?: string }).__params__ =
      "persona=agent&market=metro-39580&phase=step3";

    setCurrentUserId("user-D");
    const { result } = renderHook(() => useTourSession());

    expect(result.current.session.persona).toBe("agent");
    expect(result.current.session.market?.geoId).toBe("39580");
    expect(result.current.session.phase).toBe("step3");
    expect(result.current.session.sessionId).toBe("uuid-d");
    expect(result.current.session.userId).toBe("user-D");
  });
});
