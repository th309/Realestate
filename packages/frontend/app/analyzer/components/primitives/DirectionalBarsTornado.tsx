"use client";

import { useMemo, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { piq } from "./piqTokens";
import {
  type BarItem,
  type BarValueFormat,
  type DirectionalColors,
  formatBarValue,
  useContainerWidth,
} from "./DirectionalBarsHelpers";
import { BarTooltip } from "./DirectionalBarsTooltip";

interface TornadoProps {
  data: BarItem[];
  height: number;
  colors: DirectionalColors;
  format: BarValueFormat;
}

const PADDING = { top: 16, right: 56, bottom: 16, left: 140 };
const STAGGER_S = 0.06;
const ANIM_DUR_S = 0.6;
const EASE_CUBIC = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const LABEL_INSIDE_MIN_PX = 64;

/**
 * Tornado layout: each row has two mirror bars from a center axis. Bar
 * dimensions bind directly to current data (no SMIL freeze), so input changes
 * update bars immediately. Entrance animation via CSS keyframe — fires once on
 * mount, doesn't re-trigger on data changes.
 */
export function DirectionalBarsTornado({
  data,
  height,
  colors,
  format,
}: TornadoProps) {
  const [hoverSide, setHoverSide] = useState<{
    index: number;
    side: "left" | "right";
  } | null>(null);
  const { ref, width } = useContainerWidth();

  const innerWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const innerHeight = Math.max(0, height - PADDING.top - PADDING.bottom);

  const maxAbs = useMemo(() => {
    const m = Math.max(...data.map((d) => Math.abs(d.value)));
    return m === 0 ? 1 : m;
  }, [data]);

  const xScale = useMemo(
    () => scaleLinear().domain([-maxAbs, maxAbs]).range([0, innerWidth]).nice(),
    [maxAbs, innerWidth],
  );
  const yScale = useMemo(
    () =>
      scaleBand<number>()
        .domain(data.map((_, i) => i))
        .range([0, innerHeight])
        .padding(0.32),
    [data, innerHeight],
  );

  const centerX = xScale(0);
  const rowHeight = yScale.bandwidth();

  const hovered =
    hoverSide && data[hoverSide.index]
      ? { item: data[hoverSide.index], ...hoverSide }
      : null;

  return (
    <div ref={ref} style={{ width: "100%", height, position: "relative" }}>
      {width > 0 && (
        <svg width={width} height={height} style={{ display: "block" }}>
          <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
            {/* Center axis */}
            <line
              x1={centerX}
              x2={centerX}
              y1={0}
              y2={innerHeight}
              stroke="rgba(15, 23, 42, 0.2)"
              strokeWidth={1}
            />

            {data.map((item, i) => {
              const rowY = yScale(i) ?? 0;
              const magnitude = Math.abs(item.value);
              const barWidth = xScale(magnitude) - centerX;
              const beginS = (i * STAGGER_S).toFixed(3);
              const labelInside = barWidth >= LABEL_INSIDE_MIN_PX;
              const leftLabelX = labelInside
                ? centerX - barWidth + 8
                : centerX - barWidth - 6;
              const leftLabelAnchor = labelInside ? "start" : "end";
              const leftLabelFill = labelInside ? "#FFFFFF" : colors.negative;
              const rightLabelX = labelInside
                ? centerX + barWidth - 8
                : centerX + barWidth + 6;
              const rightLabelAnchor = labelInside ? "end" : "start";
              const rightLabelFill = labelInside ? "#FFFFFF" : colors.positive;

              return (
                <g key={`row-${i}`}>
                  <text
                    x={-8}
                    y={rowY + rowHeight / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{
                      fontSize: "12px",
                      fill: piq.textMuted,
                      fontWeight: 500,
                    }}
                  >
                    {item.label}
                  </text>

                  {/* Left bar (negative direction) */}
                  <g
                    onMouseEnter={() =>
                      setHoverSide({ index: i, side: "left" })
                    }
                    onMouseLeave={() => setHoverSide(null)}
                  >
                    <rect
                      x={centerX - barWidth}
                      y={rowY}
                      width={barWidth}
                      height={rowHeight}
                      fill={colors.negative}
                      rx={4}
                      ry={4}
                      opacity={
                        hoverSide?.index === i && hoverSide?.side === "left"
                          ? 0.92
                          : 1
                      }
                      style={{
                        transformOrigin: `${centerX}px ${rowY + rowHeight / 2}px`,
                        transformBox: "view-box",
                        animation: `piq-bar-grow-x ${ANIM_DUR_S}s ${EASE_CUBIC} ${beginS}s backwards`,
                        transition: "width 200ms ease, x 200ms ease",
                      }}
                    />
                    <text
                      x={leftLabelX}
                      y={rowY + rowHeight / 2}
                      textAnchor={leftLabelAnchor}
                      dominantBaseline="middle"
                      style={{
                        fontSize: "12px",
                        fill: leftLabelFill,
                        fontWeight: labelInside ? 600 : 500,
                        fontVariantNumeric: "tabular-nums",
                        pointerEvents: "none",
                      }}
                    >
                      {formatBarValue(-magnitude, format)}
                    </text>
                  </g>

                  {/* Right bar (positive direction) */}
                  <g
                    onMouseEnter={() =>
                      setHoverSide({ index: i, side: "right" })
                    }
                    onMouseLeave={() => setHoverSide(null)}
                  >
                    <rect
                      x={centerX}
                      y={rowY}
                      width={barWidth}
                      height={rowHeight}
                      fill={colors.positive}
                      rx={4}
                      ry={4}
                      opacity={
                        hoverSide?.index === i && hoverSide?.side === "right"
                          ? 0.92
                          : 1
                      }
                      style={{
                        transformOrigin: `${centerX}px ${rowY + rowHeight / 2}px`,
                        transformBox: "view-box",
                        animation: `piq-bar-grow-x ${ANIM_DUR_S}s ${EASE_CUBIC} ${beginS}s backwards`,
                        transition: "width 200ms ease",
                      }}
                    />
                    <text
                      x={rightLabelX}
                      y={rowY + rowHeight / 2}
                      textAnchor={rightLabelAnchor}
                      dominantBaseline="middle"
                      style={{
                        fontSize: "12px",
                        fill: rightLabelFill,
                        fontWeight: labelInside ? 600 : 500,
                        fontVariantNumeric: "tabular-nums",
                        pointerEvents: "none",
                      }}
                    >
                      {formatBarValue(magnitude, format)}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {hovered && (
        <BarTooltip
          item={{
            ...hovered.item,
            value:
              hovered.side === "left"
                ? -Math.abs(hovered.item.value)
                : Math.abs(hovered.item.value),
          }}
          format={format}
          x={
            PADDING.left +
            (hovered.side === "right"
              ? centerX + (xScale(Math.abs(hovered.item.value)) - centerX)
              : centerX - (xScale(Math.abs(hovered.item.value)) - centerX))
          }
          y={PADDING.top + (yScale(hovered.index) ?? 0) + rowHeight / 2}
          side={hovered.side === "right" ? "right" : "left"}
        />
      )}
    </div>
  );
}
