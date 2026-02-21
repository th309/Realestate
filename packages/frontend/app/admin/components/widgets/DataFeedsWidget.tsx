'use client';

import React, { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';
import { WidgetShell } from './WidgetShell';

interface SourceHealth {
  sourceName: string;
  displayName: string;
  sourceType: 's3' | 'api';
  available: boolean;
  responseTimeMs: number | null;
  fresh: boolean;
  daysSinceUpdate: number | null;
  expectedFreshnessDays: number;
  schemaChanged: boolean;
  lastCheck: string;
  errorMessage?: string;
}

interface DataSourcesSummary {
  total: number;
  available: number;
  fresh: number;
}

interface DataSourcesResponse {
  sources: SourceHealth[];
  summary: DataSourcesSummary;
}

interface DataFeedsWidgetProps {
  refreshTrigger: number;
}

function getFreshnessStatus(source: SourceHealth): { dotClass: string; label: string } {
  if (source.daysSinceUpdate === null || source.expectedFreshnessDays === 0) {
    return { dotClass: 'bg-gray-400', label: 'Unknown' };
  }
  const ratio = source.daysSinceUpdate / source.expectedFreshnessDays;
  if (ratio < 0.5) return { dotClass: 'bg-green-500', label: 'Fresh' };
  if (ratio < 0.9) return { dotClass: 'bg-amber-500', label: 'OK' };
  if (ratio < 1.0) return { dotClass: 'bg-orange-500', label: 'Due Soon' };
  return { dotClass: 'bg-red-500', label: 'Stale' };
}

export function DataFeedsWidget({ refreshTrigger }: DataFeedsWidgetProps) {
  const [data, setData] = useState<DataSourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAPIRaw('/api/health/data-sources');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: DataSourcesResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  return (
    <WidgetShell
      title="Data Feeds"
      icon={Database}
      href="/admin/data"
      loading={loading}
      error={error}
    >
      {data ? (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="flex items-center gap-4 text-xs">
            <span className={data.summary.available === data.summary.total ? 'text-green-600' : 'text-amber-600'}>
              {data.summary.available}/{data.summary.total} Available
            </span>
            <span className={data.summary.fresh === data.summary.total ? 'text-green-600' : 'text-amber-600'}>
              {data.summary.fresh}/{data.summary.total} Fresh
            </span>
          </div>

          {/* Source list */}
          <ul className="space-y-1.5">
            {data.sources.map((source) => {
              const freshness = getFreshnessStatus(source);
              return (
                <li key={source.sourceName} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${source.available ? 'bg-green-500' : 'bg-red-500'}`}
                    />
                    <span className="text-xs text-on-surface truncate">{source.displayName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${freshness.dotClass}`} />
                    <span className="text-xs text-on-surface-variant">{freshness.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">Unable to load data feed status</p>
      )}
    </WidgetShell>
  );
}
