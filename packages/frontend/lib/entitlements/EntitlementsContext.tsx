"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EntitlementsContextValue,
  EntitlementsState,
  UserTier,
  ResourceType,
  AccessInfo,
  FeatureUsage,
} from "./types";
import { fetchEntitlementsWithRetry, trackPaywallEvent } from "./api";
import { useRealtimeTierSync } from "./useRealtimeTierSync";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_ENTITLEMENTS_STATE,
  STORAGE_KEYS,
  getStoredSimulatedTier,
  getStoredSimulatedAuth,
  isValidTier,
  buildResourceList,
} from "./entitlements-helpers";

const EntitlementsContext = createContext<EntitlementsContextValue | null>(
  null,
);

// 30-min entitlements TTL (staleTime + refetchInterval; replaces the old
// setInterval). Stable key root so refresh() can invalidate every variant.
const ENTITLEMENTS_TTL_MS = 30 * 60 * 1000;
const ENTITLEMENTS_QUERY_KEY = "entitlements";

interface EntitlementsProviderProps {
  children: React.ReactNode;
  initialResources?: string[];
  /**
   * Server-resolved entitlements seeding the first paint (SSR) so no surface
   * flashes `free` before the client refresh lands. From `fetchEntitlementsServer`
   * in the AppShell Server Component; falls back to DEFAULT for anon / SSR misses.
   */
  initialState?: EntitlementsState | null;
}

export function EntitlementsProvider({
  children,
  initialResources,
  initialState,
}: EntitlementsProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Initialize from sessionStorage to persist across navigations
  const [simulatedTier, setSimulatedTierRaw] = useState<UserTier | null>(() =>
    getStoredSimulatedTier(),
  );
  const [simulatedAuth, setSimulatedAuthRaw] = useState<boolean | null>(() =>
    getStoredSimulatedAuth(),
  );

  const [usageCache, setUsageCache] = useState<Record<string, number>>({});

  // Use ref to track the latest simulatedTier for the user-change cleanup effect.
  const simulatedTierRef = useRef<UserTier | null>(simulatedTier);

  // Wrap setSimulatedTier to persist to sessionStorage
  const setSimulatedTier = useCallback((tier: UserTier | null) => {
    setSimulatedTierRaw(tier);
    simulatedTierRef.current = tier;
    if (tier) {
      sessionStorage.setItem(STORAGE_KEYS.SIMULATED_TIER, tier);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.SIMULATED_TIER);
    }
  }, []);

  // Wrap setSimulatedAuth to persist to sessionStorage
  const setSimulatedAuth = useCallback((auth: boolean | null) => {
    setSimulatedAuthRaw(auth);
    if (auth !== null) {
      sessionStorage.setItem(STORAGE_KEYS.SIMULATED_AUTH, String(auth));
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.SIMULATED_AUTH);
    }
  }, []);

  // Auto-generate resource list from registry if not provided
  const resources = useMemo(
    () => initialResources ?? buildResourceList(),
    [initialResources],
  );

  // Check URL for tier override (dev mode) - only on initial mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tierParam = params.get("tier");
      if (tierParam && isValidTier(tierParam)) {
        setSimulatedTier(tierParam);
        // Also simulate an authenticated state so AnonPaywallOverlay is suppressed
        setSimulatedAuth(true);
      }
    }
  }, [setSimulatedTier, setSimulatedAuth]);

  // Clear simulated tier when the authenticated user changes.
  // This prevents stale dev-tools overrides from leaking across sign-in/sign-out cycles
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (
      prevUserIdRef.current !== undefined &&
      prevUserIdRef.current !== currentUserId
    ) {
      if (simulatedTierRef.current) {
        setSimulatedTier(null);
        setSimulatedAuth(null);
      }
      setUsageCache({});
    }
    prevUserIdRef.current = currentUserId ?? undefined;
  }, [user?.id, setSimulatedTier, setSimulatedAuth]);

  // Entitlements fetch via React Query. Key is [userId, simulatedTier] ONLY —
  // deliberately NOT the Supabase `session`, whose reference churns on every auth
  // event (INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED/tab-focus) and triggered
  // bursts of redundant full-resource refetches; the backend authorizes on the
  // x-user-id cookie, not the JWT. RQ also de-dupes same-key requests and aborts
  // superseded ones via `signal`. Retry/backoff stays in fetchEntitlementsWithRetry
  // (RQ retry disabled). `initialDataUpdatedAt: 0` seeds the SSR paint but marks
  // it stale so a client refetch still confirms it on mount.
  const query = useQuery({
    queryKey: [ENTITLEMENTS_QUERY_KEY, user?.id ?? null, simulatedTier],
    queryFn: ({ signal }) =>
      fetchEntitlementsWithRetry(
        resources,
        simulatedTier,
        user?.id ?? null,
        signal,
      ),
    enabled: !authLoading,
    staleTime: ENTITLEMENTS_TTL_MS,
    refetchInterval: ENTITLEMENTS_TTL_MS,
    refetchOnWindowFocus: false,
    retry: false,
    // No placeholderData: on a user switch (key change) we must not surface the
    // previous user's cached tier — fall back to free until the new fetch lands.
    initialData: initialState ?? undefined,
    initialDataUpdatedAt: 0,
  });

  // Consumer-facing state. On error RQ retains the last successful `data` (fall
  // back to it / the free default); never surface the error — fail-open.
  const state: EntitlementsState = useMemo(() => {
    const data = query.data ?? DEFAULT_ENTITLEMENTS_STATE;
    return {
      tier: data.tier,
      access: data.access,
      trial: data.trial,
      loading: query.isPending,
      error: null,
    };
  }, [query.data, query.isPending]);

  // Force a fresh fetch (Realtime tier-change pushes; post-mutation re-checks).
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [ENTITLEMENTS_QUERY_KEY],
    });
  }, [queryClient]);

  // Real-time tier sync: listen for admin tier changes via Supabase Realtime
  const { toastMessage, dismissToast } = useRealtimeTierSync({
    userId: user?.id ?? null,
    onTierChange: refresh,
  });

  const canAccess = useCallback(
    (type: ResourceType, id: string): boolean => {
      const key = `${type}:${id}`;
      const accessInfo = state.access[key];
      return accessInfo?.level === "full" || accessInfo?.level === "preview";
    },
    [state.access],
  );

  const getAccess = useCallback(
    (type: ResourceType, id: string): AccessInfo => {
      const key = `${type}:${id}`;
      return state.access[key] || { level: "none", tierRequired: "pro" };
    },
    [state.access],
  );

  const getPreviewLimit = useCallback(
    (type: ResourceType, id: string): number | null => {
      const key = `${type}:${id}`;
      const accessInfo = state.access[key];
      return accessInfo?.level === "preview"
        ? (accessInfo.limit ?? null)
        : null;
    },
    [state.access],
  );

  const getTierRequired = useCallback(
    (type: ResourceType, id: string): UserTier | null => {
      const key = `${type}:${id}`;
      const accessInfo = state.access[key];
      return accessInfo?.tierRequired ?? null;
    },
    [state.access],
  );

  const isMetricGated = useCallback(
    (metricId: string): boolean => {
      if (state.loading) return false;
      const access = getAccess("metric", metricId);
      return access.level === "none";
    },
    [state.loading, getAccess],
  );

  const trackPaywallView = useCallback(
    (type: ResourceType, id: string, pagePath?: string) => {
      trackPaywallEvent(
        type,
        id,
        "view",
        pagePath || window.location.pathname,
        user?.id,
        state.tier,
      );
    },
    [user?.id, state.tier],
  );

  const trackUpgradeClick = useCallback(
    (type: ResourceType, id: string, pagePath?: string) => {
      trackPaywallEvent(
        type,
        id,
        "click_upgrade",
        pagePath || window.location.pathname,
        user?.id,
        state.tier,
      );
    },
    [user?.id, state.tier],
  );

  const trackDismiss = useCallback(
    (type: ResourceType, id: string) => {
      trackPaywallEvent(
        type,
        id,
        "dismiss",
        window.location.pathname,
        user?.id,
        state.tier,
      );
    },
    [user?.id, state.tier],
  );

  const resetSimulation = useCallback(() => {
    setSimulatedTier(null);
    setSimulatedAuth(null);
  }, [setSimulatedTier, setSimulatedAuth]);

  const getUsage = useCallback(
    (featureSlug: string): FeatureUsage | null => {
      const key = `feature:${featureSlug}`;
      const accessInfo = state.access[key];
      const limit = accessInfo?.limit ?? null;

      if (limit === null) return null;
      if (limit === -1)
        return {
          feature_slug: featureSlug,
          usage_count: 0,
          limit: -1,
          remaining: -1,
        };

      const count = usageCache[featureSlug] || 0;
      return {
        feature_slug: featureSlug,
        usage_count: count,
        limit,
        remaining: Math.max(0, limit - count),
      };
    },
    [state.access, usageCache],
  );

  const incrementUsage = useCallback(
    async (featureSlug: string): Promise<boolean> => {
      const usage = getUsage(featureSlug);
      if (!usage) return true;
      if (usage.limit === -1) return true;
      if (usage.remaining <= 0) return false;

      setUsageCache((prev) => ({
        ...prev,
        [featureSlug]: (prev[featureSlug] || 0) + 1,
      }));
      return true;
    },
    [getUsage],
  );

  const value = useMemo<EntitlementsContextValue>(
    () => ({
      ...state,
      canAccess,
      getAccess,
      getPreviewLimit,
      getTierRequired,
      isMetricGated,
      trackPaywallView,
      trackUpgradeClick,
      trackDismiss,
      simulatedTier,
      setSimulatedTier,
      simulatedAuth,
      setSimulatedAuth,
      resetSimulation,
      refresh,
      getUsage,
      incrementUsage,
    }),
    [
      state,
      canAccess,
      getAccess,
      getPreviewLimit,
      getTierRequired,
      isMetricGated,
      trackPaywallView,
      trackUpgradeClick,
      trackDismiss,
      simulatedTier,
      setSimulatedTier,
      simulatedAuth,
      setSimulatedAuth,
      resetSimulation,
      refresh,
      getUsage,
      incrementUsage,
    ],
  );

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
      {/* Tier change toast notification (Realtime push from admin) */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl bg-surface-container-high px-5 py-3 shadow-lg"
        >
          <span className="text-sm font-medium text-on-surface">
            {toastMessage}
          </span>
          <button
            onClick={dismissToast}
            className="ml-1 text-on-surface-variant hover:text-on-surface text-xs"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements(): EntitlementsContextValue {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error(
      "useEntitlements must be used within an EntitlementsProvider",
    );
  }
  return context;
}
