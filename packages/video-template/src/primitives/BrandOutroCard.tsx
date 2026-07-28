import React from "react";
import { AbsoluteFill } from "remotion";
import { ScoreRing } from "./ScoreRing";
import { AnimatedEntrance } from "../motion";
import { FONTS, PALETTE } from "../styles/tokens";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface BrandOutroCardProps {
  ctaUrl: string;
  score?: number;
  /**
   * Authored closing line, shown above the wordmark. Formats that generate
   * their own copy from data omit it and keep the standing brand close.
   */
  headline?: string;
}

/**
 * 3-second closing CTA card. The signature ScoreRing dial re-sweeps above
 * the PropertyIQ wordmark and the UTM-tagged CTA URL — the motif viewers
 * saw at the reveal closes the video.
 */
export const BrandOutroCard: React.FC<BrandOutroCardProps> = ({
  ctaUrl,
  score,
  headline,
}) => {
  const { scale, isVertical } = useLayoutConfig();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: PALETTE.stage,
        justifyContent: "center",
        alignItems: "center",
        gap: 36 * scale,
      }}
    >
      {typeof score === "number" && (
        <AnimatedEntrance index={0} from="scale" preset="gentle">
          <ScoreRing score={score} size={220 * scale} delay={6} />
        </AnimatedEntrance>
      )}
      {headline && (
        <AnimatedEntrance index={0} from="rise" distance={32}>
          <div
            style={{
              color: PALETTE.surface,
              fontFamily: FONTS.display,
              fontSize: (isVertical ? 68 : 54) * scale,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              textAlign: "center",
              maxWidth: 900 * scale,
            }}
          >
            {headline}
          </div>
        </AnimatedEntrance>
      )}
      <AnimatedEntrance index={1} from="rise">
        <div
          style={{
            color: PALETTE.surface,
            fontFamily: FONTS.display,
            fontSize: 144 * scale,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          PropertyIQ
        </div>
      </AnimatedEntrance>
      <AnimatedEntrance index={2} from="none">
        <div
          style={{
            height: 3,
            width: 320 * scale,
            backgroundColor: PALETTE.indigoMedium,
          }}
        />
      </AnimatedEntrance>
      <AnimatedEntrance index={3} from="rise">
        <div
          style={{
            color: PALETTE.positive,
            fontFamily: FONTS.mono,
            fontSize: 112 * scale,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          propertyiq.app
        </div>
      </AnimatedEntrance>
      {ctaUrl && (
        <AnimatedEntrance index={4} from="rise">
          <div
            style={{
              color: PALETTE.indigoLight,
              fontFamily: FONTS.mono,
              fontSize: 32 * scale,
              opacity: 0.75,
              letterSpacing: "0.02em",
            }}
          >
            {ctaUrl}
          </div>
        </AnimatedEntrance>
      )}
    </AbsoluteFill>
  );
};
