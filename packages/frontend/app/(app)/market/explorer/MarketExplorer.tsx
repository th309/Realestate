"use client";
import React, { useEffect, useMemo, useReducer } from "react";
import { useRouter } from "next/navigation";
import {
  isMetricSupportedForGeo,
  titleCaseLocationName,
  type GeoLevel,
} from "@/lib/data";
import {
  explorerReducer,
  initialExplorerState,
  resolveScope,
} from "./lib/explorer-reducer";
import { useExplorerScopeData } from "./lib/useExplorerScopeData";
import {
  EXPLORER_METRICS,
  RANGE_PRESETS,
  type ExplorerMetricId,
} from "./lib/explorer-config";
import {
  aggregateScopeKpis,
  computeMovers,
  metricSeriesFor,
  latestScoredMonthIndex,
  formatExplorerValue,
} from "./lib/explorer-math";
import {
  buildBubbleScalars,
  buildLeaderboardRows,
  buildDetailStats,
  coverageConfidence,
} from "./lib/explorer-view-model";
import { buildBreadcrumbs, buildLevelTabs } from "./lib/explorer-navigation";
import { GeoDrillBar } from "./components/GeoDrillBar";
import { MetricSwitcher } from "./components/MetricSwitcher";
import { KpiStrip } from "./components/KpiStrip";
import { HeroVisualization } from "./components/HeroVisualization";
import { BubbleChart } from "./components/BubbleChart";
import { GeoTileMap } from "./components/GeoTileMap";
import { useGeoBoundaries } from "./lib/useGeoBoundaries";
import { TimelineScrubber } from "./components/TimelineScrubber";
import { DetailRail } from "./components/DetailRail";
import { MarketExplorerAnalytics } from "./MarketExplorerAnalytics";
import { UNIT_PLURAL, CHILD_PLURAL, monthLabelOf } from "./lib/explorer-labels";

export default function MarketExplorer() {
  const router = useRouter();
  const [state, dispatch] = useReducer(explorerReducer, initialExplorerState);
  const scope = resolveScope(state);
  const scopeKey = `${scope.geoLevel}:${scope.parentId ?? ""}:${state.view}`;

  const { dates, regions, series, totalAvailable, isLoading, error } =
    useExplorerScopeData(
      scope.geoLevel,
      scope.parentLevel,
      scope.parentId,
      state.includeNearby,
    );
  // Nearby overlay is available whenever a parent scope exists (drilled in).
  const hasNearby = !!scope.parentId;

  const parentState =
    scope.geoLevel === "zip"
      ? state.path[state.path.length - 1]?.state
      : undefined;
  const boundaries = useGeoBoundaries(
    scope.geoLevel,
    scope.parentLevel,
    scope.parentId,
    parentState,
    regions.map((r) => r.id),
  );

  // series is a fresh object every render (useExplorerScopeData doesn't
  // memoize it), so depend on this primitive index rather than series itself
  // — otherwise the reset effect below would refire and dispatch every render.
  const latestScoredIdx = useMemo(
    () => latestScoredMonthIndex(series.propertyiq_score, dates.length),
    [series.propertyiq_score, dates.length],
  );

  // Reset month to the latest scored month + selection to first whenever the
  // scope changes.
  useEffect(() => {
    if (dates.length)
      dispatch({ type: "SET_MONTH", monthIndex: latestScoredIdx });
  }, [scopeKey, dates.length, latestScoredIdx]);
  useEffect(() => {
    if (regions.length && !regions.some((r) => r.id === state.selectedId)) {
      dispatch({ type: "SELECT", id: regions[0].id });
    }
  }, [scopeKey, regions, state.selectedId]);

  const lastIdx = Math.max(0, dates.length - 1);
  const mi = Math.min(state.monthIndex, lastIdx);
  const windowStart = Math.max(0, dates.length - state.range);
  const metricCfg = EXPLORER_METRICS.find((m) => m.id === state.metric)!;
  const selected =
    regions.find((r) => r.id === state.selectedId) ?? regions[0] ?? null;

  const scalars = useMemo(
    () => buildBubbleScalars(regions, series, state.metric, mi),
    [regions, series, state.metric, mi],
  );
  const agg = useMemo(
    () =>
      aggregateScopeKpis(
        regions.map((r) => r.id),
        series,
        dates.length,
      ),
    [regions, series, dates.length],
  );
  const movers = useMemo(
    () => computeMovers(regions, series.propertyiq_score ?? {}, mi),
    [regions, series, mi],
  );
  const rows = useMemo(
    () =>
      buildLeaderboardRows(regions, series, state.metric, mi, windowStart, 15),
    [regions, series, state.metric, mi, windowStart],
  );
  const donutScores = regions
    .map((r) => scalars.scoreByRegion[r.id])
    .filter((v): v is number => v != null);

  const unitPlural = UNIT_PLURAL[scope.geoLevel];
  const scopeName = state.path[state.path.length - 1]?.name;

  // ── handlers ──
  const onSelect = (id: string) => dispatch({ type: "SELECT", id });
  const onDrillEntity = (id: string) => {
    if (scope.geoLevel === "zip") return; // no level below ZIP to drill into
    const r = regions.find((e) => e.id === id);
    if (!r) return;
    dispatch({
      type: "DRILL",
      crumb: { level: scope.geoLevel, id, name: r.name, state: r.state },
    });
  };
  const openDashboard = (r: { id: string; state: string } | null) => {
    if (!r) return;
    const params = new URLSearchParams({ type: scope.geoLevel });
    if (r.state) params.set("state", r.state);
    router.push(`/market/${r.id}?${params.toString()}`);
  };

  // ── breadcrumbs + level tabs ──
  const crumbs = buildBreadcrumbs(state, dispatch);
  const levelTabs = buildLevelTabs(
    state,
    scope.geoLevel,
    dispatch,
    selected ? () => onDrillEntity(selected.id) : null,
  );

  const disabledMetricIds = EXPLORER_METRICS.filter(
    (m) =>
      m.source.kind === "fetched" &&
      !isMetricSupportedForGeo(m.source.series, scope.geoLevel as GeoLevel) &&
      !series[m.source.series],
  ).map((m) => m.id) as ExplorerMetricId[];

  // ── hero chart ──
  const heroChart =
    state.view === "map" ? (
      <GeoTileMap
        boundaries={boundaries}
        colorByRegion={scalars.colorByRegion}
        valueByRegion={scalars.yByRegion}
        format={metricCfg.format}
        selectedId={state.selectedId}
        onSelect={onSelect}
        onDrill={onDrillEntity}
      />
    ) : (
      <BubbleChart
        entities={regions}
        xByRegion={scalars.xByRegion}
        yByRegion={scalars.yByRegion}
        colorByRegion={scalars.colorByRegion}
        radiusByRegion={scalars.radiusByRegion}
        axisLabel={metricCfg.axis}
        format={metricCfg.format}
        selectedId={state.selectedId}
        pinnedIds={state.pinnedIds}
        onSelect={onSelect}
        onDrill={onDrillEntity}
      />
    );

  const scrubber = (
    <TimelineScrubber
      min={windowStart}
      max={lastIdx}
      value={mi}
      playing={state.playing}
      onTogglePlay={() => dispatch({ type: "TOGGLE_PLAY" })}
      onScrub={(v) => {
        dispatch({ type: "SET_MONTH", monthIndex: v });
        dispatch({ type: "SET_PLAYING", playing: false });
      }}
      onAdvance={(v) => dispatch({ type: "SET_MONTH", monthIndex: v })}
      onStop={() => dispatch({ type: "SET_PLAYING", playing: false })}
      rangeOptions={RANGE_PRESETS.map((r) => ({
        months: r.months,
        label: r.label,
        active: state.range === r.months,
        onClick: () => dispatch({ type: "SET_RANGE", range: r.months }),
      }))}
      startLabel={monthLabelOf(dates[windowStart])}
      midLabel={monthLabelOf(dates[Math.round((windowStart + lastIdx) / 2)])}
      endLabel={monthLabelOf(dates[lastIdx])}
      monthLabel={monthLabelOf(dates[mi])}
    />
  );

  // ── rail ──
  const selScore = selected ? scalars.scoreByRegion[selected.id] : null;
  const selMetricSeries = selected
    ? metricSeriesFor(state.metric, series, selected.id)
    : [];
  const selChildPlural = CHILD_PLURAL[scope.geoLevel];
  const rail = selected && (
    <DetailRail
      name={titleCaseLocationName(selected.name)}
      sub={`${selected.state} · ${scope.geoLevel}${scope.geoLevel === "metro" ? ` · CBSA ${selected.id}` : ""}`}
      score={selScore}
      confidence={coverageConfidence(series, selected.id, mi, dates[lastIdx])}
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
      stats={buildDetailStats(series, selected.id, mi)}
      metricLabel={metricCfg.label}
      metricValueNow={formatExplorerValue(
        selMetricSeries[mi] ?? null,
        metricCfg.format,
      )}
      railSpark={selMetricSeries.slice(windowStart)}
      railMarker={Math.max(0, mi - windowStart)}
      isPinned={state.pinnedIds.includes(selected.id)}
      onTogglePin={() =>
        dispatch({
          type: state.pinnedIds.includes(selected.id) ? "UNPIN" : "PIN",
          id: selected.id,
        })
      }
      hasDrill={scope.geoLevel !== "zip"}
      drillLabel={`Explore ${selChildPlural ?? "detail"} in ${titleCaseLocationName(selected.name)} ↓`}
      onDrill={() => onDrillEntity(selected.id)}
      hasDashboard={scope.geoLevel !== "state"}
      onOpenDashboard={() => openDashboard(selected)}
    />
  );

  const heroTitle = `${scopeName ? `${scopeName} — ` : ""}${state.view === "map" ? `${metricCfg.label} across ${regions.length} ${unitPlural} (map)` : `${metricCfg.label} across ${regions.length} ${unitPlural}`}`;
  const boardTitle = `Rankings — ${unitPlural} in ${scopeName ?? "U.S."}${metricCfg.betterHigh ? "" : " (lower is better)"}`;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1600,
        margin: "0 auto",
        padding: "24px 32px 48px",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 600,
          color: "var(--md-on-surface)",
        }}
      >
        Market Explorer
      </h1>
      <p
        style={{
          margin: "6px 0 16px",
          fontSize: 13,
          color: "var(--md-on-surface-variant)",
        }}
      >
        Drill from the whole country down to a single ZIP — click a market to
        inspect it, drag the timeline to travel through up to 10 years of
        history.
      </p>

      <GeoDrillBar crumbs={crumbs} levelTabs={levelTabs} />
      <div style={{ marginBottom: 16 }}>
        <MetricSwitcher
          active={state.metric}
          disabledIds={disabledMetricIds}
          onPick={(id) => dispatch({ type: "SET_METRIC", metric: id })}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <KpiStrip agg={agg} monthIndex={mi} windowStart={windowStart} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 360px",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            minWidth: 0,
          }}
        >
          <HeroVisualization
            title={heroTitle}
            hint={
              state.view === "map"
                ? ""
                : `Click a bubble to inspect · double-click to drill into its ${selChildPlural ?? "detail"} · size = active inventory`
            }
            view={state.view}
            onSetView={(v) => dispatch({ type: "SET_VIEW", view: v })}
            hasNearby={hasNearby}
            includeNearby={state.includeNearby}
            onToggleNearby={() => dispatch({ type: "TOGGLE_NEARBY" })}
            nearbyLabel={`${state.includeNearby ? "✓ Nearby " : "+ Nearby "}${unitPlural}`}
            chart={heroChart}
            scrubber={scrubber}
          />

          <MarketExplorerAnalytics
            selected={selected}
            series={series}
            dates={dates}
            monthIndex={mi}
            donutScores={donutScores}
            unitPlural={unitPlural}
            movers={movers}
            onSelect={onSelect}
            regions={regions}
            pinnedIds={state.pinnedIds}
            scoreByRegion={scalars.scoreByRegion}
            geoLevel={scope.geoLevel}
            onUnpin={(id) => dispatch({ type: "UNPIN", id })}
            onClearPins={() => dispatch({ type: "CLEAR_PINS" })}
            boardTitle={boardTitle}
            monthLabel={monthLabelOf(dates[mi])}
            rows={rows}
            selectedId={state.selectedId}
          />
        </div>
        {rail}
      </div>
      {isLoading && (
        <div
          style={{
            padding: 12,
            fontSize: 12,
            color: "var(--md-on-surface-variant)",
          }}
        >
          Loading market data…
        </div>
      )}
      {error && (
        <div
          style={{
            padding: 12,
            fontSize: 12,
            color: "var(--md-error)",
          }}
        >
          Something went wrong loading this scope’s data — try refreshing or
          picking a different market.
        </div>
      )}
    </main>
  );
}
