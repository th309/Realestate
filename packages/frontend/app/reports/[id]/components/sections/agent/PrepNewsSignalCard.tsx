import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

import type { NewsItem, MarketSignal } from './prepNewsSignals.constants';
import {
  getStatusColor,
  getStatusBgColor,
  formatNewsDate,
} from './prepNewsSignals.constants';

/**
 * Get trend icon for a signal status
 */
function getStatusIcon(status: 'improving' | 'stable' | 'declining') {
  switch (status) {
    case 'improving':
      return <TrendingUp className="w-3 h-3" />;
    case 'declining':
      return <TrendingDown className="w-3 h-3" />;
    default:
      return <Minus className="w-3 h-3" />;
  }
}

/**
 * Renders a single news item card
 */
export function NewsItemCard({ item }: { item: NewsItem }) {
  return (
    <div
      className="rounded-[var(--report-radius-md)]"
      style={{
        padding: 'var(--report-space-md)',
        backgroundColor: 'var(--report-cream)',
        border: '1px solid rgba(27, 46, 74, 0.04)',
      }}
    >
      <p
        className="text-sm font-semibold"
        style={{
          color: 'var(--report-navy)',
          margin: 0,
          marginBottom: item.summary ? 'var(--report-space-xs)' : 0,
        }}
      >
        {item.title}
      </p>
      {item.summary && (
        <p
          className="text-sm leading-relaxed"
          style={{
            color: 'var(--report-stone)',
            margin: 0,
            marginBottom: 'var(--report-space-xs)',
          }}
        >
          {item.summary}
        </p>
      )}
      {(item.date || item.source) && (
        <p
          className="text-[0.6875rem]"
          style={{ color: 'var(--report-stone-light)', margin: 0 }}
        >
          {item.date && formatNewsDate(item.date)}
          {item.date && item.source && ' \u00B7 '}
          {item.source}
        </p>
      )}
    </div>
  );
}

/**
 * Renders a single market signal card with icon, label, detail, and status pill
 */
export function MarketSignalCard({ signal }: { signal: MarketSignal }) {
  const SignalIcon = signal.icon;

  return (
    <div
      className="flex items-center gap-3 rounded-[var(--report-radius-md)]"
      style={{
        padding: 'var(--report-space-md)',
        backgroundColor: 'var(--report-cream)',
        border: '1px solid rgba(27, 46, 74, 0.04)',
      }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: getStatusBgColor(signal.status) }}
      >
        <SignalIcon
          className="w-4 h-4"
          style={{ color: getStatusColor(signal.status) }}
        />
      </div>

      {/* Label and detail */}
      <div style={{ flex: 1 }}>
        <p
          className="text-sm font-semibold"
          style={{ color: 'var(--report-navy)', margin: 0 }}
        >
          {signal.label}
        </p>
        <p
          className="text-[0.8125rem]"
          style={{ color: 'var(--report-stone)', margin: 0 }}
        >
          {signal.detail}
        </p>
      </div>

      {/* Status pill */}
      <span
        className="inline-flex items-center gap-1 text-[0.625rem] font-semibold uppercase tracking-wide px-2 py-1 rounded-full flex-shrink-0"
        style={{
          backgroundColor: getStatusBgColor(signal.status),
          color: getStatusColor(signal.status),
        }}
      >
        {getStatusIcon(signal.status)}
        {signal.status}
      </span>
    </div>
  );
}
