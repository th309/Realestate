/**
 * PaywallProvider
 *
 * Site-level paywall context. Wraps product pages and conditionally renders:
 * - AnonPaywallOverlay: hard block after 5 product-page views (anon users)
 * - FreeUserUpgradeModal: dismissible nag every 5 minutes (free auth users)
 *
 * Paid users (pro/enterprise/admin) and dev-simulated tiers are never affected.
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements/EntitlementsContext';
import { usePaywallPageTracking } from './usePaywallPageTracking';
import { AnonPaywallOverlay } from '@/components/entitlements/AnonPaywallOverlay';
import { FreeUserUpgradeModal } from '@/components/entitlements/FreeUserUpgradeModal';

const NAG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface PaywallProviderProps {
  children: React.ReactNode;
}

export function PaywallProvider({ children }: PaywallProviderProps) {
  const { user } = useAuth();
  const { tier } = useEntitlements();
  const { isOverThreshold, isOnProductPage } = usePaywallPageTracking();

  const [nagVisible, setNagVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAnon = user === null;
  const isFree = !isAnon && tier === 'free';
  const isPaid = !isAnon && (tier === 'pro' || tier === 'enterprise' || tier === 'admin');

  // Anon hard block: show when over threshold and on a product page
  const showAnonBlock = isAnon && isOverThreshold && isOnProductPage;

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
      {showAnonBlock && <AnonPaywallOverlay />}
      {nagVisible && !showAnonBlock && <FreeUserUpgradeModal onDismiss={handleDismissNag} />}
    </>
  );
}
