'use client';

import React from 'react';
import { User } from 'lucide-react';

export interface PersonalizedInsightProps {
  /** AI-generated personalized text content */
  content: string;
  /** User inputs that were used to generate this insight (e.g. ['income', 'down_payment']) */
  inputsUsed: string[];
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Formats a raw input field name into a human-readable label.
 * Converts snake_case to Title Case (e.g. 'down_payment' -> 'down payment').
 */
function formatInputLabel(input: string): string {
  return input.replace(/_/g, ' ');
}

/**
 * Builds a human-readable string from a list of input labels.
 * E.g., ['income', 'down_payment'] -> "income and down payment"
 * E.g., ['income', 'down_payment', 'timeline'] -> "income, down payment, and timeline"
 */
function formatInputsList(inputs: string[]): string {
  const labels = inputs.map(formatInputLabel);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/**
 * PersonalizedInsight - Conditional component that renders personalized content
 *
 * Returns `null` when content is empty or falsy. When visible, displays a
 * subtle callout box with a navy left border accent, "Personalized for you" label,
 * the personalized content text, and a note about which user inputs were used.
 *
 * Uses the editorial design system from report-theme.css.
 *
 * @example
 * ```tsx
 * import { PersonalizedInsight } from './core/PersonalizedInsight';
 *
 * // Shows personalized content
 * <PersonalizedInsight
 *   content="Based on your $85K income and $40K down payment, you could comfortably afford a home priced up to $340K in this market."
 *   inputsUsed={['income', 'down_payment']}
 * />
 *
 * // Self-hides when content is empty
 * <PersonalizedInsight content="" inputsUsed={[]} />
 * ```
 */
export function PersonalizedInsight({
  content,
  inputsUsed,
  className = '',
}: PersonalizedInsightProps): React.ReactElement | null {
  // Self-hide when no content exists
  if (!content || content.trim() === '') {
    return null;
  }

  return (
    <div
      className={`p-[var(--report-space-lg)] rounded-[var(--report-radius-md)] ${className}`.trim()}
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(27, 46, 74, 0.06)',
        borderLeft: '4px solid var(--report-navy)',
      }}
      role="region"
      aria-label="Personalized insight"
    >
      {/* Header with icon and label */}
      <div className="flex items-center gap-2 mb-[var(--report-space-sm)]">
        <div
          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--report-cream)' }}
        >
          <User
            className="w-3 h-3"
            style={{ color: 'var(--report-navy)' }}
            aria-hidden="true"
          />
        </div>
        <p
          className="text-[0.625rem] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--report-navy-light)' }}
        >
          Personalized for you
        </p>
      </div>

      {/* Personalized content */}
      <p
        className="text-[0.9375rem] leading-relaxed"
        style={{ color: 'var(--report-navy)' }}
      >
        {content}
      </p>

      {/* Inputs used note */}
      {inputsUsed.length > 0 && (
        <p
          className="text-[0.6875rem] mt-[var(--report-space-md)] pt-[var(--report-space-sm)]"
          style={{
            color: 'var(--report-stone-light)',
            borderTop: '1px solid rgba(27, 46, 74, 0.04)',
          }}
        >
          Based on your {formatInputsList(inputsUsed)}
        </p>
      )}
    </div>
  );
}

export default PersonalizedInsight;
