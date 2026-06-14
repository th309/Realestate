import React from 'react';

import type { NewsItem } from '../../../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SentimentLabel = 'bullish' | 'neutral' | 'bearish';

export interface SentimentData {
  overall: SentimentLabel;
  confidence?: number;
  bullish_count?: number;
  bearish_count?: number;
  summary?: string;
  factors?: string[];
}

export interface EconomicIndicator {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Sentiment colour helpers
// ---------------------------------------------------------------------------

export function sentimentColor(s: SentimentLabel): string {
  switch (s) {
    case 'bullish':
      return 'var(--report-success)';
    case 'bearish':
      return 'var(--report-error)';
    default:
      return 'var(--report-warning)';
  }
}

export function sentimentBgColor(s: SentimentLabel): string {
  switch (s) {
    case 'bullish':
      return 'var(--report-success-bg)';
    case 'bearish':
      return 'var(--report-error-bg)';
    default:
      return 'var(--report-warning-bg)';
  }
}

function sentimentDot(s: SentimentLabel): string {
  switch (s) {
    case 'bullish':
      return '\u{1F7E2}'; // green circle
    case 'bearish':
      return '\u{1F534}'; // red circle
    default:
      return '\u{1F7E1}'; // yellow circle
  }
}

function sentimentLabelText(s: SentimentLabel): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

export function SentimentGauge({ sentiment }: { sentiment: SentimentData }) {
  const confidence = sentiment.confidence ?? 50;
  const fillWidth = Math.min(Math.max(confidence, 5), 100);

  return (
    <div
      className="rounded-[var(--report-radius-md)] p-[var(--report-space-lg)]"
      style={{
        backgroundColor: sentimentBgColor(sentiment.overall),
        border: '1px solid rgba(27, 46, 74, 0.06)',
      }}
    >
      <p
        className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-sm)]"
        style={{ color: 'var(--report-stone-light)' }}
      >
        Market Sentiment
      </p>

      <div className="flex items-center gap-3 mb-[var(--report-space-sm)]">
        <span className="text-lg" aria-hidden="true">
          {sentimentDot(sentiment.overall)}
        </span>
        <span
          className="text-base font-semibold"
          style={{
            color: sentimentColor(sentiment.overall),
            fontFamily: 'var(--report-font-display)',
          }}
        >
          {sentimentLabelText(sentiment.overall)}
        </span>
        {sentiment.confidence !== undefined && (
          <span
            className="text-xs font-medium ml-auto tabular-nums"
            style={{ color: 'var(--report-stone)' }}
          >
            {Math.round(confidence)}% Confidence
          </span>
        )}
      </div>

      {/* Confidence bar */}
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(27, 46, 74, 0.08)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${fillWidth}%`,
            backgroundColor: sentimentColor(sentiment.overall),
          }}
        />
      </div>

      {sentiment.summary && (
        <p
          className="text-sm leading-relaxed mt-[var(--report-space-md)]"
          style={{ color: 'var(--report-stone)' }}
        >
          {sentiment.summary}
        </p>
      )}
    </div>
  );
}

export function NewsList({ items }: { items: NewsItem[] }) {
  // Truncate to 5 items
  const displayed = items.slice(0, 5);

  return (
    <div
      className="rounded-[var(--report-radius-md)] p-[var(--report-space-lg)]"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(27, 46, 74, 0.06)',
      }}
    >
      <p
        className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-md)]"
        style={{ color: 'var(--report-stone-light)' }}
      >
        Recent News
      </p>

      <ul className="space-y-[var(--report-space-sm)]" role="list">
        {displayed.map((news, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2"
          >
            <span
              className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: 'var(--report-navy-light)' }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p
                className="text-sm leading-snug"
                style={{ color: 'var(--report-navy)' }}
              >
                {news.headline}
              </p>
              {news.source && (
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--report-stone-light)' }}
                >
                  {news.source}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EconomicIndicators({ indicators }: { indicators: EconomicIndicator[] }) {
  return (
    <div
      className="rounded-[var(--report-radius-md)] p-[var(--report-space-lg)]"
      style={{
        backgroundColor: 'var(--report-cream)',
        border: '1px solid rgba(27, 46, 74, 0.06)',
      }}
    >
      <p
        className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] mb-[var(--report-space-md)]"
        style={{ color: 'var(--report-stone-light)' }}
      >
        Economic Indicators
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-[var(--report-space-lg)] gap-y-[var(--report-space-md)]">
        {indicators.map((ind) => (
          <div key={ind.label}>
            <p
              className="text-xs mb-0.5"
              style={{ color: 'var(--report-stone-light)' }}
            >
              {ind.label}
            </p>
            <p
              className="text-sm font-semibold tabular-nums"
              style={{
                color: 'var(--report-navy)',
                fontFamily: 'var(--report-font-display)',
              }}
            >
              {ind.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
