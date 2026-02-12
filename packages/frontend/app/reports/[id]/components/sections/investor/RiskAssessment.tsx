'use client';

import React from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  Clock,
  Building2,
  Briefcase,
  Newspaper,
  AlertCircle,
} from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance, NewsItem } from '../../../../types';

/**
 * Props for RiskAssessment section
 */
export interface RiskAssessmentProps {
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
  category: string;
  description: string;
  severity: RiskSeverity;
  icon: React.ReactNode;
  details?: string;
  value?: string;
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
 * Investors care about buying at the right price
 */
function calculateOvervaluationRisk(
  overvaluedPct: number | null
): { severity: RiskSeverity; description: string; details: string; value: string } | null {
  if (overvaluedPct === null) return null;

  if (overvaluedPct >= 15) {
    return {
      severity: 'high',
      description: 'Prices significantly above fair value',
      details: 'High risk of price correction. Consider waiting or negotiating aggressively.',
      value: `${overvaluedPct.toFixed(1)}% overvalued`,
    };
  }
  if (overvaluedPct >= 5) {
    return {
      severity: 'medium',
      description: 'Prices moderately elevated',
      details: 'Some downside risk exists. Factor in potential price adjustment.',
      value: `${overvaluedPct.toFixed(1)}% above fair value`,
    };
  }
  if (overvaluedPct >= -5) {
    return {
      severity: 'low',
      description: 'Prices near fair value',
      details: 'Market pricing appears reasonable for current conditions.',
      value: `${Math.abs(overvaluedPct).toFixed(1)}% ${overvaluedPct >= 0 ? 'above' : 'below'} fair value`,
    };
  }
  return {
    severity: 'low',
    description: 'Potential undervaluation',
    details: 'Prices below fair value may indicate buying opportunity.',
    value: `${Math.abs(overvaluedPct).toFixed(1)}% below fair value`,
  };
}

/**
 * Calculate liquidity risk based on days on market and inventory
 * How easily can you sell if needed?
 */
function calculateLiquidityRisk(
  daysOnMarket: number | null,
  inventory: number | null
): { severity: RiskSeverity; description: string; details: string; value: string } | null {
  if (daysOnMarket === null && inventory === null) return null;

  let score = 0;
  let factors: string[] = [];

  // Days on market evaluation (higher = harder to sell)
  if (daysOnMarket !== null) {
    if (daysOnMarket >= 90) {
      score += 2;
      factors.push(`${Math.round(daysOnMarket)} days to sell`);
    } else if (daysOnMarket >= 60) {
      score += 1;
      factors.push(`${Math.round(daysOnMarket)} days avg`);
    } else if (daysOnMarket >= 30) {
      factors.push(`${Math.round(daysOnMarket)} days`);
    } else {
      factors.push(`${Math.round(daysOnMarket)} days (fast)`);
    }
  }

  // Inventory evaluation (higher months = harder to sell)
  if (inventory !== null) {
    if (inventory >= 6) {
      score += 2;
      factors.push(`${inventory.toFixed(1)} months inventory`);
    } else if (inventory >= 4) {
      score += 1;
      factors.push(`${inventory.toFixed(1)} months supply`);
    } else {
      factors.push(`${inventory.toFixed(1)} months`);
    }
  }

  const value = factors.join(', ');

  if (score >= 3) {
    return {
      severity: 'high',
      description: 'Difficult to sell quickly',
      details: 'High inventory and long sale times. Exit may be challenging.',
      value,
    };
  }
  if (score >= 1) {
    return {
      severity: 'medium',
      description: 'Moderate market liquidity',
      details: 'Sales take time but market is functional.',
      value,
    };
  }
  return {
    severity: 'low',
    description: 'Active, liquid market',
    details: 'Properties sell quickly. Exit strategy is viable.',
    value,
  };
}

/**
 * Calculate vacancy risk based on vacancy rate
 * Risk of not finding tenants
 */
function calculateVacancyRisk(
  vacancyRate: number | null
): { severity: RiskSeverity; description: string; details: string; value: string } | null {
  if (vacancyRate === null) return null;

  if (vacancyRate >= 10) {
    return {
      severity: 'high',
      description: 'High vacancy in the area',
      details: 'Difficulty finding tenants likely. Budget for extended vacancies.',
      value: `${vacancyRate.toFixed(1)}% vacancy rate`,
    };
  }
  if (vacancyRate >= 6) {
    return {
      severity: 'medium',
      description: 'Elevated vacancy levels',
      details: 'Some tenant turnover expected. Factor in vacancy costs.',
      value: `${vacancyRate.toFixed(1)}% vacancy rate`,
    };
  }
  return {
    severity: 'low',
    description: 'Strong rental demand',
    details: 'Low vacancy indicates consistent tenant demand.',
    value: `${vacancyRate.toFixed(1)}% vacancy rate`,
  };
}

/**
 * Calculate economic risk based on unemployment and job growth
 * Local economy health affects tenant stability and property values
 */
function calculateEconomicRisk(
  unemploymentRate: number | null,
  jobGrowth: number | null
): { severity: RiskSeverity; description: string; details: string; value: string } | null {
  if (unemploymentRate === null && jobGrowth === null) return null;

  let score = 0;
  let factors: string[] = [];

  // Unemployment evaluation
  if (unemploymentRate !== null) {
    if (unemploymentRate >= 8) {
      score += 2;
      factors.push(`${unemploymentRate.toFixed(1)}% unemployment`);
    } else if (unemploymentRate >= 5) {
      score += 1;
      factors.push(`${unemploymentRate.toFixed(1)}% unemployment`);
    } else {
      factors.push(`${unemploymentRate.toFixed(1)}% unemployment`);
    }
  }

  // Job growth evaluation (negative growth is concerning)
  if (jobGrowth !== null) {
    if (jobGrowth < -2) {
      score += 2;
      factors.push(`${jobGrowth.toFixed(1)}% job growth`);
    } else if (jobGrowth < 1) {
      score += 1;
      factors.push(`${jobGrowth.toFixed(1)}% job growth`);
    } else {
      factors.push(`+${jobGrowth.toFixed(1)}% job growth`);
    }
  }

  const value = factors.join(', ');

  if (score >= 3) {
    return {
      severity: 'high',
      description: 'Weak local economy',
      details: 'Job losses may affect tenant stability and property values.',
      value,
    };
  }
  if (score >= 1) {
    return {
      severity: 'medium',
      description: 'Mixed economic signals',
      details: 'Economy shows some weakness. Monitor conditions.',
      value,
    };
  }
  return {
    severity: 'low',
    description: 'Healthy local economy',
    details: 'Strong employment supports tenant demand and values.',
    value,
  };
}

/**
 * Filter news items for investment risk indicators
 * Focus on layoffs, disasters, and policy changes
 */
function filterRiskNews(news: NewsItem[] | undefined): NewsItem[] {
  if (!news || news.length === 0) return [];

  // Keywords relevant to investment risks
  const riskKeywords = [
    // Layoffs and economic issues
    'layoff',
    'layoffs',
    'laid off',
    'downsizing',
    'restructuring',
    'job cuts',
    'workforce reduction',
    'unemployment',
    'recession',
    'bankruptcy',
    'closure',
    'closing',
    'shutdown',
    // Disasters and events
    'disaster',
    'flood',
    'flooding',
    'fire',
    'wildfire',
    'storm',
    'hurricane',
    'tornado',
    'earthquake',
    'damage',
    'emergency',
    'evacuation',
    // Policy changes
    'rent control',
    'zoning',
    'regulation',
    'moratorium',
    'eviction ban',
    'property tax',
    'tax increase',
    'ordinance',
    'legislation',
    // Market concerns
    'crash',
    'collapse',
    'foreclosure',
    'default',
    'decline',
    'bubble',
    'crisis',
  ];

  return news
    .filter((item) => {
      const content = `${item.headline} ${item.summary}`.toLowerCase();
      return riskKeywords.some((keyword) => content.includes(keyword));
    })
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 4); // Limit to top 4 risk-related news
}

/**
 * Get risk score from investoredge_details
 */
function getRiskScoreFromDetails(
  report: ReportInstance
): { score: number; interpretation: string } | null {
  const riskScore = report.scores_snapshot?.investoredge_details?.risk;
  if (riskScore === undefined || riskScore === null) return null;

  let interpretation: string;
  if (riskScore >= 80) {
    interpretation = 'Very low risk profile';
  } else if (riskScore >= 60) {
    interpretation = 'Below average risk';
  } else if (riskScore >= 40) {
    interpretation = 'Moderate risk level';
  } else if (riskScore >= 20) {
    interpretation = 'Above average risk';
  } else {
    interpretation = 'High risk profile';
  }

  return { score: riskScore, interpretation };
}

/**
 * RiskAssessment - InvestorEdge report section for investment risk analysis
 *
 * This section helps investors understand potential risks by analyzing:
 * - Overvaluation risk (market pricing risk)
 * - Liquidity risk (days on market, inventory)
 * - Vacancy risk (tenant demand)
 * - Economic risk (unemployment, job growth)
 * - Risk-related news (layoffs, disasters, policy changes)
 *
 * Risks are color-coded by severity (high/medium/low).
 */
export function RiskAssessment({
  report,
  className = '',
}: RiskAssessmentProps): React.ReactElement {
  // Get metric values for risk calculations
  const overvaluedPct = getMetricWithAliases(report, 'overvalued_pct');
  const daysOnMarket =
    getMetricWithAliases(report, 'days_on_market') ??
    getMetricWithAliases(report, 'avg_days_on_market');
  const inventory =
    getMetricWithAliases(report, 'inventory') ??
    getMetricWithAliases(report, 'months_of_supply');
  const vacancyRate = getMetricWithAliases(report, 'vacancy_rate');
  const unemploymentRate =
    getMetricWithAliases(report, 'unemployment_rate') ??
    getMetricWithAliases(report, 'unemployment');
  const jobGrowth =
    getMetricWithAliases(report, 'job_growth_yoy') ??
    getMetricWithAliases(report, 'job_growth');

  // Calculate risk indicators
  const overvaluationRisk = calculateOvervaluationRisk(overvaluedPct);
  const liquidityRisk = calculateLiquidityRisk(daysOnMarket, inventory);
  const vacancyRisk = calculateVacancyRisk(vacancyRate);
  const economicRisk = calculateEconomicRisk(unemploymentRate, jobGrowth);

  // Get risk score from score breakdown
  const riskScore = getRiskScoreFromDetails(report);

  // Build risk indicators array
  const riskIndicators: RiskIndicator[] = [];

  if (overvaluationRisk) {
    riskIndicators.push({
      id: 'overvaluation',
      title: 'Market Pricing Risk',
      category: 'Overvaluation',
      description: overvaluationRisk.description,
      severity: overvaluationRisk.severity,
      icon: <TrendingDown className="w-5 h-5" />,
      details: overvaluationRisk.details,
      value: overvaluationRisk.value,
    });
  }

  if (liquidityRisk) {
    riskIndicators.push({
      id: 'liquidity',
      title: 'Liquidity Risk',
      category: 'Exit Strategy',
      description: liquidityRisk.description,
      severity: liquidityRisk.severity,
      icon: <Clock className="w-5 h-5" />,
      details: liquidityRisk.details,
      value: liquidityRisk.value,
    });
  }

  if (vacancyRisk) {
    riskIndicators.push({
      id: 'vacancy',
      title: 'Vacancy Risk',
      category: 'Rental Demand',
      description: vacancyRisk.description,
      severity: vacancyRisk.severity,
      icon: <Building2 className="w-5 h-5" />,
      details: vacancyRisk.details,
      value: vacancyRisk.value,
    });
  }

  if (economicRisk) {
    riskIndicators.push({
      id: 'economic',
      title: 'Economic Risk',
      category: 'Local Economy',
      description: economicRisk.description,
      severity: economicRisk.severity,
      icon: <Briefcase className="w-5 h-5" />,
      details: economicRisk.details,
      value: economicRisk.value,
    });
  }

  // Filter risk-related news
  const newsItems = report.populated_data?.realtime?.news ?? report.populated_data?.news;
  const riskNews = filterRiskNews(newsItems);

  // Get AI risk analysis
  const aiRiskAnalysis =
    report.ai_narrative?.investment_analysis ||
    report.ai_narratives?.risk_analysis ||
    report.ai_narratives?.investment_analysis;

  // Check if we have any data to show
  const hasRiskIndicators = riskIndicators.length > 0;
  const hasRiskScore = riskScore !== null;
  const hasRiskNews = riskNews.length > 0;
  const hasAIAnalysis = aiRiskAnalysis !== null && aiRiskAnalysis !== undefined;
  const hasAnyData = hasRiskIndicators || hasRiskScore || hasRiskNews || hasAIAnalysis;

  // Calculate overall risk level
  const overallRiskLevel: RiskSeverity = riskIndicators.some((r) => r.severity === 'high')
    ? 'high'
    : riskIndicators.some((r) => r.severity === 'medium')
    ? 'medium'
    : 'low';

  // If no data available, show informational state
  if (!hasAnyData) {
    return (
      <SectionCard title="Risk Assessment" icon={ShieldAlert} className={className}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'var(--report-cream-dark)' }}
          >
            <ShieldAlert className="w-6 h-6" style={{ color: 'var(--report-stone-light)' }} />
          </div>
          <p className="report-heading-sm mb-2" style={{ color: 'var(--report-navy)' }}>
            Risk Data Unavailable
          </p>
          <p
            className="report-body-sm max-w-md"
            style={{ color: 'var(--report-stone-light)' }}
          >
            Insufficient data is available to generate a comprehensive risk assessment for this
            investment. Conduct additional due diligence before proceeding.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Risk Assessment" icon={ShieldAlert} className={className}>
      {/* Overall Risk Summary with Score */}
      <div
        className="rounded-[var(--report-radius-md)] p-4 mb-6"
        style={{
          backgroundColor: getSeverityStyles(overallRiskLevel).bgColor,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
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
                  ? 'Elevated Investment Risk'
                  : overallRiskLevel === 'medium'
                  ? 'Moderate Investment Risk'
                  : 'Lower Investment Risk'}
              </p>
              <p className="text-sm" style={{ color: 'var(--report-stone)' }}>
                {overallRiskLevel === 'high'
                  ? 'Multiple risk factors require careful evaluation before investing.'
                  : overallRiskLevel === 'medium'
                  ? 'Some risk factors present. Factor into your investment decision.'
                  : 'Risk indicators suggest relatively favorable conditions.'}
              </p>
            </div>
          </div>

          {/* Risk Score from Component Breakdown */}
          {hasRiskScore && riskScore && (
            <div
              className="text-center px-4 py-2 rounded-[var(--report-radius-md)]"
              style={{ backgroundColor: 'white' }}
            >
              <p className="report-label mb-1">Risk Score</p>
              <p
                className="report-heading-md"
                style={{
                  color:
                    riskScore.score >= 60
                      ? 'var(--report-success)'
                      : riskScore.score >= 40
                      ? 'var(--report-gold)'
                      : 'var(--report-error)',
                  margin: 0,
                }}
              >
                {riskScore.score}
              </p>
              <p className="text-xs" style={{ color: 'var(--report-stone-light)' }}>
                {riskScore.interpretation}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Risk Indicators Grid */}
      {hasRiskIndicators && (
        <div className="mb-6">
          <h4 className="report-label mb-3">Key Risk Factors</h4>
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
                      {risk.value && (
                        <p
                          className="text-xs font-medium mb-1"
                          style={{ color: 'var(--report-navy)' }}
                        >
                          {risk.value}
                        </p>
                      )}
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

      {/* Risk-Related News */}
      {hasRiskNews && (
        <div className="mb-6">
          <h4 className="report-label mb-3">
            <Newspaper
              className="w-4 h-4 inline-block mr-2"
              style={{ color: 'var(--report-stone)' }}
            />
            Risk News to Monitor
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
                      <span>&bull;</span>
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--report-warning-bg)' }}
                      >
                        {news.category}
                      </span>
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
            Filtered for layoffs, disasters, and policy changes. Click headlines for full articles.
          </p>
        </div>
      )}

      {/* AI Risk Analysis */}
      {hasAIAnalysis && aiRiskAnalysis && (
        <div className="mb-6">
          <AIAnalysisBlock
            content={typeof aiRiskAnalysis === 'string' ? aiRiskAnalysis : String(aiRiskAnalysis)}
            title="Risk Analysis"
            variant="insight"
          />
        </div>
      )}

      {/* Investor Guidance */}
      <div
        className="p-4 rounded-[var(--report-radius-md)] border-l-4"
        style={{
          backgroundColor: 'var(--report-cream)',
          borderLeftColor: 'var(--report-gold)',
        }}
      >
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--report-navy)' }}>
          Risk Mitigation Strategies
        </p>
        <ul
          className="text-sm space-y-1"
          style={{ color: 'var(--report-stone)' }}
        >
          {overallRiskLevel === 'high' && (
            <>
              <li>&bull; Consider a larger cash reserve (6+ months expenses)</li>
              <li>&bull; Negotiate aggressively on purchase price</li>
              <li>&bull; Get thorough inspections and appraisals</li>
              <li>&bull; Consider alternative markets with better fundamentals</li>
              <li>&bull; If proceeding, ensure strong positive cash flow margin</li>
            </>
          )}
          {overallRiskLevel === 'medium' && (
            <>
              <li>&bull; Budget for higher vacancy and maintenance costs</li>
              <li>&bull; Consider rate locks if financing</li>
              <li>&bull; Build relationships with local property managers</li>
              <li>&bull; Monitor local economic indicators regularly</li>
            </>
          )}
          {overallRiskLevel === 'low' && (
            <>
              <li>&bull; Standard due diligence practices apply</li>
              <li>&bull; Focus on optimizing deal terms and financing</li>
              <li>&bull; Consider scaling your investment in this market</li>
              <li>&bull; Maintain reserves but risk profile is favorable</li>
            </>
          )}
        </ul>
      </div>
    </SectionCard>
  );
}

export default RiskAssessment;
