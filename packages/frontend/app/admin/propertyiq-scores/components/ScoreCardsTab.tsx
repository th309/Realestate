/**
 * ScoreCardsTab Component
 *
 * Displays all three PropertyIQ scores for the selected geography.
 * Works with the actual /api/scores/:geography/:locationId endpoint.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect } from 'react';

interface Geography {
  type: 'metro' | 'county' | 'zip';
  id: string;
  name: string;
}

interface ScoreCardsTabProps {
  geography: Geography | null;
}

// Matches the actual API response format (ScoreResult from backend)
interface SingleScoreResult {
  score: number;
  grade: string;
  confidence: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ApiScoreResult {
  location_id: string;
  location_name: string;
  geography: string;
  median_price: number | null;
  score_date: string;
  scores: {
    homeready: SingleScoreResult;
    investoredge: SingleScoreResult;
    markethealth: SingleScoreResult;
  };
}

// Display format for UI
interface DisplayScore {
  type: 'markethealth' | 'homeready' | 'investoredge';
  label: string;
  score: number;
  grade: string;
  confidence: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

const SCORE_LABELS: Record<string, string> = {
  markethealth: 'Market Health',
  homeready: 'HomeReady',
  investoredge: 'InvestorEdge',
};

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-lime-100 text-lime-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-orange-100 text-orange-800',
  F: 'bg-red-100 text-red-800',
};

export function ScoreCardsTab({ geography }: ScoreCardsTabProps) {
  const [data, setData] = useState<ApiScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedScore, setExpandedScore] = useState<string | null>('markethealth');

  useEffect(() => {
    console.log('[ScoreCardsTab] Geography changed:', geography);

    if (!geography?.id) {
      console.log('[ScoreCardsTab] No geography ID, clearing data');
      setData(null);
      return;
    }

    const fetchScores = async () => {
      setLoading(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const endpoint = `${apiUrl}/api/scores/${geography.type}/${encodeURIComponent(geography.id)}`;

      console.log('[ScoreCardsTab] Fetching scores from:', endpoint);
      console.log('[ScoreCardsTab] Geography details:', {
        type: geography.type,
        id: geography.id,
        name: geography.name,
      });

      try {
        const response = await fetch(endpoint, {
          headers: { 'x-user-tier': 'enterprise' },
        });

        console.log('[ScoreCardsTab] Response status:', response.status);
        console.log('[ScoreCardsTab] Response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ScoreCardsTab] Error response body:', errorText);
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('[ScoreCardsTab] API response:', JSON.stringify(result, null, 2));

        // Validate the response structure
        if (!result) {
          console.error('[ScoreCardsTab] Response is null/undefined');
          throw new Error('Empty response from API');
        }

        if (!result.scores) {
          console.error('[ScoreCardsTab] Response missing scores object:', result);
          throw new Error('Response missing scores object');
        }

        console.log('[ScoreCardsTab] Scores object:', result.scores);
        console.log('[ScoreCardsTab] markethealth:', result.scores.markethealth);
        console.log('[ScoreCardsTab] homeready:', result.scores.homeready);
        console.log('[ScoreCardsTab] investoredge:', result.scores.investoredge);

        setData(result);
      } catch (err) {
        console.error('[ScoreCardsTab] Fetch error:', err);
        console.error('[ScoreCardsTab] Error stack:', err instanceof Error ? err.stack : 'N/A');
        setError(err instanceof Error ? err.message : 'Failed to fetch scores');
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [geography]);

  // No geography selected
  if (!geography?.id) {
    return (
      <div className="text-center py-12">
        <p className="text-on-surface-variant">
          Select a geography above to view PropertyIQ scores
        </p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-surface-container rounded-xl p-6 h-48" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">{error}</p>
        <details className="text-left max-w-xl mx-auto mb-4">
          <summary className="cursor-pointer text-sm text-on-surface-variant">Debug Info</summary>
          <pre className="mt-2 p-4 bg-surface-container rounded text-xs overflow-auto">
            {JSON.stringify({ geography, apiUrl: process.env.NEXT_PUBLIC_API_URL }, null, 2)}
          </pre>
        </details>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  // No data
  if (!data) {
    console.log('[ScoreCardsTab] Render: No data available');
    return null;
  }

  console.log('[ScoreCardsTab] Render: Data available, building display scores');

  // Transform API response to display format
  const displayScores: DisplayScore[] = [];

  if (data.scores?.markethealth) {
    displayScores.push({
      type: 'markethealth',
      label: SCORE_LABELS.markethealth,
      score: data.scores.markethealth.score,
      grade: data.scores.markethealth.grade,
      confidence: data.scores.markethealth.confidence,
      confidenceLevel: data.scores.markethealth.confidence_level,
    });
  }

  if (data.scores?.homeready) {
    displayScores.push({
      type: 'homeready',
      label: SCORE_LABELS.homeready,
      score: data.scores.homeready.score,
      grade: data.scores.homeready.grade,
      confidence: data.scores.homeready.confidence,
      confidenceLevel: data.scores.homeready.confidence_level,
    });
  }

  if (data.scores?.investoredge) {
    displayScores.push({
      type: 'investoredge',
      label: SCORE_LABELS.investoredge,
      score: data.scores.investoredge.score,
      grade: data.scores.investoredge.grade,
      confidence: data.scores.investoredge.confidence,
      confidenceLevel: data.scores.investoredge.confidence_level,
    });
  }

  console.log('[ScoreCardsTab] Display scores:', displayScores);

  if (displayScores.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-on-surface-variant">No scores available for this location</p>
        <details className="text-left max-w-xl mx-auto mt-4">
          <summary className="cursor-pointer text-sm text-on-surface-variant">Debug: API Response</summary>
          <pre className="mt-2 p-4 bg-surface-container rounded text-xs overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with location info */}
      <div className="bg-surface-container rounded-xl p-4">
        <h3 className="text-lg font-semibold text-on-surface">{data.location_name}</h3>
        <div className="flex gap-4 mt-2 text-sm text-on-surface-variant">
          <span>ID: {data.location_id}</span>
          <span>Type: {data.geography}</span>
          <span>Date: {data.score_date}</span>
          {data.median_price && (
            <span>Median Price: ${data.median_price.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Score Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayScores.map((score) => {
          // Safety check - skip if score is malformed
          if (!score || !score.label) {
            console.error('[ScoreCardsTab] Malformed score in displayScores:', score);
            return null;
          }
          return (
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
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  score.confidenceLevel === 'HIGH'
                    ? 'bg-green-100 text-green-800'
                    : score.confidenceLevel === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {score.confidence}% conf
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-on-surface">
                {Math.round(score.score)}
              </span>
              <span className={`text-lg font-semibold px-2 py-0.5 rounded ${GRADE_COLORS[score.grade] || 'bg-gray-100 text-gray-800'}`}>
                {score.grade}
              </span>
            </div>
          </button>
          );
        })}
      </div>

      {/* Expanded Score Details */}
      {expandedScore && displayScores.find((s) => s.type === expandedScore) && (
        <ExpandedScoreView
          score={displayScores.find((s) => s.type === expandedScore)!}
          locationName={data.location_name}
          scoreDate={data.score_date}
        />
      )}
    </div>
  );
}

function ExpandedScoreView({
  score,
  locationName,
  scoreDate,
}: {
  score: DisplayScore;
  locationName: string;
  scoreDate: string;
}) {
  if (!score) {
    console.error('[ExpandedScoreView] No score provided');
    return null;
  }

  return (
    <div className="bg-surface-container rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-on-surface">{score.label}</h3>
          <p className="text-sm text-on-surface-variant">{locationName}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-on-surface">
              {Math.round(score.score)}
            </span>
            <span className={`text-xl font-semibold px-2 py-1 rounded ${GRADE_COLORS[score.grade] || 'bg-gray-100 text-gray-800'}`}>
              {score.grade}
            </span>
          </div>
          <div className="text-sm text-on-surface-variant mt-1">
            as of {scoreDate}
          </div>
        </div>
      </div>

      {/* Confidence Details */}
      <div className="p-4 rounded-lg bg-surface-container-high">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-on-surface">Confidence Level</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm px-2 py-1 rounded ${
              score.confidenceLevel === 'HIGH'
                ? 'bg-green-100 text-green-800'
                : score.confidenceLevel === 'MEDIUM'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
            }`}>
              {score.confidenceLevel}
            </span>
            <span className="text-sm text-on-surface-variant">
              ({score.confidence}% data completeness)
            </span>
          </div>
        </div>
      </div>

      {/* Score Interpretation */}
      <div className="p-4 rounded-lg border border-outline-variant">
        <h4 className="text-sm font-medium text-on-surface mb-2">Score Interpretation</h4>
        <p className="text-sm text-on-surface-variant">
          {getScoreInterpretation(score.type, score.score, score.grade)}
        </p>
      </div>
    </div>
  );
}

function getScoreInterpretation(type: string, score: number, grade: string): string {
  const gradeDescriptions: Record<string, string> = {
    A: 'Excellent',
    B: 'Good',
    C: 'Average',
    D: 'Below Average',
    F: 'Poor',
  };

  const gradeDesc = gradeDescriptions[grade] || 'Unknown';

  switch (type) {
    case 'markethealth':
      return `This market has ${gradeDesc.toLowerCase()} current conditions with a score of ${Math.round(score)}. Market Health measures demand/supply balance, price stability, and economic factors.`;
    case 'homeready':
      return `This market has ${gradeDesc.toLowerCase()} potential for homebuyers with a score of ${Math.round(score)}. HomeReady predicts 3-year price appreciation for owner-occupants.`;
    case 'investoredge':
      return `This market has ${gradeDesc.toLowerCase()} investment potential with a score of ${Math.round(score)}. InvestorEdge predicts total returns for rental property investors.`;
    default:
      return `Score: ${Math.round(score)} (${grade})`;
  }
}
