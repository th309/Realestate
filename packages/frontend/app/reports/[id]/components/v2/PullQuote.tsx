"use client";

import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PullQuoteProps {
  /** The quote text to display prominently */
  quote: string;
  /** Optional attribution for the quote source */
  attribution?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PullQuote - A premium editorial pull quote with left border accent.
 *
 * Used to surface the most important insight in each report section.
 * Follows the report editorial theme with display typography and
 * primary color accent border.
 *
 * @example
 * ```tsx
 * <PullQuote
 *   quote="Home values in this metro are 23% below the national median, creating a rare entry window for first-time buyers."
 *   attribution="PropertyIQ Market Analysis"
 * />
 * ```
 */
export function PullQuote({
  quote,
  attribution,
}: PullQuoteProps): React.ReactElement {
  return (
    <blockquote className="border-l-4 border-[var(--report-gold)] pl-6 py-2 my-6">
      <p
        className="text-xl font-medium text-[var(--report-navy)] leading-relaxed"
        style={{ fontFamily: "var(--report-font-display)" }}
      >
        {quote}
      </p>
      {attribution && (
        <footer className="mt-3">
          <cite className="text-sm font-medium text-[var(--report-stone-light)] not-italic tracking-wide">
            &mdash; {attribution}
          </cite>
        </footer>
      )}
    </blockquote>
  );
}
