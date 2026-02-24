'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Sparkles,
  MapPin,
  Bell,
  Check,
  ExternalLink,
  Loader2,
  Home,
  Warehouse,
  Building2,
  Shield,
  ArrowUpRight,
} from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import type { UserTier } from '@/lib/entitlements';
import { useWatchlist } from '@/components/analytics-assistant/persistence/useWatchlist';
import { useAlerts } from '@/lib/alerts/hooks';
import { getBillingPortalUrl, usePricingTiers, buildPriceLookup } from '@/lib/data';
import type { User } from '@supabase/supabase-js';

// --- Tier constants -----------------------------------------------------------

/** Fallback labels / non-price metadata. Prices are overridden from the API. */
const TIER_INFO_DEFAULTS: Record<string, { label: string; price: string; priceNote?: string }> = {
  free: { label: 'Free', price: '$0', priceNote: 'forever' },
  pro: { label: 'Pro', price: '...', priceNote: '/mo' },
  enterprise: { label: 'Enterprise', price: '...', priceNote: '/mo' },
  admin: { label: 'Admin', price: 'Internal', priceNote: '' },
};

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

/** Static feature lists per tier. Prices are injected from the API at render time. */
const PLAN_FEATURES_META: {
  tier: UserTier;
  features: string[];
}[] = [
  {
    tier: 'free',
    features: ['Metro-level data', '3 saved markets', 'Basic scores'],
  },
  {
    tier: 'pro',
    features: ['All geography levels', '10 saved markets', '5 alerts', 'Score breakdowns', '5 reports/mo', 'AI analysis'],
  },
  {
    tier: 'enterprise',
    features: ['Everything in Pro', '25 saved markets', '15 alerts', 'Unlimited reports', 'Priority support'],
  },
];

// --- Main component -----------------------------------------------------------

interface SubscriptionTabProps {
  user: User;
}

/** Build tier info with live prices from the API, falling back to defaults. */
function useTierInfo() {
  const { tiers } = usePricingTiers();
  const lookup = React.useMemo(() => buildPriceLookup(tiers), [tiers]);

  const tierInfo = React.useMemo(() => {
    const result = { ...TIER_INFO_DEFAULTS };
    for (const [slug, defaults] of Object.entries(TIER_INFO_DEFAULTS)) {
      const live = lookup[slug];
      if (live && slug !== 'admin') {
        const monthly = live.priceMonthly;
        result[slug] = {
          label: live.name,
          price: monthly === 0 ? '$0' : `$${Math.round(monthly)}`,
          priceNote: monthly === 0 ? 'forever' : '/mo',
        };
      } else {
        result[slug] = defaults;
      }
    }
    return result;
  }, [lookup]);

  const planFeatures = React.useMemo(() => {
    return PLAN_FEATURES_META.map(plan => {
      const live = lookup[plan.tier];
      const defaults = TIER_INFO_DEFAULTS[plan.tier];
      const monthly = live?.priceMonthly ?? 0;
      return {
        ...plan,
        label: live?.name ?? defaults?.label ?? plan.tier,
        price: plan.tier === 'free'
          ? '$0'
          : live
            ? `$${Math.round(monthly)}`
            : defaults?.price ?? '...',
        priceNote: plan.tier === 'free' ? 'forever' : '/mo',
      };
    });
  }, [lookup]);

  return { tierInfo, planFeatures };
}

export function SubscriptionTab({ user }: SubscriptionTabProps) {
  const { tier, trial, getUsage } = useEntitlements();
  const { items: watchlistItems } = useWatchlist({ userId: user.id, autoLoad: true });
  const { alerts } = useAlerts();
  const { tierInfo, planFeatures } = useTierInfo();

  return (
    <div className="py-8 space-y-0">
      {/* Current plan card */}
      <CurrentPlanCard tier={tier} trial={trial} tierInfo={tierInfo} />

      <div className="border-t border-outline-variant my-8" />

      {/* Usage meters */}
      <UsageMeters
        tier={tier}
        getUsage={getUsage}
        watchlistCount={watchlistItems.length}
        alertCount={alerts.length}
      />

      <div className="border-t border-outline-variant my-8" />

      {/* Plan comparison */}
      <PlanComparison activeTier={tier} planFeatures={planFeatures} />

      <div className="border-t border-outline-variant my-8" />

      {/* Actions */}
      <ActionsSection tier={tier} />
    </div>
  );
}

// --- Current Plan Card --------------------------------------------------------

const TIER_ICONS: Record<UserTier, React.ReactNode> = {
  free: <Home className="w-5 h-5 text-on-surface-variant" />,
  pro: <Warehouse className="w-5 h-5 text-primary" />,
  enterprise: <Building2 className="w-5 h-5 text-tertiary" />,
  admin: <Shield className="w-5 h-5 text-error" />,
};

const TIER_ICON_BG: Record<UserTier, string> = {
  free: 'bg-on-surface/10',
  pro: 'bg-primary/10',
  enterprise: 'bg-tertiary/10',
  admin: 'bg-error/10',
};

function CurrentPlanCard({
  tier,
  trial,
  tierInfo,
}: {
  tier: UserTier;
  trial: { active: boolean; daysRemaining?: number; tier?: UserTier } | null;
  tierInfo: Record<string, { label: string; price: string; priceNote?: string }>;
}) {
  const info = tierInfo[tier] || tierInfo.free;

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Current Plan</h3>
      <div className="bg-surface-container rounded-xl border border-outline-variant p-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${TIER_ICON_BG[tier] || TIER_ICON_BG.free} flex items-center justify-center`}>
            {TIER_ICONS[tier] || TIER_ICONS.free}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-on-surface">{info.label}</span>
              {trial?.active && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-tertiary/10 text-tertiary">
                  Trial &mdash; {trial.daysRemaining ?? 0} days left
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">
              <span className="text-lg font-bold text-on-surface">{info.price}</span>
              {info.priceNote && (
                <span className="text-on-surface-variant"> {info.priceNote}</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Usage Meters -------------------------------------------------------------

interface UsageMetersProps {
  tier: UserTier;
  getUsage: (slug: string) => { usage_count: number; limit: number } | null;
  watchlistCount: number;
  alertCount: number;
}

function UsageMeters({ tier, getUsage, watchlistCount, alertCount }: UsageMetersProps) {
  const reportUsage = getUsage('reports_monthly');
  const aiUsage = getUsage('ai_analysis_monthly');
  const watchlistLimit = WATCHLIST_LIMITS[tier];
  const alertLimit = ALERT_LIMITS[tier];

  // For admin/enterprise with unlimited access, getUsage may return null (no limit configured).
  // Treat null as unlimited (-1) for paid tiers, 0 for free.
  const unlimitedFallback = tier === 'admin' || tier === 'enterprise' ? -1 : 0;

  const meters: {
    label: string;
    icon: React.ReactNode;
    count: number;
    limit: number;
  }[] = [
    {
      label: 'Reports This Month',
      icon: <FileText className="w-4 h-4" />,
      count: reportUsage?.usage_count ?? 0,
      limit: reportUsage?.limit ?? unlimitedFallback,
    },
    {
      label: 'AI Analyses',
      icon: <Sparkles className="w-4 h-4" />,
      count: aiUsage?.usage_count ?? 0,
      limit: aiUsage?.limit ?? unlimitedFallback,
    },
    {
      label: 'Saved Markets',
      icon: <MapPin className="w-4 h-4" />,
      count: watchlistCount,
      limit: watchlistLimit,
    },
    {
      label: 'Alerts',
      icon: <Bell className="w-4 h-4" />,
      count: alertCount,
      limit: alertLimit,
    },
  ];

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Usage</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {meters.map((meter) => (
          <UsageMeterCard key={meter.label} {...meter} />
        ))}
      </div>
    </section>
  );
}

function UsageMeterCard({
  label,
  icon,
  count,
  limit,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  limit: number;
}) {
  const isUnlimited = limit === -1;
  const pct = isUnlimited ? 0 : limit > 0 ? Math.min((count / limit) * 100, 100) : 0;
  const isHigh = pct > 80;

  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant p-4">
      <div className="flex items-center gap-2 mb-2 text-on-surface-variant">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-lg font-semibold text-on-surface">
        {count}
        {isUnlimited ? (
          <span className="text-sm font-normal text-on-surface-variant"> / Unlimited</span>
        ) : (
          <span className="text-sm font-normal text-on-surface-variant"> / {limit}</span>
        )}
      </div>
      {!isUnlimited && limit > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-on-surface/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isHigh ? 'bg-error' : 'bg-primary'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// --- Plan Comparison ----------------------------------------------------------

function PlanComparison({ activeTier, planFeatures }: {
  activeTier: UserTier;
  planFeatures: { tier: UserTier; label: string; price: string; priceNote: string; features: string[] }[];
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Compare Plans</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {planFeatures.map((plan) => {
          const isCurrent = plan.tier === activeTier;
          // Admin tier is above all plans — never show Upgrade
          const isUpgrade = activeTier !== 'admin' &&
            ['free', 'pro', 'enterprise'].indexOf(plan.tier) >
            ['free', 'pro', 'enterprise'].indexOf(activeTier);

          return (
            <div
              key={plan.tier}
              className={`rounded-xl border p-5 flex flex-col ${
                isCurrent
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant bg-surface-container-low'
              }`}
            >
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-on-surface">{plan.label}</h4>
                <p className="mt-1">
                  <span className="text-xl font-bold text-on-surface">{plan.price}</span>
                  {plan.priceNote && (
                    <span className="text-xs text-on-surface-variant"> {plan.priceNote}</span>
                  )}
                </p>
              </div>

              <ul className="space-y-2 flex-1 mb-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-on-surface-variant">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <span className="block text-center py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary">
                  Current
                </span>
              ) : isUpgrade ? (
                <Link
                  href="/pricing"
                  className="block text-center px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Upgrade
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- Actions ------------------------------------------------------------------

function ActionsSection({ tier }: { tier: UserTier }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleManageSub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await getBillingPortalUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
      setLoading(false);
    }
  }, []);

  const isPaid = tier === 'pro' || tier === 'enterprise' || tier === 'admin';

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Actions</h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 text-error text-sm">{error}</div>
      )}

      {isPaid ? (
        <button
          type="button"
          onClick={handleManageSub}
          disabled={loading}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          Manage Subscription
        </button>
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
