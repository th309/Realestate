/**
 * SystemHealthPanel
 *
 * Displays market intelligence system health metrics in an M3 card:
 * briefing coverage, news volume, rankings freshness, and Quinn status.
 */

'use client';

import React from 'react';
import { Activity, AlertCircle, Loader2 } from 'lucide-react';
import type { IntelligenceStats } from '../hooks/useIntelligenceStats';

interface SystemHealthPanelProps {
  stats: IntelligenceStats | null;
  loading: boolean;
  error: string | null;
}

export function SystemHealthPanel({ stats, loading, error }: SystemHealthPanelProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl">
      {/* Heading */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <Activity className="w-4 h-4 text-on-surface-variant" />
        <h3 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
          System Health
        </h3>
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />
            <span className="text-sm text-on-surface-variant">Loading stats...</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-3 text-xs text-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : stats ? (
          <div className="space-y-3 pt-2">
            <HealthRow
              label="Briefings"
              value={formatBriefingsSummary(stats)}
              status={getBriefingStatus(stats)}
            />
            <HealthRow
              label="Coverage"
              value={formatCoverageSummary(stats)}
              status="neutral"
            />
            <HealthRow
              label="News"
              value={`${stats.news_articles_last_7d.toLocaleString()} articles (last 7 days)`}
              status={stats.news_articles_last_7d > 0 ? 'good' : 'warning'}
            />
            <HealthRow
              label="Rankings"
              value={formatRankingsRefresh(stats.rankings_last_refresh)}
              status={getRankingsStatus(stats.rankings_last_refresh)}
            />
            <HealthRow
              label="Quinn"
              value={stats.quinn_available ? 'Available' : 'Disabled'}
              status={stats.quinn_available ? 'good' : 'warning'}
              showIndicator
            />
          </div>
        ) : (
          <p className="py-3 text-xs text-on-surface-variant">
            Unable to load system health data.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type HealthStatus = 'good' | 'warning' | 'error' | 'neutral';

function HealthRow({
  label,
  value,
  status,
  showIndicator,
}: {
  label: string;
  value: string;
  status: HealthStatus;
  showIndicator?: boolean;
}) {
  const statusColors: Record<HealthStatus, string> = {
    good: 'text-green-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
    neutral: 'text-on-surface-variant',
  };

  const dotColors: Record<HealthStatus, string> = {
    good: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    neutral: 'bg-gray-400',
  };

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm font-medium text-on-surface">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${statusColors[status]}`}>{value}</span>
        {showIndicator && (
          <span className={`w-2 h-2 rounded-full ${dotColors[status]}`} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatBriefingsSummary(stats: IntelligenceStats): string {
  const age =
    stats.oldest_briefing_days !== null
      ? ` (${stats.oldest_briefing_days}d oldest)`
      : '';
  return `${stats.total_briefings.toLocaleString()} total${age}`;
}

function formatCoverageSummary(stats: IntelligenceStats): string {
  const parts: string[] = [];
  if (stats.metros_covered > 0) {
    parts.push(`${stats.metros_covered.toLocaleString()} metros`);
  }
  if (stats.counties_covered > 0) {
    parts.push(`${stats.counties_covered.toLocaleString()} counties`);
  }
  return parts.length > 0 ? parts.join(', ') : 'No coverage data';
}

function formatRankingsRefresh(dateStr: string | null): string {
  if (!dateStr) return 'Never refreshed';
  const daysAgo = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000,
  );
  if (daysAgo === 0) return 'Refreshed today';
  if (daysAgo === 1) return 'Refreshed 1 day ago';
  return `Refreshed ${daysAgo} days ago`;
}

function getBriefingStatus(stats: IntelligenceStats): HealthStatus {
  if (stats.total_briefings === 0) return 'error';
  if (stats.oldest_briefing_days !== null && stats.oldest_briefing_days > 14)
    return 'warning';
  return 'good';
}

function getRankingsStatus(dateStr: string | null): HealthStatus {
  if (!dateStr) return 'error';
  const daysAgo = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000,
  );
  if (daysAgo > 7) return 'warning';
  return 'good';
}
