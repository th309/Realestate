'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Check, Sparkles, Clock } from 'lucide-react';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { useEntitlements } from '@/lib/entitlements';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for exploring the platform',
    features: [
      'Interactive market maps',
      'State & metro level data',
      'Basic market trends',
      'Limited report exports',
    ],
    cta: 'Get Started',
    href: '/map',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For serious buyers and investors',
    features: [
      'Everything in Free',
      'ZIP code level data',
      'PropertyIQ Scores',
      'Advanced analytics',
      'Unlimited reports',
      'AI market insights',
    ],
    cta: 'Start Pro Trial',
    href: '/map',
    highlight: true,
  },
  {
    name: 'Team',
    price: '$99',
    period: '/month',
    description: 'For agents and brokerages',
    features: [
      'Everything in Pro',
      'Up to 5 team members',
      'White-label reports',
      'API access',
      'Priority support',
      'Custom branding',
    ],
    cta: 'Contact Sales',
    href: '/about',
    highlight: false,
  },
];

// Map plan names to tier slugs
const PLAN_TO_TIER: Record<string, string> = {
  'Free': 'free',
  'Pro': 'pro',
  'Team': 'enterprise',
};

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const { tier, trial, loading, refresh } = useEntitlements();
  const searchParams = useSearchParams();

  // Refresh entitlements when returning from Stripe checkout
  useEffect(() => {
    if (searchParams.get('success')) {
      refresh();
    }
  }, [searchParams, refresh]);

  // Determine effective tier (considering trial)
  const effectiveTier = trial?.active ? trial.tier : tier;

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: 'Pricing' }]}
          title="Simple, Transparent Pricing"
          description="Start free, upgrade when you need more"
          icon={<CreditCard className="w-5 h-5" />}
        />

        {/* Trial Banner */}
        {trial?.active && (
          <div className="mt-6 bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-on-surface">
                You're on a {trial.tier?.charAt(0).toUpperCase()}{trial.tier?.slice(1)} trial
              </p>
              <p className="text-xs text-on-surface-variant">
                {trial.daysRemaining} days remaining. Upgrade to keep your access.
              </p>
            </div>
          </div>
        )}

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const planTier = PLAN_TO_TIER[plan.name];
            const isCurrentPlan = effectiveTier === planTier;
            const isTrialPlan = trial?.active && trial.tier === planTier;

            return (
              <div
                key={plan.name}
                className={`
                  relative rounded-2xl p-6 transition-all
                  ${isCurrentPlan
                    ? 'bg-primary-container border-2 border-primary shadow-lg ring-2 ring-primary/20'
                    : plan.highlight
                      ? 'bg-primary-container border-2 border-primary shadow-lg scale-105'
                      : 'bg-surface-container border border-outline-variant hover:border-primary/30'
                  }
                `}
              >
                {isCurrentPlan ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {isTrialPlan ? 'Trial Active' : 'Current Plan'}
                  </div>
                ) : plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-on-primary text-xs font-medium rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className={`text-lg font-semibold mb-2 ${plan.highlight || isCurrentPlan ? 'text-on-primary-container' : 'text-on-surface'}`}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-4xl font-bold ${plan.highlight || isCurrentPlan ? 'text-on-primary-container' : 'text-on-surface'}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlight || isCurrentPlan ? 'text-on-primary-container/70' : 'text-on-surface-variant'}`}>
                      {plan.period}
                    </span>
                  </div>
                  <p className={`text-sm mt-2 ${plan.highlight || isCurrentPlan ? 'text-on-primary-container/80' : 'text-on-surface-variant'}`}>
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlight || isCurrentPlan ? 'text-primary' : 'text-primary'}`} />
                      <span className={`text-sm ${plan.highlight || isCurrentPlan ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrentPlan && !isTrialPlan ? (
                  <div className="block w-full text-center py-2.5 rounded-xl font-medium bg-surface-container-high text-on-surface-variant">
                    Current Plan
                  </div>
                ) : (
                  <a
                    href={plan.href}
                    className={`
                      block w-full text-center py-2.5 rounded-xl font-medium transition-colors
                      ${plan.highlight || isCurrentPlan
                        ? 'bg-primary text-on-primary hover:bg-primary/90'
                        : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                      }
                    `}
                  >
                    {isTrialPlan ? 'Upgrade Now' : plan.cta}
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* FAQ or note */}
        <div className="mt-12 text-center">
          <p className="text-on-surface-variant">
            All plans include a 14-day free trial. No credit card required to start.
          </p>
          <p className="text-sm text-on-surface-variant mt-2">
            Questions? <a href="/about" className="text-primary hover:underline">Contact us</a>
          </p>
        </div>
      </div>
    </div>
  );
}
