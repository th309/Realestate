"use client";
import React, { useMemo } from "react";
import { BubbleChart } from "./BubbleChart";
import { GeoTileMap } from "./GeoTileMap";
import {
  buildBubbleScalars,
  collectAllMetricValues,
} from "../lib/explorer-view-model";
import type { SeriesByMetric } from "../lib/explorer-math";
import { computeMetricBounds, niceBubbleBounds } from "../lib/explorer-scale";
import type { ExplorerFormat, ExplorerMetricId } from "../lib/explorer-config";
import type { ScopeRegion } from "@/lib/data/fetchers/market-explorer";
import type { GeoBoundaries } from "../lib/useGeoBoundaries";

export interface AnimatedHeroChartProps {
  view: "bubbles" | "map";
  boundaries: GeoBoundaries;
  regions: ScopeRegion[];
  series: SeriesByMetric;
  metricId: ExplorerMetricId;
  monthIndex: number;
  lastIdx: number;
  playing: boolean;
  format: ExplorerFormat;
  axisLabel: string;
  selectedId: string | null;
  pinnedIds: string[];
  onSelect: (id: string) => void;
  onDrill: (id: string) => void;
}

/**
 * Computes the CURRENT month's baseline snapshot plus the NEXT month's
 * snapshot (when playing), and hands both straight to BubbleChart/GeoTileMap
 * — those components own the actual frame-by-frame blend themselves, via
 * `useTickInterpolation` writing interpolated attributes directly onto their
 * DOM nodes every requestAnimationFrame tick. This component does NOT drive
 * any per-frame state: an earlier version tracked a blend fraction `t` in
 * React state (`usePlaybackFraction`, throttled to ~24fps) and recomputed a
 * blended scalar map on every tick, which forced a full React reconciliation
 * of up to 935 SVG elements per frame — even throttled, that reconciliation
 * cost made frame pacing irregular ("jerky") despite the interpolated VALUES
 * being mathematically correct. Only `current`/`next`/the GLOBAL bounds
 * below change here, and only once per month boundary (~every 380ms), which
 * is cheap; see BubbleChart's and GeoTileMap's `next`/`nextColorByRegion`
 * prop docs for the per-frame half of this fix.
 */
export function AnimatedHeroChart({
  view,
  boundaries,
  regions,
  series,
  metricId,
  monthIndex,
  lastIdx,
  playing,
  format,
  axisLabel,
  selectedId,
  pinnedIds,
  onSelect,
  onDrill,
}: AnimatedHeroChartProps) {
  const nextIndex = Math.min(monthIndex + 1, lastIdx);

  // GLOBAL bounds — computed once across every region AND every month, not
  // per-frame from whatever the current snapshot happens to contain. Without
  // this, the axis/color scale itself rescales on every tick (on top of, and
  // easily mistaken for, the dots' own motion), which is what reads as a
  // "snap" even once the position/color VALUES are interpolating correctly.
  // Mirrors the graphs page's D3 scatter race, which fixes its axis domains
  // across the whole animation for the same reason.
  const allMetricValues = useMemo(
    () => collectAllMetricValues(regions, series, metricId),
    [regions, series, metricId],
  );
  const colorBounds = useMemo(
    () => computeMetricBounds(allMetricValues, format),
    [allMetricValues, format],
  );
  const yBounds = useMemo<[number, number] | undefined>(() => {
    if (!allMetricValues.length) return undefined;
    return [Math.min(...allMetricValues), Math.max(...allMetricValues)];
  }, [allMetricValues]);
  const xBounds = useMemo(() => {
    const prices: number[] = [];
    for (const e of regions) {
      for (const v of series.home_value?.[e.id] ?? []) {
        if (v != null) prices.push(v);
      }
    }
    return niceBubbleBounds(prices);
  }, [regions, series]);

  const current = useMemo(
    () =>
      buildBubbleScalars(regions, series, metricId, monthIndex, colorBounds),
    [regions, series, metricId, monthIndex, colorBounds],
  );
  const next = useMemo(
    () =>
      nextIndex === monthIndex
        ? undefined
        : buildBubbleScalars(regions, series, metricId, nextIndex, colorBounds),
    [regions, series, metricId, nextIndex, monthIndex, colorBounds],
  );

  if (view === "map") {
    return (
      <GeoTileMap
        boundaries={boundaries}
        colorByRegion={current.colorByRegion}
        nextColorByRegion={next?.colorByRegion}
        valueByRegion={current.yByRegion}
        format={format}
        selectedId={selectedId}
        playing={playing}
        onSelect={onSelect}
        onDrill={onDrill}
      />
    );
  }
  return (
    <BubbleChart
      entities={regions}
      xByRegion={current.xByRegion}
      yByRegion={current.yByRegion}
      colorByRegion={current.colorByRegion}
      radiusByRegion={current.radiusByRegion}
      next={next}
      xBounds={xBounds}
      yBounds={yBounds}
      axisLabel={axisLabel}
      format={format}
      selectedId={selectedId}
      pinnedIds={pinnedIds}
      playing={playing}
      onSelect={onSelect}
      onDrill={onDrill}
    />
  );
}
