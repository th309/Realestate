'use client';

import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';
import { WidgetShell } from './WidgetShell';

interface PipelineRun {
  id: string;
  pipelineName: string;
  displayName: string;
  startedAt: string;
  endedAt: string | null;
  status: 'running' | 'success' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsInserted: number;
  recordsFailed: number;
  durationMs: number | null;
  errorMessage?: string;
}

interface SourceSummary {
  total: number;
  available: number;
  fresh: number;
}

interface PipelineRunsWidgetProps {
  refreshTrigger: number;
}

const STATUS_BADGE: Record<PipelineRun['status'], { className: string; label: string }> = {
  success: { className: 'bg-green-100 text-green-800', label: 'Success' },
  running: { className: 'bg-blue-100 text-blue-800', label: 'Running' },
  failed: { className: 'bg-red-100 text-red-800', label: 'Failed' },
  partial: { className: 'bg-amber-100 text-amber-800', label: 'Partial' },
};

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch {
    return 'Unknown';
  }
}

export function PipelineRunsWidget({ refreshTrigger }: PipelineRunsWidgetProps) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [sourceSummary, setSourceSummary] = useState<SourceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [pipelineRes, sourcesRes] = await Promise.all([
          fetchAPIRaw('/api/health/pipeline-runs'),
          fetchAPIRaw('/api/health/data-sources'),
        ]);

        if (!pipelineRes.ok) throw new Error(`Pipeline HTTP ${pipelineRes.status}`);
        const pipelineJson = await pipelineRes.json();
        const allRuns: PipelineRun[] = pipelineJson.pipelines ?? [];

        let summary: SourceSummary | null = null;
        if (sourcesRes.ok) {
          const sourcesJson = await sourcesRes.json();
          summary = sourcesJson.summary ?? null;
        }

        if (!cancelled) {
          setRuns(allRuns.slice(0, 3));
          setSourceSummary(summary);
        }
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
      title="Pipeline Runs"
      icon={Activity}
      href="/admin/data"
      loading={loading}
      error={error}
    >
      {runs.length > 0 ? (
        <ul className="space-y-2">
          {runs.map((run) => {
            const badge = STATUS_BADGE[run.status];
            return (
              <li key={run.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-on-surface truncate">
                    {run.displayName}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant shrink-0">
                  {formatRelativeTime(run.startedAt)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : sourceSummary ? (
        <div className="space-y-2">
          <p className="text-xs text-on-surface-variant">No pipeline runs logged</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-surface-container-high rounded-lg p-2 text-center">
              <div className="text-sm font-medium text-on-surface">{sourceSummary.available}/{sourceSummary.total}</div>
              <div className="text-xs text-on-surface-variant">Available</div>
            </div>
            <div className="flex-1 bg-surface-container-high rounded-lg p-2 text-center">
              <div className="text-sm font-medium text-on-surface">{sourceSummary.fresh}/{sourceSummary.total}</div>
              <div className="text-xs text-on-surface-variant">Fresh</div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">No pipeline runs logged</p>
      )}
    </WidgetShell>
  );
}
