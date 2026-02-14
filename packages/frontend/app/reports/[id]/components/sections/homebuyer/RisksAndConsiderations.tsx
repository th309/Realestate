'use client';

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Activity,
  Newspaper,
  Shield,
  AlertCircle,
} from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance, NewsItem } from '../../../../types';

/**
 * Props for RisksAndConsiderations section
 */
export interface RisksAndConsiderationsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Risk severity levels for color coding
 */
type RiskSeverity = 'high' | 'medium' | 'low';

/**
 * Individual risk indicator configuration
 */
interface RiskIndicator {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  icon: React.ReactNode;
  details?: string;
}

/**
 * Get severity-based styling
 */
function getSeverityStyles(severity: RiskSeverity): {
  bgColor: string;
  textColor: string;
  borderColor: string;
  badgeBg: string;
} {
  switch (severity) {
    case 'high':
      return {
        bgColor: 'var(--report-error-bg)',
        textColor: 'var(--report-error)',
        borderColor: 'var(--report-error)',
        badgeBg: 'rgba(180, 77, 77, 0.15)',
      };
    case 'medium':
      return {
        bgColor: 'var(--report-warning-bg)',
        textColor: 'var(--report-warning)',
        borderColor: 'var(--report-warning)',
        badgeBg: 'rgba(196, 136, 58, 0.15)',
      };
    case 'low':
      return {
        bgColor: 'var(--report-success-bg)',
        textColor: 'var(--report-success)',
        borderColor: 'var(--report-success)',
        badgeBg: 'rgba(61, 122, 95, 0.15)',
      };
  }
}

/**
 * Get severity label for display
 */
function getSeverityLabel(severity: RiskSeverity): string {
  switch (severity) {
    case 'high':
      return 'High Risk';
    case 'medium':
      return 'Moderate Risk';
    case 'low':
      return 'Low Risk';
  }
}

/**
 * Calculate overvaluation risk based on overvalued_pct metric
 */
function calculateOvervaluationRisk(
  overvaluedPct: number | null
): { severity: RiskSeverity; description: string; details: string } | null {
  if (overvaluedPct === null) return null;

  if (overvaluedPct >= 15) {
    return {
      severity: 'high',
      description: 'Prices significantly exceed fundamentals',
      details: `Homes are ${overvaluedPct.toFixed(1)}% above estimated fair value. There may be a price correction risk.`,
    };
  }
  if (overvaluedPct >= 5) {
    return {
      severity: 'medium',
      description: 'Prices moderately elevated',
      details: `Homes are ${overvaluedPct.toFixed(1)}% above estimated fair value. Consider negotiating or waiting.`,
    };
  }
  if (overvaluedPct >= -5) {
    return {
      severity: 'low',
      description: 'Prices near fair value',
      details: `Prices appear to be ${Math.abs(overvaluedPct).toFixed(1)}% ${overvaluedPct >= 0 ? 'above' : 'below'} fair value.`,
    };
  }
  return {
    severity: 'low',
    description: 'Potential undervaluation',
    details: `Homes are ${Math.abs(overvaluedPct).toFixed(1)}% below estimated fair value, suggesting good value.`,
  };
}

/**
 * Calculate affordability stress based on price-to-income ratio
 */
function calculateAffordabilityStress(
  homeValue: number | null,
  medianIncome: number | null
): { severity: RiskSeverity; description: string; details: string } | null {
  if (homeValue === null || medianIncome === null || medianIncome === 0) return null;

  const priceToIncome = homeValue / medianIncome;

  if (priceToIncome >= 7) {
    return {
      severity: 'high',
      description: 'Severe affordability strain',
      details: `At ${priceToIncome.toFixed(1)}x income, most households will struggle. Budget carefully.`,
    };
  }
  if (priceToIncome >= 5) {
    return {
      severity: 'medium',
      description: 'Stretched affordability',
      details: `At ${priceToIncome.toFixed(1)}x income, buyers may need larger down payments or dual incomes.`,
    };
  }
  if (priceToIncome >= 4) {
    return {
      severity: 'low',
      description: 'Manageable price-to-income',
      details: `At ${priceToIncome.toFixed(1)}x income, homes are within traditional lending guidelines.`,
    };
  }
  return {
    severity: 'low',
    description: 'Good affordability',
    details: `At ${priceToIncome.toFixed(1)}x income, homes are well within reach for median earners.`,
  };
}

/**
 * Calculate market volatility from historical trend variance
 */
function calculateVolatilityRisk(
  report: ReportInstance
): { severity: RiskSeverity; description: string; details: string } | null {
  const historical = report.populated_data?.historical;
  if (!historical) return null;

  // Try to find home value historical data
  const homeValueHistory =
    historical['zhvi'] ||
    historical['home_value'] ||
    historical['median_listing_price'];

  if (!homeValueHistory?.data || homeValueHistory.data.length < 4) return null;

  // Calculate coefficient of variation (CV) as a measure of volatility
  const values = homeValueHistory.data.map((d) => d.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;

  // Also consider the magnitude of recent change
  const changePct = Math.abs(homeValueHistory.change_pct ?? 0);

  if (cv >= 15 || changePct >= 20) {
    return {
      severity: 'high',
      description: 'High market volatility',
      details: `Prices have shown significant swings (${cv.toFixed(1)}% variation). This market may be unpredictable.`,
    };
  }
  if (cv >= 8 || changePct >= 10) {
    return {
      severity: 'medium',
      description: 'Moderate price fluctuations',
      details: `Price movements of ${changePct.toFixed(1)}% suggest some market uncertainty.`,
    };
  }
  return {
    severity: 'low',
    description: 'Stable price history',
    details: 'Historical prices show consistent, predictable patterns.',
  };
}

/**
 * Extract risk-related content from AI narrative
 */
function extractAIRisks(
  aiNarrative: ReportInstance['ai_narrative']
): string[] {
  const risks: string[] = [];

  if (!aiNarrative) return risks;

  // Keywords that indicate risk content
  const riskKeywords = [
    'risk',
    'concern',
    'warning',
    'caution',
    'watch',
    'challenge',
    'decline',
    'falling',
    'overvalued',
    'unaffordable',
    'volatile',
    'uncertain',
    'downturn',
    'correction',
    'bubble',
    'slowdown',
  ];

  // Check various narrative sections
  const sectionsToCheck = [
    aiNarrative.market_summary,
    aiNarrative.trend_observations,
    aiNarrative.investment_analysis,
    aiNarrative.affordability_analysis,
  ];

  for (const section of sectionsToCheck) {
    if (!section || typeof section !== 'string') continue;

    // Split into sentences and find risk-related ones
    const sentences = section.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (riskKeywords.some((keyword) => lowerSentence.includes(keyword))) {
        const trimmed = sentence.trim();
        if (trimmed && !risks.includes(trimmed)) {
          risks.push(trimmed);
        }
      }
    }
  }

  return risks.slice(0, 4); // Limit to 4 most relevant risks
}

/**
 * Filter news items that may indicate risks
 */
function filterRiskNews(news: NewsItem[] | undefined): NewsItem[] {
  if (!news || news.length === 0) return [];

  const riskKeywords = [
    'decline',
    'drop',
    'fall',
    'crash',
    'recession',
    'layoff',
    'unemployment',
    'bankruptcy',
    'foreclosure',
    'crime',
    'disaster',
    'flood',
    'fire',
    'storm',
    'warning',
    'concern',
    'crisis',
    'slowdown',
    'closure',
    'default',
  ];

  return news
    .filter((item) => {
      const content = `${item.headline} ${item.summary}`.toLowerCase();
      return riskKeywords.some((keyword) => content.includes(keyword));
    })
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 3); // Limit to top 3 risk-related news
}

/**
 * RisksAndConsiderations - HomeReady report section for honest risk assessment
 *
 * This section helps homebuyers understand what could go wrong by analyzing:
 * - Overvaluation risk (price vs fundamentals)
 * - Affordability stress (price-to-income ratio)
 * - Market volatility (historical trend variance)
 * - AI-identified risks and concerns
 * - Local news that might indicate risks
 *
 * Risks are color-coded by severity (high/medium/low).
 */
export function RisksAndConsiderations({
  report,
  className = '',
}: RisksAndConsiderationsProps): React.ReactElement {
  // Get metric values for risk calculations
  const overvaluedPct = getMetricWithAliases(report, 'overvalued_pct');
  const homeValue =
    getMetricWithAliases(report, 'zhvi') ??
    getMetricWithAliases(report, 'median_listing_price') ??
    getMetricWithAliases(report, 'home_value');
  const medianIncome =
    getMetricWithAliases(report, 'median_household_income') ??
    getMetricWithAliases(report, 'median_income');

  // Calculate risk indicators (memoized to avoid expensive recalculations)
  const riskCalculations = useMemo(() => ({
    overvaluation: calculateOvervaluationRisk(overvaluedPct),
    affordability: calculateAffordabilityStress(homeValue, medianIncome),
    volatility: calculateVolatilityRisk(report),
  }), [overvaluedPct, homeValue, medianIncome, report]);

  const { overvaluation: overvaluationRisk, affordability: affordabilityRisk, volatility: volatilityRisk } = riskCalculations;

  // Build risk indicators array
  const riskIndicators: RiskIndicator[] = [];

  if (overvaluationRisk) {
    riskIndicators.push({
      id: 'overvaluation',
      title: 'Overvaluation Risk',
      description: overvaluationRisk.description,
      severity: overvaluationRisk.severity,
      icon: <TrendingUp className="w-5 h-5" />,
      details: overvaluationRisk.details,
    });
  }

  if (affordabilityRisk) {
    riskIndicators.push({
      id: 'affordability',
      title: 'Affordability Stress',
      description: affordabilityRisk.description,
      severity: affordabilityRisk.severity,
      icon: <DollarSign className="w-5 h-5" />,
      details: affordabilityRisk.details,
    });
  }

  if (volatilityRisk) {
    riskIndicators.push({
      id: 'volatility',
      title: 'Market Volatility',
      description: volatilityRisk.description,
      severity: volatilityRisk.severity,
      icon: <Activity className="w-5 h-5" />,
      details: volatilityRisk.details,
    });
  }

  // Extract AI-identified risks
  const aiRisks = extractAIRisks(report.ai_narrative);

  // Filter risk-related news
  const newsItems = report.populated_data?.realtime?.news ?? report.populated_data?.news;
  const riskNews = filterRiskNews(newsItems);

  // Check if we have any data to show
  const hasRiskIndicators = riskIndicators.length > 0;
  const hasAIRisks = aiRisks.length > 0;
  const hasRiskNews = riskNews.length > 0;
  const hasAnyData = hasRiskIndicators || hasAIRisks || hasRiskNews;

  // Calculate overall risk level
  const overallRiskLevel: RiskSeverity = riskIndicators.some((r) => r.severity === 'high')
    ? 'high'
    : riskIndicators.some((r) => r.severity === 'medium')
    ? 'medium'
    : 'low';

  // If no data available, show informational state
  if (!hasAnyData) {
    return (
      <SectionCard title="Risks & Considerations" icon={Shield} className={className}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'var(--report-cream-dark)' }}
          >
            <Shield className="w-6 h-6" style={{ color: 'var(--report-stone-light)' }} />
          </div>
          <p className="report-heading-sm mb-2" style={{ color: 'var(--report-navy)' }}>
            Risk Assessment Unavailable
          </p>
          <p
            className="report-body-sm max-w-md"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Insufficient data is available to generate a comprehensive risk assessment for this
            location. Consider consulting local market experts.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Risks & Considerations" icon={Shield} className={className}>
      {/* Overall Risk Summary */}
      {hasRiskIndicators && (
        <div
          className="rounded-[var(--report-radius-md)] p-4 mb-6"
          style={{
            backgroundColor: getSeverityStyles(overallRiskLevel).bgColor,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'white' }}
            >
              <AlertTriangle
                className="w-5 h-5"
                style={{ color: getSeverityStyles(overallRiskLevel).textColor }}
              />
            </div>
            <div>
              <p
                className="font-semibold text-base"
                style={{ color: getSeverityStyles(overallRiskLevel).textColor }}
              >
                {overallRiskLevel === 'high'
                  ? 'Elevated Risk Level'
                  : overallRiskLevel === 'medium'
                  ? 'Moderate Risk Level'
                  : 'Low Risk Level'}
              </p>
              <p className="text-sm" style={{ color: 'var(--report-stone)' }}>
                {overallRiskLevel === 'high'
                  ? 'Several factors warrant careful consideration before purchasing.'
                  : overallRiskLevel === 'medium'
                  ? 'Some factors require attention, but the market appears manageable.'
                  : 'Risk indicators suggest a relatively safe buying environment.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Risk Indicators Grid */}
      {hasRiskIndicators && (
        <div className="mb-6">
          <h4 className="report-label mb-3">Key Risk Indicators</h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--report-space-md)',
            }}
          >
            {riskIndicators.map((risk) => {
              const styles = getSeverityStyles(risk.severity);
              return (
                <div
                  key={risk.id}
                  className="rounded-[var(--report-radius-md)] p-4"
                  style={{
                    backgroundColor: 'var(--report-cream)',
                    borderLeft: `4px solid ${styles.borderColor}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: styles.badgeBg,
                        color: styles.textColor,
                      }}
                    >
                      {risk.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p
                          className="font-semibold text-sm"
                          style={{ color: 'var(--report-navy)' }}
                        >
                          {risk.title}
                        </p>
                        <span
                          className="text-[0.625rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: styles.badgeBg,
                            color: styles.textColor,
                          }}
                        >
                          {getSeverityLabel(risk.severity)}
                        </span>
                      </div>
                      <p
                        className="text-sm mb-1"
                        style={{ color: styles.textColor, fontWeight: 500 }}
                      >
                        {risk.description}
                      </p>
                      {risk.details && (
                        <p className="text-xs" style={{ color: 'var(--report-stone)' }}>
                          {risk.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI-Identified Risks */}
      {hasAIRisks && (
        <div className="mb-6">
          <AIAnalysisBlock
            title="AI-Identified Concerns"
            content={aiRisks}
            variant="insight"
          />
        </div>
      )}

      {/* Risk-Related News */}
      {hasRiskNews && (
        <div className="mb-6">
          <h4 className="report-label mb-3">
            <Newspaper
              className="w-4 h-4 inline-block mr-2"
              style={{ color: 'var(--report-stone)' }}
            />
            Local News to Watch
          </h4>
          <div
            className="rounded-[var(--report-radius-md)] overflow-hidden"
            style={{ backgroundColor: 'var(--report-cream)' }}
          >
            {riskNews.map((news, index) => (
              <div
                key={index}
                className="p-4"
                style={{
                  borderBottom:
                    index < riskNews.length - 1
                      ? '1px solid rgba(27, 46, 74, 0.06)'
                      : 'none',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      backgroundColor: 'var(--report-warning-bg)',
                    }}
                  >
                    <AlertCircle
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--report-warning)' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm hover:underline"
                      style={{ color: 'var(--report-navy)' }}
                    >
                      {news.headline}
                    </a>
                    <p
                      className="text-xs mt-1 line-clamp-2"
                      style={{ color: 'var(--report-stone)' }}
                    >
                      {news.summary}
                    </p>
                    <div
                      className="flex items-center gap-2 mt-2 text-[0.625rem]"
                      style={{ color: 'var(--report-stone-light)' }}
                    >
                      <span>{news.source}</span>
                      <span>&bull;</span>
                      <span>{new Date(news.published_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p
            className="text-xs mt-2"
            style={{ color: 'var(--report-stone-light)' }}
          >
            News items are filtered for potential risk factors. Click headlines to read full
            articles.
          </p>
        </div>
      )}

      {/* Buyer Guidance */}
      <div
        className="p-4 rounded-[var(--report-radius-md)] border-l-4"
        style={{
          backgroundColor: 'var(--report-cream)',
          borderLeftColor: 'var(--report-gold)',
        }}
      >
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--report-navy)' }}>
          What Should You Do?
        </p>
        <ul
          className="text-sm space-y-1"
          style={{ color: 'var(--report-stone)' }}
        >
          {overallRiskLevel === 'high' && (
            <>
              <li>
                &bull; Consider waiting for better market conditions or negotiating aggressively
              </li>
              <li>&bull; Get a thorough home inspection and appraisal</li>
              <li>&bull; Ensure you have substantial financial reserves</li>
              <li>&bull; Explore alternative neighborhoods with lower risk profiles</li>
            </>
          )}
          {overallRiskLevel === 'medium' && (
            <>
              <li>&bull; Proceed with reasonable caution and thorough due diligence</li>
              <li>&bull; Consider negotiating on price given market conditions</li>
              <li>&bull; Ensure your budget includes contingencies for market changes</li>
            </>
          )}
          {overallRiskLevel === 'low' && (
            <>
              <li>&bull; Market conditions appear favorable for buyers</li>
              <li>&bull; Standard due diligence practices should suffice</li>
              <li>&bull; Consider acting with reasonable confidence</li>
            </>
          )}
        </ul>
      </div>
    </SectionCard>
  );
}

export default RisksAndConsiderations;
