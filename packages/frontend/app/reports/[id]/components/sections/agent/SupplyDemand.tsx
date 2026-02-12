'use client';

import React from 'react';
import { BarChart3, ArrowUp, ArrowDown, Minus, AlertTriangle, Package } from 'lucide-react';

import { SectionCard, MetricDisplay, TrendSparkline } from '../core';
import type { MetricTrend, TrendDirection } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

/**
 * Props for SupplyDemand section
 */
export interface SupplyDemandProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Metric configuration for supply/demand metrics
 */
interface MetricConfig {
  id: string;
  aliases: string[];
  label: string;
  description: string;
  /** How to interpret trend direction for market balance */
  balanceInterpretation: 'supply' | 'demand' | 'neutral';
}

/**
 * Supply and demand metrics configuration
 */
const SUPPLY_DEMAND_METRICS: MetricConfig[] = [
  {
    id: 'active_listing_count',
    aliases: ['for_sale_inventory', 'inventory', 'listing_count', 'active_listings'],
    label: 'Active Listings',
    description: 'Total homes currently for sale',
    balanceInterpretation: 'supply',
  },
  {
    id: 'new_listing_count',
    aliases: ['new_listings', 'new_inventory', 'listings_added'],
    label: 'New Listings',
    description: 'Newly listed homes this month',
    balanceInterpretation: 'supply',
  },
  {
    id: 'pending_listing_count',
    aliases: ['pending_listings', 'pending', 'under_contract', 'pending_sales'],
    label: 'Pending Sales',
    description: 'Homes under contract',
    balanceInterpretation: 'demand',
  },
  {
    id: 'months_of_supply',
    aliases: ['supply_months', 'inventory_months', 'absorption_rate'],
    label: 'Months of Supply',
    description: 'Time to sell current inventory',
    balanceInterpretation: 'supply',
  },
];

/**
 * Get a metric value trying the primary ID and aliases
 */
function getMetricValueWithAliases(
  report: ReportInstance,
  metricConfig: MetricConfig
): number | null {
  // Try primary ID first
  const primaryValue = getMetricWithAliases(report, metricConfig.id);
  if (primaryValue !== null) return primaryValue;

  // Try aliases
  for (const alias of metricConfig.aliases) {
    const aliasValue = getMetricWithAliases(report, alias);
    if (aliasValue !== null) return aliasValue;
  }

  return null;
}

/**
 * Get historical trend data for a metric
 */
function getMetricTrend(
  report: ReportInstance,
  metricConfig: MetricConfig
): MetricTrend | undefined {
  const historical = report.populated_data?.historical;
  if (!historical) return undefined;

  // Try primary ID and aliases
  const idsToTry = [metricConfig.id, ...metricConfig.aliases];

  for (const id of idsToTry) {
    const histData = historical[id];
    if (histData && histData.data && histData.data.length >= 2) {
      return {
        direction: histData.trend as TrendDirection,
        changePct: histData.change_pct,
        sparklineData: histData.data.map((d) => d.value),
      };
    }
  }

  return undefined;
}

/**
 * Calculate supply/demand balance indicator
 */
function calculateSupplyDemandBalance(
  activeListings: number | null,
  pendingSales: number | null,
  monthsOfSupply: number | null,
  activeListingsTrend: MetricTrend | undefined,
  pendingTrend: MetricTrend | undefined
): {
  balance: 'supply_heavy' | 'demand_heavy' | 'balanced';
  strength: 'strong' | 'moderate' | 'slight';
  label: string;
  description: string;
  color: string;
} {
  let supplyScore = 0;
  let factorsCount = 0;

  // Months of supply is the most direct indicator
  if (monthsOfSupply !== null) {
    factorsCount++;
    if (monthsOfSupply >= 6) supplyScore += 2; // Heavy supply
    else if (monthsOfSupply >= 4) supplyScore += 1; // Some supply
    else if (monthsOfSupply <= 2) supplyScore -= 2; // Heavy demand
    else if (monthsOfSupply <= 3) supplyScore -= 1; // Some demand
  }

  // Active listings trend
  if (activeListingsTrend) {
    factorsCount++;
    if (activeListingsTrend.changePct >= 20) supplyScore += 1;
    else if (activeListingsTrend.changePct <= -20) supplyScore -= 1;
  }

  // Pending sales trend (increasing pending = more demand)
  if (pendingTrend) {
    factorsCount++;
    if (pendingTrend.changePct >= 15) supplyScore -= 1;
    else if (pendingTrend.changePct <= -15) supplyScore += 1;
  }

  // Ratio of pending to active (higher ratio = more demand)
  if (activeListings !== null && pendingSales !== null && activeListings > 0) {
    const ratio = pendingSales / activeListings;
    factorsCount++;
    if (ratio >= 0.5) supplyScore -= 1; // High absorption
    else if (ratio <= 0.2) supplyScore += 1; // Low absorption
  }

  if (factorsCount === 0) {
    return {
      balance: 'balanced',
      strength: 'moderate',
      label: 'Balance Unknown',
      description: 'Insufficient data to assess supply/demand balance',
      color: 'var(--report-stone)',
    };
  }

  const normalizedScore = supplyScore / factorsCount;

  let balance: 'supply_heavy' | 'demand_heavy' | 'balanced';
  let strength: 'strong' | 'moderate' | 'slight';

  if (normalizedScore >= 1) {
    balance = 'supply_heavy';
    strength = 'strong';
  } else if (normalizedScore >= 0.5) {
    balance = 'supply_heavy';
    strength = 'moderate';
  } else if (normalizedScore >= 0.25) {
    balance = 'supply_heavy';
    strength = 'slight';
  } else if (normalizedScore <= -1) {
    balance = 'demand_heavy';
    strength = 'strong';
  } else if (normalizedScore <= -0.5) {
    balance = 'demand_heavy';
    strength = 'moderate';
  } else if (normalizedScore <= -0.25) {
    balance = 'demand_heavy';
    strength = 'slight';
  } else {
    balance = 'balanced';
    strength = 'moderate';
  }

  if (balance === 'supply_heavy') {
    return {
      balance,
      strength,
      label: `${strength.charAt(0).toUpperCase() + strength.slice(1)} Buyer's Advantage`,
      description: 'More inventory relative to buyer demand',
      color: 'var(--report-success)',
    };
  }
  if (balance === 'demand_heavy') {
    return {
      balance,
      strength,
      label: `${strength.charAt(0).toUpperCase() + strength.slice(1)} Seller's Advantage`,
      description: 'Strong buyer demand relative to available inventory',
      color: 'var(--report-warning)',
    };
  }
  return {
    balance,
    strength,
    label: 'Balanced Market',
    description: 'Supply and demand are relatively equal',
    color: 'var(--report-navy)',
  };
}

/**
 * Get trend arrow component
 */
function TrendArrow({ direction }: { direction: TrendDirection }) {
  if (direction === 'up') {
    return <ArrowUp className="w-4 h-4" style={{ color: 'var(--report-success)' }} />;
  }
  if (direction === 'down') {
    return <ArrowDown className="w-4 h-4" style={{ color: 'var(--report-error)' }} />;
  }
  return <Minus className="w-4 h-4" style={{ color: 'var(--report-stone)' }} />;
}

/**
 * SupplyDemand - Inventory dynamics section for agents
 *
 * Displays supply and demand indicators including:
 * - Active, new, and pending listings
 * - Months of supply
 * - Supply/demand balance indicator
 * - Trend analysis for each metric
 *
 * Uses the editorial design system from report-theme.css.
 */
export function SupplyDemand({
  report,
  className = '',
}: SupplyDemandProps): React.ReactElement {
  // Extract metric values
  const activeListings = getMetricValueWithAliases(report, SUPPLY_DEMAND_METRICS[0]);
  const newListings = getMetricValueWithAliases(report, SUPPLY_DEMAND_METRICS[1]);
  const pendingListings = getMetricValueWithAliases(report, SUPPLY_DEMAND_METRICS[2]);
  const monthsOfSupply = getMetricValueWithAliases(report, SUPPLY_DEMAND_METRICS[3]);

  // Get trends
  const activeListingsTrend = getMetricTrend(report, SUPPLY_DEMAND_METRICS[0]);
  const newListingsTrend = getMetricTrend(report, SUPPLY_DEMAND_METRICS[1]);
  const pendingTrend = getMetricTrend(report, SUPPLY_DEMAND_METRICS[2]);
  const monthsOfSupplyTrend = getMetricTrend(report, SUPPLY_DEMAND_METRICS[3]);

  // Check if we have any data
  const hasAnyData =
    activeListings !== null ||
    newListings !== null ||
    pendingListings !== null ||
    monthsOfSupply !== null;

  // Calculate supply/demand balance
  const balance = calculateSupplyDemandBalance(
    activeListings,
    pendingListings,
    monthsOfSupply,
    activeListingsTrend,
    pendingTrend
  );

  // If no data available, show unavailable state
  if (!hasAnyData) {
    return (
      <SectionCard title="Supply & Demand" icon={BarChart3} className={className}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">Supply and demand data is not available for this area.</span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Supply & Demand" icon={BarChart3} className={className}>
      {/* Balance Indicator */}
      <div
        className="rounded-[var(--report-radius-md)] p-5 mb-6"
        style={{
          backgroundColor:
            balance.balance === 'supply_heavy'
              ? 'var(--report-success-bg)'
              : balance.balance === 'demand_heavy'
              ? 'var(--report-warning-bg)'
              : 'var(--report-cream)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'white' }}
            >
              <Package className="w-6 h-6" style={{ color: balance.color }} />
            </div>
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wide mb-1"
                style={{ color: 'var(--report-stone-light)' }}
              >
                Supply/Demand Balance
              </p>
              <p className="text-xl font-semibold" style={{ color: balance.color }}>
                {balance.label}
              </p>
              <p className="text-sm" style={{ color: 'var(--report-stone)' }}>
                {balance.description}
              </p>
            </div>
          </div>

          {/* Months of supply callout */}
          {monthsOfSupply !== null && (
            <div className="text-right">
              <p
                className="text-xs font-medium uppercase tracking-wide mb-1"
                style={{ color: 'var(--report-stone-light)' }}
              >
                Months of Supply
              </p>
              <p
                className="text-2xl font-bold"
                style={{
                  color:
                    monthsOfSupply <= 3
                      ? 'var(--report-warning)'
                      : monthsOfSupply >= 6
                      ? 'var(--report-success)'
                      : 'var(--report-navy)',
                }}
              >
                {monthsOfSupply.toFixed(1)}
              </p>
              <p
                className="text-xs"
                style={{ color: 'var(--report-stone-light)' }}
              >
                {monthsOfSupply <= 3
                  ? 'Low inventory'
                  : monthsOfSupply >= 6
                  ? 'High inventory'
                  : 'Normal range'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--report-space-md)',
          marginBottom: 'var(--report-space-lg)',
        }}
      >
        <MetricDisplay
          metricId="active_listing_count"
          value={activeListings}
          label="Active Listings"
          trend={activeListingsTrend}
        />

        <MetricDisplay
          metricId="new_listing_count"
          value={newListings}
          label="New Listings"
          trend={newListingsTrend}
        />

        <MetricDisplay
          metricId="pending_listing_count"
          value={pendingListings}
          label="Pending Sales"
          trend={pendingTrend}
        />

        <MetricDisplay
          metricId="months_of_supply"
          value={monthsOfSupply}
          label="Months of Supply"
          trend={monthsOfSupplyTrend}
        />
      </div>

      {/* Trend Summary Table */}
      <div
        className="rounded-[var(--report-radius-md)] overflow-hidden mb-6"
        style={{
          backgroundColor: 'var(--report-cream)',
          border: '1px solid rgba(27, 46, 74, 0.06)',
        }}
      >
        <div
          style={{
            padding: 'var(--report-space-md)',
            borderBottom: '1px solid rgba(27, 46, 74, 0.06)',
          }}
        >
          <p className="report-label" style={{ margin: 0 }}>
            Metric Trends
          </p>
        </div>
        <div style={{ padding: 'var(--report-space-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--report-space-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--report-stone-light)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Metric
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: 'var(--report-space-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--report-stone-light)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Trend
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--report-space-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--report-stone-light)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Change
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--report-space-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--report-stone-light)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Impact
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { config: SUPPLY_DEMAND_METRICS[0], trend: activeListingsTrend, value: activeListings },
                { config: SUPPLY_DEMAND_METRICS[1], trend: newListingsTrend, value: newListings },
                { config: SUPPLY_DEMAND_METRICS[2], trend: pendingTrend, value: pendingListings },
                { config: SUPPLY_DEMAND_METRICS[3], trend: monthsOfSupplyTrend, value: monthsOfSupply },
              ]
                .filter(({ value }) => value !== null)
                .map(({ config, trend }) => {
                  const interpretation =
                    config.balanceInterpretation === 'supply'
                      ? trend?.direction === 'up'
                        ? 'Favors buyers'
                        : trend?.direction === 'down'
                        ? 'Favors sellers'
                        : 'Neutral'
                      : config.balanceInterpretation === 'demand'
                      ? trend?.direction === 'up'
                        ? 'Favors sellers'
                        : trend?.direction === 'down'
                        ? 'Favors buyers'
                        : 'Neutral'
                      : 'Neutral';

                  return (
                    <tr
                      key={config.id}
                      style={{ borderTop: '1px solid rgba(27, 46, 74, 0.04)' }}
                    >
                      <td
                        style={{
                          padding: 'var(--report-space-sm)',
                          fontSize: '0.875rem',
                          color: 'var(--report-navy)',
                        }}
                      >
                        {config.label}
                      </td>
                      <td style={{ padding: 'var(--report-space-sm)', textAlign: 'center' }}>
                        {trend ? (
                          <TrendArrow direction={trend.direction} />
                        ) : (
                          <span style={{ color: 'var(--report-stone-light)' }}>--</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: 'var(--report-space-sm)',
                          textAlign: 'right',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: trend
                            ? trend.changePct >= 0
                              ? 'var(--report-success)'
                              : 'var(--report-error)'
                            : 'var(--report-stone-light)',
                        }}
                      >
                        {trend
                          ? `${trend.changePct >= 0 ? '+' : ''}${trend.changePct.toFixed(1)}%`
                          : '--'}
                      </td>
                      <td
                        style={{
                          padding: 'var(--report-space-sm)',
                          fontSize: '0.8125rem',
                          color: 'var(--report-stone)',
                        }}
                      >
                        {trend ? interpretation : '--'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Balance Indicator */}
      <div
        className="rounded-[var(--report-radius-md)] p-4"
        style={{
          backgroundColor: 'var(--report-cream)',
          border: '1px solid rgba(27, 46, 74, 0.06)',
        }}
      >
        <p
          className="text-xs font-medium uppercase tracking-wide mb-3"
          style={{ color: 'var(--report-stone-light)' }}
        >
          Market Balance Indicator
        </p>
        <div style={{ position: 'relative' }}>
          {/* Balance bar */}
          <div
            style={{
              height: '8px',
              borderRadius: '4px',
              background: 'linear-gradient(to right, var(--report-success), var(--report-cream-dark), var(--report-warning))',
            }}
          />
          {/* Position indicator */}
          <div
            style={{
              position: 'absolute',
              top: '-4px',
              left:
                balance.balance === 'supply_heavy'
                  ? balance.strength === 'strong'
                    ? '10%'
                    : balance.strength === 'moderate'
                    ? '25%'
                    : '35%'
                  : balance.balance === 'demand_heavy'
                  ? balance.strength === 'strong'
                    ? '90%'
                    : balance.strength === 'moderate'
                    ? '75%'
                    : '65%'
                  : '50%',
              transform: 'translateX(-50%)',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: 'white',
              border: `3px solid ${balance.color}`,
              boxShadow: 'var(--report-shadow-md)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 'var(--report-space-sm)',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--report-success)',
              fontWeight: 500,
            }}
          >
            Buyer Advantage
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--report-stone-light)',
            }}
          >
            Balanced
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--report-warning)',
              fontWeight: 500,
            }}
          >
            Seller Advantage
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

export default SupplyDemand;
