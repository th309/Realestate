import type { EntitlementsState } from "./types";
import { API_URL } from "@/lib/data/fetchers/base";

/**
 * Server-side tier resolution for SSR seeding. Runs in a Server Component
 * (AppShell), so it authorizes with the cookie-derived `x-user-id` (the same
 * header the client uses — the entitlements endpoint does not require a JWT).
 * Returns null for anonymous users or on any failure, so the caller falls back
 * to the client-side refresh.
 *
 * Uses the data layer's canonical `API_URL` (NEXT_PUBLIC_API_URL → production
 * default → localhost; see lib/data/fetchers/base.ts) rather than a local
 * hardcoded fallback, so SSR never points at localhost in production.
 */
export async function fetchEntitlementsServer(
  userId: string | null,
): Promise<EntitlementsState | null> {
  if (!userId) return null;

  try {
    const res = await fetch(`${API_URL}/api/entitlements/check?resources=`, {
      headers: { "x-user-id": userId, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      tier: data.tier,
      access: data.access ?? {},
      trial: data.trial ?? null,
      loading: false,
      error: null,
    };
  } catch {
    return null; // backend unreachable during SSR — client refresh will resolve
  }
}
