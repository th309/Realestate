"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CreditCard,
  Clock,
  ArrowRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { useEntitlements } from "@/lib/entitlements";
import { useAuth } from "@/lib/auth";
import { fetchPricingSummary, type PricingTier } from "@/lib/data";
import { startCheckout } from "@/lib/data";
import { trackEvent } from "@/lib/analytics/tracker";
import { getPricingCtaVariant, PRICING_CTA_COPY } from "@/lib/ab";
import { PricingCards } from "./components/PricingCards";
import {
  AIInsightsSection,
  ScoresSection,
} from "./components/FeatureShowcaseInsights";
import {
  ReportsSection,
  GeoDataSection,
} from "./components/FeatureShowcaseData";

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const { tier, trial, loading, refresh } = useEntitlements();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [plans, setPlans] = useState<PricingTier[]>([]);
  const [trialInfo, setTrialInfo] = useState<{
    is_enabled: boolean;
    duration_days: number;
    trial_tier: string;
  } | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">(
    "month",
  );
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Track pricing page view once on mount
  const pricingViewFired = useRef(false);
  useEffect(() => {
    if (!pricingViewFired.current) {
      pricingViewFired.current = true;
      const variant = getPricingCtaVariant();
      trackEvent("conversion.pricing_page_view", {
        variant,
        from: searchParams.get("from") || "direct",
      });
    }
  }, [searchParams]);

  // Auto-trigger checkout when returning from sign-in with a stored intent
  const autoCheckoutTriggered = useRef(false);
  useEffect(() => {
    if (autoCheckoutTriggered.current || authLoading) return;
    const stored = sessionStorage.getItem("checkoutIntent");
    if (stored && user) {
      autoCheckoutTriggered.current = true;
      sessionStorage.removeItem("checkoutIntent");
      try {
        const {
          tier: checkoutTier,
          interval,
          returnContext: storedReturn,
        } = JSON.parse(stored);
        setBillingInterval(interval);
        setCheckoutLoading(checkoutTier);
        startCheckout(checkoutTier, interval, storedReturn || "/map")
          .then((url) => {
            window.location.href = url;
          })
          .catch((err) => {
            console.error("Auto-checkout failed:", err);
            setCheckoutLoading(null);
          });
      } catch {
        // Malformed storage — ignore
      }
    }
  }, [user, authLoading]);

  // Fetch plan data from DB
  useEffect(() => {
    fetchPricingSummary()
      .then((data) => {
        setPlans(data.tiers);
        if (data.trial) setTrialInfo(data.trial);
      })
      .catch((err) => {
        console.warn("Pricing fetch failed:", err.message);
        setPlans([]);
      })
      .finally(() => setPlansLoading(false));
  }, []);

  // Refresh entitlements when returning from Stripe checkout
  useEffect(() => {
    if (searchParams.get("success")) {
      refresh();
    }
  }, [searchParams, refresh]);

  const effectiveTier = trial?.active ? trial.tier : tier;
  const returnContext = searchParams.get("from") || "/map";

  const handleUpgrade = useCallback(
    async (planSlug: string) => {
      trackEvent("conversion.pricing_tier_click", {
        event_label: planSlug,
        billing_interval: billingInterval,
      });
      if (!user) {
        sessionStorage.setItem(
          "checkoutIntent",
          JSON.stringify({
            tier: planSlug,
            interval: billingInterval,
            returnContext,
          }),
        );
        router.push(
          `/auth/sign-in?redirect=${encodeURIComponent(`/pricing?from=${encodeURIComponent(returnContext)}`)}`,
        );
        return;
      }
      setCheckoutLoading(planSlug);
      try {
        const url = await startCheckout(
          planSlug,
          billingInterval,
          returnContext,
        );
        window.location.href = url;
      } catch (err) {
        console.error("Checkout failed:", err);
        setCheckoutLoading(null);
      }
    },
    [billingInterval, returnContext, user, router],
  );

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: "Pricing" }]}
          title="Pricing"
          description="Start free, upgrade when you need more"
          icon={<CreditCard className="w-5 h-5" />}
        />

        {/* Trial Banner */}
        {trial?.active && (
          <div className="mt-6 bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-on-surface">
                You&apos;re on a {trial.tier?.charAt(0).toUpperCase()}
                {trial.tier?.slice(1)} trial
              </p>
              <p className="text-xs text-on-surface-variant">
                {trial.daysRemaining} days remaining. Upgrade to keep your
                access.
              </p>
            </div>
          </div>
        )}

        <PricingCards
          plans={plans}
          plansLoading={plansLoading}
          billingInterval={billingInterval}
          setBillingInterval={setBillingInterval}
          effectiveTier={effectiveTier ?? "free"}
          trial={trial}
          checkoutLoading={checkoutLoading}
          onUpgrade={handleUpgrade}
        />

        {/* Trial note */}
        {trialInfo?.is_enabled && (
          <p className="mt-5 text-center text-xs text-on-surface-variant">
            {trialInfo.duration_days}-day free trial on all paid plans. No
            credit card required.{" "}
            <a href="/contact" className="text-primary hover:underline">
              Questions?
            </a>
          </p>
        )}

        {/* Scroll hint */}
        <div className="mt-8 flex flex-col items-center gap-1 text-on-surface-variant/50">
          <span className="text-[11px] uppercase tracking-widest font-medium">
            See what Pro unlocks
          </span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      </div>

      {/* Feature Showcase */}
      <div className="bg-gradient-to-b from-surface via-surface-container-lowest to-surface-container mt-4">
        <div className="max-w-5xl mx-auto px-6 pt-12 pb-16">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary mb-3">
              Why investors upgrade
            </p>
            <h2 className="font-[var(--font-source-serif)] text-3xl md:text-[2.5rem] font-bold text-on-surface leading-tight mb-4">
              The difference between guessing
              <br className="hidden md:block" /> and{" "}
              <em className="text-primary">knowing</em>
            </h2>
            <p className="text-sm text-on-surface-variant max-w-xl mx-auto leading-relaxed">
              Free gets you started. Pro gives you the edge that turns data into
              decisions. Here&apos;s exactly what changes.
            </p>
          </div>

          <AIInsightsSection />
          <ScoresSection />
          <ReportsSection plans={plans} plansLoading={plansLoading} />
          <GeoDataSection />

          {/* Bottom CTA */}
          <div className="text-center pt-8 pb-4 border-t border-outline-variant/15">
            {effectiveTier === "pro" ||
            effectiveTier === "enterprise" ||
            effectiveTier === "admin" ? (
              <>
                <p className="text-on-surface font-semibold mb-1">
                  You&apos;re on the{" "}
                  {effectiveTier.charAt(0).toUpperCase() +
                    effectiveTier.slice(1)}{" "}
                  plan.
                </p>
                <p className="text-sm text-on-surface-variant mb-5">
                  Manage your subscription and billing details from your
                  account.
                </p>
                <a
                  href="/account"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
                >
                  Manage Subscription <ArrowRight className="w-4 h-4" />
                </a>
              </>
            ) : (
              <>
                <p className="text-on-surface font-semibold mb-1">
                  Less than a dollar a day for an institutional-grade edge.
                </p>
                <p className="text-sm text-on-surface-variant mb-5">
                  {trialInfo?.is_enabled
                    ? `${trialInfo.duration_days}-day free trial. `
                    : ""}
                  Cancel anytime. No credit card to start.
                </p>
                <button
                  onClick={() => {
                    const variant = getPricingCtaVariant();
                    trackEvent("conversion.pricing_cta_click", { variant, source: "pricing_page" });
                    handleUpgrade("pro");
                  }}
                  disabled={checkoutLoading === "pro"}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {checkoutLoading === "pro" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      {PRICING_CTA_COPY[getPricingCtaVariant()]} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
