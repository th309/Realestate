'use client';

import React from 'react';
import { Map, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';

import { SectionCard, MetricsRow, AIAnalysisBlock } from '../core';
import type { MetricItem } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';
import type { MetricFormat } from '@/lib/data';

/**
 * Props for PrepCompetitiveContext section
 */
export interface PrepCompetitiveContextProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Metric definition for competitive comparison
 */
interface ComparisonMetric {
  metricId: string;
  aliases: string[];
  label: string;
  format: MetricFormat;
  /** Whether higher local values are "good" (true) or "bad" (false) */
  higherIsBetter: boolean;
}

/**
 * Metrics to compare against national benchmarks
 */
const COMPARISON_METRICS: ComparisonMetric[] = [
  {
    metricId: 'zhvi',
    aliases: ['home_value', 'median_listing_price'],
    label: 'Median Price',
    format: 'currency',
    higherIsBetter: false, // neutral — context dependent
  },
  {
    metricId: 'days_on_market',
    aliases: ['median_dom', 'dom'],
    label: 'Days on Market',
    format: 'days',
    higherIsBetter: false, // lower DOM is typically more active
  },
  {
    metricId: 'hotness_score',
    aliases: ['market_hotness'],
    label: 'Hotness Score',
    format: 'number',
    higherIsBetter: true, // higher = more demand
  },
  {
    metricId: 'home_value_yoy',
    aliases: ['zhvi_yoy', 'price_yoy'],
    label: 'Price Growth',
    format: 'percent',
    higherIsBetter: true, // positive growth is generally good
  },
];

/**
 * Get a metric value trying primary ID and aliases
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
 * Get national benchmark for a metric
 */
function getNationalBenchmark(
  report: ReportInstance,
  metricId: string,
  aliases: string[]
): number | null {
  const benchmarks =
    report.populated_data?.benchmarks?.national ??
    (report.populated_data as any)?.national_benchmarks;

  if (!benchmarks) return null;

  const idsToTry = [metricId, ...aliases];
  for (const id of idsToTry) {
    if (benchmarks[id] !== undefined && benchmarks[id] !== null) {
      return Number(benchmarks[id]);
    }
  }
  return null;
}

/**
 * Determine if local value is above or below national for a given metric
 */
function getComparison(
  local: number,
  national: number,
  metric: ComparisonMetric
): 'above' | 'below' | 'similar' {
  const diff = ((local - national) / national) * 100;

  // Within 5% = similar
  if (Math.abs(diff) < 5) return 'similar';

  // For DOM: local < national means faster market (could be strength or weakness depending on context)
  if (metric.metricId === 'days_on_market') {
    return local < national ? 'below' : 'above';
  }

  return local > national ? 'above' : 'below';
}

/**
 * Classify whether being "above" or "below" national is a strength or weakness
 */
function isStrength(
  comparison: 'above' | 'below' | 'similar',
  metric: ComparisonMetric
): boolean | null {
  if (comparison === 'similar') return null;

  // DOM: below national = faster market = strength for sellers, varies for buyers
  if (metric.metricId === 'days_on_market') {
    return comparison === 'below'; // Faster than national is a strength
  }

  if (metric.higherIsBetter) {
    return comparison === 'above';
  }

  // For metrics where lower is better
  return comparison === 'below';
}

/**
 * PrepCompetitiveContext - Regional competitive comparison for agent prep
 *
 * Shows how local market metrics compare against national benchmarks.
 * Includes a metrics row with benchmark values and a strengths/weaknesses
 * summary in a simple 2-column layout.
 *
 * Uses the editorial design system from report-theme.css.
 */
export function PrepCompetitiveContext({
  report,
  className = '',
}: PrepCompetitiveContextProps): React.ReactElement {
  // Build comparison data
  const comparisons = COMPARISON_METRICS.map((metric) => {
    const local = getMetric(report, [metric.metricId, ...metric.aliases]);
    const national = getNationalBenchmark(report, metric.metricId, metric.aliases);

    return {
      metric,
      local,
      national,
      comparison: local !== null && national !== null
        ? getComparison(local, national, metric)
        : null,
    };
  });

  // Filter to those with data
  const withData = comparisons.filter((c) => c.local !== null);
  const withBenchmarks = comparisons.filter(
    (c) => c.local !== null && c.national !== null && c.comparison !== null
  );

  // Build MetricsRow items
  const metricsRowItems: MetricItem[] = withData.map((c) => ({
    label: c.metric.label,
    value: c.local,
    format: c.metric.format,
    benchmark: c.national !== null
      ? { label: 'National', value: c.national }
      : undefined,
  }));

  // Classify strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const comp of withBenchmarks) {
    const strong = isStrength(comp.comparison!, comp.metric);
    if (strong === true) {
      strengths.push(comp.metric.label);
    } else if (strong === false) {
      weaknesses.push(comp.metric.label);
    }
  }

  // AI narrative
  const aiNarrative =
    report.ai_narrative?.prep_competitive ??
    (report.ai_narratives?.prep_competitive as string | string[] | undefined);

  const hasAnyData = withData.length > 0;

  if (!hasAnyData) {
    return (
      <SectionCard title="Competitive Context" icon={Map} className={className}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">
            Competitive context data is not available for this area.
          </span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Competitive Context" icon={Map} className={className}>
      {/* Metrics with national benchmarks */}
      {metricsRowItems.length > 0 && (
        <div style={{ marginBottom: 'var(--report-space-lg)' }}>
          <MetricsRow metrics={metricsRowItems} />
        </div>
      )}

      {/* Strengths vs Weaknesses - 2 column layout */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--report-space-md)',
            marginBottom: aiNarrative ? 'var(--report-space-lg)' : 0,
          }}
        >
          {/* Strengths / Above Average */}
          <div
            className="rounded-[var(--report-radius-md)]"
            style={{
              padding: 'var(--report-space-md)',
              backgroundColor: 'var(--report-success-bg)',
              border: '1px solid rgba(27, 46, 74, 0.04)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <ArrowUp className="w-4 h-4" style={{ color: 'var(--report-success)' }} />
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--report-success)', margin: 0 }}
              >
                Above Average
              </p>
            </div>
            {strengths.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {strengths.map((s) => (
                  <li
                    key={s}
                    className="text-sm"
                    style={{
                      color: 'var(--report-navy)',
                      padding: '2px 0',
                    }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="text-sm italic"
                style={{ color: 'var(--report-stone-light)', margin: 0 }}
              >
                None identified
              </p>
            )}
          </div>

          {/* Weaknesses / Below Average */}
          <div
            className="rounded-[var(--report-radius-md)]"
            style={{
              padding: 'var(--report-space-md)',
              backgroundColor: 'var(--report-warning-bg)',
              border: '1px solid rgba(27, 46, 74, 0.04)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <ArrowDown className="w-4 h-4" style={{ color: 'var(--report-warning)' }} />
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--report-warning)', margin: 0 }}
              >
                Below Average
              </p>
            </div>
            {weaknesses.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {weaknesses.map((w) => (
                  <li
                    key={w}
                    className="text-sm"
                    style={{
                      color: 'var(--report-navy)',
                      padding: '2px 0',
                    }}
                  >
                    {w}
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="text-sm italic"
                style={{ color: 'var(--report-stone-light)', margin: 0 }}
              >
                None identified
              </p>
            )}
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
          title="Competitive Analysis"
          variant="insight"
        />
      )}
    </SectionCard>
  );
}

export default PrepCompetitiveContext;
