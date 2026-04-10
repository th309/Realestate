"use client";

/**
 * MarketLimitUpgradePrompt
 *
 * Shown when a free user is at or near their market view limit (5 markets).
 * Appears as a dismissible bottom-anchored banner with a hard-stop modal
 * when the limit is reached.
 *
 * Usage: render inside the market page layout. It self-manages visibility
 * based on the entitlements usage for the "market_views" feature slug.
 */

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Lock, TrendingUp } from "lucide-react";
import { useEntitlements } from "@/lib/entitlements";
import { trackEvent } from "@/lib/analytics/tracker";
import { getPricingCtaVariant, PRICING_CTA_COPY } from "@/lib/ab";

const FEATURE_SLUG = "market_views";
const WARN_THRESHOLD = 2; // show banner when ≤ 2 markets remaining

interface MarketLimitUpgradePromptProps {
  /** Called when the user dismisses the banner (not the hard-stop modal). */
  onDismiss?: () => void;
}

export function MarketLimitUpgradePrompt({
  onDismiss,
}: MarketLimitUpgradePromptProps) {
  const { tier, getUsage, incrementUsage } = useEntitlements();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const [hardStop, setHardStop] = useState(false);

  const usage = getUsage(FEATURE_SLUG);

  // Increment usage count and determine view state on mount
  useEffect(() => {
    if (tier !== "free" || !usage) return;

    async function checkAndIncrement() {
      if (!usage) return;

      if (usage.remaining === 0) {
        // Already at limit — show hard stop
        setHardStop(true);
        trackEvent("conversion.market_limit_hit", {
          usage_count: usage.usage_count,
          limit: usage.limit,
          page: pathname,
        });
        return;
      }

      // Increment and re-check
      const allowed = await incrementUsage(FEATURE_SLUG);
      if (!allowed) {
        setHardStop(true);
        trackEvent("conversion.market_limit_hit", {
          usage_count: usage.usage_count,
          limit: usage.limit,
          page: pathname,
        });
      } else {
        const updatedUsage = getUsage(FEATURE_SLUG);
        if (
          updatedUsage &&
          updatedUsage.limit > 0 &&
          updatedUsage.remaining <= WARN_THRESHOLD
        ) {
          trackEvent("conversion.upgrade_prompt_shown", {
            trigger: "market_limit_warning",
            remaining: updatedUsage.remaining,
            page: pathname,
          });
        }
      }
    }

    checkAndIncrement();
    // Run only once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    trackEvent("conversion.upgrade_prompt_dismissed", {
      trigger: "market_limit_warning",
      page: pathname,
    });
    onDismiss?.();
  }, [onDismiss, pathname]);

  // Nothing to show for paid tiers or if no usage limit configured
  if (tier !== "free" || !usage || usage.limit === -1) return null;

  const variant = getPricingCtaVariant();

  // Hard stop modal — user has consumed all market views
  if (hardStop) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-sm rounded-[28px] bg-surface-container-high p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-on-surface">
            You&apos;ve reached your free market limit
          </h2>
          <p className="mb-6 text-sm text-on-surface-variant">
            Free accounts include {usage.limit} markets. Upgrade to Pro for
            unlimited access to every market, metric, and AI report.
          </p>
          <Link
            href={`/pricing?from=market_limit`}
            onClick={() => {
              trackEvent("conversion.upgrade_prompt_clicked", {
                trigger: "market_limit_hard_stop",
                page: pathname,
              });
              trackEvent("conversion.pricing_cta_click", { variant, source: "modal" });
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <TrendingUp className="h-4 w-4" />
            {PRICING_CTA_COPY[variant]}
          </Link>
          <p className="mt-4 text-xs text-on-surface-variant">
            <Link href="/map" className="underline hover:text-on-surface">
              Back to map
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Warning banner — user is approaching their limit
  if (dismissed || usage.remaining > WARN_THRESHOLD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-full max-w-md px-4">
      <div className="flex items-start gap-3 rounded-2xl bg-surface-container-high shadow-lg border border-outline-variant px-4 py-3">
        <div className="flex-shrink-0 mt-0.5">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-on-surface">
            {usage.remaining === 1
              ? "1 free market left"
              : `${usage.remaining} free markets left`}
          </p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Upgrade to Pro for unlimited access.{" "}
            <Link
              href={`/pricing?from=market_limit_banner`}
              onClick={() =>
                trackEvent("conversion.upgrade_prompt_clicked", {
                  trigger: "market_limit_banner",
                  remaining: usage.remaining,
                  page: pathname,
                })
              }
              className="font-medium text-primary hover:text-primary/80 underline"
            >
              See plans →
            </Link>
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/8 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
