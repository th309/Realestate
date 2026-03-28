/**
 * Interactive Scatter Plot
 *
 * Score vs Return scatter with filter controls and live correlation stats.
 * Wraps the D3 ScatterPlot component with validation data.
 */

"use client";

import { useState, useMemo } from "react";
import {
  ScatterPlot,
  type ScatterDataPoint,
} from "@/lib/visualizations/d3/ScatterPlot";
import { useValidationScatter } from "@/lib/data";
import type { ValidationGeography, ValidationScoreType } from "@/lib/data";
import { HorizonToggle } from "./HorizonToggle";

const GEO_OPTIONS: { value: ValidationGeography; label: string }[] = [
  { value: "metro", label: "Metro Areas" },
  { value: "county", label: "Counties" },
  { value: "zip", label: "ZIP Codes" },
];

const SCORE_OPTIONS: { value: ValidationScoreType; label: string }[] = [
  { value: "homeready", label: "HomeReady" },
  { value: "investoredge", label: "InvestorEdge" },
  { value: "markethealth", label: "MarketHealth" },
];

/**
 * Official v3 OOS metrics from validation_report.md (2026-03-04).
 * Keyed by `{geography}_{scoreType}`.
 */
const V3_OOS_METRICS: Record<
  string,
  { ic: number; spread: string; hitRate: string }
> = {
  metro_homeready: { ic: 0.3, spread: "2.66 pp", hitRate: "63.8%" },
  metro_investoredge: { ic: 0.372, spread: "5.55 pp", hitRate: "69.5%" },
  metro_markethealth: { ic: 0.366, spread: "3.76 pp", hitRate: "66.6%" },
  county_homeready: { ic: 0.246, spread: "2.49 pp", hitRate: "60.9%" },
  county_investoredge: { ic: 0.246, spread: "2.49 pp", hitRate: "60.9%" },
  county_markethealth: { ic: 0.282, spread: "3.12 pp", hitRate: "65.3%" },
  zip_homeready: { ic: 0.184, spread: "1.69 pp", hitRate: "59.9%" },
  zip_investoredge: { ic: 0.184, spread: "1.69 pp", hitRate: "59.9%" },
  zip_markethealth: { ic: 0.221, spread: "2.16 pp", hitRate: "63.3%" },
};

interface InteractiveScatterProps {
  horizon?: "1y" | "3y";
  onHorizonChange?: (h: "1y" | "3y") => void;
}

export function InteractiveScatter({
  horizon = "3y",
  onHorizonChange,
}: InteractiveScatterProps) {
  const [geography, setGeography] = useState<ValidationGeography>("metro");
  const [scoreType, setScoreType] = useState<ValidationScoreType>("homeready");

  const {
    data: rawData,
    isLoading,
    error,
  } = useValidationScatter({
    geography,
    scoreType,
    horizon,
    limit: 1000,
  });

  const scatterData: ScatterDataPoint[] = useMemo(() => {
    if (!rawData) return [];
    return rawData
      .filter((p) =>
        horizon === "3y"
          ? p.excessVsState3y !== null
          : p.excessVsState1y !== null,
      )
      .map((p) => {
        // Assign quartile category for coloring
        const q =
          p.score < 25
            ? "Q1"
            : p.score < 50
              ? "Q2"
              : p.score < 75
                ? "Q3"
                : "Q4";
        return {
          id: p.geographyId,
          label: p.geographyName,
          x: p.score,
          y: horizon === "3y" ? p.excessVsState3y! : p.excessVsState1y!,
          category: q,
        };
      });
  }, [rawData, horizon]);

  // Official v3 OOS metrics (from walk-forward cross-validation report)
  const oosMetrics = V3_OOS_METRICS[`${geography}_${scoreType}`];

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Interactive Backtest
      </p>
      <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
        See the Correlation for Yourself
      </h2>
      <p className="text-on-surface-variant mt-2 max-w-2xl">
        Every dot is a real market. Higher scores should map to higher 3-year
        excess returns vs state benchmarks. Filter by geography and score type
        to explore.
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

      {/* OOS validation metrics + horizon toggle */}
      {oosMetrics && (
        <div className="flex items-end gap-4 mt-4">
          <div className="bg-surface-container rounded-xl px-4 py-2 border border-outline-variant">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">
              OOS IC
            </p>
            <p className="text-lg font-bold text-primary">
              {oosMetrics.ic.toFixed(3)}
            </p>
          </div>
          <div className="bg-surface-container rounded-xl px-4 py-2 border border-outline-variant">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">
              Quintile Spread
            </p>
            <p className="text-lg font-bold text-on-surface">
              {oosMetrics.spread}
            </p>
          </div>
          <div className="bg-surface-container rounded-xl px-4 py-2 border border-outline-variant">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">
              Hit Rate
            </p>
            <p className="text-lg font-bold text-on-surface">
              {oosMetrics.hitRate}
            </p>
          </div>
          <div className="bg-surface-container rounded-xl px-4 py-2 border border-outline-variant">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">
              Markets
            </p>
            <p className="text-lg font-bold text-on-surface">
              {scatterData.length.toLocaleString()}
            </p>
          </div>
          {onHorizonChange && (
            <div className="ml-auto">
              <HorizonToggle value={horizon} onChange={onHorizonChange} />
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="mt-6 bg-surface-container-low border border-outline-variant rounded-2xl p-4">
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-sm text-on-surface-variant">
              Loading scatter data...
            </div>
          </div>
        ) : error ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-sm text-error">
              Failed to load data. Is the backend running?
            </div>
          </div>
        ) : scatterData.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-sm text-on-surface-variant">
              No data available for this combination.
            </div>
          </div>
        ) : (
          <ScatterPlot
            data={scatterData}
            xLabel="PropertyIQ Score"
            yLabel={`${horizon === "3y" ? "3-Year" : "1-Year"} Excess Return vs State (pp)`}
            xFormat="integer"
            yFormat="percentAbs"
            height={550}
            dotRadius={4}
            showRegression
            colorByCategory
            sizeByValue={false}
          />
        )}
      </div>

      <p className="text-xs text-on-surface-variant mt-2 italic">
        Competitors show a static PNG. Ours is fully interactive &mdash; filter,
        hover, zoom.
      </p>
    </section>
  );
}
