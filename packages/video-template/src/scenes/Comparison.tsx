import React from "react";
import { useVideoConfig } from "remotion";
import {
  COLORS,
  scoreMomentumArrow,
  scoreTierColor,
  scoreTierLabel,
} from "../constants";
import { AnimatedEntrance, staggerDelay } from "../motion";
import { ScoreRing } from "../primitives/ScoreRing";
import {
  BORDER_WIDTH,
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
  brandFill,
} from "../styles/tokens";
import type { MarketData, ComparisonMarket } from "../types";
import { useLayoutConfig } from "../layout/useLayoutConfig";

interface ComparisonProps {
  primary: MarketData;
  others: ComparisonMarket[];
}

interface MarketColumnProps {
  market: string;
  score: number;
  /** Legacy label from the bundle — display uses the momentum ladder. */
  grade: string;
  trend: string;
  trendChange: number;
  isPrimary: boolean;
  /** Position in the column group — drives the 4-frame sibling stagger. */
  index: number;
  isVertical: boolean;
}

/** Frames before the columns enter, so the header lands first. */
const COLUMN_ENTRANCE_DELAY = 8;
/** Frames into the scene before the first column's dial starts its sweep. */
const COLUMN_DIAL_DELAY = 20;

/**
 * One market's card: the signature ScoreRing dial, the momentum badge, and
 * the month-over-month delta. Columns never animate together — `index`
 * offsets both the card entrance and its dial sweep by 4 frames apiece, so
 * the eye lands on the featured market first.
 */
const MarketColumn: React.FC<MarketColumnProps> = ({
  market,
  score,
  trend,
  trendChange,
  isPrimary,
  index,
  isVertical,
}) => {
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

  const marketSize = isVertical ? 36 : 26;
  const badgeSize = isVertical ? 26 : 20;
  const dialSize = isVertical ? 250 : 240;

  return (
    <AnimatedEntrance
      index={index}
      delay={COLUMN_ENTRANCE_DELAY}
      from="rise"
      preset="gentle"
      distance={28}
      style={{ flex: 1, display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: isVertical ? 20 : 16,
          padding: isVertical ? "24px 16px" : "20px 16px",
          background: isPrimary ? brandFill(tierColor) : COLORS.bgCard,
          borderRadius: 24,
          border: isPrimary
            ? brandBorder(tierColor, 0.6)
            : brandBorder(PALETTE.indigoMedium, 0.25),
          position: "relative",
        }}
      >
        {isPrimary && (
          <div
            style={{
              position: "absolute",
              top: -14,
              background: tierColor,
              color: PALETTE.stage,
              fontSize: isVertical ? 18 : 13,
              fontWeight: 700,
              padding: "4px 16px",
              borderRadius: 999,
              letterSpacing: "0.1em",
            }}
          >
            FEATURED MARKET
          </div>
        )}

        <div
          style={{
            fontSize: marketSize,
            fontWeight: 700,
            color: COLORS.text,
            textAlign: "center",
          }}
        >
          {market}
        </div>

        {/* The signature dial — same primitive every score-forward beat mounts */}
        <ScoreRing
          score={score}
          size={dialSize}
          delay={COLUMN_DIAL_DELAY + staggerDelay(index)}
          strokeWidth={12}
        />

        {/* Momentum badge — the ladder label, never a quality word */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: brandFill(tierColor),
            border: brandBorder(tierColor),
            borderRadius: 999,
            padding: isVertical ? "10px 28px" : "8px 22px",
            fontSize: badgeSize,
            fontWeight: 800,
            color: tierColor,
            letterSpacing: "0.1em",
          }}
        >
          <span>{momentumArrow}</span>
          <span>{momentumLabel}</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: FONTS.mono,
            fontSize: isVertical ? 26 : 20,
            color: trendColor,
            fontWeight: 600,
            ...NUMERIC,
          }}
        >
          <span>{trendSymbol}</span>
          <span>
            {trend === "stable"
              ? "FLAT"
              : `${trend === "up" ? "+" : ""}${trendChange} pts`}
          </span>
        </div>
      </div>
    </AnimatedEntrance>
  );
};

/**
 * Head-to-head beat: eyebrow + rule header, then one dial column per market.
 * Paints no background of its own — the hosting layout keeps a persistent
 * MeshBackground underneath every scene.
 */
export const Comparison: React.FC<ComparisonProps> = ({ primary, others }) => {
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const allMarkets = [
    { ...primary, isPrimary: true },
    ...others.map((o) => ({
      ...o,
      stats: primary.stats,
      history: [],
      periodDate: primary.periodDate,
      isPrimary: false,
    })),
  ];

  const titleSize = isVertical ? 48 : 36;
  const eyebrowSize = isVertical ? 22 : 16;
  const padding = isVertical ? 40 : 80;

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONTS.body,
        padding: `0 ${padding}px`,
        gap: isVertical ? 40 : 32,
        boxSizing: "border-box",
      }}
    >
      {/* Header: eyebrow + rule, then the scene title */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignSelf: "flex-start",
          width: "100%",
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
              Head to Head
            </span>
          </div>
        </AnimatedEntrance>
        <AnimatedEntrance index={1} from="rise" distance={24}>
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: "-1px",
            }}
          >
            Market Comparison
          </div>
        </AnimatedEntrance>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          gap: isVertical ? 24 : 28,
          width: "100%",
          alignItems: "stretch",
        }}
      >
        {allMarkets.map((m, i) => (
          <MarketColumn
            key={m.market}
            market={m.market}
            score={m.score}
            grade={m.grade}
            trend={m.trend}
            trendChange={m.trendChange}
            isPrimary={m.isPrimary}
            index={i}
            isVertical={!!isVertical}
          />
        ))}
      </div>
    </div>
  );
};
