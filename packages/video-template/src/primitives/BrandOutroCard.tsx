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
          color: "#C5CAE9",
          fontFamily: "Roboto Mono",
          fontSize: 28 * scale,
        }}
      >
        {ctaUrl}
      </div>
    </AbsoluteFill>
  );
};
