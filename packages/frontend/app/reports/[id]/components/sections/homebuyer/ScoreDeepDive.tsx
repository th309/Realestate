'use client';

import React from 'react';
import { Target, DollarSign, Shield, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { SectionCard, AIAnalysisBlock } from '../core';
import type { ReportInstance } from '../../../../types';

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

export default ScoreDeepDive;
