'use client';

import React, { useMemo } from 'react';
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
} from 'recharts';
import { ComparisonConfig } from '../types';
import { MILESTONES } from '../constants';
import { getMetricTitle } from '@/app/map/config/metrics';
import { CustomTooltip } from './CustomTooltip';
import { M3Card } from './M3Card';
import { DataFooter } from './DataFooter';

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
  primary: '#6750a4',
  secondary: '#625b71',
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

  // Debug: Log chart data to verify structure
  console.log('[ChartSection] Debug:', {
    chartDataLength: chartData?.length,
    selectedArea,
    sampleData: chartData?.slice(0, 3),
    hasSelectedAreaKey: chartData?.[0] ? selectedArea in chartData[0] : false,
    firstValue: chartData?.[0]?.[selectedArea],
    valueType: typeof chartData?.[0]?.[selectedArea],
  });

  const renderSeries = () => {

    const primaryProps = {
      name: selectedArea,
      dataKey: selectedArea,
      stroke: CHART_COLORS.primary,
      strokeWidth: isMobile ? 3 : 5,
      animationDuration: 1200,
    };

    const comparisonProps = {
      name: comparison.area,
      dataKey: comparison.area,
      stroke: CHART_COLORS.secondary,
      strokeWidth: isMobile ? 3 : 5,
      animationDuration: 1200,
    };

    const baselineProps = {
      name: `Baseline: ${baseline.area}`,
      dataKey: `Baseline: ${baseline.area}`,
      stroke: CHART_COLORS.outline,
      strokeWidth: isMobile ? 1.5 : 2.5,
      strokeDasharray: '10 5',
    };

    const dotProps = {
      r: isMobile ? 3 : 5,
      strokeWidth: 2,
      stroke: '#fff',
    };

    const activeDotProps = {
      r: isMobile ? 6 : 9,
      strokeWidth: 3,
      stroke: '#fff',
    };

    if (chartType === 'area') {
      return (
        <>
          {visibleSeries.primary && (
            <Area
              type="monotone"
              dataKey={selectedArea}
              name={selectedArea}
              stroke={CHART_COLORS.primary}
              strokeWidth={3}
              fill={CHART_COLORS.primary}
              fillOpacity={0.3}
              isAnimationActive={false}
            />
          )}
          {comparison.enabled && visibleSeries.comparison && (
            <Area
              {...comparisonProps}
              type="monotone"
              fill="url(#secondaryGrad)"
              dot={{ ...dotProps, fill: CHART_COLORS.secondary }}
              activeDot={{ ...activeDotProps, fill: CHART_COLORS.secondary }}
            />
          )}
          {baseline.enabled && visibleSeries.baseline && (
            <Line {...baselineProps} type="monotone" dot={false} activeDot={{ r: 7 }} />
          )}
        </>
      );
    }

    if (chartType === 'line') {
      return (
        <>
          {visibleSeries.primary && (
            <Line
              {...primaryProps}
              type="monotone"
              dot={{ ...dotProps, fill: CHART_COLORS.primary }}
              activeDot={{ ...activeDotProps, fill: CHART_COLORS.primary }}
              isAnimationActive={false}
            />
          )}
          {comparison.enabled && visibleSeries.comparison && (
            <Line
              {...comparisonProps}
              type="monotone"
              dot={{ ...dotProps, fill: CHART_COLORS.secondary }}
              activeDot={{ ...activeDotProps, fill: CHART_COLORS.secondary }}
            />
          )}
          {baseline.enabled && visibleSeries.baseline && (
            <Line {...baselineProps} type="monotone" dot={false} activeDot={{ r: 7 }} />
          )}
        </>
      );
    }

    if (chartType === 'bar') {
      return (
        <>
          {visibleSeries.primary && (
            <Bar {...primaryProps} fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
          )}
          {comparison.enabled && visibleSeries.comparison && (
            <Bar {...comparisonProps} fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
          )}
          {baseline.enabled && visibleSeries.baseline && (
            <Line {...baselineProps} type="monotone" dot={false} activeDot={{ r: 7 }} />
          )}
        </>
      );
    }
  };

  const ChartComponent = useMemo(() => {
    switch (chartType) {
      case 'bar':
        return BarChart;
      case 'line':
        return LineChart;
      case 'area':
      default:
        return AreaChart;
    }
  }, [chartType]);

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
      <div className="h-[350px] md:h-[500px] w-full bg-surface-container-lowest rounded-2xl border border-outline-variant p-3 md:p-6">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: isMobile ? 0 : 50,
              bottom: isMobile ? 20 : 50,
            }}
          >
            <defs>
              <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="secondaryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.15} />
                <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke={CHART_COLORS.outlineVariant} />

            <XAxis
              dataKey="date"
              axisLine={{ stroke: CHART_COLORS.outlineVariant }}
              tickLine={true}
              tick={{ fill: CHART_COLORS.onSurface, fontSize: isMobile ? 9 : 11, fontWeight: 500 }}
              tickFormatter={(val) => {
                if (!val) return '';
                const date = new Date(val);
                return date.getFullYear().toString();
              }}
              dy={isMobile ? 5 : 10}
              label={
                !isMobile
                  ? {
                    value: 'Time',
                    position: 'insideBottom',
                    offset: -35,
                    fill: CHART_COLORS.onSurfaceVariant,
                    fontSize: 11,
                    fontWeight: 500,
                  }
                  : undefined
              }
            />

            <YAxis
              axisLine={{ stroke: CHART_COLORS.outlineVariant }}
              tickLine={true}
              tick={{ fill: CHART_COLORS.onSurface, fontSize: isMobile ? 8 : 10, fontWeight: 500 }}
              tickFormatter={(val) =>
                val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toLocaleString()
              }
              domain={['auto', 'auto']}
              orientation={isMobile ? 'right' : 'left'}
              label={
                !isMobile
                  ? {
                    value: getMetricTitle(metric),
                    angle: -90,
                    position: 'insideLeft',
                    offset: -35,
                    fill: CHART_COLORS.onSurfaceVariant,
                    fontSize: 11,
                    fontWeight: 500,
                  }
                  : undefined
              }
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: CHART_COLORS.primary, strokeWidth: 1.5, strokeDasharray: '6 6' }}
            />

            {showMilestones &&
              MILESTONES.map((m) => (
                <ReferenceLine
                  key={m.label}
                  x={`${m.year}-01-01`}
                  stroke={CHART_COLORS.tertiary}
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={
                    !isMobile
                      ? {
                        position: 'top',
                        value: '!',
                        fill: CHART_COLORS.tertiary,
                        fontSize: 12,
                        fontWeight: 600,
                        offset: 10,
                      }
                      : undefined
                  }
                />
              ))}

            {renderSeries()}
          </ChartComponent>
        </ResponsiveContainer>
      </div>

      {/* Data Source Attribution */}
      <DataFooter metric={metric} />
    </M3Card>
  );
};
