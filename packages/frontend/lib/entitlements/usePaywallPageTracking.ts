/**
 * Tracks whether the current page is a product page for paywall gating.
 *
 * The view-threshold / sessionStorage counting logic was removed when the
 * anon hard-block wall was retired (Task 5). Only isOnProductPage remains;
 * it drives the free-user 5-minute nag timer in PaywallProvider.
 *
 * Excludes EXEMPT_PATHS (sample report, shared reports).
 */

"use client";

import { usePathname } from "next/navigation";

const PRODUCT_PREFIXES = ["/map", "/graphs", "/market", "/scores", "/reports"];
const EXEMPT_PATHS = ["/reports/sample", "/reports/shared"];

function isProductPage(pathname: string): boolean {
  if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return false;
  return PRODUCT_PREFIXES.some((p) => pathname.startsWith(p));
}

export function usePaywallPageTracking(): { isOnProductPage: boolean } {
  const pathname = usePathname();
  const isOnProductPage = !!pathname && isProductPage(pathname);
  return { isOnProductPage };
}
