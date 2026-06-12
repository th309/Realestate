// packages/frontend/lib/entitlements/__tests__/useIsAnonymous.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const authState = { user: null as null | { id: string }, loading: false };
const entState = { simulatedAuth: null as boolean | null };

vi.mock("@/lib/auth", () => ({ useAuth: () => authState }));
vi.mock("../EntitlementsContext", () => ({
  useEntitlements: () => entState,
}));

import { useIsAnonymous } from "../useIsAnonymous";

describe("useIsAnonymous", () => {
  it("is false while auth is still loading (avoids anon flash)", () => {
    authState.user = null;
    authState.loading = true;
    entState.simulatedAuth = null;
    expect(renderHook(() => useIsAnonymous()).result.current).toBe(false);
  });

  it("is true when no user and auth resolved", () => {
    authState.user = null;
    authState.loading = false;
    entState.simulatedAuth = null;
    expect(renderHook(() => useIsAnonymous()).result.current).toBe(true);
  });

  it("is false when a real user is present", () => {
    authState.user = { id: "u1" };
    authState.loading = false;
    entState.simulatedAuth = null;
    expect(renderHook(() => useIsAnonymous()).result.current).toBe(false);
  });

  it("treats dev simulatedAuth===false as anonymous even with a user", () => {
    authState.user = { id: "u1" };
    authState.loading = false;
    entState.simulatedAuth = false;
    expect(renderHook(() => useIsAnonymous()).result.current).toBe(true);
  });
});
