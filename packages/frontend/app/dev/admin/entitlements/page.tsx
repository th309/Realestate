'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight,
  Users,
  DollarSign,
  TrendingUp,
  Loader2,
  RefreshCw,
  AlertCircle,
  Eye,
  MousePointerClick,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface OverviewStats {
  paywallViews: number;
  upgradeClicks: number;
  conversions: number;
  activeTrials: number;
  totalUsers: number;
  expiringSoon: number;
}

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {change && (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            {change}
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 flex items-center">
          <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />
        </div>
      ) : (
        <div className="text-2xl font-semibold text-on-surface">{value}</div>
      )}
      <div className="text-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

export default function EntitlementsOverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsRes, trialStatsRes, userStatsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/analytics/paywall?days=30`),
        fetch(`${API_URL}/api/admin/trial/stats`),
        fetch(`${API_URL}/api/admin/users/stats`),
      ]);

      let paywallViews = 0;
      let upgradeClicks = 0;
      let conversions = 0;

      if (analyticsRes.ok) {
        const analyticsResponse = await analyticsRes.json();
        const data = analyticsResponse.data || analyticsResponse;
        paywallViews = data.paywall_views ?? data.paywallViews ?? 0;
        upgradeClicks = data.upgrade_clicks ?? data.upgradeClicks ?? 0;
        conversions = data.conversions ?? 0;
      }

      let activeTrials = 0;
      let expiringSoon = 0;

      if (trialStatsRes.ok) {
        const trialResponse = await trialStatsRes.json();
        const data = trialResponse.data || trialResponse;
        activeTrials = data.active_count ?? data.activeCount ?? 0;
        expiringSoon = data.expiring_soon_count ?? data.expiringSoonCount ?? 0;
      }

      let totalUsers = 0;

      if (userStatsRes.ok) {
        const userResponse = await userStatsRes.json();
        const data = userResponse.data || userResponse;
        totalUsers = data.total_users ?? data.totalUsers ?? 0;
      }

      setStats({
        paywallViews,
        upgradeClicks,
        conversions,
        activeTrials,
        totalUsers,
        expiringSoon,
      });
    } catch (err) {
      console.error('Failed to fetch overview stats:', err);
      setError('Failed to load overview data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="max-w-6xl">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Overview</h1>
          <p className="text-on-surface-variant">
            Monitor entitlements, conversions, and user behavior
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg hover:bg-surface-container-high transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 text-on-surface-variant ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Paywall Views"
          value={stats?.paywallViews.toLocaleString() ?? '0'}
          icon={Eye}
          loading={loading}
        />
        <StatCard
          label="Upgrade Clicks"
          value={stats?.upgradeClicks.toLocaleString() ?? '0'}
          icon={MousePointerClick}
          loading={loading}
        />
        <StatCard
          label="Conversions"
          value={stats?.conversions.toLocaleString() ?? '0'}
          icon={DollarSign}
          loading={loading}
        />
        <StatCard
          label="Active Trials"
          value={stats?.activeTrials.toLocaleString() ?? '0'}
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          label="Total Users"
          value={stats?.totalUsers.toLocaleString() ?? '0'}
          icon={Users}
          loading={loading}
        />
        <StatCard
          label="Expiring Soon"
          value={stats?.expiringSoon.toLocaleString() ?? '0'}
          icon={AlertCircle}
          loading={loading}
        />
      </div>

      {/* Quick Stats */}
      {stats && stats.paywallViews > 0 && (
        <div className="bg-surface-container rounded-xl p-6 mb-8">
          <h2 className="text-lg font-medium text-on-surface mb-4">Quick Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-surface-container-high rounded-lg">
              <div className="text-2xl font-semibold text-on-surface">
                {stats.paywallViews > 0
                  ? `${((stats.upgradeClicks / stats.paywallViews) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
              <div className="text-sm text-on-surface-variant">Click-through Rate</div>
            </div>
            <div className="p-4 bg-surface-container-high rounded-lg">
              <div className="text-2xl font-semibold text-on-surface">
                {stats.upgradeClicks > 0
                  ? `${((stats.conversions / stats.upgradeClicks) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
              <div className="text-sm text-on-surface-variant">Click-to-Convert Rate</div>
            </div>
            <div className="p-4 bg-surface-container-high rounded-lg">
              <div className="text-2xl font-semibold text-on-surface">
                {stats.paywallViews > 0
                  ? `${((stats.conversions / stats.paywallViews) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
              <div className="text-sm text-on-surface-variant">Overall Conversion</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Configure Tiers', href: '/dev/admin/entitlements/tiers', desc: 'Manage feature access by tier' },
          { label: 'View Analytics', href: '/dev/admin/entitlements/analytics', desc: 'Detailed conversion metrics' },
          { label: 'Manage Users', href: '/dev/admin/entitlements/users', desc: 'User overrides and trials' },
          { label: 'Trial Settings', href: '/dev/admin/entitlements/trial', desc: 'Configure trial periods' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="
              flex flex-col p-4
              bg-surface-container rounded-xl
              hover:bg-surface-container-high transition-colors
            "
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-on-surface">{link.label}</span>
              <ArrowUpRight className="w-4 h-4 text-on-surface-variant" />
            </div>
            <span className="text-xs text-on-surface-variant">{link.desc}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
