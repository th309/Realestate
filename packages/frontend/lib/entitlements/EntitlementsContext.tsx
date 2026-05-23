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
import type {
  EntitlementsContextValue,
  EntitlementsState,
  UserTier,
  ResourceType,
  AccessInfo,
  FeatureUsage,
} from "./types";
import { fetchEntitlements, trackPaywallEvent } from "./api";
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

interface EntitlementsProviderProps {
  children: React.ReactNode;
  initialResources?: string[];
}

export function EntitlementsProvider({
  children,
  initialResources,
}: EntitlementsProviderProps) {
  const { user, session, loading: authLoading } = useAuth();
  const [state, setState] = useState<EntitlementsState>(
    DEFAULT_ENTITLEMENTS_STATE,
  );
  // Initialize from sessionStorage to persist across navigations
  const [simulatedTier, setSimulatedTierRaw] = useState<UserTier | null>(() =>
    getStoredSimulatedTier(),
  );
  const [simulatedAuth, setSimulatedAuthRaw] = useState<boolean | null>(() =>
    getStoredSimulatedAuth(),
  );

  const [usageCache, setUsageCache] = useState<Record<string, number>>({});

  // Use ref to track the latest simulatedTier for the refresh callback
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

  // Track user ID in ref to avoid stale closures
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;

  // Request sequence counter to prevent stale responses from overwriting fresh ones.
  // Each refresh() increments the counter; when a response arrives, it's only applied
  // if no newer request has been launched since.
  const refreshSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    const currentTier = simulatedTierRef.current;
    const currentUserId = userIdRef.current;
    const seq = ++refreshSeqRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchEntitlements(
        resources,
        currentTier,
        currentUserId,
      );
      // Only apply if this is still the latest request
      if (seq === refreshSeqRef.current) {
        setState(data);
      }
    } catch (error) {
      console.warn(
        "[Entitlements] fetch failed, preserving previous state:",
        error,
      );
      if (seq === refreshSeqRef.current) {
        setState((prev) => ({ ...prev, loading: false, error: null }));
      }
    }
  }, [resources]);

  // Refresh when simulatedTier or user changes, once auth has resolved.
  // We intentionally do NOT wait for the full session to hydrate: the
  // entitlements endpoint authorizes on the `x-user-id` header (derived from
  // the instantly-available cookie user id), not the JWT. Gating on `session`
  // here caused the first resolution to fall through as anonymous → a "free"
  // flash before correcting to the real tier once the session arrived.
  useEffect(() => {
    if (!authLoading) {
      refresh();
    }
  }, [simulatedTier, user?.id, session, authLoading, refresh]);

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

  // TTL: re-fetch entitlements every 30 minutes
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

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
