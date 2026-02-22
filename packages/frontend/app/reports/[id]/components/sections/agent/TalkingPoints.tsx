'use client';

import React from 'react';
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  Sparkles,
} from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import { formatMetricValue, getMetricFormat } from '@/lib/data';
import type { ReportInstance } from '../../../../types';

/**
 * Props for TalkingPoints section
 */
export interface TalkingPointsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Types of talking points
 */
type PointType = 'positive' | 'cautionary' | 'neutral';

/**
 * Talking point structure
 */
interface TalkingPoint {
  type: PointType;
  title: string;
  content: string;
  stat?: string;
}

/**
 * Get metric value with fallback aliases
 */
function getMetricWithFallbacks(
  report: ReportInstance,
  metricIds: string[]
): number | null {
  for (const id of metricIds) {
    const value = getMetricWithAliases(report, id);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Format a metric value for display in talking points
 */
function formatStat(metricId: string, value: number | null): string {
  if (value === null) return '\u2014';
  const format = getMetricFormat(metricId);
  return formatMetricValue(value, format);
}

/**
 * Generate talking points based on report data
 */
function generateTalkingPoints(report: ReportInstance): TalkingPoint[] {
  const points: TalkingPoint[] = [];

  // Get key metrics
  const homeValue = getMetricWithFallbacks(report, ['home_value', 'zhvi', 'median_home_value']);
  const listingPrice = getMetricWithFallbacks(report, ['listing_price', 'median_listing_price']);
  const daysOnMarket = getMetricWithFallbacks(report, ['days_on_market', 'median_dom', 'dom']);
  const activeListings = getMetricWithFallbacks(report, ['active_listing_count', 'active_listings', 'inventory']);
  const yoyChange = getMetricWithFallbacks(report, ['zhvi_yoy', 'home_value_yoy', 'price_yoy']);
  const forecast = getMetricWithFallbacks(report, ['zhvf_1yr_pct', 'home_price_forecast']);
  const saleToListRatio = getMetricWithFallbacks(report, ['sale_to_list_ratio', 'sale_to_list']);
  const priceCutPct = getMetricWithFallbacks(report, ['price_cut_pct', 'price_reduced_share']);
  const monthsOfSupply = getMetricWithFallbacks(report, ['months_of_supply', 'supply_months']);
  const hotnessScore = getMetricWithFallbacks(report, ['hotness_score', 'market_hotness']);

  // Home Value talking point
  if (homeValue !== null) {
    const formattedValue = formatStat('home_value', homeValue);
    if (yoyChange !== null) {
      if (yoyChange >= 5) {
        points.push({
          type: 'positive',
          title: 'Strong Home Value Growth',
          content: `Median home values are at ${formattedValue}, up ${yoyChange.toFixed(1)}% year-over-year. This demonstrates strong market momentum and equity growth potential.`,
          stat: `+${yoyChange.toFixed(1)}% YoY`,
        });
      } else if (yoyChange >= 0) {
        points.push({
          type: 'neutral',
          title: 'Stable Home Values',
          content: `Median home values are at ${formattedValue}, with ${yoyChange.toFixed(1)}% year-over-year growth. The market shows stability without overheating.`,
          stat: `${yoyChange.toFixed(1)}% YoY`,
        });
      } else {
        points.push({
          type: 'cautionary',
          title: 'Home Values Adjusting',
          content: `Median home values are at ${formattedValue}, down ${Math.abs(yoyChange).toFixed(1)}% year-over-year. This creates potential buying opportunities at corrected prices.`,
          stat: `${yoyChange.toFixed(1)}% YoY`,
        });
      }
    } else {
      points.push({
        type: 'neutral',
        title: 'Current Home Values',
        content: `The median home value in this market is ${formattedValue}. Compare this to nearby areas and your client's budget range.`,
        stat: formattedValue,
      });
    }
  }

  // Market Speed talking point
  if (daysOnMarket !== null) {
    const formatted = formatStat('days_on_market', daysOnMarket);
    if (daysOnMarket <= 21) {
      points.push({
        type: 'cautionary',
        title: 'Fast-Moving Market',
        content: `Homes are selling in just ${formatted} days on average. Prepare buyers for quick decisions and ensure financing is pre-approved.`,
        stat: `${Math.round(daysOnMarket)} days`,
      });
    } else if (daysOnMarket <= 45) {
      points.push({
        type: 'neutral',
        title: 'Moderate Market Pace',
        content: `Average time on market is ${formatted} days, giving buyers reasonable time to evaluate while maintaining market activity.`,
        stat: `${Math.round(daysOnMarket)} days`,
      });
    } else {
      points.push({
        type: 'positive',
        title: 'More Time for Buyers',
        content: `With ${formatted} days on market, buyers have more time for due diligence and negotiation. Less pressure to rush decisions.`,
        stat: `${Math.round(daysOnMarket)} days`,
      });
    }
  }

  // Inventory talking point
  if (monthsOfSupply !== null) {
    if (monthsOfSupply <= 3) {
      points.push({
        type: 'cautionary',
        title: 'Limited Inventory',
        content: `Only ${monthsOfSupply.toFixed(1)} months of supply available. Competition is high, and sellers have leverage. Prepare for possible multiple offer situations.`,
        stat: `${monthsOfSupply.toFixed(1)} months`,
      });
    } else if (monthsOfSupply <= 6) {
      points.push({
        type: 'neutral',
        title: 'Balanced Inventory',
        content: `${monthsOfSupply.toFixed(1)} months of supply indicates a balanced market. Neither buyers nor sellers have a strong advantage.`,
        stat: `${monthsOfSupply.toFixed(1)} months`,
      });
    } else {
      points.push({
        type: 'positive',
        title: 'Strong Inventory Levels',
        content: `${monthsOfSupply.toFixed(1)} months of supply means plenty of options for buyers. This creates negotiating power and room for contingencies.`,
        stat: `${monthsOfSupply.toFixed(1)} months`,
      });
    }
  } else if (activeListings !== null) {
    points.push({
      type: 'neutral',
      title: 'Current Inventory',
      content: `There are ${formatStat('active_listing_count', activeListings)} active listings in this market. Review comparable properties to find the best fit.`,
      stat: formatStat('active_listing_count', activeListings),
    });
  }

  // Price Negotiation talking point
  if (saleToListRatio !== null) {
    // Normalize to percentage if needed
    const ratioPercent = saleToListRatio > 2 ? saleToListRatio : saleToListRatio * 100;
    if (ratioPercent >= 100) {
      points.push({
        type: 'cautionary',
        title: 'Competitive Pricing',
        content: `Homes are selling at ${ratioPercent.toFixed(1)}% of list price. Buyers should be prepared to offer at or above asking. Strategic bidding is essential.`,
        stat: `${ratioPercent.toFixed(1)}%`,
      });
    } else if (ratioPercent >= 97) {
      points.push({
        type: 'neutral',
        title: 'Normal Pricing Dynamics',
        content: `Homes are selling at ${ratioPercent.toFixed(1)}% of list price. Some room for negotiation exists, typically ${(100 - ratioPercent).toFixed(1)}% below asking.`,
        stat: `${ratioPercent.toFixed(1)}%`,
      });
    } else {
      points.push({
        type: 'positive',
        title: 'Negotiation Opportunity',
        content: `Homes are selling at ${ratioPercent.toFixed(1)}% of list price. Buyers have solid leverage for price negotiation and concessions.`,
        stat: `${ratioPercent.toFixed(1)}%`,
      });
    }
  }

  // Price Cuts talking point
  if (priceCutPct !== null && priceCutPct >= 15) {
    points.push({
      type: 'positive',
      title: 'Seller Price Reductions',
      content: `${priceCutPct.toFixed(0)}% of listings have reduced their price. This indicates sellers are becoming more motivated and realistic about market conditions.`,
      stat: `${priceCutPct.toFixed(0)}% w/ cuts`,
    });
  }

  // Forecast talking point
  if (forecast !== null) {
    if (forecast >= 5) {
      points.push({
        type: 'positive',
        title: 'Strong Growth Forecast',
        content: `Home values are forecasted to increase ${forecast.toFixed(1)}% over the next 12 months. Buying now could mean immediate equity gains.`,
        stat: `+${forecast.toFixed(1)}%`,
      });
    } else if (forecast >= 0) {
      points.push({
        type: 'neutral',
        title: 'Stable Outlook',
        content: `Forecasts project ${forecast.toFixed(1)}% appreciation over the next year. Stable conditions support long-term investment strategies.`,
        stat: `+${forecast.toFixed(1)}%`,
      });
    } else {
      points.push({
        type: 'cautionary',
        title: 'Price Adjustment Expected',
        content: `Forecasts suggest ${Math.abs(forecast).toFixed(1)}% price decline possible. Consider this when evaluating offer price and timing.`,
        stat: `${forecast.toFixed(1)}%`,
      });
    }
  }

  // Market Heat talking point
  if (hotnessScore !== null) {
    if (hotnessScore >= 75) {
      points.push({
        type: 'cautionary',
        title: 'Hot Market',
        content: `Market hotness score of ${Math.round(hotnessScore)} indicates intense competition. Buyers should expect to move quickly with strong offers.`,
        stat: `${Math.round(hotnessScore)}/100`,
      });
    } else if (hotnessScore <= 30) {
      points.push({
        type: 'positive',
        title: 'Cooling Market',
        content: `Market hotness score of ${Math.round(hotnessScore)} suggests reduced competition. More favorable conditions for patient, strategic buyers.`,
        stat: `${Math.round(hotnessScore)}/100`,
      });
    }
  }

  return points;
}

/**
 * Get icon for talking point type
 */
function getPointIcon(type: PointType) {
  switch (type) {
    case 'positive':
      return <CheckCircle className="w-5 h-5" style={{ color: 'var(--report-success)' }} />;
    case 'cautionary':
      return <AlertTriangle className="w-5 h-5" style={{ color: 'var(--report-warning)' }} />;
    default:
      return <Info className="w-5 h-5" style={{ color: 'var(--report-navy)' }} />;
  }
}

/**
 * Get background color for talking point type
 */
function getPointBackground(type: PointType): string {
  switch (type) {
    case 'positive':
      return 'var(--report-success-bg)';
    case 'cautionary':
      return 'var(--report-warning-bg)';
    default:
      return 'var(--report-cream)';
  }
}

/**
 * Get border color for talking point type
 */
function getPointBorderColor(type: PointType): string {
  switch (type) {
    case 'positive':
      return 'var(--report-success)';
    case 'cautionary':
      return 'var(--report-warning)';
    default:
      return 'var(--report-stone-light)';
  }
}

/**
 * TalkingPoints - Agent talking points section
 *
 * Provides AI-generated and data-driven bullet points for client conversations:
 * - Key market stats formatted for easy reference
 * - Positive indicators to highlight
 * - Cautionary points to address proactively
 *
 * Uses the editorial design system from report-theme.css.
 */
export function TalkingPoints({
  report,
  className = '',
}: TalkingPointsProps): React.ReactElement {
  // Generate data-driven talking points
  const talkingPoints = generateTalkingPoints(report);

  // Get AI-generated narratives
  const aiTalkingPoints =
    report.ai_narrative?.talking_points ||
    report.ai_narratives?.talking_points ||
    report.ai_narratives?.agent_summary;

  const aiMarketSummary =
    report.ai_narrative?.market_summary ||
    report.ai_narratives?.market_summary;

  // Separate points by type
  const positivePoints = talkingPoints.filter((p) => p.type === 'positive');
  const cautionaryPoints = talkingPoints.filter((p) => p.type === 'cautionary');
  const neutralPoints = talkingPoints.filter((p) => p.type === 'neutral');

  // Check if we have any content
  const hasAnyContent =
    talkingPoints.length > 0 || aiTalkingPoints || aiMarketSummary;

  if (!hasAnyContent) {
    return (
      <SectionCard title="Talking Points" icon={MessageSquare} className={className}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">
            Insufficient data to generate talking points for this area.
          </span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Talking Points" icon={MessageSquare} className={className}>
      {/* Quick Stats Reference */}
      {talkingPoints.length > 0 && (
        <div
          className="rounded-[var(--report-radius-md)] p-4 mb-6"
          style={{
            backgroundColor: 'var(--report-cream)',
            border: '1px solid rgba(27, 46, 74, 0.06)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex items-center gap-1 text-[0.6875rem] font-medium tracking-wide uppercase text-[var(--report-stone-light)] bg-white px-2 py-1 rounded-full"
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              <span>Quick Stats</span>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 'var(--report-space-md)',
            }}
          >
            {talkingPoints.slice(0, 6).map((point, index) =>
              point.stat ? (
                <div key={index} className="text-center">
                  <p
                    className="text-lg font-bold"
                    style={{
                      color:
                        point.type === 'positive'
                          ? 'var(--report-success)'
                          : point.type === 'cautionary'
                          ? 'var(--report-warning)'
                          : 'var(--report-navy)',
                    }}
                  >
                    {point.stat}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    {point.title}
                  </p>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* AI-Generated Talking Points */}
      {aiTalkingPoints && (
        <div style={{ marginBottom: 'var(--report-space-lg)' }}>
          <AIAnalysisBlock
            title="Key Client Talking Points"
            content={
              typeof aiTalkingPoints === 'string'
                ? aiTalkingPoints
                : Array.isArray(aiTalkingPoints)
                ? aiTalkingPoints
                : String(aiTalkingPoints)
            }
            variant="recommendation"
          />
        </div>
      )}

      {/* Positive Points */}
      {positivePoints.length > 0 && (
        <div style={{ marginBottom: 'var(--report-space-lg)' }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--report-success)' }} />
            <p className="report-label" style={{ margin: 0, color: 'var(--report-success)' }}>
              Positive Indicators
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--report-space-sm)' }}>
            {positivePoints.map((point, index) => (
              <div
                key={index}
                className="rounded-[var(--report-radius-md)]"
                style={{
                  padding: 'var(--report-space-md)',
                  backgroundColor: getPointBackground(point.type),
                  borderLeft: `4px solid ${getPointBorderColor(point.type)}`,
                }}
              >
                <div className="flex items-start gap-3">
                  {getPointIcon(point.type)}
                  <div style={{ flex: 1 }}>
                    <p
                      className="font-semibold text-sm mb-1"
                      style={{ color: 'var(--report-navy)' }}
                    >
                      {point.title}
                    </p>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--report-stone)', margin: 0 }}
                    >
                      {point.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cautionary Points */}
      {cautionaryPoints.length > 0 && (
        <div style={{ marginBottom: 'var(--report-space-lg)' }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4" style={{ color: 'var(--report-warning)' }} />
            <p className="report-label" style={{ margin: 0, color: 'var(--report-warning)' }}>
              Points to Address
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--report-space-sm)' }}>
            {cautionaryPoints.map((point, index) => (
              <div
                key={index}
                className="rounded-[var(--report-radius-md)]"
                style={{
                  padding: 'var(--report-space-md)',
                  backgroundColor: getPointBackground(point.type),
                  borderLeft: `4px solid ${getPointBorderColor(point.type)}`,
                }}
              >
                <div className="flex items-start gap-3">
                  {getPointIcon(point.type)}
                  <div style={{ flex: 1 }}>
                    <p
                      className="font-semibold text-sm mb-1"
                      style={{ color: 'var(--report-navy)' }}
                    >
                      {point.title}
                    </p>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--report-stone)', margin: 0 }}
                    >
                      {point.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Neutral/Informational Points */}
      {neutralPoints.length > 0 && (
        <div style={{ marginBottom: aiMarketSummary ? 'var(--report-space-lg)' : 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4" style={{ color: 'var(--report-navy)' }} />
            <p className="report-label" style={{ margin: 0 }}>
              Additional Context
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--report-space-sm)' }}>
            {neutralPoints.map((point, index) => (
              <div
                key={index}
                className="rounded-[var(--report-radius-md)]"
                style={{
                  padding: 'var(--report-space-md)',
                  backgroundColor: getPointBackground(point.type),
                  borderLeft: `4px solid ${getPointBorderColor(point.type)}`,
                }}
              >
                <div className="flex items-start gap-3">
                  {getPointIcon(point.type)}
                  <div style={{ flex: 1 }}>
                    <p
                      className="font-semibold text-sm mb-1"
                      style={{ color: 'var(--report-navy)' }}
                    >
                      {point.title}
                    </p>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--report-stone)', margin: 0 }}
                    >
                      {point.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Market Summary */}
      {aiMarketSummary && (
        <AIAnalysisBlock
          title="Market Summary"
          content={typeof aiMarketSummary === 'string' ? aiMarketSummary : String(aiMarketSummary)}
          variant="summary"
        />
      )}
    </SectionCard>
  );
}

export default TalkingPoints;
