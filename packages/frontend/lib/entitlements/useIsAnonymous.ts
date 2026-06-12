"use client";

import { useAuth } from "@/lib/auth";
import { useEntitlements } from "./EntitlementsContext";

/**
 * True when the current visitor should be treated as anonymous for gating UX.
 * Mirrors PaywallProvider's logic: honors the dev `simulatedAuth === false`
 * override and stays false until auth resolves (prevents an anon-UI flash on
 * hydration for logged-in users).
 */
export function useIsAnonymous(): boolean {
  const { user, loading } = useAuth();
  const { simulatedAuth } = useEntitlements();
  const effectiveUser = simulatedAuth === false ? null : user;
  return !loading && effectiveUser === null;
}
