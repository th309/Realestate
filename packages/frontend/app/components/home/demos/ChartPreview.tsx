'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Sample price trend data
const CHART_DATA = [
  { month: 'Jan', austin: 485, phoenix: 425, national: 390 },
  { month: 'Feb', austin: 490, phoenix: 430, national: 392 },
  { month: 'Mar', austin: 505, phoenix: 445, national: 398 },
  { month: 'Apr', austin: 520, phoenix: 455, national: 405 },
  { month: 'May', austin: 535, phoenix: 465, national: 412 },
  { month: 'Jun', austin: 545, phoenix: 470, national: 418 },
  { month: 'Jul', austin: 555, phoenix: 475, national: 422 },
  { month: 'Aug', austin: 560, phoenix: 480, national: 425 },
  { month: 'Sep', austin: 552, phoenix: 478, national: 420 },
  { month: 'Oct', austin: 545, phoenix: 472, national: 418 },
  { month: 'Nov', austin: 540, phoenix: 468, national: 415 },
  { month: 'Dec', austin: 548, phoenix: 475, national: 420 },
];

const METRICS = [
  { id: 'austin', label: 'Austin, TX', color: 'hsl(var(--md-primary))', value: '$548K', change: '+13.0%' },
  { id: 'phoenix', label: 'Phoenix, AZ', color: 'hsl(var(--md-tertiary))', value: '$475K', change: '+11.8%' },
  { id: 'national', label: 'National Avg', color: 'hsl(var(--md-outline))', value: '$420K', change: '+7.7%' },
];

export function ChartPreview() {
  const [activeMetric, setActiveMetric] = useState('austin');
  const [timeRange, setTimeRange] = useState('1Y');

  const currentMetric = METRICS.find(m => m.id === activeMetric) || METRICS[0];

  return (
    <div className="relative w-full h-full min-h-[320px] bg-surface-container rounded-xl overflow-hidden p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-on-surface">Median Home Price Trends</span>
        </div>
        <div className="flex gap-1 bg-surface-container-high rounded-lg p-0.5">
          {['1Y', '3Y', '5Y'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                timeRange === range
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metric selector */}
      <div className="flex gap-2 mb-3">
        {METRICS.map((metric) => (
          <button
            key={metric.id}
            onClick={() => setActiveMetric(metric.id)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeMetric === metric.id
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: metric.color }} />
              <span className="truncate">{metric.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={CHART_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="austinGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--md-primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--md-primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="phoenixGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--md-tertiary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--md-tertiary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="nationalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--md-outline))" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(var(--md-outline))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-outline-variant/30" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              className="text-on-surface-variant"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => `$${value}K`}
              className="text-on-surface-variant"
              domain={['dataMin - 20', 'dataMax + 20']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--md-surface))',
                border: '1px solid hsl(var(--md-outline-variant))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`$${value}K`, '']}
            />
            {/* National baseline - always visible */}
            <Area
              type="monotone"
              dataKey="national"
              stroke="hsl(var(--md-outline))"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="url(#nationalGradient)"
              opacity={0.5}
            />
            {/* Selected metric */}
            <Area
              type="monotone"
              dataKey={activeMetric}
              stroke={currentMetric.color}
              strokeWidth={2}
              fill={`url(#${activeMetric}Gradient)`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats footer */}
      <div className="mt-3 flex items-center justify-between pt-3 border-t border-outline-variant/50">
        <div>
          <div className="text-xs text-on-surface-variant">{currentMetric.label}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-on-surface">{currentMetric.value}</span>
            <span className="text-xs font-medium text-green-600">{currentMetric.change}</span>
          </div>
        </div>
        <Link
          href="/graphs"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          View Analytics
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
