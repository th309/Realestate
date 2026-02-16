'use client';

import React from 'react';
import { Target } from 'lucide-react';

import type { ReportInstance } from '../../../../types';
import { SectionCard } from '../core/SectionCard';
import { VerdictBadge } from '../core/VerdictBadge';
import { AIAnalysisBlock } from '../core/AIAnalysisBlock';
import { PersonalizedInsight } from '../core/PersonalizedInsight';
import { RecommendationSlot } from '../core/RecommendationSlot';

interface ComparisonVerdictProps {
  report: ReportInstance;
  className?: string;
}

/**
 * Determines the verdict type and label based on report data.
 */
function getVerdict(
  report: ReportInstance
): { type: 'positive' | 'cautious' | 'wait'; label: string } {
  const winner = (report.populated_data as any)?.priority_weighted_winner;
  const isInvestor = report.user_type === 'investor';
  const primaryScore = isInvestor
    ? report.investoredge_score
    : report.homeready_score;

  if (winner) {
    return {
      type: 'positive',
      label: `${winner.winnerName} is the stronger choice`,
    };
  }

  // Check if scores are close
  const comparisons = report.comparison_geographies || [];
  const compData = (report.populated_data as any)?.comparisons;
  if (comparisons.length > 0 && compData) {
    const scoreType = isInvestor ? 'investoredge' : 'homeready';
    const compScore = compData[comparisons[0].id]?.scores?.[scoreType];
    if (
      primaryScore != null &&
      compScore != null &&
      Math.abs(primaryScore - compScore) <= 5
    ) {
      return {
        type: 'cautious',
        label: 'Both markets have strong merits',
      };
    }
  }

  return { type: 'cautious', label: 'Consider both markets carefully' };
}

/**
 * ComparisonVerdict - The final verdict section for comparison reports
 *
 * Wraps up the comparison with a clear recommendation, displaying
 * the winner, score comparison, reasons, AI analysis, and personalized insights.
 */
export function ComparisonVerdict({
  report,
  className = '',
}: ComparisonVerdictProps): React.ReactElement {
  const isInvestor = report.user_type === 'investor';
  const scoreType = isInvestor ? 'investoredge' : 'homeready';
  const primaryScore = isInvestor
    ? report.investoredge_score
    : report.homeready_score;

  const winner = (report.populated_data as any)?.priority_weighted_winner as
    | {
        winnerId: string;
        winnerName: string;
        totalScore: number;
        priorityScores: any[];
        reasons: string[];
      }
    | undefined;

  const verdict = getVerdict(report);

  // Get comparison score for "X vs Y" display
  const comparisons = report.comparison_geographies || [];
  const compData = (report.populated_data as any)?.comparisons;
  const firstCompScore =
    comparisons.length > 0 && compData
      ? (compData[comparisons[0].id]?.scores?.[scoreType] as number | null)
      : null;

  // AI narrative
  const aiNarratives = report.ai_narratives || report.ai_narrative || {};
  const verdictNarrative =
    (aiNarratives as any)?.comparison_verdict as string | string[] | undefined;

  // Personalized insight
  const personalizedContent =
    (aiNarratives as any)?.personalized_verdict as string | undefined;
  const priorities =
    (report.user_inputs?.priorities as string[]) || [];

  return (
    <SectionCard title="The Verdict" icon={Target} className={className}>
      {/* Verdict Badge */}
      <div className="mb-[var(--report-space-lg)]">
        <VerdictBadge verdict={verdict.type} label={verdict.label} />
      </div>

      {/* Winner Summary Card */}
      {winner ? (
        <div
          className="p-[var(--report-space-lg)] rounded-[var(--report-radius-md)] mb-[var(--report-space-lg)]"
          style={{
            backgroundColor: 'var(--report-success-bg)',
            border: '1px solid rgba(27, 46, 74, 0.08)',
          }}
        >
          {/* Winner name */}
          <h3
            className="text-xl font-bold mb-[var(--report-space-sm)]"
            style={{
              fontFamily: 'var(--report-font-display)',
              color: 'var(--report-navy)',
            }}
          >
            {winner.winnerName}
          </h3>

          {/* Score comparison */}
          {primaryScore != null && firstCompScore != null && (
            <p
              className="text-sm font-semibold mb-[var(--report-space-md)]"
              style={{
                fontFamily: 'var(--report-font-body)',
                color: 'var(--report-stone)',
              }}
            >
              {winner.winnerId === report.primary_geography_id ? (
                <>
                  <span style={{ color: 'var(--report-success)' }}>
                    {Math.round(primaryScore)}
                  </span>
                  {' vs '}
                  <span>{Math.round(firstCompScore)}</span>
                </>
              ) : (
                <>
                  <span>{Math.round(primaryScore)}</span>
                  {' vs '}
                  <span style={{ color: 'var(--report-success)' }}>
                    {Math.round(firstCompScore)}
                  </span>
                </>
              )}
              <span className="ml-1 text-xs" style={{ color: 'var(--report-stone-light)' }}>
                ({isInvestor ? 'InvestorEdge' : 'HomeReady'} Score)
              </span>
            </p>
          )}

          {/* Reasons */}
          {winner.reasons && winner.reasons.length > 0 && (
            <ul className="space-y-[var(--report-space-xs)]">
              {winner.reasons.map((reason, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm leading-relaxed"
                  style={{
                    color: 'var(--report-navy)',
                    fontFamily: 'var(--report-font-body)',
                  }}
                >
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'var(--report-success)' }}
                    aria-hidden="true"
                  />
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* No clear winner - show score comparison anyway */
        primaryScore != null &&
        firstCompScore != null &&
        comparisons.length > 0 && (
          <div
            className="p-[var(--report-space-lg)] rounded-[var(--report-radius-md)] mb-[var(--report-space-lg)] text-center"
            style={{
              backgroundColor: 'var(--report-cream-dark)',
              border: '1px solid rgba(27, 46, 74, 0.06)',
            }}
          >
            <p
              className="text-lg font-bold"
              style={{
                fontFamily: 'var(--report-font-display)',
                color: 'var(--report-navy)',
              }}
            >
              {report.primary_geography_name}{' '}
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--report-stone)' }}
              >
                {Math.round(primaryScore)}
              </span>
              <span
                className="mx-3 text-sm"
                style={{ color: 'var(--report-stone-light)' }}
              >
                vs
              </span>
              {comparisons[0].name}{' '}
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--report-stone)' }}
              >
                {Math.round(firstCompScore)}
              </span>
            </p>
            <p
              className="text-xs mt-[var(--report-space-xs)]"
              style={{ color: 'var(--report-stone-light)' }}
            >
              {isInvestor ? 'InvestorEdge' : 'HomeReady'} Score
            </p>
          </div>
        )
      )}

      {/* AI Analysis */}
      {verdictNarrative && (
        <div className="mb-[var(--report-space-lg)]">
          <AIAnalysisBlock
            content={verdictNarrative}
            title="Our Analysis"
            variant="recommendation"
          />
        </div>
      )}

      {/* Personalized Insight - shown if user had priorities */}
      {priorities.length > 0 && personalizedContent && (
        <div className="mb-[var(--report-space-lg)]">
          <PersonalizedInsight
            content={personalizedContent}
            inputsUsed={priorities}
          />
        </div>
      )}

      {/* Recommendation Slot */}
      <RecommendationSlot
        contextType="comparison_verdict"
        report={report}
      />
    </SectionCard>
  );
}

export default ComparisonVerdict;
