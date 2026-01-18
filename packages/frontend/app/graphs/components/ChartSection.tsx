'use client';

import React from 'react';
import {
  BarChart3,
  AreaChart as AreaIcon,
  History,
  TrendingUp,
  Eye,
  EyeOff,
  LineChart as LineIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  BarChart,
  Bar,
  LineChart,
  Legend,
} from 'recharts';
import { ComparisonConfig } from '../types';
import { MILESTONES, getMetricSource } from '../constants';
import { CustomTooltip } from './CustomTooltip';
import { M3Card } from './M3Card';

type TimeFrame = '1Y' | '3Y' | '5Y' | '10Y' | 'Max';
type ChartType = 'area' | 'line' | 'bar';

interface BaselineConfig {
  enabled: boolean;
  level: string;
  area: string;
}

interface ChartSectionProps {
  chartData: Record<string, unknown>[];
  selectedArea: string;
  comparison: ComparisonConfig;
  baseline: BaselineConfig;
  metric: string;
  timeFrame: TimeFrame;
  setTimeFrame: (tf: TimeFrame) => void;
  chartType: ChartType;
  setChartType: (ct: ChartType) => void;
  showMilestones: boolean;
  setShowMilestones: (show: boolean) => void;
  showForecast: boolean;
  setShowForecast: (show: boolean) => void;
  visibleSeries: Record<string, boolean>;
  toggleSeries: (key: string) => void;
}

const timeframeOptions: TimeFrame[] = ['1Y', '3Y', '5Y', '10Y', 'Max'];

const chartTypeConfig = [
  { type: 'area' as ChartType, icon: AreaIcon, label: 'Area' },
  { type: 'line' as ChartType, icon: LineIcon, label: 'Line' },
  { type: 'bar' as ChartType, icon: BarChart3, label: 'Bar' },
];

// M3 Color tokens for chart
const CHART_COLORS = {
  primary: '#6750a4',       // Purple - primary area
  comparison: '#0891b2',    // Cyan/Teal - comparison area (more distinct)
  tertiary: '#7d5260',
  outline: '#79747e',
  surface: '#fef7ff',
  surfaceContainer: '#f3edf7',
  onSurface: '#1d1b20',
  onSurfaceVariant: '#49454f',
  outlineVariant: '#cac4d0',
};

export const ChartSection: React.FC<ChartSectionProps> = ({
  chartData,
  selectedArea,
  comparison,
  baseline,
  metric,
  timeFrame,
  setTimeFrame,
  chartType,
  setChartType,
  showMilestones,
  setShowMilestones,
  showForecast,
  setShowForecast,
  visibleSeries,
  toggleSeries,
}) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Common chart props - compact margins for efficient space usage
  const chartMargin = {
    top: 5,
    right: 15,
    left: isMobile ? 5 : 10,
    bottom: isMobile ? 5 : 10,
  };

  // Format X-axis based on time frame
  const formatXAxisTick = (val: string) => {
    if (!val) return '';
    const date = new Date(val);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    switch (timeFrame) {
      case '1Y':
        // Show month + short year for 1 year view
        return `${months[date.getMonth()]} '${date.getFullYear().toString().slice(-2)}`;
      case '3Y':
        // Show month + short year for 3 year view
        return `${months[date.getMonth()]} '${date.getFullYear().toString().slice(-2)}`;
      default:
        // 5Y, 10Y, Max: Show full year
        return date.getFullYear().toString();
    }
  };

  // Calculate tick interval based on timeframe and data length
  const getTickInterval = () => {
    const dataLength = chartData?.length || 0;
    switch (timeFrame) {
      case '1Y':
        return isMobile ? 2 : 1; // Show every 1-2 months
      case '3Y':
        return isMobile ? 6 : 3; // Show every 3-6 months
      case '5Y':
        return Math.max(1, Math.floor(dataLength / (isMobile ? 5 : 8))); // ~5-8 labels
      case '10Y':
        return Math.max(1, Math.floor(dataLength / (isMobile ? 5 : 10))); // ~5-10 labels
      default: // Max
        return Math.max(1, Math.floor(dataLength / (isMobile ? 6 : 12))); // ~6-12 labels
    }
  };

  const xAxisProps = {
    dataKey: 'date',
    axisLine: { stroke: CHART_COLORS.outlineVariant },
    tickLine: false,
    tick: { fill: CHART_COLORS.onSurfaceVariant, fontSize: isMobile ? 9 : 10 },
    tickFormatter: formatXAxisTick,
    dy: 5,
    interval: getTickInterval(),
  };

  const yAxisProps = {
    axisLine: { stroke: CHART_COLORS.outlineVariant },
    tickLine: false,
    tick: { fill: CHART_COLORS.onSurfaceVariant, fontSize: isMobile ? 9 : 10 },
    tickFormatter: (val: number) =>
      val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toLocaleString(),
    width: isMobile ? 35 : 45,
  };

  const baselineKey = `Baseline: ${baseline.area}`;

  // Render milestone reference lines
  const renderMilestones = () => {
    if (!showMilestones) return null;
    return MILESTONES.map((m) => (
      <ReferenceLine
        key={m.label}
        x={`${m.year}-01-01`}
        stroke={CHART_COLORS.tertiary}
        strokeDasharray="3 3"
        strokeWidth={1.5}
        label={!isMobile ? {
          position: 'top',
          value: '!',
          fill: CHART_COLORS.tertiary,
          fontSize: 12,
          fontWeight: 600,
          offset: 10,
        } : undefined}
      />
    ));
  };

  // Legend props
  const legendProps = {
    verticalAlign: 'top' as const,
    align: 'right' as const,
    iconType: 'line' as const,
    iconSize: 14,
    wrapperStyle: {
      paddingBottom: 10,
      fontSize: isMobile ? 10 : 12,
      fontWeight: 500,
    },
  };

  // Render Area Chart
  const renderAreaChart = () => (
    <AreaChart data={chartData} margin={chartMargin}>
      <defs>
        <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="comparisonGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={CHART_COLORS.comparison} stopOpacity={0.25} />
          <stop offset="95%" stopColor={CHART_COLORS.comparison} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke={CHART_COLORS.outlineVariant} />
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.primary, strokeWidth: 1.5, strokeDasharray: '6 6' }} />
      <Legend {...legendProps} />
      {renderMilestones()}
      {visibleSeries.primary && (
        <Area
          type="monotone"
          dataKey={selectedArea}
          name={selectedArea}
          stroke={CHART_COLORS.primary}
          strokeWidth={isMobile ? 2 : 3}
          fill="url(#primaryGrad)"
        />
      )}
      {comparison.enabled && visibleSeries.comparison && (
        <Area
          type="monotone"
          dataKey={comparison.area}
          name={comparison.area}
          stroke={CHART_COLORS.comparison}
          strokeWidth={isMobile ? 2 : 3}
          fill="url(#comparisonGrad)"
        />
      )}
      {baseline.enabled && visibleSeries.baseline && (
        <Line
          type="monotone"
          dataKey={baselineKey}
          name={baselineKey}
          stroke={CHART_COLORS.outline}
          strokeWidth={isMobile ? 1.5 : 2}
          strokeDasharray="10 5"
          dot={false}
        />
      )}
    </AreaChart>
  );

  // Render Line Chart
  const renderLineChart = () => (
    <LineChart data={chartData} margin={chartMargin}>
      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke={CHART_COLORS.outlineVariant} />
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART_COLORS.primary, strokeWidth: 1.5, strokeDasharray: '6 6' }} />
      <Legend {...legendProps} />
      {renderMilestones()}
      {visibleSeries.primary && (
        <Line
          type="monotone"
          dataKey={selectedArea}
          name={selectedArea}
          stroke={CHART_COLORS.primary}
          strokeWidth={isMobile ? 2 : 3}
          dot={{ r: isMobile ? 3 : 4, fill: CHART_COLORS.primary, strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: isMobile ? 5 : 7, fill: CHART_COLORS.primary, strokeWidth: 2, stroke: '#fff' }}
        />
      )}
      {comparison.enabled && visibleSeries.comparison && (
        <Line
          type="monotone"
          dataKey={comparison.area}
          name={comparison.area}
          stroke={CHART_COLORS.comparison}
          strokeWidth={isMobile ? 2 : 3}
          dot={{ r: isMobile ? 3 : 4, fill: CHART_COLORS.comparison, strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: isMobile ? 5 : 7, fill: CHART_COLORS.comparison, strokeWidth: 2, stroke: '#fff' }}
        />
      )}
      {baseline.enabled && visibleSeries.baseline && (
        <Line
          type="monotone"
          dataKey={baselineKey}
          name={baselineKey}
          stroke={CHART_COLORS.outline}
          strokeWidth={isMobile ? 1.5 : 2}
          strokeDasharray="10 5"
          dot={false}
        />
      )}
    </LineChart>
  );

  // Render Bar Chart
  const renderBarChart = () => (
    <BarChart data={chartData} margin={chartMargin}>
      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke={CHART_COLORS.outlineVariant} />
      <XAxis {...xAxisProps} />
      <YAxis {...yAxisProps} />
      <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_COLORS.surfaceContainer }} />
      <Legend {...legendProps} />
      {renderMilestones()}
      {visibleSeries.primary && (
        <Bar
          dataKey={selectedArea}
          name={selectedArea}
          fill={CHART_COLORS.primary}
          radius={[4, 4, 0, 0]}
        />
      )}
      {comparison.enabled && visibleSeries.comparison && (
        <Bar
          dataKey={comparison.area}
          name={comparison.area}
          fill={CHART_COLORS.comparison}
          radius={[4, 4, 0, 0]}
        />
      )}
      {baseline.enabled && visibleSeries.baseline && (
        <Line
          type="monotone"
          dataKey={baselineKey}
          name={baselineKey}
          stroke={CHART_COLORS.outline}
          strokeWidth={isMobile ? 1.5 : 2}
          strokeDasharray="10 5"
          dot={false}
        />
      )}
    </BarChart>
  );

  return (
    <M3Card variant="elevated" size="lg" className="overflow-hidden">
      {/* Chart Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        {/* Left: Chart Type & Timeframe */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Chart Type Selector */}
          <div className="flex bg-surface-container p-1 rounded-xl">
            {chartTypeConfig.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                title={label}
                className={`p-2.5 rounded-lg transition-all duration-200 ${chartType === type
                  ? 'bg-surface text-primary elevation-1'
                  : 'text-on-surface-variant hover:text-primary'
                  }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Timeframe Selector */}
          <div className="flex bg-surface-container p-1 rounded-xl">
            {timeframeOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setTimeFrame(opt)}
                className={`px-3 md:px-4 py-2 text-[10px] md:text-xs font-medium rounded-lg transition-all duration-200 ${timeFrame === opt
                  ? 'bg-surface text-primary elevation-1'
                  : 'text-on-surface-variant hover:text-primary'
                  }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Toggles & Series Visibility */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Data Toggles */}
          <button
            onClick={() => setShowMilestones(!showMilestones)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-medium border transition-all duration-200 ${showMilestones
              ? 'bg-tertiary-container text-on-tertiary-container border-tertiary-container'
              : 'bg-surface text-on-surface-variant border-outline-variant hover:border-tertiary'
              }`}
          >
            <History className="w-3.5 h-3.5" />
            Events
          </button>
          <button
            onClick={() => setShowForecast(!showForecast)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-medium border transition-all duration-200 ${showForecast
              ? 'bg-primary-container text-on-primary-container border-primary-container'
              : 'bg-surface text-on-surface-variant border-outline-variant hover:border-primary'
              }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Forecast
          </button>

          {/* Series Visibility */}
          <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl border border-outline-variant">
            <button
              onClick={() => toggleSeries('primary')}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-all duration-200 ${visibleSeries.primary
                ? 'text-primary bg-surface elevation-1'
                : 'text-on-surface-variant opacity-50'
                }`}
            >
              {visibleSeries.primary ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span className="hidden sm:inline max-w-[60px] truncate">{selectedArea}</span>
            </button>
            {comparison.enabled && (
              <button
                onClick={() => toggleSeries('comparison')}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-all duration-200 ${visibleSeries.comparison
                  ? 'text-secondary bg-surface elevation-1'
                  : 'text-on-surface-variant opacity-50'
                  }`}
              >
                {visibleSeries.comparison ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span className="hidden sm:inline max-w-[60px] truncate">{comparison.area}</span>
              </button>
            )}
            {baseline.enabled && (
              <button
                onClick={() => toggleSeries('baseline')}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-all duration-200 ${visibleSeries.baseline
                  ? 'text-outline bg-surface elevation-1'
                  : 'text-on-surface-variant opacity-50'
                  }`}
              >
                {visibleSeries.baseline ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span className="hidden sm:inline">Base</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="h-[400px] md:h-[550px] w-full bg-surface-container-lowest rounded-2xl border border-outline-variant p-2 md:p-4 flex flex-col">
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? renderAreaChart() : chartType === 'line' ? renderLineChart() : renderBarChart()}
          </ResponsiveContainer>
        </div>
        {/* Data Source - simple text line */}
        <div className="text-[10px] text-on-surface-variant text-center pt-1">
          Source: {getMetricSource(metric)}
        </div>
      </div>
    </M3Card>
  );
};
