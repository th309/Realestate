'use client';

import React, { useState, useEffect } from 'react';
import { Target } from 'lucide-react';
import { fetchAPI } from '@/lib/data';
import type { ValidationSummary } from '@/lib/data';
import { WidgetShell } from './WidgetShell';

interface ScoreSummaryWidgetProps {
  refreshTrigger: number;
}

function correlationColor(value: number): string {
  if (value > 0.3) return 'text-green-600';
  if (value > 0.1) return 'text-amber-600';
  return 'text-red-600';
}

function hitRateColor(value: number): string {
  if (value > 0.6) return 'text-green-600';
  if (value > 0.5) return 'text-amber-600';
  return 'text-red-600';
}

export function ScoreSummaryWidget({ refreshTrigger }: ScoreSummaryWidgetProps) {
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAPI<ValidationSummary>(
          '/api/admin/scores/validation/summary',
        );
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const metrics = summary
    ? [
        {
          label: '1Y Correlation',
          value: summary.correlation1y.toFixed(3),
          color: correlationColor(summary.correlation1y),
        },
        {
          label: '1Y Hit Rate',
          value: `${(summary.hitRate1y * 100).toFixed(1)}%`,
          color: hitRateColor(summary.hitRate1y),
        },
        {
          label: 'Validated',
          value: summary.scoresWithOutcomes.toLocaleString(),
          sublabel: 'scores',
          color: 'text-on-surface',
        },
      ]
    : [];

  return (
    <WidgetShell
      title="Score Health"
      icon={Target}
      href="/admin/score-validation"
      loading={loading}
      error={error}
    >
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className={`text-xl font-semibold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-on-surface-variant mt-1">
              {m.label}
              {m.sublabel && (
                <span className="block text-[10px]">{m.sublabel}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
