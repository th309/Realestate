'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

import type { ReportInstance } from '../../../../types';

export interface RecommendationSlotProps {
  /** The recommendation context type (e.g. 'affordability', 'timing', 'stability', 'growth', 'verdict') */
  contextType: string;
  /** The full report instance containing populated_data.recommendations */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * RecommendationSlot - Self-hiding partner recommendation component
 *
 * Renders only when a partner recommendation exists for the given context type
 * in `report.populated_data.recommendations[contextType]`. Returns `null` otherwise.
 *
 * When visible, displays a subtle advisory-toned card with the partner name,
 * description, CTA, and required disclosure. Designed to be non-intrusive and
 * editorial in tone, matching the report design system.
 *
 * @example
 * ```tsx
 * import { RecommendationSlot } from './core/RecommendationSlot';
 *
 * // Self-hides when no recommendation exists for this context
 * <RecommendationSlot contextType="affordability" report={report} />
 * ```
 */
export function RecommendationSlot({
  contextType,
  report,
  className = '',
}: RecommendationSlotProps): React.ReactElement | null {
  const recommendation = report.populated_data?.recommendations?.[contextType];

  // Self-hide when no recommendation exists
  if (!recommendation) {
    return null;
  }

  return (
    <div
      className={`p-[var(--report-space-lg)] rounded-[var(--report-radius-md)] ${className}`.trim()}
      style={{
        backgroundColor: 'var(--report-cream)',
        border: '1px solid rgba(27, 46, 74, 0.06)',
      }}
      role="complementary"
      aria-label="Partner recommendation"
    >
      {/* Section label */}
      <p
        className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-md)]"
        style={{ color: 'var(--report-stone-light)' }}
      >
        Recommended next step
      </p>

      {/* Partner content */}
      <div className="flex items-start gap-[var(--report-space-md)]">
        {/* Logo (if provided) */}
        {recommendation.logo_url && (
          <div
            className="flex-shrink-0 w-10 h-10 rounded-[var(--report-radius-sm)] overflow-hidden flex items-center justify-center"
            style={{
              backgroundColor: 'white',
              border: '1px solid rgba(27, 46, 74, 0.06)',
            }}
          >
            <img
              src={recommendation.logo_url}
              alt={`${recommendation.name} logo`}
              className="w-8 h-8 object-contain"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Partner name */}
          <p
            className="text-sm font-semibold mb-1"
            style={{
              fontFamily: 'var(--report-font-body)',
              color: 'var(--report-navy)',
            }}
          >
            {recommendation.name}
          </p>

          {/* Description */}
          <p
            className="text-[0.8125rem] leading-relaxed mb-[var(--report-space-md)]"
            style={{ color: 'var(--report-stone)' }}
          >
            {recommendation.description}
          </p>

          {/* CTA button */}
          <a
            href={recommendation.cta_url}
            target="_blank"
            rel="noopener noreferrer"
            className="report-btn-secondary inline-flex items-center gap-1.5 text-xs py-2 px-3"
            style={{ borderColor: 'rgba(27, 46, 74, 0.15)' }}
          >
            {recommendation.cta_text}
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Disclosure footnote */}
      <p
        className="text-[0.625rem] leading-relaxed mt-[var(--report-space-md)] pt-[var(--report-space-sm)]"
        style={{
          color: 'var(--report-stone-light)',
          borderTop: '1px solid rgba(27, 46, 74, 0.04)',
        }}
      >
        PropertyIQ may receive compensation from partners.
      </p>
    </div>
  );
}

export default RecommendationSlot;
