"use client";

import React from "react";
import {
  Target,
  Eye,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

import { SectionCard } from "../core";
import type { ReportInstance } from "../../../../types";
import {
  getV2JsonSection,
  type V2ActionsAndMonitoring,
  type V2ActionItem,
  type V2WatchMetric,
} from "./narrativeVersionDetector";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface V2ActionsMonitoringSectionProps {
  report: ReportInstance;
  /** The v2 section ID (e.g. 'actions_and_monitoring') */
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a v2 actions_and_monitoring section (InvestorEdge).
 *
 * Combines structured action cards and monitoring metrics into one view.
 */
export function V2ActionsMonitoringSection({
  report,
  sectionId,
  title = "Actions & Monitoring",
  className = "",
}: V2ActionsMonitoringSectionProps): React.ReactElement | null {
  const data = getV2JsonSection<V2ActionsAndMonitoring>(report, sectionId);

  if (!data) return null;

  const actions = data.actions ?? [];
  const metrics = data.metrics ?? [];

  return (
    <SectionCard title={title} icon={Target} className={className}>
      {/* Action cards */}
      {actions.length > 0 && (
        <div className="mb-[var(--report-space-xl)]">
          <h3
            className="report-heading-sm mb-[var(--report-space-md)]"
            style={{ color: "var(--report-navy)" }}
          >
            Recommended Actions
          </h3>
          <div className="space-y-3">
            {actions.map((item: V2ActionItem, idx: number) => (
              <div
                key={idx}
                className="rounded-[var(--report-radius-md)] p-[var(--report-space-md)]"
                style={{
                  backgroundColor: "white",
                  border: "1px solid rgba(27, 46, 74, 0.08)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--report-navy)",
                      color: "white",
                      fontFamily: "var(--report-font-display)",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[0.9375rem] font-medium leading-snug mb-1"
                      style={{ color: "var(--report-navy)" }}
                    >
                      {item.action}
                    </p>
                    {item.rationale && (
                      <p
                        className="text-sm leading-relaxed mb-1.5"
                        style={{ color: "var(--report-stone)" }}
                      >
                        {item.rationale}
                      </p>
                    )}
                    {item.timeframe && (
                      <div className="flex items-center gap-1.5">
                        <Clock
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: "var(--report-navy-light)" }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: "var(--report-navy-light)" }}
                        >
                          {item.timeframe}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monitoring metrics */}
      {metrics.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-[var(--report-space-md)]">
            <Eye
              className="w-4 h-4 flex-shrink-0"
              style={{ color: "var(--report-navy-light)" }}
            />
            <h3
              className="report-heading-sm"
              style={{ color: "var(--report-navy)" }}
            >
              Key Metrics to Monitor
            </h3>
          </div>
          <div className="space-y-3">
            {metrics.map((metric: V2WatchMetric, idx: number) => (
              <div
                key={idx}
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
                        <span className="font-medium">
                          {String(metric.current)}
                        </span>
                      </span>
                      <span style={{ color: "var(--report-stone)" }}>
                        Threshold:{" "}
                        <span className="font-medium">
                          {String(metric.threshold)}
                        </span>
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
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
