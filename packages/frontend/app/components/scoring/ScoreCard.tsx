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

"use client";

import { memo, useState } from "react";
import { trackEvent } from "@/lib/analytics/tracker";
import { useInsight } from "@/lib/data";
import { EntitlementGate } from "@/components/entitlements";
import {
  ScoreBadge,
  ScoreType,
  TrendDirection,
  ScoreAccess,
  ScoreStatus,
} from "./ScoreBadge";
import { ComponentBar } from "./ComponentBar";
import { ConfidenceDisplay } from "./ConfidenceDisplay";
import { HistorySparkline, CloseIcon } from "./ScoreCardHelpers";
import dynamic from "next/dynamic";

// Dynamically import the history chart to avoid SSR issues with recharts
const ScoreHistoryChart = dynamic(
  () => import("./ScoreHistoryChart").then((mod) => mod.ScoreHistoryChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 bg-outline-variant/20 rounded animate-pulse" />
    ),
  },
);

// Types for score card data
interface MetricDetail {
  name: string;
  label: string;
  value: number | null;
  formatted: string;
  isInherited: boolean;
  sourceGeographyType?: string;
  impact: "positive" | "negative" | "neutral";
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
  level: "a" | "b" | "c" | "f";
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
  predictedVsActual?: "outperformed" | "underperformed" | "matched";
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

// ---------------------------------------------------------------------------
// PropertyIQ v4 sub-components (rendered when type === 'propertyiq')
// ---------------------------------------------------------------------------

interface InputMetricRowProps {
  name: string;
  value: string;
  percentile?: number;
}

function InputMetricRow({ name, value, percentile }: InputMetricRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-b-0">
      <span className="text-sm text-on-surface-variant">{name}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium font-mono text-on-surface">
          {value}
        </span>
        {percentile !== undefined && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container">
            {percentile}th
          </span>
        )}
      </div>
    </div>
  );
}

function AlphaSummaryLine({ score }: { score: number }) {
  const ranges = [
    { min: 1, max: 20, excess: -3.34 },
    { min: 21, max: 40, excess: -1.2 },
    { min: 41, max: 60, excess: -0.15 },
    { min: 61, max: 80, excess: 1.17 },
    { min: 81, max: 99, excess: 3.05 },
  ];
  const entry = ranges.find((r) => score >= r.min && score <= r.max);
  if (!entry) return null;
  const sign = entry.excess >= 0 ? "+" : "";
  return (
    <div className="mt-3 px-3 py-2 rounded-lg bg-primary-container/40 text-sm font-medium text-on-primary-container">
      Score {score} → historically {sign}
      {entry.excess.toFixed(1)}% vs state avg over 3Y
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
  className = "",
  geographyType,
  geographyId,
  validation,
  showHistoryButton = false,
}: ScoreCardProps) {
  const [showExtendedHistory, setShowExtendedHistory] = useState(false);
  const isTeaser = access === "teaser";

  // Fetch AI-generated score explanation for this geography
  const { insight: scoreExplanation, loading: insightLoading } = useInsight(
    geographyType ?? null,
    geographyId ?? null,
    "score_explanation",
  );

  // Score type for history chart — only PropertyIQ is supported
  const scoreTypeForChart = "propertyiq" as const;

  return (
    <div
      className={`relative bg-surface-container-low rounded-xl shadow-sm border border-outline-variant overflow-hidden ${className}`}
    >
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
                <h3 className="text-lg font-semibold text-on-surface">
                  {label}
                </h3>
                {/* Validation badge */}
                {validation?.hasOutcomes && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-container text-on-primary-container">
                    Validated
                  </span>
                )}
              </div>
              {statusMessage && (
                <p className="text-xs text-on-surface-variant">
                  {statusMessage}
                </p>
              )}
              {dataCompleteness !== undefined && dataCompleteness < 100 && (
                <p className="text-xs text-amber-600">
                  Based on {dataCompleteness.toFixed(0)}% of data
                </p>
              )}
              {/* 3Y Excess Return summary */}
              {validation?.hasOutcomes && validation.excessReturn3Y != null && (
                <p
                  className={`text-xs font-medium ${
                    validation.excessReturn3Y > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  3Y Excess: {validation.excessReturn3Y > 0 ? "+" : ""}
                  {validation.excessReturn3Y.toFixed(1)}% vs state
                </p>
              )}
              {/* AI-generated "Why this score" explanation */}
              {!insightLoading && scoreExplanation && (
                <EntitlementGate type="feature" id="ai_insights">
                  <p className="text-sm text-on-surface-variant italic mt-1">
                    {scoreExplanation}
                  </p>
                </EntitlementGate>
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
            {history && history.length > 0 && (
              <HistorySparkline data={history} />
            )}
            {/* View History button */}
            {showHistoryButton && geographyType && geographyId && (
              <button
                onClick={() => {
                  if (!showExtendedHistory) {
                    trackEvent("feature.score_expand", {
                      score_type: type,
                      geography_type: geographyType,
                    });
                  }
                  setShowExtendedHistory(!showExtendedHistory);
                }}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {showExtendedHistory ? "Hide History" : "View History"}
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
            scoreType={scoreTypeForChart}
          />
        </div>
      )}

      {/* Components breakdown — PropertyIQ v4 shows input metrics; legacy shows ComponentBar */}
      {type === "propertyiq"
        ? score !== null && (
            <div className="p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-on-surface-variant mb-2">
                Input Metrics
              </div>
              {/* Rows will be populated when backend provides per-metric data */}
              <AlphaSummaryLine score={score} />
            </div>
          )
        : components.length > 0 &&
          !isTeaser && (
            <div className="p-4 space-y-3">
              <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
                Components
              </h4>
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
            <p className="text-sm font-medium text-on-surface mb-1">
              {upgradeCta.headline}
            </p>
            <p className="text-xs text-on-surface-variant mb-3">
              {upgradeCta.description}
            </p>
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
