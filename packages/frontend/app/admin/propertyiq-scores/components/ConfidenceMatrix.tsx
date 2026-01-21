/**
 * ConfidenceMatrix Component
 *
 * Displays a matrix grid showing confidence scores by score type × horizon × geography type.
 * Features:
 * - Color-coded cells by confidence level (green/amber/red)
 * - Hover tooltips with details (R², sample size, last updated)
 * - Click-to-drill-down functionality
 * - Responsive design
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ConfidenceResult {
  confidence_score: number;
  status: string;
  r2_component: number;
  sample_component: number;
  recency_component: number;
}

type ConfidenceSummary = Record<string, Record<string, Record<string, ConfidenceResult>>>;

interface ConfidenceMatrixProps {
  onCellClick?: (scoreType: string, horizon: string, geographyType: string) => void;
}

const SCORE_TYPES = [
  { id: 'market_health', label: 'Market Health' },
  { id: 'homeready', label: 'HomeReady' },
  { id: 'investoredge', label: 'InvestorEdge' },
];

const HORIZONS = ['6m', '1y', '3y', '5y'];
const GEOGRAPHY_TYPES = ['state', 'metro', 'county', 'zip'];

function ConfidenceCell({
  confidence,
  onClick,
}: {
  confidence: ConfidenceResult | null;
  onClick?: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!confidence) {
    return (
      <td className="px-3 py-2 text-center">
        <span className="text-on-surface-variant text-sm">n/a</span>
      </td>
    );
  }

  const getColorClass = (score: number, status: string) => {
    if (status === 'healthy' || score >= 70) {
      return 'bg-green-100 text-green-800 hover:bg-green-200';
    } else if (status === 'monitor' || score >= 55) {
      return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
    } else if (status === 'review' || score >= 40) {
      return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
    } else {
      return 'bg-red-100 text-red-800 hover:bg-red-200';
    }
  };

  return (
    <td className="px-1 py-1 text-center relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          w-full px-2 py-1.5 rounded text-sm font-medium
          transition-colors cursor-pointer
          ${getColorClass(confidence.confidence_score, confidence.status)}
        `}
      >
        {confidence.confidence_score.toFixed(0)}%
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48">
          <div className="bg-inverse-surface text-inverse-on-surface rounded-lg shadow-lg p-3 text-xs">
            <div className="font-medium mb-2">Confidence Details</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Score:</span>
                <span className="font-medium">{confidence.confidence_score.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-medium capitalize">{confidence.status}</span>
              </div>
              <div className="border-t border-outline-variant my-1 pt-1">
                <div className="text-on-surface-variant mb-1">Components:</div>
                <div className="flex justify-between">
                  <span>R² (50%):</span>
                  <span>{confidence.r2_component.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sample (30%):</span>
                  <span>{confidence.sample_component.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Recency (20%):</span>
                  <span>{confidence.recency_component.toFixed(1)}</span>
                </div>
              </div>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-8 border-transparent border-t-inverse-surface"></div>
            </div>
          </div>
        </div>
      )}
    </td>
  );
}

export function ConfidenceMatrix({ onCellClick }: ConfidenceMatrixProps) {
  const [data, setData] = useState<ConfidenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/admin/backtest-runs/confidence/summary');
      if (!res.ok) {
        throw new Error('Failed to fetch confidence summary');
      }

      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getConfidence = (
    scoreType: string,
    horizon: string,
    geoType: string,
  ): ConfidenceResult | null => {
    if (!data) return null;
    return data[scoreType]?.[horizon]?.[geoType] || null;
  };

  // Calculate row averages
  const getRowAverage = (scoreType: string, geoType: string): number | null => {
    const validScores: number[] = [];
    for (const horizon of HORIZONS) {
      const conf = getConfidence(scoreType, horizon, geoType);
      if (conf) {
        validScores.push(conf.confidence_score);
      }
    }
    if (validScores.length === 0) return null;
    return validScores.reduce((a, b) => a + b, 0) / validScores.length;
  };

  // Calculate column averages
  const getColumnAverage = (scoreType: string, horizon: string): number | null => {
    const validScores: number[] = [];
    for (const geoType of GEOGRAPHY_TYPES) {
      const conf = getConfidence(scoreType, horizon, geoType);
      if (conf) {
        validScores.push(conf.confidence_score);
      }
    }
    if (validScores.length === 0) return null;
    return validScores.reduce((a, b) => a + b, 0) / validScores.length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-error-container text-on-error-container rounded-lg">
        {error}
      </div>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        No confidence data available. Run a backtest to generate confidence scores.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-on-surface-variant">Confidence levels:</span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-green-100"></span>
          <span>Healthy (70%+)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-amber-100"></span>
          <span>Monitor (55-69%)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-orange-100"></span>
          <span>Review (40-54%)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-red-100"></span>
          <span>Broken (&lt;40%)</span>
        </span>
      </div>

      {/* Matrix for each score type */}
      {SCORE_TYPES.map((scoreType) => (
        <div key={scoreType.id} className="bg-surface-container rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-high">
            <h3 className="font-medium text-on-surface">{scoreType.label}</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="px-4 py-2 text-left text-sm font-medium text-on-surface-variant">
                    Geography
                  </th>
                  {HORIZONS.map((horizon) => (
                    <th
                      key={horizon}
                      className="px-3 py-2 text-center text-sm font-medium text-on-surface-variant"
                    >
                      {horizon}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center text-sm font-medium text-on-surface-variant bg-surface-container-low">
                    Avg
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {GEOGRAPHY_TYPES.map((geoType) => (
                  <tr key={geoType} className="hover:bg-surface-container-low">
                    <td className="px-4 py-2 text-sm font-medium text-on-surface capitalize">
                      {geoType}
                    </td>
                    {HORIZONS.map((horizon) => {
                      const conf = getConfidence(scoreType.id, horizon, geoType);
                      // Skip invalid combinations (Market Health only has 6m, 1y)
                      if (
                        scoreType.id === 'market_health' &&
                        (horizon === '3y' || horizon === '5y')
                      ) {
                        return (
                          <td key={horizon} className="px-3 py-2 text-center">
                            <span className="text-on-surface-variant text-sm">-</span>
                          </td>
                        );
                      }
                      return (
                        <ConfidenceCell
                          key={horizon}
                          confidence={conf}
                          onClick={() => onCellClick?.(scoreType.id, horizon, geoType)}
                        />
                      );
                    })}
                    <td className="px-3 py-2 text-center text-sm bg-surface-container-low">
                      {(() => {
                        const avg = getRowAverage(scoreType.id, geoType);
                        return avg !== null ? (
                          <span className="font-medium">{avg.toFixed(0)}%</span>
                        ) : (
                          <span className="text-on-surface-variant">-</span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
                {/* Column averages */}
                <tr className="bg-surface-container-low border-t-2 border-outline">
                  <td className="px-4 py-2 text-sm font-medium text-on-surface">Average</td>
                  {HORIZONS.map((horizon) => {
                    if (
                      scoreType.id === 'market_health' &&
                      (horizon === '3y' || horizon === '5y')
                    ) {
                      return (
                        <td key={horizon} className="px-3 py-2 text-center">
                          <span className="text-on-surface-variant text-sm">-</span>
                        </td>
                      );
                    }
                    const avg = getColumnAverage(scoreType.id, horizon);
                    return (
                      <td key={horizon} className="px-3 py-2 text-center text-sm">
                        {avg !== null ? (
                          <span className="font-medium">{avg.toFixed(0)}%</span>
                        ) : (
                          <span className="text-on-surface-variant">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
