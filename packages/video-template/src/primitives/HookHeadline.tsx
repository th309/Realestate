import React from "react";
import { AbsoluteFill } from "remotion";
import { AnimatedEntrance } from "../motion";
import { BORDER_WIDTH, FONTS, PALETTE } from "../styles/tokens";

interface HookHeadlineProps {
  headline: string;
  scope: string;
  accent: string;
}

/**
 * Hook scene shown during the audio's intro (everything before the narrator
 * says "Number N."). Editorial framing — Roboto Black at display size with
 * tight letter-spacing, plus a hairline rule grounding the typography.
 *
 * The four elements enter on the house 4-frame stagger (eyebrow → headline →
 * rule → scope) so the card assembles top-down instead of flashing in whole.
 *
 * Used only by Top10Layout's hook window; not a generic primitive.
 */
export const HookHeadline: React.FC<HookHeadlineProps> = ({
  headline,
  scope,
  accent,
}) => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: "0 80px",
      }}
    >
      <AnimatedEntrance index={0} from="rise" distance={40}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontWeight: 600,
            fontSize: 28,
            letterSpacing: "0.32em",
            color: accent,
            textTransform: "uppercase",
          }}
        >
          Countdown
        </div>
      </AnimatedEntrance>
      <AnimatedEntrance index={1} from="rise" distance={40}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: 900,
            fontSize: 156,
            letterSpacing: "-0.05em",
            lineHeight: 0.95,
            color: PALETTE.surface,
            textAlign: "center",
          }}
        >
          {headline}
        </div>
      </AnimatedEntrance>
      <AnimatedEntrance index={2} from="none" preset="gentle">
        <div
          style={{
            height: BORDER_WIDTH,
            width: 320,
            backgroundColor: PALETTE.indigoMedium,
          }}
        />
      </AnimatedEntrance>
      <AnimatedEntrance index={3} from="rise" distance={24}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontWeight: 500,
            fontSize: 32,
            letterSpacing: "0.18em",
            color: PALETTE.indigoLight,
            textTransform: "uppercase",
          }}
        >
          {scope}
        </div>
      </AnimatedEntrance>
    </AbsoluteFill>
  );
};
