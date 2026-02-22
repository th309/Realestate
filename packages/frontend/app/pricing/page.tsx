'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CreditCard, Check, Sparkles, Clock, BarChart3, MapPin,
  FileText, ArrowRight, Lock, Target, TrendingUp, Shield,
  Zap, ChevronDown, Loader2,
} from 'lucide-react';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { useEntitlements } from '@/lib/entitlements';
import { useAuth } from '@/lib/auth';
import { fetchPricingSummary, type PricingTier } from '@/lib/data';
import { startCheckout } from '@/lib/data';

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
  const [trialInfo, setTrialInfo] = useState<{ is_enabled: boolean; duration_days: number; trial_tier: string } | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Auto-trigger checkout when returning from sign-in with a stored intent
  const autoCheckoutTriggered = useRef(false);
  useEffect(() => {
    if (autoCheckoutTriggered.current || authLoading) return;
    const stored = sessionStorage.getItem('checkoutIntent');
    if (stored && user) {
      autoCheckoutTriggered.current = true;
      sessionStorage.removeItem('checkoutIntent');
      try {
        const { tier: checkoutTier, interval } = JSON.parse(stored);
        setBillingInterval(interval);
        setCheckoutLoading(checkoutTier);
        startCheckout(checkoutTier, interval)
          .then(url => { window.location.href = url; })
          .catch(err => {
            console.error('Auto-checkout failed:', err);
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
      .then(data => {
        setPlans(data.tiers);
        if (data.trial) setTrialInfo(data.trial);
      })
      .catch(err => {
        console.warn('Pricing fetch failed, using fallback:', err.message);
        setPlans([
          { slug: 'free', name: 'Free', price_monthly: '0', price_yearly: '0', description: 'Explore the platform', features: [] },
          { slug: 'pro', name: 'Pro', price_monthly: '29', price_yearly: '290', description: 'The unfair advantage', features: [] },
          { slug: 'enterprise', name: 'Enterprise', price_monthly: '99', price_yearly: '990', description: 'For brokerages', features: [] },
        ]);
      })
      .finally(() => setPlansLoading(false));
  }, []);

  // Refresh entitlements when returning from Stripe checkout
  useEffect(() => {
    if (searchParams.get('success')) {
      refresh();
    }
  }, [searchParams, refresh]);

  // Determine effective tier (considering trial)
  const effectiveTier = trial?.active ? trial.tier : tier;

  const handleUpgrade = async (planSlug: string) => {
    // If not authenticated, save checkout intent and redirect to sign-in
    if (!user) {
      sessionStorage.setItem('checkoutIntent', JSON.stringify({
        tier: planSlug,
        interval: billingInterval,
      }));
      router.push(`/auth/sign-in?redirect=${encodeURIComponent('/pricing')}`);
      return;
    }

    setCheckoutLoading(planSlug);
    try {
      const url = await startCheckout(planSlug, billingInterval);
      window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
      setCheckoutLoading(null);
    }
  };

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
                You&apos;re on a {trial.tier?.charAt(0).toUpperCase()}{trial.tier?.slice(1)} trial
              </p>
              <p className="text-xs text-on-surface-variant">
                {trial.daysRemaining} days remaining. Upgrade to keep your access.
              </p>
            </div>
          </div>
        )}

        {/* Billing Interval Toggle */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <span className={`text-sm ${billingInterval === 'month' ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>Monthly</span>
          <button
            onClick={() => setBillingInterval(prev => prev === 'month' ? 'year' : 'month')}
            className={`relative w-12 h-6 rounded-full transition-colors ${billingInterval === 'year' ? 'bg-primary' : 'bg-outline-variant'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${billingInterval === 'year' ? 'translate-x-6' : ''}`} />
          </button>
          <span className={`text-sm ${billingInterval === 'year' ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>
            Yearly <span className="text-green-600 font-medium text-xs">Save 17%</span>
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = effectiveTier === plan.slug;
            const isTrialPlan = trial?.active && trial.tier === plan.slug;
            const isHighlighted = plan.slug === 'pro';
            const rawMonthly = Number(plan.price_monthly) || 0;
            const rawYearly = Number(plan.price_yearly) || 0;
            const effectiveMonthly = billingInterval === 'year' && rawYearly > 0
              ? Math.round(rawYearly / 12)
              : rawMonthly;
            const priceDisplay = effectiveMonthly === 0 ? '$0' : `$${Math.round(effectiveMonthly)}`;
            const periodDisplay = effectiveMonthly === 0 ? 'forever' : '/month';
            const ctaText = plan.slug === 'enterprise' ? 'Contact Sales' : plan.slug === 'pro' ? 'Start Free Trial' : 'Get Started';

            // Build feature bullet list from DB features
            const featureBullets: string[] = [];
            const has = (slug: string) => plan.features.some(f => f.slug === slug);
            const catCount = (cat: string) => plan.features.filter(f => f.category === cat).length;
            const metricCount = catCount('metrics');

            if (plan.slug === 'free') {
              featureBullets.push('Interactive market maps');
              featureBullets.push('National & state-level data');
              featureBullets.push(`${metricCount}+ real estate metrics`);
              featureBullets.push('Historical trends & charts');
              const reportLimit = plan.features.find(f => f.slug === 'preview_reports_limit');
              if (reportLimit && typeof reportLimit.value === 'number' && reportLimit.value > 0) {
                featureBullets.push(`${reportLimit.value} preview reports`);
              }
            } else if (plan.slug === 'pro') {
              featureBullets.push('Everything in Free, plus:');
              if (has('geo_county') || has('geo_zip')) featureBullets.push('Metro, county, and ZIP code data');
              if (has('metric_homeready_score') || has('metric_investoredge_score') || has('metric_market_health_score')) featureBullets.push('PropertyIQ composite scores');
              if (has('feature_ai_insights')) featureBullets.push('AI market analysis');
              if (has('feature_reports')) featureBullets.push('Unlimited AI reports');
              if (has('feature_export_csv')) featureBullets.push('CSV data export');
              if (has('feature_analytics_assistant')) featureBullets.push('Analytics assistant');
            } else if (plan.slug === 'enterprise') {
              featureBullets.push('Everything in Pro, plus:');
              if (has('scenario_modeling_enabled')) featureBullets.push('Scenario modeling');
              if (has('statistical_deep_dives')) featureBullets.push('Statistical deep dives');
              featureBullets.push('Team & brokerage features');
              featureBullets.push('Priority support');
            } else {
              // Unknown tier — generic fallback
              featureBullets.push(`${plan.features.length} features included`);
            }

            return (
              <div
                key={plan.slug}
                className={`
                  relative rounded-xl p-4 transition-all
                  ${isCurrentPlan
                    ? 'bg-primary-container border-2 border-primary shadow-lg ring-2 ring-primary/20'
                    : isHighlighted
                      ? 'bg-primary-container border-2 border-primary shadow-lg scale-[1.03]'
                      : 'bg-surface-container border border-outline-variant hover:border-primary/30'
                  }
                `}
              >
                {isCurrentPlan ? (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-green-600 text-white text-[11px] font-medium rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {isTrialPlan ? 'Trial Active' : 'Current Plan'}
                  </div>
                ) : isHighlighted && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-primary text-on-primary text-[11px] font-medium rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-4">
                  <h3 className={`text-base font-semibold mb-1 ${isHighlighted || isCurrentPlan ? 'text-on-primary-container' : 'text-on-surface'}`}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-3xl font-bold ${isHighlighted || isCurrentPlan ? 'text-on-primary-container' : 'text-on-surface'}`}>
                      {priceDisplay}
                    </span>
                    <span className={`text-xs ${isHighlighted || isCurrentPlan ? 'text-on-primary-container/70' : 'text-on-surface-variant'}`}>
                      {periodDisplay}
                    </span>
                  </div>
                  {billingInterval === 'year' && rawYearly > 0 && (
                    <p className={`text-[11px] mt-0.5 ${isHighlighted || isCurrentPlan ? 'text-on-primary-container/60' : 'text-on-surface-variant/60'}`}>
                      ${Math.round(rawYearly)}/year billed annually
                    </p>
                  )}
                  <p className={`text-xs mt-1 ${isHighlighted || isCurrentPlan ? 'text-on-primary-container/80' : 'text-on-surface-variant'}`}>
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-2 mb-4">
                  {featureBullets.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 text-primary`} />
                      <span className={`text-[13px] ${isHighlighted || isCurrentPlan ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrentPlan && !isTrialPlan ? (
                  <div className="block w-full text-center py-2 rounded-lg font-medium text-sm bg-surface-container-high text-on-surface-variant">
                    Current Plan
                  </div>
                ) : plan.slug === 'free' ? (
                  <a
                    href="/map"
                    className="block w-full text-center py-2 rounded-lg font-medium text-sm transition-colors bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                  >
                    Get Started
                  </a>
                ) : plan.slug === 'enterprise' ? (
                  <a
                    href="/about"
                    className="block w-full text-center py-2 rounded-lg font-medium text-sm transition-colors bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                  >
                    Contact Sales
                  </a>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.slug)}
                    disabled={checkoutLoading === plan.slug}
                    className={`
                      block w-full text-center py-2 rounded-lg font-medium text-sm transition-colors
                      ${isHighlighted || isCurrentPlan
                        ? 'bg-primary text-on-primary hover:bg-primary/90'
                        : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                      }
                      disabled:opacity-60 disabled:cursor-not-allowed
                    `}
                  >
                    {checkoutLoading === plan.slug ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting...
                      </span>
                    ) : isTrialPlan ? 'Upgrade Now' : ctaText}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Trial note */}
        {trialInfo?.is_enabled && (
          <p className="mt-5 text-center text-xs text-on-surface-variant">
            {trialInfo.duration_days}-day free trial on all paid plans. No credit card required.
            {' '}<a href="/about" className="text-primary hover:underline">Questions?</a>
          </p>
        )}

        {/* Scroll hint */}
        <div className="mt-8 flex flex-col items-center gap-1 text-on-surface-variant/50">
          <span className="text-[11px] uppercase tracking-widest font-medium">See what Pro unlocks</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      </div>

      {/* ================================================================= */}
      {/* FEATURE SHOWCASE — full-bleed background shift for visual weight  */}
      {/* ================================================================= */}
      <div className="bg-gradient-to-b from-surface via-surface-container-lowest to-surface-container mt-4">
        <div className="max-w-5xl mx-auto px-6 pt-12 pb-16">

          {/* Section header — editorial typography */}
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary mb-3">
              Why investors upgrade
            </p>
            <h2 className="font-[var(--font-source-serif)] text-3xl md:text-[2.5rem] font-bold text-on-surface leading-tight mb-4">
              The difference between guessing<br className="hidden md:block" /> and <em className="text-primary">knowing</em>
            </h2>
            <p className="text-sm text-on-surface-variant max-w-xl mx-auto leading-relaxed">
              Free gets you started. Pro gives you the edge that turns data into decisions.
              Here&apos;s exactly what changes.
            </p>
          </div>

          {/* ---- 1. AI MARKET ANALYSIS ---- */}
          <section id="ai-insights" className="scroll-mt-24 mb-20">
            <div className="mb-8">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">AI Market Analysis</h3>
                  <p className="text-xs text-on-surface-variant">Included with Pro</p>
                </div>
              </div>
              <ul className="space-y-1.5 text-[15px] text-on-surface-variant leading-relaxed">
                <li>Prices up, but inventory surging. Job growth strong, but affordability collapsing. <strong className="text-on-surface">60+ metrics that often contradict each other.</strong></li>
                <li>Our AI reads the full picture and tells you what it actually means.</li>
                <li className="text-on-surface font-medium">The kind of analysis that used to require a $500/hr market consultant. Yours for less than a dollar a day.</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Free — with deliberate "meh" styling */}
              <div className="rounded-xl border border-outline-variant bg-surface-container p-5 relative">
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/40 bg-surface-container-high px-2 py-0.5 rounded">Free</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-on-surface-variant/60" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">What you get today</span>
                </div>
                <div className="space-y-3 text-sm text-on-surface-variant leading-relaxed">
                  <div>
                    <span className="text-xs font-semibold text-on-surface/70 block mb-1">Affordability</span>
                    Nashville shows moderate conditions for homebuyers (HomeReady score: 62). The median listing price is $445K. You&apos;d need roughly $98K in annual income to afford a home here.
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-on-surface/70 block mb-1">Market Speed</span>
                    Homes in Nashville average 34 days on market. Inventory is up 12.3% year-over-year. The pending ratio sits at 38%, indicating moderate buyer activity.
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-outline-variant/20 text-[11px] text-on-surface-variant/40 italic">
                  Numbers without context. You have to figure out what they mean.
                </div>
              </div>

              {/* Pro — premium visual treatment */}
              <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-surface-container to-tertiary/[0.04] p-5 relative shadow-[0_2px_20px_-4px_rgba(103,80,164,0.12)]">
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center gap-1">
                    <Zap className="w-3 h-3" />Pro
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">What you&apos;re missing</span>
                </div>
                <div className="space-y-3 text-[13.5px] text-on-surface leading-relaxed">
                  <div>
                    <span className="text-xs font-bold block mb-1">Affordability</span>
                    Nashville&apos;s market presents a mixed affordability picture that <strong>rewards strategic timing</strong>. While $445K requires ~$98K income, the HomeReady score of 62 suggests the window hasn&apos;t closed. Key leverage point: the 4.2-year save-to-buy timeline is <em>compressing</em> as new construction in Antioch and Hermitage expands sub-$350K inventory. First-time buyers should watch the spring listings surge.
                  </div>
                  <div>
                    <span className="text-xs font-bold block mb-1">Market Speed</span>
                    The 34-day DOM <strong>masks meaningful divergence across price tiers</strong> — homes under $400K move in 18 days while $600K+ listings linger at 55+. The 12.3% inventory increase is heavily weighted toward new builds, not motivated sellers. The pending ratio has been climbing three consecutive months — <em>a leading indicator of tightening conditions</em>.
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-primary/10 flex items-center gap-1.5 text-[11px] text-primary/70 font-medium">
                  <Sparkles className="w-3 h-3" />
                  Actionable intelligence from 60+ data points, local news, and market signals
                </div>
              </div>
            </div>
          </section>

          {/* ---- 2. PROPERTYIQ SCORES ---- */}
          <section id="scores" className="scroll-mt-24 mb-20">
            <div className="mb-8">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">PropertyIQ Scores</h3>
                  <p className="text-xs text-on-surface-variant">34,000+ markets scored</p>
                </div>
              </div>
              <ul className="space-y-1.5 text-[15px] text-on-surface-variant leading-relaxed">
                <li>Raw metrics tell you <em>what happened</em>. Our scores tell you <strong className="text-on-surface">what&apos;s likely to happen next.</strong></li>
                <li>Designed to surface excess returns and flag excess risk.</li>
                <li className="text-on-surface font-medium">Every metro, county, and ZIP in the country — 34,000+ markets scored.</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Free */}
              <div className="rounded-xl border border-outline-variant bg-surface-container p-5 relative">
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/40 bg-surface-container-high px-2 py-0.5 rounded">Free</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-on-surface-variant/60" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">What you get today</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface-variant">Individual metrics (price, DOM, inventory)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface-variant">Year-over-year changes</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
                    <span className="text-on-surface-variant/50">No composite scoring</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
                    <span className="text-on-surface-variant/50">No grades or market rankings</span>
                  </div>
                </div>
                <div className="mt-4 bg-surface rounded-lg p-3">
                  <div className="text-[10px] font-medium text-on-surface-variant/50 uppercase tracking-wider mb-2">Nashville — what you see</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-on-surface-variant/50">Price</span>
                      <div className="font-semibold text-on-surface">$445K</div>
                    </div>
                    <div>
                      <span className="text-on-surface-variant/50">DOM</span>
                      <div className="font-semibold text-on-surface">34</div>
                    </div>
                    <div>
                      <span className="text-on-surface-variant/50">YoY</span>
                      <div className="font-semibold text-green-600">+3.2%</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/40 mt-2 italic">Is this good? Bad? Compared to what?</p>
                </div>
              </div>

              {/* Pro */}
              <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-surface-container to-tertiary/[0.04] p-5 relative shadow-[0_2px_20px_-4px_rgba(103,80,164,0.12)]">
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center gap-1">
                    <Zap className="w-3 h-3" />Pro
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">What you&apos;re missing</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface">34,000+ markets scored — metro, county, ZIP</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-surface"><strong>HomeReady</strong> — buyer opportunity rating</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-surface"><strong>InvestorEdge</strong> — investment return potential</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-surface"><strong>Market Health</strong> — stability &amp; downside risk</span>
                  </div>
                </div>
                <div className="mt-4 bg-surface rounded-lg p-3">
                  <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-2">Nashville — what you&apos;d see</div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-[10px] text-on-surface-variant/60">HomeReady</div>
                      <div className="text-xl font-bold text-on-surface leading-tight">62</div>
                      <div className="text-[10px] font-bold text-amber-600">B-</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-on-surface-variant/60">InvestorEdge</div>
                      <div className="text-xl font-bold text-on-surface leading-tight">74</div>
                      <div className="text-[10px] font-bold text-green-600">B+</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-on-surface-variant/60">Market Health</div>
                      <div className="text-xl font-bold text-on-surface leading-tight">68</div>
                      <div className="text-[10px] font-bold text-amber-600">B</div>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-outline-variant/20 flex justify-between items-center text-[11px]">
                    <span className="text-on-surface-variant">Historically, Score 80+ markets</span>
                    <span className="font-bold text-green-600">+12% excess returns</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---- 3. MARKET REPORTS ---- */}
          <section id="reports" className="scroll-mt-24 mb-20">
            <div className="mb-8">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Market Reports</h3>
                  <p className="text-xs text-on-surface-variant">Single-market or head-to-head comparison</p>
                </div>
              </div>
              <ul className="space-y-1.5 text-[15px] text-on-surface-variant leading-relaxed">
                <li>Metrics, scores, trends, and AI narratives pulled into one polished document.</li>
                <li>Focus on a single market or compare two head-to-head.</li>
                <li>Share with partners, lenders, or your team — looks like it came from a professional analyst.</li>
                <li className="text-on-surface font-medium">Institutional investors pay thousands for reports like these. Yours start at $29/month.</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Free/Pro */}
              <div className="rounded-xl border border-outline-variant bg-surface-container p-5 relative">
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/40 bg-surface-container-high px-2 py-0.5 rounded">Free</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-on-surface-variant/60" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">What you get today</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface-variant">Metrics, scores, and trend charts</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface-variant">Scoring breakdown tables</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface-variant">Market comparison data</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
                    <span className="text-on-surface-variant/50">No AI narratives or summaries</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
                    <span className="text-on-surface-variant/50">No executive summary</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
                    <span className="text-on-surface-variant/50">No investment thesis or risk assessment</span>
                  </div>
                </div>
                <p className="text-[10px] text-on-surface-variant/40 mt-4 italic">Data tables without the &ldquo;so what.&rdquo;</p>
              </div>

              {/* Pro */}
              <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-surface-container to-tertiary/[0.04] p-5 relative shadow-[0_2px_20px_-4px_rgba(103,80,164,0.12)]">
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center gap-1">
                    <Zap className="w-3 h-3" />Pro
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">What you&apos;re missing</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface">Everything in the data report</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-surface"><strong>Executive Summary</strong> — the bottom line, up front</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-surface"><strong>Investment Thesis</strong> — buy, hold, or walk away</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-surface"><strong>Risk Assessment</strong> — what could go wrong and how to hedge</span>
                  </div>
                </div>
                <div className="mt-4 bg-surface rounded-lg p-3 border border-dashed border-primary/15">
                  <p className="text-xs text-on-surface-variant italic leading-relaxed">
                    &ldquo;Nashville presents a compelling buy opportunity for mid-term investors. The combination of 2.8% job growth, sustained in-migration, and a HomeReady score trending upward from 58 to 62 over six months signals strengthening fundamentals. The primary risk — rising inventory — is concentrated in new construction above $500K, which doesn&apos;t threaten the core investment thesis at sub-$400K price points.&rdquo;
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary font-medium">Sample AI Executive Summary</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---- 4. GEOGRAPHIC DATA DEPTH ---- */}
          <section id="data-depth" className="scroll-mt-24 mb-12">
            <div className="mb-8">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">County &amp; ZIP Code Data</h3>
                  <p className="text-xs text-on-surface-variant">33,000+ additional markets unlocked</p>
                </div>
              </div>
              <ul className="space-y-1.5 text-[15px] text-on-surface-variant leading-relaxed">
                <li>A metro average tells you almost nothing about the ZIP code where you&apos;re actually buying.</li>
                <li><strong className="text-on-surface">Nashville metro looks moderate — but ZIP 37209 is appreciating at 5.1% with a 6.2% cap rate.</strong></li>
                <li>You&apos;d never see that without drilling down. Pro unlocks 3,000+ counties and 30,000+ ZIP codes.</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Free */}
              <div className="rounded-xl border border-outline-variant bg-surface-container p-5 relative">
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/40 bg-surface-container-high px-2 py-0.5 rounded">Free</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-on-surface-variant/60" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">What you get today</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface-variant">National overview &amp; state rankings</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface-variant">400+ metro-level dashboards</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
                    <span className="text-on-surface-variant/50">County data locked</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
                    <span className="text-on-surface-variant/50">ZIP code data locked</span>
                  </div>
                </div>
                <div className="mt-4 bg-surface rounded-lg p-3">
                  <div className="text-[10px] font-medium text-on-surface-variant/50 uppercase tracking-wider mb-2">You stop here</div>
                  <div className="text-center py-2">
                    <div className="text-xs text-on-surface-variant/60 mb-1">Nashville-Davidson MSA</div>
                    <div className="text-lg font-bold text-on-surface">$445K</div>
                    <div className="text-xs text-green-600 font-medium">+3.2% YoY</div>
                  </div>
                </div>
              </div>

              {/* Pro */}
              <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-surface-container to-tertiary/[0.04] p-5 relative shadow-[0_2px_20px_-4px_rgba(103,80,164,0.12)]">
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center gap-1">
                    <Zap className="w-3 h-3" />Pro
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">What you&apos;re missing</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface">Everything in Free</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface">3,000+ county dashboards</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface">30,000+ ZIP code dashboards</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-on-surface">Metro, county, and ZIP code investment analysis</span>
                  </div>
                </div>
                <div className="mt-4 bg-surface rounded-lg p-3">
                  <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-2">You drill all the way down</div>
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <span className="text-on-surface-variant/50">Nashville MSA</span>
                    <ArrowRight className="w-3 h-3 text-on-surface-variant/30" />
                    <span className="text-on-surface-variant/70">Davidson Co.</span>
                    <ArrowRight className="w-3 h-3 text-on-surface-variant/30" />
                    <span className="font-semibold text-primary">ZIP 37209</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <span className="text-on-surface-variant/60">Price</span>
                      <div className="font-bold text-on-surface">$389K</div>
                    </div>
                    <div className="text-center">
                      <span className="text-on-surface-variant/60">YoY</span>
                      <div className="font-bold text-green-600">+5.1%</div>
                    </div>
                    <div className="text-center">
                      <span className="text-on-surface-variant/60">Cap Rate</span>
                      <div className="font-bold text-primary">6.2%</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-primary/70 mt-2 font-medium text-center">
                    The deal is at the ZIP level. You just can&apos;t see it without Pro.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ---- BOTTOM CTA ---- */}
          <div className="text-center pt-8 pb-4 border-t border-outline-variant/15">
            <p className="text-on-surface font-semibold mb-1">
              Less than a dollar a day for an institutional-grade edge.
            </p>
            <p className="text-sm text-on-surface-variant mb-5">
              {trialInfo?.is_enabled ? `${trialInfo.duration_days}-day free trial. ` : ''}Cancel anytime. No credit card to start.
            </p>
            <button
              onClick={() => handleUpgrade('pro')}
              disabled={checkoutLoading === 'pro'}
              className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checkoutLoading === 'pro' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  Start Your Free Trial <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
