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
import { GlowEndpoint, ScrubOverlay } from "./SignatureChartLayers";
import {
  DEFAULT_RANGES,
  autoColor,
  sliceToRange,
  formatDeltaCompact,
  arrowForDelta,
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
  className?: string;
};

function readYValue(point: DataPoint | undefined, key: string): number {
  if (!point) return Number.NaN;
  const v = point[key];
  return typeof v === "number" ? v : Number.NaN;
}

function compactValue(value: number, format: HeadlineFormat): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (format === "currency") {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
    return `${sign}$${Math.round(abs)}`;
  }
  if (format === "percent") return `${sign}${abs.toFixed(1)}%`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

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

  // ComposedChart accepts mixed Area + Line children — the right tool for
  // multi-series rendering. Single-series mode also uses it (no functional
  // difference vs. AreaChart/LineChart for our case).

  const renderScrub = useCallback(
    (cp: Record<string, unknown>) => (
      <ScrubOverlay
        chartProps={cp}
        data={slicedData}
        activeIndex={activeIndex}
        color={primaryColor}
        yKey={primaryKey}
      />
    ),
    [slicedData, activeIndex, primaryColor, primaryKey],
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

  const isMulti = resolvedSeries.length > 1;

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
              margin={{ top: 16, right: 24, bottom: 8, left: 16 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <XAxis
                dataKey="x"
                type={xIsNumeric ? "number" : "category"}
                domain={xIsNumeric ? ["dataMin", "dataMax"] : undefined}
                hide
              />
              <YAxis type="number" domain={["auto", "auto"]} hide />
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
        <div className="flex flex-wrap gap-x-6 gap-y-2" data-signature-legend>
          {resolvedSeries.map((s) => {
            const value = readYValue(activePoint, s.key);
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    color: piq.textMuted,
                    fontWeight: 500,
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: piq.textPrimary,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {compactValue(value, headlineFormat)}
                </span>
              </div>
            );
          })}
        </div>
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
