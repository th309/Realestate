'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  MousePointerClick,
  Eye,
  Users,
  DollarSign,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';

// Types
interface MetricCardData {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TopResource {
  resource: string;
  type: string;
  views: number;
  clicks: number;
  ctr: number;
}

interface TimeSeriesPoint {
  date: string;
  views: number;
  clicks: number;
  conversions: number;
}

// Mock data
const MOCK_METRICS: MetricCardData[] = [
  {
    label: 'Paywall Views',
    value: '12,847',
    change: 23.5,
    changeLabel: 'vs last period',
    icon: Eye,
  },
  {
    label: 'Upgrade Clicks',
    value: '1,234',
    change: 15.2,
    changeLabel: 'vs last period',
    icon: MousePointerClick,
  },
  {
    label: 'Click-Through Rate',
    value: '9.6%',
    change: -2.1,
    changeLabel: 'vs last period',
    icon: BarChart3,
  },
  {
    label: 'Conversions',
    value: '187',
    change: 32.4,
    changeLabel: 'vs last period',
    icon: DollarSign,
  },
];

const MOCK_TOP_RESOURCES: TopResource[] = [
  { resource: 'rental_yield', type: 'metric', views: 3421, clicks: 412, ctr: 12.0 },
  { resource: 'cap_rate', type: 'metric', views: 2876, clicks: 298, ctr: 10.4 },
  { resource: 'zip', type: 'geo', views: 2145, clicks: 187, ctr: 8.7 },
  { resource: 'county', type: 'geo', views: 1923, clicks: 156, ctr: 8.1 },
  { resource: 'forecast', type: 'metric', views: 1456, clicks: 98, ctr: 6.7 },
  { resource: 'tract', type: 'geo', views: 1026, clicks: 83, ctr: 8.1 },
];

const MOCK_TIMESERIES: TimeSeriesPoint[] = [
  { date: '2026-01-01', views: 1200, clicks: 110, conversions: 12 },
  { date: '2026-01-08', views: 1450, clicks: 145, conversions: 18 },
  { date: '2026-01-15', views: 1680, clicks: 168, conversions: 22 },
  { date: '2026-01-22', views: 1890, clicks: 195, conversions: 28 },
  { date: '2026-01-29', views: 2100, clicks: 210, conversions: 35 },
  { date: '2026-02-05', views: 2340, clicks: 245, conversions: 42 },
];

const MOCK_CONVERSION_FUNNEL = [
  { stage: 'Paywall Views', count: 12847, percentage: 100 },
  { stage: 'Upgrade Clicks', count: 1234, percentage: 9.6 },
  { stage: 'Pricing Page Views', count: 876, percentage: 6.8 },
  { stage: 'Checkout Started', count: 312, percentage: 2.4 },
  { stage: 'Conversions', count: 187, percentage: 1.5 },
];

// Components
function MetricCard({ data }: { data: MetricCardData }) {
  const Icon = data.icon;
  const isPositive = data.change >= 0;

  return (
    <div className="bg-surface-container rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div
          className={`
            flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
            ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
          `}
        >
          {isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {isPositive ? '+' : ''}
          {data.change}%
        </div>
      </div>
      <div className="text-2xl font-semibold text-on-surface mb-1">{data.value}</div>
      <div className="text-sm text-on-surface-variant">{data.label}</div>
    </div>
  );
}

function SimpleBarChart({ data }: { data: TimeSeriesPoint[] }) {
  const maxViews = Math.max(...data.map((d) => d.views));

  return (
    <div className="h-48 flex items-end gap-2">
      {data.map((point, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-primary/20 rounded-t relative group cursor-pointer"
            style={{ height: `${(point.views / maxViews) * 100}%` }}
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-primary rounded-t transition-all"
              style={{ height: `${(point.clicks / point.views) * 100}%` }}
            />
            {/* Tooltip */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-surface-container-high border border-outline-variant rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
              <div className="text-xs text-on-surface-variant">
                Views: {point.views.toLocaleString()}
              </div>
              <div className="text-xs text-on-surface-variant">
                Clicks: {point.clicks.toLocaleString()}
              </div>
            </div>
          </div>
          <span className="text-xs text-on-surface-variant">
            {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </div>
  );
}

function ConversionFunnel({
  data,
}: {
  data: { stage: string; count: number; percentage: number }[];
}) {
  const maxCount = data[0].count;

  return (
    <div className="space-y-3">
      {data.map((stage, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface">{stage.stage}</span>
            <span className="text-on-surface-variant">
              {stage.count.toLocaleString()} ({stage.percentage}%)
            </span>
          </div>
          <div className="h-6 bg-surface-container-high rounded-lg overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-lg transition-all"
              style={{ width: `${(stage.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  const [dateRange, setDateRange] = useState('30d');

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Analytics</h1>
          <p className="text-on-surface-variant">
            Track paywall performance and conversion metrics
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm hover:bg-surface-container-high transition-colors">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm hover:bg-surface-container-high transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {MOCK_METRICS.map((metric, i) => (
          <MetricCard key={i} data={metric} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Views & Clicks Over Time */}
        <div className="bg-surface-container rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-on-surface">
              Views & Clicks Over Time
            </h2>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-primary/20 rounded" />
                <span className="text-on-surface-variant">Views</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-primary rounded" />
                <span className="text-on-surface-variant">Clicks</span>
              </div>
            </div>
          </div>
          <SimpleBarChart data={MOCK_TIMESERIES} />
        </div>

        {/* Conversion Funnel */}
        <div className="bg-surface-container rounded-xl p-6">
          <h2 className="text-lg font-medium text-on-surface mb-6">
            Conversion Funnel
          </h2>
          <ConversionFunnel data={MOCK_CONVERSION_FUNNEL} />
        </div>
      </div>

      {/* Top Blocked Resources */}
      <div className="bg-surface-container rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-on-surface">
            Top Blocked Resources
          </h2>
          <button className="text-sm text-primary hover:underline">
            View all
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-outline-variant">
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Resource
                </th>
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  Type
                </th>
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-right">
                  Views
                </th>
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-right">
                  Clicks
                </th>
                <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-right">
                  CTR
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TOP_RESOURCES.map((resource, i) => (
                <tr
                  key={i}
                  className="border-b border-outline-variant last:border-0"
                >
                  <td className="py-3">
                    <span className="text-sm font-medium text-on-surface">
                      {resource.resource}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={`
                        text-xs px-2 py-0.5 rounded-full
                        ${resource.type === 'metric'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                        }
                      `}
                    >
                      {resource.type}
                    </span>
                  </td>
                  <td className="py-3 text-right text-sm text-on-surface-variant">
                    {resource.views.toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-sm text-on-surface-variant">
                    {resource.clicks.toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`
                        text-sm font-medium
                        ${resource.ctr >= 10
                          ? 'text-green-600'
                          : resource.ctr >= 7
                          ? 'text-amber-600'
                          : 'text-on-surface-variant'
                        }
                      `}
                    >
                      {resource.ctr}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights Section */}
      <div className="mt-8 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20">
        <h3 className="text-lg font-medium text-on-surface mb-4">
          AI Insights
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-surface rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-on-surface font-medium">
                rental_yield has the highest CTR at 12%
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Consider adding a teaser preview to increase conversions
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-surface rounded-lg">
            <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-on-surface font-medium">
                42% of free users hit multiple paywalls
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                These high-intent users may convert with a targeted offer
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
