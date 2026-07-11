"use client";

/**
 * SVG surface for the Market Momentum Map: state-outline basemap + one circle
 * per projectable metro, fill driven by the current frame's score. Dots have
 * stable keys/positions so per-frame renders only diff fill attributes; the
 * 150ms CSS fill transition does the tweening (disabled for reduced motion).
 */

import { useState } from "react";
import {
  getScoreLabel,
  getScoreMomentumArrow,
} from "@/app/components/scoring/score-labels";
import { scoreToColor } from "./momentum-map-colors";
import {
  MAP_VIEWBOX_HEIGHT,
  MAP_VIEWBOX_WIDTH,
  type ProjectedMetro,
} from "./momentum-map-projection";

interface MomentumMapCanvasProps {
  metros: ProjectedMetro[];
  statePaths: string[];
  scores: number[][];
  currentFrame: number;
  latestFrame: number;
  /** false under prefers-reduced-motion — colors snap instead of tweening */
  animate: boolean;
  hrefFor: (metro: ProjectedMetro) => string | null;
  onNavigate: (href: string) => void;
}

export function MomentumMapCanvas({
  metros,
  statePaths,
  scores,
  currentFrame,
  latestFrame,
  animate,
  hrefFor,
  onNavigate,
}: MomentumMapCanvasProps) {
  const [hovered, setHovered] = useState<ProjectedMetro | null>(null);
  const hoveredScore = hovered
    ? (scores[hovered.matrixIndex]?.[currentFrame] ?? 0)
    : 0;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Animated map of PropertyIQ momentum scores across US metros"
      >
        <g>
          {statePaths.map((d, i) => (
            <path
              key={i}
              d={d}
              className="fill-surface-container stroke-outline-variant"
              strokeWidth={0.75}
            />
          ))}
        </g>
        {/* Dots are decorative for AT users (935 tab stops would be hostile);
            the scrubber + summary strip carry the accessible story. */}
        <g aria-hidden="true">
          {metros.map((metro) => {
            const href = hrefFor(metro);
            return (
              <circle
                key={metro.id}
                cx={metro.x}
                cy={metro.y}
                r={metro.r}
                fill={scoreToColor(
                  scores[metro.matrixIndex]?.[currentFrame] ?? 0,
                )}
                fillOpacity={0.85}
                className="stroke-surface"
                strokeWidth={0.5}
                style={{
                  transition: animate ? "fill 150ms linear" : "none",
                  cursor: href ? "pointer" : "default",
                }}
                onMouseEnter={() => setHovered(metro)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (href) onNavigate(href);
                }}
              />
            );
          })}
        </g>
      </svg>
      {hovered && (
        <MetroTooltip
          metro={hovered}
          score={hoveredScore}
          showConfidence={currentFrame === latestFrame}
        />
      )}
    </div>
  );
}

function MetroTooltip({
  metro,
  score,
  showConfidence,
}: {
  metro: ProjectedMetro;
  score: number;
  showConfidence: boolean;
}) {
  return (
    <div
      data-testid="momentum-tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 shadow-md"
      style={{
        left: `${(metro.x / MAP_VIEWBOX_WIDTH) * 100}%`,
        top: `${(metro.y / MAP_VIEWBOX_HEIGHT) * 100}%`,
      }}
    >
      <p className="text-sm font-medium text-on-surface">{metro.name}</p>
      {score > 0 ? (
        <p className="font-mono text-sm text-on-surface">
          {score} · {getScoreLabel(score)} {getScoreMomentumArrow(score)}
        </p>
      ) : (
        <p className="text-sm text-on-surface-variant">No score this month</p>
      )}
      {showConfidence && metro.conf && (
        <p className="text-xs text-on-surface-variant">
          Confidence {metro.conf}
        </p>
      )}
    </div>
  );
}
