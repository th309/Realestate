import React from "react";
import { AbsoluteFill } from "remotion";
import { AnimatedEntrance } from "../motion";
import {
  BORDER_WIDTH,
  FONTS,
  NUMERIC,
  PALETTE,
  brandBorder,
} from "../styles/tokens";

interface OutroSummaryEntry {
  rank: number;
  region_id?: string;
  region_name: string;
  state: string;
  value_formatted: string;
}

interface OutroSummaryProps {
  /** Markets in countdown order (last entry = #1). */
  markets: ReadonlyArray<OutroSummaryEntry>;
  accent: string;
  themeLabel: string;
}

/** Frames the header holds before the first recap row starts assembling. */
const ROW_BASE_DELAY = 8;

/**
 * Final all-ranks recap shown during the outro voice-over. Reverses the
 * countdown so the audience sees the leaderboard in best-to-worst order
 * with #1 at the top — the natural mental model for the recap.
 *
 * Sized to fill the full 1080×1920 frame minus the persistent CornerBug
 * region. Each row gets ~150px of vertical space so the recap reads as a
 * confident editorial table, not a cramped tooltip. Rows enter on the house
 * 4-frame stagger so the leaderboard feels assembled, not dropped.
 */
export const OutroSummary: React.FC<OutroSummaryProps> = ({
  markets,
  accent,
  themeLabel,
}) => {
  const summary = [...markets].reverse();
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        // Top padding clears the CornerBug region; bottom padding clears the
        // closing brand card region so the recap doesn't feel buried.
        padding: "240px 80px 80px 80px",
      }}
    >
      <AnimatedEntrance index={0} from="left" distance={32} preset="gentle">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 20,
            marginBottom: 50,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 56,
              letterSpacing: "0.28em",
              color: accent,
              textTransform: "uppercase",
              lineHeight: 1,
              ...NUMERIC,
            }}
          >
            {themeLabel}
          </div>
          <div
            style={{
              height: BORDER_WIDTH,
              width: "100%",
              backgroundColor: PALETTE.indigoMedium,
            }}
          />
        </div>
      </AnimatedEntrance>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "space-between",
        }}
      >
        {summary.map((m, i) => (
          <AnimatedEntrance
            key={m.region_id ?? `${m.rank}-${m.region_name}`}
            index={i}
            delay={ROW_BASE_DELAY}
            from="rise"
            distance={16}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 32,
                color: PALETTE.surface,
                borderBottom: brandBorder(PALETTE.indigoMedium, 0.32),
                paddingBottom: 14,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontWeight: 800,
                  fontSize: 88,
                  lineHeight: 1,
                  color: accent,
                  width: 130,
                  textAlign: "right",
                  letterSpacing: "-0.04em",
                  ...NUMERIC,
                }}
              >
                {m.rank}
              </span>
              <span
                style={{
                  flex: 1,
                  fontFamily: FONTS.display,
                  fontWeight: 800,
                  fontSize: 64,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {m.region_name}
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontWeight: 500,
                    fontSize: 40,
                    color: PALETTE.indigoMuted,
                    marginLeft: 18,
                  }}
                >
                  {m.state}
                </span>
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 80,
                  lineHeight: 1,
                  color: PALETTE.surface,
                  letterSpacing: "-0.02em",
                  textAlign: "right",
                  minWidth: 180,
                  ...NUMERIC,
                }}
              >
                {m.value_formatted}
              </span>
            </div>
          </AnimatedEntrance>
        ))}
      </div>
    </AbsoluteFill>
  );
};
