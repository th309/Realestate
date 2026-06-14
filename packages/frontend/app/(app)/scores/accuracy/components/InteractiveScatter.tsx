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

const GEO_OPTIONS: { value: ValidationGeography; label: string }[] = [
  { value: "metro", label: "Metro Areas" },
  { value: "county", label: "Counties" },
  { value: "zip", label: "ZIP Codes" },
];

const SCORE_OPTIONS: { value: ValidationScoreType; label: string }[] = [
  { value: "propertyiq", label: "PropertyIQ" },
];

/**
 * Official out-of-sample metrics for the single PropertyIQ Score.
 * Source: app/scores/methodology/validation-report.md (2026-06-13).
 * Keyed by `{geography}_{scoreType}` where scoreType is always `propertyiq`.
 * `hitRate` here is the share of positive validated years (not a directional
 * accuracy %); it is displayed as "Positive years".
 */
const V3_OOS_METRICS: Record<
  string,
  { ic: number; spread: string; hitRate: string }
> = {
  metro_propertyiq: { ic: 0.273, spread: "1.67 pp", hitRate: "100%" },
  county_propertyiq: { ic: 0.201, spread: "1.50 pp", hitRate: "100%" },
  zip_propertyiq: { ic: 0.196, spread: "1.58 pp", hitRate: "100%" },
};

export function InteractiveScatter() {
  const [geography, setGeography] = useState<ValidationGeography>("metro");
  const [scoreType, setScoreType] = useState<ValidationScoreType>("propertyiq");

  const {
    data: rawData,
    isLoading,
    error,
  } = useValidationScatter({
    geography,
    scoreType,
    horizon: "3y",
    limit: 1000,
  });

  const scatterData: ScatterDataPoint[] = useMemo(() => {
    if (!rawData) return [];
    return rawData
      .filter((p) => p.excessVsState3y !== null)
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
          y: p.excessVsState3y!,
          category: q,
        };
      });
  }, [rawData]);

  // Official v3 walk-forward OOS metrics (authoritative, 3-year horizon)
  const v3Metrics = V3_OOS_METRICS[`${geography}_${scoreType}`];

  const oosMetrics = v3Metrics
    ? {
        ic: v3Metrics.ic,
        spread: v3Metrics.spread,
        // Share of positive validated years (100% at every level).
        hitRate: v3Metrics.hitRate,
      }
    : null;

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

      {/* OOS validation metrics */}
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
              Positive Years
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
            yLabel="3-Year Excess Return vs State (pp)"
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
