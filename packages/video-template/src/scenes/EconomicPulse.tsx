import React from "react";
import { useVideoConfig } from "remotion";
import { COLORS } from "../constants";
import { AnimatedEntrance } from "../motion";
import {
  BORDER_WIDTH,
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
  brandFill,
} from "../styles/tokens";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface EconomicPulseProps {
  market: string;
  unemploymentPct: number;
  jobGrowthYoyPct: number;
}

/** Frames before the stat bands enter, so the header reads first. */
const BAND_DELAY = 10;

interface StatBandProps {
  label: string;
  value: string;
  footnote: string;
  accent: string;
  /** Position in the band group — 4-frame sibling stagger. */
  index: number;
  isVertical: boolean;
}

const StatBand: React.FC<StatBandProps> = ({
  label,
  value,
  footnote,
  accent,
  index,
  isVertical,
}) => {
  const subtitleSize = isVertical ? 26 : 20;
  const heroSize = isVertical ? 72 : 56;

  return (
    <AnimatedEntrance
      index={index}
      delay={BAND_DELAY}
      from="rise"
      preset="gentle"
      distance={26}
      style={{ flex: 1, display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          flex: 1,
          borderRadius: 24,
          padding: isVertical ? 36 : 32,
          background: brandFill(accent),
          border: brandBorder(accent, 0.5),
        }}
      >
        <div
          style={{
            fontSize: subtitleSize,
            color: COLORS.textMuted,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: heroSize,
            fontWeight: 800,
            color: accent,
            letterSpacing: "-2px",
            ...NUMERIC,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: subtitleSize - 2, color: COLORS.textDim }}>
          {footnote}
        </div>
      </div>
    </AnimatedEntrance>
  );
};

/**
 * Secondary long-form beat when score history is unavailable: labor market
 * framing so the segment is not a repeat of StatCards. Paints no background
 * of its own — the hosting layout keeps a persistent MeshBackground behind it.
 */
export const EconomicPulse: React.FC<EconomicPulseProps> = ({
  market,
  unemploymentPct,
  jobGrowthYoyPct,
}) => {
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const titleSize = isVertical ? 44 : 32;
  const eyebrowSize = isVertical ? 22 : 16;

  const unempLabel = `${unemploymentPct.toFixed(1)}%`;
  const growing = jobGrowthYoyPct >= 0;
  const jobLabel = `${growing ? "+" : ""}${jobGrowthYoyPct.toFixed(1)}%`;
  const jobColor = growing ? PALETTE.positive : PALETTE.negative;

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
        padding: isVertical ? "48px 56px" : "40px 100px",
        boxSizing: "border-box",
        gap: isVertical ? 36 : 28,
      }}
    >
      {/* Header: eyebrow + rule, then the market */}
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
              Economy &amp; Jobs
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
            {market}
          </div>
        </AnimatedEntrance>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          gap: isVertical ? 28 : 40,
          width: "100%",
          alignItems: "stretch",
        }}
      >
        <StatBand
          index={0}
          label="Unemployment rate"
          value={unempLabel}
          footnote="BLS / economic feed"
          accent={PALETTE.indigoMedium}
          isVertical={!!isVertical}
        />
        <StatBand
          index={1}
          label="Job growth (YoY)"
          value={jobLabel}
          footnote="Year-over-year change"
          accent={jobColor}
          isVertical={!!isVertical}
        />
      </div>
    </div>
  );
};
