/**
 * ProgressiveFlow
 *
 * Table-based navigation flow visualization showing From → To page transitions
 * with session counts and share of total traffic. Rows are clickable for drill-down.
 * Includes a toggle for a future Sankey view (currently shows a placeholder).
 */

"use client";

import { useState } from "react";
import { ArrowRight, BarChart2, Network } from "lucide-react";
import type { NavigationFlow } from "@/lib/data/fetchers/admin-analytics.types";

interface ProgressiveFlowProps {
  flows: NavigationFlow[];
  onDrillDown?: (key: string, value: string) => void;
}

type ViewMode = "flow" | "sankey";

function truncatePath(path: string, maxLength = 40): string {
  return path.length > maxLength ? `${path.slice(0, maxLength)}…` : path;
}

function FlowTableView({
  flows,
  totalTransitions,
  onDrillDown,
}: {
  flows: NavigationFlow[];
  totalTransitions: number;
  onDrillDown?: (key: string, value: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant">
            <th className="text-left py-3 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              From Page
            </th>
            <th className="w-6" />
            <th className="text-left py-3 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              To Page
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              Transitions
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              % of Total
            </th>
          </tr>
        </thead>
        <tbody>
          {flows.map((flow, index) => {
            const sharePercent =
              totalTransitions > 0
                ? ((flow.transitions / totalTransitions) * 100).toFixed(1)
                : "0.0";

            return (
              <tr
                key={`${flow.fromPage}-${flow.toPage}-${index}`}
                onClick={() => onDrillDown?.("fromPage", flow.fromPage)}
                className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container cursor-pointer transition-colors"
              >
                <td className="py-3 px-4 font-mono text-xs text-on-surface">
                  <span
                    title={flow.fromPage}
                    className="inline-block max-w-[220px] truncate align-bottom"
                  >
                    {truncatePath(flow.fromPage)}
                  </span>
                </td>
                <td className="text-on-surface-variant">
                  <ArrowRight className="w-3.5 h-3.5" />
                </td>
                <td className="py-3 px-4 font-mono text-xs text-on-surface">
                  <span
                    title={flow.toPage}
                    className="inline-block max-w-[220px] truncate align-bottom"
                  >
                    {truncatePath(flow.toPage)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-on-surface">
                  {flow.transitions.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-on-surface-variant">
                  {sharePercent}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SankeyPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
      <Network className="w-10 h-10 opacity-40" />
      <p className="text-sm font-medium">Sankey diagram coming soon</p>
      <p className="text-xs opacity-70">
        This view will render an interactive flow diagram once d3-sankey is
        integrated.
      </p>
    </div>
  );
}

export function ProgressiveFlow({ flows, onDrillDown }: ProgressiveFlowProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("flow");

  const sortedFlows = [...flows]
    .sort((a, b) => b.transitions - a.transitions)
    .slice(0, 20);

  const totalTransitions = flows.reduce((sum, f) => sum + f.transitions, 0);

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
        <div>
          <h3 className="text-sm font-medium text-on-surface">
            Navigation Flows
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Top 20 page transitions by volume
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-1 bg-surface-container rounded-lg">
          <button
            onClick={() => setViewMode("flow")}
            aria-label="Flow table view"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "flow"
                ? "bg-surface-container-high text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Flow View
          </button>
          <button
            onClick={() => setViewMode("sankey")}
            aria-label="Sankey diagram view"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === "sankey"
                ? "bg-surface-container-high text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Sankey View
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "flow" ? (
        sortedFlows.length > 0 ? (
          <FlowTableView
            flows={sortedFlows}
            totalTransitions={totalTransitions}
            onDrillDown={onDrillDown}
          />
        ) : (
          <div className="py-12 text-center text-sm text-on-surface-variant">
            No navigation flow data available for this period.
          </div>
        )
      ) : (
        <SankeyPlaceholder />
      )}
    </div>
  );
}
