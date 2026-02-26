"use client";

import React, { useEffect } from "react";
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

  useEffect(() => {
    // Only track paywall views after entitlements have loaded to avoid false positives
    if (loading) return;
    if (
      access.level === "none" ||
      (access.level === "preview" && !showTeaser)
    ) {
      trackPaywallView(type, id);
    }
  }, [access.level, type, id, showTeaser, trackPaywallView, loading]);

  // While entitlements are loading, show the loading fallback instead of the
  // upsell/paywall fallback. This prevents the "flash of paywall" that occurs
  // when getAccess defaults to { level: 'none' } before data arrives.
  if (loading) {
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
