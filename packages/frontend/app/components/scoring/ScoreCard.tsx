/**
 * ScoreCard Component
 *
 * Full expanded view of a PropertyIQ score with component breakdown.
 * Two variants:
 * - FullScoreCard: Complete details for users with full access
 * - TeaserScoreCard: Blurred preview with upgrade CTA for locked scores
 *
 * Material Design 3 compliant with semantic color roles.
 */

'use client';

import { memo } from 'react';
import { ScoreBadge, ScoreType, TrendDirection, ScoreAccess, ScoreStatus } from './ScoreBadge';
import { ComponentBar } from './ComponentBar';
import { ConfidenceDisplay } from './ConfidenceDisplay';

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
  level: 'high' | 'medium' | 'low';
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
  const strokeColor = isUp ? '#10b981' : lastScore < firstScore ? '#f43f5e' : '#6b7280';

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

/**
 * Lock overlay for teaser cards
 */
function TeaserOverlay({ cta, onUpgrade }: { cta: UpgradeCta; onUpgrade?: () => void }) {
  return (
    <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
      <div className="text-center p-6 max-w-xs">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-on-surface mb-1">{cta.headline}</h3>
        <p className="text-sm text-on-surface-variant mb-4">{cta.description}</p>
        <ul className="text-xs text-on-surface-variant mb-4 space-y-1">
          {cta.features.slice(0, 3).map((feature) => (
            <li key={feature} className="flex items-center gap-1.5">
              <span className="text-primary">✓</span>
              {feature}
            </li>
          ))}
        </ul>
        <button
          onClick={onUpgrade}
          className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors duration-200"
        >
          {cta.buttonText}
        </button>
      </div>
    </div>
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
}: ScoreCardProps) {
  const isTeaser = access === 'teaser';

  return (
    <div className={`relative bg-surface-container-low rounded-xl shadow-sm border border-outline-variant overflow-hidden ${className}`}>
      {/* Teaser overlay */}
      {isTeaser && upgradeCta && <TeaserOverlay cta={upgradeCta} onUpgrade={onUpgradeClick} />}

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
              <h3 className="text-lg font-semibold text-on-surface">{label}</h3>
              {statusMessage && <p className="text-xs text-on-surface-variant">{statusMessage}</p>}
              {dataCompleteness !== undefined && dataCompleteness < 100 && (
                <p className="text-xs text-amber-600">Based on {dataCompleteness.toFixed(0)}% of data</p>
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

        {/* History and confidence row */}
        <div className="flex items-center justify-between mt-3 gap-4">
          {history && history.length > 0 && <HistorySparkline data={history} />}
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

      {/* Components breakdown */}
      {components.length > 0 && (
        <div className={`p-4 space-y-3 ${isTeaser ? 'blur-sm pointer-events-none' : ''}`}>
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
    </div>
  );
});

export default ScoreCard;
