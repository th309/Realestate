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
 */
export const getScoreColor = (value: number, maxValue: number = 100): string => {
  const percentage = Math.min(Math.max(value / maxValue, 0), 1);
  const hue = percentage * 120; // 0 = red, 120 = green
  return `hsl(${hue}, 90%, 45%)`;
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

  // Base hue mapping: 0=Red, 120=Green
  const hue = percentage * 120;
  const strokeColor = getScoreColor(value, maxValue);

  const grade = getLetterGrade(value);
  const gradeColors = getGradeColor(grade);
  const label = getScoreLabel(value);

  // Scale font sizes based on component size
  const scoreFontSize = size >= 100 ? 'text-2xl' : size >= 60 ? 'text-lg' : 'text-sm';
  const gradeFontSize = size >= 100 ? 'text-[9px]' : size >= 60 ? 'text-[8px]' : 'text-[6px]';
  const labelFontSize = size >= 100 ? 'text-[8px]' : size >= 60 ? 'text-[7px]' : 'text-[5px]';
  const gradePadding = size >= 100 ? 'px-1.5 py-0.5' : size >= 60 ? 'px-1 py-0.5' : 'px-0.5 py-0';

  // Calculate tick mark properties
  const tickLength = strokeWidth * 1.8;
  const tickWidth = Math.max(1.5, strokeWidth / 4);

  // Get tick positions for 33% and 66% thresholds (clockwise from top)
  const getPoints = (p: number) => {
    const angle = (p / 100) * 2 * Math.PI;
    const dx = Math.sin(angle);
    const dy = Math.cos(angle);
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

  // Unique ID for the gradient to avoid collisions
  const gradientId = `score-gradient-${Math.round(value)}`;

  // Calculate dynamic stops for the gradient to ensure Red is at 0 and the color matches the scale
  // We want to map the 0-100 color scale onto the 0-value visible arc.
  const stopColors = [
    { offset: 0, color: 'hsl(0, 95%, 45%)' },       // 0: Red
    { offset: 25, color: 'hsl(30, 95%, 45%)' },     // 25: Orange
    { offset: 50, color: 'hsl(60, 95%, 45%)' },     // 50: Yellow
    { offset: 75, color: 'hsl(90, 95%, 45%)' },     // 75: Lime
    { offset: 100, color: 'hsl(120, 95%, 45%)' }    // 100: Green
  ];

  // Filter and map stops to the current visible portion (0 to value)
  const visibleStops = stopColors
    .filter(s => s.offset <= value)
    .map(s => ({
      offset: `${(s.offset / value) * 100}%`,
      color: s.color
    }));

  // Always ensure the last stop is the exact color of the current score
  if (value > 0 && !visibleStops.find(s => s.offset === '100%')) {
    visibleStops.push({
      offset: '100%',
      color: strokeColor
    });
  }

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {visibleStops.length > 0 ? (
              visibleStops.map((stop, i) => (
                <stop key={i} offset={stop.offset} stopColor={stop.color} />
              ))
            ) : (
              <stop offset="0%" stopColor="hsl(0, 95%, 45%)" />
            )}
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Rotated group for circles (clockwise from top) */}
        <g style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}>
          {/* Background circle */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-in-out"
          />
        </g>

        {/* Tick marks (not rotated, calculated from top) */}
        <line
          x1={tick33.x1}
          y1={tick33.y1}
          x2={tick33.x2}
          y2={tick33.y2}
          stroke="#6b7280"
          strokeWidth={tickWidth}
          strokeLinecap="round"
        />
        <line
          x1={tick66.x1}
          y1={tick66.y1}
          x2={tick66.x2}
          y2={tick66.y2}
          stroke="#6b7280"
          strokeWidth={tickWidth}
          strokeLinecap="round"
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
