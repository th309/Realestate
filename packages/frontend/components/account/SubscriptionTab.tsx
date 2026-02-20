'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Crown,
  FileText,
  Sparkles,
  MapPin,
  Bell,
  Check,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useEntitlements } from '@/lib/entitlements';
import type { UserTier } from '@/lib/entitlements';
import { useWatchlist } from '@/components/analytics-assistant/persistence/useWatchlist';
import { useAlerts } from '@/lib/alerts/hooks';
import { getBillingPortalUrl } from '@/lib/data';
import type { User } from '@supabase/supabase-js';

// --- Tier constants -----------------------------------------------------------

const TIER_INFO: Record<string, { label: string; price: string; priceNote?: string }> = {
  free: { label: 'Free', price: '$0', priceNote: 'forever' },
  pro: { label: 'Pro', price: '$29', priceNote: '/mo' },
  enterprise: { label: 'Enterprise', price: '$99', priceNote: '/mo' },
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

const PLAN_FEATURES: {
  tier: UserTier;
  label: string;
  price: string;
  priceNote: string;
  features: string[];
}[] = [
  {
    tier: 'free',
    label: 'Free',
    price: '$0',
    priceNote: 'forever',
    features: [
      'Metro-level data',
      '3 saved markets',
      'Basic scores',
    ],
  },
  {
    tier: 'pro',
    label: 'Pro',
    price: '$29',
    priceNote: '/mo',
    features: [
      'All geography levels',
      '10 saved markets',
      '5 alerts',
      'Score breakdowns',
      '5 reports/mo',
      'AI analysis',
    ],
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    price: '$99',
    priceNote: '/mo',
    features: [
      'Everything in Pro',
      '25 saved markets',
      '15 alerts',
      'Unlimited reports',
      'Priority support',
    ],
  },
];

// --- Main component -----------------------------------------------------------

interface SubscriptionTabProps {
  user: User;
}

export function SubscriptionTab({ user }: SubscriptionTabProps) {
  const { tier, trial, getUsage } = useEntitlements();
  const { items: watchlistItems } = useWatchlist({ userId: user.id, autoLoad: true });
  const { alerts } = useAlerts();

  return (
    <div className="py-8 space-y-0">
      {/* Current plan card */}
      <CurrentPlanCard tier={tier} trial={trial} />

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
      <PlanComparison activeTier={tier} />

      <div className="border-t border-outline-variant my-8" />

      {/* Actions */}
      <ActionsSection tier={tier} />
    </div>
  );
}

// --- Current Plan Card --------------------------------------------------------

function CurrentPlanCard({
  tier,
  trial,
}: {
  tier: UserTier;
  trial: { active: boolean; daysRemaining?: number; tier?: UserTier } | null;
}) {
  const info = TIER_INFO[tier] || TIER_INFO.free;

  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Current Plan</h3>
      <div className="bg-surface-container rounded-xl border border-outline-variant p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-primary" />
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
      limit: reportUsage?.limit ?? 0,
    },
    {
      label: 'AI Analyses',
      icon: <Sparkles className="w-4 h-4" />,
      count: aiUsage?.usage_count ?? 0,
      limit: aiUsage?.limit ?? 0,
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

function PlanComparison({ activeTier }: { activeTier: UserTier }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">Compare Plans</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLAN_FEATURES.map((plan) => {
          const isCurrent = plan.tier === activeTier;
          const isUpgrade =
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

  const isPaid = tier === 'pro' || tier === 'enterprise';

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
          <Crown className="w-4 h-4" />
          Upgrade to Pro
        </Link>
      )}
    </section>
  );
}
