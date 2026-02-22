'use client';

import React from 'react';
import {
  MapPin,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Home,
  Briefcase,
  Calendar,
  AlertTriangle,
  Sparkles,
  type LucideIcon
} from 'lucide-react';
import { SectionProps } from '../../types';
import { SectionCard } from '../core/SectionCard';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';
import { TrendSparkline } from '../core/TrendSparkline';

interface MarketData {
  id: string;
  name: string;
  metrics: Record<string, number | string | null>;
  scores?: Record<string, number>;
  historical?: Record<string, {
    data: Array<{ date: string; value: number }>;
    trend: 'up' | 'down' | 'stable';
    change_pct: number;
  }>;
}

interface KeyMetric {
  id: string;
  label: string;
  icon: LucideIcon;
  format: 'currency' | 'percent' | 'number' | 'days';
  higherIsBetter?: boolean;
}

const HOMEBUYER_METRICS: KeyMetric[] = [
  { id: 'zhvi', label: 'Median Home Price', icon: Home, format: 'currency' },
  { id: 'price_yoy', label: 'Price YoY Change', icon: TrendingUp, format: 'percent', higherIsBetter: true },
  { id: 'zhvf_growth', label: 'Price Forecast (1yr)', icon: Calendar, format: 'percent', higherIsBetter: true },
  { id: 'affordability_index', label: 'Affordability Index', icon: DollarSign, format: 'number', higherIsBetter: true },
  { id: 'days_on_market', label: 'Days on Market', icon: Calendar, format: 'days', higherIsBetter: false },
  { id: 'inventory_level', label: 'Months of Supply', icon: Home, format: 'number' },
];

const INVESTOR_METRICS: KeyMetric[] = [
  { id: 'zhvi', label: 'Median Home Price', icon: Home, format: 'currency' },
  { id: 'cap_rate', label: 'Cap Rate', icon: DollarSign, format: 'percent', higherIsBetter: true },
  { id: 'rent_yield', label: 'Gross Yield', icon: TrendingUp, format: 'percent', higherIsBetter: true },
  { id: 'rent_growth_yoy', label: 'Rent Growth YoY', icon: TrendingUp, format: 'percent', higherIsBetter: true },
  { id: 'zhvf_growth', label: 'Price Forecast (1yr)', icon: Calendar, format: 'percent', higherIsBetter: true },
  { id: 'rent_to_price', label: 'Rent-to-Price Ratio', icon: DollarSign, format: 'percent', higherIsBetter: true },
];

/**
 * MarketDeepDive - Full market analysis section
 *
 * Part 2 of the redesigned comparison report.
 * Shows detailed analysis for each market in the comparison.
 */
export function MarketDeepDive({ section, report }: SectionProps) {
  const isInvestor = report.user_type === 'investor';
  const metrics = isInvestor ? INVESTOR_METRICS : HOMEBUYER_METRICS;
  const scoreType = isInvestor ? 'investoredge' : 'homeready';
  const scoreLabel = isInvestor ? 'InvestorEdge' : 'HomeReady';

  // Build market data list (use comparisons record keyed by geo ID)
  const comparisons = report.populated_data?.comparisons;
  const comparisonGeos = report.comparison_geographies ?? [];

  const markets: MarketData[] = [
    {
      id: report.primary_geography_id,
      name: report.primary_geography_name,
      metrics: report.populated_data?.current || {},
      scores: {
        [scoreType]: isInvestor ? report.investoredge_score : report.homeready_score,
      } as Record<string, number>,
      historical: report.populated_data?.historical,
    },
    ...comparisonGeos.map(geo => {
      const comp = comparisons?.[geo.id];
      return {
        id: geo.id,
        name: comp?.geography?.name ?? geo.name,
        metrics: (comp?.current ?? {}) as Record<string, number | string | null>,
        scores: (comp?.scores ?? {}) as Record<string, number>,
        historical: comp?.historical,
      };
    }),
  ];

  // Get AI-generated risks and opportunities
  const aiNarratives = report.ai_narratives || report.ai_narrative || {};
  const risksOpportunities = aiNarratives.risks_opportunities as Record<string, {
    risks: string[];
    opportunities: string[];
  }> | undefined;

  return (
    <div className="space-y-8">
      {markets.map((market, marketIndex) => {
        const marketRisksOpps = risksOpportunities?.[market.id] || {
          risks: [],
          opportunities: [],
        };

        const score = market.scores?.[scoreType];

        return (
          <div
            key={market.id}
            className="report-section report-animate-in"
            style={{ animationDelay: `${marketIndex * 0.1}s` }}
          >
            {/* Market Header */}
            <header className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-xl">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="report-heading-md">{market.name}</h2>
                <p className="text-sm text-on-surface-variant">Deep Dive Analysis</p>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score Card */}
              <div className="bg-surface-container rounded-xl p-6 border border-outline-variant">
                <h3 className="text-sm font-semibold text-on-surface mb-4">
                  {scoreLabel} Score
                </h3>
                <div className="flex justify-center">
                  {score !== undefined && score !== null ? (
                    <ScoreDisplay
                      value={score}
                      size={120}
                      strokeWidth={8}
                      showGrade={true}
                      showLabel={true}
                    />
                  ) : (
                    <div className="w-[120px] h-[120px] flex items-center justify-center bg-surface-container-high rounded-full">
                      <span className="text-on-surface-variant text-sm">No Score</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="lg:col-span-2 bg-surface-container rounded-xl p-6 border border-outline-variant">
                <h3 className="text-sm font-semibold text-on-surface mb-4">
                  Key Metrics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {metrics.map(metric => {
                    const value = market.metrics[metric.id] as number | null;
                    const historical = market.historical?.[metric.id];

                    return (
                      <div key={metric.id} className="p-3 bg-surface rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <metric.icon className="w-3.5 h-3.5 text-on-surface-variant" />
                          <span className="text-xs text-on-surface-variant truncate">
                            {metric.label}
                          </span>
                        </div>

                        <div className="flex items-end justify-between">
                          <span className="text-lg font-semibold text-on-surface">
                            {formatValue(value, metric.format)}
                          </span>

                          {historical && (
                            <div className="flex items-center gap-1">
                              {historical.trend === 'up' ? (
                                <TrendingUp className="w-3 h-3 text-green-500" />
                              ) : historical.trend === 'down' ? (
                                <TrendingDown className="w-3 h-3 text-red-500" />
                              ) : null}
                              <span className={`text-xs ${
                                historical.trend === 'up'
                                  ? metric.higherIsBetter !== false ? 'text-green-500' : 'text-red-500'
                                  : historical.trend === 'down'
                                    ? metric.higherIsBetter !== false ? 'text-red-500' : 'text-green-500'
                                    : 'text-on-surface-variant'
                              }`}>
                                {historical.change_pct >= 0 ? '+' : ''}{historical.change_pct.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Mini Sparkline */}
                        {historical?.data && historical.data.length > 0 && (
                          <div className="mt-2">
                            <TrendSparkline
                              data={historical.data.slice(-12).map(d => d.value)}
                              trend={historical.trend}
                              changePct={historical.change_pct}
                              width={60}
                              height={20}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Risks & Opportunities */}
            {(marketRisksOpps.risks.length > 0 || marketRisksOpps.opportunities.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {/* Opportunities */}
                {marketRisksOpps.opportunities.length > 0 && (
                  <div className="p-5 bg-green-500/5 rounded-xl border border-green-500/20">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-green-600 mb-3">
                      <Sparkles className="w-4 h-4" />
                      Opportunities
                    </h4>
                    <ul className="space-y-2">
                      {marketRisksOpps.opportunities.slice(0, 3).map((opp, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                          <span className="text-green-500 mt-0.5">+</span>
                          {opp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risks */}
                {marketRisksOpps.risks.length > 0 && (
                  <div className="p-5 bg-amber-500/5 rounded-xl border border-amber-500/20">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-600 mb-3">
                      <AlertTriangle className="w-4 h-4" />
                      Risks to Watch
                    </h4>
                    <ul className="space-y-2">
                      {marketRisksOpps.risks.slice(0, 3).map((risk, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                          <span className="text-amber-500 mt-0.5">!</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatValue(value: number | null | undefined, format: string): string {
  if (value === null || value === undefined) return '\u2014';

  switch (format) {
    case 'currency':
      if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
      if (value >= 1000) return `$${Math.round(value / 1000)}K`;
      return `$${value.toFixed(0)}`;

    case 'percent':
      return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

    case 'days':
      return `${Math.round(value)} days`;

    default:
      return value.toFixed(1);
  }
}

export default MarketDeepDive;
