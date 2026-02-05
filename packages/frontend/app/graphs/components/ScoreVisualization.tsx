'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, Info, Clock } from 'lucide-react';
import { api } from '@/lib/api/client';
import type { GeoLevel, ScoreResponse } from '@/lib/data';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';
import { ScoreHistoryChart } from '@/app/components/scoring/ScoreHistoryChart';
import { M3Card, M3CardHeader } from './M3Card';

type ScoreType = 'homeready' | 'investoredge' | 'market_health';
type ScoreMetricId = 'homeready_score' | 'investoredge_score' | 'market_health_score';

// Map metric IDs to score types
const METRIC_TO_SCORE_TYPE: Record<ScoreMetricId, ScoreType> = {
  homeready_score: 'homeready',
  investoredge_score: 'investoredge',
  market_health_score: 'market_health',
};

interface ScoreVisualizationProps {
  /** The score metric ID (e.g., 'homeready_score') */
  scoreType: ScoreMetricId | ScoreType;
  geoLevel: GeoLevel;
  selectedArea: string;
  selectedAreaId: string;
}

interface ScoreFactorData {
  name: string;
  value: number;
  weight: number;
  description: string;
}

const SCORE_CONFIG: Record<ScoreType, {
  title: string;
  apiKey: 'homeready' | 'investoredge' | 'markethealth';
  description: string;
  color: string;
  factors: ScoreFactorData[];
}> = {
  homeready: {
    title: 'HomeReady Score',
    apiKey: 'homeready',
    description: 'Measures buyer opportunity based on pricing trends, inventory levels, and market dynamics. Higher scores indicate better buying conditions.',
    color: 'primary',
    factors: [
      { name: 'Affordability', value: 0, weight: 30, description: 'Price-to-income ratios and affordability metrics' },
      { name: 'Market Activity', value: 0, weight: 25, description: 'Inventory levels and days on market' },
      { name: 'Price Trends', value: 0, weight: 25, description: 'Recent price changes and momentum' },
      { name: 'Competition', value: 0, weight: 20, description: 'Buyer competition and market heat' },
    ],
  },
  investoredge: {
    title: 'InvestorEdge Score',
    apiKey: 'investoredge',
    description: 'Evaluates investment potential based on rental yields, appreciation forecasts, and risk factors. Higher scores indicate better investment opportunities.',
    color: 'secondary',
    factors: [
      { name: 'Cash Flow', value: 0, weight: 30, description: 'Cap rates and gross yields' },
      { name: 'Appreciation', value: 0, weight: 25, description: 'Historical and projected price growth' },
      { name: 'Demand', value: 0, weight: 25, description: 'Rental demand and occupancy indicators' },
      { name: 'Risk', value: 0, weight: 20, description: 'Market volatility and economic stability' },
    ],
  },
  market_health: {
    title: 'Market Health Score',
    apiKey: 'markethealth',
    description: 'Assesses overall market stability and robustness. Higher scores indicate healthier, more balanced markets.',
    color: 'tertiary',
    factors: [
      { name: 'Supply/Demand', value: 0, weight: 30, description: 'Balance of inventory and buyer activity' },
      { name: 'Price Stability', value: 0, weight: 25, description: 'Consistency of price movements' },
      { name: 'Economic Base', value: 0, weight: 25, description: 'Job growth and income stability' },
      { name: 'Market Depth', value: 0, weight: 20, description: 'Transaction volume and liquidity' },
    ],
  },
};

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'High Confidence', color: 'bg-green-500' },
  medium: { label: 'Medium Confidence', color: 'bg-amber-500' },
  low: { label: 'Low Confidence', color: 'bg-orange-500' },
  insufficient: { label: 'Insufficient Data', color: 'bg-red-500' },
};

function getScoreGrade(score: number): { grade: string; label: string; color: string } {
  if (score >= 80) return { grade: 'A', label: 'Excellent', color: 'text-green-600' };
  if (score >= 70) return { grade: 'B', label: 'Good', color: 'text-green-500' };
  if (score >= 60) return { grade: 'C', label: 'Average', color: 'text-amber-500' };
  if (score >= 50) return { grade: 'D', label: 'Below Average', color: 'text-orange-500' };
  return { grade: 'F', label: 'Poor', color: 'text-red-500' };
}

export const ScoreVisualization: React.FC<ScoreVisualizationProps> = ({
  scoreType: scoreTypeInput,
  geoLevel,
  selectedArea,
  selectedAreaId,
}) => {
  const [scores, setScores] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map metric ID to score type if needed
  const scoreType: ScoreType = (scoreTypeInput in METRIC_TO_SCORE_TYPE)
    ? METRIC_TO_SCORE_TYPE[scoreTypeInput as ScoreMetricId]
    : scoreTypeInput as ScoreType;

  const config = SCORE_CONFIG[scoreType];

  // Fetch score data
  useEffect(() => {
    let isMounted = true;

    if (!selectedAreaId || geoLevel === 'state' || geoLevel === 'national') {
      setScores(null);
      setLoading(false);
      return;
    }

    async function fetchScoreData() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getScore(geoLevel, selectedAreaId);
        if (isMounted) {
          setScores(response as ScoreResponse | null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch scores:', err);
        if (isMounted) {
          setError('Failed to load score data');
          setLoading(false);
        }
      }
    }

    fetchScoreData();
    return () => { isMounted = false; };
  }, [geoLevel, selectedAreaId]);

  // Get score data for the selected type
  const scoreData = scores?.scores?.[config.apiKey];
  const score = scoreData?.score ?? 0;
  const confidenceLevel = (scoreData?.confidence_level?.toLowerCase() ?? 'medium') as keyof typeof CONFIDENCE_LABELS;
  const confidence = CONFIDENCE_LABELS[confidenceLevel] || CONFIDENCE_LABELS.medium;
  // Note: trend_3m may come from expanded score API with historyMonths option
  const trend = (scoreData as any)?.trend_3m ?? null;
  const grade = getScoreGrade(score);

  // Show unavailable message for state/national
  if (geoLevel === 'state' || geoLevel === 'national') {
    return (
      <M3Card variant="elevated" className="h-full flex flex-col items-center justify-center p-8">
        <Info className="w-12 h-12 text-on-surface-variant mb-4" />
        <h3 className="text-lg font-semibold text-on-surface mb-2">Scores Unavailable at This Level</h3>
        <p className="text-sm text-on-surface-variant text-center max-w-md">
          PropertyIQ scores are available at the metro, county, and ZIP code level where they are most predictive.
          Select a more specific geography to view {config.title}.
        </p>
      </M3Card>
    );
  }

  // Show select location message when no area selected
  if (!selectedAreaId) {
    return (
      <M3Card variant="elevated" className="h-full flex flex-col items-center justify-center p-8">
        <Info className="w-12 h-12 text-on-surface-variant mb-4" />
        <h3 className="text-lg font-semibold text-on-surface mb-2">Select a Location</h3>
        <p className="text-sm text-on-surface-variant text-center max-w-md">
          Search for and select a {geoLevel} to view the {config.title}.
        </p>
      </M3Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <M3Card variant="elevated" className="h-full flex flex-col items-center justify-center p-8">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-sm text-on-surface-variant">Loading {config.title}...</p>
      </M3Card>
    );
  }

  // Error state
  if (error) {
    return (
      <M3Card variant="elevated" className="h-full flex flex-col items-center justify-center p-8">
        <Info className="w-12 h-12 text-error mb-4" />
        <h3 className="text-lg font-semibold text-on-surface mb-2">Unable to Load Score</h3>
        <p className="text-sm text-on-surface-variant text-center">{error}</p>
      </M3Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <M3Card variant="elevated" className="p-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: Score Gauge */}
          <div className="flex flex-col items-center lg:items-start">
            <ScoreDisplay
              value={score}
              size={200}
              strokeWidth={14}
            />

            {/* Trend indicator */}
            {trend !== null && (
              <div className={`flex items-center gap-1.5 mt-4 text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)} pts (3M)</span>
              </div>
            )}
          </div>

          {/* Right: Score Details */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-on-surface">{config.title}</h2>
                <p className="text-sm text-on-surface-variant mt-1">{selectedArea}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Grade Badge */}
                <div className={`text-center px-4 py-2 rounded-xl bg-surface-container-high`}>
                  <div className={`text-2xl font-bold ${grade.color}`}>{grade.grade}</div>
                  <div className="text-xs text-on-surface-variant">{grade.label}</div>
                </div>
                {/* Confidence Badge */}
                <div className={`px-3 py-1.5 rounded-full ${confidence.color} text-white text-xs font-medium`}>
                  {confidence.label}
                </div>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant mb-6">
              {config.description}
            </p>

            {/* Factor Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                <span>Score Components</span>
                <span className="text-xs font-normal text-on-surface-variant">(Weighted factors)</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {config.factors.map((factor) => (
                  <div
                    key={factor.name}
                    className="bg-surface-container rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-on-surface">{factor.name}</span>
                      <span className="text-xs text-on-surface-variant">{factor.weight}%</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{factor.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </M3Card>

      {/* Historical Score Chart */}
      <M3Card variant="elevated" className="p-6">
        <M3CardHeader
          icon={<Clock className="w-4 h-4 text-primary" />}
          title="Score History"
          subtitle="Track score changes over time with actual returns validation"
        />
        <div className="mt-4">
          <ScoreHistoryChart
            geographyType={geoLevel}
            geographyId={selectedAreaId}
            scoreType={config.apiKey}
            initialYears={3}
          />
        </div>
      </M3Card>

      {/* Future: Time Series Chart (when backend supports it) */}
      <div className="bg-surface-container-low border border-dashed border-outline-variant rounded-xl p-6 text-center">
        <Clock className="w-8 h-8 text-on-surface-variant mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-on-surface mb-1">Time Series Coming Soon</h3>
        <p className="text-xs text-on-surface-variant max-w-md mx-auto">
          Full time series visualization for {config.title} will be available when historical score data is enabled.
          This will allow you to track score trends alongside market metrics.
        </p>
      </div>
    </div>
  );
};

export default ScoreVisualization;
