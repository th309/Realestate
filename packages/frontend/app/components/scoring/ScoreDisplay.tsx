'use client';

import React from 'react';

/**
 * Standardized Score Display Component
 *
 * This is the canonical way to display scores across the entire application.
 * Use this component whenever you need to show a score (0-100) with visual feedback.
 *
 * Features:
 * - Circular progress ring with color gradient (red to green)
 * - Score number in center
 * - Letter grade badge (A+, A, A-, B+, B, etc.)
 * - Descriptive label (EXCELLENT, GREAT, GOOD, etc.)
 */

/** Market threshold positions (as percentages 0-100) */
export const MARKET_THRESHOLDS = {
  sellersMax: 33,   // 0-33 = Sellers Market
  balancedMax: 66,  // 34-66 = Balanced Market
  // 67-100 = Buyers Market
} as const;

export interface ScoreDisplayProps {
  /** The score value (0-100) */
  value: number;
  /** Maximum value for the score (default: 100) */
  maxValue?: number;
  /** Size of the component in pixels (default: 100) */
  size?: number;
  /** Width of the progress stroke (default: 6) */
  strokeWidth?: number;
  /** Background color for the ring (default: #e5e7eb) */
  backgroundColor?: string;
  /** Whether to show the letter grade badge (default: true) */
  showGrade?: boolean;
  /** Whether to show the label (EXCELLENT, etc.) (default: true) */
  showLabel?: boolean;
  /** Custom class name for the container */
  className?: string;
}

/**
 * Calculate color on a gradient from red (0) to green (100)
 * 0 = Red (Hue 0)
 * 100 = Green (Hue 120)
 * Smooth gradient transition through the full color spectrum
 */
export const getScoreColor = (value: number, maxValue: number = 100): string => {
  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  const hue = percentage * 120; // 0 = red, 120 = green (smooth transition)
  return `hsl(${hue}, 100%, 50%)`;
};

/**
 * Get letter grade from score (0-100)
 */
export const getLetterGrade = (score: number): string => {
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

/**
 * Get grade badge colors based on letter grade
 */
export const getGradeColor = (grade: string): { bg: string; text: string } => {
  const letter = grade.charAt(0);
  switch (letter) {
    case 'A': return { bg: 'bg-green-500', text: 'text-white' };
    case 'B': return { bg: 'bg-emerald-500', text: 'text-white' };
    case 'C': return { bg: 'bg-yellow-500', text: 'text-white' };
    case 'D': return { bg: 'bg-orange-500', text: 'text-white' };
    default: return { bg: 'bg-red-500', text: 'text-white' };
  }
};

/**
 * Get descriptive label for score
 */
export const getScoreLabel = (score: number): string => {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 80) return 'GREAT';
  if (score >= 70) return 'GOOD';
  if (score >= 60) return 'FAIR';
  if (score >= 50) return 'AVERAGE';
  if (score >= 40) return 'BELOW AVG';
  if (score >= 20) return 'POOR';
  return 'VERY POOR';
};

/**
 * ScoreDisplay - The standard score visualization component
 *
 * @example
 * // Basic usage
 * <ScoreDisplay value={85} />
 *
 * @example
 * // Compact version without label
 * <ScoreDisplay value={72} size={60} showLabel={false} />
 *
 * @example
 * // Large hero display
 * <ScoreDisplay value={95} size={150} strokeWidth={10} />
 */
/**
 * Calculate tick mark positions for market thresholds
 * Returns start and end points for a line at the given percentage around the circle
 */
const getTickMarkPoints = (
  percentage: number,
  cx: number,
  cy: number,
  radius: number,
  tickLength: number
): { x1: number; y1: number; x2: number; y2: number } => {
  // Convert percentage to angle (clockwise from top)
  const angle = (percentage / 100) * 2 * Math.PI;

  // Calculate direction vector (clockwise from top in SVG coords)
  const dirX = Math.sin(angle);
  const dirY = -Math.cos(angle);

  // Inner and outer points
  const innerRadius = radius - tickLength / 2;
  const outerRadius = radius + tickLength / 2;

  return {
    x1: cx + dirX * innerRadius,
    y1: cy - dirY * innerRadius,
    x2: cx + dirX * outerRadius,
    y2: cy - dirY * outerRadius,
  };
};

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  value,
  maxValue = 100,
  size = 100,
  strokeWidth = 6,
  backgroundColor = '#e5e7eb',
  showGrade = true,
  showLabel = true,
  className = '',
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(value / maxValue, 1);
  const strokeDashoffset = circumference - percentage * circumference;

  // Get smooth gradient color from red (0) to green (100)
  const strokeColor = getScoreColor(value, maxValue);

  const grade = getLetterGrade(value);
  const gradeColors = getGradeColor(grade);
  const label = getScoreLabel(value);

  // Scale font sizes based on component size
  const scoreFontSize = size >= 100 ? 'text-2xl' : size >= 60 ? 'text-lg' : 'text-sm';
  const gradeFontSize = size >= 100 ? 'text-[9px]' : size >= 60 ? 'text-[8px]' : 'text-[6px]';
  const labelFontSize = size >= 100 ? 'text-[8px]' : size >= 60 ? 'text-[7px]' : 'text-[5px]';
  const gradePadding = size >= 100 ? 'px-1.5 py-0.5' : size >= 60 ? 'px-1 py-0.5' : 'px-0.5 py-0';

  // Calculate tick mark properties - stay WITHIN the ring
  const tickLength = strokeWidth; // Match stroke width exactly
  const tickWidth = Math.max(1, strokeWidth / 6);

  // Get tick positions for 33% and 66% thresholds (clockwise from top)
  const getPoints = (p: number) => {
    const angle = (p / 100) * 2 * Math.PI;
    const dx = Math.sin(angle);
    const dy = Math.cos(angle);
    // Position tick centered on the stroke radius
    const innerR = radius - tickLength / 2;
    const outerR = radius + tickLength / 2;
    return {
      x1: cx + dx * innerR,
      y1: cy - dy * innerR,
      x2: cx + dx * outerR,
      y2: cy - dy * outerR,
    };
  };

  const tick33 = getPoints(MARKET_THRESHOLDS.sellersMax);
  const tick66 = getPoints(MARKET_THRESHOLDS.balancedMax);

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {/* Glow filter for premium look */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Grey Circle */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />

        {/* The Animated Score Ring - Solid color based on score */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          className="transition-all duration-700 ease-in-out"
          filter="url(#glow)"
        />

        {/* Tick marks (not rotated, calculated clockwise from top) */}
        <line
          x1={tick33.x1}
          y1={tick33.y1}
          x2={tick33.x2}
          y2={tick33.y2}
          stroke="#6b7280"
          strokeWidth={tickWidth}
          strokeLinecap="round"
          className="opacity-60"
        />
        <line
          x1={tick66.x1}
          y1={tick66.y1}
          x2={tick66.x2}
          y2={tick66.y2}
          stroke="#6b7280"
          strokeWidth={tickWidth}
          strokeLinecap="round"
          className="opacity-60"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${scoreFontSize} font-bold text-on-surface leading-none`}>
          {Math.round(value)}
        </span>
        {showGrade && (
          <span className={`mt-1 ${gradePadding} ${gradeFontSize} font-bold rounded ${gradeColors.bg} ${gradeColors.text}`}>
            {grade}
          </span>
        )}
        {showLabel && (
          <span className={`mt-0.5 ${labelFontSize} text-on-surface-variant uppercase tracking-wider`}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

export default ScoreDisplay;
