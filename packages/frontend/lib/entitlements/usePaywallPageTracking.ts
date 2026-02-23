/**
 * Tracks unique product-page visits in sessionStorage for paywall gating.
 *
 * Only counts paths under PRODUCT_PREFIXES.
 * Excludes EXEMPT_PATHS (sample report, shared reports).
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'piq-paywall-views';
const VIEW_THRESHOLD = 5;

const PRODUCT_PREFIXES = ['/maps', '/graphs', '/markets', '/scores', '/reports'];
const EXEMPT_PATHS = ['/reports/sample', '/reports/shared'];

function isProductPage(pathname: string): boolean {
  if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return false;
  return PRODUCT_PREFIXES.some((p) => pathname.startsWith(p));
}

function getStoredViews(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function storeViews(views: Set<string>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...views]));
  } catch {
    // sessionStorage unavailable — degrade gracefully
  }
}

export function usePaywallPageTracking() {
  const pathname = usePathname();
  const [viewCount, setViewCount] = useState(0);

  // Sync initial count from sessionStorage on mount
  useEffect(() => {
    setViewCount(getStoredViews().size);
  }, []);

  // Record new page views
  useEffect(() => {
    if (!pathname || !isProductPage(pathname)) return;

    const views = getStoredViews();
    if (!views.has(pathname)) {
      views.add(pathname);
      storeViews(views);
      setViewCount(views.size);
    }
  }, [pathname]);

  const isOverThreshold = viewCount >= VIEW_THRESHOLD;
  const isOnProductPage = !!pathname && isProductPage(pathname);

  const resetViews = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setViewCount(0);
  }, []);

  return { viewCount, isOverThreshold, isOnProductPage, resetViews };
}
