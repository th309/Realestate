'use client';

/**
 * ScoreWidget - Connected Score Display Component
 *
 * A "smart" component that fetches score data from the data binding layer
 * and renders the standardized ScoreDisplay.
 *
 * Use this component when you want the score to fetch its own data.
 * Use ScoreDisplay directly when you already have the score value.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { ScoreDisplay, ScoreDisplayProps } from './ScoreDisplay';
import {
  useScoreData,
  type GeographyType,
  type ScoreType,
  type ConfidenceLevel,
} from '@/app/map/hooks/useScoreData';

export interface ScoreWidgetProps extends Omit<ScoreDisplayProps, 'value'> {
  /** Geography type (state, metro, county, etc.) */
  geographyType: GeographyType | null;
  /** Geography ID (FIPS code, CBSA code, etc.) */
  geographyId: string | null;
  /** Which score to display */
  scoreType: ScoreType;
  /** Show confidence badge (default: false) */
  showConfidence?: boolean;
  /** Callback when score data loads */
  onScoreLoad?: (score: number | null, confidence: ConfidenceLevel | null) => void;
}

const CONFIDENCE_COLORS: Record<ConfidenceLevel, { bg: string; text: string }> = {
  high: { bg: 'bg-green-500', text: 'text-white' },
  medium: { bg: 'bg-amber-500', text: 'text-white' },
  low: { bg: 'bg-orange-500', text: 'text-white' },
  insufficient: { bg: 'bg-red-500', text: 'text-white' },
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
  insufficient: 'N/A',
};

/**
 * ScoreWidget fetches score data from useScoreData and displays it.
 *
 * @example
 * // Auto-fetch and display HomeReady score for a metro
 * <ScoreWidget
 *   geographyType="metro"
 *   geographyId="31080"
 *   scoreType="homeready"
 *   size={100}
 * />
 *
 * @example
 * // With confidence badge
 * <ScoreWidget
 *   geographyType="county"
 *   geographyId="06037"
 *   scoreType="investoredge"
 *   showConfidence
 * />
 */
export function ScoreWidget({
  geographyType,
  geographyId,
  scoreType,
  showConfidence = false,
  onScoreLoad,
  size = 100,
  strokeWidth = 6,
  showGrade = true,
  showLabel = true,
  className = '',
}: ScoreWidgetProps) {
  const { data, loading, error } = useScoreData(geographyType, geographyId);

  // Extract score and confidence for the requested type
  const scoreData = React.useMemo(() => {
    if (!data) return { score: null, confidence: null };

    const key = scoreType === 'market_health' ? 'marketHealth' : scoreType;
    const scoreObj = data[key as keyof typeof data];

    if (typeof scoreObj === 'object' && scoreObj !== null && 'score' in scoreObj) {
      const score = (scoreObj as any).score as number | null;
      const confidence = (scoreObj as any).confidence?.level as ConfidenceLevel | undefined;
      return { score, confidence: confidence ?? 'medium' };
    }

    return { score: null, confidence: null };
  }, [data, scoreType]);

  // Notify parent when score loads
  React.useEffect(() => {
    if (onScoreLoad && !loading) {
      onScoreLoad(scoreData.score, scoreData.confidence);
    }
  }, [scoreData, loading, onScoreLoad]);

  // Loading state
  if (loading) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  // Error or no data state
  if (error || scoreData.score === null) {
    return (
      <div
        className={`flex items-center justify-center rounded-full border-4 border-surface-container-highest ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-lg text-on-surface-variant">--</span>
      </div>
    );
  }

  // Render with confidence badge
  if (showConfidence && scoreData.confidence) {
    const confColors = CONFIDENCE_COLORS[scoreData.confidence];
    return (
      <div className={`relative ${className}`}>
        {/* Confidence badge */}
        <div className="absolute -top-1 -right-1 z-10">
          <div
            className={`${confColors.bg} ${confColors.text} px-1.5 py-0.5 rounded-full text-[8px] font-bold`}
          >
            {CONFIDENCE_LABELS[scoreData.confidence]}
          </div>
        </div>
        <ScoreDisplay
          value={scoreData.score}
          size={size}
          strokeWidth={strokeWidth}
          showGrade={showGrade}
          showLabel={showLabel}
        />
      </div>
    );
  }

  // Simple render
  return (
    <ScoreDisplay
      value={scoreData.score}
      size={size}
      strokeWidth={strokeWidth}
      showGrade={showGrade}
      showLabel={showLabel}
      className={className}
    />
  );
}

export default ScoreWidget;
