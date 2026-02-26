"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, ArrowUpRight } from "lucide-react";
import type { UserTier } from "@/lib/entitlements";
import { getBillingPortalUrl } from "@/lib/data";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Map tier slugs to display labels for the cancel dialog. */
const TIER_LABELS: Record<string, string> = {
  pro: "Pro",
  enterprise: "Enterprise",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubscriptionActions({ tier }: { tier: UserTier }) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleManageBilling = useCallback(async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const url = await getBillingPortalUrl();
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open billing portal",
      );
      setPortalLoading(false);
    }
  }, []);

  const isStripeSubscriber = tier === "pro" || tier === "enterprise";
  const isAdmin = tier === "admin";

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Actions</h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 text-error text-sm">
          {error}
        </div>
      )}

      {isStripeSubscriber ? (
        <div className="space-y-4">
          {/* Manage billing via Stripe portal */}
          <button
            type="button"
            onClick={handleManageBilling}
            disabled={portalLoading}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            Manage Billing
          </button>

          {/* Cancel / Resume subscription */}
          <CancelSubscriptionDialog
            tierLabel={TIER_LABELS[tier] || tier}
            onComplete={() => {
              // Force a status re-check — the CancelSubscriptionDialog
              // manages its own state, so no additional action needed here.
            }}
          />
        </div>
      ) : isAdmin ? (
        <p className="text-sm text-on-surface-variant">
          Admin accounts are managed internally and do not have Stripe
          subscriptions.
        </p>
      ) : (
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <ArrowUpRight className="w-4 h-4" />
          Upgrade to Pro
        </Link>
      )}
    </section>
  );
}
