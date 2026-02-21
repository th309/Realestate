/**
 * ScoreCard Component
 *
 * Full expanded view of a PropertyIQ score with component breakdown.
 * Access model:
 * - Score value, gauge, grade, trend visible to ALL users
 * - Component breakdown section gated to Pro+ (replaced by inline upgrade CTA)
 *
 * Features:
 * - Component breakdown (Pro+)
 * - Short-term sparkline history
 * - View History button for extended (3Y/5Y) history with outcomes
 * - Validation badge for scores with actual return data
 *
 * Material Design 3 compliant with semantic color roles.
 */

'use client';

import { memo, useState } from 'react';
import { ScoreBadge, ScoreType, TrendDirection, ScoreAccess, ScoreStatus } from './ScoreBadge';
import { ComponentBar } from './ComponentBar';
import { ConfidenceDisplay } from './ConfidenceDisplay';
import dynamic from 'next/dynamic';

// Dynamically import the history chart to avoid SSR issues with recharts
const ScoreHistoryChart = dynamic(
  () => import('./ScoreHistoryChart').then((mod) => mod.ScoreHistoryChart),
  { ssr: false, loading: () => <div className="h-48 bg-outline-variant/20 rounded animate-pulse" /> }
);

// Types for score card data
interface MetricDetail {
  name: string;
  label: string;
  value: number | null;
  formatted: string;
  isInherited: boolean;
  sourceGeographyType?: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface ComponentDetail {
  name: string;
  label: string;
  weight: number;
  score: number;
  description: string;
  metrics: MetricDetail[];
  helpingFactors: string[];
  hurtingFactors: string[];
}

interface ConfidenceInfo {
  level: 'a' | 'b' | 'c' | 'f';
  percentage: number;
  metricsAvailable: number;
  metricsTotal: number;
  freshnessInDays: number;
  warning?: string;
}

interface HistoryPoint {
  date: string;
  score: number | null;
}

interface UpgradeCta {
  headline: string;
  description: string;
  buttonText: string;
  upgradeUrl: string;
  features: string[];
}

interface ValidationInfo {
  hasOutcomes: boolean;
  excessReturn3Y?: number;
  predictedVsActual?: 'outperformed' | 'underperformed' | 'matched';
}

interface ScoreCardProps {
  type: ScoreType;
  label: string;
  score: number | null;
  trend: TrendDirection;
  trendChange: number;
  access: ScoreAccess;
  status: ScoreStatus;
  statusMessage?: string;
  components?: ComponentDetail[];
  confidence?: ConfidenceInfo;
  history?: HistoryPoint[];
  dataCompleteness?: number;
  upgradeCta?: UpgradeCta;
  onUpgradeClick?: () => void;
  onClose?: () => void;
  className?: string;
  // Extended history support
  geographyType?: string;
  geographyId?: string;
  validation?: ValidationInfo;
  showHistoryButton?: boolean;
}

/**
 * Sparkline chart for score history
 */
function HistorySparkline({ data, className = '' }: { data: HistoryPoint[]; className?: string }) {
  const validPoints = data.filter((p) => p.score !== null);
  if (validPoints.length < 2) return null;

  const scores = validPoints.map((p) => p.score as number);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const width = 120;
  const height = 32;
  const padding = 4;

  const points = validPoints.map((p, i) => {
    const x = padding + (i / (validPoints.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((p.score as number - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const lastScore = scores[scores.length - 1];
  const firstScore = scores[0];
  const isUp = lastScore > firstScore;
  const strokeColor = isUp
    ? 'var(--color-emerald-500, #10b981)'
    : lastScore < firstScore
      ? 'var(--color-rose-500, #f43f5e)'
      : 'var(--color-gray-500, #6b7280)';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xs text-on-surface-variant">{validPoints.length}mo</span>
    </div>
  );
}

/**
 * Close button icon
 */
function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export const ScoreCard = memo(function ScoreCard({
  type,
  label,
  score,
  trend,
  trendChange,
  access,
  status,
  statusMessage,
  components = [],
  confidence,
  history,
  dataCompleteness,
  upgradeCta,
  onUpgradeClick,
  onClose,
  className = '',
  geographyType,
  geographyId,
  validation,
  showHistoryButton = false,
}: ScoreCardProps) {
  const [showExtendedHistory, setShowExtendedHistory] = useState(false);
  const isTeaser = access === 'teaser';

  // Map score type for history chart
  const scoreTypeForChart = type === 'market_health' ? 'markethealth' : type;

  return (
    <div className={`relative bg-surface-container-low rounded-xl shadow-sm border border-outline-variant overflow-hidden ${className}`}>

      {/* Header */}
      <div className="p-4 border-b border-outline-variant">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ScoreBadge
              type={type}
              label=""
              score={score}
              trend={trend}
              trendChange={trendChange}
              access="full"
              status={status}
              size="md"
              showLabel={false}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-on-surface">{label}</h3>
                {/* Validation badge */}
                {validation?.hasOutcomes && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-container text-on-primary-container">
                    Validated
                  </span>
                )}
              </div>
              {statusMessage && <p className="text-xs text-on-surface-variant">{statusMessage}</p>}
              {dataCompleteness !== undefined && dataCompleteness < 100 && (
                <p className="text-xs text-amber-600">Based on {dataCompleteness.toFixed(0)}% of data</p>
              )}
              {/* 3Y Excess Return summary */}
              {validation?.hasOutcomes && validation.excessReturn3Y != null && (
                <p className={`text-xs font-medium ${
                  validation.excessReturn3Y > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  3Y Excess: {validation.excessReturn3Y > 0 ? '+' : ''}{validation.excessReturn3Y.toFixed(1)}% vs state
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-surface-container-highest transition-colors"
              aria-label="Close"
            >
              <CloseIcon className="text-on-surface-variant" />
            </button>
          )}
        </div>

        {/* History, confidence, and View History button row */}
        <div className="flex items-center justify-between mt-3 gap-4">
          <div className="flex items-center gap-3">
            {history && history.length > 0 && <HistorySparkline data={history} />}
            {/* View History button */}
            {showHistoryButton && geographyType && geographyId && (
              <button
                onClick={() => setShowExtendedHistory(!showExtendedHistory)}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {showExtendedHistory ? 'Hide History' : 'View History'}
              </button>
            )}
          </div>
          {confidence && (
            <ConfidenceDisplay
              level={confidence.level}
              percentage={confidence.percentage}
              metricsAvailable={confidence.metricsAvailable}
              metricsTotal={confidence.metricsTotal}
              freshnessInDays={confidence.freshnessInDays}
              warning={confidence.warning}
              size="sm"
              showDetails
            />
          )}
        </div>
      </div>

      {/* Extended History Chart */}
      {showExtendedHistory && geographyType && geographyId && (
        <div className="p-4 border-b border-outline-variant">
          <ScoreHistoryChart
            geographyType={geographyType}
            geographyId={geographyId}
            scoreType={scoreTypeForChart as 'homeready' | 'investoredge' | 'markethealth'}
          />
        </div>
      )}

      {/* Components breakdown — visible to users with breakdown access */}
      {components.length > 0 && !isTeaser && (
        <div className="p-4 space-y-3">
          <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">Components</h4>
          {components.map((component) => (
            <ComponentBar
              key={component.name}
              name={component.name}
              label={component.label}
              description={component.description}
              score={component.score}
              weight={component.weight}
              metrics={component.metrics}
              helpingFactors={component.helpingFactors}
              hurtingFactors={component.hurtingFactors}
            />
          ))}
        </div>
      )}

      {/* Upgrade CTA for breakdown access */}
      {isTeaser && upgradeCta && (
        <div className="p-4 border-t border-outline-variant">
          <div className="text-center py-4">
            <p className="text-sm font-medium text-on-surface mb-1">{upgradeCta.headline}</p>
            <p className="text-xs text-on-surface-variant mb-3">{upgradeCta.description}</p>
            <button
              onClick={onUpgradeClick}
              className="px-4 py-2 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              {upgradeCta.buttonText}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default ScoreCard;
