"use client";

/**
 * PostTrialPaywallGate — at-expiry hard paywall.
 *
 * Mounted app-wide (`providers.tsx`) alongside `TrialEndingBanner`. Wires the
 * already-built `PersonalizedPaywall` blocking modal, gated on
 * `usePostTrialState().isPostTrial` (free tier, no active trial, has usage
 * history — see `lib/entitlements/usePostTrialState.ts`), and only on
 * "Pro-surface" routes. Free surfaces (home, national/state map, pricing,
 * account, auth, dashboard) never trigger the block, so a post-trial user can
 * always get back to a working part of the app.
 *
 * `useSearchParams()` (needed only to detect a sub-national `/map` view) is
 * isolated in `MapGeoLevelGate` behind its own `<Suspense>` boundary so it
 * doesn't force the rest of the app (including statically-rendered public
 * pages that also mount this gate via `providers.tsx`) off static rendering.
 */

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchOnboardingState } from "@/lib/data";
import { usePostTrialState } from "@/lib/entitlements/usePostTrialState";
import { PersonalizedPaywall } from "./PersonalizedPaywall";

/** Pro-gated path prefixes. `/map` is handled separately below — it's free at
 * the national/state level and only gated for a sub-national geo selection. */
const PRO_SURFACE_PREFIXES = [
  "/reports",
  "/scores",
  "/screener",
  "/analyzer",
  "/market",
];

function isProSurfacePath(pathname: string): boolean {
  return PRO_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isMapPath(pathname: string): boolean {
  return pathname === "/map" || pathname.startsWith("/map/");
}

/** Blocking overlay: fetches usage stats for the modal's activity summary and
 * routes "dismiss" back to a free surface (dashboard) rather than merely
 * hiding the overlay in place — a hard paywall shouldn't leave the blocked
 * Pro surface mounted underneath. */
function PostTrialPaywallOverlay() {
  const router = useRouter();

  const { data: onboardingState } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: fetchOnboardingState,
    staleTime: Infinity,
  });

  const handleDismiss = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const stats = onboardingState?.usage_stats ?? {
    markets_viewed: 0,
    scores_checked: 0,
    reports_generated: 0,
  };

  return <PersonalizedPaywall usageStats={stats} onDismiss={handleDismiss} />;
}

/** Reads the map's `level` query param to detect a sub-national geo view.
 * Kept in its own component so `useSearchParams()` is scoped behind Suspense. */
function MapGeoLevelGate() {
  const searchParams = useSearchParams();
  const level = searchParams.get("level");
  const isSubNational =
    level != null && level !== "national" && level !== "state";

  if (!isSubNational) return null;
  return <PostTrialPaywallOverlay />;
}

export function PostTrialPaywallGate() {
  const pathname = usePathname();
  const { isPostTrial } = usePostTrialState();

  if (!isPostTrial || !pathname) return null;

  if (isProSurfacePath(pathname)) {
    return <PostTrialPaywallOverlay />;
  }

  if (isMapPath(pathname)) {
    return (
      <Suspense fallback={null}>
        <MapGeoLevelGate />
      </Suspense>
    );
  }

  return null;
}
