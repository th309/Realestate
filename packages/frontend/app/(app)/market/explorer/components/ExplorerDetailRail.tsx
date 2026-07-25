"use client";
import React from "react";
import { titleCaseLocationName } from "@/lib/data";
import type { ScopeRegion } from "@/lib/data/fetchers/market-explorer";
import { DetailRail } from "./DetailRail";
import {
  metricSeriesFor,
  formatExplorerValue,
  TREND_WINDOW_MONTHS,
  type SeriesByMetric,
} from "../lib/explorer-math";
import {
  buildDetailStats,
  coverageConfidence,
} from "../lib/explorer-view-model";
import { CHILD_PLURAL } from "../lib/explorer-labels";
import type { ExplorerAction } from "../lib/explorer-reducer";
import type {
  ExplorerGeoLevel,
  ExplorerMetricConfig,
  ExplorerState,
} from "../lib/explorer-config";

export interface ExplorerDetailRailProps {
  selected: ScopeRegion | null;
  scoreByRegion: Record<string, number | null>;
  series: SeriesByMetric;
  dates: string[];
  monthIndex: number;
  lastIdx: number;
  state: ExplorerState;
  dispatch: (action: ExplorerAction) => void;
  geoLevel: ExplorerGeoLevel;
  scopeName: string | undefined;
  metricCfg: ExplorerMetricConfig;
  isStateScope: boolean;
  onDrillEntity: (id: string) => void;
  onOpenDashboard: (r: { id: string; state: string } | null) => void;
}

export function ExplorerDetailRail({
  selected,
  scoreByRegion,
  series,
  dates,
  monthIndex,
  lastIdx,
  state,
  dispatch,
  geoLevel,
  scopeName,
  metricCfg,
  isStateScope,
  onDrillEntity,
  onOpenDashboard,
}: ExplorerDetailRailProps) {
  if (!selected) return null;
  const selScore = scoreByRegion[selected.id];
  const selMetricSeries = metricSeriesFor(state.metric, series, selected.id);
  const selChildPlural = CHILD_PLURAL[geoLevel];
  // Fixed 6-month lookback for the trend sparkline — see KpiStrip's matching
  // comment: independent of the page-wide "range" preset that governs the
  // main hero chart's zoom.
  const windowStart = Math.max(0, monthIndex - TREND_WINDOW_MONTHS);

  return (
    <DetailRail
      name={titleCaseLocationName(selected.name)}
      sub={`${selected.state} · ${geoLevel}${geoLevel === "metro" ? ` · CBSA ${selected.id}` : ""}`}
      score={selScore}
      isStateScope={isStateScope}
      confidence={coverageConfidence(
        series,
        selected.id,
        monthIndex,
        dates[lastIdx],
      )}
      inherited={
        selScore == null && state.path.length > 0
          ? {
              sourceType: state.path[state.path.length - 1].level as
                | "county"
                | "metro"
                | "state"
                | "national",
              sourceName: scopeName,
            }
          : null
      }
      stats={buildDetailStats(series, selected.id, monthIndex, isStateScope)}
      metricLabel={metricCfg.label}
      metricValueNow={formatExplorerValue(
        selMetricSeries[monthIndex] ?? null,
        metricCfg.format,
      )}
      railSpark={selMetricSeries.slice(windowStart, monthIndex + 1)}
      railMarker={Math.max(0, monthIndex - windowStart)}
      isPinned={state.pinnedIds.includes(selected.id)}
      onTogglePin={() =>
        dispatch({
          type: state.pinnedIds.includes(selected.id) ? "UNPIN" : "PIN",
          id: selected.id,
        })
      }
      hasDrill={geoLevel !== "zip"}
      drillLabel={`Explore ${selChildPlural ?? "detail"} in ${titleCaseLocationName(selected.name)} ↓`}
      onDrill={() => onDrillEntity(selected.id)}
      hasDashboard={geoLevel !== "state"}
      onOpenDashboard={() => onOpenDashboard(selected)}
    />
  );
}
