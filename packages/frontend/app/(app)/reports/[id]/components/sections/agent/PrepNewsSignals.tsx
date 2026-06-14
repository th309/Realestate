'use client';

import React from 'react';
import { Newspaper, AlertTriangle } from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import type { ReportInstance } from '../../../../types';
import { getNewsItems, deriveMarketSignals } from './prepNewsSignals.constants';
import { NewsItemCard, MarketSignalCard } from './PrepNewsSignalCard';

/**
 * Props for PrepNewsSignals section
 */
export interface PrepNewsSignalsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * PrepNewsSignals - Market signals and news for agent context
 *
 * Displays either real news items from the report or, if unavailable,
 * derived market signal indicators based on metrics. Each signal has
 * an icon, label, and status pill (improving/stable/declining).
 *
 * Uses the editorial design system from report-theme.css.
 */
export function PrepNewsSignals({
  report,
  className = '',
}: PrepNewsSignalsProps): React.ReactElement {
  const newsItems = getNewsItems(report);
  const marketSignals = deriveMarketSignals(report);

  // AI narrative
  const aiNarrative =
    report.ai_narrative?.prep_signals ??
    (report.ai_narratives?.prep_signals as string | string[] | undefined);

  const hasAnyContent =
    newsItems.length > 0 || marketSignals.length > 0 || aiNarrative;

  if (!hasAnyContent) {
    return (
      <SectionCard title="Market Signals" icon={Newspaper} className={className}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">
            Market signal data is not available for this area.
          </span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Market Signals" icon={Newspaper} className={className}>
      {/* News items (if available) */}
      {newsItems.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--report-space-sm)',
            marginBottom: marketSignals.length > 0 || aiNarrative
              ? 'var(--report-space-lg)'
              : 0,
          }}
        >
          {newsItems.map((item, index) => (
            <NewsItemCard key={index} item={item} />
          ))}
        </div>
      )}

      {/* Market signals (if no news or always show alongside) */}
      {marketSignals.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--report-space-sm)',
            marginBottom: aiNarrative ? 'var(--report-space-lg)' : 0,
          }}
        >
          {newsItems.length === 0 && (
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{
                color: 'var(--report-stone-light)',
                margin: 0,
                marginBottom: 'var(--report-space-xs)',
              }}
            >
              Derived Market Signals
            </p>
          )}
          {marketSignals.map((signal, index) => (
            <MarketSignalCard key={index} signal={signal} />
          ))}
        </div>
      )}

      {/* AI Analysis */}
      {aiNarrative && (
        <AIAnalysisBlock
          content={
            typeof aiNarrative === 'string'
              ? aiNarrative
              : Array.isArray(aiNarrative)
              ? aiNarrative
              : String(aiNarrative)
          }
          title="Signal Analysis"
          variant="insight"
        />
      )}
    </SectionCard>
  );
}

export default PrepNewsSignals;
