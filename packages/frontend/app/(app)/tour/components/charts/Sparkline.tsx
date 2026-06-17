"use client";

import { useId } from "react";

interface Props {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Line/area color — any CSS color (defaults to the M3 primary). */
  stroke?: string;
  filled?: boolean;
  strokeWidth?: number;
}

/**
 * Tiny inline trend line. Pure SVG, normalized to its own min/max so even a
 * shallow trend reads clearly. Renders nothing for <2 points (caller drops it).
 */
export function Sparkline({
  values,
  width = 100,
  height = 30,
  className,
  stroke = "var(--md-primary)",
  filled = true,
  strokeWidth = 1.75,
}: Props) {
  const rawId = useId();
  const gradId = `spark-${rawId.replace(/:/g, "")}`;

  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;
  const pad = strokeWidth;
  const innerH = height - pad * 2;
  const toX = (i: number) => (i / (n - 1)) * width;
  const toY = (v: number) => pad + innerH - ((v - min) / range) * innerH;

  const line = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {filled && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradId})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
