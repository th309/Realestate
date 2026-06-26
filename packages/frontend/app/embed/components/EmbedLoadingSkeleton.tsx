import React from "react";

export interface EmbedLoadingSkeletonProps {
  branding?: { accent_color: string } | null;
}

/**
 * EmbedLoadingSkeleton — Animated pulse skeleton shown while branding loads.
 *
 * Displays a placeholder branding bar (if accent color is available) and
 * pulsing content placeholders sized for the embed viewport.
 */
export function EmbedLoadingSkeleton({ branding }: EmbedLoadingSkeletonProps) {
  return (
    <div className="flex flex-col w-full animate-pulse">
      {/* Placeholder branding bar */}
      {branding?.accent_color ? (
        <div
          style={{ backgroundColor: branding.accent_color, opacity: 0.6 }}
          className="h-10 w-full"
        />
      ) : (
        <div className="h-10 w-full bg-surface-container rounded-sm" />
      )}

      {/* Content skeleton */}
      <div className="flex flex-col items-center gap-3 p-6">
        {/* Circle placeholder (score ring area) */}
        <div className="w-32 h-32 rounded-full bg-surface-container" />

        {/* Text lines */}
        <div className="h-4 w-24 rounded bg-surface-container" />
        <div className="h-3 w-36 rounded bg-surface-container" />
        <div className="h-3 w-20 rounded bg-surface-container" />
      </div>
    </div>
  );
}
