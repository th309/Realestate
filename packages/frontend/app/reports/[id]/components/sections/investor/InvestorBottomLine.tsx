'use client';

import React from 'react';
import { Target, Eye } from 'lucide-react';

import {
  SectionCard,
  AIAnalysisBlock,
  VerdictBadge,
  RecommendationSlot,
} from '../core';
import type { VerdictType } from '../core';
import type { ReportInstance } from '../../../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvestorBottomLineProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the verdict type and label from the InvestorEdge score.
 */
function getVerdict(score: number | null | undefined): {
  verdict: VerdictType;
  label: string;
} {
  if (score === null || score === undefined) {
    return { verdict: 'cautious', label: 'Insufficient Data' };
  }
  if (score >= 65) return { verdict: 'positive', label: 'Strong Investment' };
  if (score >= 45) return { verdict: 'cautious', label: 'Proceed with Caution' };
  return { verdict: 'wait', label: 'Wait and Watch' };
}

/**
 * Safely parse a value that might be a JSON string, an array, or a plain string.
 * Returns a string[] when possible, otherwise wraps a plain string in an array.
 */
function parseArrayField(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    // Already an array - make sure every element is a string
    return value.map((v) => (typeof v === 'string' ? v : String(v)));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return [];

    // Try JSON.parse in case the backend serialised an array as a string
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((v: unknown) => (typeof v === 'string' ? v : String(v)));
        }
      } catch {
        // Not valid JSON - fall through
      }
    }

    // Treat as a single-item array
    return [trimmed];
  }

  return [];
}

/**
 * Parse watch items which may be simple strings or objects with metric/threshold.
 * Returns an array of display-ready strings.
 */
function parseWatchItems(value: unknown): string[] {
  if (!value) return [];

  const raw = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // ignore
        }
      }
      return [trimmed];
    }
    return [];
  })();

  return raw.map((item: unknown) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const metric = obj.metric ?? obj.name ?? '';
      const threshold = obj.threshold ?? obj.condition ?? '';
      if (metric && threshold) return `${metric}: ${threshold}`;
      if (metric) return String(metric);
    }
    return String(item);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * InvestorBottomLine - The actionable synthesis for investors: what to DO.
 *
 * Shows a prominent verdict badge, AI executive summary, numbered action
 * items, and a list of metrics to watch. Includes a RecommendationSlot
 * for partner recommendations keyed on 'verdict'.
 *
 * Uses the editorial design system from report-theme.css.
 */
export function InvestorBottomLine({
  report,
  className = '',
}: InvestorBottomLineProps): React.ReactElement {
  const { verdict, label } = getVerdict(report.investoredge_score);

  // ---- AI narratives ----
  const summaryRaw =
    (report.ai_narrative as any)?.investor_bottom_line ??
    (report.ai_narratives as any)?.investor_bottom_line ??
    null;

  const summaryContent: string | string[] | null = (() => {
    if (!summaryRaw) return null;
    if (Array.isArray(summaryRaw)) return summaryRaw as string[];
    if (typeof summaryRaw === 'string') {
      try {
        const parsed = JSON.parse(summaryRaw);
        if (Array.isArray(parsed)) return parsed as string[];
      } catch {
        // ignore
      }
      return summaryRaw;
    }
    return null;
  })();

  // Action items
  const actionsRaw =
    (report.ai_narrative as any)?.investor_actions ??
    (report.ai_narratives as any)?.investor_actions ??
    null;
  const actionItems = parseArrayField(actionsRaw);

  // Watch items
  const watchRaw =
    (report.ai_narrative as any)?.investor_watch ??
    (report.ai_narratives as any)?.investor_watch ??
    null;
  const watchItems = parseWatchItems(watchRaw);

  return (
    <SectionCard title="The Bottom Line" icon={Target} className={className}>
      {/* Verdict badge - centered prominently */}
      <div className="flex justify-center mb-[var(--report-space-xl)]">
        <VerdictBadge verdict={verdict} label={label} className="text-base px-6 py-3" />
      </div>

      {/* AI executive summary */}
      {summaryContent && (
        <div className="mb-[var(--report-space-xl)]">
          <AIAnalysisBlock
            content={summaryContent}
            variant="summary"
          />
        </div>
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <div className="mb-[var(--report-space-xl)]">
          <h3
            className="report-heading-sm mb-[var(--report-space-md)]"
            style={{ color: 'var(--report-navy)' }}
          >
            Your Next Steps
          </h3>

          <div className="space-y-3">
            {actionItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgba(27, 46, 74, 0.08)',
                }}
              >
                {/* Step number */}
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--report-navy)',
                    color: 'white',
                    fontFamily: 'var(--report-font-display)',
                  }}
                >
                  {idx + 1}
                </div>
                <p
                  className="text-[0.9375rem] leading-relaxed pt-0.5"
                  style={{ color: 'var(--report-stone)' }}
                >
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What to watch */}
      {watchItems.length > 0 && (
        <div className="mb-[var(--report-space-xl)]">
          <div className="flex items-center gap-2 mb-[var(--report-space-md)]">
            <Eye
              className="w-4 h-4 flex-shrink-0"
              style={{ color: 'var(--report-navy-light)' }}
              aria-hidden="true"
            />
            <h3
              className="report-heading-sm"
              style={{ color: 'var(--report-navy)' }}
            >
              What to Watch
            </h3>
          </div>

          <ul
            className="space-y-2 pl-1"
            role="list"
          >
            {watchItems.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-[0.9375rem] leading-relaxed"
                style={{ color: 'var(--report-stone)' }}
              >
                <span
                  className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'var(--report-gold)' }}
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Partner recommendation slot */}
      <RecommendationSlot contextType="verdict" report={report} />
    </SectionCard>
  );
}

export default InvestorBottomLine;
