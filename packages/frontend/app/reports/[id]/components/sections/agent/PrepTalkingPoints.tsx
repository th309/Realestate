'use client';

import React from 'react';
import { MessageSquare, AlertTriangle } from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import { formatMetricValue } from '@/lib/data';
import type { ReportInstance } from '../../../../types';

/**
 * Props for PrepTalkingPoints section
 */
export interface PrepTalkingPointsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * A single talking point with a bold key phrase and script
 */
interface TalkingPointItem {
  keyPhrase: string;
  script: string;
}

/**
 * Helper to safely get a metric value trying common aliases
 */
function getMetric(
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
 * Generate buyer-focused talking points from market data
 */
function generateBuyerPoints(report: ReportInstance): TalkingPointItem[] {
  const points: TalkingPointItem[] = [];

  const dom = getMetric(report, ['days_on_market', 'median_dom', 'dom']);
  const inventory = getMetric(report, ['for_sale_inventory', 'active_listing_count', 'active_listings']);
  const priceCuts = getMetric(report, ['price_reduced_share', 'price_cut_pct']);
  const yoyChange = getMetric(report, ['home_value_yoy', 'zhvi_yoy', 'price_yoy']);
  const medianPrice = getMetric(report, ['zhvi', 'home_value', 'median_listing_price']);
  const saleToList = getMetric(report, ['sale_to_list_ratio', 'sale_to_list']);
  const forecast = getMetric(report, ['zhvf_1yr_pct', 'home_price_forecast']);

  // Fast market = urgency
  if (dom !== null && dom <= 25) {
    points.push({
      keyPhrase: 'Act fast',
      script: `homes in this area sell in an average of ${Math.round(dom)} days. We need to be ready to move quickly when the right property comes up.`,
    });
  }

  // Slow market = more time
  if (dom !== null && dom > 45) {
    points.push({
      keyPhrase: 'You have leverage',
      script: `homes are sitting for ${Math.round(dom)} days on average, which gives us room to negotiate and take our time with inspections.`,
    });
  }

  // High inventory = options
  if (inventory !== null && inventory > 100) {
    points.push({
      keyPhrase: 'Plenty of options',
      script: `with ${formatMetricValue(inventory, 'number')} active listings, you have a wide selection to choose from. We can be selective.`,
    });
  }

  // Price cuts = opportunity
  if (priceCuts !== null && priceCuts > 15) {
    points.push({
      keyPhrase: 'Sellers are adjusting',
      script: `${formatMetricValue(priceCuts, 'percent')} of listings have reduced their price. This signals motivated sellers and opportunity to negotiate.`,
    });
  }

  // Declining prices = buying opportunity
  if (yoyChange !== null && yoyChange < 0) {
    points.push({
      keyPhrase: 'Prices are correcting',
      script: `values have come down ${Math.abs(yoyChange).toFixed(1)}% year-over-year. This could be an opportunity to buy below the recent peak.`,
    });
  }

  // Below-list sales
  if (saleToList !== null) {
    const ratioPercent = saleToList > 2 ? saleToList : saleToList * 100;
    if (ratioPercent < 98) {
      points.push({
        keyPhrase: 'Negotiation room exists',
        script: `homes are selling at ${ratioPercent.toFixed(1)}% of list price on average. That means we can realistically offer below asking.`,
      });
    }
  }

  // Positive forecast
  if (forecast !== null && forecast > 2) {
    points.push({
      keyPhrase: 'Values are projected to rise',
      script: `forecasts show ${forecast.toFixed(1)}% appreciation over the next year. Buying now means building equity from day one.`,
    });
  }

  // Affordability reference
  if (medianPrice !== null) {
    points.push({
      keyPhrase: 'Market entry point',
      script: `the median home price is ${formatMetricValue(medianPrice, 'currency')}. Let me show you how that compares to surrounding areas.`,
    });
  }

  return points.slice(0, 5);
}

/**
 * Generate seller-focused talking points from market data
 */
function generateSellerPoints(report: ReportInstance): TalkingPointItem[] {
  const points: TalkingPointItem[] = [];

  const hotness = getMetric(report, ['hotness_score', 'market_hotness']);
  const priceCuts = getMetric(report, ['price_reduced_share', 'price_cut_pct']);
  const dom = getMetric(report, ['days_on_market', 'median_dom', 'dom']);
  const yoyChange = getMetric(report, ['home_value_yoy', 'zhvi_yoy', 'price_yoy']);
  const saleToList = getMetric(report, ['sale_to_list_ratio', 'sale_to_list']);
  const pendingRatio = getMetric(report, ['pending_ratio', 'pending_listing_count']);
  const medianPrice = getMetric(report, ['zhvi', 'home_value', 'median_listing_price']);

  // Hot market
  if (hotness !== null && hotness >= 60) {
    points.push({
      keyPhrase: 'Market is hot',
      script: `with a hotness score of ${Math.round(hotness)}, buyer demand is strong. This is an excellent time to list and capture maximum value.`,
    });
  }

  // Low price cuts = strong demand
  if (priceCuts !== null && priceCuts < 15) {
    points.push({
      keyPhrase: 'Strong demand signal',
      script: `only ${formatMetricValue(priceCuts, 'percent')} of sellers are reducing prices. Buyers are meeting the market, and well-priced homes move fast.`,
    });
  }

  // Fast sales
  if (dom !== null && dom <= 25) {
    points.push({
      keyPhrase: 'Homes are moving quickly',
      script: `the average time on market is just ${Math.round(dom)} days. Price it right and expect strong interest within the first week.`,
    });
  }

  // Price appreciation
  if (yoyChange !== null && yoyChange > 0) {
    points.push({
      keyPhrase: 'Values are up',
      script: `home values have increased ${yoyChange.toFixed(1)}% year-over-year. Your equity position is stronger than it was 12 months ago.`,
    });
  }

  // At or above list price sales
  if (saleToList !== null) {
    const ratioPercent = saleToList > 2 ? saleToList : saleToList * 100;
    if (ratioPercent >= 99.5) {
      points.push({
        keyPhrase: 'Full asking price expected',
        script: `homes are selling at ${ratioPercent.toFixed(1)}% of list price. Buyers are paying full asking or above, which validates aggressive pricing.`,
      });
    }
  }

  // Current median as pricing anchor
  if (medianPrice !== null) {
    points.push({
      keyPhrase: 'Pricing benchmark',
      script: `the median sale price in this market is ${formatMetricValue(medianPrice, 'currency')}. We will position your home competitively against comparable properties.`,
    });
  }

  return points.slice(0, 5);
}

/**
 * PrepTalkingPoints - AI-generated talking point scripts for buyer and seller conversations
 *
 * Provides separate buyer and seller talking points, each backed by actual
 * market data. Designed for agent meeting prep. Points start with a bold key
 * phrase followed by a natural-language script the agent can adapt.
 *
 * Uses the editorial design system from report-theme.css.
 */
export function PrepTalkingPoints({
  report,
  className = '',
}: PrepTalkingPointsProps): React.ReactElement {
  const buyerPoints = generateBuyerPoints(report);
  const sellerPoints = generateSellerPoints(report);

  // AI narrative
  const aiNarrative =
    report.ai_narrative?.prep_talking_points ??
    (report.ai_narratives?.prep_talking_points as string | string[] | undefined);

  const hasAnyContent =
    buyerPoints.length > 0 || sellerPoints.length > 0 || aiNarrative;

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--report-space-lg)' }}>
        {/* Buyer Talking Points */}
        {buyerPoints.length > 0 && (
          <div>
            <div
              className="flex items-center gap-2"
              style={{ marginBottom: 'var(--report-space-sm)' }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--report-navy)' }}
              />
              <p
                className="text-sm font-semibold uppercase tracking-wide"
                style={{
                  color: 'var(--report-navy)',
                  fontFamily: 'var(--report-font-display)',
                  margin: 0,
                }}
              >
                Buyer Talking Points
              </p>
            </div>
            <div
              className="rounded-[var(--report-radius-md)]"
              style={{
                backgroundColor: 'var(--report-cream)',
                border: '1px solid rgba(27, 46, 74, 0.06)',
                padding: 'var(--report-space-md)',
              }}
            >
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--report-space-sm)',
                }}
              >
                {buyerPoints.map((point, index) => (
                  <li
                    key={index}
                    className="text-sm leading-relaxed"
                    style={{
                      color: 'var(--report-navy)',
                      paddingLeft: 'var(--report-space-sm)',
                      borderLeft: '3px solid var(--report-navy)',
                    }}
                  >
                    <strong>{point.keyPhrase}</strong> &mdash; {point.script}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Seller Talking Points */}
        {sellerPoints.length > 0 && (
          <div>
            <div
              className="flex items-center gap-2"
              style={{ marginBottom: 'var(--report-space-sm)' }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--report-gold)' }}
              />
              <p
                className="text-sm font-semibold uppercase tracking-wide"
                style={{
                  color: 'var(--report-gold)',
                  fontFamily: 'var(--report-font-display)',
                  margin: 0,
                }}
              >
                Seller Talking Points
              </p>
            </div>
            <div
              className="rounded-[var(--report-radius-md)]"
              style={{
                backgroundColor: 'var(--report-cream)',
                border: '1px solid rgba(27, 46, 74, 0.06)',
                padding: 'var(--report-space-md)',
              }}
            >
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--report-space-sm)',
                }}
              >
                {sellerPoints.map((point, index) => (
                  <li
                    key={index}
                    className="text-sm leading-relaxed"
                    style={{
                      color: 'var(--report-navy)',
                      paddingLeft: 'var(--report-space-sm)',
                      borderLeft: '3px solid var(--report-gold)',
                    }}
                  >
                    <strong>{point.keyPhrase}</strong> &mdash; {point.script}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {aiNarrative && (
          <AIAnalysisBlock
            content={
              typeof aiNarrative === 'string'
                ? aiNarrative
                : Array.isArray(aiNarrative)
                ? aiNarrative
                : String(aiNarrative)
            }
            title="AI-Generated Talking Points"
            variant="recommendation"
          />
        )}
      </div>
    </SectionCard>
  );
}

export default PrepTalkingPoints;
