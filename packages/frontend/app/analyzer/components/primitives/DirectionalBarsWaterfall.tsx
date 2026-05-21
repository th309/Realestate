"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { piq } from "./piqTokens";
import {
  type BarItem,
  type BarValueFormat,
  type DirectionalColors,
  colorForBarType,
  computeWaterfallSegments,
  formatBarValue,
  useContainerWidth,
} from "./DirectionalBarsHelpers";
import { bottomRoundedPath, topRoundedPath } from "./CompsDistributionHelpers";
import { BarTooltip } from "./DirectionalBarsTooltip";

interface WaterfallProps {
  data: BarItem[];
  height: number;
  colors: DirectionalColors;
  format: BarValueFormat;
  showConnectors: boolean;
}

const PADDING = { top: 48, right: 12, bottom: 24, left: 12 };
const STAGGER_S = 0.08;
const ANIM_DUR_S = 0.8;
const EASE_CUBIC = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const BAR_RADIUS = 4;

export function DirectionalBarsWaterfall({
  data,
  height,
  colors,
  format,
  showConnectors,
}: WaterfallProps) {
  const [hover, setHover] = useState<number | null>(null);
  const { ref, width } = useContainerWidth();

  const { segments, yMin, yMax } = useMemo(
    () => computeWaterfallSegments(data),
    [data],
  );

  const innerWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const innerHeight = Math.max(0, height - PADDING.top - PADDING.bottom);

  const yScale = useMemo(
    () => scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]).nice(),
    [yMin, yMax, innerHeight],
  );

  const bandWidth = data.length > 0 ? innerWidth / data.length : 0;
  const barWidth = bandWidth * 0.72;
  const zeroY = yScale(0);

  const hoveredSeg = hover != null ? segments[hover] : null;

  return (
    <div ref={ref} style={{ width: "100%", height, position: "relative" }}>
      {width > 0 && (
        <svg width={width} height={height} style={{ display: "block" }}>
          <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
            {/* Zero line */}
            <line
              x1={0}
              x2={innerWidth}
              y1={zeroY}
              y2={zeroY}
              stroke="rgba(15, 23, 42, 0.1)"
              strokeWidth={1}
            />

            {/* Connectors between adjacent bars (skip before result bars) */}
            {showConnectors &&
              segments.map((seg, i) => {
                if (i === segments.length - 1) return null;
                const next = segments[i + 1];
                if (next.type === "result") return null;
                const x1 = i * bandWidth + (bandWidth + barWidth) / 2;
                const x2 = (i + 1) * bandWidth + (bandWidth - barWidth) / 2;
                const y = yScale(seg.yEnd);
                if (!Number.isFinite(y)) return null;
                return (
                  <line
                    key={`conn-${i}`}
                    x1={x1}
                    x2={x2}
                    y1={y}
                    y2={y}
                    stroke="rgba(15, 23, 42, 0.2)"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                  />
                );
              })}

            {/* Bars + labels — d binding tracks current data; CSS animation
                runs once on mount for the entrance, then re-renders snap. */}
            {segments.map((seg) => {
              const color = colorForBarType(seg.type, colors);
              const y1 = yScale(seg.yStart);
              const y2 = yScale(seg.yEnd);
              const barHeight = Math.abs(y1 - y2);
              const isGrowingUp = seg.yEnd > seg.yStart;
              const baselineY = y1;
              const visualTop = isGrowingUp ? baselineY - barHeight : baselineY;
              const x = seg.index * bandWidth + (bandWidth - barWidth) / 2;
              const isHovered = hover === seg.index;
              const beginS = (seg.index * STAGGER_S).toFixed(3);

              if (barHeight <= 0 || barWidth <= 0) return null;

              const expanded = isGrowingUp
                ? topRoundedPath(x, baselineY, barWidth, barHeight, BAR_RADIUS)
                : bottomRoundedPath(
                    x,
                    baselineY,
                    barWidth,
                    barHeight,
                    BAR_RADIUS,
                  );

              return (
                <g
                  key={`bar-${seg.index}`}
                  onMouseEnter={() => setHover(seg.index)}
                  onMouseLeave={() => setHover(null)}
                >
                  <path
                    d={expanded}
                    fill={color}
                    style={{
                      transformOrigin: `${x + barWidth / 2}px ${baselineY}px`,
                      transformBox: "view-box",
                      animation: `piq-bar-grow-y ${ANIM_DUR_S}s ${EASE_CUBIC} ${beginS}s backwards`,
                      transition: "d 200ms ease",
                    }}
                  />

                  <text
                    x={x + barWidth / 2}
                    y={visualTop - 24}
                    textAnchor="middle"
                    style={{
                      fontSize: "12px",
                      fill: piq.textMuted,
                      fontWeight: 500,
                    }}
                  >
                    {seg.item.label}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y={visualTop - 8}
                    textAnchor="middle"
                    style={{
                      fontSize: "14px",
                      fill: color,
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatBarValue(seg.item.value, format)}
                  </text>

                  {isHovered && (
                    <path
                      d={expanded}
                      fill={piq.textPrimary}
                      fillOpacity={0.04}
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {hoveredSeg && width > 0 && (
        <BarTooltip
          item={hoveredSeg.item}
          format={format}
          x={PADDING.left + hoveredSeg.index * bandWidth + bandWidth / 2}
          y={
            PADDING.top +
            Math.min(yScale(hoveredSeg.yStart), yScale(hoveredSeg.yEnd))
          }
          side="top"
        />
      )}
    </div>
  );
}
