"use client";

import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { UserTier } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanFeature {
  tier: UserTier;
  label: string;
  price: string;
  priceNote: string;
  features: string[];
}

interface PlanComparisonProps {
  activeTier: UserTier;
  planFeatures: PlanFeature[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanComparison({
  activeTier,
  planFeatures,
}: PlanComparisonProps) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-on-surface mb-4">
        Compare Plans
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {planFeatures.map((plan) => {
          const isCurrent = plan.tier === activeTier;
          // Admin tier is above all plans — never show Upgrade
          const isUpgrade =
            activeTier !== "admin" &&
            ["free", "pro", "enterprise"].indexOf(plan.tier) >
              ["free", "pro", "enterprise"].indexOf(activeTier);

          return (
            <div
              key={plan.tier}
              className={`rounded-xl border p-5 flex flex-col ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant bg-surface-container-low"
              }`}
            >
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-on-surface">
                  {plan.label}
                </h4>
                <p className="mt-1">
                  <span className="text-xl font-bold text-on-surface">
                    {plan.price}
                  </span>
                  {plan.priceNote && (
                    <span className="text-xs text-on-surface-variant">
                      {" "}
                      {plan.priceNote}
                    </span>
                  )}
                </p>
              </div>

              <ul className="space-y-2 flex-1 mb-4">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-on-surface-variant"
                  >
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
