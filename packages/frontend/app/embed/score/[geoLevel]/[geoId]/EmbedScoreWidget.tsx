"use client";

import React from "react";
import { ScoreDisplay } from "@/app/components/scoring/ScoreDisplay";

/** Human-readable labels for each score type */
const SCORE_TYPE_LABELS: Record<string, string> = {
  propertyiq: "PropertyIQ",
  homeready: "PropertyIQ",
  investoredge: "PropertyIQ",
  markethealth: "PropertyIQ",
};

/** Confidence level color mapping */
const CONFIDENCE_COLORS: Record<string, string> = {
  a: "bg-emerald-500",
  b: "bg-amber-500",
  c: "bg-rose-400",
  f: "bg-red-500",
};

interface EmbedScoreWidgetProps {
  locationName: string;
  score: number;
  grade: string;
  confidenceLevel: string;
  scoreType: string;
  isDark: boolean;
}

/**
 * EmbedScoreWidget — Client component for the embeddable score display.
 *
 * Renders a compact card with:
 * - Market/location name
 * - Score ring (ScoreDisplay)
 * - Score type label
 * - Confidence badge
 * - "Powered by PropertyIQ" attribution link
 */
export function EmbedScoreWidget({
  locationName,
  score,
  grade,
  confidenceLevel,
  scoreType,
  isDark,
}: EmbedScoreWidgetProps) {
  const scoreTypeLabel = SCORE_TYPE_LABELS[scoreType] || scoreType;
  const confidenceColor =
    CONFIDENCE_COLORS[confidenceLevel?.toLowerCase()] || "bg-gray-400";

  const containerClasses = isDark
    ? "bg-gray-900 text-white border-gray-700"
    : "bg-white text-gray-900 border-gray-200";

  const linkClasses = isDark
    ? "text-indigo-400 hover:text-indigo-300"
    : "text-indigo-600 hover:text-indigo-500";

  return (
    <div
      className={`inline-flex flex-col items-center gap-3 p-5 rounded-xl border ${containerClasses}`}
      style={{ minWidth: 200, maxWidth: 280 }}
    >
      {/* Location Name */}
      <p
        className="text-sm font-medium text-center leading-tight truncate w-full"
        title={locationName}
      >
        {locationName}
      </p>

      {/* Score Ring */}
      <ScoreDisplay
        value={score}
        size={120}
        strokeWidth={8}
        showGrade={false}
      />

      {/* Score Type + Confidence */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide">
          {scoreTypeLabel}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold text-white rounded ${confidenceColor}`}
          title={`Confidence: ${confidenceLevel?.toUpperCase()}`}
        >
          {confidenceLevel?.toUpperCase()}
        </span>
      </div>

      {/* Powered by PropertyIQ */}
      <a
        href="https://www.propertyiq.app"
        target="_blank"
        rel="noopener noreferrer"
        className={`text-[10px] font-medium tracking-wide ${linkClasses} transition-colors`}
      >
        Powered by PropertyIQ
      </a>
    </div>
  );
}
