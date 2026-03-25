"use client";

/**
 * EnterpriseGraceBanner — Dismissible countdown banner for enterprise
 * users on a billing grace period.
 *
 * Shows an amber/warning banner with days remaining and a "Set up billing"
 * button that redirects to Stripe Checkout. Dismissal is per-session
 * (sessionStorage) so the banner reappears on next login.
 */

import { useState, useEffect, useCallback } from "react";
import { CreditCard, X } from "lucide-react";
import { fetchGraceStatus, setupEnterpriseBilling } from "@/lib/data";
import type { GraceStatus } from "@/lib/data/fetchers/grace-status";

const STORAGE_KEY = "piq-grace-banner-dismissed";

export function EnterpriseGraceBanner() {
  const [graceStatus, setGraceStatus] = useState<GraceStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check sessionStorage for prior dismissal in this session
    if (sessionStorage.getItem(STORAGE_KEY)) {
      setDismissed(true);
      return;
    }

    fetchGraceStatus()
      .then(setGraceStatus)
      .catch(() => {
        // Silently fail — banner simply won't show
      });
  }, []);

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }, []);

  const handleSetupBilling = useCallback(async () => {
    setLoading(true);
    try {
      const { checkout_url } = await setupEnterpriseBilling();
      window.location.href = checkout_url;
    } catch {
      // Fall back to billing settings page on error
      window.location.href = "/settings/billing";
    } finally {
      setLoading(false);
    }
  }, []);

  // Don't render if dismissed, data not loaded, or no grace period needed
  if (
    dismissed ||
    !graceStatus ||
    !graceStatus.hasGracePeriod ||
    graceStatus.hasBilling
  ) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Your enterprise trial has{" "}
            <strong>{graceStatus.daysRemaining} days</strong> remaining. Add
            billing to keep enterprise features.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSetupBilling}
            disabled={loading}
            className="rounded-full bg-amber-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? "Loading..." : "Set up billing"}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-amber-600 hover:text-amber-800 transition-colors"
            aria-label="Dismiss billing reminder"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
