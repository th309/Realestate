"use client";

import React from "react";
import { Eye, TrendingUp, TrendingDown, Minus } from "lucide-react";

import { SectionCard, AIAnalysisBlock } from "../core";
import type { ReportInstance } from "../../../../types";
import {
  getV2JsonSection,
  type V2WhatToWatch,
  type V2WatchMetric,
} from "./narrativeVersionDetector";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface V2WatchMetricsSectionProps {
  report: ReportInstance;
  /** The v2 section ID (e.g. 'what_to_watch') */
  sectionId: string;
  /** Display title */
  title?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DirectionIcon({ direction }: { direction: string }) {
  const iconClass = "w-4 h-4 flex-shrink-0";
  if (direction === "up") {
    return (
      <TrendingUp
        className={iconClass}
        style={{ color: "var(--report-success)" }}
      />
    );
  }
  if (direction === "down") {
    return (
      <TrendingDown
        className={iconClass}
        style={{ color: "var(--report-error)" }}
      />
    );
  }
  return (
    <Minus
      className={iconClass}
      style={{ color: "var(--report-stone-light)" }}
    />
  );
}

function WatchMetricCard({ metric }: { metric: V2WatchMetric }) {
  return (
    <div
      className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
      style={{
        backgroundColor: "white",
        border: "1px solid rgba(27, 46, 74, 0.08)",
      }}
    >
      <div className="flex items-start gap-3">
        <DirectionIcon direction={metric.direction} />
        <div className="flex-1 min-w-0">
          <p
            className="text-[0.9375rem] font-medium leading-snug mb-1"
            style={{ color: "var(--report-navy)" }}
          >
            {metric.metric}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-1.5">
            <span style={{ color: "var(--report-stone)" }}>
              Current:{" "}
              <span className="font-medium">{String(metric.current)}</span>
            </span>
            <span style={{ color: "var(--report-stone)" }}>
              Threshold:{" "}
              <span className="font-medium">{String(metric.threshold)}</span>
            </span>
          </div>
          {metric.rationale && (
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--report-stone)" }}
            >
              {metric.rationale}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a v2 what_to_watch section.
 *
 * Displays structured watch metrics with current values, thresholds,
 * direction indicators, and rationale. Also renders the scenario text.
 */
export function V2WatchMetricsSection({
  report,
  sectionId,
  title = "What to Watch",
  className = "",
}: V2WatchMetricsSectionProps): React.ReactElement | null {
  const data = getV2JsonSection<V2WhatToWatch>(report, sectionId);

  if (!data) return null;

  const metrics = data.metrics ?? [];
  const scenario = data.scenario;

  return (
    <SectionCard title={title} icon={Eye} className={className}>
      {/* Watch metrics */}
      {metrics.length > 0 && (
        <div className="space-y-3 mb-[var(--report-space-xl)]">
          {metrics.map((metric, idx) => (
            <WatchMetricCard key={idx} metric={metric} />
          ))}
        </div>
      )}

      {/* Scenario analysis */}
      {scenario && (
        <div>
          <h3
            className="report-heading-sm mb-[var(--report-space-md)]"
            style={{ color: "var(--report-navy)" }}
          >
            Scenario Outlook
          </h3>
          <AIAnalysisBlock content={scenario} variant="summary" />
        </div>
      )}
    </SectionCard>
  );
}
