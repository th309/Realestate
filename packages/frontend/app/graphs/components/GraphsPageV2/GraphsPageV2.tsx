'use client';

import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGraphsState, type TimeFrame } from '../../hooks/useGraphsState';
import { useMyMarkets } from '../../hooks/useMyMarkets';
import { useScatterData } from '../../hooks/useScatterData';
import { useWaterfallData } from '../../hooks/useWaterfallData';
import { useRadarData } from '../../hooks/useRadarData';
import { useBarRankingData } from '../../hooks/useBarRankingData';
import { useBarRaceData } from '../../hooks/useBarRaceData';
import { useScatterRaceData } from '../../hooks/useScatterRaceData';
import { useRadarRaceData } from '../../hooks/useRadarRaceData';
import { useRegionTimeSeriesData, useNationalTimeSeriesData } from '../../hooks/useRegionTimeSeriesData';
import { useTimeSeriesData, getMetricTitle, getMetricFormat } from '@/lib/data';
import type { GeoLevel, ScoreType } from '@/lib/data';
import { MarketSearchBar } from '../MarketSearchBar';
import { MetricPicker } from '../MetricPicker';
import { AnimatedTimeSeriesChart } from '../AnimatedTimeSeriesChart';
import { ChartTypePills } from '../ChartTypePills';
import { Sidebar } from '../Sidebar';
import { ScatterPlot } from '@/lib/visualizations/d3/ScatterPlot';
import { WaterfallChart } from '@/lib/visualizations/d3/WaterfallChart';
import { RadarChart } from '@/lib/visualizations/d3/RadarChart';
import { HorizontalBarChart } from '@/lib/visualizations/d3/HorizontalBarChart';
import type { FormatType } from '@/lib/visualizations/d3/utils/scales';
import { ShareButton } from '../ShareButton';
import { SaveGraphButton } from '../SaveGraphButton';
import { SaveTemplateModal } from '../SaveTemplateModal';
import { TemplatePicker } from '../TemplatePicker';
import { Breadcrumbs } from '@/components/navigation';

const TIME_FRAMES: TimeFrame[] = ['1Y', '3Y', '5Y', '10Y', 'Max'];

/** Convert TimeFrame to a startDate ISO string (bypasses the 6-month historyMonths cap) */
function tfToStartDate(tf: TimeFrame): string | undefined {
  if (tf === 'Max') return undefined;
  const now = new Date();
  const months = { '1Y': 12, '3Y': 36, '5Y': 60, '10Y': 120 }[tf];
  now.setMonth(now.getMonth() - months);
  return now.toISOString().slice(0, 10);
}

/**
 * Map registry MetricFormat → D3 chart FormatType.
 *
 * The data layer stores ALL percentage metrics as already-multiplied values
 * (e.g. 5.0 means 5%). D3's `percent` formatter multiplies by 100 again,
 * so we must use `percentAbs` (which just appends %) for both `percent`
 * and `percent_abs` registry formats.
 */
function toScatterFormat(fmt: string): FormatType {
  if (fmt === 'currency') return 'currency';
  if (fmt === 'percent' || fmt === 'percent_abs') return 'percentAbs';
  if (fmt === 'days') return 'days';
  return 'number';
}

/**
 * Auto-detect whether log scale is appropriate for an array of values.
 * Returns 'log' when the data spans > 1 order of magnitude AND is
 * right-skewed (median much less than mean), which compresses the
 * majority of points into a small area on linear scale.
 * All values must be positive for log to work.
 */
function autoScaleType(values: number[]): 'linear' | 'log' {
  if (values.length < 4) return 'linear';

  const min = Math.min(...values);
  if (min <= 0) return 'linear'; // log can't handle zero or negative

  const max = Math.max(...values);
  const ratio = max / min;

  // Need at least ~10× range before log makes sense
  if (ratio < 10) return 'linear';

  // Check skewness — if median is < 30% of mean, data is heavily right-skewed
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  if (median < mean * 0.3) return 'log';

  // Also use log if range spans > 2 orders of magnitude regardless
  if (ratio > 100) return 'log';

  return 'linear';
}

// ── Inline helper components ─────────────────────────────────────────────────

function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-on-surface-variant">
          {label || 'Loading data...'}
        </span>
      </div>
    </div>
  );
}

function ErrorMessage({ error }: { error: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <p className="text-error text-sm font-medium">Something went wrong</p>
        <p className="text-on-surface-variant/60 text-xs mt-1">{error}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <p className="text-on-surface-variant text-sm">{title}</p>
        {subtitle && (
          <p className="text-on-surface-variant/60 text-xs mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function ProGatedMessage({ feature }: { feature: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-primary/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <p className="text-on-surface font-semibold text-sm">{feature}</p>
        <p className="text-on-surface-variant text-xs mt-1 mb-3">
          Upgrade to Pro to unlock this visualization
        </p>
        <button className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-medium hover:bg-primary/90 transition-colors">
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}

// ── Motion transition config ─────────────────────────────────────────────────

const chartMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.25 },
};

// ── Main Component ───────────────────────────────────────────────────────────

export function GraphsPageV2() {
  const graphsState = useGraphsState();

  const {
    primaryMarket,
    comparisonMarket,
    markets,
    chartType,
    timeFrame,
    activeMetric,
    userType,
    baselineType,
    scope,
    // Scatter-specific
    scatterXMetric,
    scatterYMetric,
    scatterXScaleType,
    scatterYScaleType,
    showRegression,
    showQuadrants,
    // Waterfall-specific
    waterfallPreset,
    scoreType,
    // Radar-specific
    radarPreset,
    radarMetrics,
    // Bar-specific
    barMetric,
    barSort,
    barCount,
    raceMode,
    // Setters
    setPrimaryMarket,
    setChartType,
    setTimeFrame,
    setActiveMetric,
    selectMarket,
    addMarket,
    clearComparison,
    swapMarkets,
  } = graphsState;

  const { markets: savedMarkets, loading: marketsLoading } = useMyMarkets({ userType, maxMarkets: 6 });
  const [saveTemplateOpen, setSaveTemplateOpen] = React.useState(false);

  // Auto-select a market if none selected, prioritizing:
  // 1. Last geography the user viewed (maps page, reports, etc.)
  // 2. Pinned/favorite markets
  // 3. Recent markets
  // If nothing found, leave empty — user picks from search
  useEffect(() => {
    if (markets.length > 0 || marketsLoading) return;

    // Priority 1: Last geography the user viewed on the maps page
    try {
      const lastGeo = localStorage.getItem('propertyiq-last-geography');
      if (lastGeo) {
        const geo = JSON.parse(lastGeo);
        if (geo?.id && geo?.name && ['metro', 'county', 'zip'].includes(geo.type)) {
          addMarket({
            id: geo.id,
            name: geo.name,
            type: geo.type,
            state: geo.state,
            score: null,
          });
          return;
        }
      }
    } catch {
      // fall through to next source
    }

    // Priority 2+3: Pinned or recent markets from useMyMarkets
    if (savedMarkets.length > 0) {
      addMarket(savedMarkets[0]);
    }
  }, [markets.length, marketsLoading, savedMarkets, addMarket]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const geoLevel: GeoLevel = (markets[0]?.type as GeoLevel) || 'metro';
  const startDate = tfToStartDate(timeFrame);

  // ── TIMELINE DATA (up to 3 market lines) ────────────────────────────────────

  const primaryTS = useTimeSeriesData(
    activeMetric,
    geoLevel,
    markets[0]?.id || '',
    {
      startDate,
      enabled: chartType === 'timeseries' && !!markets[0],
    }
  );

  const comparisonTS = useTimeSeriesData(
    activeMetric,
    (markets[1]?.type as GeoLevel) || geoLevel,
    markets[1]?.id || '',
    {
      startDate,
      enabled: chartType === 'timeseries' && !!markets[1],
    }
  );

  // Third market line — uses the baselineData/baselineLabel props on the chart
  // when there's a 3rd market and no baseline type. When baseline is set, the
  // 3rd slot is used for baseline instead.
  const thirdMarketTS = useTimeSeriesData(
    activeMetric,
    (markets[2]?.type as GeoLevel) || geoLevel,
    markets[2]?.id || '',
    {
      startDate,
      enabled: chartType === 'timeseries' && !!markets[2] && baselineType === 'none',
    }
  );

  // ── BASELINE DATA ──────────────────────────────────────────────────────────

  // State baseline (single API call to state-level data)
  const stateTS = useTimeSeriesData(
    activeMetric,
    'state',
    markets[0]?.state || '',
    {
      startDate,
      enabled: chartType === 'timeseries' && baselineType === 'state' && !!markets[0]?.state,
    }
  );

  // Census region baseline (averages all states in the region)
  const regionTS = useRegionTimeSeriesData(
    activeMetric,
    markets[0]?.state || '',
    {
      startDate,
      enabled: chartType === 'timeseries' && baselineType === 'region' && !!markets[0],
    }
  );

  // National baseline (averages all 50 states + DC)
  const nationalTS = useNationalTimeSeriesData(
    activeMetric,
    {
      startDate,
      enabled: chartType === 'timeseries' && baselineType === 'national' && !!markets[0],
    }
  );

  // Determine what goes into the baseline (3rd) line slot:
  // - If baselineType is set, use baseline data
  // - Else if there's a 3rd market, use that market's data
  const baselineLabel = useMemo(() => {
    if (baselineType === 'state' && markets[0]?.state) return `${markets[0].state} Avg`;
    if (baselineType === 'region' && regionTS.regionLabel) return `${regionTS.regionLabel} Avg`;
    if (baselineType === 'national') return 'National Avg';
    if (baselineType === 'none' && markets[2]) return markets[2].name;
    return undefined;
  }, [baselineType, markets, regionTS.regionLabel]);

  const resolvedBaselineData = useMemo(() => {
    if (baselineType === 'state') return stateTS.data;
    if (baselineType === 'region') return regionTS.data;
    if (baselineType === 'national') return nationalTS.data;
    if (baselineType === 'none' && markets[2]) return thirdMarketTS.data;
    return undefined;
  }, [baselineType, stateTS.data, regionTS.data, nationalTS.data, thirdMarketTS.data, markets]);

  // ── SCATTER DATA ──────────────────────────────────────────────────────────

  const scatterData = useScatterData(
    scatterXMetric,
    scatterYMetric,
    geoLevel,
    {
      primaryId: markets[0]?.id,
      primaryName: markets[0]?.name,
      primaryState: markets[0]?.state,
      scope,
    }
  );

  const xLabel = getMetricTitle(scatterXMetric);
  const yLabel = getMetricTitle(scatterYMetric);
  const xFormat = toScatterFormat(getMetricFormat(scatterXMetric));
  const yFormat = toScatterFormat(getMetricFormat(scatterYMetric));

  // Resolve 'auto' scale types based on actual data distribution
  const effectiveXScaleType = useMemo(() => {
    if (scatterXScaleType !== 'auto') return scatterXScaleType;
    if (scatterData.data.length === 0) return 'linear' as const;
    return autoScaleType(scatterData.data.map(d => d.x));
  }, [scatterXScaleType, scatterData.data]);

  const effectiveYScaleType = useMemo(() => {
    if (scatterYScaleType !== 'auto') return scatterYScaleType;
    if (scatterData.data.length === 0) return 'linear' as const;
    return autoScaleType(scatterData.data.map(d => d.y));
  }, [scatterYScaleType, scatterData.data]);

  // ── SCATTER RACE DATA ─────────────────────────────────────────────────────

  const scatterRaceData = useScatterRaceData(
    scatterXMetric,
    scatterYMetric,
    geoLevel,
    markets[0] || null,
    scope,
    chartType === 'scatter' && raceMode,
  );

  // ── WATERFALL DATA ─────────────────────────────────────────────────────────

  const waterfallData = useWaterfallData(
    waterfallPreset,
    geoLevel,
    markets[0]?.id || null,
    scoreType as ScoreType,
  );

  // ── RADAR DATA ─────────────────────────────────────────────────────────────

  const radarMarkets = useMemo(
    () => markets.slice(0, 3).map(m => ({ id: m.id, name: m.name, state: m.state })),
    [markets],
  );

  const radarData = useRadarData(
    radarPreset,
    geoLevel,
    radarMarkets,
    radarMetrics.length > 0 ? radarMetrics : undefined,
  );

  // ── RADAR RACE DATA ──────────────────────────────────────────────────────

  const RADAR_RACE_COLORS = ['#0891b2', '#3b82f6', '#ea580c'];

  const radarRaceData = useRadarRaceData(
    radarData.dimensions,
    geoLevel,
    radarMarkets,
    RADAR_RACE_COLORS,
    chartType === 'radar' && raceMode,
  );

  // ── BAR RANKING DATA ──────────────────────────────────────────────────────

  const barData = useBarRankingData(
    barMetric,
    geoLevel,
    markets[0] || null,
    scope,
    barSort,
    barCount,
  );

  // ── BAR RACE DATA ─────────────────────────────────────────────────────────

  const barRaceData = useBarRaceData(
    barMetric,
    geoLevel,
    markets[0] || null,
    scope,
    barSort,
    barCount,
    chartType === 'bar' && raceMode,
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100dvh-64px)] bg-surface flex flex-col overflow-hidden">
      {/* ── COMPACT HEADER ── */}
      <header className="flex-shrink-0 bg-surface-container-lowest border-b border-outline-variant/40 px-4 md:px-6 py-3">
        <Breadcrumbs items={[{ label: 'Graphs' }]} className="mb-2" />
        <div className="max-w-[1600px] mx-auto flex items-center gap-3 flex-wrap">
          <MarketSearchBar
            primaryMarket={primaryMarket}
            comparisonMarket={comparisonMarket}
            onSelectMarket={selectMarket}
            onClearComparison={clearComparison}
            onSwapMarkets={swapMarkets}
          />
          <div className="flex items-center gap-1.5 ml-auto">
            <ShareButton graphState={graphsState} />
            <SaveGraphButton graphState={graphsState} onSaveTemplate={() => setSaveTemplateOpen(true)} />
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT: sidebar + chart ── */}
      <main className="flex-1 flex min-h-0 max-w-[1600px] mx-auto w-full px-4 md:px-5 py-3 gap-4 overflow-hidden">

        {/* ── LEFT SIDEBAR (desktop) ── */}
        <div className="hidden md:flex flex-shrink-0 min-h-0">
          <Sidebar state={graphsState} />
        </div>

        {/* ── CHART AREA ── */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
          {/* Hero chart canvas */}
          <div className="flex-1 min-h-0 bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-sm p-4 md:p-6">
            <AnimatePresence mode="wait">

              {/* ── TIMESERIES ── */}
              {chartType === 'timeseries' && (
                <motion.div
                  key="timeseries"
                  {...chartMotion}
                  className="w-full h-full"
                >
                  <AnimatedTimeSeriesChart
                    primaryData={primaryTS.data}
                    primaryLabel={markets[0]?.name || 'Primary'}
                    comparisonData={markets[1] ? comparisonTS.data : undefined}
                    comparisonLabel={markets[1]?.name}
                    baselineData={resolvedBaselineData}
                    baselineLabel={baselineLabel}
                    metricId={activeMetric}
                    timeFrame={timeFrame}
                    onTimeFrameChange={setTimeFrame}
                    isLoading={primaryTS.isLoading}
                    error={primaryTS.error?.message}
                  />
                </motion.div>
              )}

              {/* ── SCATTER ── */}
              {chartType === 'scatter' && (
                <motion.div
                  key="scatter"
                  {...chartMotion}
                  className="w-full h-full"
                >
                  {(raceMode ? scatterRaceData.isLoading : scatterData.isLoading) ? (
                    <LoadingSpinner label={raceMode ? 'Building scatter animation...' : 'Loading scatter data...'} />
                  ) : scatterData.error ? (
                    <ErrorMessage error={scatterData.error.message} />
                  ) : !raceMode && scatterData.data.length === 0 ? (
                    <EmptyState
                      title="No data available for this combination"
                      subtitle="Try a different metric or broader scope"
                    />
                  ) : raceMode && scatterRaceData.frames.length === 0 ? (
                    <EmptyState
                      title="No time series data for scatter animation"
                      subtitle="Try a different metric or broader scope"
                    />
                  ) : (
                    <ScatterPlot
                      data={scatterData.data}
                      xLabel={xLabel}
                      yLabel={yLabel}
                      xFormat={xFormat}
                      yFormat={yFormat}
                      xScaleType={effectiveXScaleType}
                      yScaleType={effectiveYScaleType}
                      showRegression={showRegression}
                      showQuadrants={showQuadrants}
                      colorByCategory={false}
                      sizeByValue
                      raceFrames={raceMode ? scatterRaceData.frames : undefined}
                      autoPlay={raceMode}
                      onPointClick={(point) => {
                        selectMarket({
                          id: point.id,
                          name: point.label,
                          type: geoLevel as 'metro' | 'county' | 'zip',
                          score: null,
                        });
                      }}
                    />
                  )}
                </motion.div>
              )}

              {/* ── WATERFALL ── */}
              {chartType === 'waterfall' && (
                <motion.div
                  key="waterfall"
                  {...chartMotion}
                  className="w-full h-full"
                >
                  {!markets[0] ? (
                    <EmptyState
                      title="Select a market to view breakdown"
                      subtitle="Use the search bar or sidebar to add a market"
                    />
                  ) : waterfallData.isLoading ? (
                    <LoadingSpinner label="Loading waterfall data..." />
                  ) : waterfallData.error ? (
                    <ErrorMessage error={waterfallData.error.message} />
                  ) : waterfallData.proGated ? (
                    <ProGatedMessage feature="Score Breakdown" />
                  ) : waterfallData.bars.length === 0 ? (
                    <EmptyState
                      title="No data available for this breakdown"
                      subtitle="Try a different preset or market"
                    />
                  ) : (
                    <WaterfallChart
                      bars={waterfallData.bars}
                      totalLabel={waterfallData.totalLabel}
                      totalValue={waterfallData.totalValue}
                      title={waterfallData.title}
                    />
                  )}
                </motion.div>
              )}

              {/* ── RADAR ── */}
              {chartType === 'radar' && (
                <motion.div
                  key="radar"
                  {...chartMotion}
                  className="w-full h-full"
                >
                  {markets.length === 0 ? (
                    <EmptyState
                      title="Select markets to compare"
                      subtitle="Add up to 3 markets for radar comparison"
                    />
                  ) : (raceMode ? radarRaceData.isLoading : radarData.isLoading) ? (
                    <LoadingSpinner label={raceMode ? 'Building radar animation...' : 'Building radar profile...'} />
                  ) : radarData.error ? (
                    <ErrorMessage error={radarData.error.message} />
                  ) : radarData.datasets.length === 0 ? (
                    <EmptyState
                      title="No data available for this profile"
                      subtitle="Try a different radar preset or add more markets"
                    />
                  ) : raceMode && radarRaceData.frames.length === 0 ? (
                    <EmptyState
                      title="No time series data for radar animation"
                      subtitle="Try a different profile or add more markets"
                    />
                  ) : (
                    <RadarChart
                      datasets={radarData.datasets}
                      dimensions={radarData.dimensions}
                      raceFrames={raceMode ? radarRaceData.frames : undefined}
                      autoPlay={raceMode}
                    />
                  )}
                </motion.div>
              )}

              {/* ── BAR RANKING / RACE ── */}
              {chartType === 'bar' && (
                <motion.div
                  key="bar"
                  {...chartMotion}
                  className="w-full h-full"
                >
                  {(raceMode ? barRaceData.isLoading : barData.isLoading) ? (
                    <LoadingSpinner label={raceMode ? 'Building race data...' : 'Loading rankings...'} />
                  ) : barData.error ? (
                    <ErrorMessage error={barData.error.message} />
                  ) : !raceMode && barData.data.length === 0 ? (
                    <EmptyState
                      title="No ranking data available"
                      subtitle="Try a different metric or broader scope"
                    />
                  ) : raceMode && barRaceData.raceFrames.length === 0 ? (
                    <EmptyState
                      title="No time series data for race"
                      subtitle="Try a different metric or broader scope"
                    />
                  ) : (
                    <HorizontalBarChart
                      data={barData.data}
                      benchmarkValue={raceMode ? undefined : (barData.benchmarkValue ?? undefined)}
                      benchmarkLabel={raceMode ? undefined : barData.benchmarkLabel}
                      formatValue={raceMode ? barRaceData.formatValue : barData.formatValue}
                      raceFrames={raceMode ? barRaceData.raceFrames : undefined}
                      autoPlay={raceMode}
                      onBarClick={raceMode ? undefined : (entry) => {
                        selectMarket({
                          id: entry.id,
                          name: entry.label,
                          type: geoLevel as 'metro' | 'county' | 'zip',
                          score: null,
                        });
                      }}
                    />
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Templates row below chart */}
          <div className="hidden md:block flex-shrink-0">
            <TemplatePicker onApply={graphsState.applyTemplate} horizontal />
          </div>

          {/* ── MOBILE-ONLY bottom controls (hidden on md+) ── */}
          <div className="md:hidden flex flex-col gap-3">
            {/* Chart type pills — always visible on mobile */}
            <ChartTypePills activeType={chartType} onChange={setChartType} />

            {/* Chart-type-specific mobile controls */}
            {chartType === 'timeseries' && (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <MetricPicker
                  value={activeMetric}
                  onChange={setActiveMetric}
                  geoLevel={geoLevel}
                />
                <div className="flex items-center gap-1">
                  {TIME_FRAMES.map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeFrame(tf)}
                      className={`
                        px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150
                        ${timeFrame === tf
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                        }
                      `}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chartType === 'scatter' && (
              <div className="flex items-center gap-2 flex-wrap">
                <MetricPicker
                  value={scatterXMetric}
                  onChange={graphsState.setScatterXMetric}
                  geoLevel={geoLevel}
                />
                <span className="text-on-surface-variant text-xs">vs</span>
                <MetricPicker
                  value={scatterYMetric}
                  onChange={graphsState.setScatterYMetric}
                  geoLevel={geoLevel}
                />
              </div>
            )}

            {chartType === 'waterfall' && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(['investment', 'affordability', 'momentum', 'benchmark', 'score'] as const).map(preset => (
                  <button
                    key={preset}
                    onClick={() => graphsState.setWaterfallPreset(preset)}
                    className={`
                      px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150
                      ${waterfallPreset === preset
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:bg-surface-container-high'
                      }
                    `}
                  >
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {chartType === 'radar' && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(['homebuyer', 'investor', 'market_health', 'custom'] as const).map(preset => (
                  <button
                    key={preset}
                    onClick={() => graphsState.setRadarPreset(preset)}
                    className={`
                      px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150
                      ${radarPreset === preset
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:bg-surface-container-high'
                      }
                    `}
                  >
                    {preset === 'market_health' ? 'Health' : preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {chartType === 'bar' && (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <MetricPicker
                  value={barMetric}
                  onChange={graphsState.setBarMetric}
                  geoLevel={geoLevel}
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => graphsState.setBarSort(barSort === 'desc' ? 'asc' : 'desc')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-all duration-150"
                  >
                    {barSort === 'desc' ? 'Highest' : 'Lowest'}
                  </button>
                  <button
                    onClick={() => graphsState.setBarCount(barCount === 10 ? 25 : 10)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-all duration-150"
                  >
                    Top {barCount}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <SaveTemplateModal
        isOpen={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        currentState={graphsState}
      />
    </div>
  );
}

export default GraphsPageV2;
