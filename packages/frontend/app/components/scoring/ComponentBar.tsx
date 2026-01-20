/**
 * ComponentBar Component
 *
 * Horizontal progress bar showing a score component (0-100).
 * Features:
 * - Component name and weight percentage
 * - Color-coded progress bar
 * - Expandable metrics list
 * - Inherited badge integration for inherited metrics
 */

'use client';

import { memo, useState } from 'react';
import { InheritedBadge } from './InheritedBadge';

interface MetricDetail {
  name: string;
  label: string;
  value: number | null;
  formatted: string;
  isInherited: boolean;
  sourceGeographyType?: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface ComponentBarProps {
  name: string;
  label: string;
  description?: string;
  score: number;
  weight: number;
  metrics?: MetricDetail[];
  helpingFactors?: string[];
  hurtingFactors?: string[];
  expandable?: boolean;
  className?: string;
}

/**
 * Get bar color based on score value
 */
function getBarColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

/**
 * Get text color based on score value
 */
function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-rose-600';
}

/**
 * Expand/collapse chevron icon
 */
function ChevronIcon({ expanded, className = '' }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/**
 * Impact indicator for metrics
 */
function ImpactIndicator({ impact }: { impact: 'positive' | 'negative' | 'neutral' }) {
  switch (impact) {
    case 'positive':
      return <span className="text-emerald-500 text-xs">↑</span>;
    case 'negative':
      return <span className="text-rose-500 text-xs">↓</span>;
    default:
      return <span className="text-on-surface-variant text-xs">→</span>;
  }
}

export const ComponentBar = memo(function ComponentBar({
  name,
  label,
  description,
  score,
  weight,
  metrics = [],
  helpingFactors = [],
  hurtingFactors = [],
  expandable = true,
  className = '',
}: ComponentBarProps) {
  const [expanded, setExpanded] = useState(false);
  const weightPercent = Math.round(weight * 100);
  const hasDetails = metrics.length > 0 || helpingFactors.length > 0 || hurtingFactors.length > 0;

  return (
    <div className={`rounded-xl bg-surface-container p-3 ${className}`}>
      {/* Header row */}
      <button
        onClick={() => expandable && hasDetails && setExpanded(!expanded)}
        className={`w-full flex items-center justify-between gap-2 ${
          expandable && hasDetails ? 'cursor-pointer' : 'cursor-default'
        }`}
        disabled={!expandable || !hasDetails}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-on-surface truncate">{label}</span>
            <span className="text-xs text-on-surface-variant flex-shrink-0">
              ({weightPercent}%)
            </span>
          </div>
          {description && (
            <p className="text-xs text-on-surface-variant mt-0.5 truncate">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-sm font-bold ${getScoreColor(score)}`}>
            {score.toFixed(0)}
          </span>
          {expandable && hasDetails && (
            <ChevronIcon expanded={expanded} className="text-on-surface-variant" />
          )}
        </div>
      </button>

      {/* Progress bar */}
      <div className="mt-2 h-2 bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${getBarColor(score)}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>

      {/* Expanded content */}
      {expanded && hasDetails && (
        <div className="mt-3 pt-3 border-t border-outline-variant space-y-3">
          {/* Metrics list */}
          {metrics.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                Metrics
              </span>
              {metrics.map((metric) => (
                <div
                  key={metric.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ImpactIndicator impact={metric.impact} />
                    <span className="text-on-surface truncate">{metric.label}</span>
                    {metric.isInherited && metric.sourceGeographyType && (
                      <InheritedBadge
                        sourceType={metric.sourceGeographyType as any}
                        className="ml-1"
                      />
                    )}
                  </div>
                  <span className="text-on-surface-variant font-medium flex-shrink-0 ml-2">
                    {metric.formatted}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Helping factors */}
          {helpingFactors.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">
                Helping
              </span>
              <div className="flex flex-wrap gap-1">
                {helpingFactors.map((factor) => (
                  <span
                    key={factor}
                    className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded"
                  >
                    {factor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hurting factors */}
          {hurtingFactors.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-rose-600 uppercase tracking-wide">
                Hurting
              </span>
              <div className="flex flex-wrap gap-1">
                {hurtingFactors.map((factor) => (
                  <span
                    key={factor}
                    className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded"
                  >
                    {factor}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ComponentBar;
