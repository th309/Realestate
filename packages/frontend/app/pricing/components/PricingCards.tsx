"use client";

import { Check, Sparkles, Loader2 } from "lucide-react";
import type { PricingTier } from "@/lib/data/fetchers/pricing";
import type { TrialInfo } from "@/lib/entitlements/types";
import { FALLBACK_BULLETS } from "./build-feature-bullets";

interface PricingCardsProps {
  plans: PricingTier[];
  plansLoading: boolean;
  billingInterval: "month" | "year";
  setBillingInterval: (interval: "month" | "year") => void;
  effectiveTier: string;
  trial: TrialInfo | null;
  checkoutLoading: string | null;
  onUpgrade: (planSlug: string) => void;
}

export function PricingCards({
  plans,
  plansLoading,
  billingInterval,
  setBillingInterval,
  effectiveTier,
  trial,
  checkoutLoading,
  onUpgrade,
}: PricingCardsProps) {
  return (
    <>
      {/* Billing Interval Toggle */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <span
          className={`text-sm ${billingInterval === "month" ? "text-on-surface font-medium" : "text-on-surface-variant"}`}
        >
          Monthly
        </span>
        <button
          onClick={() =>
            setBillingInterval(billingInterval === "month" ? "year" : "month")
          }
          className={`relative w-12 h-6 rounded-full transition-colors ${billingInterval === "year" ? "bg-primary" : "bg-outline-variant"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${billingInterval === "year" ? "translate-x-6" : ""}`}
          />
        </button>
        <span
          className={`text-sm ${billingInterval === "year" ? "text-on-surface font-medium" : "text-on-surface-variant"}`}
        >
          Yearly{" "}
          <span className="text-green-600 font-medium text-xs">Save 17%</span>
        </span>
      </div>

      {/* Pricing Cards */}
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {plansLoading && plans.length === 0 && (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-outline-variant bg-surface-container p-6 animate-pulse"
              >
                <div className="h-5 w-20 bg-surface-container-high rounded mb-2" />
                <div className="h-8 w-24 bg-surface-container-high rounded mb-1" />
                <div className="h-4 w-16 bg-surface-container-high rounded mb-6" />
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-surface-container-high rounded-full shrink-0" />
                      <div className="h-4 bg-surface-container-high rounded flex-1" />
                    </div>
                  ))}
                </div>
                <div className="mt-6 h-10 bg-surface-container-high rounded-lg" />
              </div>
            ))}
          </>
        )}
        {plans.map((plan) => (
          <PricingCard
            key={plan.slug}
            plan={plan}
            billingInterval={billingInterval}
            effectiveTier={effectiveTier}
            trial={trial}
            checkoutLoading={checkoutLoading}
            onUpgrade={onUpgrade}
          />
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Individual Pricing Card                                            */
/* ------------------------------------------------------------------ */

interface PricingCardProps {
  plan: PricingTier;
  billingInterval: "month" | "year";
  effectiveTier: string;
  trial: TrialInfo | null;
  checkoutLoading: string | null;
  onUpgrade: (planSlug: string) => void;
}

function PricingCard({
  plan,
  billingInterval,
  effectiveTier,
  trial,
  checkoutLoading,
  onUpgrade,
}: PricingCardProps) {
  const isCurrentPlan = effectiveTier === plan.slug;
  const isTrialPlan = trial?.active && trial.tier === plan.slug;
  const isHighlighted = plan.slug === "pro";
  const rawMonthly = Number(plan.price_monthly) || 0;
  const rawYearly = Number(plan.price_yearly) || 0;
  const effectiveMonthly =
    billingInterval === "year" && rawYearly > 0
      ? Math.round(rawYearly / 12)
      : rawMonthly;
  const priceDisplay =
    effectiveMonthly === 0 ? "$0" : `$${Math.round(effectiveMonthly)}`;
  const periodDisplay = effectiveMonthly === 0 ? "forever" : "/month";
  const ctaText =
    plan.slug === "enterprise"
      ? "Contact Sales"
      : plan.slug === "pro"
        ? "Start Free Trial"
        : "Get Started";

  const featureBullets =
    plan.pricing_card_items?.length > 0
      ? plan.pricing_card_items
      : (FALLBACK_BULLETS[plan.slug] ?? []);

  return (
    <div
      className={`
        relative rounded-xl p-4 transition-all
        ${
          isCurrentPlan
            ? "bg-primary-container border-2 border-primary shadow-lg ring-2 ring-primary/20"
            : isHighlighted
              ? "bg-primary-container border-2 border-primary shadow-lg scale-[1.03]"
              : "bg-surface-container border border-outline-variant hover:border-primary/30"
        }
      `}
    >
      {isCurrentPlan ? (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-green-600 text-white text-[11px] font-medium rounded-full flex items-center gap-1">
          <Check className="w-3 h-3" />
          {isTrialPlan ? "Trial Active" : "Current Plan"}
        </div>
      ) : (
        isHighlighted && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-primary text-on-primary text-[11px] font-medium rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </div>
        )
      )}

      <div className="text-center mb-4">
        <h3
          className={`text-base font-semibold mb-1 ${isHighlighted || isCurrentPlan ? "text-on-primary-container" : "text-on-surface"}`}
        >
          {plan.name}
        </h3>
        <div className="flex items-baseline justify-center gap-1">
          <span
            className={`text-3xl font-bold ${isHighlighted || isCurrentPlan ? "text-on-primary-container" : "text-on-surface"}`}
          >
            {priceDisplay}
          </span>
          <span
            className={`text-xs ${isHighlighted || isCurrentPlan ? "text-on-primary-container/70" : "text-on-surface-variant"}`}
          >
            {periodDisplay}
          </span>
        </div>
        {billingInterval === "year" && rawYearly > 0 && (
          <p
            className={`text-[11px] mt-0.5 ${isHighlighted || isCurrentPlan ? "text-on-primary-container/60" : "text-on-surface-variant/60"}`}
          >
            ${Math.round(rawYearly)}/year billed annually
          </p>
        )}
        <p
          className={`text-xs mt-1 ${isHighlighted || isCurrentPlan ? "text-on-primary-container/80" : "text-on-surface-variant"}`}
        >
          {plan.description}
        </p>
      </div>

      <ul className="space-y-2 mb-4">
        {featureBullets.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
            <span
              className={`text-[13px] ${isHighlighted || isCurrentPlan ? "text-on-primary-container" : "text-on-surface-variant"}`}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <CardCTA
        slug={plan.slug}
        isCurrentPlan={isCurrentPlan}
        isTrialPlan={!!isTrialPlan}
        isHighlighted={isHighlighted}
        ctaText={ctaText}
        checkoutLoading={checkoutLoading}
        onUpgrade={onUpgrade}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card CTA button                                                    */
/* ------------------------------------------------------------------ */

function CardCTA({
  slug,
  isCurrentPlan,
  isTrialPlan,
  isHighlighted,
  ctaText,
  checkoutLoading,
  onUpgrade,
}: {
  slug: string;
  isCurrentPlan: boolean;
  isTrialPlan: boolean;
  isHighlighted: boolean;
  ctaText: string;
  checkoutLoading: string | null;
  onUpgrade: (s: string) => void;
}) {
  if (isCurrentPlan && !isTrialPlan) {
    return (
      <div className="block w-full text-center py-2 rounded-lg font-medium text-sm bg-surface-container-high text-on-surface-variant">
        Current Plan
      </div>
    );
  }
  if (slug === "free") {
    return (
      <a
        href="/map"
        className="block w-full text-center py-2 rounded-lg font-medium text-sm transition-colors bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
      >
        Get Started
      </a>
    );
  }
  if (slug === "enterprise") {
    return (
      <a
        href="/contact?subject=Enterprise%20Inquiry"
        className="block w-full text-center py-2 rounded-lg font-medium text-sm transition-colors bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
      >
        Contact Sales
      </a>
    );
  }
  return (
    <button
      onClick={() => onUpgrade(slug)}
      disabled={checkoutLoading === slug}
      className={`
        block w-full text-center py-2 rounded-lg font-medium text-sm transition-colors
        ${
          isHighlighted
            ? "bg-primary text-on-primary hover:bg-primary/90"
            : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
        }
        disabled:opacity-60 disabled:cursor-not-allowed
      `}
    >
      {checkoutLoading === slug ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Redirecting...
        </span>
      ) : isTrialPlan ? (
        "Upgrade Now"
      ) : (
        ctaText
      )}
    </button>
  );
}
