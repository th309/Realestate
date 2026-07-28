import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, scoreTierColor } from "../constants";
import {
  AnimatedEntrance,
  useScriptedProgress,
  useSpringProgress,
} from "../motion";
import {
  BORDER_WIDTH,
  CHART,
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
  brandFill,
  withAlpha,
} from "../styles/tokens";
import type { ScoreHistoryPoint } from "../types";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import { MeshBackground } from "../primitives/MeshBackground";

interface TrendChartProps {
  market: string;
  history: ScoreHistoryPoint[];
  currentScore: number;
}

/** Chart choreography (frames from scene start). */
const DRAW_DELAY = 16;
const SCRUB_START = 130;
const SCRUB_END = 225;

/**
 * Robinhood-style score trend: animated line draw-in with the endpoint
 * glow pulse, range pills, and a one-pass scripted scrub (the video
 * equivalent of hover-scrub) — same chart language as the web app.
 * No gridlines; the dashed 50 state-average baseline is the only guide.
 */
export const TrendChart: React.FC<TrendChartProps> = ({
  market,
  history,
  currentScore,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const validPoints = history.filter((p) => p.score !== null).slice(-12) as {
    date: string;
    score: number;
  }[];

  const drawProgress = useSpringProgress({
    delay: DRAW_DELAY,
    preset: "gentle",
  });
  const scrubT = useScriptedProgress(SCRUB_START, SCRUB_END, "standard");

  if (validPoints.length < 2) return null;

  const n = validPoints.length;
  const chartW = isVertical ? width - 192 : width - 560;
  const chartH = isVertical ? 560 : 440;
  const minScore = Math.min(...validPoints.map((p) => p.score)) - 5;
  const maxScore = Math.max(...validPoints.map((p) => p.score)) + 5;
  const X = (i: number) => (i / (n - 1)) * chartW;
  const Y = (s: number) =>
    chartH - ((s - minScore) / (maxScore - minScore)) * chartH;

  const tier = scoreTierColor(currentScore);
  const first = validPoints[0].score;
  const last = validPoints[n - 1].score;
  const delta = last - first;
  const deltaColor = delta >= 0 ? PALETTE.positive : PALETTE.negative;

  // Partial polyline up to the draw head (tip position is exact, so the
  // endpoint dot rides the line instead of approximating a dash offset).
  const headIdx = drawProgress * (n - 1);
  const whole = Math.floor(headIdx);
  const fracIdx = headIdx - whole;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= Math.min(whole, n - 1); i++) {
    pts.push([X(i), Y(validPoints[i].score)]);
  }
  if (whole < n - 1) {
    const s =
      validPoints[whole].score +
      (validPoints[whole + 1].score - validPoints[whole].score) * fracIdx;
    pts.push([X(whole + fracIdx), Y(s)]);
  }
  const tip = pts[pts.length - 1];
  const linePath = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
  const areaPath = `${linePath} L${tip[0]},${chartH} L${pts[0][0]},${chartH} Z`;

  const settled = Math.min(1, Math.max(0, (drawProgress - 0.94) / 0.06));
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.18);

  // Scripted scrub — one pass, hover-scrub equivalent.
  const scrubActive = scrubT > 0 && scrubT < 1;
  const scrubOpacity = scrubActive
    ? interpolate(scrubT, [0, 0.06, 0.94, 1], [0, 1, 1, 0])
    : 0;
  const scrubIdx = scrubT * (n - 1);
  const si = Math.min(n - 2, Math.floor(scrubIdx));
  const sf = scrubIdx - si;
  const scrubScore =
    validPoints[si].score +
    (validPoints[si + 1].score - validPoints[si].score) * sf;
  const scrubX = X(scrubIdx);
  const scrubY = Y(scrubScore);
  const scrubMonth = new Date(
    validPoints[Math.round(scrubIdx)].date,
  ).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

  const titleSize = isVertical ? 46 : 34;
  const eyebrowSize = isVertical ? 22 : 16;
  const pillSize = isVertical ? 24 : 18;
  const sideMargin = isVertical ? 96 : 280;
  const y50 = Y(50);

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: FONTS.body,
        gap: isVertical ? 44 : 32,
        position: "relative",
        overflow: "hidden",
        padding: `0 ${sideMargin}px`,
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.55 }}>
        <MeshBackground />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header row: title left, range pills right */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: isVertical ? 44 : 32,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AnimatedEntrance index={0} from="left" distance={32}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: BORDER_WIDTH,
                    background: COLORS.accent,
                  }}
                />
                <span
                  style={{
                    fontSize: eyebrowSize,
                    fontWeight: 600,
                    color: COLORS.accent,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                  }}
                >
                  Score Trend
                </span>
              </div>
            </AnimatedEntrance>
            <AnimatedEntrance index={1} from="rise" distance={24}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: titleSize,
                    fontWeight: 700,
                    color: COLORS.text,
                    letterSpacing: "-1px",
                  }}
                >
                  {market}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: titleSize * 0.62,
                    fontWeight: 700,
                    color: deltaColor,
                    ...NUMERIC,
                  }}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta} pts
                </span>
              </div>
            </AnimatedEntrance>
          </div>
          <AnimatedEntrance index={2} from="right" distance={24}>
            <div style={{ display: "flex", gap: 10 }}>
              {["3M", "6M", "12M"].map((r) => {
                const active = r === "12M";
                return (
                  <div
                    key={r}
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: pillSize,
                      fontWeight: 600,
                      color: active ? PALETTE.indigoLight : COLORS.textDim,
                      background: active ? brandFill(PALETTE.indigo) : "none",
                      border: active
                        ? brandBorder(PALETTE.indigoMedium, 0.7)
                        : brandBorder(PALETTE.indigoMedium, 0.2),
                      borderRadius: 999,
                      padding: "8px 22px",
                    }}
                  >
                    {r}
                  </div>
                );
              })}
            </div>
          </AnimatedEntrance>
        </div>

        {/* Chart */}
        <AnimatedEntrance index={3} from="rise" preset="gentle" distance={18}>
          <svg
            width={chartW}
            height={chartH + 40}
            style={{ overflow: "visible", display: "block" }}
          >
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={withAlpha(tier, 0.22)} />
                <stop offset="100%" stopColor={withAlpha(tier, 0)} />
              </linearGradient>
            </defs>

            {/* 50 = state-average baseline (the only guide line) */}
            {minScore < 50 && maxScore > 50 && (
              <>
                <line
                  x1={0}
                  y1={y50}
                  x2={chartW}
                  y2={y50}
                  stroke={COLORS.textDim}
                  strokeWidth={1}
                  strokeDasharray="6 8"
                />
                <text
                  x={chartW}
                  y={y50 - 10}
                  textAnchor="end"
                  fontFamily={FONTS.mono}
                  fontSize={pillSize * 0.85}
                  fill={COLORS.textDim}
                >
                  50 · state avg
                </text>
              </>
            )}

            <path d={areaPath} fill="url(#trend-fill)" />
            <path
              d={linePath}
              fill="none"
              stroke={tier}
              strokeWidth={CHART.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter: `drop-shadow(0 0 10px ${withAlpha(tier, 0.45)})`,
              }}
            />

            {/* Draw head → settled endpoint pulse */}
            <circle
              cx={tip[0]}
              cy={tip[1]}
              r={CHART.endpointRadius * (1.7 + 0.6 * pulse)}
              fill={withAlpha(tier, settled * (0.18 + 0.14 * pulse))}
            />
            <circle
              cx={tip[0]}
              cy={tip[1]}
              r={CHART.endpointRadius}
              fill={tier}
            />

            {/* Scripted scrub pass */}
            {scrubOpacity > 0 && (
              <g opacity={scrubOpacity}>
                <line
                  x1={scrubX}
                  y1={0}
                  x2={scrubX}
                  y2={chartH}
                  stroke={withAlpha(PALETTE.indigoLight, 0.4)}
                  strokeWidth={1}
                />
                <circle
                  cx={scrubX}
                  cy={scrubY}
                  r={CHART.endpointRadius + 2}
                  fill={PALETTE.stage}
                  stroke={tier}
                  strokeWidth={3}
                />
                <text
                  x={scrubX}
                  y={scrubY - 28}
                  textAnchor="middle"
                  fontFamily={FONTS.mono}
                  fontWeight={700}
                  fontSize={isVertical ? 34 : 26}
                  fill={COLORS.text}
                  style={NUMERIC}
                >
                  {Math.round(scrubScore)}
                </text>
                <text
                  x={scrubX}
                  y={chartH + 34}
                  textAnchor="middle"
                  fontFamily={FONTS.mono}
                  fontSize={pillSize * 0.9}
                  fill={COLORS.textMuted}
                >
                  {scrubMonth}
                </text>
              </g>
            )}
          </svg>
        </AnimatedEntrance>

        {/* First/last month labels — ends only, no axis clutter */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 10,
            fontFamily: FONTS.mono,
            fontSize: pillSize * 0.9,
            color: COLORS.textDim,
          }}
        >
          <span>
            {new Date(validPoints[0].date).toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            })}
          </span>
          <span style={{ color: COLORS.textMuted, fontWeight: 600 }}>
            {new Date(validPoints[n - 1].date).toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
};
