"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useEntitlements } from "@/lib/entitlements";
import { useMyOrg } from "@/lib/data";
import { OrgSetupBanner } from "./OrgSetupBanner";

const SEEN_KEY = "piq-org-setup-seen";
const SETUP_PATH = "/team/setup";
const SKIP_PATHS = ["/team", "/auth", "/admin", "/org"];

/**
 * Enterprise onboarding gate.
 *
 * Detects enterprise users without an org and:
 * - First visit: redirects to /team/setup
 * - Subsequent visits: shows persistent OrgSetupBanner
 * - Fail-open: if org check errors, renders children normally
 */
export function EnterpriseOnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tier } = useEntitlements();
  const { hasOrg, isLoading, error } = useMyOrg();
  const router = useRouter();
  const pathname = usePathname();
  const redirected = useRef(false);

  const isEnterprise = tier === "enterprise";
  const needsOnboarding = isEnterprise && !hasOrg && !isLoading && !error;
  const isOnSkipPath = SKIP_PATHS.some((p) => pathname.startsWith(p));

  // DEBUG: Remove after enterprise onboarding is verified working
  useEffect(() => {
    console.info("[EnterpriseGate]", {
      tier,
      isEnterprise,
      hasOrg,
      isLoading,
      error: error ? String(error) : null,
      needsOnboarding,
      pathname,
      isOnSkipPath,
      seenKey:
        typeof window !== "undefined" ? sessionStorage.getItem(SEEN_KEY) : null,
    });
  }, [
    tier,
    isEnterprise,
    hasOrg,
    isLoading,
    error,
    needsOnboarding,
    pathname,
    isOnSkipPath,
  ]);

  // First-visit redirect (once per session)
  useEffect(() => {
    if (!needsOnboarding || isOnSkipPath || redirected.current) return;

    const seen = sessionStorage.getItem(SEEN_KEY);
    if (!seen) {
      redirected.current = true;
      sessionStorage.setItem(SEEN_KEY, "1");
      router.replace(SETUP_PATH);
    }
  }, [needsOnboarding, isOnSkipPath, router]);

  // Show banner on subsequent visits (not on setup/auth/admin/org pages)
  const showBanner = needsOnboarding && !isOnSkipPath;

  return (
    <>
      {showBanner && <OrgSetupBanner />}
      {children}
    </>
  );
}
