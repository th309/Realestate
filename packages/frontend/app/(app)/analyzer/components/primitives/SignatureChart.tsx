"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Customized,
} from "recharts";
import { piq } from "./piqTokens";
import { MetricBlock } from "./MetricBlock";
import { RangePills } from "./RangePills";
import { SignatureChartLegend } from "./SignatureChartLegend";
import { GlowEndpoint, MultiScrubOverlay } from "./SignatureChartLayers";
import {
  DEFAULT_RANGES,
  autoColor,
  sliceToRange,
  formatDeltaCompact,
  arrowForDelta,
  compactValue,
  computeAxisTicks,
  type DataPoint,
  type RangeOption,
  type RangeAnchor,
  type HeadlineFormat,
  type SeriesSpec,
} from "./SignatureChartHelpers";

// Re-export public types so external consumers can keep importing from SignatureChart.
export type {
  DataPoint,
  RangeOption,
  RangeAnchor,
  SeriesSpec,
} from "./SignatureChartHelpers";

export type SignatureChartProps = {
  data: DataPoint[];
  /** Multi-series mode. When omitted, single-line mode reads `data[i].y`. */
  series?: SeriesSpec[];
  ranges?: RangeOption[];
  defaultRange?: number;
  headlineLabel: string;
  headlineFormat?: HeadlineFormat;
  subLabel?: (point: DataPoint) => string;
  variant?: "line" | "area";
  color?: string;
  height?: number;
  showBaseline?: boolean;
  rangeAnchor?: RangeAnchor;
  /** Show value ticks on the right edge of the plot. Default: false. */
  showYAxis?: boolean;
  /** Show time/category ticks along the bottom. Default: false. */
  showXAxis?: boolean;
  /** Format an x value into a bottom-axis tick label (e.g. year → calendar year). */
  xTickFormatter?: (x: number | string) => string;
  className?: string;
};

function readYValue(point: DataPoint | undefined, key: string): number {
  if (!point) return Number.NaN;
  const v = point[key];
  return typeof v === "number" ? v : Number.NaN;
}

/** Shared style for the optional x/y axis tick labels. */
const AXIS_TICK = { fontSize: 11, fill: piq.textMuted } as const;

export function SignatureChart({
  data,
  series,
  ranges = DEFAULT_RANGES,
  defaultRange,
  headlineLabel,
  headlineFormat = "currency",
  subLabel,
  variant = "area",
  color: colorProp,
  height = 320,
  showBaseline = true,
  rangeAnchor = "tail",
  showYAxis = false,
  showXAxis = false,
  xTickFormatter,
  className = "",
}: SignatureChartProps) {
  const initialRange =
    defaultRange ?? ranges[ranges.length - 1]?.years ?? data.length;
  const [currentRangeYears, setCurrentRangeYears] = useState(initialRange);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const slicedData = useMemo(
    () => sliceToRange(data, currentRangeYears, rangeAnchor),
    [data, currentRangeYears, rangeAnchor],
  );

  // Resolve series list. In single-series mode, synthesize a "y" series so the
  // rest of the render path is uniform.
  const resolvedSeries: SeriesSpec[] = useMemo(() => {
    if (series && series.length > 0) return series;
    const auto = colorProp ?? autoColor(slicedData);
    return [{ key: "y", label: headlineLabel, color: auto, isPrimary: true }];
  }, [series, colorProp, slicedData, headlineLabel]);

  const primarySeries =
    resolvedSeries.find((s) => s.isPrimary) ?? resolvedSeries[0];
  const primaryKey = primarySeries.key;
  const primaryColor = primarySeries.color;

  const activePoint =
    activeIndex != null
      ? slicedData[activeIndex]
      : slicedData[slicedData.length - 1];
  const firstPoint = slicedData[0];

  const activePrimary = readYValue(activePoint, primaryKey);
  const firstPrimary = readYValue(firstPoint, primaryKey);

  const deltaValue =
    Number.isFinite(activePrimary) && Number.isFinite(firstPrimary)
      ? activePrimary - firstPrimary
      : 0;
  const deltaPct =
    Number.isFinite(firstPrimary) && firstPrimary !== 0
      ? (deltaValue / Math.abs(firstPrimary)) * 100
      : 0;
  const deltaColor =
    deltaValue > 0 ? piq.green : deltaValue < 0 ? piq.red : piq.textMuted;

  const allPositive = slicedData.every((d) => {
    const v = readYValue(d, primaryKey);
    return Number.isFinite(v) && v > 0;
  });
  const baselineY = allPositive
    ? Math.min(
        ...slicedData
          .map((d) => readYValue(d, primaryKey))
          .filter((v) => Number.isFinite(v)),
      )
    : 0;
  const xIsNumeric = slicedData.every((d) => typeof d.x === "number");

  const handleMouseMove = (state: { activeTooltipIndex?: number } | null) => {
    if (state?.activeTooltipIndex != null) {
      setActiveIndex(state.activeTooltipIndex);
    }
  };
  const handleMouseLeave = () => setActiveIndex(null);

  // ComposedChart accepts mixed Area + Line children for multi-series render.
  const isMulti = resolvedSeries.length > 1;

  // Scrub puts a dot + value chip on every line at the hovered x. Single-series
  // resolves to one synthesized series, so it gets one dot + chip too.
  const renderScrub = useCallback(
    (cp: Record<string, unknown>) => (
      <MultiScrubOverlay
        chartProps={cp}
        data={slicedData}
        activeIndex={activeIndex}
        series={resolvedSeries}
        format={headlineFormat}
        surface={piq.surface}
      />
    ),
    [slicedData, activeIndex, resolvedSeries, headlineFormat],
  );
  const renderGlow = useCallback(
    (cp: Record<string, unknown>) => (
      <GlowEndpoint
        chartProps={cp}
        data={slicedData}
        color={primaryColor}
        surface={piq.surface}
        yKey={primaryKey}
      />
    ),
    [slicedData, primaryColor, primaryKey],
  );

  return (
    <div data-signature-chart className={`flex flex-col gap-4 ${className}`}>
      {/* Headline */}
      <div>
        <MetricBlock
          label={headlineLabel}
          value={Number.isFinite(activePrimary) ? activePrimary : Number.NaN}
          format={headlineFormat}
          subLabel={subLabel && activePoint ? subLabel(activePoint) : undefined}
          size="lg"
          variant="neutral"
        />
        {firstPoint && activePoint && firstPoint !== activePoint && (
          <div
            className="text-sm font-medium mt-1 flex items-baseline gap-1.5"
            style={{
              color: deltaColor,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>
              {arrowForDelta(deltaValue)}{" "}
              {formatDeltaCompact(deltaValue, headlineFormat)}
            </span>
            <span style={{ opacity: 0.75 }}>
              ({deltaValue >= 0 ? "+" : "−"}
              {Math.abs(deltaPct).toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div
        style={{ width: "100%", height }}
        data-signature-points={slicedData.length}
      >
        {slicedData.length < 2 ? (
          <div
            className="flex items-center justify-center h-full text-center px-6"
            style={{
              color: piq.textMuted,
              fontSize: "13px",
              background: piq.canvas,
              border: `0.5px dashed ${piq.border}`,
              borderRadius: 12,
            }}
          >
            Not enough data yet to plot the chart — enter price and rent on the
            right.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={slicedData}
              margin={{
                top: 16,
                right: showYAxis ? 4 : 24,
                bottom: showXAxis ? 0 : 8,
                left: 16,
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <XAxis
                dataKey="x"
                type={xIsNumeric ? "number" : "category"}
                domain={xIsNumeric ? ["dataMin", "dataMax"] : undefined}
                hide={!showXAxis}
                height={showXAxis ? 24 : undefined}
                ticks={
                  showXAxis && xIsNumeric
                    ? computeAxisTicks(slicedData)
                    : undefined
                }
                tickFormatter={
                  xTickFormatter ? (v) => xTickFormatter(v) : undefined
                }
                tick={showXAxis ? AXIS_TICK : false}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
              />
              <YAxis
                type="number"
                domain={["auto", "auto"]}
                orientation="right"
                hide={!showYAxis}
                width={showYAxis ? 52 : undefined}
                tickCount={5}
                tickFormatter={(v) => compactValue(v, headlineFormat)}
                tick={showYAxis ? AXIS_TICK : false}
                tickLine={false}
                axisLine={false}
              />
              {showBaseline && (
                <ReferenceLine
                  y={baselineY}
                  stroke="rgba(15, 23, 42, 0.06)"
                  strokeDasharray="2 4"
                />
              )}
              {resolvedSeries.map((s) => {
                const isPrimaryLine = s.key === primaryKey;
                const useArea = variant === "area" && isPrimaryLine;
                return useArea ? (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill={s.color}
                    fillOpacity={0.08}
                    dot={false}
                    activeDot={false}
                    isAnimationActive
                    animationDuration={1400}
                    animationEasing="ease-out"
                  />
                ) : (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={isPrimaryLine ? 1.75 : 1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    dot={false}
                    activeDot={false}
                    isAnimationActive
                    animationDuration={1400}
                    animationEasing="ease-out"
                  />
                );
              })}
              <Customized component={renderScrub} />
              <Customized component={renderGlow} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Multi-series legend */}
      {isMulti && (
        <SignatureChartLegend
          series={resolvedSeries}
          activePoint={activePoint}
          format={headlineFormat}
        />
      )}

      {/* Range pills */}
      {ranges.length > 0 && (
        <div className="flex items-center justify-end">
          <RangePills
            ranges={ranges}
            active={currentRangeYears}
            onChange={(years) => {
              setCurrentRangeYears(years);
              setActiveIndex(null);
            }}
            color={primaryColor}
          />
        </div>
      )}
    </div>
  );
}
