'use client';

import React from 'react';
import { Lightbulb } from 'lucide-react';

import type { ScoreComponentBreakdown } from '@/lib/data';
import {
  SectionCard,
  ComponentScoreBadge,
  AIAnalysisBlock,
  PersonalizedInsight,
} from '../core';
import type { ReportInstance } from '../../../../types';

export interface InvestmentThesisSectionProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Map strategy slugs to human-readable labels.
 */
const STRATEGY_LABELS: Record<string, string> = {
  'buy-and-hold': 'Buy & Hold',
  'buy_and_hold': 'Buy & Hold',
  flip: 'Fix & Flip',
  brrrr: 'BRRRR',
  wholesale: 'Wholesale',
  'short-term-rental': 'Short-Term Rental',
  'short_term_rental': 'Short-Term Rental',
  'long-term-rental': 'Long-Term Rental',
  'long_term_rental': 'Long-Term Rental',
};

/**
 * Normalise a strategy string into a display label.
 */
function formatStrategyLabel(strategy: string): string {
  return (
    STRATEGY_LABELS[strategy.toLowerCase()] ??
    strategy
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * InvestmentThesisSection - Conditional section that frames an investment strategy.
 *
 * Only renders when the report has enough data to present a thesis: either an
 * AI narrative or score components to highlight as strengths. Displays the user's
 * chosen investment strategy (if any), top 3 score components, AI analysis, and
 * a personalized insight.
 */
export function InvestmentThesisSection({
  report,
  className = '',
}: InvestmentThesisSectionProps): React.ReactElement | null {
  // ---- Gate: only render when meaningful data exists ----
  const components = report.scores_snapshot
    ?.investoredge_components;

  const narrative =
    report.ai_narrative?.investment_thesis_narrative ??
    report.ai_narrative?.investment_analysis ??
    (report.ai_narratives as any)?.investment_thesis_narrative ??
    null;

  if (!narrative && (!components || components.length === 0)) {
    return null;
  }

  // ---- Strategy ----
  const strategy =
    report.user_inputs?.strategy ??
    report.user_inputs?.investment_strategy ??
    null;

  // ---- Top 3 components by score ----
  const sortedComponents = components
    ? [...components].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3)
    : [];

  // ---- Personalized insight ----
  const personalizedNarrative =
    report.ai_narrative?.investment_thesis_personalized ??
    (report.ai_narratives as any)?.investment_thesis_personalized ??
    null;

  const hasPersonalData =
    !!strategy || !!report.user_inputs?.investment_budget;

  const personalizedContent: string | null =
    typeof personalizedNarrative === 'string' && personalizedNarrative.trim() !== ''
      ? personalizedNarrative
      : hasPersonalData && sortedComponents.length > 0
        ? `${strategy ? `Based on your ${formatStrategyLabel(strategy)} strategy, ` : ''}` +
          `this market's top strengths are ${sortedComponents.map((c) => c.component.replace(/_/g, ' ')).join(', ')}. ` +
          `These factors should be weighed against your investment timeline and risk appetite.`
        : null;

  const personalizedInputs: string[] = [];
  if (strategy) personalizedInputs.push('investment_strategy');
  if (report.user_inputs?.investment_budget) personalizedInputs.push('investment_budget');
  if (report.user_inputs?.risk_tolerance) personalizedInputs.push('risk_tolerance');

  return (
    <SectionCard title="Investment Thesis" icon={Lightbulb} className={className}>
      {/* Strategy Badge */}
      {strategy && (
        <div className="mb-[var(--report-space-lg)]">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: 'var(--report-cream)',
              color: 'var(--report-navy)',
              fontFamily: 'var(--report-font-body)',
            }}
          >
            Strategy: {formatStrategyLabel(strategy)}
          </span>
        </div>
      )}

      {/* Top 3 Components as Strength Indicators */}
      {sortedComponents.length > 0 && (
        <div className="space-y-[var(--report-space-md)] mb-[var(--report-space-lg)]">
          <p
            className="report-label"
            style={{ color: 'var(--report-stone)' }}
          >
            Top Market Strengths
          </p>
          <div className="space-y-[var(--report-space-sm)]">
            {sortedComponents.map((comp, idx) => (
              <div
                key={comp.component}
                className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgba(27, 46, 74, 0.08)',
                }}
              >
                <p
                  className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-xs)]"
                  style={{ color: 'var(--report-stone-light)' }}
                >
                  #{idx + 1} Strength
                </p>
                <ComponentScoreBadge
                  component={comp.component}
                  score={comp.score ?? 0}
                  label={comp.component.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  status={comp.status ?? 'moderate'}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analysis Block */}
      {narrative && (
        <div className="mb-[var(--report-space-lg)]">
          <AIAnalysisBlock
            content={typeof narrative === 'string' ? narrative : String(narrative)}
            title="Investment Thesis"
            variant="insight"
          />
        </div>
      )}

      {/* Personalized Insight */}
      {personalizedContent && (
        <PersonalizedInsight
          content={personalizedContent}
          inputsUsed={personalizedInputs}
        />
      )}
    </SectionCard>
  );
}

export default InvestmentThesisSection;
