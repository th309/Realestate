"use client";

/**
 * TrialEndingBanner — app-wide pre-expiry nudge.
 *
 * Slim top bar shown on every route (mounted in `providers.tsx`, not just the
 * dashboard) once a user's reverse Pro trial is within 4 days of expiring.
 * Copy/threshold mirror `app/(app)/dashboard/components/TrialExpirationBanner.tsx`;
 * this component additionally supports per-session dismiss since it is visible
 * app-wide rather than confined to a single page a user can navigate away from.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useEntitlements } from "@/lib/entitlements";

const DISMISS_STORAGE_KEY = "piq-trial-ending-banner-dismissed";

export function TrialEndingBanner() {
  const { trial } = useEntitlements();

  // Tri-state: null = not yet checked (avoids a dismissed-then-hidden flash on
  // mount), true/false = read from sessionStorage.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_STORAGE_KEY) === "1");
  }, []);

  if (
    !trial?.active ||
    trial.daysRemaining == null ||
    trial.daysRemaining > 4
  ) {
    return null;
  }
  if (dismissed !== false) return null;

  const { daysRemaining } = trial;
  const headline =
    daysRemaining === 0
      ? "Your Pro trial ends today"
      : daysRemaining === 1
        ? "Your Pro trial ends tomorrow"
        : `Your Pro trial ends in ${daysRemaining} days`;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="relative z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-none bg-primary-container px-4 py-2.5 text-on-primary-container shadow-sm"
    >
      <p className="text-sm font-medium">
        {headline} — keep your market intelligence flowing.
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/pricing?from=trial_ending"
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-on-primary transition-colors hover:bg-primary/90"
        >
          Keep Pro
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss trial ending banner"
          className="rounded-full p-1 text-on-primary-container/70 transition-colors hover:text-on-primary-container"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
