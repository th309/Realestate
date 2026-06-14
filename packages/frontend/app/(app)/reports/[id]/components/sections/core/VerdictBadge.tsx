'use client';

import React from 'react';

export type VerdictType = 'positive' | 'cautious' | 'wait';

export interface VerdictBadgeProps {
  /** The verdict classification */
  verdict: VerdictType;
  /** Display label (e.g. "Good time to buy", "Proceed with caution", "Wait and watch") */
  label: string;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Maps a verdict type to its background and text color CSS variables.
 */
function getVerdictColors(verdict: VerdictType): { bg: string; text: string } {
  switch (verdict) {
    case 'positive':
      return {
        bg: 'var(--report-success-bg)',
        text: 'var(--report-success)',
      };
    case 'cautious':
      return {
        bg: 'var(--report-warning-bg)',
        text: 'var(--report-warning)',
      };
    case 'wait':
      return {
        bg: 'var(--report-error-bg)',
        text: 'var(--report-error)',
      };
    default:
      return {
        bg: 'var(--report-cream-dark)',
        text: 'var(--report-stone)',
      };
  }
}

/**
 * Returns an icon character for the verdict type.
 */
function getVerdictIcon(verdict: VerdictType): string {
  switch (verdict) {
    case 'positive':
      return '\u2713'; // Check mark
    case 'cautious':
      return '\u26A0'; // Warning sign (rendered small)
    case 'wait':
      return '\u23F8'; // Pause
    default:
      return '';
  }
}

/**
 * VerdictBadge - Shows a verdict label with color-coded pill styling
 *
 * A larger pill-shaped badge that communicates an overall verdict
 * such as "Good time to buy", "Proceed with caution", or "Wait and watch".
 * Color-coded green/amber/red based on verdict type.
 *
 * Uses the editorial design system from report-theme.css.
 *
 * @example
 * ```tsx
 * import { VerdictBadge } from './core/VerdictBadge';
 *
 * <VerdictBadge verdict="positive" label="Good time to buy" />
 * <VerdictBadge verdict="cautious" label="Proceed with caution" />
 * <VerdictBadge verdict="wait" label="Wait and watch" />
 * ```
 */
export function VerdictBadge({
  verdict,
  label,
  className = '',
}: VerdictBadgeProps): React.ReactElement {
  const colors = getVerdictColors(verdict);

  return (
    <span
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${className}`.trim()}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        fontFamily: 'var(--report-font-body)',
      }}
      role="status"
      aria-label={`Verdict: ${label}`}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {getVerdictIcon(verdict)}
      </span>
      {label}
    </span>
  );
}

export default VerdictBadge;
