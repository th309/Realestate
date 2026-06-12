/**
 * PaywallProvider
 *
 * Site-level paywall context. Wraps product pages and conditionally renders:
 * - FreeUserUpgradeModal: dismissible nag every 5 minutes (free auth users)
 *
 * Anonymous users browse freely; locked features open AnonCaptureModal at the
 * click site (MetricItem, QuickActions). Paid users (pro/enterprise/admin) and
 * dev-simulated tiers are never affected.
 */

"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements/EntitlementsContext";
import { usePaywallPageTracking } from "./usePaywallPageTracking";
import { FreeUserUpgradeModal } from "@/components/entitlements/FreeUserUpgradeModal";

const NAG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface PaywallProviderProps {
  children: React.ReactNode;
}

export function PaywallProvider({ children }: PaywallProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const { tier, simulatedAuth } = useEntitlements();
  const { isOnProductPage } = usePaywallPageTracking();

  const [nagVisible, setNagVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dev simulation: simulatedAuth === false means "pretend anon"
  const effectiveUser = simulatedAuth === false ? null : user;

  // Gate all auth-dependent checks on authLoading to prevent flash during hydration
  const isAnon = !authLoading && effectiveUser === null;
  const isFree = !authLoading && !isAnon && tier === "free";
  const isPaid =
    !authLoading &&
    !isAnon &&
    (tier === "pro" || tier === "enterprise" || tier === "admin");

  // Free user nag: 5-minute timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setNagVisible(true);
    }, NAG_INTERVAL_MS);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isFree && isOnProductPage) {
      startTimer();
    } else {
      stopTimer();
      setNagVisible(false);
    }
    return stopTimer;
  }, [isFree, isOnProductPage, startTimer, stopTimer]);

  // If user upgrades mid-session, clear everything
  useEffect(() => {
    if (isPaid) {
      stopTimer();
      setNagVisible(false);
    }
  }, [isPaid, stopTimer]);

  const handleDismissNag = useCallback(() => {
    setNagVisible(false);
    // Reset the timer so next nag is a full 5 minutes away
    startTimer();
  }, [startTimer]);

  return (
    <>
      {children}
      {nagVisible && <FreeUserUpgradeModal onDismiss={handleDismissNag} />}
    </>
  );
}
