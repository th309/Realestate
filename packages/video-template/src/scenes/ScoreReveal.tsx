import React from "react";
import { useVideoConfig } from "remotion";
import {
  COLORS,
  scoreMomentumArrow,
  scoreTierColor,
  scoreTierLabel,
} from "../constants";
import { AnimatedEntrance } from "../motion";
import { ScoreRing } from "../primitives/ScoreRing";
import {
  BORDER_WIDTH,
  FONTS,
  NUMERIC,
  brandBorder,
  brandFill,
} from "../styles/tokens";
import type { TrendDirection } from "../types";
import { useLayoutConfig } from "../layout/useLayoutConfig";

interface ScoreRevealProps {
  market: string;
  score: number;
  /** Legacy label from the bundle — display uses the momentum ladder. */
  grade: string;
  trend: TrendDirection;
  trendChange: number;
  periodDate: string;
  /** Data-quality confidence letter (A–F), same as bundle.score.confidence */
  confidenceLetter?: string;
}

/** Frames into the scene before the dial sweep starts (SFX cues match). */
export const SCORE_DIAL_DELAY = 12;

/**
 * The signature scene: the PropertyIQ score dial spin-up. Asymmetric
 * composition — header block pinned top-left, oversized dial pushed
 * right-of-center, momentum pill overlapping the dial's lower-left edge.
 * The badge always shows the momentum ladder label (never quality words —
 * CLAUDE.md §9), regardless of what the bundle's legacy `grade` says.
 */
export const ScoreReveal: React.FC<ScoreRevealProps> = ({
  market,
  score,
  trend,
  trendChange,
  periodDate,
  confidenceLetter,
}) => {
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const tierColor = scoreTierColor(score);
  const momentumLabel = scoreTierLabel(score);
  const momentumArrow = scoreMomentumArrow(score);

  const trendColor =
    trend === "up"
      ? COLORS.trendUp
      : trend === "down"
        ? COLORS.trendDown
        : COLORS.trendStable;
  const trendSymbol = trend === "up" ? "▲" : trend === "down" ? "▼" : "●";
  const trendLabel =
    trend === "stable"
      ? "FLAT"
      : `${trend === "up" ? "+" : ""}${trendChange} pts`;

  const dialSize = isVertical ? 560 : 520;
  const marketSize = isVertical ? 60 : 48;
  const eyebrowSize = isVertical ? 24 : 18;
  const badgeSize = isVertical ? 38 : 30;
  const metaSize = isVertical ? 28 : 22;
  const leftMargin = isVertical ? 96 : 140;

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        fontFamily: FONTS.body,
      }}
    >
      {/* Header block — pinned top-left */}
      <div
        style={{
          position: "absolute",
          left: leftMargin,
          top: isVertical ? 190 : 140,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
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
              PropertyIQ Score
            </span>
          </div>
        </AnimatedEntrance>
        <AnimatedEntrance index={1} from="rise" distance={28}>
          <div
            style={{
              fontSize: marketSize,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: "-1px",
              lineHeight: 1.05,
              maxWidth: isVertical ? width - leftMargin * 2 : width * 0.42,
            }}
          >
            {market}
          </div>
        </AnimatedEntrance>
      </div>

      {/* Dial cluster — pushed right-of-center, momentum pill overlapping */}
      <div
        style={{
          position: "absolute",
          left: isVertical
            ? `calc(58% - ${dialSize / 2}px)`
            : `calc(70% - ${dialSize / 2}px)`,
          top: isVertical ? height * 0.3 : `calc(50% - ${dialSize / 2}px)`,
          width: dialSize,
          height: dialSize,
        }}
      >
        <AnimatedEntrance index={2} from="scale" preset="gentle">
          <ScoreRing score={score} size={dialSize} delay={SCORE_DIAL_DELAY} />
        </AnimatedEntrance>
        <AnimatedEntrance
          index={0}
          delay={SCORE_DIAL_DELAY + 52}
          from="rise"
          preset="pop"
          style={{
            position: "absolute",
            left: -Math.round(dialSize * 0.09),
            bottom: Math.round(dialSize * 0.02),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: brandFill(tierColor),
              border: brandBorder(tierColor),
              backdropFilter: "blur(4px)",
              borderRadius: 999,
              padding: isVertical ? "18px 42px" : "14px 34px",
              fontSize: badgeSize,
              fontWeight: 800,
              color: tierColor,
              letterSpacing: "0.14em",
            }}
          >
            <span>{momentumArrow}</span>
            <span>{momentumLabel}</span>
          </div>
        </AnimatedEntrance>
      </div>

      {/* Meta column — bottom-left */}
      <div
        style={{
          position: "absolute",
          left: leftMargin,
          top: isVertical ? height * 0.72 : height * 0.74,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {confidenceLetter && /^[A-F]$/i.test(confidenceLetter) && (
          <AnimatedEntrance index={0} delay={SCORE_DIAL_DELAY + 60} from="rise">
            <div
              style={{
                fontSize: metaSize,
                fontWeight: 600,
                color: COLORS.textMuted,
                letterSpacing: "0.08em",
              }}
            >
              Data confidence{" "}
              <span style={{ color: COLORS.text, fontWeight: 800, ...NUMERIC }}>
                {confidenceLetter.toUpperCase()}
              </span>
            </div>
          </AnimatedEntrance>
        )}
        <AnimatedEntrance index={1} delay={SCORE_DIAL_DELAY + 60} from="rise">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: metaSize,
              color: trendColor,
              fontWeight: 600,
              ...NUMERIC,
            }}
          >
            <span>{trendSymbol}</span>
            <span>{trendLabel}</span>
            <span style={{ color: COLORS.textDim, fontSize: metaSize * 0.8 }}>
              vs last month
            </span>
          </div>
        </AnimatedEntrance>
        <AnimatedEntrance index={2} delay={SCORE_DIAL_DELAY + 60} from="rise">
          <div style={{ fontSize: metaSize * 0.8, color: COLORS.textDim }}>
            Scored{" "}
            {new Date(periodDate).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </div>
        </AnimatedEntrance>
      </div>
    </div>
  );
};
