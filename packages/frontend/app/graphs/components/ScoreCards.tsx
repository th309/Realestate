'use client';

import React, { useEffect, useState } from 'react';
import { api, ScoreResponse } from '@/lib/api/client';
import { GeoLevel } from '@/app/map/config/metrics';
import { M3Card } from './M3Card';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ScoreCardsProps {
  geoLevel: GeoLevel;
  selectedArea: string;
}

interface CircularProgressProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  backgroundColor?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  maxValue = 100,
  size = 72,
  strokeWidth = 6,
  color,
  backgroundColor = 'rgba(0,0,0,0.1)',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(value / maxValue, 1);
  const strokeDashoffset = circumference - percentage * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Value in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-on-surface">
          {Math.round(value)}
        </span>
      </div>
    </div>
  );
};

interface IndicatorProps {
  label: string;
  value: number;
  color?: string;
}

const Indicator: React.FC<IndicatorProps> = ({ label, value, color }) => {
  const getTrendIcon = (val: number) => {
    if (val >= 60) return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (val >= 40) return <Minus className="w-3 h-3 text-amber-500" />;
    return <TrendingDown className="w-3 h-3 text-red-500" />;
  };

  const getBarColor = (val: number) => {
    if (val >= 60) return 'bg-green-500';
    if (val >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-on-surface-variant truncate">{label}</span>
          <div className="flex items-center gap-1">
            {getTrendIcon(value)}
            <span className="text-[10px] font-medium text-on-surface">{Math.round(value)}</span>
          </div>
        </div>
        <div className="h-1 bg-surface-variant rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getBarColor(value)}`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

interface ScoreCardProps {
  title: string;
  value: number;
  maxValue?: number;
  color: string;
  indicators: { label: string; value: number }[];
  loading?: boolean;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  title,
  value,
  maxValue = 100,
  color,
  indicators,
  loading = false,
}) => {
  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Below Avg';
    return 'Poor';
  };

  return (
    <M3Card variant="elevated" size="sm" className="flex-1">
      <div className="flex items-start gap-4">
        {/* Left: Circular Progress */}
        <div className="flex flex-col items-center">
          {loading ? (
            <div className="w-[72px] h-[72px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-on-surface-variant animate-spin" />
            </div>
          ) : (
            <CircularProgress
              value={value}
              maxValue={maxValue}
              size={72}
              strokeWidth={6}
              color={color}
              backgroundColor="rgba(0,0,0,0.08)"
            />
          )}
          <span className="text-[9px] font-medium text-on-surface-variant mt-1 uppercase tracking-wide">
            {!loading && getScoreLabel(value)}
          </span>
        </div>

        {/* Right: Title and Indicators */}
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-on-surface mb-2 truncate">
            {title}
          </h4>
          {!loading && (
            <div className="space-y-1.5">
              {indicators.map((ind, idx) => (
                <Indicator key={idx} label={ind.label} value={ind.value} />
              ))}
            </div>
          )}
        </div>
      </div>
    </M3Card>
  );
};

export const ScoreCards: React.FC<ScoreCardsProps> = ({
  geoLevel,
  selectedArea,
}) => {
  const [scores, setScores] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchScores() {
      try {
        setLoading(true);
        setError(null);

        const response = await api.getScore(geoLevel, selectedArea);

        if (isMounted) {
          setScores(response);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch scores:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch scores');
          setLoading(false);
        }
      }
    }

    fetchScores();

    return () => {
      isMounted = false;
    };
  }, [geoLevel, selectedArea]);

  // Default values when loading or error
  const homereadyScore = scores?.homereadyScore ?? 0;
  const investoredgeScore = scores?.investoredgeScore ?? 0;
  const marketHealthIndex = scores?.components?.homeready?.marketHealth ?? 0;

  // HomeReady indicators
  const homereadyIndicators = [
    { label: 'Affordability', value: scores?.components?.homeready?.affordability ?? 0 },
    { label: 'Value Growth', value: scores?.components?.homeready?.valueGrowth ?? 0 },
    { label: 'Inventory', value: scores?.components?.homeready?.inventoryHealth ?? 0 },
  ];

  // InvestorEdge indicators
  const investoredgeIndicators = [
    { label: 'Cash Flow', value: scores?.components?.investoredge?.cashFlow ?? 0 },
    { label: 'Appreciation', value: scores?.components?.investoredge?.appreciation ?? 0 },
    { label: 'Liquidity', value: scores?.components?.investoredge?.marketLiquidity ?? 0 },
  ];

  // Market Health indicators (derived from both)
  const marketHealthIndicators = [
    { label: 'Supply/Demand', value: scores?.components?.investoredge?.demandRisk ?? 0 },
    { label: 'Price Stability', value: scores?.components?.homeready?.valueGrowth ?? 0 },
    { label: 'Market Activity', value: scores?.components?.investoredge?.marketLiquidity ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ScoreCard
        title="HomeReady Score"
        value={homereadyScore}
        color="#4CAF50"
        indicators={homereadyIndicators}
        loading={loading}
      />
      <ScoreCard
        title="InvestorEdge Score"
        value={investoredgeScore}
        color="#2196F3"
        indicators={investoredgeIndicators}
        loading={loading}
      />
      <ScoreCard
        title="Market Health Index"
        value={marketHealthIndex}
        color="#FF9800"
        indicators={marketHealthIndicators}
        loading={loading}
      />
    </div>
  );
};
