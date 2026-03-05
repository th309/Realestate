"use client";

import React, { useEffect, useRef } from "react";
import { useEntitlements, ResourceType } from "@/lib/entitlements";

interface EntitlementGateProps {
  type: ResourceType;
  id: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Rendered while entitlements are still loading (prevents fallback flash) */
  loadingFallback?: React.ReactNode;
  showTeaser?: boolean;
}

export function EntitlementGate({
  type,
  id,
  children,
  fallback,
  loadingFallback = null,
  showTeaser = false,
}: EntitlementGateProps) {
  const { getAccess, trackPaywallView, loading } = useEntitlements();
  const access = getAccess(type, id);

  // Track whether we've completed an initial load. After the first load,
  // background refreshes should NOT unmount children — doing so destroys
  // client state in long-running flows (e.g. research brief generation).
  const hasLoadedOnce = useRef(false);
  if (!loading) {
    hasLoadedOnce.current = true;
  }

  useEffect(() => {
    if (loading) return;
    if (
      access.level === "none" ||
      (access.level === "preview" && !showTeaser)
    ) {
      trackPaywallView(type, id);
    }
  }, [access.level, type, id, showTeaser, trackPaywallView, loading]);

  // On initial load, show the loading fallback to prevent "flash of paywall".
  // On subsequent refreshes (hasLoadedOnce), keep showing whatever was last
  // rendered so that children are never unmounted mid-interaction.
  if (loading && !hasLoadedOnce.current) {
    return <>{loadingFallback}</>;
  }

  if (access.level === "full") {
    return <>{children}</>;
  }

  if (access.level === "preview" && showTeaser) {
    return <>{children}</>;
  }

  return <>{fallback ?? null}</>;
}
