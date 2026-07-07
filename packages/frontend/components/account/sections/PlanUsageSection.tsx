"use client";

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Sparkles,
  MapPin,
  Bell,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  ArrowUpDown,
  Home,
  Warehouse,
  Building2,
  Shield,
} from "lucide-react";
import { useEntitlements } from "@/lib/entitlements";
import type { UserTier } from "@/lib/entitlements";
import {
  usePricingTiers,
  buildPriceLookup,
  getBillingPortalUrl,
  startCheckout,
} from "@/lib/data";
import { PlanComparison } from "../PlanComparison";
import { CancelSubscriptionDialog } from "../CancelSubscriptionDialog";

// --- Constants ---------------------------------------------------------------

const TIER_INFO_DEFAULTS: Record<
  string,
  { label: string; price: string; priceNote?: string }
> = {
  free: { label: "Free", price: "$0", priceNote: "forever" },
  pro: { label: "Pro", price: "...", priceNote: "/mo" },
  enterprise: { label: "Enterprise", price: "...", priceNote: "/mo" },
  admin: { label: "Admin", price: "Internal", priceNote: "" },
};

const TIER_LABELS: Record<string, string> = {
  pro: "Pro",
  enterprise: "Enterprise",
};

const PLAN_FEATURES_META: { tier: UserTier; features: string[] }[] = [
  {
    tier: "free",
    features: ["Metro-level data", "3 saved markets", "Basic scores"],
  },
  {
    tier: "pro",
    features: [
      "All geography levels",
      "10 saved markets",
      "5 alerts",
      "Score breakdowns",
      "5 reports/mo",
      "AI analysis",
    ],
  },
  {
    tier: "enterprise",
    features: [
      "Everything in Pro",
      "25 saved markets",
      "15 alerts",
      "Unlimited reports",
      "Priority support",
    ],
  },
];

const WATCHLIST_LIMITS: Record<UserTier, number> = {
  free: 3,
  pro: 10,
  enterprise: 25,
  admin: -1,
};
const ALERT_LIMITS: Record<UserTier, number> = {
  free: 0,
  pro: 5,
  enterprise: 15,
  admin: -1,
};

const TIER_ICONS: Record<UserTier, React.ReactNode> = {
  free: <Home className="w-5 h-5 text-on-surface-variant" />,
  pro: <Warehouse className="w-5 h-5 text-[#3949AB]" />,
  enterprise: <Building2 className="w-5 h-5 text-tertiary" />,
  admin: <Shield className="w-5 h-5 text-error" />,
};

const TIER_ICON_BG: Record<UserTier, string> = {
  free: "bg-on-surface/10",
  pro: "bg-[#3949AB]/10",
  enterprise: "bg-tertiary/10",
  admin: "bg-error/10",
};

// --- Main component ----------------------------------------------------------

interface PlanUsageSectionProps {
  tier: UserTier;
  trial: { active: boolean; daysRemaining?: number; tier?: UserTier } | null;
  watchlistCount: number;
  alertCount: number;
}

export function PlanUsageSection({
  tier,
  trial,
  watchlistCount,
  alertCount,
}: PlanUsageSectionProps) {
  const { getUsage } = useEntitlements();
  const { tiers } = usePricingTiers();
  const lookup = useMemo(() => buildPriceLookup(tiers), [tiers]);

  const [showComparison, setShowComparison] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Build tier info with live prices
  const tierInfo = useMemo(() => {
    const result = { ...TIER_INFO_DEFAULTS };
    for (const [slug, defaults] of Object.entries(TIER_INFO_DEFAULTS)) {
      const live = lookup[slug];
      if (live && slug !== "admin") {
        const monthly = live.priceMonthly;
        result[slug] = {
          label: live.name,
          price: monthly === 0 ? "$0" : `$${Math.round(monthly)}`,
          priceNote: monthly === 0 ? "forever" : "/mo",
        };
      } else {
        result[slug] = defaults;
      }
    }
    return result;
  }, [lookup]);

  const planFeatures = useMemo(() => {
    return PLAN_FEATURES_META.map((plan) => {
      const live = lookup[plan.tier];
      const defaults = TIER_INFO_DEFAULTS[plan.tier];
      const monthly = live?.priceMonthly ?? 0;
      return {
        ...plan,
        label: live?.name ?? defaults?.label ?? plan.tier,
        price:
          plan.tier === "free"
            ? "$0"
            : live
              ? `$${Math.round(monthly)}`
              : (defaults?.price ?? "..."),
        priceNote: plan.tier === "free" ? "forever" : "/mo",
      };
    });
  }, [lookup]);

  const info = tierInfo[tier] || tierInfo.free;

  // Usage meters
  const reportUsage = getUsage("reports_monthly");
  const aiUsage = getUsage("ai_analysis_monthly");
  const watchlistLimit = WATCHLIST_LIMITS[tier];
  const alertLimit = ALERT_LIMITS[tier];
  const unlimitedFallback = tier === "admin" || tier === "enterprise" ? -1 : 0;

  const meters = [
    {
      label: "Reports This Month",
      icon: <FileText className="w-4 h-4" />,
      count: reportUsage?.usage_count ?? 0,
      limit: reportUsage?.limit ?? unlimitedFallback,
    },
    {
      label: "AI Analyses",
      icon: <Sparkles className="w-4 h-4" />,
      count: aiUsage?.usage_count ?? 0,
      limit: aiUsage?.limit ?? unlimitedFallback,
    },
    {
      label: "Saved Markets",
      icon: <MapPin className="w-4 h-4" />,
      count: watchlistCount,
      limit: watchlistLimit,
    },
    {
      label: "Alerts",
      icon: <Bell className="w-4 h-4" />,
      count: alertCount,
      limit: alertLimit,
    },
  ];

  const isStripeSubscriber = tier === "pro" || tier === "enterprise";

  const handleManageBilling = useCallback(async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const url = await getBillingPortalUrl();
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // No Stripe customer yet — redirect to checkout to set up billing
      if (msg.includes("No billing account")) {
        try {
          const checkoutUrl = await startCheckout(tier, "month", "account");
          window.location.href = checkoutUrl;
          return;
        } catch {
          // checkout also failed — show error
        }
      }
      setPortalError(msg || "Failed to open billing portal");
      setPortalLoading(false);
    }
  }, [tier]);

  return (
    <section className="bg-white rounded-xl border border-indigo-200/50 p-6">
      {/* Current Plan */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`w-10 h-10 rounded-full ${TIER_ICON_BG[tier] || TIER_ICON_BG.free} flex items-center justify-center`}
        >
          {TIER_ICONS[tier] || TIER_ICONS.free}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-on-surface">
              {info.label}
            </span>
            {trial?.active && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-tertiary/10 text-tertiary">
                Trial &mdash; {trial.daysRemaining ?? 0} days left
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface-variant">
            <span className="text-lg font-bold text-on-surface">
              {info.price}
            </span>
            {info.priceNote && <span> {info.priceNote}</span>}
          </p>
        </div>
      </div>

      {/* Usage Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {meters.map((meter) => {
          const isUnlimited = meter.limit === -1;
          const pct = isUnlimited
            ? 0
            : meter.limit > 0
              ? Math.min((meter.count / meter.limit) * 100, 100)
              : 0;
          const isHigh = pct > 80;

          return (
            <div
              key={meter.label}
              className="bg-surface-container-low rounded-xl border border-outline-variant p-3"
            >
              <div className="flex items-center gap-1.5 mb-1.5 text-on-surface-variant">
                {meter.icon}
                <span className="text-[11px] font-medium leading-tight">
                  {meter.label}
                </span>
              </div>
              <div className="text-base font-semibold text-on-surface">
                {meter.count}
                <span className="text-xs font-normal text-on-surface-variant">
                  {isUnlimited ? " / \u221e" : ` / ${meter.limit}`}
                </span>
              </div>
              {!isUnlimited && meter.limit > 0 && (
                <div className="mt-1.5 h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isHigh ? "bg-red-500" : "bg-[#3949AB]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Compare Plans (expandable) */}
      <button
        type="button"
        onClick={() => setShowComparison(!showComparison)}
        className="flex items-center gap-2 text-sm font-medium text-[#3949AB] hover:text-[#3949AB]/80 transition-colors mb-4"
      >
        {showComparison ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        Compare Plans
      </button>

      {showComparison && (
        <div className="mb-6">
          <PlanComparison activeTier={tier} planFeatures={planFeatures} />
        </div>
      )}

      {/* Actions */}
      {portalError && (
        <div className="mb-3 p-3 rounded-lg bg-error/10 text-error text-sm">
          {portalError}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {isStripeSubscriber ? (
          <>
            <button
              type="button"
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="px-4 py-2 bg-[#3949AB] text-white rounded-lg text-sm font-medium hover:bg-[#3949AB]/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Manage Billing
            </button>
            {/* Change Plan → /pricing, which safely routes existing subscribers
                to the Stripe portal (no double-charge) and others to checkout. */}
            <Link
              href="/pricing?from=account"
              className="px-4 py-2 border border-[#3949AB] text-[#3949AB] rounded-lg text-sm font-medium hover:bg-[#3949AB]/8 transition-colors inline-flex items-center gap-2"
            >
              <ArrowUpDown className="w-4 h-4" />
              Change Plan
            </Link>
          </>
        ) : tier !== "admin" ? (
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3949AB] text-white rounded-lg text-sm font-medium hover:bg-[#3949AB]/90 transition-colors"
          >
            Upgrade to Pro
          </Link>
        ) : null}
      </div>

      {/* Cancel subscription link */}
      {isStripeSubscriber && (
        <div className="mt-4 pt-4 border-t border-outline-variant">
          <CancelSubscriptionDialog
            tierLabel={TIER_LABELS[tier] || tier}
            onComplete={() => {}}
          />
        </div>
      )}
    </section>
  );
}
