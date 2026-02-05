/**
 * Validation Summary Cards
 *
 * Displays key validation metrics in card format:
 * - Correlation (1Y and 3Y)
 * - Hit Rate (% high scores beating benchmark)
 * - Avg Excess Return
 * - Total Validated Scores
 */

'use client';

import { useEffect, useState } from 'react';
import { fetchAPI } from '@/lib/data';

interface ValidationSummary {
  totalScores: number;
  scoresWithOutcomes: number;
  avgScore: number;
  avgReturn1y: number;
  avgReturn3y: number;
  avgExcessVsState1y: number;
  avgExcessVsState3y: number;
  correlation1y: number;
  correlation3y: number;
  hitRate1y: number;
  hitRate3y: number;
  dataRange: {
    startDate: string;
    endDate: string;
  };
}

interface Props {
  scoreType?: string;
  geography?: string;
}

function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '--';
  return `${(value * 100).toFixed(decimals)}%`;
}

function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '--';
  return value.toFixed(decimals);
}

function formatReturnPercent(value: number | null | undefined): string {
  if (value == null) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function ValidationSummaryCards({ scoreType, geography }: Props) {
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (scoreType) params.append('score_type', scoreType);
        if (geography) params.append('geography', geography);

        const queryString = params.toString();
        const endpoint = `/api/admin/scores/validation/summary${queryString ? `?${queryString}` : ''}`;

        const data = await fetchAPI<ValidationSummary>(endpoint);
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch validation data');
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [scoreType, geography]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-container-low rounded-xl p-4 animate-pulse">
            <div className="h-4 w-20 bg-outline-variant/30 rounded mb-2" />
            <div className="h-8 w-16 bg-outline-variant/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-container text-on-error-container rounded-xl p-4">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-surface-container-low rounded-xl p-4">
        <p className="text-sm text-on-surface-variant">No validation data available.</p>
      </div>
    );
  }

  const cards = [
    {
      label: '1Y Correlation',
      value: formatNumber(summary.correlation1y, 3),
      description: 'Score vs 1Y return',
      color: summary.correlation1y > 0.3 ? 'text-green-600' : summary.correlation1y > 0.1 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: '3Y Correlation',
      value: formatNumber(summary.correlation3y, 3),
      description: 'Score vs 3Y CAGR',
      color: summary.correlation3y > 0.3 ? 'text-green-600' : summary.correlation3y > 0.1 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: '1Y Hit Rate',
      value: formatPercent(summary.hitRate1y),
      description: 'High scores (>70) beating state',
      color: summary.hitRate1y > 0.6 ? 'text-green-600' : summary.hitRate1y > 0.5 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: '3Y Hit Rate',
      value: formatPercent(summary.hitRate3y),
      description: 'High scores (>70) beating state',
      color: summary.hitRate3y > 0.6 ? 'text-green-600' : summary.hitRate3y > 0.5 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: 'Avg Excess Return (1Y)',
      value: formatReturnPercent(summary.avgExcessVsState1y),
      description: 'vs state benchmark',
      color: summary.avgExcessVsState1y > 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      label: 'Avg Excess Return (3Y)',
      value: formatReturnPercent(summary.avgExcessVsState3y),
      description: 'vs state benchmark',
      color: summary.avgExcessVsState3y > 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      label: 'Validated Scores',
      value: summary.scoresWithOutcomes.toLocaleString(),
      description: `of ${summary.totalScores.toLocaleString()} total`,
      color: 'text-on-surface',
    },
    {
      label: 'Data Range',
      value: `${summary.dataRange.startDate?.slice(0, 7) || '--'} to ${summary.dataRange.endDate?.slice(0, 7) || '--'}`,
      description: 'Score dates with outcomes',
      color: 'text-on-surface',
      small: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-surface-container-low border border-outline-variant rounded-xl p-4"
        >
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
            {card.label}
          </p>
          <p className={`mt-1 ${card.small ? 'text-lg' : 'text-2xl'} font-semibold ${card.color}`}>
            {card.value}
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant">{card.description}</p>
        </div>
      ))}
    </div>
  );
}
