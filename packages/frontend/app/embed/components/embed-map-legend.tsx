import React from "react";

export interface EmbedMapLegendProps {
  /** Array of hex color strings from low to high */
  colors: string[];
  /** Minimum value in the scale */
  minValue: number;
  /** Maximum value in the scale */
  maxValue: number;
  /** Metric ID for labeling (optional) */
  metric?: string;
}

/**
 * EmbedMapLegend — Color gradient legend bar for the embed mini-map.
 *
 * Renders a horizontal gradient bar with min/max labels, positioned
 * at the bottom of the map container.
 */
export function EmbedMapLegend({
  colors,
  minValue,
  maxValue,
  metric,
}: EmbedMapLegendProps) {
  const gradient = `linear-gradient(to right, ${colors.join(", ")})`;

  return (
    <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1 px-3 py-2 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm">
      {metric && (
        <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wide truncate">
          {metric.replace(/_/g, " ")}
        </span>
      )}
      <div
        className="h-2 w-full rounded-full"
        style={{ background: gradient }}
      />
      <div className="flex justify-between">
        <span className="text-[10px] text-gray-500">
          {formatLegendValue(minValue)}
        </span>
        <span className="text-[10px] text-gray-500">
          {formatLegendValue(maxValue)}
        </span>
      </div>
    </div>
  );
}

/**
 * Format a numeric value for legend display.
 * Abbreviates large numbers (1M, 100K, etc.).
 */
function formatLegendValue(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toFixed(1);
}
