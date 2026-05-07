import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { COLORS, scoreTierColor } from "../constants";
import { LONG_FORM_VISUAL_RHYTHM_FRAMES } from "../constants/long-form-rhythm";
import type { ScoreHistoryPoint } from "../types";
import { useLayoutConfig } from "../layout/useLayoutConfig";
import { MeshBackground } from "../primitives/MeshBackground";

interface TrendChartProps {
  market: string;
  history: ScoreHistoryPoint[];
  currentScore: number;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  market,
  history,
  currentScore,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  // Filter out null values and limit to 12 months
  const validPoints = history.filter((p) => p.score !== null).slice(-12) as {
    date: string;
    score: number;
  }[];

  if (validPoints.length === 0) return null;

  // Chart reveal: bars draw in left-to-right
  const drawProgress = interpolate(frame, [20, 160], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sceneOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const chartW = isVertical ? width - 120 : width - 320;
  const chartH = isVertical ? 500 : 420;
  const barCount = validPoints.length;
  const barGap = 8;
  const barWidth = (chartW - barGap * (barCount - 1)) / barCount;

  const minScore = Math.min(...validPoints.map((p) => p.score)) - 5;
  const maxScore = Math.max(...validPoints.map((p) => p.score)) + 5;

  function barHeight(score: number): number {
    return ((score - minScore) / (maxScore - minScore)) * chartH;
  }

  const titleSize = isVertical ? 48 : 34;
  const labelSize = isVertical ? 22 : 16;
  const valueSize = isVertical ? 26 : 18;

  const spotlightIdx =
    Math.floor(frame / (LONG_FORM_VISUAL_RHYTHM_FRAMES / 3)) % barCount;

  return (
    <div
      style={{
        width,
        height,
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        opacity: sceneOpacity,
        gap: isVertical ? 40 : 32,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.55 }}>
        <MeshBackground />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: isVertical ? 40 : 32,
          width: "100%",
        }}
      >
      {/* Title */}
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 700,
          color: COLORS.text,
          alignSelf: "flex-start",
          marginLeft: isVertical ? 60 : 160,
        }}
      >
        12-Month Score Trend
        <span
          style={{
            color: COLORS.textMuted,
            fontWeight: 400,
            fontSize: titleSize * 0.65,
          }}
        >
          {" "}
          — {market}
        </span>
      </div>

      {/* Chart */}
      <div
        style={{
          width: chartW,
          height: chartH,
          display: "flex",
          alignItems: "flex-end",
          gap: barGap,
          position: "relative",
          transform: `translateX(${Math.sin(frame / 280) * 10}px)`,
        }}
      >
        {/* Baseline */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            background: COLORS.bgCardAlt,
          }}
        />

        {/* State-average reference line at 50 */}
        {minScore < 50 && maxScore > 50 && (
          <div
            style={{
              position: "absolute",
              bottom: barHeight(50),
              left: 0,
              right: 0,
              height: 1,
              background: COLORS.textDim,
              borderTop: `1px dashed ${COLORS.textDim}`,
            }}
          />
        )}

        {validPoints.map((point, i) => {
          const revealThreshold = i / barCount;
          const barProgress = interpolate(
            drawProgress,
            [revealThreshold, Math.min(revealThreshold + 0.15, 1)],
            [0, 1],
            {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );
          const bh = barHeight(point.score) * barProgress;
          const isLast = i === validPoints.length - 1;
          const isSpotlight = i === spotlightIdx;
          const barColor = isLast ? scoreTierColor(point.score) : COLORS.bgCard;
          const borderColor = isLast
            ? scoreTierColor(point.score)
            : COLORS.textDim;
          const bob = Math.sin(frame / 17 + i * 0.65) * 2.2;

          return (
            <div
              key={point.date}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                flex: 1,
                alignSelf: "flex-end",
                transform: `translateY(${bob}px)`,
              }}
            >
              {/* Score label on top of bar */}
              {barProgress > 0.8 && (
                <div
                  style={{
                    fontSize: valueSize,
                    fontWeight: isLast ? 700 : 400,
                    color: isLast
                      ? scoreTierColor(point.score)
                      : COLORS.textMuted,
                    opacity: interpolate(barProgress, [0.8, 1], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    marginBottom: 4,
                  }}
                >
                  {point.score}
                </div>
              )}

              {/* Bar */}
              <div
                style={{
                  width: barWidth,
                  height: bh,
                  background: isLast
                    ? `linear-gradient(to top, ${barColor}40, ${barColor})`
                    : `${barColor}`,
                  borderRadius: "4px 4px 0 0",
                  border: isSpotlight
                    ? `2px solid rgba(57,73,171,0.95)`
                    : isLast
                      ? `2px solid ${borderColor}`
                      : undefined,
                  boxShadow: isSpotlight
                    ? `0 0 28px rgba(57,73,171,0.55)`
                    : isLast
                      ? `0 0 20px ${barColor}40`
                      : undefined,
                  minHeight: 2,
                }}
              />

              {/* Month label */}
              <div
                style={{
                  fontSize: labelSize,
                  color: isLast ? COLORS.text : COLORS.textDim,
                  fontWeight: isLast ? 600 : 400,
                  marginTop: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {new Date(point.date).toLocaleDateString("en-US", {
                  month: "short",
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* State average callout */}
      <div
        style={{
          fontSize: labelSize + 2,
          color: COLORS.textMuted,
          fontStyle: "italic",
        }}
      >
        50 = state average baseline
      </div>
      </div>
    </div>
  );
};
