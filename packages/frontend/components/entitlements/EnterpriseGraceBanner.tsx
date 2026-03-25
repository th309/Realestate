"use client";

/**
 * EnterpriseGraceBanner — Persistent countdown banner for enterprise
 * users on a billing grace period.
 *
 * Shows an amber/warning banner with days remaining and a "Set up billing"
 * button that redirects to Stripe Checkout. NOT dismissible — stays visible
 * on every page until billing is added.
 */

import { useState, useEffect, useCallback } from "react";
import { CreditCard } from "lucide-react";
import { fetchGraceStatus, setupEnterpriseBilling } from "@/lib/data";
import type { GraceStatus } from "@/lib/data/fetchers/grace-status";

export function EnterpriseGraceBanner() {
  const [graceStatus, setGraceStatus] = useState<GraceStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGraceStatus()
      .then(setGraceStatus)
      .catch(() => {
        // Silently fail — banner simply won't show
      });
  }, []);

  const handleSetupBilling = useCallback(async () => {
    setLoading(true);
    try {
      const { checkout_url } = await setupEnterpriseBilling();
      window.location.href = checkout_url;
    } catch {
      window.location.href = "/pricing?plan=enterprise";
    } finally {
      setLoading(false);
    }
  }, []);

  // Don't render if data not loaded, no grace period, or billing already set up
  if (!graceStatus || !graceStatus.hasGracePeriod || graceStatus.hasBilling) {
    return null;
  }

  const urgent = graceStatus.daysRemaining <= 7;

  return (
    <div
      className={`border-b px-4 py-3 ${urgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard
            className={`w-5 h-5 flex-shrink-0 ${urgent ? "text-red-600" : "text-amber-600"}`}
          />
          <p
            className={`text-sm ${urgent ? "text-red-800" : "text-amber-800"}`}
          >
            {graceStatus.daysRemaining <= 0 ? (
              <strong>
                Your enterprise trial has expired. Add billing now to keep your
                features.
              </strong>
            ) : (
              <>
                Your enterprise trial has{" "}
                <strong>
                  {graceStatus.daysRemaining} day
                  {graceStatus.daysRemaining !== 1 ? "s" : ""}
                </strong>{" "}
                remaining. Add billing information to keep enterprise features.
              </>
            )}
          </p>
        </div>
        <button
          onClick={handleSetupBilling}
          disabled={loading}
          className={`rounded-full text-white px-5 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap ${urgent ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
        >
          {loading ? "Loading..." : "Set up billing"}
        </button>
      </div>
    </div>
  );
}
