'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  DollarSign,
  Clock,
  TrendingUp,
  Wallet,
  BarChart3,
  Key,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import {
  fetchMarketAnalysis,
  type MarketAnalysisSection,
  type MarketAnalysisResult,
} from '@/lib/data';
import { useEntitlements } from '@/lib/entitlements';

interface AIMarketAnalysisProps {
  geoType: string;
  geoId: string;
  marketName: string;
  view: 'homebuyer' | 'investor';
  metrics: Record<string, { value: number | null; formattedValue: string; percentChange: number | null }>;
  scores: {
    homeready: { score: number; grade: string };
    investoredge: { score: number; grade: string };
    markethealth: { score: number; grade: string };
  };
  lastUpdated: string;
}

const HOMEBUYER_ICONS = [DollarSign, Clock, TrendingUp];
const INVESTOR_ICONS = [Wallet, BarChart3, Key];

// ---------------------------------------------------------------------------
// Template generator (client-side, no API calls)
// Mirrors backend generateFallback() logic
// ---------------------------------------------------------------------------

type MetricMap = AIMarketAnalysisProps['metrics'];
type ScoreMap = AIMarketAnalysisProps['scores'];

function generateTemplateAnalysis(
  marketName: string,
  view: 'homebuyer' | 'investor',
  metrics: MetricMap,
  scores: ScoreMap,
): MarketAnalysisSection[] {
  const val = (key: string): number | null => metrics[key]?.value ?? null;
  const fmt = (key: string): string | null => metrics[key]?.formattedValue ?? null;
  const chg = (key: string): number | null => metrics[key]?.percentChange ?? null;

  if (view === 'homebuyer') {
    const hs = scores.homeready;
    const scoreDesc = hs.score >= 70 ? 'favorable' : hs.score >= 50 ? 'moderate' : 'challenging';

    const affordParts = [`${marketName} shows ${scoreDesc} conditions for homebuyers (HomeReady score: ${hs.score}).`];
    if (fmt('listing_price')) affordParts.push(`The median listing price is ${fmt('listing_price')}.`);
    if (fmt('income_to_buy')) affordParts.push(`You'd need roughly ${fmt('income_to_buy')} in annual income to afford a home here.`);
    const yts = val('years_to_save');
    if (yts != null) affordParts.push(`At current savings rates, expect about ${yts.toFixed(1)} years to save for a down payment.`);

    const speedParts: string[] = [];
    const dom = val('days_on_market');
    if (dom != null) speedParts.push(`Homes in ${marketName} average ${Math.round(dom)} days on market.`);
    const invChg = chg('for_sale_inventory');
    if (invChg != null) speedParts.push(`Inventory is ${invChg > 0 ? 'up' : 'down'} ${Math.abs(invChg).toFixed(1)}% year-over-year.`);
    const pr = val('pending_ratio');
    if (pr != null) speedParts.push(`The pending ratio sits at ${(pr * 100).toFixed(0)}%, indicating ${pr > 0.4 ? 'strong' : 'moderate'} buyer activity.`);
    if (speedParts.length === 0) speedParts.push(`Market pace data for ${marketName} is currently limited.`);

    const priceParts: string[] = [];
    if (fmt('home_value')) priceParts.push(`Current median home value: ${fmt('home_value')}.`);
    const hvYoy = val('home_value_yoy');
    if (hvYoy != null) priceParts.push(`Values are ${hvYoy >= 0 ? 'up' : 'down'} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`);
    const hv5yr = val('home_value_5yr');
    if (hv5yr != null) priceParts.push(`The 5-year annualized growth rate is ${hv5yr.toFixed(1)}%.`);
    const pcPct = val('price_cut_pct');
    if (pcPct != null) priceParts.push(`${pcPct.toFixed(0)}% of listings have price reductions.`);
    if (priceParts.length === 0) priceParts.push(`Price trend data for ${marketName} is currently limited.`);

    return [
      { title: 'Affordability', analysis: affordParts.join(' ') },
      { title: 'Market Speed', analysis: speedParts.join(' ') },
      { title: 'Price Trajectory', analysis: priceParts.join(' ') },
    ];
  }

  // Investor
  const ie = scores.investoredge;
  const scoreDesc = ie.score >= 70 ? 'strong' : ie.score >= 50 ? 'moderate' : 'limited';

  const cfParts = [`${marketName} shows ${scoreDesc} investment potential (InvestorEdge score: ${ie.score}).`];
  const cr = val('cap_rate');
  if (cr != null) cfParts.push(`Cap rates are around ${cr.toFixed(1)}%, indicating ${cr >= 6 ? 'solid cash flow' : cr >= 4 ? 'moderate returns' : 'appreciation-focused'} potential.`);
  if (fmt('rent_index')) cfParts.push(`Median rents at ${fmt('rent_index')}/month.`);
  const gy = val('gross_yield');
  if (gy != null) cfParts.push(`Gross yield: ${gy.toFixed(1)}%.`);

  const growParts: string[] = [];
  const hvYoy = val('home_value_yoy');
  if (hvYoy != null) growParts.push(`Property values are ${hvYoy >= 0 ? 'up' : 'down'} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`);
  const hv5yr = val('home_value_5yr');
  if (hv5yr != null) growParts.push(`5-year annualized growth: ${hv5yr.toFixed(1)}%.`);
  const popG = val('population_growth');
  if (popG != null) growParts.push(`Population growth of ${popG.toFixed(1)}% supports demand.`);
  const jobG = val('job_growth');
  if (jobG != null) growParts.push(`Job growth: ${jobG.toFixed(1)}%.`);
  if (growParts.length === 0) growParts.push(`Growth data for ${marketName} is currently limited.`);

  const liqParts: string[] = [];
  const domVal = val('days_on_market');
  if (domVal != null) liqParts.push(`Homes sell in an average of ${Math.round(domVal)} days.`);
  const invChg = chg('for_sale_inventory');
  if (invChg != null) liqParts.push(`Inventory ${invChg > 0 ? 'rising' : 'falling'} at ${Math.abs(invChg).toFixed(1)}% YoY.`);
  const pr = val('pending_ratio');
  if (pr != null) liqParts.push(`Pending ratio of ${(pr * 100).toFixed(0)}% suggests ${pr > 0.4 ? 'healthy' : 'softer'} demand.`);
  liqParts.push(`Market Health score: ${scores.markethealth.score}/100.`);

  return [
    { title: 'Cash Flow Potential', analysis: cfParts.join(' ') },
    { title: 'Value Growth', analysis: growParts.join(' ') },
    { title: 'Liquidity & Demand', analysis: liqParts.join(' ') },
  ];
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonBlock({ delay }: { delay: number }) {
  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      <div className="h-5 w-48 bg-on-surface/8 rounded-lg animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-on-surface/6 rounded animate-pulse" />
        <div className="h-4 w-full bg-on-surface/6 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-on-surface/6 rounded animate-pulse" />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AIMarketAnalysis({
  geoType,
  geoId,
  marketName,
  view,
  metrics,
  scores,
  lastUpdated,
}: AIMarketAnalysisProps) {
  const { canAccess } = useEntitlements();
  const aiEnabled = canAccess('feature', 'ai_insights');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MarketAnalysisResult | null>(null);

  // Track whether we've already fetched for this geoId to avoid re-fetches
  const fetchedRef = useRef<string | null>(null);

  const doFetch = useCallback(async (metricsSnapshot: typeof metrics) => {
    setLoading(true);
    setError(null);

    try {
      const compactMetrics: Record<string, { value: number | null; formatted: string; change: number | null }> = {};
      for (const [key, card] of Object.entries(metricsSnapshot)) {
        if (card.value != null) {
          compactMetrics[key] = {
            value: card.value,
            formatted: card.formattedValue,
            change: card.percentChange,
          };
        }
      }

      const result = await fetchMarketAnalysis(geoType, geoId, {
        geoName: marketName,
        metrics: compactMetrics,
        scores,
        lastUpdated,
      });

      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
      fetchedRef.current = null;
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoType, geoId]);

  // Only fetch if AI is enabled
  useEffect(() => {
    if (!aiEnabled) return;
    const hasMetrics = Object.values(metrics).some(m => m.value != null);
    if (hasMetrics && fetchedRef.current !== geoId) {
      fetchedRef.current = geoId;
      doFetch(metrics);
    }
  }, [geoId, doFetch, metrics, aiEnabled]);

  // Reset fetch ref when AI gets disabled (tier change in dev tools)
  useEffect(() => {
    if (!aiEnabled) {
      fetchedRef.current = null;
      setAnalysis(null);
      setLoading(false);
      setError(null);
    }
  }, [aiEnabled]);

  // Determine sections to show
  let sections: MarketAnalysisSection[] | null = null;
  if (aiEnabled && analysis) {
    sections = view === 'homebuyer' ? analysis.homebuyer : analysis.investor;
  } else if (!aiEnabled) {
    const hasMetrics = Object.values(metrics).some(m => m.value != null);
    if (hasMetrics) {
      sections = generateTemplateAnalysis(marketName, view, metrics, scores);
    }
  }

  const icons = view === 'homebuyer' ? HOMEBUYER_ICONS : INVESTOR_ICONS;

  const formattedDate = analysis?.generatedAt
    ? new Date(analysis.generatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : lastUpdated
      ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null;

  // Header config based on mode
  const HeaderIcon = aiEnabled ? Sparkles : BarChart3;
  const headerTitle = aiEnabled ? 'AI Market Analysis' : 'Market Overview';
  const headerSubtitle = aiEnabled ? 'Powered by PropertyIQ' : 'Data Summary';
  const containerClass = aiEnabled
    ? 'bg-gradient-to-br from-primary/5 via-surface-container to-tertiary/5 rounded-2xl border border-primary/20 overflow-hidden'
    : 'bg-surface-container rounded-2xl border border-outline-variant/30 overflow-hidden';
  const iconBgClass = aiEnabled ? 'bg-primary/15' : 'bg-on-surface/8';
  const iconColorClass = aiEnabled ? 'text-primary' : 'text-on-surface-variant';

  return (
    <motion.div
      className={containerClass}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${iconBgClass}`}>
            <HeaderIcon className={`w-5 h-5 ${iconColorClass}`} />
          </div>
          <div>
            <h3 className="font-semibold text-on-surface">{headerTitle}</h3>
            <p className="text-xs text-on-surface-variant">{headerSubtitle}</p>
          </div>
        </div>
        {formattedDate && (
          <span className="text-xs text-on-surface-variant/70">Data as of {formattedDate}</span>
        )}
      </div>

      {/* Content */}
      <div className="px-6 pb-4 space-y-5">
        {aiEnabled && loading && (
          <>
            <SkeletonBlock delay={0} />
            <SkeletonBlock delay={0.1} />
            <SkeletonBlock delay={0.2} />
          </>
        )}

        {aiEnabled && error && !loading && (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-on-surface-variant/50 mx-auto mb-3" />
            <p className="text-sm text-on-surface-variant mb-3">Unable to generate analysis</p>
            <button
              onClick={() => {
                fetchedRef.current = geoId;
                doFetch(metrics);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-full transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}

        {!(aiEnabled && loading) && !(aiEnabled && error && !loading) && sections && sections.map((section, i) => {
          const Icon = icons[i] || (aiEnabled ? Sparkles : BarChart3);
          return (
            <motion.div
              key={`${view}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.4 }}
            >
              <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${aiEnabled ? 'bg-primary/10' : 'bg-on-surface/6'}`}>
                  <Icon className={`w-4 h-4 ${aiEnabled ? 'text-primary' : 'text-on-surface-variant'}`} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-on-surface mb-1">
                    {section.title}
                  </h4>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {section.analysis}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer: AI disclaimer OR upgrade nudge */}
      {aiEnabled ? (
        <div className="px-6 py-3 border-t border-outline-variant/20 bg-surface-container/50">
          <p className="text-[11px] text-on-surface-variant/50 leading-relaxed">
            AI-generated analysis may contain errors. Verify all information independently before making decisions.
          </p>
        </div>
      ) : (
        <div className="px-6 py-3 border-t border-outline-variant/20 bg-surface-container/50">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-on-surface-variant/50 leading-relaxed">
              Basic data summary based on available metrics.
            </p>
            <Link
              href="/pricing#ai-insights"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0 ml-3"
            >
              Unlock AI insights <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}
