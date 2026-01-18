'use client';

import { useInView } from './hooks/useInView';

interface ScoreRingProps {
  score: number;
  label: string;
  delay?: number;
}

/**
 * Calculate color on a red-to-green gradient based on score (0-100)
 * Uses HSL for smooth interpolation:
 * - 0 = Red (hue 0)
 * - 50 = Yellow (hue 60)
 * - 100 = Green (hue 120)
 */
function getScoreColor(score: number): string {
  // Clamp score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Map score to hue: 0 -> 0 (red), 100 -> 120 (green)
  const hue = (clampedScore / 100) * 120;

  // Use consistent saturation and lightness for vibrant, readable colors
  const saturation = 70;
  const lightness = 45;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get the text color for the score number (darker version of the ring color)
 */
function getScoreTextColor(score: number): string {
  const clampedScore = Math.max(0, Math.min(100, score));
  const hue = (clampedScore / 100) * 120;
  return `hsl(${hue}, 70%, 35%)`;
}

export function ScoreRing({ score, label, delay = 0 }: ScoreRingProps) {
  const [setRef, inView] = useInView();
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  const strokeColor = getScoreColor(score);
  const textColor = getScoreTextColor(score);

  return (
    <div
      ref={setRef}
      className="flex flex-col items-center gap-2 transition-all duration-500"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(20px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${label}: ${score} out of 100`}>
        {/* Background track */}
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          className="stroke-outline-variant"
          strokeWidth="5"
        />
        {/* Colored progress arc */}
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          stroke={strokeColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={inView ? offset : circumference}
          transform="rotate(-90 44 44)"
          className="transition-all duration-[1500ms]"
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
        {/* Score number */}
        <text
          x="44"
          y="44"
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xl font-semibold"
          style={{ fill: textColor }}
        >
          {score}
        </text>
      </svg>
      <span className="text-xs text-on-surface-variant font-medium">{label}</span>
    </div>
  );
}
