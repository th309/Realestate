/**
 * Quintile Performance Chart
 *
 * Bar chart showing returns by score quintile with dollar overlay.
 * Client component — fetches from validation API.
 */

"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { CheckCircle } from "lucide-react";
import { useValidationQuintiles } from "@/lib/data";
import type { ValidationGeography, ValidationScoreType } from "@/lib/data";

const QUINTILE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#059669"];
const MEDIAN_HOME = 240_000;

/**
 * Official v3 OOS quintile spreads from validation_report.md (2026-03-04).
 * Keyed by `{geography}_{scoreType}`. Values in percentage points.
 */
const V3_OOS_SPREAD: Record<string, number> = {
  metro_homeready: 2.66,
  metro_investoredge: 5.55,
  metro_markethealth: 3.76,
  county_homeready: 2.49,
  county_investoredge: 2.49,
  county_markethealth: 3.12,
  zip_homeready: 1.69,
  zip_investoredge: 1.69,
  zip_markethealth: 2.16,
};

const GEO_OPTIONS: { value: ValidationGeography; label: string }[] = [
  { value: "metro", label: "Metro Areas" },
  { value: "county", label: "Counties" },
  { value: "zip", label: "ZIP Codes" },
];

const SCORE_OPTIONS: { value: ValidationScoreType; label: string }[] = [
  { value: "investoredge", label: "InvestorEdge" },
  { value: "homeready", label: "HomeReady" },
  { value: "markethealth", label: "MarketHealth" },
];

export function QuintilePerformance() {
  const [geography, setGeography] = useState<ValidationGeography>("metro");
  const [scoreType, setScoreType] =
    useState<ValidationScoreType>("investoredge");

  const {
    data: rawData,
    isLoading,
    error,
  } = useValidationQuintiles({
    geography,
    scoreType,
    horizon: "3y",
  });

  const chartData = useMemo(() => {
    if (!rawData) return [];
    return rawData.map((q) => {
      const ret = q.avgExcessVsState3y ?? 0;
      const dollarImpact = Math.round((ret / 100) * MEDIAN_HOME);
      return {
        name: q.label,
        quintile: q.quintile,
        scoreRange: `${q.scoreMin.toFixed(0)}\u2013${q.scoreMax.toFixed(0)}`,
        return: ret,
        dollarImpact,
        count: q.count,
      };
    });
  }, [rawData]);

  // Check monotonicity
  const isMonotonic = useMemo(() => {
    if (chartData.length < 2) return false;
    for (let i = 1; i < chartData.length; i++) {
      if (chartData[i].return < chartData[i - 1].return) return false;
    }
    return true;
  }, [chartData]);

  // Official OOS spread from v3 validation report
  const oosSpread = V3_OOS_SPREAD[`${geography}_${scoreType}`] ?? 0;
  const oosDollarSpread = Math.round((oosSpread / 100) * MEDIAN_HOME);

  if (isLoading) {
    return (
      <section>
        <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-6">
          <div className="h-4 w-60 bg-outline-variant/30 rounded animate-pulse mb-4" />
          <div className="h-80 bg-outline-variant/20 rounded animate-pulse" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-6">
          <p className="text-sm text-error">Failed to load quintile data.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Quintile Analysis
      </p>
      <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
        Higher Scores = Higher Returns. Every. Single. Time.
      </h2>
      <p className="text-on-surface-variant mt-2 max-w-2xl">
        Markets divided into five equal groups by score. Returns measured as
        3-year excess vs state benchmark — the same metric our model optimizes
        for.
      </p>

      {/* Filter controls */}
      <div className="flex flex-wrap gap-3 mt-6">
        <div className="flex items-center gap-2">
          <label className="text-xs text-on-surface-variant font-medium">
            Geography
          </label>
          <select
            value={geography}
            onChange={(e) =>
              setGeography(e.target.value as ValidationGeography)
            }
            className="text-sm bg-surface-container border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface"
          >
            {GEO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-on-surface-variant font-medium">
            Score
          </label>
          <select
            value={scoreType}
            onChange={(e) =>
              setScoreType(e.target.value as ValidationScoreType)
            }
            className="text-sm bg-surface-container border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface"
          >
            {SCORE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 bg-surface-container-low border border-outline-variant rounded-2xl p-6">
        {/* Header stats */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {isMonotonic && (
              <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-semibold">
                <CheckCircle className="w-3.5 h-3.5" />
                Perfect Monotonic
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-on-surface-variant">
              OOS Quintile Spread
            </p>
            <p className="text-xl font-bold text-primary">
              +{oosSpread.toFixed(2)}pp
            </p>
            <p className="text-xs text-on-surface-variant">
              = ${oosDollarSpread.toLocaleString()}/yr on $240K home
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--outline-variant)"
                opacity={0.5}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--on-surface-variant)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--outline-variant)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--on-surface-variant)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--outline-variant)" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--surface-container)",
                  border: "1px solid var(--outline-variant)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [
                  `${value?.toFixed(2)}%`,
                  "Excess Return",
                ]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  if (!item) return label;
                  return `${label} (Score: ${item.scoreRange}, n=${item.count})`;
                }}
              />
              <ReferenceLine
                y={0}
                stroke="var(--outline)"
                strokeDasharray="3 3"
              />
              <Bar dataKey="return" name="Excess Return" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={QUINTILE_COLORS[index] || "#3949AB"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Dollar annotations below chart — padded to align with bar area */}
        <div
          className="grid grid-cols-5 gap-1 mt-4"
          style={{ marginLeft: 55, marginRight: 10 }}
        >
          {chartData.map((entry) => (
            <div key={entry.name} className="text-center">
              <p className="text-[10px] text-on-surface-variant font-medium">
                {entry.dollarImpact >= 0 ? "+" : "-"}$
                {Math.abs(entry.dollarImpact).toLocaleString()}
              </p>
              <p className="text-[9px] text-on-surface-variant/60">per year</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
