"use client";

import React from "react";
import {
  getScoreColor,
  getScoreLabel,
} from "@/app/components/scoring/ScoreDisplay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbedScoreRingProps {
  /** Score value (0-100) */
  score: number;
  /** Score type key (e.g. "homeready", "investoredge") */
  scoreType: string;
  /** Display name for the geography (e.g. "Dallas-Fort Worth, TX") */
  geoName: string;
  /** Optional confidence data */
  confidence?: {
    level: string;
    percentage: number;
  };
}

/** Human-readable labels for each score type */
const SCORE_TYPE_LABELS: Record<string, string> = {
  propertyiq: "PropertyIQ Score",
  homeready: "PropertyIQ Score",
  investoredge: "PropertyIQ Score",
  markethealth: "PropertyIQ Score",
};

/** Confidence level color mapping */
const CONFIDENCE_BADGE_COLORS: Record<string, string> = {
  a: "bg-emerald-500",
  b: "bg-amber-500",
  c: "bg-rose-400",
  f: "bg-red-500",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EmbedScoreRing — Compact score ring widget for embed contexts.
 *
 * Renders a ~280x280px content area with:
 * 1. SVG ring (~160px diameter) colored by score, number centered
 * 2. Score label (EXCELLENT, GOOD, etc.)
 * 3. Score type name
 * 4. Geography name
 * 5. Optional confidence badge
 */
export function EmbedScoreRing({
  score,
  scoreType,
  geoName,
  confidence,
}: EmbedScoreRingProps) {
  const clampedScore = Math.min(Math.max(Math.round(score), 0), 100);
  const label = getScoreLabel(clampedScore);
  const scoreColor = getScoreColor(clampedScore);
  const typeLabel = SCORE_TYPE_LABELS[scoreType] || scoreType;

  // SVG ring geometry
  const size = 160;
  const strokeWidth = 8;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = clampedScore / 100;
  const dashLength = circumference * progress;
  const gapLength = circumference - dashLength;

  return (
    <div
      className="flex flex-col items-center gap-2 p-4"
      style={{ maxWidth: 280 }}
    >
      {/* Score Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Score: ${clampedScore} out of 100 — ${label}`}
        >
          {/* Background ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--color-gray-200, #e5e7eb)"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dashLength} ${gapLength}`}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
            className="transition-all duration-700 ease-in-out"
          />
        </svg>

        {/* Score number overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-on-surface leading-none">
            {clampedScore}
          </span>
        </div>
      </div>

      {/* Score label */}
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: scoreColor }}
      >
        {label}
      </span>

      {/* Score type */}
      <span className="text-sm font-medium text-on-surface">{typeLabel}</span>

      {/* Geography name */}
      <span
        className="text-xs text-on-surface-variant text-center leading-snug truncate w-full"
        title={geoName}
      >
        {geoName}
      </span>

      {/* Confidence badge (optional) */}
      {confidence && (
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold text-white rounded
              ${CONFIDENCE_BADGE_COLORS[confidence.level?.toLowerCase()] || "bg-gray-400"}`}
            title={`Confidence: ${confidence.level?.toUpperCase()} (${confidence.percentage}%)`}
          >
            {confidence.level?.toUpperCase()}
          </span>
          <span className="text-[10px] text-on-surface-variant">
            confidence
          </span>
        </div>
      )}
    </div>
  );
}
