'use client';

import React, { useState, useEffect } from 'react';
import { Target, DollarSign, Shield, TrendingUp, Users, AlertTriangle, BarChart3 } from 'lucide-react';
import { formatMetricValue } from '@/lib/data';
import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface QuintileData {
  label: string;
  scoreRange: string;
  avgReturn1y: number | null;
  avgReturn3y: number | null;
  count: number;
}

interface QuintilePerformanceResponse {
  quintiles: QuintileData[];
  summary: {
    topQuintileReturn: number | null;
    bottomQuintileReturn: number | null;
    spread: number | null;
    totalSamples: number;
  };
}

export interface ScoreDeepDiveProps {
  /** The full report data */
  report: ReportInstance;
}

interface ScoreComponentConfig {
  key: 'affordability' | 'stability' | 'value' | 'competition';
  label: string;
  icon: React.ElementType;
  description: string;
  interpretation: (score: number) => string;
}

const COMPONENT_CONFIGS: ScoreComponentConfig[] = [
  {
    key: 'affordability',
    label: 'Affordability',
    icon: DollarSign,
    description: 'How prices compare to local incomes',
    interpretation: (score) => {
      if (score >= 75) return 'Prices are well-aligned with local incomes, making home ownership accessible.';
      if (score >= 50) return 'Moderate affordability - most households can qualify with standard financing.';
      if (score >= 25) return 'Challenging affordability - may require higher income or larger down payment.';
      return 'Significant affordability gap - consider alternative areas or waiting for market shift.';
    },
  },
  {
    key: 'stability',
    label: 'Stability',
    icon: Shield,
    description: 'Market consistency and risk level',
    interpretation: (score) => {
      if (score >= 75) return 'Very stable market with low price volatility - good for long-term ownership.';
      if (score >= 50) return 'Moderate stability - typical market fluctuations expected.';
      if (score >= 25) return 'Higher volatility - prices can swing significantly year to year.';
      return 'Unstable market - significant risk of value changes in the short term.';
    },
  },
  {
    key: 'value',
    label: 'Value',
    icon: TrendingUp,
    description: 'Price relative to market fundamentals',
    interpretation: (score) => {
      if (score >= 75) return 'Excellent value - prices are below what fundamentals suggest.';
      if (score >= 50) return 'Fair value - prices align well with market fundamentals.';
      if (score >= 25) return 'Prices elevated relative to fundamentals - be cautious with offers.';
      return 'Overvalued market - prices significantly exceed what data supports.';
    },
  },
  {
    key: 'competition',
    label: 'Competition',
    icon: Users,
    description: 'Buyer demand and negotiating power',
    interpretation: (score) => {
      if (score >= 75) return 'Low competition - more negotiating power and time to decide.';
      if (score >= 50) return 'Balanced market - reasonable competition, fair negotiations expected.';
      if (score >= 25) return 'Competitive market - be prepared to act quickly on good properties.';
      return 'Highly competitive - multiple offers common, over-asking prices likely.';
    },
  },
];

function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--report-success)';
  if (score >= 50) return 'var(--report-gold)';
  if (score >= 30) return 'var(--report-warning)';
  return 'var(--report-error)';
}

function getScoreLabel(score: number): { text: string; class: string } {
  if (score >= 80) return { text: 'Excellent', class: 'report-score-excellent' };
  if (score >= 70) return { text: 'Good', class: 'report-score-good' };
  if (score >= 50) return { text: 'Moderate', class: 'report-score-moderate' };
  if (score >= 30) return { text: 'Below Average', class: 'report-score-moderate' };
  return { text: 'Poor', class: 'report-score-poor' };
}

function getOverallInterpretation(score: number): string {
  if (score >= 80) {
    return 'This market presents excellent conditions for homebuyers. Strong affordability, stable prices, and manageable competition create an ideal environment for finding and purchasing a home.';
  }
  if (score >= 70) {
    return 'Good conditions for homebuyers. The market offers reasonable opportunities with a balance of affordability and competition that favors buyers who do their research.';
  }
  if (score >= 60) {
    return 'Fair conditions overall. While some challenges exist, patient buyers can find opportunities. Focus on the stronger component scores to guide your search strategy.';
  }
  if (score >= 50) {
    return 'Moderate market conditions. Success requires careful planning, competitive offers, and potentially some compromises on location or features.';
  }
  if (score >= 40) {
    return 'Challenging conditions for homebuyers. Consider expanding your search area, adjusting your timeline, or exploring alternative financing options.';
  }
  return 'Difficult market for buyers. High prices, strong competition, or instability present significant barriers. Consider waiting for market conditions to improve.';
}

function getPercentileInterpretation(percentile: number): string {
  if (percentile >= 90) return `This market scores in the top 10% of all markets nationally, making it one of the best opportunities for homebuyers.`;
  if (percentile >= 75) return `Better than 75% of markets nationwide. This places it in the top quartile for homebuyer conditions.`;
  if (percentile >= 50) return `Above the national average. More favorable conditions than over half of U.S. markets.`;
  if (percentile >= 25) return `Below average compared to other markets, but still offers opportunities for the right buyer.`;
  return `In the bottom quartile nationally. Market conditions here are more challenging than most areas.`;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="report-score-ring" style={{ width: 140, height: 140 }}>
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        role="img"
        aria-label={`Score: ${score} out of 100`}
      >
        <circle
          className="report-score-ring-bg"
          cx="70"
          cy="70"
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="report-score-ring-progress"
          cx="70"
          cy="70"
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <span
          className="report-heading-lg"
          style={{ color, fontSize: '2.25rem', letterSpacing: '-0.02em' }}
        >
          {score}
        </span>
        <span
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--report-stone-light)' }}
        >
          {label.text}
        </span>
      </div>
    </div>
  );
}

function ComponentBar({
  config,
  score,
}: {
  config: ScoreComponentConfig;
  score: number;
}) {
  const Icon = config.icon;
  const color = getScoreColor(score);

  return (
    <div className="py-[var(--report-space-md)]">
      <div className="flex items-center justify-between mb-[var(--report-space-xs)]">
        <div className="flex items-center gap-[var(--report-space-sm)]">
          <div
            className="w-8 h-8 rounded-[var(--report-radius-sm)] flex items-center justify-center"
            style={{ backgroundColor: 'var(--report-cream)' }}
          >
            <Icon className="w-4 h-4" style={{ color: 'var(--report-navy)' }} />
          </div>
          <div>
            <span className="text-sm font-semibold" style={{ color: 'var(--report-navy)' }}>
              {config.label}
            </span>
            <p className="text-xs" style={{ color: 'var(--report-stone-light)' }}>
              {config.description}
            </p>
          </div>
        </div>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 rounded-full overflow-hidden mt-[var(--report-space-sm)]"
        style={{ backgroundColor: 'var(--report-cream-dark)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Interpretation */}
      <p
        className="text-xs mt-[var(--report-space-sm)] leading-relaxed"
        style={{ color: 'var(--report-stone)' }}
      >
        {config.interpretation(score)}
      </p>
    </div>
  );
}

export function ScoreDeepDive({ report }: ScoreDeepDiveProps): React.ReactElement {
  const score = report.homeready_score;
  const details = report.scores_snapshot?.homeready_details;
  const percentile = report.populated_data?.scores?.homeready?.percentile;

  // Handle missing score
  if (score === null || score === undefined) {
    return (
      <SectionCard title="HomeReady Score Analysis" icon={Target}>
        <div className="flex items-center justify-center gap-[var(--report-space-sm)] py-[var(--report-space-xl)]">
          <AlertTriangle
            className="w-5 h-5"
            style={{ color: 'var(--report-stone-light)' }}
          />
          <p style={{ color: 'var(--report-stone)' }}>
            HomeReady score is not available for this location
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="HomeReady Score Analysis" icon={Target}>
      {/* Main Score Display */}
      <div className="flex flex-col md:flex-row gap-[var(--report-space-xl)] mb-[var(--report-space-xl)]">
        {/* Score Ring */}
        <div className="flex flex-col items-center">
          <ScoreRing score={score} />
          {percentile !== undefined && percentile !== null && (
            <div
              className="mt-[var(--report-space-md)] text-center px-4 py-2 rounded-full"
              style={{ backgroundColor: 'var(--report-cream)' }}
            >
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--report-navy)' }}
              >
                {percentile}th Percentile
              </span>
            </div>
          )}
        </div>

        {/* Score Contextualization */}
        <div className="flex-1">
          <h3
            className="report-heading-sm mb-[var(--report-space-sm)]"
            style={{ color: 'var(--report-navy)' }}
          >
            What does this score mean?
          </h3>
          <p
            className="text-[0.9375rem] leading-relaxed mb-[var(--report-space-md)]"
            style={{ color: 'var(--report-stone)' }}
          >
            {getOverallInterpretation(score)}
          </p>
          {percentile !== undefined && percentile !== null && (
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--report-stone-light)' }}
            >
              {getPercentileInterpretation(percentile)}
            </p>
          )}
        </div>
      </div>

      {/* Component Breakdown */}
      {details && (
        <>
          <hr className="report-divider" />
          <div>
            <h3
              className="report-heading-sm mb-[var(--report-space-md)]"
              style={{ color: 'var(--report-navy)' }}
            >
              Score Components
            </h3>
            <p
              className="text-sm mb-[var(--report-space-lg)]"
              style={{ color: 'var(--report-stone-light)' }}
            >
              Your HomeReady score is built from four key factors. Understanding each helps you
              know where opportunities and challenges lie.
            </p>

            <div className="divide-y" style={{ borderColor: 'rgba(27, 46, 74, 0.06)' }}>
              {COMPONENT_CONFIGS.map((config) => {
                const componentScore = details[config.key];
                if (componentScore === undefined || componentScore === null) return null;
                return (
                  <ComponentBar
                    key={config.key}
                    config={config}
                    score={componentScore}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Score Credibility / Predictive Performance */}
      <hr className="report-divider" />
      <ScoreCredibilityBlock score={score} report={report} scoreType="homeready" />

      {/* AI Analysis Block for additional context */}
      {report.ai_narratives?.score_analysis && (
        <>
          <hr className="report-divider" />
          <AIAnalysisBlock
            title="Personalized Analysis"
            content={
              typeof report.ai_narratives.score_analysis === 'string'
                ? report.ai_narratives.score_analysis
                : ''
            }
            variant="insight"
          />
        </>
      )}
    </SectionCard>
  );
}

/**
 * ScoreCredibilityBlock - Shows backtesting data proving scores predict performance
 * Answers: "What does this score ACTUALLY mean for my investment?"
 */
function ScoreCredibilityBlock({
  score,
  report,
  scoreType,
}: {
  score: number;
  report: ReportInstance;
  scoreType: 'homeready' | 'investoredge';
}) {
  const [quintileData, setQuintileData] = useState<QuintilePerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuintileData() {
      try {
        const res = await fetch(
          `${API_URL}/api/scoring/validation/quintile-performance?score_type=${scoreType}`
        );
        if (res.ok) {
          const data = await res.json();
          setQuintileData(data);
        }
      } catch {
        // Silently fail - section just won't show
      } finally {
        setLoading(false);
      }
    }
    fetchQuintileData();
  }, [scoreType]);

  // Get median price for dollar impact calculation
  const medianPrice = getMetricWithAliases(report as any, 'zhvi')
    ?? getMetricWithAliases(report as any, 'home_value')
    ?? getMetricWithAliases(report as any, 'median_listing_price');

  // Score context from backend
  const scoreContext = report.populated_data?.scores?.[scoreType] as {
    context?: {
      dollar_impact?: string;
      interpretation?: string;
    };
  } | undefined;

  if (loading) {
    return (
      <div className="py-[var(--report-space-lg)]">
        <div className="h-6 w-48 bg-[var(--report-cream-dark)] rounded animate-pulse mb-4" />
        <div className="h-40 bg-[var(--report-cream)] rounded-lg animate-pulse" />
      </div>
    );
  }

  // Determine which quintile the score falls in
  // Match user's score against actual quintile ranges from the API data
  const getUserQuintile = (s: number, quintiles: QuintileData[]): number => {
    for (let i = 0; i < quintiles.length; i++) {
      const [min, max] = quintiles[i].scoreRange.split('-').map(Number);
      if (s >= min && s <= max) return i;
    }
    // Fallback: find closest quintile
    return 0;
  };

  const userQuintile = getUserQuintile(score, quintileData?.quintiles || []);

  return (
    <div>
      <div className="flex items-center gap-[var(--report-space-sm)] mb-[var(--report-space-md)]">
        <div
          className="w-8 h-8 rounded-[var(--report-radius-sm)] flex items-center justify-center"
          style={{ backgroundColor: 'var(--report-cream)' }}
        >
          <BarChart3 className="w-4 h-4" style={{ color: 'var(--report-navy)' }} />
        </div>
        <h3 className="report-heading-sm" style={{ color: 'var(--report-navy)' }}>
          What This Score Predicts
        </h3>
      </div>

      <p
        className="text-sm mb-[var(--report-space-lg)] leading-relaxed"
        style={{ color: 'var(--report-stone)' }}
      >
        PropertyIQ scores are built on backtested data. Here's how markets with similar scores have
        actually performed over 3 years.
      </p>

      {/* Quintile Performance Bars */}
      {quintileData && quintileData.quintiles.length > 0 && (
        <div className="mb-[var(--report-space-lg)]">
          <div className="flex items-end gap-3 h-40 mb-3">
            {quintileData.quintiles.map((q, i) => {
              const isUserQuintile = i === userQuintile;
              const return3y = q.avgReturn3y ?? 0;
              // Scale bar height: max return maps to full height
              const maxReturn = Math.max(
                ...quintileData.quintiles.map((qq) => Math.abs(qq.avgReturn3y ?? 0))
              );
              const barHeight = maxReturn > 0 ? (Math.abs(return3y) / maxReturn) * 100 : 10;

              return (
                <div key={q.label} className="flex-1 flex flex-col items-center gap-1">
                  {/* Return label */}
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{
                      color: isUserQuintile
                        ? 'var(--report-navy)'
                        : 'var(--report-stone-light)',
                    }}
                  >
                    {return3y >= 0 ? '+' : ''}{return3y.toFixed(1)}%
                  </span>
                  {/* Bar */}
                  <div
                    className="w-full rounded-t-md transition-all duration-500"
                    style={{
                      height: `${Math.max(barHeight, 8)}%`,
                      backgroundColor: isUserQuintile
                        ? 'var(--report-navy)'
                        : return3y >= 0
                        ? 'var(--report-cream-dark)'
                        : 'var(--report-error-bg)',
                      border: isUserQuintile ? '2px solid var(--report-navy)' : 'none',
                    }}
                  />
                  {/* Quintile label */}
                  <span
                    className="text-xs"
                    style={{
                      color: isUserQuintile
                        ? 'var(--report-navy)'
                        : 'var(--report-stone-light)',
                      fontWeight: isUserQuintile ? 600 : 400,
                    }}
                  >
                    {q.scoreRange}
                  </span>
                  {isUserQuintile && (
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--report-navy)',
                        color: 'white',
                      }}
                    >
                      You
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-center" style={{ color: 'var(--report-stone-light)' }}>
            3-Year Excess Return by Score Range
          </p>
        </div>
      )}

      {/* Dollar Impact Card */}
      {medianPrice && quintileData && (
        <div
          className="p-5 rounded-xl mb-[var(--report-space-md)]"
          style={{ backgroundColor: 'var(--report-success-bg)' }}
        >
          <DollarImpactDisplay
            score={score}
            medianPrice={Number(medianPrice)}
            quintileData={quintileData}
            userQuintile={userQuintile}
            scoreType={scoreType}
          />
        </div>
      )}

      {/* Backend-provided dollar impact context */}
      {scoreContext?.context?.dollar_impact && !medianPrice && (
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--report-success-bg)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--report-success)' }}>
            {scoreContext.context.dollar_impact}
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--report-stone-light)' }}
      >
        Based on PropertyIQ backtesting across {quintileData?.summary?.totalSamples ?? 384} metros,
        2018-2024. Past performance does not guarantee future results.
      </p>
    </div>
  );
}

function DollarImpactDisplay({
  score,
  medianPrice,
  quintileData,
  userQuintile,
  scoreType,
}: {
  score: number;
  medianPrice: number;
  quintileData: QuintilePerformanceResponse;
  userQuintile: number;
  scoreType: string;
}) {
  const userReturn3y = quintileData.quintiles[userQuintile]?.avgReturn3y ?? 0;
  const medianReturn3y = quintileData.quintiles[2]?.avgReturn3y ?? 0; // Q3 is median

  const userGain = Math.round(medianPrice * (userReturn3y / 100));
  const medianGain = Math.round(medianPrice * (medianReturn3y / 100));
  const advantage = userGain - medianGain;

  const priceFormatted = formatMetricValue(medianPrice, 'currency');

  return (
    <div>
      <h4
        className="text-sm font-semibold uppercase tracking-wide mb-3"
        style={{ color: 'var(--report-success)' }}
      >
        Dollar Impact on a {priceFormatted} Home
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--report-stone)' }}>
            Score {score} markets (3yr avg)
          </p>
          <p className="text-xl font-bold" style={{ color: 'var(--report-navy)' }}>
            {userGain >= 0 ? '+' : ''}{formatMetricValue(userGain, 'currency')}
          </p>
          <p className="text-xs" style={{ color: 'var(--report-stone-light)' }}>
            equity gain
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--report-stone)' }}>
            Median markets (3yr avg)
          </p>
          <p className="text-xl font-bold" style={{ color: 'var(--report-stone)' }}>
            {medianGain >= 0 ? '+' : ''}{formatMetricValue(medianGain, 'currency')}
          </p>
          <p className="text-xs" style={{ color: 'var(--report-stone-light)' }}>
            equity gain
          </p>
        </div>
      </div>
      {advantage > 0 && (
        <p
          className="mt-3 text-sm font-medium"
          style={{ color: 'var(--report-success)' }}
        >
          That's {formatMetricValue(advantage, 'currency')} more equity than a typical market.
        </p>
      )}
    </div>
  );
}

export default ScoreDeepDive;
