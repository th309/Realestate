"use client";
import React, { useEffect, useMemo, useReducer } from "react";
import { useRouter } from "next/navigation";
import {
  explorerReducer,
  initialExplorerState,
  resolveScope,
} from "./lib/explorer-reducer";
import { useExplorerScopeData } from "./lib/useExplorerScopeData";
import { EXPLORER_METRICS } from "./lib/explorer-config";
import {
  aggregateScopeKpis,
  computeMovers,
  latestScoredMonthIndex,
} from "./lib/explorer-math";
import {
  buildBubbleScalars,
  buildLeaderboardRows,
} from "./lib/explorer-view-model";
import { useMetricAvailability } from "./lib/useMetricAvailability";
import { buildBreadcrumbs, buildLevelTabs } from "./lib/explorer-navigation";
import { GeoDrillBar } from "./components/GeoDrillBar";
import { MetricSwitcher } from "./components/MetricSwitcher";
import { KpiStrip } from "./components/KpiStrip";
import { HeroVisualization } from "./components/HeroVisualization";
import { AnimatedHeroChart } from "./components/AnimatedHeroChart";
import { useGeoBoundaries } from "./lib/useGeoBoundaries";
import { ExplorerTimeline } from "./components/ExplorerTimeline";
import { ExplorerDetailRail } from "./components/ExplorerDetailRail";
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
  // States have no native PropertyIQ score, so anchoring the default month to
  // PIQ score's own latest-scored month picked a month where unemployment
  // (FRED) had NO data at all for any state — landing the whole page on a
  // month where the state-scope KPI strip/detail rail showed nothing but
  // dashes. unemployment_rate is itself the LAGGIEST of the 5 state-scope
  // KPI metrics (confirmed live: home_value/days_on_market/for_sale_inventory
  // are current through the latest month, but FRED's unemployment_rate is
  // consistently ~1 month behind) — anchoring on it specifically guarantees
  // every other state metric already has data by the time unemployment does.
  const isStateScope = scope.geoLevel === "state";
  const latestScoredIdx = useMemo(
    () =>
      latestScoredMonthIndex(
        isStateScope ? series.unemployment_rate : series.propertyiq_score,
        dates.length,
      ),
    [
      isStateScope,
      series.unemployment_rate,
      series.propertyiq_score,
      dates.length,
    ],
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
  // Scope-wide aggregate (e.g. all of Colorado's metros when drilled into
  // Colorado) — the KPI strip tracks the CURRENT SCOPE itself, labeled with
  // the scope's own name below; the detail rail separately tracks whichever
  // individual region (`selected`) is highlighted on the map/bubble chart.
  // These are deliberately two different things shown side by side, not
  // duplicates of each other.
  const kpiSeries = useMemo(
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

  const disabledMetricIds = useMetricAvailability(
    scope.geoLevel,
    isStateScope,
    series,
    state.metric,
    dispatch,
  );

  // ── hero chart ──
  // AnimatedHeroChart drives smoothing via explicit per-frame interpolation
  // (requestAnimationFrame), not a CSS transition — verified by frame-by-frame
  // screen-recording analysis that CSS transitions do not animate cx/cy/fill
  // for these SVG elements at all (instant snap, zero intermediate frames).
  // It owns its own (blended) scalars internally — the `scalars` computed
  // above stays the single source of truth for the REAL, unblended
  // current-month values everything else (KPI strip, leaderboard, detail
  // rail, momentum donut) reads from.
  const heroChart = (
    <AnimatedHeroChart
      view={state.view}
      boundaries={boundaries}
      regions={regions}
      series={series}
      metricId={state.metric}
      monthIndex={mi}
      lastIdx={lastIdx}
      playing={state.playing}
      format={metricCfg.format}
      axisLabel={metricCfg.axis}
      selectedId={state.selectedId}
      pinnedIds={state.pinnedIds}
      onSelect={onSelect}
      onDrill={onDrillEntity}
    />
  );

  const scrubber = (
    <ExplorerTimeline
      state={state}
      dispatch={dispatch}
      dates={dates}
      windowStart={windowStart}
      lastIdx={lastIdx}
      monthIndex={mi}
    />
  );

  // ── rail ──
  const selChildPlural = CHILD_PLURAL[scope.geoLevel];
  const rail = (
    <ExplorerDetailRail
      selected={selected}
      scoreByRegion={scalars.scoreByRegion}
      series={series}
      dates={dates}
      monthIndex={mi}
      lastIdx={lastIdx}
      state={state}
      dispatch={dispatch}
      geoLevel={scope.geoLevel}
      scopeName={scopeName}
      metricCfg={metricCfg}
      isStateScope={isStateScope}
      onDrillEntity={onDrillEntity}
      onOpenDashboard={openDashboard}
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
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--md-on-surface-variant)",
            marginBottom: 8,
          }}
        >
          {scopeName ?? "United States"} · {regions.length} {unitPlural}
        </div>
        <KpiStrip
          kpiSeries={kpiSeries}
          monthIndex={mi}
          isStateScope={isStateScope}
        />
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
