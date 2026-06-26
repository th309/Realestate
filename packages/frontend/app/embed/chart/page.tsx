"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import {
  fetchTimeSeriesData,
  getMetricTitle,
  getMetricFormat,
  formatMetricValue,
  CBSA_TO_METRO,
  type TimeSeriesResult,
  type MetricFormat,
} from "@/lib/data";
import { EmbedLoadingSkeleton, EmbedErrorState } from "../components";

/** Colors for up to 3 comparison geographies */
const GEO_COLORS = ["#3b82f6", "#22c55e", "#f97316"] as const;
const NATIONAL_COLOR = "#9ca3af";

/** Range presets in months */
const RANGE_MONTHS: Record<string, number> = {
  "1y": 12,
  "3y": 36,
  "5y": 60,
  "10y": 120,
};

/** Range display labels */
const RANGE_LABELS: Record<string, string> = {
  "1y": "1 Year",
  "3y": "3 Years",
  "5y": "5 Years",
  "10y": "10 Years",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeoSeries {
  id: string;
  label: string;
  data: TimeSeriesResult;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      series: GeoSeries[];
      national: TimeSeriesResult | null;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an ISO date string N months before today */
function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Resolve a geography ID to a human-readable label */
function resolveGeoLabel(geoLevel: string, regionId: string): string {
  if (regionId === "US") return "National";

  if (geoLevel === "metro") {
    const entry = CBSA_TO_METRO.get(regionId);
    if (entry) return entry.shortName;
  }

  // Fallback: return the raw ID (state names are already readable)
  return regionId;
}

/** Format an ISO date string as "Jan 2024" */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Format a tick value on the Y axis using the metric format */
function formatYTick(value: number, format: MetricFormat): string {
  return formatMetricValue(value, format);
}

// ---------------------------------------------------------------------------
// Merged data builder
// ---------------------------------------------------------------------------

interface MergedRow {
  date: string;
  [geoLabel: string]: string | number | null;
}

function buildMergedData(
  series: GeoSeries[],
  national: TimeSeriesResult | null,
  startDate: string,
): MergedRow[] {
  // Collect all unique dates from every series
  const dateMap = new Map<string, MergedRow>();

  for (const geo of series) {
    for (const pt of geo.data.data) {
      if (pt.date < startDate) continue;
      if (!dateMap.has(pt.date)) {
        dateMap.set(pt.date, { date: pt.date });
      }
      dateMap.get(pt.date)![geo.label] = pt.value;
    }
  }

  if (national) {
    for (const pt of national.data) {
      if (pt.date < startDate) continue;
      if (!dateMap.has(pt.date)) {
        dateMap.set(pt.date, { date: pt.date });
      }
      dateMap.get(pt.date)!["National"] = pt.value;
    }
  }

  return Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

// ---------------------------------------------------------------------------
// Inner component (reads search params)
// ---------------------------------------------------------------------------

function ChartEmbedInner() {
  const searchParams = useSearchParams();

  const metric = searchParams.get("metric") ?? "";
  const geo = searchParams.get("geo") ?? "";
  const idsRaw = searchParams.get("ids") ?? "";
  const range = searchParams.get("range") ?? "3y";
  const chartType = searchParams.get("chart_type") ?? "line";
  const showNational = searchParams.get("show_national") !== "0";

  const ids = useMemo(() => {
    const split = idsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return split.slice(0, 3); // max 3
  }, [idsRaw]);

  const [state, setState] = useState<LoadState>({ status: "loading" });

  const months = RANGE_MONTHS[range] ?? 36;
  const startDate = useMemo(() => monthsAgo(months), [months]);

  useEffect(() => {
    if (!metric || !geo || ids.length === 0) {
      setState({
        status: "error",
        message: "Missing required parameters: metric, geo, and ids",
      });
      return;
    }

    let cancelled = false;

    async function loadData() {
      setState({ status: "loading" });
      try {
        const fetchOpts = { startDate };

        // Fetch all geography series in parallel
        const geoPromises = ids.map((id) =>
          fetchTimeSeriesData(metric, geo, id, fetchOpts),
        );

        // Optionally fetch national benchmark
        const nationalPromise = showNational
          ? fetchTimeSeriesData(metric, geo, "US", fetchOpts).catch(() => null)
          : Promise.resolve(null);

        const [geoResults, nationalResult] = await Promise.all([
          Promise.all(geoPromises),
          nationalPromise,
        ]);

        if (cancelled) return;

        const series: GeoSeries[] = geoResults.map((result, i) => ({
          id: ids[i],
          label: resolveGeoLabel(geo, ids[i]),
          data: result,
        }));

        setState({ status: "success", series, national: nationalResult });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load chart data";
        setState({ status: "error", message });
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [metric, geo, ids, startDate, showNational]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (state.status === "loading") {
    return <EmbedLoadingSkeleton />;
  }

  if (state.status === "error") {
    return <EmbedErrorState message={state.message} />;
  }

  const { series, national } = state;
  const metricTitle = getMetricTitle(metric);
  const metricFormat = getMetricFormat(metric);
  const rangeLabel = RANGE_LABELS[range] ?? range;
  const mergedData = buildMergedData(series, national, startDate);

  if (mergedData.length === 0) {
    return (
      <EmbedErrorState message="No data available for the selected parameters" />
    );
  }

  // Build line/area keys
  const geoKeys = series.map((s) => s.label);
  const allKeys = national ? [...geoKeys, "National"] : geoKeys;

  const isArea = chartType === "area";
  const ChartComponent = isArea ? AreaChart : LineChart;

  return (
    <div className="w-full h-full min-h-[300px] p-4 flex flex-col">
      {/* Title bar */}
      <div className="mb-3 flex-shrink-0">
        <h2 className="text-base font-medium text-on-surface leading-tight">
          {metricTitle}
        </h2>
        <p className="text-xs text-on-surface-variant mt-0.5">{rangeLabel}</p>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={mergedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#d1d5db" }}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v: number) => formatYTick(v, metricFormat)}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              labelFormatter={formatDateLabel}
              formatter={(value: number) => [
                formatMetricValue(value, metricFormat),
              ]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

            {/* Geography lines */}
            {geoKeys.map((key, i) =>
              isArea ? (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={GEO_COLORS[i % GEO_COLORS.length]}
                  fill={GEO_COLORS[i % GEO_COLORS.length]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ) : (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={GEO_COLORS[i % GEO_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ),
            )}

            {/* National benchmark (dashed gray) */}
            {national &&
              allKeys.includes("National") &&
              (isArea ? (
                <Area
                  key="National"
                  type="monotone"
                  dataKey="National"
                  stroke={NATIONAL_COLOR}
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls
                />
              ) : (
                <Line
                  key="National"
                  type="monotone"
                  dataKey="National"
                  stroke={NATIONAL_COLOR}
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls
                />
              ))}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export (with Suspense boundary for useSearchParams)
// ---------------------------------------------------------------------------

/**
 * Embeddable Chart Page
 *
 * Renders a time-series chart comparing up to 3 geographies with an optional
 * national benchmark overlay.
 *
 * URL: /embed/chart?token=emb_xxx&metric=home_value&geo=metro&ids=31080,35620&range=3y&chart_type=line&show_national=1
 */
export default function EmbedChartPage() {
  return (
    <Suspense fallback={<EmbedLoadingSkeleton />}>
      <ChartEmbedInner />
    </Suspense>
  );
}
