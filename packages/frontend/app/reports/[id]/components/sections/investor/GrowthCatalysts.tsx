'use client';

import React from 'react';
import { Rocket, TrendingUp, Users, Briefcase, Building2, AlertTriangle, ExternalLink } from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import { formatMetricValue, getMetricFormat } from '@/lib/data';
import type { ReportInstance, NewsItem } from '../../../../types';

/**
 * Props for GrowthCatalysts section
 */
export interface GrowthCatalystsProps {
  report: ReportInstance;
}

/**
 * Metric configuration for economic indicators
 */
interface EconomicMetricConfig {
  id: string;
  aliases: string[];
  label: string;
  description: string;
  icon: typeof TrendingUp;
  /** Positive signal interpretation for investors */
  positiveSignal: 'higher' | 'lower';
}

/**
 * Economic indicators configuration for growth analysis
 */
const ECONOMIC_METRICS: EconomicMetricConfig[] = [
  {
    id: 'job_growth',
    aliases: ['job_growth_yoy'],
    label: 'Job Growth',
    description: 'Year-over-year employment change',
    icon: Briefcase,
    positiveSignal: 'higher',
  },
  {
    id: 'population_growth',
    aliases: ['population_growth_yoy'],
    label: 'Population Growth',
    description: 'Annual population change',
    icon: Users,
    positiveSignal: 'higher',
  },
  {
    id: 'unemployment_rate',
    aliases: [],
    label: 'Unemployment Rate',
    description: 'Local unemployment level',
    icon: Briefcase,
    positiveSignal: 'lower',
  },
  {
    id: 'building_permits',
    aliases: ['sf_permits', 'total_permits'],
    label: 'Building Permits',
    description: 'New construction activity',
    icon: Building2,
    positiveSignal: 'higher',
  },
];

/**
 * Positive catalyst categories for filtering news
 */
const POSITIVE_CATALYST_CATEGORIES = [
  'employer_expansion',
  'development_residential',
  'infrastructure',
];

/**
 * Get a metric value trying the primary ID and aliases
 */
function getMetricValueWithAliases(
  report: ReportInstance,
  metricConfig: EconomicMetricConfig
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
 * Filter news items for positive catalysts
 */
function filterPositiveCatalysts(news: NewsItem[] | undefined): NewsItem[] {
  if (!news || !Array.isArray(news)) return [];

  return news.filter((item) =>
    POSITIVE_CATALYST_CATEGORIES.includes(item.category?.toLowerCase() || '')
  );
}

/**
 * Get signal strength based on metric value and type
 */
function getSignalStrength(
  value: number | null,
  config: EconomicMetricConfig
): 'strong' | 'moderate' | 'weak' | null {
  if (value === null) return null;

  // Job growth interpretation
  if (config.id === 'job_growth' || config.id === 'job_growth_yoy') {
    if (value >= 3) return 'strong';
    if (value >= 1) return 'moderate';
    return 'weak';
  }

  // Population growth interpretation
  if (config.id === 'population_growth' || config.id === 'population_growth_yoy') {
    if (value >= 2) return 'strong';
    if (value >= 0.5) return 'moderate';
    return 'weak';
  }

  // Unemployment rate interpretation (lower is better)
  if (config.id === 'unemployment_rate') {
    if (value <= 3.5) return 'strong';
    if (value <= 5) return 'moderate';
    return 'weak';
  }

  // Building permits - context dependent
  if (config.id === 'building_permits' || config.aliases.includes('sf_permits')) {
    // Generic interpretation - would need historical context for better assessment
    return value > 0 ? 'moderate' : 'weak';
  }

  return null;
}

/**
 * Get signal color based on strength and direction
 */
function getSignalColor(strength: 'strong' | 'moderate' | 'weak' | null): string {
  switch (strength) {
    case 'strong':
      return 'var(--report-success)';
    case 'moderate':
      return 'var(--report-gold)';
    case 'weak':
      return 'var(--report-warning)';
    default:
      return 'var(--report-stone-light)';
  }
}

/**
 * GrowthCatalysts - Highlights growth drivers for investors
 *
 * Displays economic indicators and news catalysts that help investors
 * understand what's driving growth in the market:
 * - Job growth and employment trends
 * - Population growth and migration
 * - Building permits and construction activity
 * - News catalysts (employer expansions, developments, infrastructure)
 * - Economic signals from real-time indicators
 *
 * Helps investors answer: "What's driving growth here?"
 */
export function GrowthCatalysts({ report }: GrowthCatalystsProps): React.ReactElement {
  // Extract metric values
  const jobGrowth = getMetricValueWithAliases(report, ECONOMIC_METRICS[0]);
  const populationGrowth = getMetricValueWithAliases(report, ECONOMIC_METRICS[1]);
  const unemploymentRate = getMetricValueWithAliases(report, ECONOMIC_METRICS[2]);
  const buildingPermits = getMetricValueWithAliases(report, ECONOMIC_METRICS[3]);

  // Check if we have any economic data
  const hasEconomicData =
    jobGrowth !== null ||
    populationGrowth !== null ||
    unemploymentRate !== null ||
    buildingPermits !== null;

  // Get news catalysts
  const realtimeNews = report.populated_data?.realtime?.news;
  const legacyNews = report.populated_data?.news;
  const allNews = realtimeNews || legacyNews;
  const positiveCatalysts = filterPositiveCatalysts(allNews);

  // Get economic signals from realtime indicators
  const economicSignals = report.populated_data?.realtime?.indicators;

  // Get AI analysis for growth drivers
  const aiAnalysis =
    report.ai_narrative?.growth_drivers ||
    report.ai_narratives?.growth_drivers ||
    report.ai_narratives?.economic_outlook ||
    report.ai_narrative?.market_summary;

  // If no data available, show unavailable state
  if (!hasEconomicData && positiveCatalysts.length === 0 && !economicSignals) {
    return (
      <SectionCard title="Growth Catalysts" icon={Rocket}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">Growth catalyst data is not available for this area.</span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Growth Catalysts" icon={Rocket}>
      {/* Section Introduction */}
      <p
        className="report-body"
        style={{ marginBottom: 'var(--report-space-lg)' }}
      >
        Understanding what drives growth in a market helps investors identify appreciation
        potential and rental demand trends.
      </p>

      {/* Economic Indicators Grid */}
      {hasEconomicData && (
        <div style={{ marginBottom: 'var(--report-space-xl)' }}>
          <h3
            className="report-heading-sm"
            style={{ marginBottom: 'var(--report-space-md)' }}
          >
            Economic Indicators
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--report-space-md)',
            }}
          >
            {ECONOMIC_METRICS.map((metric) => {
              const value = getMetricValueWithAliases(report, metric);
              if (value === null) return null;

              const signal = getSignalStrength(value, metric);
              const signalColor = getSignalColor(signal);
              const Icon = metric.icon;

              return (
                <div
                  key={metric.id}
                  className="report-metric-card"
                  style={{
                    position: 'relative',
                    borderLeft: `3px solid ${signalColor}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--report-space-sm)',
                      marginBottom: 'var(--report-space-xs)',
                    }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: 'var(--report-stone)' }}
                      aria-hidden="true"
                    />
                    <span className="report-metric-label">{metric.label}</span>
                  </div>
                  <p className="report-metric-value">
                    {formatMetricValue(value, getMetricFormat(metric.id))}
                  </p>
                  <p
                    className="report-body-sm"
                    style={{ marginTop: 'var(--report-space-xs)' }}
                  >
                    {metric.description}
                  </p>
                  {signal && (
                    <span
                      className="report-badge"
                      style={{
                        position: 'absolute',
                        top: 'var(--report-space-sm)',
                        right: 'var(--report-space-sm)',
                        backgroundColor:
                          signal === 'strong'
                            ? 'var(--report-success-bg)'
                            : signal === 'moderate'
                            ? 'rgba(196, 163, 90, 0.15)'
                            : 'var(--report-warning-bg)',
                        color: signalColor,
                      }}
                    >
                      {signal}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* News Catalysts */}
      {positiveCatalysts.length > 0 && (
        <div style={{ marginBottom: 'var(--report-space-xl)' }}>
          <h3
            className="report-heading-sm"
            style={{ marginBottom: 'var(--report-space-md)' }}
          >
            Positive News Catalysts
          </h3>
          <p
            className="report-body-sm"
            style={{ marginBottom: 'var(--report-space-md)' }}
          >
            Recent developments signaling growth potential
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--report-space-md)',
            }}
          >
            {positiveCatalysts.slice(0, 5).map((news, index) => (
              <div
                key={index}
                className="report-card-subtle"
                style={{
                  padding: 'var(--report-space-md)',
                  display: 'flex',
                  gap: 'var(--report-space-md)',
                }}
              >
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: 'var(--report-radius-sm)',
                    backgroundColor: 'var(--report-success-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <TrendingUp
                    className="w-5 h-5"
                    style={{ color: 'var(--report-success)' }}
                    aria-hidden="true"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 'var(--report-space-sm)',
                    }}
                  >
                    <h4
                      className="report-body"
                      style={{
                        fontWeight: 600,
                        color: 'var(--report-navy)',
                        margin: 0,
                      }}
                    >
                      {news.headline}
                    </h4>
                    {news.url && (
                      <a
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--report-navy-light)',
                          flexShrink: 0,
                        }}
                        aria-label={`Read full article: ${news.headline}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  {news.summary && (
                    <p
                      className="report-body-sm"
                      style={{
                        marginTop: 'var(--report-space-xs)',
                        marginBottom: 0,
                      }}
                    >
                      {news.summary}
                    </p>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--report-space-md)',
                      marginTop: 'var(--report-space-sm)',
                    }}
                  >
                    <span
                      className="report-badge"
                      style={{
                        backgroundColor: 'var(--report-cream)',
                        color: 'var(--report-stone)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {news.category.replace(/_/g, ' ')}
                    </span>
                    {news.source && (
                      <span
                        className="report-body-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        {news.source}
                      </span>
                    )}
                    {news.published_at && (
                      <span
                        className="report-body-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        {new Date(news.published_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Economic Signals from Realtime Indicators */}
      {economicSignals && Object.keys(economicSignals).length > 0 && (
        <div style={{ marginBottom: 'var(--report-space-xl)' }}>
          <h3
            className="report-heading-sm"
            style={{ marginBottom: 'var(--report-space-md)' }}
          >
            Economic Signals
          </h3>
          <div
            className="report-card-subtle"
            style={{ padding: 'var(--report-space-lg)' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--report-space-md)',
              }}
            >
              {Object.entries(economicSignals).map(([key, value]) => {
                // Format the key for display
                const label = key
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase());

                // Determine if this is a positive or negative signal
                const isPositive =
                  typeof value === 'number'
                    ? value > 0
                    : typeof value === 'string'
                    ? ['positive', 'growth', 'increase', 'bullish'].some((term) =>
                        value.toLowerCase().includes(term)
                      )
                    : null;

                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--report-space-sm)',
                    }}
                  >
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor:
                          isPositive === true
                            ? 'var(--report-success)'
                            : isPositive === false
                            ? 'var(--report-warning)'
                            : 'var(--report-stone-light)',
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <p
                        className="report-label"
                        style={{ marginBottom: '2px' }}
                      >
                        {label}
                      </p>
                      <p
                        className="report-body"
                        style={{
                          margin: 0,
                          fontWeight: 500,
                          color: 'var(--report-navy)',
                        }}
                      >
                        {typeof value === 'number'
                          ? formatMetricValue(value, 'percent')
                          : String(value)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Investor Takeaway Box */}
      <div
        className="report-card-subtle"
        style={{
          padding: 'var(--report-space-lg)',
          marginBottom: aiAnalysis ? 'var(--report-space-lg)' : 0,
          borderLeft: '3px solid var(--report-gold)',
        }}
      >
        <p
          className="report-label"
          style={{ marginBottom: 'var(--report-space-sm)' }}
        >
          Investor Takeaway
        </p>
        <p className="report-body" style={{ margin: 0 }}>
          {getInvestorTakeaway(
            jobGrowth,
            populationGrowth,
            unemploymentRate,
            positiveCatalysts.length
          )}
        </p>
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <AIAnalysisBlock
          content={typeof aiAnalysis === 'string' ? aiAnalysis : String(aiAnalysis)}
          title="Growth Analysis"
          variant="insight"
        />
      )}
    </SectionCard>
  );
}

/**
 * Generate investor takeaway based on available data
 */
function getInvestorTakeaway(
  jobGrowth: number | null,
  populationGrowth: number | null,
  unemploymentRate: number | null,
  catalystCount: number
): string {
  const signals: string[] = [];

  if (jobGrowth !== null) {
    if (jobGrowth >= 3) {
      signals.push('strong job growth driving housing demand');
    } else if (jobGrowth >= 1) {
      signals.push('steady employment gains supporting the market');
    } else if (jobGrowth < 0) {
      signals.push('job losses that may impact rental demand');
    }
  }

  if (populationGrowth !== null) {
    if (populationGrowth >= 2) {
      signals.push('robust population growth creating sustained demand');
    } else if (populationGrowth >= 0.5) {
      signals.push('positive population trends');
    } else if (populationGrowth < 0) {
      signals.push('population decline requiring careful consideration');
    }
  }

  if (unemploymentRate !== null) {
    if (unemploymentRate <= 3.5) {
      signals.push('a tight labor market indicating economic strength');
    } else if (unemploymentRate >= 6) {
      signals.push('elevated unemployment that may affect rent collection');
    }
  }

  if (catalystCount > 0) {
    signals.push(`${catalystCount} positive news catalyst${catalystCount > 1 ? 's' : ''} signaling growth`);
  }

  if (signals.length === 0) {
    return 'Review the economic indicators above to assess growth potential. Strong job and population growth typically drive housing demand and rental rates.';
  }

  if (signals.length === 1) {
    return `This market shows ${signals[0]}. Monitor economic trends for sustained performance.`;
  }

  const lastSignal = signals.pop();
  return `This market shows ${signals.join(', ')}, and ${lastSignal}. These factors suggest potential for appreciation and rental demand.`;
}

export default GrowthCatalysts;
