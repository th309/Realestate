"use client";
import React, { useMemo, useRef } from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import { formatExplorerValue } from "../lib/explorer-math";
import { useTickInterpolation } from "../lib/useTickInterpolation";
import type { ExplorerFormat } from "../lib/explorer-config";
import type { GeoBoundaries, BoundaryFeature } from "../lib/useGeoBoundaries";

export interface GeoTileMapProps {
  boundaries: GeoBoundaries;
  /** 0-100 color scalar for the CURRENTLY selected metric (see
   * `metricColorScalars`) — not the PropertyIQ Score. */
  colorByRegion: Record<string, number | null>;
  valueByRegion: Record<string, number | null>;
  /** Next month's color scalars — when present AND `playing`, drives a
   * requestAnimationFrame loop that writes interpolated `fill` DIRECTLY onto
   * each tile's DOM node every frame, bypassing React state/re-render
   * entirely (see `useTickInterpolation`, and BubbleChart's matching `next`
   * prop for the full rationale: CSS transitions don't animate `fill` for
   * these SVG elements at all, and driving frames through React `setState`
   * forced a full reconciliation of hundreds of tiles per tick whose cost
   * made frame pacing irregular). Omit for the plain, non-animated
   * single-month render. */
  nextColorByRegion?: Record<string, number | null>;
  format: ExplorerFormat;
  selectedId: string | null;
  playing: boolean;
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

function pathExtent(d: string): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
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
  return { minX, minY, maxX, maxY };
}

/** Rough label footprint at fontSize 11 in a MONOSPACE font (uniform char
 * width, so this holds regardless of the actual formatted text) — used only
 * to decide which tiles' labels would collide with each other, not to size
 * anything on screen. */
const LABEL_EST_WIDTH = 58;
const LABEL_EST_HEIGHT = 14;

export function GeoTileMap(props: GeoTileMapProps) {
  const {
    boundaries,
    colorByRegion,
    valueByRegion,
    nextColorByRegion,
    format,
    selectedId,
    playing,
    onSelect,
    onDrill,
  } = props;

  const pathRefs = useRef(new Map<string, SVGPathElement>());

  // Geometry only depends on the path shape itself, which is static per
  // scope — computing it fresh on every render (previously inline in the
  // JSX map below) reran a regex parse over every feature's `d` string on
  // every animation frame. Memoized here, keyed on the feature list itself.
  //
  // Label position: the BOUNDING-BOX center, not an average of every path
  // vertex (the old approach) — vertex-averaging skews toward whichever
  // edge of a shape has the most path points (e.g. a state's long, detailed
  // coastline), which is why labels were landing visibly off-center (e.g.
  // California's near its northern border, not its middle).
  //
  // Label visibility: bigger tiles get placement priority; a candidate is
  // dropped if its estimated label footprint would overlap an
  // already-placed one. This runs ONCE per scope on geometry alone
  // (independent of the currently selected metric's value) so labels don't
  // flicker in/out as the user scrubs the timeline or switches metrics —
  // only WHICH tiles are ever allowed to try for a label is decided here;
  // the per-frame render below still gates on the value actually being
  // non-null for the current month.
  const geometry = useMemo(() => {
    const candidates = boundaries.features.map((feature) => {
      const { minX, minY, maxX, maxY } = pathExtent(feature.path);
      return {
        id: feature.id,
        w: maxX - minX,
        h: maxY - minY,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
      };
    });

    const placed: { cx: number; cy: number }[] = [];
    const map = new Map<
      string,
      { cx: number; cy: number; canLabel: boolean }
    >();
    for (const c of [...candidates].sort((a, b) => b.w * b.h - a.w * a.h)) {
      const bigEnough = c.w >= MIN_LABEL_SIZE && c.h >= MIN_LABEL_SIZE;
      const collides = placed.some(
        (p) =>
          Math.abs(p.cx - c.cx) < LABEL_EST_WIDTH &&
          Math.abs(p.cy - c.cy) < LABEL_EST_HEIGHT,
      );
      const canLabel = bigEnough && !collides;
      if (canLabel) placed.push({ cx: c.cx, cy: c.cy });
      map.set(c.id, { cx: c.cx, cy: c.cy, canLabel });
    }
    return map;
  }, [boundaries.features]);

  function applyFrame(t: number) {
    for (const feature of boundaries.features) {
      const path = pathRefs.current.get(feature.id);
      if (!path) continue;
      const c0 = colorByRegion[feature.id] ?? 50;
      const c1 = nextColorByRegion?.[feature.id] ?? c0;
      path.setAttribute("fill", getScoreColor(c0 + (c1 - c0) * t, 100));
    }
  }

  useTickInterpolation(
    playing && nextColorByRegion != null,
    nextColorByRegion,
    applyFrame,
  );

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
        const { cx, cy, canLabel } = geometry.get(feature.id) ?? {
          cx: 0,
          cy: 0,
          canLabel: false,
        };

        return (
          <g key={feature.id}>
            <path
              ref={(el) => {
                if (el) pathRefs.current.set(feature.id, el);
                else pathRefs.current.delete(feature.id);
              }}
              data-region-id={feature.id}
              d={feature.path}
              fill={color}
              fillOpacity={sel ? 0.95 : 0.78}
              stroke={sel ? "var(--md-on-surface)" : "rgba(255,255,255,0.5)"}
              strokeWidth={sel ? 2 : 0.6}
              style={{
                cursor: "pointer",
                transition: playing ? "none" : "fill 300ms ease",
              }}
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
                dominantBaseline="middle"
                fontSize={11}
                fontFamily="var(--font-roboto-mono)"
                fontWeight={600}
                fill="#fff"
                stroke="rgba(0,0,0,0.55)"
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
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
