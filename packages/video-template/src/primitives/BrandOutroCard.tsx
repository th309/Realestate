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
        gap: 24 * scale,
        opacity,
      }}
    >
      {typeof score === "number" && (
        <ScoreRing score={score} size={180 * scale} />
      )}
      <div
        style={{
          color: "#FFFFFF",
          fontFamily: "Roboto",
          fontSize: 40 * scale,
          fontWeight: 600,
        }}
      >
        PropertyIQ
      </div>
      <div
        style={{
          color: "#00C853",
          fontFamily: "Roboto Mono",
          fontSize: 44 * scale,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        propertyiq.app
      </div>
      {ctaUrl && (
        <div
          style={{
            color: "#C5CAE9",
            fontFamily: "Roboto Mono",
            fontSize: 20 * scale,
            opacity: 0.8,
          }}
        >
          {ctaUrl}
        </div>
      )}
    </AbsoluteFill>
  );
};
