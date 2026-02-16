'use client';

import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import { formatMetricValue } from '@/lib/data';
import type { ReportInstance } from '../../../../types';

/**
 * Props for PrepObjectionHandlers section
 */
export interface PrepObjectionHandlersProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * An objection/response pair
 */
interface ObjectionItem {
  id: string;
  objection: string;
  response: string;
  dataPoints: string[];
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
 * Generate objection handlers backed by report data
 */
function generateObjections(report: ReportInstance): ObjectionItem[] {
  const objections: ObjectionItem[] = [];

  const medianPrice = getMetric(report, ['zhvi', 'home_value', 'median_listing_price']);
  const medianIncome = getMetric(report, ['median_income', 'median_household_income']);
  const yoyChange = getMetric(report, ['home_value_yoy', 'zhvi_yoy', 'price_yoy']);
  const dom = getMetric(report, ['days_on_market', 'median_dom', 'dom']);
  const inventory = getMetric(report, ['for_sale_inventory', 'active_listing_count', 'active_listings']);
  const priceCuts = getMetric(report, ['price_reduced_share', 'price_cut_pct']);
  const hotness = getMetric(report, ['hotness_score', 'market_hotness']);
  const forecast = getMetric(report, ['zhvf_1yr_pct', 'home_price_forecast']);
  const jobGrowth = getMetric(report, ['job_growth_yoy', 'job_growth']);
  const unemployment = getMetric(report, ['unemployment_rate', 'unemployment']);
  const newListings = getMetric(report, ['new_listing_count', 'new_listings']);
  const populationGrowth = getMetric(report, ['population_growth_yoy', 'population_growth']);

  // 1. "Prices are too high"
  {
    const dataPoints: string[] = [];
    let response = 'Price perception depends on context. ';

    if (medianPrice !== null && medianIncome !== null) {
      const ratio = medianPrice / medianIncome;
      response += `The price-to-income ratio here is ${ratio.toFixed(1)}x, `;
      response += ratio < 4
        ? 'which is within historically affordable ranges. '
        : 'but affordability programs and strategic timing can offset this. ';
      dataPoints.push(`Price-to-income: ${ratio.toFixed(1)}x`);
    }

    if (yoyChange !== null) {
      if (yoyChange < 0) {
        response += `Prices have actually declined ${Math.abs(yoyChange).toFixed(1)}% year-over-year, creating a potential buying window. `;
      } else if (yoyChange < 3) {
        response += `Price growth has moderated to just ${yoyChange.toFixed(1)}% YoY. `;
      } else {
        response += `While prices are up ${yoyChange.toFixed(1)}% YoY, strong markets reward early entry. `;
      }
      dataPoints.push(`YoY change: ${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}%`);
    }

    if (medianPrice !== null) {
      dataPoints.push(`Median price: ${formatMetricValue(medianPrice, 'currency')}`);
    }

    response += 'We can identify pockets of value and negotiate effectively based on current conditions.';

    objections.push({
      id: 'prices_too_high',
      objection: 'Prices are too high',
      response: response.trim(),
      dataPoints,
    });
  }

  // 2. "I should wait for prices to drop"
  {
    const dataPoints: string[] = [];
    let response = 'Timing the market is extremely difficult. ';

    if (forecast !== null) {
      if (forecast > 0) {
        response += `Current forecasts project ${forecast.toFixed(1)}% appreciation over the next year. Waiting could mean paying more. `;
      } else {
        response += `Forecasts suggest prices may soften by ${Math.abs(forecast).toFixed(1)}%, but interest rate changes could offset savings. `;
      }
      dataPoints.push(`12-month forecast: ${forecast >= 0 ? '+' : ''}${forecast.toFixed(1)}%`);
    }

    if (yoyChange !== null) {
      response += yoyChange > 0
        ? `Values have risen ${yoyChange.toFixed(1)}% over the past year. Every month of waiting costs potential equity. `
        : `Values have dipped ${Math.abs(yoyChange).toFixed(1)}%, but markets historically recover. Now could be the window. `;
      dataPoints.push(`Current YoY trend: ${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}%`);
    }

    if (hotness !== null) {
      dataPoints.push(`Market hotness: ${Math.round(hotness)}/100`);
    }

    response += 'The cost of renting while waiting often exceeds any potential savings from a market dip.';

    objections.push({
      id: 'wait_for_drop',
      objection: "I should wait for prices to drop",
      response: response.trim(),
      dataPoints,
    });
  }

  // 3. "There's nothing good on the market"
  {
    const dataPoints: string[] = [];
    let response = 'Inventory can seem limited, but the data tells a fuller story. ';

    if (inventory !== null) {
      response += `There are currently ${formatMetricValue(inventory, 'number')} active listings in this market. `;
      dataPoints.push(`Active listings: ${formatMetricValue(inventory, 'number')}`);
    }

    if (newListings !== null) {
      response += `New listings are coming on at a rate of ${formatMetricValue(newListings, 'number')} per month. `;
      dataPoints.push(`New listings: ${formatMetricValue(newListings, 'number')}/mo`);
    }

    response += 'I track every new listing daily and many homes never hit the major portals. ';
    response += 'Off-market opportunities and pre-market access can expand your options significantly.';

    objections.push({
      id: 'nothing_on_market',
      objection: "There's nothing good on the market",
      response: response.trim(),
      dataPoints,
    });
  }

  // 4. "The market is too competitive"
  {
    const dataPoints: string[] = [];
    let response = 'Competition levels vary more than headlines suggest. ';

    if (dom !== null) {
      response += dom > 30
        ? `Homes are averaging ${Math.round(dom)} days on market, which means there is time for strategic offers. `
        : `Yes, homes move in ${Math.round(dom)} days, but a strong strategy and pre-approval give you an edge. `;
      dataPoints.push(`Avg DOM: ${Math.round(dom)} days`);
    }

    if (priceCuts !== null) {
      response += `${formatMetricValue(priceCuts, 'percent')} of listings have reduced their asking price, which shows not everything gets instant offers. `;
      dataPoints.push(`Price reductions: ${formatMetricValue(priceCuts, 'percent')}`);
    }

    if (hotness !== null) {
      dataPoints.push(`Hotness score: ${Math.round(hotness)}/100`);
    }

    response += 'Strategic pricing, flexible terms, and quick due diligence can win even in competitive environments.';

    objections.push({
      id: 'too_competitive',
      objection: 'The market is too competitive',
      response: response.trim(),
      dataPoints,
    });
  }

  // 5. "Interest rates are too high"
  {
    const dataPoints: string[] = [];
    let response = 'Rate concerns are valid, but historical context is important. ';
    response += 'The long-term average for mortgage rates is around 7-8%. Current rates, while higher than 2020-2021 lows, are within normal ranges. ';

    if (medianPrice !== null) {
      response += `At the current median of ${formatMetricValue(medianPrice, 'currency')}, refinancing when rates drop could significantly lower payments. `;
      dataPoints.push(`Median price: ${formatMetricValue(medianPrice, 'currency')}`);
    }

    if (forecast !== null && forecast > 0) {
      response += `With ${forecast.toFixed(1)}% expected appreciation, the home value gain can outweigh rate costs. `;
      dataPoints.push(`Expected appreciation: +${forecast.toFixed(1)}%`);
    }

    response += '"Marry the house, date the rate" — you can always refinance, but you cannot undo a missed buying opportunity.';

    objections.push({
      id: 'rates_too_high',
      objection: 'Interest rates are too high',
      response: response.trim(),
      dataPoints,
    });
  }

  // 6. "I'm worried about the economy"
  {
    const dataPoints: string[] = [];
    let response = 'Economic caution is understandable. Let us look at local fundamentals. ';

    if (jobGrowth !== null) {
      response += jobGrowth > 0
        ? `Local job growth is positive at ${jobGrowth.toFixed(1)}%, which supports housing demand. `
        : `Job growth has been soft at ${jobGrowth.toFixed(1)}%, but real estate has historically been resilient. `;
      dataPoints.push(`Job growth: ${jobGrowth >= 0 ? '+' : ''}${jobGrowth.toFixed(1)}%`);
    }

    if (unemployment !== null) {
      response += `Unemployment stands at ${formatMetricValue(unemployment, 'percent')}, `;
      response += unemployment < 5
        ? 'which indicates a healthy labor market. '
        : 'and we should factor that into our strategy. ';
      dataPoints.push(`Unemployment: ${formatMetricValue(unemployment, 'percent')}`);
    }

    if (populationGrowth !== null && populationGrowth > 0) {
      response += `Population is growing at ${populationGrowth.toFixed(1)}%, which supports long-term demand. `;
      dataPoints.push(`Population growth: +${populationGrowth.toFixed(1)}%`);
    }

    response += 'Real estate is a long-term asset. Markets recover, and homeownership remains the primary wealth-building tool for most Americans.';

    objections.push({
      id: 'worried_economy',
      objection: "I'm worried about the economy",
      response: response.trim(),
      dataPoints,
    });
  }

  return objections;
}

/**
 * Single expandable objection card
 */
function ObjectionCard({
  item,
  isOpen,
  onToggle,
}: {
  item: ObjectionItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-[var(--report-radius-md)]"
      style={{
        backgroundColor: 'var(--report-cream)',
        border: '1px solid rgba(27, 46, 74, 0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Header - clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
        style={{
          padding: 'var(--report-space-md)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
        }}
        aria-expanded={isOpen}
        aria-controls={`objection-${item.id}`}
      >
        <p
          className="text-sm font-medium italic"
          style={{
            color: 'var(--report-stone)',
            margin: 0,
            flex: 1,
          }}
        >
          &ldquo;{item.objection}&rdquo;
        </p>
        {isOpen ? (
          <ChevronUp
            className="w-4 h-4 flex-shrink-0 ml-2"
            style={{ color: 'var(--report-stone-light)' }}
          />
        ) : (
          <ChevronDown
            className="w-4 h-4 flex-shrink-0 ml-2"
            style={{ color: 'var(--report-stone-light)' }}
          />
        )}
      </button>

      {/* Expandable content */}
      {isOpen && (
        <div
          id={`objection-${item.id}`}
          style={{
            padding: '0 var(--report-space-md) var(--report-space-md)',
            borderTop: '1px solid rgba(27, 46, 74, 0.04)',
            paddingTop: 'var(--report-space-md)',
          }}
        >
          {/* Response */}
          <p
            className="text-sm leading-relaxed"
            style={{
              color: 'var(--report-navy)',
              margin: 0,
              marginBottom: 'var(--report-space-sm)',
            }}
          >
            {item.response}
          </p>

          {/* Data points */}
          {item.dataPoints.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              style={{ marginTop: 'var(--report-space-sm)' }}
            >
              {item.dataPoints.map((dp, index) => (
                <span
                  key={index}
                  className="inline-flex items-center text-[0.6875rem] font-medium px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: 'white',
                    color: 'var(--report-navy)',
                    border: '1px solid rgba(27, 46, 74, 0.08)',
                  }}
                >
                  {dp}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PrepObjectionHandlers - Data-backed responses to common client objections
 *
 * Provides 4-6 common real estate objections with expandable, data-driven
 * responses. Each objection card shows the client question in quotes
 * and reveals a factual response with supporting data points when expanded.
 *
 * Uses the editorial design system from report-theme.css.
 */
export function PrepObjectionHandlers({
  report,
  className = '',
}: PrepObjectionHandlersProps): React.ReactElement {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const objections = generateObjections(report);

  // AI narrative
  const aiNarrative =
    report.ai_narrative?.prep_objections ??
    (report.ai_narratives?.prep_objections as string | string[] | undefined);

  const toggleObjection = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (objections.length === 0) {
    return (
      <SectionCard title="Objection Handlers" icon={Shield} className={className}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">
            Insufficient data to generate objection handlers for this area.
          </span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Objection Handlers" icon={Shield} className={className}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--report-space-sm)',
        }}
      >
        {objections.map((item) => (
          <ObjectionCard
            key={item.id}
            item={item}
            isOpen={openIds.has(item.id)}
            onToggle={() => toggleObjection(item.id)}
          />
        ))}
      </div>

      {/* AI Analysis */}
      {aiNarrative && (
        <div style={{ marginTop: 'var(--report-space-lg)' }}>
          <AIAnalysisBlock
            content={
              typeof aiNarrative === 'string'
                ? aiNarrative
                : Array.isArray(aiNarrative)
                ? aiNarrative
                : String(aiNarrative)
            }
            title="AI Objection Analysis"
            variant="insight"
          />
        </div>
      )}
    </SectionCard>
  );
}

export default PrepObjectionHandlers;
