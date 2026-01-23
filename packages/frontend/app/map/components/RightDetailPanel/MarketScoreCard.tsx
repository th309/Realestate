/**
 * MarketScoreCard Component
 *
 * Minimalist gauge card displaying the main market score with:
 * - Large circular progress indicator with grade badge and label inside
 * - Floating confidence badge
 * - Score interpretation text
 * - Trend indicator
 * - Methodology link
 *
 * Design matches the graphs page ScoreCards component.
 * Material Design 3 compliant.
 */

'use client';

import { memo } from 'react';
import type { TrendDirection } from '../sidebar-components/TrendArrow';

interface MarketScoreCardProps {
  score: number | null;
  scoreName: string;
  scoreInterpretation?: string;
  trend?: {
    direction: TrendDirection;
    value: string;
  };
  confidence?: 'A' | 'B' | 'C' | 'D';
  isLoading?: boolean;
  onViewMethodology?: () => void;
}

/**
 * Calculate color on a gradient from red (0) to green (100) using HSL
 */
function getScoreColor(value: number, maxValue: number = 100): string {
  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  // Map 0-100 to hue 0-120 (red to green in HSL)
  const hue = percentage * 120;
  // Use saturation 70% and lightness 45% for vibrant but not too bright colors
  return `hsl(${hue}, 70%, 45%)`;
}

/**
 * Get letter grade from score
 */
function getLetterGrade(score: number): string {
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
}

/**
 * Get grade badge color (5-point scale: A=green to F=red)
 */
function getGradeColor(grade: string): { bg: string; text: string } {
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
}

/**
 * Get score label
 */
function getScoreLabel(score: number): string {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 80) return 'GREAT';
  if (score >= 70) return 'GOOD';
  if (score >= 60) return 'FAIR';
  if (score >= 50) return 'AVERAGE';
  if (score >= 40) return 'BELOW AVG';
  if (score >= 20) return 'POOR';
  return 'VERY POOR';
}

/**
 * Get trend icon based on direction
 */
function TrendIcon({ direction }: { direction: TrendDirection }) {
  if (direction === 'up') {
    return (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
}

/**
 * Get trend color based on direction
 */
function getTrendColor(direction: TrendDirection): string {
  switch (direction) {
    case 'up':
      return 'text-green-600';
    case 'down':
      return 'text-red-500';
    default:
      return 'text-on-surface-variant';
  }
}

/**
 * Loading skeleton for score card
 */
function ScoreCardSkeleton() {
  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 flex flex-col items-center justify-center min-h-[320px] border border-outline-variant animate-pulse">
      <div className="w-40 h-40 rounded-full bg-surface-container-highest" />
      <div className="mt-6 h-5 w-40 bg-surface-container-highest rounded" />
      <div className="mt-2 h-4 w-56 bg-surface-container-highest rounded" />
    </div>
  );
}

export const MarketScoreCard = memo(function MarketScoreCard({
  score,
  scoreName,
  scoreInterpretation,
  trend,
  confidence,
  isLoading = false,
  onViewMethodology,
}: MarketScoreCardProps) {
  // SVG gauge dimensions
  const size = 160;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const center = size / 2;

  // Calculate stroke offset based on score (0-100)
  const percentage = score !== null ? Math.min(score / 100, 1) : 0;
  const strokeDashoffset = circumference - percentage * circumference;
  const strokeColor = score !== null ? getScoreColor(score) : '#e5e7eb';
  const grade = score !== null ? getLetterGrade(score) : '--';
  const gradeColors = score !== null ? getGradeColor(grade) : { bg: 'bg-gray-400', text: 'text-white' };
  const label = score !== null ? getScoreLabel(score) : '';

  if (isLoading) {
    return <ScoreCardSkeleton />;
  }

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6 flex flex-col items-center justify-center relative min-h-[320px] border border-outline-variant">
      {/* Floating Confidence Badge */}
      {confidence && (
        <div className="absolute top-4 right-4 flex flex-col items-center">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Confidence
          </span>
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full font-black text-lg border border-primary/20">
            {confidence}
          </div>
        </div>
      )}

      {/* Gauge Container */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        {/* SVG Gauge */}
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          {score !== null && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          )}
        </svg>

        {/* Center content: score, grade badge, label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-on-surface leading-none">
            {score !== null ? Math.round(score) : '--'}
          </span>
          {score !== null && (
            <>
              <span className={`mt-1.5 px-2 py-0.5 text-[10px] font-bold rounded ${gradeColors.bg} ${gradeColors.text}`}>
                {grade}
              </span>
              <span className="mt-1 text-[9px] text-on-surface-variant uppercase tracking-wider">
                {label}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Score Name and Trend */}
      <div className="mt-4 text-center">
        <h3 className="text-base font-bold text-on-surface">{scoreName}</h3>
        {trend && (
          <div className={`flex items-center justify-center gap-0.5 mt-1 font-semibold text-sm ${getTrendColor(trend.direction)}`}>
            <TrendIcon direction={trend.direction} />
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {/* Interpretation Text */}
      {scoreInterpretation && (
        <p className="mt-3 text-on-surface-variant text-xs text-center max-w-[280px] leading-relaxed">
          {scoreInterpretation}
        </p>
      )}

      {/* Action Footer */}
      {onViewMethodology && (
        <div className="mt-4 pt-4 border-t border-outline-variant w-full flex justify-center">
          <button
            onClick={onViewMethodology}
            className="flex items-center gap-2 text-primary text-sm font-bold hover:gap-3 transition-all duration-200"
          >
            View Methodology
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});

export default MarketScoreCard;
