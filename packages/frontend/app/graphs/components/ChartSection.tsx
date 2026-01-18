'use client';

import React, { useMemo } from 'react';
import { Activity, BarChart3, AreaChart as AreaIcon } from 'lucide-react';
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
  visibleSeries: Record<string, boolean>;
}

const timeframeOptions: TimeFrame[] = ['1Y', '3Y', '5Y', '10Y', 'Max'];

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
  visibleSeries,
}) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const renderSeries = () => {
    const primaryProps = {
      name: selectedArea,
      dataKey: selectedArea,
      stroke: '#006d3d',
      strokeWidth: isMobile ? 3 : 5,
      animationDuration: 1200,
    };

    const comparisonProps = {
      name: comparison.area,
      dataKey: comparison.area,
      stroke: '#006a6a',
      strokeWidth: isMobile ? 3 : 5,
      animationDuration: 1200,
    };

    const baselineProps = {
      name: `Baseline: ${baseline.area}`,
      dataKey: `Baseline: ${baseline.area}`,
      stroke: '#717971',
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
              {...primaryProps}
              type="monotone"
              fill="url(#primaryGrad)"
              dot={{ ...dotProps, fill: '#006d3d' }}
              activeDot={{ ...activeDotProps, fill: '#006d3d' }}
            />
          )}
          {comparison.enabled && visibleSeries.comparison && (
            <Area
              {...comparisonProps}
              type="monotone"
              fill="url(#secondaryGrad)"
              dot={{ ...dotProps, fill: '#006a6a' }}
              activeDot={{ ...activeDotProps, fill: '#006a6a' }}
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
              dot={{ ...dotProps, fill: '#006d3d' }}
              activeDot={{ ...activeDotProps, fill: '#006d3d' }}
            />
          )}
          {comparison.enabled && visibleSeries.comparison && (
            <Line
              {...comparisonProps}
              type="monotone"
              dot={{ ...dotProps, fill: '#006a6a' }}
              activeDot={{ ...activeDotProps, fill: '#006a6a' }}
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
            <Bar {...primaryProps} fill="#006d3d" radius={[4, 4, 0, 0]} />
          )}
          {comparison.enabled && visibleSeries.comparison && (
            <Bar {...comparisonProps} fill="#006a6a" radius={[4, 4, 0, 0]} />
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
    <>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-6">
        <div className="flex bg-[#e7ece7] p-1 rounded-xl shadow-inner shrink-0">
          {(['area', 'line', 'bar'] as ChartType[]).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`p-2 rounded-lg transition-all ${
                chartType === type
                  ? 'bg-white text-[#006d3d] shadow-sm'
                  : 'text-[#414941] hover:text-[#006d3d]'
              }`}
            >
              {type === 'area' && <AreaIcon className="w-4 h-4" />}
              {type === 'line' && <Activity className="w-4 h-4" />}
              {type === 'bar' && <BarChart3 className="w-4 h-4" />}
            </button>
          ))}
        </div>

        <div className="flex bg-[#e7ece7] p-1 rounded-xl md:rounded-2xl shadow-inner overflow-x-auto max-w-full shrink-0">
          {timeframeOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setTimeFrame(opt)}
              className={`px-3 md:px-5 py-1.5 md:py-2 text-[10px] md:text-xs font-black rounded-lg md:rounded-xl transition-all whitespace-nowrap ${
                timeFrame === opt
                  ? 'bg-white text-[#006d3d] shadow-sm'
                  : 'text-[#414941] hover:text-[#006d3d]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[400px] md:h-[640px] w-full bg-[#fcfdfc] rounded-[24px] md:rounded-[32px] border border-[#dee5dd] p-4 md:p-8 shadow-inner overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: isMobile ? 0 : 70,
              bottom: isMobile ? 20 : 60,
            }}
          >
            <defs>
              <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#006d3d" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#006d3d" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="secondaryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#006a6a" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#006a6a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#dee5dd" />

            <XAxis
              dataKey="year"
              axisLine={{ stroke: '#dee5dd' }}
              tickLine={true}
              tick={{ fill: '#1a1c1a', fontSize: isMobile ? 9 : 11, fontWeight: 800 }}
              dy={isMobile ? 5 : 10}
              label={
                !isMobile
                  ? {
                      value: 'Economic Timeline',
                      position: 'insideBottom',
                      offset: -45,
                      fill: '#414941',
                      fontSize: 12,
                      fontWeight: 800,
                    }
                  : undefined
              }
            />

            <YAxis
              axisLine={{ stroke: '#dee5dd' }}
              tickLine={true}
              tick={{ fill: '#1a1c1a', fontSize: isMobile ? 8 : 10, fontWeight: 700 }}
              tickFormatter={(val) =>
                val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toLocaleString()
              }
              domain={['dataMin - 15000', 'auto']}
              orientation={isMobile ? 'right' : 'left'}
              label={
                !isMobile
                  ? {
                      value: getMetricTitle(metric),
                      angle: -90,
                      position: 'insideLeft',
                      offset: -55,
                      fill: '#414941',
                      fontSize: 12,
                      fontWeight: 800,
                    }
                  : undefined
              }
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#006d3d', strokeWidth: 1.5, strokeDasharray: '6 6' }}
            />

            {showMilestones &&
              MILESTONES.map((m) => (
                <ReferenceLine
                  key={m.label}
                  x={m.year}
                  stroke="#9a6b00"
                  strokeDasharray="3 3"
                  strokeWidth={2}
                  label={
                    !isMobile
                      ? {
                          position: 'top',
                          value: '!',
                          fill: '#9a6b00',
                          fontSize: 14,
                          fontWeight: 900,
                          offset: 15,
                        }
                      : undefined
                  }
                />
              ))}

            {renderSeries()}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </>
  );
};
