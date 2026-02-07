'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

interface PaywallStats {
  paywallViews: number;
  upgradeClicks: number;
  conversionRate: number;
  conversions: number;
  topBlockedResources: Array<{
    resourceId: string;
    resourceType: string;
    viewCount: number;
    clickCount: number;
  }>;
  trendsLast7Days: Array<{
    date: string;
    views: number;
    clicks: number;
  }>;
}

interface FunnelStep {
  stage: string;
  count: number;
  percentage: number;
}

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
  const [stats, setStats] = useState<PaywallStats | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;

      const [statsRes, funnelRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/analytics/paywall?days=${days}`),
        fetch(`${API_URL}/api/admin/analytics/funnel?days=${days}`),
      ]);

      if (statsRes.ok) {
        const statsResponse = await statsRes.json();
        const statsData = statsResponse.data || statsResponse;
        // Map snake_case to camelCase
        setStats({
          paywallViews: statsData.paywall_views ?? statsData.paywallViews ?? 0,
          upgradeClicks: statsData.upgrade_clicks ?? statsData.upgradeClicks ?? 0,
          conversionRate: statsData.conversion_rate ?? statsData.conversionRate ?? 0,
          conversions: statsData.conversions ?? 0,
          topBlockedResources: (statsData.top_blocked_resources ?? statsData.topBlockedResources ?? []).map(
            (r: Record<string, unknown>) => ({
              resourceId: r.resource_id ?? r.resourceId,
              resourceType: r.resource_type ?? r.resourceType,
              viewCount: r.view_count ?? r.viewCount ?? 0,
              clickCount: r.click_count ?? r.clickCount ?? 0,
            })
          ),
          trendsLast7Days: statsData.trends_last_7_days ?? statsData.trendsLast7Days ?? [],
        });
      }

      if (funnelRes.ok) {
        const funnelResponse = await funnelRes.json();
        const funnelData = funnelResponse.data || funnelResponse;
        // Ensure funnel is an array
        if (Array.isArray(funnelData)) {
          setFunnel(funnelData);
        } else if (funnelData.stages) {
          setFunnel(funnelData.stages);
        }
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build metrics from stats
  const metrics: MetricCardData[] = stats
    ? [
        {
          label: 'Paywall Views',
          value: stats.paywallViews.toLocaleString(),
          change: 0,
          changeLabel: 'vs last period',
          icon: Eye,
        },
        {
          label: 'Upgrade Clicks',
          value: stats.upgradeClicks.toLocaleString(),
          change: 0,
          changeLabel: 'vs last period',
          icon: MousePointerClick,
        },
        {
          label: 'Click-Through Rate',
          value: stats.paywallViews > 0
            ? `${((stats.upgradeClicks / stats.paywallViews) * 100).toFixed(1)}%`
            : '0%',
          change: 0,
          changeLabel: 'vs last period',
          icon: BarChart3,
        },
        {
          label: 'Conversions',
          value: stats.conversions.toLocaleString(),
          change: 0,
          changeLabel: 'vs last period',
          icon: DollarSign,
        },
      ]
    : [];

  // Build top resources from stats
  const topResources: TopResource[] = stats?.topBlockedResources?.map((r) => ({
    resource: r.resourceId,
    type: r.resourceType,
    views: r.viewCount,
    clicks: r.clickCount,
    ctr: r.viewCount > 0 ? Math.round((r.clickCount / r.viewCount) * 1000) / 10 : 0,
  })) ?? [];

  // Build timeseries from stats
  const timeseries: TimeSeriesPoint[] = stats?.trendsLast7Days?.map((d) => ({
    date: d.date,
    views: d.views,
    clicks: d.clicks,
    conversions: 0,
  })) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Analytics</h1>
          <p className="text-on-surface-variant">
            Track paywall performance and conversion metrics
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg hover:bg-surface-container-high transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4 text-on-surface-variant" />
          </button>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
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
        {metrics.length > 0 ? (
          metrics.map((metric, i) => <MetricCard key={i} data={metric} />)
        ) : (
          <div className="col-span-4 text-center py-8 text-on-surface-variant">
            No analytics data available yet
          </div>
        )}
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
          {timeseries.length > 0 ? (
            <SimpleBarChart data={timeseries} />
          ) : (
            <div className="h-48 flex items-center justify-center text-on-surface-variant">
              No time series data available
            </div>
          )}
        </div>

        {/* Conversion Funnel */}
        <div className="bg-surface-container rounded-xl p-6">
          <h2 className="text-lg font-medium text-on-surface mb-6">
            Conversion Funnel
          </h2>
          {funnel.length > 0 ? (
            <ConversionFunnel data={funnel} />
          ) : (
            <div className="h-48 flex items-center justify-center text-on-surface-variant">
              No funnel data available
            </div>
          )}
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
              {topResources.length > 0 ? (
                topResources.map((resource, i) => (
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
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                    No blocked resources tracked yet
                  </td>
                </tr>
              )}
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
