import React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ScoreRing } from "./ScoreRing";
import { useLayoutConfig } from "../layout/useLayoutConfig";

export interface BrandOutroCardProps {
  ctaUrl: string;
  score?: number;
}

/**
 * 3-second closing CTA card. Displays optional ScoreRing above the
 * PropertyIQ wordmark and the UTM-tagged CTA URL.
 */
export const BrandOutroCard: React.FC<BrandOutroCardProps> = ({
  ctaUrl,
  score,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale } = useLayoutConfig();
  const opacity = spring({ frame, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1A1A2E",
        justifyContent: "center",
        alignItems: "center",
        gap: 36 * scale,
        opacity,
      }}
    >
      {typeof score === "number" && (
        <ScoreRing score={score} size={220 * scale} />
      )}
      <div
        style={{
          color: "#FFFFFF",
          fontFamily: "Roboto",
          fontSize: 144 * scale,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        PropertyIQ
      </div>
      <div
        style={{
          height: 3,
          width: 320 * scale,
          backgroundColor: "#5C6BC0",
        }}
      />
      <div
        style={{
          color: "#00C853",
          fontFamily: "Roboto Mono",
          fontSize: 112 * scale,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        propertyiq.app
      </div>
      {ctaUrl && (
        <div
          style={{
            color: "#C5CAE9",
            fontFamily: "Roboto Mono",
            fontSize: 32 * scale,
            opacity: 0.75,
            letterSpacing: "0.02em",
          }}
        >
          {ctaUrl}
        </div>
      )}
    </AbsoluteFill>
  );
};
