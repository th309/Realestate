"use client";

import React from "react";
import { Check, Crown, Loader2 } from "lucide-react";

interface PlanTier {
  slug: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

const PLAN_TIERS: PlanTier[] = [
  {
    slug: "free",
    name: "Free",
    price: "$0",
    description: "For individuals exploring markets",
    features: [
      "1 user",
      "3 reports per month",
      "Basic market data",
      "ZIP-level analytics",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    price: "$29",
    description: "For serious investors and agents",
    features: [
      "1 user",
      "10 reports per month",
      "All market metrics",
      "Score breakdowns",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "For teams and brokerages",
    features: [
      "Unlimited seats",
      "Unlimited reports",
      "API access",
      "Custom branding",
      "Dedicated support",
      "SSO (coming soon)",
    ],
  },
];

interface PlanComparisonCardsProps {
  currentPlanName: string | null;
  onSwitchPlan: () => void;
  switchLoading: boolean;
}

/**
 * Plan comparison cards showing Free, Pro, and Enterprise tiers.
 * Highlights the current plan and provides "Switch Plan" buttons for others.
 */
export function PlanComparisonCards({
  currentPlanName,
  onSwitchPlan,
  switchLoading,
}: PlanComparisonCardsProps) {
  const normalizedCurrent = (currentPlanName ?? "").toLowerCase().trim();

  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-on-surface mb-4">
        Available Plans
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLAN_TIERS.map((tier) => {
          const isCurrent = normalizedCurrent.includes(tier.slug);

          return (
            <div
              key={tier.slug}
              className={`relative rounded-xl p-6 transition-shadow ${
                isCurrent
                  ? "bg-primary/5 border-2 border-primary shadow-md"
                  : "bg-surface-container-low border border-outline-variant shadow-sm hover:shadow-md"
              }`}
            >
              {/* Current plan badge */}
              {isCurrent && (
                <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-on-primary">
                  <Crown className="w-3 h-3" />
                  Current Plan
                </span>
              )}

              {/* Tier name and price */}
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-on-surface">
                  {tier.name}
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  {tier.description}
                </p>
                <p className="mt-3">
                  <span className="text-2xl font-bold text-on-surface">
                    {tier.price}
                  </span>
                  {tier.price !== "Custom" && (
                    <span className="text-sm text-on-surface-variant">
                      /month
                    </span>
                  )}
                </p>
              </div>

              {/* Feature list */}
              <ul className="space-y-2 mb-6">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-on-surface-variant"
                  >
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Action button */}
              {isCurrent ? (
                <div className="text-center text-sm font-medium text-primary py-2">
                  Your current plan
                </div>
              ) : (
                <button
                  onClick={onSwitchPlan}
                  disabled={switchLoading}
                  className={`w-full flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    tier.highlighted
                      ? "bg-primary text-on-primary hover:bg-primary/90"
                      : "border border-outline-variant text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {switchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Switch Plan
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-on-surface-variant mt-3">
        Switching plans opens the Stripe billing portal where you can manage
        your subscription.
      </p>
    </div>
  );
}
