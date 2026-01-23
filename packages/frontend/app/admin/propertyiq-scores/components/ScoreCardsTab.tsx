/**
 * ScoreCardsTab Component
 *
 * Displays all three PropertyIQ scores for the selected geography.
 * Shows full detail view with components and raw metrics for admin users.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect } from 'react';
import { ScoreCard } from '@/app/components/scoring/ScoreCard';
import { ComponentBar } from '@/app/components/scoring/ComponentBar';
import type { TrendDirection, ScoreAccess, ScoreStatus } from '@/app/components/scoring/ScoreBadge';

interface Geography {
  type: 'state' | 'metro' | 'county' | 'zip';
  id: string;
  name: string;
}

interface ScoreCardsTabProps {
  geography: Geography | null;
}

interface ComponentMetric {
  name: string;
  value: number | null;
  normalizedScore: number | null;
  formatted: string;
  isInherited: boolean;
  sourceGeographyType?: string;
  sourceGeographyName?: string;
}

interface ScoreComponent {
  name: string;
  label: string;
  weight: number;
  score: number;
  description: string;
  metrics: ComponentMetric[];
}

interface ScoreData {
  type: 'market_health' | 'homeready' | 'investoredge';
  label: string;
  score: number | null;
  trend: TrendDirection;
  trendChange: number;
  status: ScoreStatus;
  components: ScoreComponent[];
  confidence: {
    level: 'high' | 'medium' | 'low';
    percentage: number;
    warning?: string;
  };
  dataCompleteness: number;
  calculatedAt: string;
  formulaVersion: string;
}

interface AdminScoresResponse {
  geographyId: string;
  geographyType: string;
  geographyName: string;
  periodDate: string;
  marketHealth: ScoreData;
  homeready: ScoreData;
  investoredge: ScoreData;
}

export function ScoreCardsTab({ geography }: ScoreCardsTabProps) {
  const [data, setData] = useState<AdminScoresResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedScore, setExpandedScore] = useState<string | null>('market_health');

  useEffect(() => {
    if (!geography?.id) {
      setData(null);
      return;
    }

    const fetchScores = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(
          `${apiUrl}/api/scores/${geography.type}/${encodeURIComponent(geography.id)}`,
          {
            headers: { 'x-user-tier': 'enterprise' }, // Enterprise tier for full admin access
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch scores: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch scores');
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [geography]);

  if (!geography?.id) {
    return (
      <div className="text-center py-12">
        <p className="text-on-surface-variant">
          Select a geography above to view PropertyIQ scores
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-surface-container rounded-xl p-6 h-48" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Filter out undefined scores (API might not return all score types)
  const scores: ScoreData[] = [data.marketHealth, data.homeready, data.investoredge].filter(
    (score): score is ScoreData => score != null
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scores.map((score) => (
          <button
            key={score.type}
            onClick={() => setExpandedScore(expandedScore === score.type ? null : score.type)}
            className={`
              p-4 rounded-xl text-left transition-all
              ${
                expandedScore === score.type
                  ? 'bg-primary-container ring-2 ring-primary'
                  : 'bg-surface-container hover:bg-surface-container-high'
              }
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-on-surface-variant">{score.label}</span>
              {score.confidence && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    score.confidence.level === 'high'
                      ? 'bg-green-100 text-green-800'
                      : score.confidence.level === 'medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {score.confidence.percentage}% conf
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-on-surface">
                {score.score !== null ? Math.round(score.score) : '--'}
              </span>
              <span
                className={`text-sm ${
                  score.trend === 'up'
                    ? 'text-green-600'
                    : score.trend === 'down'
                      ? 'text-red-600'
                      : 'text-on-surface-variant'
                }`}
              >
                {score.trend === 'up' ? '↑' : score.trend === 'down' ? '↓' : '→'}
                {Math.abs(score.trendChange).toFixed(1)}
              </span>
            </div>
            <div className="mt-2 text-xs text-on-surface-variant">
              v{score.formulaVersion} • {score.dataCompleteness}% data
            </div>
          </button>
        ))}
      </div>

      {/* Expanded Score Details */}
      {expandedScore && (
        <ExpandedScoreView
          score={scores.find((s) => s.type === expandedScore)!}
          geographyName={data.geographyName}
        />
      )}
    </div>
  );
}

function ExpandedScoreView({ score, geographyName }: { score: ScoreData; geographyName: string }) {
  return (
    <div className="bg-surface-container rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-on-surface">{score.label}</h3>
          <p className="text-sm text-on-surface-variant">{geographyName}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-on-surface">
            {score.score !== null ? Math.round(score.score) : '--'}
          </div>
          <div className="text-sm text-on-surface-variant">
            Formula v{score.formulaVersion}
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-wide">
          Components
        </h4>
        {score.components.map((component) => (
          <ComponentDetailCard key={component.name} component={component} />
        ))}
      </div>

      {/* Confidence Info */}
      {score.confidence.warning && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">{score.confidence.warning}</p>
        </div>
      )}
    </div>
  );
}

function ComponentDetailCard({ component }: { component: ScoreComponent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-outline-variant rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between bg-surface-container-low hover:bg-surface-container transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="font-medium text-on-surface">{component.label}</span>
          <span className="text-sm text-on-surface-variant">{component.weight * 100}% weight</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-on-surface">
            {Math.round(component.score)}
          </span>
          <span className="text-on-surface-variant">{expanded ? '−' : '+'}</span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 bg-surface space-y-3">
          <p className="text-sm text-on-surface-variant">{component.description}</p>
          <div className="space-y-2">
            {component.metrics.map((metric) => (
              <div
                key={metric.name}
                className="flex items-center justify-between py-2 border-b border-outline-variant last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-on-surface">{metric.name}</span>
                  {metric.isInherited && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container">
                      from {metric.sourceGeographyType}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-on-surface">{metric.formatted}</span>
                  {metric.normalizedScore !== null && (
                    <span className="ml-2 text-xs text-on-surface-variant">
                      (→{Math.round(metric.normalizedScore)})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
