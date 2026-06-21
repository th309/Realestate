"use client";

import React from "react";
import type { ReportInstance } from "../../../types";
import { formatMetricValue, getMetricFormat } from "@/lib/data";
import { MetricTitle } from "@/app/components/MetricTitle";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface ComparisonTableProps {
  report: ReportInstance;
}

// Default metrics to compare when no config provided
const DEFAULT_METRICS = [
  "home_value",
  "days_on_market",
  "for_sale_inventory",
  "hotness_score",
  "median_income",
  "cap_rate",
];

interface Geography {
  id: string;
  name: string;
}

export function ComparisonTable({ report }: ComparisonTableProps) {
  const metrics = DEFAULT_METRICS;

  const geographies: Geography[] = [
    { id: report.primary_geography_id, name: report.primary_geography_name },
    ...(report.comparison_geographies || []),
  ];

  const getValue = (geo: Geography, metric: string): number | null => {
    if (geo.id === report.primary_geography_id) {
      // Primary geography - use current data
      const value = report.populated_data?.current?.[metric];
      return value !== undefined && value !== null ? Number(value) : null;
    } else {
      // Comparison geography - use comparisons data
      const compData = report.populated_data?.comparisons?.[geo.id];
      const value = compData?.current?.[metric];
      return value !== undefined && value !== null ? Number(value) : null;
    }
  };

  // Determine winner for each metric (higher is better for most, lower for some)
  const lowerIsBetter = ["days_on_market", "vacancy_rate", "unemployment_rate"];

  function getWinner(metric: string, values: (number | null)[]): number {
    const validValues = values.filter((v): v is number => v !== null);
    if (validValues.length === 0) return -1;
    if (lowerIsBetter.includes(metric)) {
      return values.indexOf(Math.min(...validValues));
    }
    return values.indexOf(Math.max(...validValues));
  }

  // Check if we have any data to display
  const hasData = report.populated_data?.current != null;

  if (!hasData) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">
          Comparison Table
        </h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Comparison data not available</span>
        </div>
      </div>
    );
  }

  // Precompute each metric row once so the mobile card layout and the desktop
  // table render identical values / winner highlighting.
  const rows = metrics.map((metric) => {
    const values = geographies.map((geo) => getValue(geo, metric));
    return { metric, values, winner: getWinner(metric, values) };
  });

  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden">
      {/* Mobile: one card per metric \u2014 geographies stack, never scrolls sideways */}
      <div className="divide-y divide-outline-variant md:hidden">
        {rows.map(({ metric, values, winner }) => (
          <div key={metric} className="p-4">
            <div className="mb-2 text-sm font-semibold text-on-surface">
              <MetricTitle metricId={metric} />
            </div>
            <div className="space-y-1.5">
              {geographies.map((geo, index) => (
                <div
                  key={geo.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span
                    className={`min-w-0 truncate text-sm ${index === 0 ? "font-medium text-primary" : "text-on-surface-variant"}`}
                  >
                    {geo.name}
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-1">
                    <span
                      className={`text-sm font-medium ${index === winner ? "text-green-600" : "text-on-surface"}`}
                    >
                      {values[index] != null
                        ? formatMetricValue(
                            values[index] as number,
                            getMetricFormat(metric),
                          )
                        : "\u2014"}
                    </span>
                    {index === winner && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: comparison table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left p-4 text-on-surface font-semibold">
                Metric
              </th>
              {geographies.map((geo, index) => (
                <th
                  key={geo.id}
                  className={`text-center p-4 font-semibold ${index === 0 ? "text-primary" : "text-on-surface"}`}
                >
                  {geo.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ metric, values, winner }) => (
              <tr
                key={metric}
                className="border-b border-outline-variant last:border-0"
              >
                <td className="p-4 text-on-surface">
                  <MetricTitle metricId={metric} />
                </td>
                {values.map((value, index) => (
                  <td key={index} className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span
                        className={`font-medium ${index === winner ? "text-green-600" : "text-on-surface"}`}
                      >
                        {value != null
                          ? formatMetricValue(value, getMetricFormat(metric))
                          : "\u2014"}
                      </span>
                      {index === winner && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
