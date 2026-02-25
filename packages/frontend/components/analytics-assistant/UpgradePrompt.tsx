'use client';

/**
 * Upgrade Prompt Component
 *
 * Shows when a user tries to access a feature they don't have access to.
 */

import React from 'react';
import { Sparkles, Lock, ArrowRight, Check } from 'lucide-react';
import { usePricingTiers, buildPriceLookup } from '@/lib/data/hooks/usePricingTiers';

interface UpgradePromptProps {
  feature?: string;
  featureName?: string;
  currentTier?: string;
  requiredTier?: string;
  onUpgrade?: () => void;
  onClose?: () => void;
}

const TIER_BENEFITS: Record<string, string[]> = {
  pro: [
    '20 AI queries per day',
    'State & metro analysis',
    'Save up to 10 queries',
    'Market watchlist (20 markets)',
    'Inline charts & comparisons',
    'CSV export',
    'Shareable links',
  ],
  enterprise: [
    'Unlimited AI queries',
    'All geography types (zip, county)',
    'Unlimited saved queries',
    'Unlimited watchlist',
    'Scenario modeling',
    'Statistical deep dives',
    'API access',
    'Team collaboration (25 members)',
    'Priority support',
  ],
};

export function UpgradePrompt({
  feature,
  featureName,
  currentTier = 'free',
  requiredTier = 'pro',
  onUpgrade,
  onClose,
}: UpgradePromptProps) {
  const { tiers } = usePricingTiers();
  const priceLookup = buildPriceLookup(tiers);
  const benefits = TIER_BENEFITS[requiredTier] || TIER_BENEFITS.pro;
  const tierName = requiredTier === 'enterprise' ? 'Enterprise' : 'Pro';
  const monthly = priceLookup[requiredTier]?.priceMonthly;
  const price = monthly != null ? `$${monthly}` : '...';

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-primary" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-on-surface mb-2">
        Upgrade to {tierName}
      </h3>

      {/* Description */}
      <p className="text-on-surface-variant mb-6 max-w-sm">
        {featureName ? (
          <>
            <span className="font-medium text-on-surface">{featureName}</span> is
            available on the {tierName} plan.
          </>
        ) : (
          <>
            Get access to advanced analytics features with {tierName}.
          </>
        )}
      </p>

      {/* Benefits */}
      <div className="w-full max-w-sm mb-6">
        <div className="bg-surface-container rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-medium text-on-surface">{tierName} includes:</span>
          </div>
          <ul className="space-y-2 text-left">
            {benefits.slice(0, 5).map((benefit) => (
              <li
                key={benefit}
                className="flex items-start gap-2 text-sm text-on-surface-variant"
              >
                <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                {benefit}
              </li>
            ))}
            {benefits.length > 5 && (
              <li className="text-sm text-primary">
                + {benefits.length - 5} more features
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Pricing */}
      <div className="mb-6">
        <span className="text-3xl font-bold text-on-surface">{price}</span>
        <span className="text-on-surface-variant">/month</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={onUpgrade}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          Upgrade to {tierName}
          <ArrowRight className="w-4 h-4" />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="px-6 py-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Maybe later
          </button>
        )}
      </div>

      {/* Current tier badge */}
      <p className="mt-4 text-xs text-on-surface-variant">
        You're currently on the{' '}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium">
          {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
        </span>{' '}
        plan
      </p>
    </div>
  );
}
