import React from "react";
import {
  getScoreLabel,
  getScoreMomentumArrow,
  getScoreMomentumColorClass,
  SCORE_MOMENTUM_DESCRIPTOR,
} from "./score-labels";

// Re-exported so existing `@/app/components/scoring/ScoreDisplay` import sites
// keep working unchanged (these pure momentum utilities now live in the plain,
// server-importable ./score-labels module — SSOT preserved).
export {
  getScoreLabel,
  getScoreMomentumArrow,
  getScoreMomentumColorClass,
  SCORE_MOMENTUM_DESCRIPTOR,
};

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
  sellersMax: 33, // 0-33 = Sellers Market
  balancedMax: 66, // 34-66 = Balanced Market
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
  /**
   * Whether to show the percentile letter-grade badge (A+/A/.../F) inside the
   * ring (default: false). The PropertyIQ Score is a momentum/timing signal, so
   * the harsh quality-grade "F" undercuts the momentum reframe — the score
   * number + momentum label/arrow tell the whole story. Kept as an opt-in prop
   * for any legacy surface that genuinely needs it; new surfaces should not.
   * NOTE: this is the SCORE percentile grade, NOT the data-quality CONFIDENCE
   * badge (A/B/C/F) rendered by ScoreWidget/ConfidenceDisplay — those are
   * unrelated and stay visible.
   */
  showGrade?: boolean;
  /** Whether to show the label (EXCELLENT, etc.) (default: true) */
  showLabel?: boolean;
  /** Custom class name for the container */
  className?: string;
}

// Score color now lives in ./score-color (plain module, server-importable) so
// Server Components (ScoreTeaser, OG images) share the exact same brand ramp.
// Imported (used by the ring strokes below) AND re-exported to keep this file
// the canonical import surface (§9).
import { getScoreColor } from "./score-color";
export { getScoreColor };

/**
 * Get letter grade from score (0-100)
 */
export const getLetterGrade = (score: number): string => {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
};

/**
 * Get grade badge colors based on letter grade
 */
export const getGradeColor = (grade: string): { bg: string; text: string } => {
  const letter = grade.charAt(0);
  switch (letter) {
    case "A":
      return { bg: "bg-green-500", text: "text-white" };
    case "B":
      return { bg: "bg-emerald-500", text: "text-white" };
    case "C":
      return { bg: "bg-yellow-500", text: "text-white" };
    case "D":
      return { bg: "bg-orange-500", text: "text-white" };
    default:
      return { bg: "bg-red-500", text: "text-white" };
  }
};

/**
 * getScoreLabel, getScoreMomentumArrow, and SCORE_MOMENTUM_DESCRIPTOR now live
 * in ./score-labels (a plain, server-importable module) and are imported +
 * re-exported at the top of this file — see the note there.
 */

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
export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  value,
  maxValue = 100,
  size = 100,
  strokeWidth = 6,
  backgroundColor = "var(--color-gray-200, #e5e7eb)",
  showGrade = false,
  showLabel = true,
  className = "",
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(value / maxValue, 1);

  // Gradient along the arc: draw many small segments, each colored by position (0%=red → 100%=green)
  const segmentCount = 72;
  const segmentLength = circumference / segmentCount;
  const fullSegments = Math.floor(percentage * segmentCount);
  const partialLength =
    (percentage * segmentCount - fullSegments) * segmentLength;

  const grade = getLetterGrade(value);
  const gradeColors = getGradeColor(grade);
  const label = getScoreLabel(value);
  const momentumArrow = getScoreMomentumArrow(value);

  // Scale font sizes based on component size
  const scoreFontSize =
    size >= 100 ? "text-2xl" : size >= 60 ? "text-lg" : "text-sm";
  const gradeFontSize =
    size >= 100 ? "text-[9px]" : size >= 60 ? "text-[8px]" : "text-[6px]";
  const labelFontSize =
    size >= 100 ? "text-[8px]" : size >= 60 ? "text-[7px]" : "text-[5px]";
  const gradePadding =
    size >= 100 ? "px-1.5 py-0.5" : size >= 60 ? "px-1 py-0.5" : "px-0.5 py-0";

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
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Score: ${Math.round(value)} out of ${maxValue}`}
      >
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

        {/* The Animated Score Ring - Gradient along the arc (red → yellow → green by score) */}
        <g
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          className="transition-all duration-700 ease-in-out"
          filter="url(#glow)"
        >
          {Array.from({ length: fullSegments }, (_, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={getScoreColor(((i + 0.5) / segmentCount) * 100, 100)}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={circumference - i * segmentLength}
            />
          ))}
          {partialLength > 0 && fullSegments < segmentCount && (
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={getScoreColor(value, maxValue)}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${partialLength} ${circumference - partialLength}`}
              strokeDashoffset={circumference - fullSegments * segmentLength}
            />
          )}
        </g>

        {/* Tick marks (not rotated, calculated clockwise from top) */}
        <line
          x1={tick33.x1}
          y1={tick33.y1}
          x2={tick33.x2}
          y2={tick33.y2}
          stroke="var(--color-gray-500, #6b7280)"
          strokeWidth={tickWidth}
          strokeLinecap="round"
          className="opacity-60"
        />
        <line
          x1={tick66.x1}
          y1={tick66.y1}
          x2={tick66.x2}
          y2={tick66.y2}
          stroke="var(--color-gray-500, #6b7280)"
          strokeWidth={tickWidth}
          strokeLinecap="round"
          className="opacity-60"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`${scoreFontSize} font-bold text-on-surface leading-none`}
        >
          {Math.round(value)}
        </span>
        {showGrade && (
          <span
            className={`mt-1 ${gradePadding} ${gradeFontSize} font-bold rounded ${gradeColors.bg} ${gradeColors.text}`}
          >
            {grade}
          </span>
        )}
        {showLabel && (
          <span
            className={`mt-0.5 ${labelFontSize} text-on-surface-variant uppercase tracking-wider`}
          >
            {label} <span aria-hidden="true">{momentumArrow}</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default ScoreDisplay;
