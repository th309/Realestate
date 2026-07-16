"use client";
import React from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import { formatExplorerValue } from "../lib/explorer-math";
import type { ExplorerFormat } from "../lib/explorer-config";
import type { GeoBoundaries, BoundaryFeature } from "../lib/useGeoBoundaries";

export interface GeoTileMapProps {
  boundaries: GeoBoundaries;
  /** 0-100 color scalar for the CURRENTLY selected metric (see
   * `metricColorScalars`) — not the PropertyIQ Score. */
  colorByRegion: Record<string, number | null>;
  valueByRegion: Record<string, number | null>;
  format: ExplorerFormat;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDrill: (id: string) => void;
}

/**
 * A path's rendered pixel extent below this threshold can't legibly hold a
 * formatted number (validated against the brainstorm mockups of a
 * 254-county state, where sub-14px shapes clipped text badly; the smallest
 * legible labeled tiles there were ~32px).
 */
const MIN_LABEL_SIZE = 14;

/**
 * Fixed on-screen frame height for every scope. `useGeoBoundaries` fits each
 * scope's bbox to `SIZE` (900) along its OWN longer axis, so a portrait-shaped
 * metro/county (height is the longer axis) produces a viewBox many times
 * taller, relative to its width, than a landscape one like the national map.
 * Without a fixed height, `width="100%"` + no `height` lets the SVG's
 * intrinsic aspect ratio dictate its rendered height, so the map ballooned to
 * 3x the normal height for portrait scopes. `preserveAspectRatio="xMidYMid
 * meet"` (the default) letterboxes/pillarboxes content within this fixed
 * frame instead, keeping the map the same size at every scope.
 */
const MAP_FRAME_HEIGHT = 580;

function pathExtent(d: string): { w: number; h: number } {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i],
      y = nums[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { w: maxX - minX, h: maxY - minY };
}

function centroid(d: string): [number, number] {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  let sx = 0,
    sy = 0,
    n = 0;
  for (let i = 0; i < nums.length; i += 2) {
    sx += nums[i];
    sy += nums[i + 1];
    n++;
  }
  return n ? [sx / n, sy / n] : [0, 0];
}

export function GeoTileMap(props: GeoTileMapProps) {
  const {
    boundaries,
    colorByRegion,
    valueByRegion,
    format,
    selectedId,
    onSelect,
    onDrill,
  } = props;

  if (boundaries.isLoading) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--md-on-surface-variant)",
        }}
      >
        Loading map…
      </div>
    );
  }
  if (boundaries.error) {
    return (
      <div
        style={{ padding: 40, textAlign: "center", color: "var(--md-error)" }}
      >
        Couldn&apos;t load the map for this scope.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${boundaries.viewBoxWidth} ${boundaries.viewBoxHeight}`}
      width="100%"
      height={MAP_FRAME_HEIGHT}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {boundaries.parentOutline && (
        <path
          d={boundaries.parentOutline}
          fill="var(--md-surface-container-high)"
        />
      )}
      {boundaries.features.map((feature: BoundaryFeature) => {
        // Missing color scalar is a COLOR fallback only, never a visibility
        // gate — this is the fix for the StateTileMap bug: a region's real
        // value for the selected metric must always render if present,
        // regardless of whether its color scalar could be computed (e.g. no
        // other regions in view to derive dynamic bounds from). Mirrors
        // BubbleChart's `colorByRegion[id] ?? 50`.
        const colorScalar = colorByRegion[feature.id] ?? 50;
        const value = valueByRegion[feature.id];
        const color = getScoreColor(colorScalar, 100);
        const sel = feature.id === selectedId;
        const { w, h } = pathExtent(feature.path);
        const canLabel = w >= MIN_LABEL_SIZE && h >= MIN_LABEL_SIZE;
        const [cx, cy] = canLabel ? centroid(feature.path) : [0, 0];

        return (
          <g key={feature.id}>
            <path
              data-region-id={feature.id}
              d={feature.path}
              fill={color}
              fillOpacity={sel ? 0.95 : 0.78}
              stroke={sel ? "var(--md-on-surface)" : "rgba(255,255,255,0.5)"}
              strokeWidth={sel ? 2 : 0.6}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(feature.id)}
              onDoubleClick={() => onDrill(feature.id)}
            >
              <title>
                {value != null
                  ? `${feature.id} — ${formatExplorerValue(value, format)}`
                  : feature.id}
              </title>
            </path>
            {canLabel && value != null && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                fontSize={11}
                fontFamily="var(--font-roboto-mono)"
                fill="#fff"
                pointerEvents="none"
              >
                {formatExplorerValue(value, format)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
