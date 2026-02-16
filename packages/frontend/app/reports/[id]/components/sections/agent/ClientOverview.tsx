'use client';

import React from 'react';

import { ScoreDisplay, getLetterGrade } from '@/app/components/scoring/ScoreDisplay';
import { AIAnalysisBlock } from '../core';
import type { ReportInstance } from '../../../../types';

export interface ClientOverviewProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Determine a quick verdict based on the MarketHealth score.
 */
function getQuickVerdict(score: number): {
  label: string;
  color: string;
} {
  if (score >= 70) {
    return { label: 'Strong Market', color: 'var(--report-success)' };
  }
  if (score >= 50) {
    return { label: 'Moderate Market', color: 'var(--report-warning)' };
  }
  return { label: "Buyer's Market", color: 'var(--report-stone)' };
}

/**
 * Format a date string into a readable format.
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * ClientOverview - Hero overview section for the client-facing market snapshot
 *
 * Displays the MarketHealth score with a gauge, market name, grade,
 * quick verdict, and an optional AI-generated summary. Designed to
 * be clean and professional for sharing with homebuyer clients.
 *
 * No SectionCard wrapper; uses its own gradient background styling.
 */
export function ClientOverview({
  report,
  className = '',
}: ClientOverviewProps): React.ReactElement {
  const score =
    (report.scores_snapshot as any)?.markethealth_score ??
    (report as any).markethealth_score ??
    null;

  const grade =
    (report.scores_snapshot as any)?.markethealth_grade ??
    (score !== null ? getLetterGrade(score) : null);

  const verdict = score !== null ? getQuickVerdict(score) : null;

  const aiSummary =
    report.ai_narrative?.client_overview ??
    (report.ai_narratives?.client_overview as string | undefined);

  return (
    <section
      className={`bg-gradient-to-b from-[var(--report-cream)] to-white report-animate-in ${className}`.trim()}
      style={{
        padding: 'var(--report-space-xl) var(--report-space-lg)',
        borderRadius: 'var(--report-radius-lg)',
        border: '1px solid rgba(27, 46, 74, 0.06)',
      }}
      aria-label="Market Snapshot Overview"
    >
      {/* Market Name */}
      <h1
        className="text-center mb-2"
        style={{
          fontFamily: 'var(--report-font-display)',
          color: 'var(--report-navy)',
          fontSize: '1.75rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          margin: 0,
          marginBottom: 'var(--report-space-xs)',
        }}
      >
        {report.primary_geography_name}
      </h1>

      <p
        className="text-center"
        style={{
          fontFamily: 'var(--report-font-body)',
          color: 'var(--report-stone-light)',
          fontSize: '0.875rem',
          marginBottom: 'var(--report-space-lg)',
        }}
      >
        Market Snapshot Report
      </p>

      {/* Score Display */}
      {score !== null && (
        <div
          className="flex flex-col items-center"
          style={{ marginBottom: 'var(--report-space-lg)' }}
        >
          <ScoreDisplay
            value={score}
            size={100}
            strokeWidth={6}
            showGrade={false}
            showLabel={false}
          />

          {/* Grade Badge */}
          {grade && (
            <div
              className="flex items-center gap-2 mt-3"
            >
              <span
                className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'var(--report-cream-dark)',
                  color: 'var(--report-navy)',
                  fontFamily: 'var(--report-font-display)',
                }}
              >
                Grade: {grade}
              </span>
            </div>
          )}

          {/* Market Health Label */}
          <p
            className="text-center mt-2"
            style={{
              fontFamily: 'var(--report-font-body)',
              color: 'var(--report-stone)',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Market Health
          </p>

          {/* Quick Verdict */}
          {verdict && (
            <p
              className="text-center mt-1"
              style={{
                fontFamily: 'var(--report-font-display)',
                color: verdict.color,
                fontSize: '1.125rem',
                fontWeight: 600,
              }}
            >
              {verdict.label}
            </p>
          )}
        </div>
      )}

      {/* Date and Data Freshness */}
      <div
        className="flex items-center justify-center gap-4 flex-wrap"
        style={{ marginBottom: aiSummary ? 'var(--report-space-lg)' : 0 }}
      >
        <p
          className="text-xs"
          style={{ color: 'var(--report-stone-light)' }}
        >
          Generated {formatDate(report.created_at)}
        </p>
        {report.data_as_of_date && (
          <>
            <span
              className="text-xs"
              style={{ color: 'var(--report-stone-light)', opacity: 0.4 }}
            >
              |
            </span>
            <p
              className="text-xs"
              style={{ color: 'var(--report-stone-light)' }}
            >
              Data as of {formatDate(report.data_as_of_date)}
            </p>
          </>
        )}
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <AIAnalysisBlock
          content={typeof aiSummary === 'string' ? aiSummary : String(aiSummary)}
          variant="summary"
        />
      )}
    </section>
  );
}

export default ClientOverview;
