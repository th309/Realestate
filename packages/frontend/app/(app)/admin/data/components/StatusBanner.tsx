/**
 * StatusBanner Component
 *
 * Displays overall health status with summary metrics.
 * Shows cards, sources, and pipeline health at a glance.
 */

'use client';

import React from 'react';

interface HealthSummary {
  status: 'healthy' | 'degraded' | 'unhealthy';
  cardsTotal: number;
  cardsHealthy: number;
  sourcesTotal: number;
  sourcesAvailable: number;
  pipelinesTotal: number;
  pipelinesHealthy: number;
  lastCheck: string;
}

interface StatusBannerProps {
  summary: HealthSummary | null;
  loading: boolean;
  lastRefresh: Date;
}

export function StatusBanner({ summary, loading, lastRefresh }: StatusBannerProps) {
  if (loading && !summary) {
    return (
      <div
        className="p-4 rounded-xl bg-surface-container animate-pulse"
        data-testid="status-banner-loading"
      >
        <div className="h-6 bg-surface-container-high rounded w-48 mb-2" />
        <div className="h-4 bg-surface-container-high rounded w-96" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div
        className="p-4 rounded-xl bg-red-50 border border-red-200"
        data-testid="status-banner-error"
      >
        <div className="flex items-center gap-2">
          <span className="text-red-600 text-lg">Error loading status</span>
        </div>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'healthy':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          icon: '✓',
          label: 'All Systems Operational',
        };
      case 'degraded':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-800',
          icon: '⚠',
          label: 'Some Issues Detected',
        };
      case 'unhealthy':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: '✕',
          label: 'Critical Issues',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: '?',
          label: 'Unknown Status',
        };
    }
  };

  const statusConfig = getStatusConfig(summary.status);

  const formatLastRefresh = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  return (
    <div
      className={`p-4 rounded-xl ${statusConfig.bg} border ${statusConfig.border}`}
      data-testid="status-banner"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className={`text-2xl ${statusConfig.text}`}>{statusConfig.icon}</span>
          <div>
            <h2 className={`text-lg font-semibold ${statusConfig.text}`}>
              {statusConfig.label}
            </h2>
            <p className="text-sm text-on-surface-variant" data-testid="last-refresh-time">
              Last Check: {formatLastRefresh(lastRefresh)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="font-semibold text-on-surface">
              {summary.cardsHealthy}/{summary.cardsTotal}
            </div>
            <div className="text-on-surface-variant">Cards OK</div>
          </div>
          <div className="w-px h-8 bg-outline-variant" />
          <div className="text-center">
            <div className="font-semibold text-on-surface">
              {summary.sourcesAvailable}/{summary.sourcesTotal}
            </div>
            <div className="text-on-surface-variant">Sources Available</div>
          </div>
          <div className="w-px h-8 bg-outline-variant" />
          <div className="text-center">
            <div className="font-semibold text-on-surface">
              {summary.pipelinesHealthy}/{summary.pipelinesTotal}
            </div>
            <div className="text-on-surface-variant">Pipelines Healthy</div>
          </div>
        </div>
      </div>
    </div>
  );
}
