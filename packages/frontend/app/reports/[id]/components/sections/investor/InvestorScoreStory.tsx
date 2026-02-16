'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';

import type { ReportInstance } from '../../../../types';
import type { ScoreComponentBreakdown, ComponentStatus } from '@/lib/data';
import { SectionCard, AIAnalysisBlock } from '../core';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InvestorScoreStoryProps {
  report: ReportInstance;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Map a ComponentStatus to its display bar color */
function getBarColor(status: ComponentStatus): string {
  switch (status) {
    case 'excellent':
    case 'strong':
      return 'var(--report-success)';
    case 'moderate':
      return 'var(--report-warning)';
    case 'watch':
    case 'concern':
      return 'var(--report-error)';
    default:
      return 'var(--report-stone)';
  }
}

/** Map a ComponentStatus to its background pill color */
function getStatusBgColor(status: ComponentStatus): string {
  switch (status) {
    case 'excellent':
    case 'strong':
      return 'var(--report-success-bg)';
    case 'moderate':
      return 'var(--report-warning-bg)';
    case 'watch':
    case 'concern':
      return 'var(--report-error-bg)';
    default:
      return 'var(--report-cream-dark)';
  }
}

/** Capitalize a status label */
function formatStatus(status: ComponentStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Convert snake_case component name into a readable label */
function formatComponentLabel(component: string): string {
  return component
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Score Bar Sub-component
// ---------------------------------------------------------------------------

interface ScoreBarProps {
  component: ScoreComponentBreakdown;
  /** 0-based index for staggered animation */
  index: number;
}

function ScoreBar({ component, index }: ScoreBarProps) {
  const barColor = getBarColor(component.status);
  const bgColor = getStatusBgColor(component.status);
  const percentage = Math.min(component.score, 100);

  return (
    <div
      className={`report-animate-in report-animate-in-delay-${Math.min(index + 1, 5)}`}
      role="listitem"
      aria-label={`${formatComponentLabel(component.component)}: ${component.score} out of 100, ${component.status}`}
    >
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-sm font-semibold"
          style={{
            color: 'var(--report-navy)',
            fontFamily: 'var(--report-font-display)',
          }}
        >
          {formatComponentLabel(component.component)}
        </span>
        <div className="flex items-center gap-2">
          {/* Numeric score */}
          <span
            className="text-sm font-bold tabular-nums"
            style={{
              color: barColor,
              fontFamily: 'var(--report-font-display)',
            }}
          >
            {component.score}
          </span>
          {/* Status pill */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: bgColor,
              color: barColor,
              fontFamily: 'var(--report-font-body)',
            }}
          >
            {formatStatus(component.status)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-2.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--report-cream-dark)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InvestorScoreStory Component
// ---------------------------------------------------------------------------

export function InvestorScoreStory({ report }: InvestorScoreStoryProps): React.ReactElement {
  const components = report.scores_snapshot?.investoredge_components;
  const scoreStoryNarrative = (report.ai_narrative as any)?.investor_score_story;

  // Sort components by score descending
  const sortedComponents = components
    ? [...components].sort((a, b) => b.score - a.score)
    : [];

  const hasComponents = sortedComponents.length > 0;
  const hasNarrative = scoreStoryNarrative && scoreStoryNarrative.trim() !== '';

  // Graceful fallback when no data is available
  if (!hasComponents && !hasNarrative) {
    return (
      <SectionCard title="Investment Score Breakdown" icon={BarChart3}>
        <div className="flex flex-col items-center justify-center py-10">
          <div
            className="w-12 h-12 flex items-center justify-center rounded-full mb-3"
            style={{ backgroundColor: 'var(--report-cream-dark)' }}
          >
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--report-stone-light)' }} />
          </div>
          <p
            className="text-sm text-center max-w-sm"
            style={{ color: 'var(--report-stone-light)', fontFamily: 'var(--report-font-body)' }}
          >
            Investment score component breakdown is not yet available for this report.
            This data will appear once scoring analysis is complete.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Investment Score Breakdown" icon={BarChart3}>
      <div className="space-y-[var(--report-space-xl)]">
        {/* ----------------------------------------------------------------- */}
        {/* Component Bars                                                     */}
        {/* ----------------------------------------------------------------- */}
        {hasComponents && (
          <div className="space-y-[var(--report-space-md)]" role="list" aria-label="InvestorEdge score components">
            {sortedComponents.map((component, index) => (
              <ScoreBar
                key={component.component}
                component={component}
                index={index}
              />
            ))}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* AI Score Story Narrative                                            */}
        {/* ----------------------------------------------------------------- */}
        {hasNarrative && (
          <AIAnalysisBlock
            content={scoreStoryNarrative}
            variant="insight"
            className="report-animate-in report-animate-in-delay-3"
          />
        )}
      </div>
    </SectionCard>
  );
}

export default InvestorScoreStory;
