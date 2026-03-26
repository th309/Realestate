"use client";

import type { WidgetCategory, WidgetStatus } from "./harness-types";
import { WIDGETS, CATEGORY_LABELS, CATEGORY_ORDER } from "./harness-types";

/**
 * Aggregated status bar showing load counts per widget category
 * and a total loaded/expected count.
 */
export function StatusSummary({
  statuses,
}: {
  statuses: Record<string, WidgetStatus>;
}) {
  const categoryCounts: Record<
    WidgetCategory,
    { total: number; loaded: number }
  > = {
    score: { total: 0, loaded: 0 },
    metric: { total: 0, loaded: 0 },
    map: { total: 0, loaded: 0 },
    chart: { total: 0, loaded: 0 },
    report: { total: 0, loaded: 0 },
  };

  for (const widget of WIDGETS) {
    categoryCounts[widget.category].total++;
    if (statuses[widget.id] === "loaded") {
      categoryCounts[widget.category].loaded++;
    }
  }

  const totalWidgets = WIDGETS.length;
  const totalLoaded = Object.values(statuses).filter(
    (s) => s === "loaded",
  ).length;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 12,
          color: "#111827",
        }}
      >
        Status Summary: {totalLoaded}/{totalWidgets} widgets loaded
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {CATEGORY_ORDER.filter((cat) => categoryCounts[cat].total > 0).map(
          (cat) => {
            const { total, loaded } = categoryCounts[cat];
            const allLoaded = loaded === total;
            const noneLoaded = loaded === 0;
            const statusLabel = allLoaded
              ? "[OK]"
              : noneLoaded
                ? "[FAIL]"
                : `[${loaded}/${total}]`;
            const color = allLoaded
              ? "#16a34a"
              : noneLoaded
                ? "#dc2626"
                : "#d97706";

            return (
              <span key={cat} style={{ fontSize: 13, color: "#374151" }}>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 600,
                    color,
                    marginRight: 4,
                  }}
                >
                  {statusLabel}
                </span>
                {CATEGORY_LABELS[cat]} ({loaded}/{total})
              </span>
            );
          },
        )}
      </div>
    </div>
  );
}
