'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api, ScoreResponse } from '@/lib/api/client';
import { GeoLevel } from '@/app/map/config/metrics';
import { M3Card } from './M3Card';
import { Loader2, ArrowUp, ArrowDown, ArrowRight, Pencil, Check, X } from 'lucide-react';

interface ScoreCardsProps {
  geoLevel: GeoLevel;
  selectedArea: string;
}

interface CircularProgressProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  backgroundColor?: string;
}

// Calculate color on a gradient from red (0) to green (100)
const getScoreColor = (value: number, maxValue: number = 100): string => {
  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  // Map 0-100 to hue 0-120 (red to green in HSL)
  const hue = percentage * 120;
  // Use saturation 70% and lightness 45% for vibrant but not too bright colors
  return `hsl(${hue}, 70%, 45%)`;
};

// Get letter grade from score
const getLetterGrade = (score: number): string => {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
};

// Get grade badge color (5-point scale: A=green to F=red)
const getGradeColor = (grade: string): { bg: string; text: string } => {
  const letter = grade.charAt(0);
  switch (letter) {
    case 'A':
      return { bg: 'bg-green-500', text: 'text-white' };
    case 'B':
      return { bg: 'bg-emerald-500', text: 'text-white' };
    case 'C':
      return { bg: 'bg-yellow-500', text: 'text-white' };
    case 'D':
      return { bg: 'bg-orange-500', text: 'text-white' };
    case 'F':
    default:
      return { bg: 'bg-red-500', text: 'text-white' };
  }
};

// Get score label
const getScoreLabel = (score: number): string => {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 80) return 'GREAT';
  if (score >= 70) return 'GOOD';
  if (score >= 60) return 'FAIR';
  if (score >= 50) return 'AVERAGE';
  if (score >= 40) return 'BELOW AVG';
  if (score >= 20) return 'POOR';
  return 'VERY POOR';
};

const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  maxValue = 100,
  size = 100,
  strokeWidth = 6,
  backgroundColor = '#e5e7eb',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(value / maxValue, 1);
  const strokeDashoffset = circumference - percentage * circumference;
  const strokeColor = getScoreColor(value, maxValue);
  const grade = getLetterGrade(value);
  const gradeColors = getGradeColor(grade);
  const label = getScoreLabel(value);

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
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Center content: score, grade badge, label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-on-surface leading-none">
          {Math.round(value)}
        </span>
        <span className={`mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded ${gradeColors.bg} ${gradeColors.text}`}>
          {grade}
        </span>
        <span className="mt-0.5 text-[8px] text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
      </div>
    </div>
  );
};

interface SubScoreProps {
  label: string;
  value: number;
  isEditing: boolean;
  onValueChange: (newValue: number) => void;
}

const SubScore: React.FC<SubScoreProps> = ({ label, value, isEditing, onValueChange }) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const getTrendIcon = (val: number) => {
    if (val >= 55) return <ArrowUp className="w-3 h-3" />;
    if (val <= 45) return <ArrowDown className="w-3 h-3" />;
    return <ArrowRight className="w-3 h-3" />;
  };

  const getTrendColor = (val: number) => {
    if (val >= 55) return 'text-green-600';
    if (val <= 45) return 'text-red-500';
    return 'text-on-surface-variant';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
    setLocalValue(newVal);
    onValueChange(newVal);
  };

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <span className="text-[11px] text-on-surface-variant mb-1 truncate">{label}</span>
      <div className={`flex items-center gap-0.5 ${getTrendColor(localValue)}`}>
        {isEditing ? (
          <input
            type="number"
            min="0"
            max="100"
            value={localValue}
            onChange={handleInputChange}
            className="w-12 h-6 text-sm font-semibold text-center bg-surface-container border border-outline-variant rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <>
            <span className="text-sm font-semibold">{Math.round(localValue)}</span>
            {getTrendIcon(localValue)}
          </>
        )}
      </div>
    </div>
  );
};

interface ScoreCardProps {
  title: string;
  value: number;
  maxValue?: number;
  indicators: { label: string; value: number }[];
  loading?: boolean;
  onIndicatorsChange?: (indicators: { label: string; value: number }[]) => void;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  title,
  value,
  maxValue = 100,
  indicators,
  loading = false,
  onIndicatorsChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedIndicators, setEditedIndicators] = useState(indicators);

  useEffect(() => {
    setEditedIndicators(indicators);
  }, [indicators]);

  const handleSubScoreChange = (index: number, newValue: number) => {
    const updated = [...editedIndicators];
    updated[index] = { ...updated[index], value: newValue };
    setEditedIndicators(updated);
  };

  const handleSave = () => {
    setIsEditing(false);
    onIndicatorsChange?.(editedIndicators);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedIndicators(indicators);
  };

  return (
    <M3Card variant="elevated" size="sm" className="flex-1">
      <div className="flex items-start gap-4">
        {/* Left: Circular Progress with score, grade, and label inside */}
        <div className="flex flex-col items-center">
          {loading ? (
            <div className="w-[100px] h-[100px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-on-surface-variant animate-spin" />
            </div>
          ) : (
            <CircularProgress
              value={value}
              maxValue={maxValue}
              size={100}
              strokeWidth={6}
              backgroundColor="#e5e7eb"
            />
          )}
        </div>

        {/* Right: Title and Sub-scores */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-on-surface truncate">
              {title}
            </h4>
            {!loading && (
              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="p-1 rounded-full hover:bg-surface-container-high text-green-600 transition-colors"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancel}
                      className="p-1 rounded-full hover:bg-surface-container-high text-red-500 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                    title="Edit sub-scores"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
          {!loading && (
            <div className="flex items-center justify-between gap-2">
              {editedIndicators.map((ind, idx) => (
                <SubScore
                  key={idx}
                  label={ind.label}
                  value={ind.value}
                  isEditing={isEditing}
                  onValueChange={(newVal) => handleSubScoreChange(idx, newVal)}
                />
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

  // Local state for editable indicators
  const [homereadyIndicators, setHomereadyIndicators] = useState<{ label: string; value: number }[]>([]);
  const [investoredgeIndicators, setInvestoredgeIndicators] = useState<{ label: string; value: number }[]>([]);
  const [marketHealthIndicators, setMarketHealthIndicators] = useState<{ label: string; value: number }[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchScores() {
      try {
        setLoading(true);
        setError(null);

        const response = await api.getScore(geoLevel, selectedArea);

        if (isMounted) {
          setScores(response);

          // Initialize indicators from response
          setHomereadyIndicators([
            { label: 'Affordability', value: response?.components?.homeready?.affordability ?? 0 },
            { label: 'Value Growth', value: response?.components?.homeready?.valueGrowth ?? 0 },
            { label: 'Inventory', value: response?.components?.homeready?.inventoryHealth ?? 0 },
          ]);

          setInvestoredgeIndicators([
            { label: 'Cash Flow', value: response?.components?.investoredge?.cashFlow ?? 0 },
            { label: 'Appreciation', value: response?.components?.investoredge?.appreciation ?? 0 },
            { label: 'Liquidity', value: response?.components?.investoredge?.marketLiquidity ?? 0 },
          ]);

          setMarketHealthIndicators([
            { label: 'Supply/Demand', value: response?.components?.investoredge?.demandRisk ?? 0 },
            { label: 'Price Stability', value: response?.components?.homeready?.valueGrowth ?? 0 },
            { label: 'Activity', value: response?.components?.investoredge?.marketLiquidity ?? 0 },
          ]);

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

  // Handlers for indicator changes
  const handleHomereadyChange = useCallback((updated: { label: string; value: number }[]) => {
    setHomereadyIndicators(updated);
    // TODO: Optionally persist to backend or trigger recalculation
    console.log('HomeReady indicators updated:', updated);
  }, []);

  const handleInvestoredgeChange = useCallback((updated: { label: string; value: number }[]) => {
    setInvestoredgeIndicators(updated);
    console.log('InvestorEdge indicators updated:', updated);
  }, []);

  const handleMarketHealthChange = useCallback((updated: { label: string; value: number }[]) => {
    setMarketHealthIndicators(updated);
    console.log('Market Health indicators updated:', updated);
  }, []);

  // Default values when loading or error
  const homereadyScore = scores?.homereadyScore ?? 0;
  const investoredgeScore = scores?.investoredgeScore ?? 0;
  const marketHealthIndex = scores?.components?.homeready?.marketHealth ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <ScoreCard
        title="HomeReady Score"
        value={homereadyScore}
        indicators={homereadyIndicators}
        loading={loading}
        onIndicatorsChange={handleHomereadyChange}
      />
      <ScoreCard
        title="InvestorEdge Score"
        value={investoredgeScore}
        indicators={investoredgeIndicators}
        loading={loading}
        onIndicatorsChange={handleInvestoredgeChange}
      />
      <ScoreCard
        title="Market Health Index"
        value={marketHealthIndex}
        indicators={marketHealthIndicators}
        loading={loading}
        onIndicatorsChange={handleMarketHealthChange}
      />
    </div>
  );
};
