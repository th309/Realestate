'use client';

import React from 'react';
import { Star } from 'lucide-react';

import { SectionCard, AIAnalysisBlock, ComponentScoreBadge, PersonalizedInsight } from '../core';
import type { ReportInstance } from '../../../../types';
import type { ScoreComponentBreakdown } from '@/lib/data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YourPrioritiesProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map user priority strings to component identifiers used in scores.
 * Both the user-facing priority names and their possible internal keys are
 * represented here so we can cross-reference priorities with score components.
 */
const PRIORITY_TO_COMPONENT: Record<string, string[]> = {
  affordability: ['affordability'],
  growth: ['growth_potential', 'growth', 'appreciation'],
  market_timing: ['market_timing', 'timing'],
  timing: ['market_timing', 'timing'],
  stability: ['stability'],
  value: ['value'],
  competition: ['competition'],
};

/**
 * Normalise a priority string into a human-readable label.
 */
function formatPriorityLabel(priority: string): string {
  return priority
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generate a brief human-readable interpretation for a priority score.
 */
function interpretPriorityScore(priority: string, score: number): string {
  const label = formatPriorityLabel(priority).toLowerCase();
  if (score >= 75) return `Strong ${label} conditions in this market.`;
  if (score >= 55) return `Moderate ${label} — reasonable but room for improvement.`;
  if (score >= 35) return `${formatPriorityLabel(priority)} is a challenge here — worth monitoring.`;
  return `Weak ${label} conditions — this area may not align well with this priority.`;
}

/**
 * Find the score component that best matches a given priority string.
 */
function findComponentForPriority(
  priority: string,
  components: ScoreComponentBreakdown[],
): ScoreComponentBreakdown | undefined {
  const candidateKeys = PRIORITY_TO_COMPONENT[priority.toLowerCase()] ?? [priority.toLowerCase()];

  for (const key of candidateKeys) {
    const match = components.find(
      (c) => c.component.toLowerCase() === key.toLowerCase(),
    );
    if (match) return match;
  }

  // Fallback: fuzzy partial match
  for (const key of candidateKeys) {
    const match = components.find(
      (c) => c.component.toLowerCase().includes(key) || key.includes(c.component.toLowerCase()),
    );
    if (match) return match;
  }

  return undefined;
}

/**
 * Build an array of inputs used for the PersonalizedInsight component.
 */
function getPersonalisedInputsUsed(report: ReportInstance): string[] {
  const inputs: string[] = [];
  if (report.user_inputs?.income) inputs.push('income');
  if (report.user_inputs?.down_payment) inputs.push('down_payment');
  if (report.user_inputs?.timeline) inputs.push('timeline');
  if (report.user_inputs?.first_time_buyer !== undefined) inputs.push('first_time_buyer');
  return inputs;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * YourPriorities - Shows how the market aligns with the user's stated priorities
 *
 * Only renders if `report.user_inputs?.priorities` exists and has at least one
 * item. Cross-references each priority with the HomeReady score components to
 * surface the most relevant scores and interpretations.
 *
 * Uses the editorial design system from report-theme.css.
 */
export function YourPriorities({
  report,
  className = '',
}: YourPrioritiesProps): React.ReactElement | null {
  // ---- Gate: only render when priorities exist ----
  const priorities = report.user_inputs?.priorities;
  if (!priorities || !Array.isArray(priorities) || priorities.length === 0) {
    return null;
  }

  // ---- Data ----
  const components = report.scores_snapshot?.homeready_components ?? [];

  // AI narrative – might live under either key
  const rawNarrative =
    (report.ai_narrative as any)?.priorities_narrative ??
    (report.ai_narratives as any)?.priorities_narrative ??
    null;

  const narrativeContent: string | string[] | null = (() => {
    if (!rawNarrative) return null;
    if (Array.isArray(rawNarrative)) return rawNarrative as string[];
    if (typeof rawNarrative === 'string') {
      // Try JSON.parse in case it was serialised as a JSON array string
      try {
        const parsed = JSON.parse(rawNarrative);
        if (Array.isArray(parsed)) return parsed as string[];
      } catch {
        // Not JSON – treat as plain string
      }
      return rawNarrative;
    }
    return null;
  })();

  // Personalised insight
  const personalizedNarrative =
    (report.ai_narrative as any)?.priorities_personalized ??
    (report.ai_narratives as any)?.priorities_personalized ??
    '';
  const inputsUsed = getPersonalisedInputsUsed(report);

  return (
    <SectionCard title="What Matters Most to You" icon={Star} className={className}>
      {/* Priority tags */}
      <div className="flex flex-wrap gap-2 mb-[var(--report-space-lg)]">
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--report-stone)' }}
        >
          Your priorities:
        </span>
        {priorities.map((p) => (
          <span
            key={p}
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: 'var(--report-cream)',
              color: 'var(--report-navy)',
              fontFamily: 'var(--report-font-body)',
            }}
          >
            {formatPriorityLabel(p)}
          </span>
        ))}
      </div>

      {/* Per-priority breakdown */}
      <div className="space-y-[var(--report-space-md)]">
        {priorities.map((priority, idx) => {
          const comp = findComponentForPriority(priority, components);
          const score = comp?.score ?? null;
          const status = comp ? comp.status : null;

          return (
            <div
              key={priority}
              className="rounded-[var(--report-radius-md)] p-[var(--report-space-lg)]"
              style={{
                backgroundColor: 'white',
                border: '1px solid rgba(27, 46, 74, 0.08)',
              }}
            >
              {/* Rank label */}
              <p
                className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-sm)]"
                style={{ color: 'var(--report-stone-light)' }}
              >
                #{idx + 1} Priority
              </p>

              {score !== null && status ? (
                <>
                  <ComponentScoreBadge
                    component={comp!.component}
                    score={score}
                    label={formatPriorityLabel(priority)}
                    status={status}
                  />
                  <p
                    className="text-sm leading-relaxed mt-[var(--report-space-sm)]"
                    style={{ color: 'var(--report-stone)' }}
                  >
                    {interpretPriorityScore(priority, score)}
                  </p>
                </>
              ) : (
                <>
                  <p
                    className="text-base font-semibold"
                    style={{
                      color: 'var(--report-navy)',
                      fontFamily: 'var(--report-font-display)',
                    }}
                  >
                    {formatPriorityLabel(priority)}
                  </p>
                  <p
                    className="text-sm mt-1"
                    style={{ color: 'var(--report-stone-light)' }}
                  >
                    Score data not available for this priority.
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* AI narrative */}
      {narrativeContent && (
        <div className="mt-[var(--report-space-lg)]">
          <AIAnalysisBlock
            content={narrativeContent}
            title="How Your Priorities Align"
            variant="insight"
          />
        </div>
      )}

      {/* Personalised insight */}
      {typeof personalizedNarrative === 'string' && personalizedNarrative.trim() !== '' && (
        <div className="mt-[var(--report-space-lg)]">
          <PersonalizedInsight
            content={personalizedNarrative}
            inputsUsed={inputsUsed}
          />
        </div>
      )}
    </SectionCard>
  );
}

export default YourPriorities;
