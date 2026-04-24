import React from "react";
import {
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { COLORS, FPS } from "../constants";
import { useLayoutConfig } from "../layout/useLayoutConfig";

interface IntroProps {
  marketName: string;
}

export const Intro: React.FC<IntroProps> = ({ marketName }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isVertical } = useLayoutConfig();

  const opacity = interpolate(frame, [0, 20, 50, 60], [0, 1, 1, 0], {
    easing: Easing.ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slideUp = interpolate(frame, [0, 20], [40, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shortmarkSize = isVertical ? 160 : 120;
  const wordmarkWidth = isVertical ? 380 : 280;
  const subSize = isVertical ? 32 : 22;

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
        gap: 24,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        opacity,
        transform: `translateY(${slideUp}px)`,
      }}
    >
      {/* PIQ shortmark image — same asset as BrandBumper for continuity */}
      <Img
        src={staticFile("brand/piq-shortmark-192px-normal.png")}
        style={{
          width: shortmarkSize,
          height: shortmarkSize,
          objectFit: "contain",
        }}
      />

      {/* PropertyIQ wordmark lockup (light/reversed for dark bg) */}
      <Img
        src={staticFile("brand/piq-logo-primary-dark-reversed.png")}
        style={{
          width: wordmarkWidth,
          height: "auto",
          objectFit: "contain",
        }}
      />

      {/* Market name */}
      <div
        style={{
          fontSize: subSize,
          fontWeight: 500,
          color: COLORS.textMuted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginTop: 8,
        }}
      >
        {marketName}
      </div>
    </div>
  );
};
