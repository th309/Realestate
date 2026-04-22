import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
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

  const logoSize = isVertical ? 56 : 40;
  const titleSize = isVertical ? 52 : 36;
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
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        opacity,
        transform: `translateY(${slideUp}px)`,
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          width: logoSize * 2,
          height: logoSize * 2,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.accent}, #6366f1)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
          boxShadow: `0 0 60px ${COLORS.accentGlow}`,
        }}
      >
        <span
          style={{
            color: COLORS.text,
            fontWeight: 800,
            fontSize: logoSize * 0.9,
            letterSpacing: "-2px",
          }}
        >
          IQ
        </span>
      </div>

      {/* PropertyIQ wordmark */}
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 800,
          color: COLORS.text,
          letterSpacing: "-1px",
          marginBottom: 12,
        }}
      >
        Property<span style={{ color: COLORS.accent }}>IQ</span>
      </div>

      {/* Market name */}
      <div
        style={{
          fontSize: subSize,
          fontWeight: 500,
          color: COLORS.textMuted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {marketName}
      </div>
    </div>
  );
};
