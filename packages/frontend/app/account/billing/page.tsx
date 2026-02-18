'use client';

import { useState } from 'react';
import { CreditCard, ExternalLink, Crown, Zap, FileText, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { useEntitlements } from '@/lib/entitlements';
import { getBillingPortalUrl } from '@/lib/data';

const TIER_INFO: Record<string, { label: string; price: string; color: string }> = {
  free: { label: 'Free', price: '$0', color: 'text-on-surface-variant' },
  pro: { label: 'Pro', price: '$29/mo', color: 'text-primary' },
  enterprise: { label: 'Enterprise', price: '$99/mo', color: 'text-tertiary' },
  admin: { label: 'Admin', price: 'Internal', color: 'text-error' },
};

export default function BillingPage() {
  const { tier, trial, loading, getUsage } = useEntitlements();
  const [portalLoading, setPortalLoading] = useState(false);

  const tierInfo = TIER_INFO[tier] || TIER_INFO.free;
  const reportsUsage = getUsage('reports_monthly');
  const aiUsage = getUsage('ai_analysis_monthly');

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const url = await getBillingPortalUrl();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      setPortalLoading(false);
    }
  };

  const isPaid = tier === 'pro' || tier === 'enterprise';

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[
            { label: 'Account', href: '/account' },
            { label: 'Billing' },
          ]}
          title="Billing & Subscription"
          description="Manage your plan and view usage"
          icon={<CreditCard className="w-5 h-5" />}
        />

        {/* Current Plan Card */}
        <div className="mt-8 bg-surface-container rounded-xl border border-outline-variant p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-on-surface">{tierInfo.label}</h2>
                  {trial?.active && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      Trial — {trial.daysRemaining}d left
                    </span>
                  )}
                  {isPaid && !trial?.active && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant">{tierInfo.price}</p>
              </div>
            </div>

            {isPaid ? (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm font-medium hover:bg-surface-container-highest transition-colors disabled:opacity-50"
              >
                {portalLoading ? 'Loading...' : 'Manage Subscription'}
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Upgrade <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        {isPaid && (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {/* Reports Usage */}
            <div className="bg-surface-container rounded-xl border border-outline-variant p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-on-surface-variant" />
                <h3 className="text-sm font-medium text-on-surface">Reports This Month</h3>
              </div>
              {reportsUsage ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-on-surface">{reportsUsage.usage_count}</span>
                    <span className="text-sm text-on-surface-variant">
                      / {reportsUsage.limit === -1 ? '\u221E' : reportsUsage.limit}
                    </span>
                  </div>
                  {reportsUsage.limit !== -1 && (
                    <div className="mt-2 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, (reportsUsage.usage_count / reportsUsage.limit) * 100)}%` }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <span className="text-sm text-on-surface-variant">Unlimited</span>
              )}
            </div>

            {/* AI Analysis Usage */}
            <div className="bg-surface-container rounded-xl border border-outline-variant p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-on-surface-variant" />
                <h3 className="text-sm font-medium text-on-surface">AI Analyses This Month</h3>
              </div>
              {aiUsage ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-on-surface">{aiUsage.usage_count}</span>
                    <span className="text-sm text-on-surface-variant">
                      / {aiUsage.limit === -1 ? '\u221E' : aiUsage.limit}
                    </span>
                  </div>
                  {aiUsage.limit !== -1 && (
                    <div className="mt-2 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, (aiUsage.usage_count / aiUsage.limit) * 100)}%` }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <span className="text-sm text-on-surface-variant">Unlimited</span>
              )}
            </div>
          </div>
        )}

        {/* Free Tier Upgrade Prompt */}
        {!isPaid && !trial?.active && (
          <div className="mt-6 bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
            <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-on-surface mb-1">Upgrade to Pro</h3>
            <p className="text-sm text-on-surface-variant mb-4 max-w-md mx-auto">
              Get full access to county & ZIP data, score breakdowns, AI market analysis, and unlimited reports.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              View Plans <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
